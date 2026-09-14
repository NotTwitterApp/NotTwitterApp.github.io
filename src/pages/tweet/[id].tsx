import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import useSWR from 'swr';
import {
  getFullTweetThread,
  getTweetThread,
  getTweetThreadParentsPage,
  subscribeBackend
} from '@lib/atproto/backend';
import { isPlural } from '@lib/utils';
import { getTweetRouteId } from '@lib/static-routes';
import { useRouteBack } from '@lib/hooks/useRouteBack';
import { useNotTwitterBlueSettings } from '@lib/hooks/use-not-twitter-blue-settings';
import { getTweetPath, getUserPath } from '@lib/routes';
import { PublicTweetLayout } from '@components/layout/common-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { Tweet } from '@components/tweet/tweet';
import { ViewTweet } from '@components/view/view-tweet';
import { ImagePreview } from '@components/input/image-preview';
import { TweetEmbed } from '@components/tweet/tweet-embed';
import { TweetText } from '@components/tweet/tweet-text';
import { SEO } from '@components/common/seo';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { UserAvatar } from '@components/user/user-avatar';
import { UserName } from '@components/user/user-name';
import { UserUsername } from '@components/user/user-username';
import type { ReactElement, ReactNode } from 'react';
import type {
  TweetThreadPage,
  TweetThreadParentsPage
} from '@lib/atproto/backend';
import type { TweetWithUser } from '@lib/types/tweet';
import type { NotTwitterBlueSettings } from '@lib/hooks/use-not-twitter-blue-settings';

type ParentPageState = TweetThreadParentsPage & {
  loadingMore: boolean;
  error: boolean;
};

const initialParentPageState: ParentPageState = {
  parents: [],
  cursor: null,
  loadingMore: false,
  error: false
};
const ROOT_THREAD_REPLY_INITIAL_COUNT = 3;
const ROOT_THREAD_REPLY_PAGE_SIZE = 8;
const REPLIES_PAGE_SIZE = 20;

function getRouteParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mergeParentTweets(
  olderParents: TweetWithUser[],
  currentParents: TweetWithUser[]
): TweetWithUser[] {
  const seenIds = new Set<string>();

  return [...olderParents, ...currentParents].filter(({ id }) => {
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
}

function hasTweet(tweets: TweetWithUser[], tweetId: string): boolean {
  return tweets.some(({ id }) => id === tweetId);
}

function getReaderModeTweets(
  parents: TweetWithUser[],
  focalTweet: TweetWithUser | null,
  threadReplies: TweetWithUser[]
): TweetWithUser[] {
  if (!focalTweet) return [];

  const threadAuthorId = focalTweet.createdBy;
  const sameAuthorParents = parents.filter(
    ({ createdBy }) => createdBy === threadAuthorId
  );
  const sameAuthorReplies = threadReplies.filter(
    ({ createdBy }) => createdBy === threadAuthorId
  );

  return [...sameAuthorParents, focalTweet, ...sameAuthorReplies];
}

const readerTextSizeClassName: Record<
  NotTwitterBlueSettings['readerTextSize'],
  string
> = {
  small: 'text-[20px] leading-7',
  medium: 'text-[24px] leading-8',
  large: 'text-[28px] leading-10'
};

function ReaderModeThread({
  tweets,
  textSize,
  onExit
}: {
  tweets: TweetWithUser[];
  textSize: NotTwitterBlueSettings['readerTextSize'];
  onExit: () => void;
}): JSX.Element {
  const [firstTweet] = tweets;

  if (!firstTweet) return <TweetNotFound />;

  const { user } = firstTweet;

  return (
    <>
      <article className='border-b border-light-border px-5 pb-10 pt-6 dark:border-dark-border'>
        <header className='mx-auto mb-8 flex max-w-[680px] items-center gap-3 border-b border-light-border pb-5 dark:border-dark-border'>
          <UserAvatar
            src={user.photoURL}
            alt={user.name}
            username={user.username}
          />
          <div className='min-w-0'>
            <UserName
              name={user.name}
              username={user.username}
              verified={user.verified}
            />
            <UserUsername username={user.username} />
          </div>
        </header>
        <div className='mx-auto flex max-w-[680px] flex-col gap-8'>
          {tweets.map((tweet, index) => {
            const displayCard = tweet.card;
            const hasMedia = !!tweet.images?.length;
            const hasEmbed = !!displayCard || !!tweet.quotedTweet;

            return (
              <section className='min-w-0' key={tweet.id}>
                {tweet.text && (
                  <TweetText
                    className={cn(
                      'text-light-primary dark:text-dark-primary',
                      readerTextSizeClassName[textSize]
                    )}
                    linkClassName='text-main-accent'
                    disableDefaultSize
                    text={tweet.text}
                  />
                )}
                {hasMedia && (
                  <div className={tweet.text ? 'mt-4' : undefined}>
                    <ImagePreview
                      tweet
                      tweetData={tweet}
                      imagesPreview={tweet.images ?? []}
                      previewCount={tweet.images?.length ?? 0}
                      moderationWarning={tweet.mediaWarning}
                    />
                  </div>
                )}
                {hasEmbed && (
                  <div className={tweet.text || hasMedia ? 'mt-4' : undefined}>
                    <TweetEmbed
                      card={displayCard}
                      quotedTweet={tweet.quotedTweet}
                      articleAuthor={tweet.user}
                      articleTweetPath={getTweetPath(
                        tweet.id,
                        tweet.user.username
                      )}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </article>
      <div className='mx-auto flex max-w-[680px] justify-center px-4 py-8'>
        <Button
          className='rounded-full border border-main-accent bg-main-background px-5 py-2.5 text-[15px]
                     font-extrabold text-main-accent hover:bg-main-accent/10 active:bg-main-accent/20'
          onClick={onExit}
        >
          <span className='mr-2 text-xl leading-none'>×</span>
          Exit Reader
        </Button>
      </div>
    </>
  );
}

function TweetNotFound(): JSX.Element {
  return (
    <>
      <SEO
        title='Tweet not found / Not Twitter'
        description='Hmm...this page doesn’t exist. Try searching for something else.'
      />
      <div className='mx-auto flex w-full max-w-sm flex-col px-8 py-10'>
        <h2 className='text-[31px] font-extrabold leading-9'>
          Hmm...this page doesn’t exist.
        </h2>
        <p className='mt-2 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
          Try searching for something else.
        </p>
      </div>
    </>
  );
}

export default function TweetId(): JSX.Element {
  const { asPath, query: routeQuery } = useRouter();
  const tweetId =
    getRouteParam(routeQuery.tweetId) ??
    getRouteParam(routeQuery.id) ??
    getTweetRouteId(asPath);
  const tweetPathId = tweetId ?? 'null';

  const {
    data: threadData,
    error,
    mutate
  } = useSWR<TweetThreadPage | null, Error>(
    tweetId ? ['tweet-thread', tweetPathId] : null,
    () => getTweetThread(tweetPathId),
    { revalidateOnFocus: false }
  );

  const viewTweetRef = useRef<HTMLElement>(null);
  const [parentPage, setParentPage] = useState<ParentPageState>(
    initialParentPageState
  );
  const [parentPaginationReady, setParentPaginationReady] = useState(false);
  const [visibleThreadReplyCount, setVisibleThreadReplyCount] = useState(
    ROOT_THREAD_REPLY_INITIAL_COUNT
  );
  const [visibleReplyCount, setVisibleReplyCount] = useState(REPLIES_PAGE_SIZE);
  const [readerModeActive, setReaderModeActive] = useState(false);
  const { notTwitterBlueSettings } = useNotTwitterBlueSettings();
  const baseTweetData = threadData?.tweet ?? null;
  const baseThreadReplies = threadData?.threadReplies ?? [];
  const shouldPrefetchFullThread =
    !!tweetId &&
    !!baseTweetData &&
    !baseTweetData.parent &&
    !baseTweetData.unavailable &&
    baseThreadReplies.length > ROOT_THREAD_REPLY_INITIAL_COUNT;

  const { data: fullThreadData } = useSWR<TweetThreadPage | null, Error>(
    tweetId && (readerModeActive || shouldPrefetchFullThread)
      ? ['tweet-thread-full', tweetPathId]
      : null,
    () => getFullTweetThread(tweetPathId),
    { revalidateOnFocus: false }
  );

  const tweetLoading = !!tweetId && !error && threadData === undefined;
  const tweetData = threadData?.tweet ?? null;
  const parentTweets = parentPage.parents;
  const fullThreadReplies =
    fullThreadData && fullThreadData.tweet?.id === tweetData?.id
      ? fullThreadData.threadReplies
      : [];
  const threadReplies =
    fullThreadReplies.length > baseThreadReplies.length
      ? fullThreadReplies
      : baseThreadReplies;
  const repliesData = threadData?.replies ?? [];
  const tweetUnavailable = !!tweetData?.unavailable;
  const routeBack = useRouteBack(
    tweetData?.user.username ? getUserPath(tweetData.user.username) : undefined
  );

  const { text, images } = tweetData ?? {};

  const imagesLength = images?.length ?? 0;
  const hasParentTweets = parentTweets.length > 0;
  const hasThreadReplies = threadReplies.length > 0;
  const hasThread = hasParentTweets || hasThreadReplies;
  const isConversationRoot = !!tweetData && !tweetData.parent;
  const shouldCollapseRootThreadReplies =
    isConversationRoot &&
    threadReplies.length > ROOT_THREAD_REPLY_INITIAL_COUNT;
  const visibleThreadReplies = shouldCollapseRootThreadReplies
    ? threadReplies.slice(0, visibleThreadReplyCount)
    : threadReplies;
  const hasMoreThreadReplies =
    shouldCollapseRootThreadReplies &&
    visibleThreadReplyCount < threadReplies.length;
  const visibleReplies = repliesData.slice(0, visibleReplyCount);
  const hasMoreReplies = visibleReplyCount < repliesData.length;
  const readerThreadData = fullThreadData ?? threadData;
  const readerModeTweets = getReaderModeTweets(
    readerModeActive && fullThreadData ? fullThreadData.parents : parentTweets,
    readerThreadData?.tweet ?? tweetData,
    readerModeActive && fullThreadData
      ? fullThreadData.threadReplies
      : threadReplies
  );
  const readerModeAvailable =
    notTwitterBlueSettings.readerMode &&
    readerModeTweets.length > 1 &&
    !!tweetData &&
    !tweetUnavailable;

  const pageTitle = tweetData
    ? tweetUnavailable
      ? 'Tweet unavailable / Not Twitter'
      : `${tweetData.user.name} on Not Twitter: "${text ?? ''}${
          images ? ` (${imagesLength} image${isPlural(imagesLength)})` : ''
        }" / Not Twitter`
    : null;

  useEffect(() => {
    if (!threadData) {
      setParentPage(initialParentPageState);
      setParentPaginationReady(false);
      return;
    }

    setParentPage({
      parents: threadData.parents,
      cursor: threadData.parentCursor,
      loadingMore: false,
      error: false
    });
  }, [threadData]);

  useEffect(() => {
    setParentPaginationReady(false);
    setVisibleThreadReplyCount(ROOT_THREAD_REPLY_INITIAL_COUNT);
    setVisibleReplyCount(REPLIES_PAGE_SIZE);
    setReaderModeActive(false);
  }, [tweetData?.id]);

  useEffect(() => {
    if (!readerModeAvailable) setReaderModeActive(false);
  }, [readerModeAvailable]);

  const loadMoreParents = useCallback(async (): Promise<void> => {
    const parentCursor = parentPage.cursor;

    if (!parentCursor || parentPage.loadingMore) return;

    const scrollY = window.scrollY;
    const previousHeight = document.documentElement.scrollHeight;

    setParentPage((currentPage) => ({
      ...currentPage,
      loadingMore: true,
      error: false
    }));

    try {
      const nextPage = await getTweetThreadParentsPage(parentCursor);

      setParentPage((currentPage) => ({
        parents: mergeParentTweets(nextPage.parents, currentPage.parents),
        cursor: nextPage.cursor,
        loadingMore: false,
        error: false
      }));

      requestAnimationFrame(() => {
        const nextHeight = document.documentElement.scrollHeight;
        window.scrollTo(0, scrollY + nextHeight - previousHeight);
      });
    } catch {
      setParentPage((currentPage) => ({
        ...currentPage,
        loadingMore: false,
        error: true
      }));
    }
  }, [parentPage.cursor, parentPage.loadingMore]);

  useEffect(() => {
    if (tweetLoading) return;

    if (hasParentTweets) {
      viewTweetRef.current?.scrollIntoView();
      requestAnimationFrame(() => setParentPaginationReady(true));
      return;
    }

    setParentPaginationReady(true);
  }, [hasParentTweets, tweetData?.id, tweetLoading]);

  const loadMoreParentsInView = useCallback((): void => {
    if (!parentPaginationReady) return;

    void loadMoreParents();
  }, [loadMoreParents, parentPaginationReady]);

  const showMoreThreadReplies = useCallback((): void => {
    setVisibleThreadReplyCount((count) =>
      Math.min(count + ROOT_THREAD_REPLY_PAGE_SIZE, threadReplies.length)
    );
  }, [threadReplies.length]);

  const loadMoreRepliesInView = useCallback((): void => {
    setVisibleReplyCount((count) =>
      Math.min(count + REPLIES_PAGE_SIZE, repliesData.length)
    );
  }, [repliesData.length]);

  useEffect(() => {
    if (!tweetId) return undefined;

    return subscribeBackend(() => {
      void mutate();
    }, ['content']);
  }, [mutate, tweetId]);

  const handleReplySent = useCallback(
    (replyTweet: TweetWithUser): void => {
      void mutate((currentData) => {
        if (!currentData) return currentData;

        const replyAlreadyVisible =
          hasTweet(currentData.threadReplies, replyTweet.id) ||
          hasTweet(currentData.replies, replyTweet.id);

        if (replyAlreadyVisible) return currentData;

        return {
          ...currentData,
          tweet: currentData.tweet
            ? {
                ...currentData.tweet,
                userReplies: currentData.tweet.userReplies + 1
              }
            : currentData.tweet,
          replies: [...currentData.replies, replyTweet]
        };
      }, false);
    },
    [mutate]
  );

  return (
    <MainContainer className={readerModeActive ? '!pb-20' : '!pb-[1280px]'}>
      <MainHeader
        useActionButton
        title={hasThread ? 'Thread' : 'Tweet'}
        subtitle={readerModeActive ? 'Reader Mode' : undefined}
        action={routeBack}
      >
        {readerModeAvailable && (
          <Button
            className='dark-bg-tab group relative ml-auto p-2 text-main-accent
                       hover:bg-main-accent/10 active:bg-main-accent/20'
            aria-label={
              readerModeActive ? 'Exit Reader' : 'View thread in Reader'
            }
            title={readerModeActive ? 'Exit Reader' : 'View thread in Reader'}
            onClick={(): void => setReaderModeActive((active) => !active)}
          >
            <HeroIcon className='h-5 w-5' iconName='BookOpenIcon' />
          </Button>
        )}
      </MainHeader>
      <section>
        {tweetLoading ? (
          <Loading className='mt-5' />
        ) : !tweetData ? (
          <TweetNotFound />
        ) : readerModeActive ? (
          <>
            {pageTitle && <SEO title={pageTitle} />}
            <ReaderModeThread
              tweets={readerModeTweets}
              textSize={notTwitterBlueSettings.readerTextSize}
              onExit={(): void => setReaderModeActive(false)}
            />
          </>
        ) : (
          <>
            {pageTitle && <SEO title={pageTitle} />}
            {parentPage.cursor && (
              <motion.div
                className={
                  parentPage.loadingMore || parentPage.error
                    ? `border-b border-light-border px-4 py-3 text-[15px]
                       dark:border-dark-border`
                    : 'h-px'
                }
                viewport={{ margin: '1000px 0px 0px' }}
                onViewportEnter={loadMoreParentsInView}
              >
                {parentPage.loadingMore ? (
                  <Loading className='py-1' iconClassName='h-5 w-5' />
                ) : parentPage.error ? (
                  <button
                    className='custom-underline font-bold text-main-accent
                               disabled:cursor-wait disabled:opacity-60'
                    type='button'
                    onClick={(): void => {
                      void loadMoreParents();
                    }}
                  >
                    Retry earlier Tweets
                  </button>
                ) : (
                  <span className='sr-only'>Loading earlier Tweets</span>
                )}
              </motion.div>
            )}
            {parentTweets.map((parentTweet) => (
              <Tweet
                parentTweet
                conversationTweet
                {...parentTweet}
                key={parentTweet.id}
              />
            ))}
            {tweetUnavailable ? (
              <Tweet conversationTweet {...tweetData} key={tweetData.id} />
            ) : (
              <ViewTweet
                viewTweetRef={viewTweetRef}
                onReplySent={handleReplySent}
                {...tweetData}
              />
            )}
            {readerModeAvailable && (
              <div className='border-b border-light-border px-4 py-3 dark:border-dark-border'>
                <Button
                  className='dark-bg-tab flex w-full items-center justify-center gap-2 rounded-full
                             border border-light-border px-4 py-3 text-[15px] font-extrabold
                             text-main-accent transition hover:bg-main-accent/10
                             active:bg-main-accent/20 dark:border-dark-border'
                  type='button'
                  onClick={(): void => setReaderModeActive(true)}
                >
                  <HeroIcon className='h-5 w-5' iconName='BookOpenIcon' />
                  View thread in Reader
                </Button>
              </div>
            )}
            <AnimatePresence>
              {visibleThreadReplies.map((tweet) => (
                <Tweet
                  conversationTweet
                  {...tweet}
                  onReplySent={handleReplySent}
                  key={tweet.id}
                />
              ))}
              {hasMoreThreadReplies && (
                <div
                  className='grid grid-cols-[auto,1fr] gap-x-3 border-b border-light-border
                             px-4 py-3 dark:border-dark-border'
                  key='show-more-thread-replies'
                >
                  <div className='flex w-10 justify-center'>
                    <i className='h-full w-0.5 bg-light-line-reply dark:bg-dark-line-reply' />
                  </div>
                  <button
                    className='w-fit text-[15px] font-bold text-main-accent hover:underline'
                    type='button'
                    onClick={showMoreThreadReplies}
                  >
                    Show more replies
                  </button>
                </div>
              )}
              {visibleReplies.map((tweet) => (
                <Tweet
                  conversationTweet
                  {...tweet}
                  onReplySent={handleReplySent}
                  key={tweet.id}
                />
              ))}
            </AnimatePresence>
            {hasMoreReplies && (
              <motion.div
                className='border-b border-light-border dark:border-dark-border'
                viewport={{ margin: '0px 0px 1000px' }}
                onViewportEnter={loadMoreRepliesInView}
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

TweetId.getLayout = (page: ReactElement<any>): ReactNode => (
  <PublicTweetLayout>{page}</PublicTweetLayout>
);
