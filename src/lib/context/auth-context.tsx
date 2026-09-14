import {
  useState,
  useEffect,
  useContext,
  createContext,
  useMemo,
  useCallback,
  useRef,
  type JSX
} from 'react';
import {
  DEFAULT_PROFILE_COVER_URL,
  DEFAULT_PROFILE_PHOTO_URL
} from '@lib/default-images';
import { getRandomId, getRandomInt } from '@lib/random';
import type * as AuthApi from '@lib/atproto/auth';
import type * as CollectionsApi from '@lib/atproto/collections';
import type * as StoreApi from '@lib/atproto/store';
import type { ReactNode } from 'react';
import type { User } from '@lib/types/user';
import type { Bookmark } from '@lib/types/bookmark';
import type { Stats } from '@lib/types/stats';

type Auth = AuthApi.Auth;
type AuthUser = AuthApi.User;
type BlueskyAccount = AuthApi.BlueskyAccount;
type WithFieldValue<T> = StoreApi.WithFieldValue<T>;

type AuthRuntime = {
  auth: Auth;
  api: typeof AuthApi;
};

type DataRuntime = {
  collections: typeof CollectionsApi;
  store: typeof StoreApi;
};

const auth: Auth = { backend: 'atproto' };
let authRuntimePromise: Promise<AuthRuntime> | null = null;
let dataRuntimePromise: Promise<DataRuntime> | null = null;

function loadAuthRuntime(): Promise<AuthRuntime> {
  authRuntimePromise ??= import('@lib/atproto/auth').then((api) => ({
    api,
    auth
  }));

  return authRuntimePromise;
}

function loadDataRuntime(): Promise<DataRuntime> {
  dataRuntimePromise ??= Promise.all([
    import('@lib/atproto/collections'),
    import('@lib/atproto/store')
  ]).then(([collections, store]) => ({ collections, store }));

  return dataRuntimePromise;
}

type AuthContext = {
  user: User | null;
  error: Error | null;
  loading: boolean;
  isAdmin: boolean;
  randomSeed: string;
  userBookmarks: Bookmark[] | null;
  accounts: BlueskyAccount[];
  signOut: () => Promise<void>;
  signInWithBluesky: (identifier: string) => Promise<void>;
  switchBlueskyAccount: (id: string) => Promise<void>;
  removeBlueskyAccount: (id: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContext | null>(null);

type AuthContextProviderProps = {
  children: ReactNode;
};

export function AuthContextProvider({
  children
}: AuthContextProviderProps): JSX.Element {
  const mounted = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [userBookmarks, setUserBookmarks] = useState<Bookmark[] | null>(null);
  const [accounts, setAccounts] = useState<BlueskyAccount[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const syncAccounts = useCallback((): void => {
    void loadAuthRuntime().then(({ api }) => {
      if (mounted.current) setAccounts(api.getSavedBlueskyAccounts(auth));
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let authGeneration = 0;
    let unsubscribeAuthState: (() => void) | undefined;
    let unsubscribeUserData: (() => void) | undefined;

    const manageUser = async (
      authUser: AuthUser,
      generation: number
    ): Promise<void> => {
      const { uid, displayName, photoURL } = authUser;
      const {
        collections: {
          userBookmarksCollection,
          usersCollection,
          userStatsCollection
        },
        store: { doc, getDoc, onSnapshot, serverTimestamp, setDoc }
      } = await loadDataRuntime();

      if (!active || generation !== authGeneration) return;

      const userSnapshot = await getDoc(doc(usersCollection, uid));

      if (!active || generation !== authGeneration) return;

      if (!userSnapshot.exists()) {
        let available = false;
        let randomUsername = '';

        while (!available) {
          const normalizeName = displayName?.replace(/\s/g, '').toLowerCase();
          const randomInt = getRandomInt(1, 10_000);

          randomUsername = `${normalizeName as string}${randomInt}`;

          const { checkUsernameAvailability } =
            await import('@lib/atproto/utils');
          const isUsernameAvailable =
            await checkUsernameAvailability(randomUsername);

          if (isUsernameAvailable) available = true;
        }

        const userData: WithFieldValue<User> = {
          id: uid,
          bio: null,
          pronouns: null,
          birthday: null,
          messageAllowIncoming: null,
          activityNotificationCategories: [],
          name: displayName as string,
          theme: null,
          accent: null,
          website: null,
          photoURL: photoURL ?? DEFAULT_PROFILE_PHOTO_URL,
          username: randomUsername,
          verified: false,
          following: [],
          followers: [],
          followingCount: 0,
          followersCount: 0,
          knownFollowers: [],
          knownFollowersCount: 0,
          muting: false,
          mutingByListName: null,
          blocking: false,
          blockedBy: false,
          blockingUri: null,
          blockingByListName: null,
          createdAt: serverTimestamp(),
          updatedAt: null,
          totalTweets: 0,
          totalPhotos: 0,
          pinnedTweet: null,
          coverPhotoURL: DEFAULT_PROFILE_COVER_URL
        };

        const userStatsData: WithFieldValue<Stats> = {
          likes: [],
          tweets: [],
          updatedAt: null
        };

        try {
          await Promise.all([
            setDoc(doc(usersCollection, uid), userData),
            setDoc(doc(userStatsCollection(uid), 'stats'), userStatsData)
          ]);

          const newUser = (await getDoc(doc(usersCollection, uid))).data();
          if (active && generation === authGeneration) setUser(newUser as User);
        } catch (error) {
          if (active && generation === authGeneration) setError(error as Error);
        }
      } else {
        const userData = userSnapshot.data();
        if (active && generation === authGeneration) setUser(userData);
      }

      if (!active || generation !== authGeneration) return;

      setLoading(false);
      syncAccounts();

      const unsubscribeUser = onSnapshot(doc(usersCollection, uid), (doc) => {
        setUser(doc.data() as User);
      });

      const unsubscribeBookmarks = onSnapshot(
        userBookmarksCollection(uid),
        (snapshot) => {
          const bookmarks = snapshot.docs.map((doc) => doc.data());
          setUserBookmarks(bookmarks);
        }
      );

      unsubscribeUserData = (): void => {
        unsubscribeUser();
        unsubscribeBookmarks();
      };
    };

    const handleUserAuth = (authUser: AuthUser | null): void => {
      const generation = ++authGeneration;

      setLoading(true);
      syncAccounts();
      unsubscribeUserData?.();
      unsubscribeUserData = undefined;

      if (authUser) {
        setUserBookmarks(null);
        void manageUser(authUser, generation);
      } else {
        setUser(null);
        setUserBookmarks(null);
        setLoading(false);
        syncAccounts();
      }
    };

    void loadAuthRuntime()
      .then(({ api }) => {
        if (!active) return;
        unsubscribeAuthState = api.onAuthStateChanged(auth, handleUserAuth);
      })
      .catch((error) => {
        if (!active) return;
        setError(error as Error);
        setLoading(false);
      });

    return () => {
      active = false;
      unsubscribeAuthState?.();
      unsubscribeUserData?.();
    };
  }, [syncAccounts]);

  const signInWithBluesky = useCallback(
    async (identifier: string) => {
      try {
        setError(null);
        const { api } = await loadAuthRuntime();
        await api.signInWithBluesky(auth, identifier);
        syncAccounts();
      } catch (error) {
        setError(error as Error);
        throw error;
      }
    },
    [syncAccounts]
  );

  const switchBlueskyAccount = useCallback(
    async (id: string) => {
      try {
        setError(null);
        const { api } = await loadAuthRuntime();
        await api.switchBlueskyAccount(auth, id);
        syncAccounts();
      } catch (error) {
        setError(error as Error);
        throw error;
      }
    },
    [syncAccounts]
  );

  const removeBlueskyAccount = useCallback(
    async (id: string) => {
      try {
        setError(null);
        const { api } = await loadAuthRuntime();
        await api.removeBlueskyAccount(auth, id);
        syncAccounts();
      } catch (error) {
        setError(error as Error);
        throw error;
      }
    },
    [syncAccounts]
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      const { api } = await loadAuthRuntime();
      await api.signOut(auth);
      syncAccounts();
    } catch (error) {
      setError(error as Error);
    }
  }, [syncAccounts]);

  const isAdmin = user ? user.username === 'ccrsxx' : false;
  const randomSeed = useMemo(getRandomId, [user?.id]);

  const value = useMemo<AuthContext>(
    () => ({
      user,
      error,
      loading,
      isAdmin,
      randomSeed,
      userBookmarks,
      accounts,
      signOut,
      signInWithBluesky,
      switchBlueskyAccount,
      removeBlueskyAccount
    }),
    [
      accounts,
      error,
      isAdmin,
      loading,
      randomSeed,
      removeBlueskyAccount,
      signInWithBluesky,
      signOut,
      switchBlueskyAccount,
      user,
      userBookmarks
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContext {
  const context = useContext(AuthContext);

  if (!context)
    throw new Error('useAuth must be used within an AuthContextProvider');

  return context;
}
