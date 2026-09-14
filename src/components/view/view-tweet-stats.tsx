import { useCallback, useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/router';
import cn from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { listTweetStatsPage, subscribeBackend } from '@lib/atproto/backend';
import { useModal } from '@lib/hooks/useModal';
import { getTweetQuotesPath } from '@lib/routes';
import { Modal } from '@components/modal/modal';
import { TweetStatsModal } from '@components/modal/tweet-stats-modal';
import { NumberStats } from '@components/tweet/number-stats';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { Tweet as TweetCard } from '@components/tweet/tweet';
import { Loading } from '@components/ui/loading';
import { Error as ErrorMessage } from '@components/ui/error';
import { UserCard } from '@components/user/user-card';
import type { TweetStatsPage, TweetStatsType } from '@lib/atproto/backend';
import type { StatsEmptyProps } from '@components/tweet/stats-empty';

type viewTweetStats = {
  tweetId: string;
  username?: string;
  likeMove: number;
  tweetMove: number;
  quoteMove: number;
  replyMove: number;
  currentLikes: number;
  currentTweets: number;
  currentQuotes: number;
  currentReplies: number;
  isStatsVisible: boolean;
};

export type StatsType = TweetStatsType;

type Stats = [string, StatsType | null, number, number];

type StatsPageState = TweetStatsPage & {
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
};

type StatsModalContentProps = {
  tweetId: string;
  statsType: StatsType | null;
};

const statsPageSize = 25;

const allNoStatsData: Readonly<Record<StatsType, StatsEmptyProps>> = {
  retweets: {
    title: 'Amplify Tweets you like',
    imageData: { src: '/assets/no-retweets.png', alt: 'No retweets' },
    description:
      'Share someone else’s Tweet on your timeline by Retweeting it. When you do, it’ll show up here.'
  },
  likes: {
    title: 'No Tweet Likes yet',
    imageData: { src: '/assets/no-likes.png', alt: 'No likes' },
    description: 'When you like a Tweet, it’ll show up here.'
  },
  quotes: {
    title: 'No Quote Tweets yet',
    imageData: { src: '/assets/no-retweets.png', alt: 'No quote Tweets' },
    description: 'When someone Quote Tweets this Tweet, it’ll show up here.'
  }
};

const initialStatsPageState: StatsPageState = {
  users: [],
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

function getStatLabel(title: string, stats: number): string {
  if (title === 'Reply') return stats === 1 ? 'Reply' : 'Replies';
  if (title === 'Quote Tweet')
    return stats === 1 ? 'Quote Tweet' : 'Quote Tweets';
  return stats === 1 ? title : `${title}s`;
}

function StatsModalContent({
  tweetId,
  statsType
}: StatsModalContentProps): JSX.Element {
  const [page, setPage] = useState<StatsPageState>(initialStatsPageState);

  useEffect(() => {
    if (!statsType) {
      setPage(initialStatsPageState);
      return;
    }

    let active = true;

    const fetchStats = async (showLoading: boolean): Promise<void> => {
      if (showLoading) setPage({ ...initialStatsPageState, loading: true });

      try {
        const nextPage = await listTweetStatsPage(
          tweetId,
          statsType,
          undefined,
          statsPageSize
        );

        if (!active) return;

        setPage({
          ...nextPage,
          loading: false,
          loadingMore: false,
          error: false
        });
      } catch {
        if (!active) return;
        if (showLoading)
          setPage({ ...initialStatsPageState, loading: false, error: true });
        else
          setPage((currentPage) => ({
            ...currentPage,
            loading: false,
            loadingMore: false,
            error: true
          }));
      }
    };

    void fetchStats(true);
    const unsubscribe = subscribeBackend(() => {
      void fetchStats(false);
    }, ['content']);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [statsType, tweetId]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!statsType || !page.cursor || page.loading || page.loadingMore) return;

    setPage((currentPage) => ({ ...currentPage, loadingMore: true }));

    try {
      const nextPage = await listTweetStatsPage(
        tweetId,
        statsType,
        page.cursor,
        statsPageSize
      );

      setPage((currentPage) => ({
        ...currentPage,
        users: mergeById(currentPage.users, nextPage.users),
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
  }, [page.cursor, page.loading, page.loadingMore, statsType, tweetId]);

  const usersVisible = statsType !== 'quotes' && !!page.users.length;
  const quotesVisible = statsType === 'quotes' && !!page.tweets.length;
  const hasResults = usersVisible || quotesVisible;

  return (
    <section
      className={cn(
        'h-full overflow-y-auto',
        page.loading && 'flex items-center justify-center'
      )}
    >
      {page.loading ? (
        <Loading className='mt-[52px]' />
      ) : page.error && !hasResults ? (
        <div className='mt-[52px]'>
          <ErrorMessage message='Something went wrong' />
        </div>
      ) : hasResults ? (
        <>
          <div className='h-[52px]' />
          <AnimatePresence>
            {statsType === 'quotes'
              ? page.tweets.map((tweet) => (
                  <TweetCard {...tweet} key={tweet.id} />
                ))
              : page.users.map((userData) => (
                  <motion.div key={userData.id}>
                    <UserCard {...userData} follow modal />
                  </motion.div>
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
      ) : statsType ? (
        <StatsEmpty {...allNoStatsData[statsType]} modal />
      ) : null}
    </section>
  );
}

export function ViewTweetStats({
  tweetId,
  username,
  likeMove,
  tweetMove,
  quoteMove,
  replyMove,
  currentLikes,
  currentTweets,
  currentQuotes,
  currentReplies,
  isStatsVisible
}: viewTweetStats): JSX.Element {
  const [statsType, setStatsType] = useState<StatsType | null>(null);

  const { push } = useRouter();

  const { open, openModal, closeModal } = useModal();

  const handleOpen = (type: StatsType) => (): void => {
    if (type === 'quotes') {
      void push(getTweetQuotesPath(tweetId, username));
      return;
    }

    setStatsType(type);
    openModal();
  };

  const handleClose = (): void => {
    setStatsType(null);
    closeModal();
  };

  const allStats: Readonly<Stats[]> = [
    ['Reply', null, replyMove, currentReplies],
    ['Retweet', 'retweets', tweetMove, currentTweets],
    ['Quote Tweet', 'quotes', quoteMove, currentQuotes],
    ['Like', 'likes', likeMove, currentLikes]
  ];

  return (
    <>
      <Modal
        modalClassName='relative bg-main-background rounded-2xl max-w-xl w-full 
                        h-[672px] overflow-hidden rounded-2xl'
        open={open}
        closeModal={handleClose}
      >
        <TweetStatsModal statsType={statsType} handleClose={handleClose}>
          <StatsModalContent tweetId={tweetId} statsType={statsType} />
        </TweetStatsModal>
      </Modal>
      {isStatsVisible && (
        <div
          className='flex flex-wrap gap-x-4 gap-y-2 px-1 py-4 text-light-secondary dark:text-dark-secondary
                     [&>button>div]:font-bold [&>button>div]:text-light-primary 
                     dark:[&>button>div]:text-dark-primary'
        >
          {allStats.map(
            ([title, type, move, stats], index) =>
              !!stats && (
                <button
                  className={cn(
                    `hover-animation mt-0.5 mb-[3px] flex h-4 items-center gap-1 border-b 
                     border-b-transparent outline-none hover:border-b-light-primary 
                     focus-visible:border-b-light-primary dark:hover:border-b-dark-primary
                     dark:focus-visible:border-b-dark-primary`,
                    index === 0 && 'cursor-not-allowed'
                  )}
                  key={title}
                  onClick={type ? handleOpen(type) : undefined}
                >
                  <NumberStats move={move} stats={stats} />
                  <p>{getStatLabel(title, stats)}</p>
                </button>
              )
          )}
        </div>
      )}
    </>
  );
}
