import { useEffect, useMemo, useState, type JSX } from 'react';
import Link from 'next/link';
import cn from 'clsx';
import useSWR from 'swr';
import { toast } from 'react-hot-toast';
import {
  DISCOVER_HOME_FEED_HREF,
  addSavedHomeFeed,
  getFeedBrowserFeeds,
  removeSavedHomeFeed,
  reorderSavedHomeFeeds,
  searchFeedGenerators,
  type FeedBrowserFeed,
  type FeedSearchPage
} from '@lib/atproto/backend';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useTheme } from '@lib/context/theme-context';
import { formatNumber } from '@lib/date';
import { useRouteBack } from '@lib/hooks/useRouteBack';
import { HomeLayout, ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { MobileSidebar } from '@components/sidebar/mobile-sidebar';
import { Button } from '@components/ui/button';
import { Error as ErrorMessage } from '@components/ui/error';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon, type IconName } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { NextImage } from '@components/ui/next-image';
import { ToolTip } from '@components/ui/tooltip';
import type { ChangeEvent, DragEvent, ReactElement, ReactNode } from 'react';

type FixedFeed = {
  id: string;
  title: string;
  description: string;
  href: string;
  iconName: IconName;
  feed?: FeedBrowserFeed;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function getFeedMeta(
  feed: FeedBrowserFeed,
  hideBskySocialSuffix: boolean
): string {
  return [
    formatAtprotoDisplayIdentifier(feed.creatorUsername, {
      hideBskySocialSuffix
    }),
    `${formatNumber(feed.likeCount)} ${feed.likeCount === 1 ? 'like' : 'likes'}`
  ].join(' - ');
}

function isOfficialForYouFeed(feed: FeedBrowserFeed): boolean {
  return feed.href === DISCOVER_HOME_FEED_HREF;
}

function mergeFeeds(
  currentFeeds: FeedBrowserFeed[],
  nextFeeds: FeedBrowserFeed[]
): FeedBrowserFeed[] {
  const seenUris = new Set(currentFeeds.map(({ uri }) => uri));
  const newFeeds = nextFeeds.filter(({ uri }) => !seenUris.has(uri));

  return [...currentFeeds, ...newFeeds];
}

function getFeedOrderKey(feeds: FeedBrowserFeed[]): string {
  return feeds.map(({ id }) => id).join('\u0000');
}

function reorderFeeds(
  feeds: FeedBrowserFeed[],
  fromIndex: number,
  toIndex: number
): FeedBrowserFeed[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= feeds.length ||
    toIndex >= feeds.length
  )
    return feeds;

  const nextFeeds = [...feeds];
  const [feed] = nextFeeds.splice(fromIndex, 1);
  nextFeeds.splice(toIndex, 0, feed);

  return nextFeeds;
}

function FeedAvatar({
  avatar,
  name,
  iconName = 'RssIcon'
}: {
  avatar?: string | null;
  name: string;
  iconName?: IconName;
}): JSX.Element {
  if (avatar)
    return (
      <NextImage
        className='h-12 w-12 shrink-0 overflow-hidden rounded-md'
        imgClassName='rounded-md'
        src={avatar}
        alt={name}
        width={48}
        height={48}
        useSkeleton
      />
    );

  return (
    <span
      className='flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-main-accent/10 text-main-accent'
      aria-hidden='true'
    >
      <HeroIcon className='h-6 w-6' iconName={iconName} />
    </span>
  );
}

function StatusPill({
  children,
  accent
}: {
  children: ReactNode;
  accent?: boolean;
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-sm font-bold',
        accent
          ? 'border-main-accent text-main-accent'
          : 'border-light-line-reply text-light-secondary dark:border-dark-line-reply dark:text-dark-secondary'
      )}
    >
      {children}
    </span>
  );
}

function FixedFeedRow({ feed }: { feed: FixedFeed }): JSX.Element {
  return (
    <Link
      href={feed.href}
      className='accent-tab hover-card flex min-h-[72px] items-center gap-3 border-b border-light-border px-4 py-3 outline-none dark:border-dark-border'
    >
      <FeedAvatar
        avatar={feed.feed?.avatar}
        name={feed.title}
        iconName={feed.iconName}
      />
      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 items-center gap-2'>
          <p className='truncate text-[15px] font-bold'>{feed.title}</p>
          <StatusPill>Fixed</StatusPill>
        </div>
        <p className='mt-0.5 truncate text-sm text-light-secondary dark:text-dark-secondary'>
          {feed.description}
        </p>
      </div>
      <HeroIcon
        className='h-5 w-5 shrink-0 text-light-secondary dark:text-dark-secondary'
        iconName='ChevronRightIcon'
      />
    </Link>
  );
}

function SavedFeedRow({
  feed,
  first,
  last,
  saving,
  removing,
  dragging,
  onMove,
  onRemove,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDrop,
  onDragEnd
}: {
  feed: FeedBrowserFeed;
  first: boolean;
  last: boolean;
  saving: boolean;
  removing: boolean;
  dragging: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();

  return (
    <div
      className={cn(
        'hover-card flex min-h-[76px] cursor-grab items-center gap-3 border-b border-light-border px-4 py-3 active:cursor-grabbing dark:border-dark-border',
        dragging && 'bg-main-accent/5 opacity-60 dark:bg-main-accent/10'
      )}
      draggable={!saving && !removing}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <FeedAvatar avatar={feed.avatar} name={feed.displayName} />
      <div className='min-w-0 flex-1'>
        <Link
          href={feed.href}
          className='accent-tab block truncate text-[15px] font-bold outline-none hover:underline'
        >
          {feed.displayName}
        </Link>
        <p className='mt-0.5 truncate text-sm text-light-secondary dark:text-dark-secondary'>
          {getFeedMeta(feed, hideBskySocialSuffix)}
        </p>
        {feed.description && (
          <p className='mt-1 max-h-10 overflow-hidden text-[15px] leading-5'>
            {feed.description}
          </p>
        )}
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        <Button
          className='dark-bg-tab group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full !p-0 hover:bg-light-primary/10 disabled:cursor-default disabled:opacity-40 dark:hover:bg-dark-primary/10'
          aria-label={`Move ${feed.displayName} up`}
          disabled={first || saving || removing}
          onClick={(): void => onMove(-1)}
        >
          <HeroIcon className='h-5 w-5' iconName='ArrowUpIcon' />
          <ToolTip tip='Move up' />
        </Button>
        <Button
          className='dark-bg-tab group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full !p-0 hover:bg-light-primary/10 disabled:cursor-default disabled:opacity-40 dark:hover:bg-dark-primary/10'
          aria-label={`Move ${feed.displayName} down`}
          disabled={last || saving || removing}
          onClick={(): void => onMove(1)}
        >
          <HeroIcon className='h-5 w-5' iconName='ArrowDownIcon' />
          <ToolTip tip='Move down' />
        </Button>
        <Button
          className='dark-bg-tab group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full !p-0 text-accent-red hover:bg-accent-red/10 disabled:cursor-wait disabled:opacity-60'
          aria-label={`Remove ${feed.displayName}`}
          loading={removing}
          disabled={saving}
          onClick={onRemove}
        >
          <HeroIcon className='h-5 w-5' iconName='TrashIcon' />
          <ToolTip tip='Remove' />
        </Button>
      </div>
    </div>
  );
}

function FeedOrderSaveBar({
  saving,
  onSave,
  onReset
}: {
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}): JSX.Element {
  return (
    <div className='pointer-events-none sticky bottom-4 z-20 -mt-2 mb-3 flex justify-end px-4'>
      <div
        className='pointer-events-auto flex items-center gap-2 rounded-full border border-light-border
                   bg-main-background/95 p-2 shadow-lg backdrop-blur-md dark:border-dark-border'
      >
        <Button
          className='accent-tab inline-flex h-9 items-center justify-center rounded-full px-4 py-0 text-sm font-bold'
          disabled={saving}
          onClick={onReset}
        >
          Reset
        </Button>
        <Button
          className='accent-tab inline-flex h-9 items-center justify-center rounded-full bg-main-accent px-4 py-0 text-sm font-bold text-white hover:bg-main-accent/90'
          loading={saving}
          onClick={onSave}
        >
          Save order
        </Button>
      </div>
    </div>
  );
}

function SearchFeedRow({
  feed,
  saving,
  onAdd
}: {
  feed: FeedBrowserFeed;
  saving: boolean;
  onAdd: () => void;
}): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();

  return (
    <div className='hover-card flex min-h-[76px] items-center gap-3 border-b border-light-border px-4 py-3 dark:border-dark-border'>
      <FeedAvatar avatar={feed.avatar} name={feed.displayName} />
      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 items-center gap-2'>
          <Link
            href={feed.href}
            className='accent-tab block truncate text-[15px] font-bold outline-none hover:underline'
          >
            {feed.displayName}
          </Link>
          {feed.saved && <StatusPill accent>Added</StatusPill>}
        </div>
        <p className='mt-0.5 truncate text-sm text-light-secondary dark:text-dark-secondary'>
          {getFeedMeta(feed, hideBskySocialSuffix)}
        </p>
        {feed.description && (
          <p className='mt-1 max-h-10 overflow-hidden text-[15px] leading-5'>
            {feed.description}
          </p>
        )}
      </div>
      <Button
        className={cn(
          'accent-tab inline-flex h-9 shrink-0 items-center justify-center rounded-full px-4 py-0 text-center text-sm font-bold',
          feed.saved
            ? 'border border-light-border text-light-secondary dark:border-dark-border dark:text-dark-secondary'
            : 'bg-main-accent text-white hover:bg-main-accent/90'
        )}
        loading={saving}
        disabled={feed.saved}
        onClick={onAdd}
      >
        {feed.saved ? 'Added' : 'Add'}
      </Button>
    </div>
  );
}

export default function Feeds(): JSX.Element {
  const routeBack = useRouteBack();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orderedFeeds, setOrderedFeeds] = useState<FeedBrowserFeed[]>([]);
  const [searchFeeds, setSearchFeeds] = useState<FeedBrowserFeed[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [removingFeedId, setRemovingFeedId] = useState<string | null>(null);
  const [addingFeedUri, setAddingFeedUri] = useState<string | null>(null);
  const [loadingMoreSearch, setLoadingMoreSearch] = useState(false);
  const [draggedFeedId, setDraggedFeedId] = useState<string | null>(null);
  const {
    data: savedFeeds,
    error: savedError,
    mutate: mutateSavedFeeds
  } = useSWR<FeedBrowserFeed[], Error>(
    'feed-browser-feeds',
    getFeedBrowserFeeds,
    { revalidateOnFocus: false }
  );
  const {
    data: searchPage,
    error: searchError,
    mutate: mutateSearchFeeds
  } = useSWR<FeedSearchPage, Error>(
    ['feed-generator-search', debouncedSearch],
    () => searchFeedGenerators(debouncedSearch),
    { revalidateOnFocus: false }
  );
  const editableFeeds = useMemo(
    () => (savedFeeds ?? []).filter(({ editable }) => editable),
    [savedFeeds]
  );
  const forYouFeed = savedFeeds?.find(isOfficialForYouFeed);
  const fixedFeeds: FixedFeed[] = [
    {
      id: 'for-you',
      title: 'For you',
      description: 'Top posts selected from Bluesky Discover.',
      href: DISCOVER_HOME_FEED_HREF,
      iconName: 'SparklesIcon',
      feed: forYouFeed
    },
    {
      id: 'following',
      title: 'Following',
      description: 'Posts from people you follow.',
      href: '/home',
      iconName: 'UserGroupIcon'
    }
  ];
  const savedLoading = !savedFeeds && !savedError;
  const searchLoading = !searchPage && !searchError;
  const savedOrderKey = useMemo(
    () => getFeedOrderKey(editableFeeds),
    [editableFeeds]
  );
  const orderedOrderKey = useMemo(
    () => getFeedOrderKey(orderedFeeds),
    [orderedFeeds]
  );
  const hasOrderChanges =
    orderedFeeds.length > 0 && orderedOrderKey !== savedOrderKey;

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(searchInput.trim()),
      220
    );

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setOrderedFeeds(editableFeeds);
  }, [editableFeeds]);

  useEffect(() => {
    if (!searchPage) return;

    setSearchFeeds(searchPage.feeds);
    setSearchCursor(searchPage.cursor);
  }, [searchPage]);

  const handleSearchChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => setSearchInput(value);

  const saveFeedOrder = async (): Promise<void> => {
    if (!hasOrderChanges || savingOrder) return;

    setSavingOrder(true);

    try {
      const nextFeeds = await reorderSavedHomeFeeds(
        orderedFeeds.map(({ id }) => id)
      );

      await mutateSavedFeeds(nextFeeds, false);
      toast.success('Feed order saved');
    } catch (error) {
      toast.error(getErrorMessage(error));
      await mutateSavedFeeds();
    } finally {
      setSavingOrder(false);
    }
  };

  const moveFeed = (index: number, direction: -1 | 1): void => {
    const nextIndex = index + direction;
    setOrderedFeeds((feeds) => reorderFeeds(feeds, index, nextIndex));
  };

  const resetFeedOrder = (): void => setOrderedFeeds(editableFeeds);

  const clearFeedDrag = (): void => setDraggedFeedId(null);

  const handleFeedDragStart =
    (feedId: string) =>
    (event: DragEvent<HTMLDivElement>): void => {
      if (savingOrder || removingFeedId) {
        event.preventDefault();
        return;
      }

      setDraggedFeedId(feedId);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', feedId);
    };

  const handleFeedDragEnter =
    (feedId: string) =>
    (event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      const activeFeedId =
        draggedFeedId ?? event.dataTransfer.getData('text/plain');

      if (!activeFeedId || activeFeedId === feedId) return;

      setOrderedFeeds((feeds) => {
        const fromIndex = feeds.findIndex(({ id }) => id === activeFeedId);
        const toIndex = feeds.findIndex(({ id }) => id === feedId);

        return reorderFeeds(feeds, fromIndex, toIndex);
      });
    };

  const handleFeedDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleFeedDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    clearFeedDrag();
  };

  const removeFeed = (feed: FeedBrowserFeed): void => {
    setRemovingFeedId(feed.id);

    void removeSavedHomeFeed(feed.id)
      .then(async (nextFeeds) => {
        await mutateSavedFeeds(nextFeeds, false);
        await mutateSearchFeeds();
        toast.success('Feed removed');
      })
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => setRemovingFeedId(null));
  };

  const addFeed = (feed: FeedBrowserFeed): void => {
    setAddingFeedUri(feed.uri);

    void addSavedHomeFeed(feed.uri)
      .then(async (nextFeeds) => {
        await mutateSavedFeeds(nextFeeds, false);
        await mutateSearchFeeds();
        toast.success('Feed added');
      })
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => setAddingFeedUri(null));
  };

  const loadMoreSearch = async (): Promise<void> => {
    if (!searchCursor || loadingMoreSearch) return;

    setLoadingMoreSearch(true);

    try {
      const nextPage = await searchFeedGenerators(
        debouncedSearch,
        searchCursor
      );

      setSearchCursor(nextPage.cursor);
      setSearchFeeds((feeds) => mergeFeeds(feeds, nextPage.feeds));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingMoreSearch(false);
    }
  };

  return (
    <MainContainer>
      <SEO title='Feeds / Not Twitter' />
      <header className='hover-animation sticky top-0 z-20 bg-main-background/80 backdrop-blur-md'>
        <div className='flex h-[53px] items-center justify-between px-4'>
          <div className='flex min-w-0 items-center gap-4'>
            <Button
              className='dark-bg-tab group relative p-2 hover:bg-light-primary/10 active:bg-light-primary/20 dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
              aria-label='Back'
              onClick={routeBack}
            >
              <HeroIcon className='h-5 w-5' iconName='ArrowLeftIcon' />
              <ToolTip tip='Back' />
            </Button>
            <MobileSidebar />
            <h2 className='truncate text-xl font-bold'>Feeds</h2>
          </div>
          <Link
            href={{ pathname: '/settings', query: { section: 'content' } }}
            className='custom-button dark-bg-tab group relative p-2 hover:bg-light-primary/10 active:bg-light-primary/20 dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
            aria-label='Content preferences'
          >
            <HeroIcon className='h-5 w-5' iconName='Cog6ToothIcon' />
            <ToolTip tip='Content preferences' />
          </Link>
        </div>
      </header>
      <section className='border-b border-light-border px-4 py-5 dark:border-dark-border'>
        <div className='flex items-start gap-3'>
          <span
            className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-main-accent/10 text-main-accent'
            aria-hidden='true'
          >
            <CustomIcon className='h-7 w-7' iconName='TwitterListsIcon' />
          </span>
          <div className='min-w-0'>
            <h1 className='text-2xl font-extrabold'>My Feeds</h1>
            <p className='mt-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
              All the feeds you have saved, right in one place.
            </p>
          </div>
        </div>
      </section>
      {savedLoading ? (
        <Loading className='mt-5' />
      ) : savedError ? (
        <ErrorMessage message={getErrorMessage(savedError)} />
      ) : (
        <>
          <section>
            {fixedFeeds.map((feed) => (
              <FixedFeedRow feed={feed} key={feed.id} />
            ))}
            {orderedFeeds.length ? (
              orderedFeeds.map((feed, index) => (
                <SavedFeedRow
                  feed={feed}
                  first={index === 0}
                  last={index === orderedFeeds.length - 1}
                  saving={savingOrder}
                  removing={removingFeedId === feed.id}
                  dragging={draggedFeedId === feed.id}
                  onMove={(direction): void => moveFeed(index, direction)}
                  onRemove={(): void => removeFeed(feed)}
                  onDragStart={handleFeedDragStart(feed.id)}
                  onDragEnter={handleFeedDragEnter(feed.id)}
                  onDragOver={handleFeedDragOver}
                  onDrop={handleFeedDrop}
                  onDragEnd={clearFeedDrag}
                  key={feed.id}
                />
              ))
            ) : (
              <div className='border-b border-light-border px-4 py-8 dark:border-dark-border'>
                <p className='text-[15px] font-bold'>No saved feeds yet</p>
                <p className='mt-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
                  Community feeds can give Home a few more timelines.
                </p>
              </div>
            )}
            {hasOrderChanges && (
              <FeedOrderSaveBar
                saving={savingOrder}
                onSave={(): void => void saveFeedOrder()}
                onReset={resetFeedOrder}
              />
            )}
          </section>
          <section className='border-b border-light-border px-4 py-5 dark:border-dark-border'>
            <div className='flex items-start gap-3'>
              <span
                className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-main-accent/10 text-main-accent'
                aria-hidden='true'
              >
                <CustomIcon className='h-7 w-7' iconName='TwitterSearchIcon' />
              </span>
              <div className='min-w-0'>
                <h2 className='text-xl font-extrabold'>Discover New Feeds</h2>
                <p className='mt-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
                  Feeds built by the community help you find content you love.
                </p>
              </div>
            </div>
            <label className='mt-4 flex h-11 items-center gap-3 rounded-full bg-main-search-background px-4 focus-within:bg-main-background focus-within:ring-2 focus-within:ring-main-accent'>
              <HeroIcon
                className='h-5 w-5 text-light-secondary dark:text-dark-secondary'
                iconName='MagnifyingGlassIcon'
              />
              <input
                className='min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
                placeholder='Search feeds'
                value={searchInput}
                onChange={handleSearchChange}
              />
            </label>
          </section>
          <section>
            {searchLoading ? (
              <Loading className='mt-5' />
            ) : searchError ? (
              <ErrorMessage message={getErrorMessage(searchError)} />
            ) : searchFeeds.length ? (
              <>
                {searchFeeds.map((feed) => (
                  <SearchFeedRow
                    feed={feed}
                    saving={addingFeedUri === feed.uri}
                    onAdd={(): void => addFeed(feed)}
                    key={feed.uri}
                  />
                ))}
                {searchCursor && (
                  <div className='border-b border-light-border px-4 py-3 text-center dark:border-dark-border'>
                    <Button
                      className='accent-tab inline-flex h-10 items-center justify-center rounded-full border border-light-border px-5 py-0 text-center font-bold dark:border-dark-border'
                      loading={loadingMoreSearch}
                      onClick={(): void => void loadMoreSearch()}
                    >
                      Show more
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className='px-8 py-12 text-center'>
                <p className='text-xl font-extrabold'>No feeds found</p>
                <p className='mt-1 text-[15px] text-light-secondary dark:text-dark-secondary'>
                  Try another search.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </MainContainer>
  );
}

Feeds.getLayout = (page: ReactElement<any>): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <HomeLayout>{page}</HomeLayout>
    </MainLayout>
  </ProtectedLayout>
);
