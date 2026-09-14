import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import { getFeedGeneratorPage } from '@lib/atproto/backend';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useTheme } from '@lib/context/theme-context';
import { useRouteBack } from '@lib/hooks/useRouteBack';
import { formatNumber } from '@lib/date';
import { getFeedRouteParams } from '@lib/static-routes';
import {
  TrendsLayout,
  ProtectedLayout
} from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainHeader } from '@components/home/main-header';
import { MainContainer } from '@components/home/main-container';
import { Tweet } from '@components/tweet/tweet';
import { TweetText } from '@components/tweet/tweet-text';
import { UserAvatar } from '@components/user/user-avatar';
import { Button } from '@components/ui/button';
import { Error as ErrorMessage } from '@components/ui/error';
import { Loading } from '@components/ui/loading';
import type { ReactElement, ReactNode } from 'react';
import type { FeedGeneratorPage } from '@lib/atproto/backend';
import type { TweetWithUser } from '@lib/types/tweet';

function getRouteParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;

  return null;
}

export default function FeedPage(): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const { asPath, isReady, query } = useRouter();
  const routeBack = useRouteBack();
  const staticParams = getFeedRouteParams(asPath);
  const actor = getRouteParam(query.actor) ?? staticParams?.actor ?? null;
  const rkey = getRouteParam(query.rkey) ?? staticParams?.rkey ?? null;
  const displayActor = formatAtprotoDisplayIdentifier(actor, {
    hideBskySocialSuffix
  });
  const [feed, setFeed] = useState<TweetWithUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const feedKey =
    (isReady || staticParams) && actor && rkey
      ? `feed-generator:${actor}:${rkey}`
      : null;

  const { data, error } = useSWR<FeedGeneratorPage, Error>(
    feedKey,
    () => getFeedGeneratorPage(actor as string, rkey as string),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!data) return;

    setFeed(data.feed);
    setCursor(data.cursor);
  }, [data]);

  const handleLoadMore = async (): Promise<void> => {
    if (!actor || !rkey || !cursor) return;

    setLoadingMore(true);

    try {
      const nextPage = await getFeedGeneratorPage(actor, rkey, cursor);

      setCursor(nextPage.cursor);
      setFeed((currentFeed) => {
        const seenIds = new Set(currentFeed.map(({ id }) => id));
        const newTweets = nextPage.feed.filter(({ id }) => !seenIds.has(id));

        return [...currentFeed, ...newTweets];
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const title = data?.displayName ?? 'Feed';

  return (
    <MainContainer>
      <SEO
        title={`${title} / Not Twitter`}
        description={data?.description ?? undefined}
      />
      <MainHeader useActionButton title={title} action={routeBack} />
      {!data && !error ? (
        <Loading className='mt-5' />
      ) : error ? (
        <ErrorMessage message='Sorry, this Bluesky feed could not be loaded.' />
      ) : (
        data && (
          <>
            <section className='border-b border-light-border px-4 py-3 dark:border-dark-border'>
              <div className='flex gap-3'>
                {data.avatar && (
                  <UserAvatar
                    className='shrink-0'
                    src={data.avatar}
                    alt={data.displayName}
                    size={48}
                  />
                )}
                <div className='min-w-0'>
                  <h1 className='break-words text-xl font-extrabold'>
                    {data.displayName}
                  </h1>
                  {actor && (
                    <p className='truncate text-light-secondary dark:text-dark-secondary'>
                      {displayActor}
                    </p>
                  )}
                </div>
              </div>
              {data.description && (
                <TweetText className='mt-3' text={data.description} />
              )}
              <p className='mt-3 text-sm text-light-secondary dark:text-dark-secondary'>
                {formatNumber(data.likeCount)} likes
              </p>
            </section>
            {feed.length ? (
              <>
                <AnimatePresence initial={false}>
                  {feed.map((tweet) => (
                    <Tweet {...tweet} key={tweet.id} />
                  ))}
                </AnimatePresence>
                {cursor && (
                  <div className='border-b border-light-border px-4 py-3 text-center dark:border-dark-border'>
                    <Button
                      className='accent-tab accent-bg-tab px-4 py-2 font-bold text-white'
                      loading={loadingMore}
                      onClick={handleLoadMore}
                    >
                      Show more
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className='border-b border-light-border px-4 py-8 text-center text-light-secondary dark:border-dark-border dark:text-dark-secondary'>
                No posts found in this feed.
              </p>
            )}
          </>
        )
      )}
    </MainContainer>
  );
}

FeedPage.getLayout = (page: ReactElement<any>): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <TrendsLayout>{page}</TrendsLayout>
    </MainLayout>
  </ProtectedLayout>
);
