import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX
} from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import useSWR from 'swr';
import {
  getDiscoverHomeFeedPage,
  getFollowingHomeFeedPage,
  getSubscribedHomeFeedPage,
  getSubscribedHomeFeeds,
  subscribeBackend
} from '@lib/atproto/backend';
import { useLiveUpdates } from '@lib/context/live-updates-context';
import { useWindow } from '@lib/context/window-context';
import { getNextTabIndexFromShortcut } from '@lib/keyboard-shortcuts';
import { HomeLayout, ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { Input } from '@components/input/input';
import { UpdateUsername } from '@components/home/update-username';
import { MobileSidebar } from '@components/sidebar/mobile-sidebar';
import { Tweet } from '@components/tweet/tweet';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { Error } from '@components/ui/error';
import { ToolTip } from '@components/ui/tooltip';
import type {
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactElement,
  ReactNode
} from 'react';
import type { HomeFeedPage, SubscribedHomeFeed } from '@lib/atproto/backend';
import type { TweetWithUser } from '@lib/types/tweet';

type HomeFeedTab = 'for-you' | 'following' | `feed:${string}`;

type HomeFeedTabData = {
  label: string;
  value: HomeFeedTab;
};

const HOME_FEED_REFRESH_INTERVAL_MS = 60000;
const FOR_YOU_HOME_FEED_TAB = 'for-you';
const FEED_TAB_PREFIX = 'feed:';
type HomeFeedRefreshMode = 'banner' | 'replace';

async function getHomeFeedPage(
  tab: HomeFeedTab,
  cursor?: string
): Promise<HomeFeedPage> {
  if (tab === FOR_YOU_HOME_FEED_TAB) return getDiscoverHomeFeedPage(cursor);
  if (tab === 'following') return getFollowingHomeFeedPage(cursor);

  return getSubscribedHomeFeedPage(tab.slice(FEED_TAB_PREFIX.length), cursor);
}

function normalizeFeedLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isFixedForYouDuplicate({ displayName }: SubscribedHomeFeed): boolean {
  const normalizedLabel = normalizeFeedLabel(displayName);

  return (
    normalizedLabel === 'discover' ||
    normalizedLabel === 'for you' ||
    normalizedLabel === 'for-you'
  );
}

function getSubscribedFeedTab(
  feed: SubscribedHomeFeed,
  label = feed.displayName
): HomeFeedTabData {
  return {
    label,
    value: `${FEED_TAB_PREFIX}${feed.uri}` as HomeFeedTab
  };
}

function getHomeFeedTabs(
  subscribedFeeds: SubscribedHomeFeed[]
): HomeFeedTabData[] {
  const savedFeedTabs = subscribedFeeds
    .filter((feed) => feed.type === 'feed')
    .filter((feed) => !isFixedForYouDuplicate(feed))
    .map((feed) => getSubscribedFeedTab(feed));

  return [
    { label: 'For you', value: FOR_YOU_HOME_FEED_TAB },
    { label: 'Following', value: 'following' },
    ...savedFeedTabs
  ];
}

function mergeTweets(
  currentFeed: TweetWithUser[],
  nextFeed: TweetWithUser[]
): TweetWithUser[] {
  const seenIds = new Set(currentFeed.map(({ id }) => id));
  const newTweets = nextFeed.filter(({ id }) => !seenIds.has(id));

  return [...currentFeed, ...newTweets];
}

function prependTweets(
  currentFeed: TweetWithUser[],
  nextFeed: TweetWithUser[]
): TweetWithUser[] {
  const seenIds = new Set(currentFeed.map(({ id }) => id));
  const newTweets = nextFeed.filter(({ id }) => !seenIds.has(id));

  return [...newTweets, ...currentFeed];
}

function getNewTweetsBeforeCurrentTop(
  nextFeed: TweetWithUser[],
  currentFeed: TweetWithUser[],
  pendingTweets: TweetWithUser[]
): TweetWithUser[] {
  const currentTopId = currentFeed[0]?.id;
  const knownIds = new Set(
    [...currentFeed, ...pendingTweets].map(({ id }) => id)
  );
  const newTweets: TweetWithUser[] = [];

  for (const tweet of nextFeed) {
    if (tweet.id === currentTopId) break;
    if (!knownIds.has(tweet.id)) newTweets.push(tweet);
  }

  return newTweets;
}

function HomeTabs({
  activeTab,
  setActiveTab,
  homeFeedTabs
}: {
  activeTab: HomeFeedTab;
  setActiveTab: (tab: HomeFeedTab) => void;
  homeFeedTabs: HomeFeedTabData[];
}): JSX.Element {
  const scrollRef = useRef<HTMLElement | null>(null);
  const suppressNextClickRef = useRef(false);
  const dragStateRef = useRef({
    dragging: false,
    moved: false,
    pendingTab: null as HomeFeedTab | null,
    pointerId: 0,
    scrollLeft: 0,
    startX: 0
  });
  const handlePointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (event.button !== 0 || !scrollRef.current) return;

    const pendingTabButton =
      event.target instanceof HTMLElement
        ? (event.target.closest('[data-feed-tab]') as HTMLButtonElement | null)
        : null;

    dragStateRef.current = {
      dragging: true,
      moved: false,
      pendingTab: (pendingTabButton?.dataset.feedTab as HomeFeedTab) ?? null,
      pointerId: event.pointerId,
      scrollLeft: scrollRef.current.scrollLeft,
      startX: event.clientX
    };
    scrollRef.current.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>): void => {
    const dragState = dragStateRef.current;
    if (
      !dragState.dragging ||
      dragState.pointerId !== event.pointerId ||
      !scrollRef.current
    )
      return;

    const offset = event.clientX - dragState.startX;
    if (Math.abs(offset) > 4) dragState.moved = true;
    if (dragState.moved) event.preventDefault();
    scrollRef.current.scrollLeft = dragState.scrollLeft - offset;
  };

  const stopDragging = (event: PointerEvent<HTMLElement>): void => {
    const dragState = dragStateRef.current;
    if (!dragState.dragging || dragState.pointerId !== event.pointerId) return;

    if (dragState.moved) suppressNextClickRef.current = true;
    else if (dragState.pendingTab) setActiveTab(dragState.pendingTab);

    dragStateRef.current = {
      dragging: false,
      moved: false,
      pendingTab: null,
      pointerId: 0,
      scrollLeft: 0,
      startX: 0
    };

    if (scrollRef.current?.hasPointerCapture(event.pointerId))
      scrollRef.current.releasePointerCapture(event.pointerId);
  };

  const handleClickCapture = (event: MouseEvent<HTMLElement>): void => {
    if (!suppressNextClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    suppressNextClickRef.current = false;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const tabButtons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    );
    const currentTab =
      event.target instanceof HTMLElement
        ? (event.target.closest('[role="tab"]') as HTMLButtonElement | null)
        : null;
    const currentIndex = currentTab ? tabButtons.indexOf(currentTab) : -1;
    const nextIndex = getNextTabIndexFromShortcut(
      event.key,
      currentIndex,
      tabButtons.length
    );

    if (nextIndex === null) return;

    event.preventDefault();
    tabButtons[nextIndex]?.focus();
    setActiveTab(homeFeedTabs[nextIndex].value);
  };

  return (
    <nav
      className='feed-tabs-scroll h-[53px] select-none overflow-x-auto overflow-y-hidden
                 border-b border-light-border dark:border-dark-border'
      ref={scrollRef}
      role='tablist'
      aria-label='Home feeds'
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onClickCapture={handleClickCapture}
      onKeyDown={handleKeyDown}
    >
      <div className='flex h-full min-w-full'>
        {homeFeedTabs.map(({ label, value }) => {
          const active = activeTab === value;
          const selectTab = (): void => setActiveTab(value);

          return (
            <button
              className={cn(
                `accent-tab hover-card group/tab relative flex h-[53px] items-center justify-center
                 text-[15px] font-bold outline-none transition-[max-width,padding] duration-150`,
                active
                  ? `min-w-[128px] flex-none px-5 text-light-primary
                     dark:text-dark-primary`
                  : `min-w-[128px] max-w-[170px] flex-1 px-4
                     text-light-secondary hover:max-w-none hover:flex-none
                     hover:px-5 focus-visible:max-w-none focus-visible:flex-none
                     focus-visible:px-5 dark:text-dark-secondary`
              )}
              type='button'
              role='tab'
              aria-selected={active}
              aria-label={label}
              data-feed-tab={value}
              title={label}
              onClick={selectTab}
              key={value}
            >
              <span
                className={cn(
                  active
                    ? 'whitespace-nowrap'
                    : `max-w-full truncate group-hover/tab:max-w-none
                       group-hover/tab:overflow-visible group-hover/tab:text-clip
                       group-focus-visible/tab:max-w-none group-focus-visible/tab:overflow-visible
                       group-focus-visible/tab:text-clip`
                )}
              >
                {label}
              </span>
              {active && (
                <i className='absolute bottom-0 h-1 w-14 rounded-full bg-main-accent' />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function Home(): JSX.Element {
  const { isMobile } = useWindow();
  const { push } = useRouter();
  const { clearHomeBadge } = useLiveUpdates();
  const [activeTab, setActiveTab] = useState<HomeFeedTab>(
    FOR_YOU_HOME_FEED_TAB
  );
  const [feed, setFeed] = useState<TweetWithUser[]>([]);
  const [newTweets, setNewTweets] = useState<TweetWithUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [timelineSettingsOpen, setTimelineSettingsOpen] = useState(false);
  const feedRef = useRef<TweetWithUser[]>([]);
  const newTweetsRef = useRef<TweetWithUser[]>([]);
  const adoptedInitialTabRef = useRef(false);
  const { data: subscribedFeeds } = useSWR<SubscribedHomeFeed[], Error>(
    'home-subscribed-feeds',
    getSubscribedHomeFeeds,
    {
      dedupingInterval: HOME_FEED_REFRESH_INTERVAL_MS,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false
    }
  );
  const homeFeedTabs = useMemo(
    () => getHomeFeedTabs(subscribedFeeds ?? []),
    [subscribedFeeds]
  );

  const { data, error } = useSWR<HomeFeedPage, Error>(
    ['home-feed', activeTab],
    () => getHomeFeedPage(activeTab),
    {
      dedupingInterval: HOME_FEED_REFRESH_INTERVAL_MS,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false
    }
  );

  useEffect(() => {
    if (!adoptedInitialTabRef.current && subscribedFeeds) {
      adoptedInitialTabRef.current = true;
      setActiveTab(homeFeedTabs[0]?.value ?? FOR_YOU_HOME_FEED_TAB);
      return;
    }

    if (!homeFeedTabs.some(({ value }) => value === activeTab))
      setActiveTab(homeFeedTabs[0]?.value ?? FOR_YOU_HOME_FEED_TAB);
  }, [activeTab, homeFeedTabs, subscribedFeeds]);

  useEffect(() => {
    setFeed([]);
    setNewTweets([]);
    setCursor(null);
    setLoadingMore(false);
  }, [activeTab]);

  useEffect(() => {
    feedRef.current = feed;
  }, [feed]);

  useEffect(() => {
    newTweetsRef.current = newTweets;
  }, [newTweets]);

  useEffect(() => {
    if (!data) return;

    setFeed(data.tweets);
    setNewTweets([]);
    setCursor(data.cursor);
    if (activeTab === 'following') clearHomeBadge(data.tweets[0]?.id ?? null);
  }, [activeTab, clearHomeBadge, data]);

  useEffect(() => {
    if (!data) return;

    let canceled = false;
    let refreshInFlight = false;
    let lastRefreshAt = Date.now();

    const refreshHomeFeed = async (
      mode: HomeFeedRefreshMode = 'banner',
      options?: { force?: boolean }
    ): Promise<void> => {
      if (!options?.force && document.visibilityState === 'hidden') return;

      const now = Date.now();
      if (refreshInFlight) return;
      if (
        !options?.force &&
        now - lastRefreshAt < HOME_FEED_REFRESH_INTERVAL_MS
      )
        return;

      refreshInFlight = true;
      lastRefreshAt = now;

      try {
        const nextPage = await getHomeFeedPage(activeTab);

        if (canceled) return;

        if (mode === 'replace') {
          setFeed(nextPage.tweets);
          setNewTweets([]);
          setCursor(nextPage.cursor);
          if (activeTab === 'following')
            clearHomeBadge(nextPage.tweets[0]?.id ?? null);
          return;
        }

        const currentFeed = feedRef.current;

        if (!currentFeed.length) {
          setFeed(nextPage.tweets);
          setCursor(nextPage.cursor);
          if (activeTab === 'following')
            clearHomeBadge(nextPage.tweets[0]?.id ?? null);
          return;
        }

        const freshTweets = getNewTweetsBeforeCurrentTop(
          nextPage.tweets,
          currentFeed,
          newTweetsRef.current
        );

        if (freshTweets.length)
          setNewTweets((currentNewTweets) =>
            prependTweets(currentNewTweets, freshTweets)
          );
      } catch {
        // Home can keep its current timeline if a background refresh fails.
      } finally {
        refreshInFlight = false;
      }
    };

    const refreshSoon = (): void => {
      void refreshHomeFeed();
    };
    const refreshImmediately = (): void => {
      void refreshHomeFeed('replace', { force: true });
    };

    const intervalId = window.setInterval(
      refreshSoon,
      HOME_FEED_REFRESH_INTERVAL_MS
    );
    const unsubscribe = subscribeBackend(refreshImmediately, ['content']);

    window.addEventListener('focus', refreshSoon);

    return () => {
      canceled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshSoon);
      unsubscribe();
    };
  }, [activeTab, clearHomeBadge, data]);

  const handleLoadMore = async (): Promise<void> => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);

    try {
      const nextPage = await getHomeFeedPage(activeTab, cursor);

      setCursor(nextPage.cursor);
      setFeed((currentFeed) => mergeTweets(currentFeed, nextPage.tweets));
    } catch {
      // Keep the current timeline if a generator page fails while paginating.
    } finally {
      setLoadingMore(false);
    }
  };

  const loading = !data && !error;
  const loadMoreInView = (): void => {
    void handleLoadMore();
  };

  const toggleTimelineSettings = (): void =>
    setTimelineSettingsOpen((open) => !open);

  const openFeedsBrowser = (): void => {
    setTimelineSettingsOpen(false);
    void push('/feeds');
  };

  const openContentPreferences = (): void => {
    setTimelineSettingsOpen(false);
    void push({
      pathname: '/settings',
      query: { section: 'content' }
    });
  };

  const showNewTweets = (): void => {
    const pendingTweets = newTweetsRef.current;

    if (!pendingTweets.length) return;

    setFeed((currentFeed) => {
      const nextFeed = prependTweets(currentFeed, pendingTweets);
      if (activeTab === 'following') clearHomeBadge(nextFeed[0]?.id ?? null);
      return nextFeed;
    });
    setNewTweets([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTweetSent = useCallback(
    (tweet: TweetWithUser): void => {
      if (tweet.parent) return;

      setNewTweets((currentNewTweets) =>
        currentNewTweets.filter(({ id }) => id !== tweet.id)
      );
      setFeed((currentFeed) => {
        const nextFeed = prependTweets(currentFeed, [tweet]);
        if (activeTab === 'following') clearHomeBadge(nextFeed[0]?.id ?? null);
        return nextFeed;
      });
    },
    [activeTab, clearHomeBadge]
  );

  return (
    <MainContainer
      className='relative before:pointer-events-none before:absolute before:inset-y-0 before:right-0
                 before:z-30 before:hidden before:w-px before:bg-light-border before:content-[""]
                 dark:before:bg-dark-border xs:before:block'
    >
      <SEO title='Home / Not Twitter' />
      <UpdateUsername />
      <header className='hover-animation sticky top-0 z-20 bg-main-background/80 backdrop-blur-md'>
        <div className='flex h-[53px] items-center justify-between px-4'>
          <div className='flex min-w-0 items-center gap-8'>
            <MobileSidebar />
            <h2 className='truncate text-xl font-bold'>Home</h2>
          </div>
          <div className='relative flex items-center gap-1'>
            <Button
              className='dark-bg-tab group relative p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                         dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
              aria-label='Top Tweets'
              onClick={toggleTimelineSettings}
            >
              <HeroIcon className='h-5 w-5' iconName='SparklesIcon' />
              <ToolTip tip='Top Tweets' />
            </Button>
            <AnimatePresence>
              {timelineSettingsOpen && (
                <motion.div
                  className='menu-container absolute right-0 top-11 z-20 w-[320px] overflow-hidden py-2'
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                >
                  <div className='px-4 py-3'>
                    <p className='text-xl font-extrabold'>
                      Home shows you top Tweets first
                    </p>
                    <p className='mt-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
                      Tweets you&apos;re likely to care about most will show up
                      first in your timeline.
                    </p>
                  </div>
                  <Button
                    className='accent-tab flex w-full items-center gap-3 rounded-none px-4 py-3
                               text-left hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
                    onClick={openFeedsBrowser}
                  >
                    <HeroIcon className='h-6 w-6' iconName='ListBulletIcon' />
                    <div>
                      <p className='font-bold'>Manage feeds</p>
                      <p className='text-sm text-light-secondary dark:text-dark-secondary'>
                        Browse, add, and reorder Home timelines.
                      </p>
                    </div>
                  </Button>
                  <Button
                    className='accent-tab flex w-full items-center gap-3 rounded-none px-4 py-3
                               text-left hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
                    onClick={openContentPreferences}
                  >
                    <HeroIcon className='h-6 w-6' iconName='Cog6ToothIcon' />
                    <div>
                      <p className='font-bold'>View content preferences</p>
                      <p className='text-sm text-light-secondary dark:text-dark-secondary'>
                        Manage labels, interests, and feed filters.
                      </p>
                    </div>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <HomeTabs
          activeTab={activeTab}
          homeFeedTabs={homeFeedTabs}
          setActiveTab={setActiveTab}
        />
        <AnimatePresence>
          {newTweets.length > 0 && (
            <motion.div
              className='border-b border-light-border bg-main-background/95 backdrop-blur-md
                         dark:border-dark-border'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <Button
                className='hover-card flex h-12 w-full items-center justify-center rounded-none
                           text-[15px] text-main-accent'
                onClick={showNewTweets}
              >
                Show {newTweets.length} Tweet
                {newTweets.length === 1 ? '' : 's'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      {!isMobile && <Input onTweetSent={handleTweetSent} />}
      <section className='mt-0.5 xs:mt-0'>
        {loading ? (
          <Loading className='mt-5' />
        ) : error ? (
          <Error message={error.message || 'Something went wrong'} />
        ) : !feed.length ? (
          <p className='border-b border-light-border px-4 py-8 text-center text-light-secondary dark:border-dark-border dark:text-dark-secondary'>
            No posts found in this timeline.
          </p>
        ) : (
          <>
            <AnimatePresence>
              {feed.map((tweet) => (
                <Tweet
                  {...tweet}
                  onTweetSent={handleTweetSent}
                  key={tweet.id}
                />
              ))}
            </AnimatePresence>
            {cursor && (
              <motion.div
                className='border-b border-light-border dark:border-dark-border'
                viewport={{ margin: '0px 0px 1000px' }}
                onViewportEnter={loadMoreInView}
              >
                <Loading className='mt-5' />
              </motion.div>
            )}
          </>
        )}
      </section>
    </MainContainer>
  );
}

Home.getLayout = (page: ReactElement<any>): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <HomeLayout>{page}</HomeLayout>
    </MainLayout>
  </ProtectedLayout>
);
