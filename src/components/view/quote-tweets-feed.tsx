import { useCallback, useEffect, useState, type JSX } from 'react';
import cn from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { listTweetStatsPage, subscribeBackend } from '@lib/atproto/backend';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { Tweet as TweetCard } from '@components/tweet/tweet';
import { Error as ErrorMessage } from '@components/ui/error';
import { Loading } from '@components/ui/loading';
import type { TweetStatsPage } from '@lib/atproto/backend';

type QuoteTweetsFeedProps = {
  tweetId: string;
  modal?: boolean;
};

type QuoteTweetsPageState = Pick<TweetStatsPage, 'tweets' | 'cursor'> & {
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
};

const quotesPageSize = 25;

const noQuoteTweetsData = {
  title: 'No Quote Tweets yet',
  imageData: { src: '/assets/no-retweets.png', alt: 'No quote Tweets' },
  description: 'When someone Quote Tweets this Tweet, it’ll show up here.'
};

const initialQuoteTweetsPage: QuoteTweetsPageState = {
  tweets: [],
  cursor: null,
  loading: false,
  loadingMore: false,
  error: false
};

function mergeById<T extends { id: string }>(current: T[], next: T[]): T[] {
  const currentIds = new Set(current.map(({ id }) => id));
  return [...current, ...next.filter(({ id }) => !currentIds.has(id))];
}

export function QuoteTweetsFeed({
  tweetId,
  modal
}: QuoteTweetsFeedProps): JSX.Element {
  const [page, setPage] = useState<QuoteTweetsPageState>(
    initialQuoteTweetsPage
  );

  useEffect(() => {
    let active = true;

    const fetchQuotes = async (showLoading: boolean): Promise<void> => {
      if (showLoading) setPage({ ...initialQuoteTweetsPage, loading: true });

      try {
        const nextPage = await listTweetStatsPage(
          tweetId,
          'quotes',
          undefined,
          quotesPageSize
        );

        if (!active) return;

        setPage({
          tweets: nextPage.tweets,
          cursor: nextPage.cursor,
          loading: false,
          loadingMore: false,
          error: false
        });
      } catch {
        if (!active) return;
        if (showLoading)
          setPage({ ...initialQuoteTweetsPage, loading: false, error: true });
        else
          setPage((currentPage) => ({
            ...currentPage,
            loading: false,
            loadingMore: false,
            error: true
          }));
      }
    };

    void fetchQuotes(true);
    const unsubscribe = subscribeBackend(() => {
      void fetchQuotes(false);
    }, ['content']);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [tweetId]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!page.cursor || page.loading || page.loadingMore) return;

    setPage((currentPage) => ({ ...currentPage, loadingMore: true }));

    try {
      const nextPage = await listTweetStatsPage(
        tweetId,
        'quotes',
        page.cursor,
        quotesPageSize
      );

      setPage((currentPage) => ({
        ...currentPage,
        tweets: mergeById(currentPage.tweets, nextPage.tweets),
        cursor: nextPage.cursor,
        loadingMore: false,
        error: false
      }));
    } catch {
      setPage((currentPage) => ({
        ...currentPage,
        loadingMore: false,
        error: true
      }));
    }
  }, [page.cursor, page.loading, page.loadingMore, tweetId]);

  const hasQuotes = !!page.tweets.length;

  return (
    <section
      className={cn(
        modal ? 'h-full overflow-y-auto' : 'min-h-[360px]',
        page.loading && 'flex items-center justify-center'
      )}
    >
      {page.loading ? (
        <Loading className={modal ? 'mt-[52px]' : 'mt-5'} />
      ) : page.error && !hasQuotes ? (
        <div className={modal ? 'mt-[52px]' : 'mt-5'}>
          <ErrorMessage message='Something went wrong' />
        </div>
      ) : hasQuotes ? (
        <>
          {modal && <div className='h-[52px]' />}
          <AnimatePresence>
            {page.tweets.map((tweet) => (
              <TweetCard {...tweet} key={tweet.id} />
            ))}
          </AnimatePresence>
          {page.cursor && (
            <motion.div
              viewport={{ margin: '0px 0px 1000px' }}
              onViewportEnter={(): void => {
                void loadMore();
              }}
            >
              <Loading className='mt-5' />
            </motion.div>
          )}
        </>
      ) : (
        <StatsEmpty {...noQuoteTweetsData} modal={modal} />
      )}
    </section>
  );
}
