import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX
} from 'react';
import { useAuth } from './auth-context';
import type * as BackendApi from '@lib/atproto/backend';
import type { ReactNode } from 'react';
import type { TweetWithUser } from '@lib/types/tweet';

type BackendRuntime = typeof BackendApi;

let backendRuntimePromise: Promise<BackendRuntime> | null = null;

function loadBackendRuntime(): Promise<BackendRuntime> {
  backendRuntimePromise ??= import('@lib/atproto/backend');

  return backendRuntimePromise;
}

type LiveUpdatesContext = {
  homeBadgeCount: number;
  notificationCount: number;
  messageCount: number;
  clearHomeBadge: (topTweetId?: string | null) => void;
  clearNotifications: () => void;
  clearMessages: () => void;
  refreshLiveUpdates: () => Promise<void>;
};

type LiveUpdatesProviderProps = {
  children: ReactNode;
};

const LiveUpdatesContext = createContext<LiveUpdatesContext | null>(null);

const LIVE_UPDATES_REFRESH_INTERVAL_MS = 60000;
const LIVE_HOME_FEED_LIMIT = 30;
const LIVE_NOTIFICATION_LIMIT = 80;
const LIVE_MESSAGE_LIMIT = 50;

function countNewHomeTweets(
  tweets: TweetWithUser[],
  previousTopId: string | null
): number {
  if (!previousTopId) return 0;

  const previousTopIndex = tweets.findIndex(({ id }) => id === previousTopId);

  return previousTopIndex === -1 ? tweets.length : previousTopIndex;
}

function getUnreadNotificationsCount(
  notifications: Awaited<
    ReturnType<BackendRuntime['listNotificationsPage']>
  >['notifications']
): number {
  return notifications.filter(({ isRead }) => !isRead).length;
}

function getUnreadMessagesCount(
  convos: Awaited<ReturnType<BackendRuntime['listChatConvos']>>['convos']
): number {
  return convos.reduce((total, { unreadCount }) => total + unreadCount, 0);
}

export function LiveUpdatesProvider({
  children
}: LiveUpdatesProviderProps): JSX.Element {
  const { user } = useAuth();
  const [homeBadgeCount, setHomeBadgeCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const homeTopTweetIdRef = useRef<string | null>(null);

  const clearHomeBadge = useCallback((topTweetId?: string | null): void => {
    if (topTweetId !== undefined) homeTopTweetIdRef.current = topTweetId;
    setHomeBadgeCount(0);
  }, []);

  const clearNotifications = useCallback((): void => {
    setNotificationCount(0);
  }, []);

  const clearMessages = useCallback((): void => {
    setMessageCount(0);
  }, []);

  const refreshHomeBadge = useCallback(async (): Promise<void> => {
    const { getFollowingHomeFeedPage } = await loadBackendRuntime();
    const page = await getFollowingHomeFeedPage(
      undefined,
      LIVE_HOME_FEED_LIMIT
    );
    const topTweetId = page.tweets[0]?.id ?? null;
    const previousTopId = homeTopTweetIdRef.current;

    if (!topTweetId) return;

    if (!previousTopId) {
      homeTopTweetIdRef.current = topTweetId;
      return;
    }

    const newCount = countNewHomeTweets(page.tweets, previousTopId);

    if (newCount > 0)
      setHomeBadgeCount((currentCount) => Math.max(currentCount, newCount));
  }, []);

  const refreshNotifications = useCallback(async (): Promise<void> => {
    const { listNotificationsPage } = await loadBackendRuntime();
    const page = await listNotificationsPage(undefined, {
      limit: LIVE_NOTIFICATION_LIMIT
    });

    setNotificationCount(getUnreadNotificationsCount(page.notifications));
  }, []);

  const refreshMessages = useCallback(async (): Promise<void> => {
    const { isChatAccessError, listChatConvos } = await loadBackendRuntime();

    try {
      const page = await listChatConvos(undefined, LIVE_MESSAGE_LIMIT);
      setMessageCount(getUnreadMessagesCount(page.convos));
    } catch (error) {
      if (isChatAccessError(error)) setMessageCount(0);
    }
  }, []);

  const refreshLiveUpdates = useCallback(async (): Promise<void> => {
    await Promise.all([
      refreshHomeBadge().catch(() => undefined),
      refreshNotifications().catch(() => undefined),
      refreshMessages().catch(() => undefined)
    ]);
  }, [refreshHomeBadge, refreshMessages, refreshNotifications]);

  useEffect(() => {
    homeTopTweetIdRef.current = null;
    setHomeBadgeCount(0);
    setNotificationCount(0);
    setMessageCount(0);

    if (!user) return;

    let refreshInFlight = false;
    let lastRefreshAt = 0;

    const refreshSoon = (force = false): void => {
      if (document.visibilityState === 'hidden') return;

      const now = Date.now();
      if (refreshInFlight) return;
      if (!force && now - lastRefreshAt < LIVE_UPDATES_REFRESH_INTERVAL_MS)
        return;

      refreshInFlight = true;
      lastRefreshAt = now;

      void refreshLiveUpdates()
        .catch(() => undefined)
        .finally(() => {
          refreshInFlight = false;
        });
    };

    refreshSoon(true);

    const handleFocus = (): void => refreshSoon();
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') refreshSoon();
    };
    const intervalId = window.setInterval(
      () => refreshSoon(),
      LIVE_UPDATES_REFRESH_INTERVAL_MS
    );
    let unsubscribe = (): void => undefined;
    let subscriptionCancelled = false;

    void loadBackendRuntime().then(({ subscribeBackend }) => {
      if (subscriptionCancelled) return;
      unsubscribe = subscribeBackend(handleFocus, ['content']);
    });

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscriptionCancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
    };
  }, [refreshLiveUpdates, user]);

  const value = useMemo(
    () => ({
      homeBadgeCount,
      notificationCount,
      messageCount,
      clearHomeBadge,
      clearNotifications,
      clearMessages,
      refreshLiveUpdates
    }),
    [
      clearHomeBadge,
      clearMessages,
      clearNotifications,
      homeBadgeCount,
      messageCount,
      notificationCount,
      refreshLiveUpdates
    ]
  );

  return (
    <LiveUpdatesContext.Provider value={value}>
      {children}
    </LiveUpdatesContext.Provider>
  );
}

export function useLiveUpdates(): LiveUpdatesContext {
  const context = useContext(LiveUpdatesContext);

  if (!context)
    throw new Error('useLiveUpdates must be used within LiveUpdatesProvider');

  return context;
}
