import { useEffect, useState, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import useSWR from 'swr';
import { useSearchTweets, useSearchUsers } from '@lib/api/search';
import { getDiscoverHomeFeedPage } from '@lib/atproto/backend';
import {
  TrendsLayout,
  ProtectedLayout
} from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { AsideTrends, variants } from '@components/aside/aside-trends';
import { SearchBar } from '@components/aside/search-bar';
import { MobileSidebar } from '@components/sidebar/mobile-sidebar';
import { Tweet } from '@components/tweet/tweet';
import { UserCard } from '@components/user/user-card';
import { Error } from '@components/ui/error';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { ToolTip } from '@components/ui/tooltip';
import type {
  HomeFeedPage,
  SearchPeopleFilter,
  SearchPostFilter
} from '@lib/atproto/backend';
import type { TweetWithUser } from '@lib/types/tweet';
import type { ReactElement, ReactNode } from 'react';
import type { ParsedUrlQuery } from 'querystring';

type SearchTab = 'top' | 'live' | 'user' | 'image' | 'video';

type SearchTabData = {
  label: string;
  value: SearchTab;
};

const searchTabs: Readonly<SearchTabData[]> = [
  { label: 'Top', value: 'top' },
  { label: 'Latest', value: 'live' },
  { label: 'People', value: 'user' },
  { label: 'Photos', value: 'image' },
  { label: 'Videos', value: 'video' }
];
const DISCOVER_REFRESH_INTERVAL_MS = 60000;

function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function getSearchTab(value: string | string[] | undefined): SearchTab {
  const tab = getRouteParam(value);
  return searchTabs.some(({ value }) => value === tab)
    ? (tab as SearchTab)
    : 'top';
}

function getPeopleFilter(query: ParsedUrlQuery): SearchPeopleFilter {
  return query.pf === 'on' ? 'followed' : 'anyone';
}

function getPostFilter(tab: SearchTab): SearchPostFilter {
  if (tab === 'live') return 'latest';
  if (tab === 'image') return 'photos';
  if (tab === 'video') return 'videos';
  return 'top';
}

function cleanQuery(
  query: Record<string, string | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).filter(
      (entry): entry is [string, string] => !!entry[1]
    )
  );
}

function getTabQuery(
  searchQuery: string,
  tab: SearchTab,
  query: ParsedUrlQuery
): Record<string, string> {
  return cleanQuery({
    q: searchQuery,
    src: getRouteParam(query.src) || 'typed_query',
    f: tab === 'top' ? undefined : tab,
    pf: query.pf === 'on' ? 'on' : undefined,
    lf: query.lf === 'on' ? 'on' : undefined
  });
}

function ExploreSearchHeader(): JSX.Element {
  return (
    <header
      className='hover-animation sticky top-0 z-20 flex items-center gap-2 bg-main-background/90
                 px-4 py-1.5 backdrop-blur-md'
    >
      <MobileSidebar />
      <SearchBar className='min-w-0 flex-1 bg-transparent p-0' sticky={false} />
      <Link
        href='/interests'
        className='custom-button main-tab group relative p-2 hover:bg-light-primary/10
                   active:bg-light-primary/20 dark:hover:bg-dark-primary/10
                   dark:active:bg-dark-primary/20'
        aria-label='Interests'
      >
        <HeroIcon className='h-5 w-5' iconName='Cog8ToothIcon' />
        <ToolTip tip='Interests' />
      </Link>
    </header>
  );
}

function SearchTabs({
  activeTab,
  searchQuery,
  query
}: {
  activeTab: SearchTab;
  searchQuery: string;
  query: ParsedUrlQuery;
}): JSX.Element {
  return (
    <nav className='flex border-b border-light-border dark:border-dark-border'>
      {searchTabs.map(({ label, value }) => {
        const active = activeTab === value;

        return (
          <Link
            href={{
              pathname: '/explore',
              query: getTabQuery(searchQuery, value, query)
            }}
            shallow
            key={value}
            className={cn(
              `accent-tab hover-card relative flex h-[53px] flex-1 items-center justify-center
               text-[15px] font-bold outline-none`,
              active
                ? 'text-light-primary dark:text-dark-primary'
                : 'text-light-secondary dark:text-dark-secondary'
            )}
          >
            <span>{label}</span>
            {active && (
              <i className='absolute bottom-0 h-1 w-14 rounded-full bg-main-accent' />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SearchEmptyState({
  searchQuery
}: {
  searchQuery: string;
}): JSX.Element {
  return (
    <div className='mx-auto flex max-w-sm flex-col px-8 py-10'>
      <h2 className='text-[31px] font-extrabold leading-9'>
        No results for &quot;{searchQuery}&quot;
      </h2>
      <p className='mt-2 text-[15px] text-light-secondary dark:text-dark-secondary'>
        The term you entered did not bring up any results.
      </p>
    </div>
  );
}

function mergeDiscoverTweets(
  currentFeed: TweetWithUser[],
  nextFeed: TweetWithUser[]
): TweetWithUser[] {
  const seenIds = new Set(currentFeed.map(({ id }) => id));

  return [...currentFeed, ...nextFeed.filter(({ id }) => !seenIds.has(id))];
}

function DiscoverTabs(): JSX.Element {
  return (
    <nav
      className='flex h-[53px] border-b border-light-border dark:border-dark-border'
      aria-label='Explore feeds'
    >
      <Link
        href='/explore'
        shallow
        className='accent-tab hover-card relative flex flex-1 items-center justify-center
                   text-[15px] font-bold text-light-primary outline-none dark:text-dark-primary'
        aria-current='page'
      >
        Discover
        <i className='absolute bottom-0 h-1 w-14 rounded-full bg-main-accent' />
      </Link>
      <Link
        href='/feeds'
        className='accent-tab hover-card flex flex-1 items-center justify-center gap-1.5
                   text-[15px] font-bold text-light-secondary outline-none dark:text-dark-secondary'
      >
        <span>Feeds</span>
        <HeroIcon
          className='h-4 w-4 text-main-accent'
          iconName='SparklesIcon'
        />
      </Link>
    </nav>
  );
}

function DiscoverFeed(): JSX.Element {
  const [feed, setFeed] = useState<TweetWithUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { data, error } = useSWR<HomeFeedPage, Error>(
    'explore-discover-feed',
    () => getDiscoverHomeFeedPage(),
    {
      dedupingInterval: DISCOVER_REFRESH_INTERVAL_MS,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false
    }
  );

  useEffect(() => {
    if (!data) return;

    setFeed(data.tweets);
    setCursor(data.cursor);
  }, [data]);

  const handleLoadMore = async (): Promise<void> => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);

    try {
      const nextPage = await getDiscoverHomeFeedPage(cursor);

      setCursor(nextPage.cursor);
      setFeed((currentFeed) =>
        mergeDiscoverTweets(currentFeed, nextPage.tweets)
      );
    } finally {
      setLoadingMore(false);
    }
  };

  if (!data && !error) return <Loading className='mt-5' />;

  if (error) return <Error message={error.message || 'Something went wrong'} />;

  if (!feed.length)
    return (
      <p
        className='border-b border-light-border px-4 py-8 text-center text-light-secondary
                    dark:border-dark-border dark:text-dark-secondary'
      >
        No posts found in Discover.
      </p>
    );

  return (
    <section className='mt-0.5 xs:mt-0'>
      <AnimatePresence>
        {feed.map((tweet) => (
          <Tweet {...tweet} key={tweet.id} />
        ))}
      </AnimatePresence>
      {cursor && (
        <motion.div
          className='border-b border-light-border dark:border-dark-border'
          viewport={{ margin: '0px 0px 1000px' }}
          onViewportEnter={(): void => {
            void handleLoadMore();
          }}
        >
          <Loading className='mt-5' />
        </motion.div>
      )}
    </section>
  );
}

function SearchResults({
  activeTab,
  searchQuery,
  query
}: {
  activeTab: SearchTab;
  searchQuery: string;
  query: ParsedUrlQuery;
}): JSX.Element {
  const people = getPeopleFilter(query);
  const showUsers = activeTab === 'top' || activeTab === 'user';
  const showTweets = activeTab !== 'user';
  const {
    data: tweetsData,
    loading: tweetsLoading,
    error: tweetsError
  } = useSearchTweets(
    searchQuery,
    {
      filter: getPostFilter(activeTab),
      people,
      disabled: !showTweets
    },
    { revalidateOnFocus: false }
  );
  const {
    data: usersData,
    loading: usersLoading,
    error: usersError
  } = useSearchUsers(
    searchQuery,
    {
      people,
      disabled: !showUsers
    },
    { revalidateOnFocus: false }
  );
  const loading = (showTweets && tweetsLoading) || (showUsers && usersLoading);
  const error = tweetsError ?? usersError;
  const tweets = tweetsData?.tweets ?? [];
  const users = usersData?.users ?? [];
  const hasUsers = users.length > 0;
  const hasTweets = tweets.length > 0;

  if (loading) return <Loading className='mt-5' />;

  if (error) return <Error message='Something went wrong while searching.' />;

  if (activeTab === 'user')
    return hasUsers ? (
      <motion.div className='mt-0.5' {...variants}>
        {users.map((user) => (
          <UserCard {...user} key={user.id} follow />
        ))}
      </motion.div>
    ) : (
      <SearchEmptyState searchQuery={searchQuery} />
    );

  if (!hasUsers && !hasTweets)
    return <SearchEmptyState searchQuery={searchQuery} />;

  return (
    <section className='mt-0.5'>
      {activeTab === 'top' && hasUsers && (
        <motion.div
          className='border-b border-light-border dark:border-dark-border'
          {...variants}
        >
          <div className='px-4 py-3 text-xl font-extrabold'>People</div>
          {users.slice(0, 3).map((user) => (
            <UserCard {...user} key={user.id} follow />
          ))}
          <Link
            href={{
              pathname: '/explore',
              query: getTabQuery(searchQuery, 'user', query)
            }}
            shallow
            className='accent-tab hover-card block px-4 py-3 text-main-accent'
          >
            View all
          </Link>
        </motion.div>
      )}
      {hasTweets ? (
        <AnimatePresence>
          {tweets.map((tweet) => (
            <Tweet {...tweet} key={tweet.id} />
          ))}
        </AnimatePresence>
      ) : (
        <SearchEmptyState searchQuery={searchQuery} />
      )}
    </section>
  );
}

export default function Explore(): JSX.Element {
  const { query } = useRouter();
  const searchQuery = getRouteParam(query.q).trim();
  const activeTab = getSearchTab(query.f);
  const searching = !!searchQuery;

  return (
    <MainContainer>
      <SEO
        title={
          searching
            ? `${searchQuery} - Not Twitter Search / Not Twitter`
            : 'Explore / Not Twitter'
        }
      />
      <ExploreSearchHeader />
      {searching ? (
        <>
          <SearchTabs
            activeTab={activeTab}
            searchQuery={searchQuery}
            query={query}
          />
          <SearchResults
            activeTab={activeTab}
            searchQuery={searchQuery}
            query={query}
          />
        </>
      ) : (
        <>
          <div className='border-y border-light-border px-4 py-3 dark:border-dark-border'>
            <h1 className='text-xl font-extrabold'>What&apos;s happening</h1>
          </div>
          <AsideTrends inTrendsPage />
        </>
      )}
    </MainContainer>
  );
}

Explore.getLayout = (page: ReactElement<any>): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <TrendsLayout>{page}</TrendsLayout>
    </MainLayout>
  </ProtectedLayout>
);
