/* eslint-disable react-hooks/exhaustive-deps, @next/next/no-img-element */

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef, type JSX } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { toast } from 'react-hot-toast';
import { siteURL } from '@lib/env';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { preventBubbling } from '@lib/utils';
import { formatDate, formatNumber } from '@lib/date';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { useCollection } from '@lib/hooks/useCollection';
import { tweetsCollection } from '@lib/atproto/collections';
import { query, where, orderBy } from '@lib/atproto/store';
import { manageBookmark, manageLike, manageRetweet } from '@lib/atproto/utils';
import { getBskyTweetUrl, getTweetPath, getUserPath } from '@lib/routes';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { AppIcon, type AppIconName } from '@components/ui/app-icon';
import { Loading } from '@components/ui/loading';
import { TwitterVideoPlayer } from '@components/ui/twitter-video-player';
import { UserAvatar } from '@components/user/user-avatar';
import { UserName } from '@components/user/user-name';
import { UserUsername } from '@components/user/user-username';
import { Input } from '@components/input/input';
import { TweetActions } from '@components/tweet/tweet-actions';
import {
  TweetActionEffect,
  type TweetActionEffectKind
} from '@components/tweet/tweet-action-effect';
import { useOptimisticReactionIds } from '@components/tweet/use-optimistic-reaction-ids';
import { TweetShare } from '@components/tweet/tweet-share';
import { TweetEmbed } from '@components/tweet/tweet-embed';
import { ViewTweetStats } from '@components/view/view-tweet-stats';
import { TweetText } from '@components/tweet/tweet-text';
import {
  TwitterGifMedia,
  isGifMedia
} from '@components/input/twitter-gif-media';
import type { TargetAndTransition, Variants } from 'framer-motion';
import type { ImageData } from '@lib/types/file';
import type { TweetWithUser } from '@lib/types/tweet';
import type { IconName } from '@components/ui/hero-icon';

type ImageModalProps = {
  tweet?: boolean;
  imageData: ImageData;
  previewCount: number;
  profileMediaKind?: 'avatar' | 'cover';
  tweetData?: TweetWithUser;
  selectedIndex?: number;
  handleNextIndex?: (type: 'prev' | 'next') => () => void;
  closeModal?: () => void;
};

type ArrowButton = ['prev' | 'next', string | null, IconName];

const arrowButtons: Readonly<ArrowButton[]> = [
  ['prev', null, 'ArrowLeftIcon'],
  ['next', 'order-1', 'ArrowRightIcon']
];

const mediaFade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: 'easeOut' } }
};

const fullscreenMediaGlide: Variants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 72 : -72,
    scale: 0.985
  }),
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.28, ease: [0.2, 0, 0, 1] }
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -72 : 72,
    scale: 0.985,
    transition: { duration: 0.22, ease: [0.2, 0, 0, 1] }
  })
};

const profileAvatarFrameStyle = {
  width: 'min(100vw, 100vh, 400px)',
  height: 'min(100vw, 100vh, 400px)'
};

const profileCoverFrameStyle = {
  width: 'min(100vw, 300vh)',
  aspectRatio: '3 / 1'
};

type FullscreenImageModalProps = Pick<
  ImageModalProps,
  | 'imageData'
  | 'tweetData'
  | 'previewCount'
  | 'selectedIndex'
  | 'handleNextIndex'
  | 'closeModal'
> & {
  loading: boolean;
  mediaDirection: number;
};

type ProfileFullscreenImageModalProps = Pick<
  ImageModalProps,
  'imageData' | 'profileMediaKind' | 'closeModal'
> & {
  loading: boolean;
};

type ConversationTweetProps = {
  tweet: TweetWithUser;
  root?: boolean;
  onReply?: () => void;
};

type ConversationActionBarProps = ConversationTweetProps & {
  mediaOnly?: boolean;
};

type ConversationActionButtonProps = {
  tip: string;
  iconName: AppIconName;
  count?: number;
  active?: boolean;
  root?: boolean;
  className: string;
  iconClassName: string;
  actionEffect?: TweetActionEffectKind;
  countClassName?: string;
  onClick?: () => void;
};

function isVideoMedia({ src, type }: ImageData): boolean {
  return (
    !!type?.includes('video') || /\.(m3u8|mp4|mov|m4v|webm)($|\?)/i.test(src)
  );
}

function getMediaAltText(media: ImageData): string {
  return media.altText?.trim() ?? '';
}

const mediaModalBorder =
  'border-dark-border lg:border-light-border dark:lg:border-dark-border';
const mediaModalPrimaryText =
  'text-dark-primary lg:text-light-primary dark:lg:text-dark-primary';
const mediaModalSecondaryText =
  'text-dark-secondary lg:text-light-secondary dark:lg:text-dark-secondary';
const mediaModalSecondaryHoverText =
  'text-dark-secondary hover:text-dark-primary lg:text-light-secondary lg:hover:text-light-primary dark:lg:text-dark-secondary dark:lg:hover:text-dark-primary';

function FullscreenImageModal({
  imageData,
  tweetData,
  previewCount,
  selectedIndex,
  loading,
  mediaDirection,
  handleNextIndex,
  closeModal
}: FullscreenImageModalProps): JSX.Element {
  const { src, alt, poster, viewCount } = imageData;
  const [showAltText, setShowAltText] = useState(false);

  const requireArrows = handleNextIndex && previewCount > 1;
  const isVideo = isVideoMedia(imageData);
  const altText = getMediaAltText(imageData);

  useEffect(() => {
    setShowAltText(false);
  }, [altText, src]);

  return (
    <div className='flex h-screen w-screen flex-col overflow-hidden bg-black text-white lg:flex-row'>
      <section
        className='relative flex min-h-[100svh] shrink-0 items-center justify-center overflow-hidden
                   bg-black lg:min-h-0 lg:flex-1'
      >
        {closeModal && (
          <Button
            className='absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center bg-black/40
                       p-0 text-white backdrop-blur-xs transition-colors duration-200 ease-out
                       hover:bg-white/10 focus-visible:ring-white/70 active:bg-white/20'
            aria-label='Close'
            onClick={preventBubbling(closeModal)}
          >
            <HeroIcon iconName='XMarkIcon' />
          </Button>
        )}
        {requireArrows &&
          arrowButtons.map(([name, , iconName]) => (
            <Button
              className={cn(
                `absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center
                 justify-center bg-black/40 p-0 text-white backdrop-blur-xs
                 transition-colors duration-200 ease-out hover:bg-white/10
                 focus-visible:ring-white/70 active:bg-white/20`,
                name === 'prev' ? 'left-4' : 'right-4'
              )}
              aria-label={name === 'prev' ? 'Previous media' : 'Next media'}
              onClick={preventBubbling(handleNextIndex(name))}
              key={name}
            >
              <HeroIcon iconName={iconName} />
            </Button>
          ))}
        <AnimatePresence custom={mediaDirection} initial={false}>
          {loading ? (
            <motion.div
              className='absolute inset-0 flex h-full w-full items-center justify-center'
              {...mediaFade}
              key={`loading-${selectedIndex ?? src}`}
            >
              <Loading iconClassName='h-12 w-12 text-white' />
            </motion.div>
          ) : (
            <motion.div
              className='absolute inset-0 flex h-full w-full items-center justify-center p-4 sm:p-8 lg:px-16 lg:py-12'
              custom={mediaDirection}
              variants={fullscreenMediaGlide}
              initial='initial'
              animate='animate'
              exit='exit'
              key={`${selectedIndex ?? 0}-${src}`}
            >
              {isVideo ? (
                <TwitterVideoPlayer
                  className='h-full w-full'
                  src={src}
                  poster={poster}
                  autoPlay
                  muted={false}
                  viewCount={viewCount}
                  objectFit='contain'
                />
              ) : (
                <picture className='flex h-full w-full items-center justify-center'>
                  <source srcSet={src} type='image/*' />
                  <img
                    className='h-full w-full object-contain'
                    src={src}
                    alt={altText || alt}
                    draggable={false}
                    onClick={preventBubbling()}
                  />
                </picture>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {altText && (
          <div
            className='pointer-events-auto absolute left-4 bottom-20 z-20 max-w-[min(28rem,calc(100%-2rem))]
                       lg:bottom-5'
            onClick={preventBubbling(null, true)}
          >
            <Button
              className='rounded-md bg-black/70 px-2 py-0.5 text-[13px] font-extrabold
                         leading-4 text-white backdrop-blur-xs transition hover:bg-black/80
                         focus-visible:ring-2 focus-visible:ring-white/70 active:bg-black/90'
              aria-expanded={showAltText}
              aria-label='View image description'
              onClick={(): void => setShowAltText(!showAltText)}
            >
              ALT
            </Button>
            <AnimatePresence>
              {showAltText && (
                <motion.p
                  className='mt-2 max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words rounded-md
                             bg-black/80 p-3 text-[15px] leading-5 text-white shadow-lg backdrop-blur-xs'
                  {...mediaFade}
                >
                  {altText}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}
        {tweetData && <ConversationActionBar tweet={tweetData} mediaOnly />}
      </section>
      {tweetData && <MediaConversation tweet={tweetData} />}
    </div>
  );
}

function ProfileFullscreenImageModal({
  imageData,
  profileMediaKind,
  loading,
  closeModal
}: ProfileFullscreenImageModalProps): JSX.Element {
  const { src, alt } = imageData;
  const isAvatar = profileMediaKind === 'avatar';

  return (
    <div className='relative flex h-screen w-screen overflow-hidden bg-black/90 text-white transition-colors duration-500'>
      {closeModal && (
        <Button
          className='absolute top-3 left-3 z-20 flex h-11 w-11 items-center justify-center
                     bg-transparent p-0 text-white transition-colors duration-200 ease-out
                     hover:bg-white/10 focus-visible:ring-white/70 active:bg-white/20'
          aria-label='Close'
          onClick={preventBubbling(closeModal)}
        >
          <HeroIcon iconName='XMarkIcon' />
        </Button>
      )}
      <AnimatePresence mode='wait'>
        {loading ? (
          <motion.div
            className='absolute inset-0 flex items-center justify-center'
            {...mediaFade}
            key={`profile-loading-${src}`}
          >
            <Loading iconClassName='h-12 w-12 text-white' />
          </motion.div>
        ) : (
          <motion.div
            className='flex h-full w-full items-center justify-center'
            {...mediaFade}
            key={`profile-media-${profileMediaKind ?? 'media'}-${src}`}
          >
            <picture
              className={cn(
                'relative flex shrink-0 items-center justify-center',
                isAvatar ? 'p-4' : 'max-h-screen'
              )}
              style={
                isAvatar ? profileAvatarFrameStyle : profileCoverFrameStyle
              }
              onClick={preventBubbling()}
            >
              <source srcSet={src} type='image/*' />
              <img
                className={cn(
                  'h-full w-full object-contain',
                  isAvatar && 'profile-picture'
                )}
                src={src}
                alt={alt}
                draggable={false}
              />
            </picture>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MediaConversation({ tweet }: { tweet: TweetWithUser }): JSX.Element {
  const { user } = useAuth();
  const [replyFocusRequest, setReplyFocusRequest] = useState(0);

  const repliesQuery = query(
    tweetsCollection,
    where('parent.id', '==', tweet.id),
    orderBy('createdAt', 'desc')
  );

  const { data: repliesData, loading } = useCollection(repliesQuery, {
    includeUser: true,
    allowNull: true
  });

  return (
    <aside
      className={cn(
        `hidden h-full w-[350px] min-w-[350px] shrink-0 flex-col border-l
         bg-main-background lg:flex`,
        mediaModalBorder,
        mediaModalPrimaryText
      )}
      onClick={preventBubbling(null, true)}
    >
      <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
        <ConversationTweet
          tweet={tweet}
          root
          onReply={(): void => setReplyFocusRequest((request) => request + 1)}
        />
        <div className={cn('border-b text-[15px]', mediaModalBorder)}>
          <button
            className={cn(
              'accent-tab flex items-center gap-1 px-4 py-2.5 outline-none',
              mediaModalSecondaryHoverText
            )}
            type='button'
          >
            <span>Relevant</span>
            <HeroIcon className='h-4 w-4' iconName='ChevronDownIcon' />
          </button>
        </div>
        <div className={cn('border-b px-4', mediaModalBorder)}>
          {user ? (
            <Input
              reply
              compactReply
              focusSignal={replyFocusRequest}
              parent={{ id: tweet.id, username: tweet.user.username }}
            />
          ) : (
            <Link
              href='/'
              className='block py-4 font-bold text-main-accent hover:underline'
            >
              Sign in to reply
            </Link>
          )}
        </div>
        {loading ? (
          <Loading className='my-5' />
        ) : repliesData?.length ? (
          repliesData.map((reply) => (
            <ConversationTweet tweet={reply} key={reply.id} />
          ))
        ) : (
          <div className='h-20' />
        )}
      </div>
    </aside>
  );
}

function ConversationTweet({
  tweet,
  root,
  onReply
}: ConversationTweetProps): JSX.Element {
  const {
    id,
    text,
    images,
    card,
    quotedTweet,
    parent,
    createdBy,
    createdAt,
    threadMuted,
    user
  } = tweet;

  const { user: authUser } = useAuth();
  const { hideBskySocialSuffix } = useTheme();

  const { id: ownerId, name, username, verified, photoURL } = user;
  const userId = authUser?.id as string;
  const isOwner = userId === createdBy;
  const tweetLink = getTweetPath(id, username);
  const hasInlineMedia = !!images?.length;
  const displayCard = hasInlineMedia ? null : card;
  const parentDisplayUsername = formatAtprotoDisplayIdentifier(
    parent?.username,
    { hideBskySocialSuffix }
  );

  if (root)
    return (
      <article
        className={cn(
          'relative border-b px-4 pt-3 text-[15px]',
          mediaModalBorder
        )}
      >
        <div className='flex min-w-0 gap-3 pr-10'>
          <UserAvatar
            className='mt-0.5'
            size={40}
            src={photoURL}
            alt={name}
            username={username}
          />
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col leading-5',
              mediaModalSecondaryText
            )}
          >
            <UserName
              name={name}
              username={username}
              verified={verified}
              className={mediaModalPrimaryText}
            />
            <UserUsername
              className={cn('block leading-5', mediaModalSecondaryText)}
              username={username}
            />
          </div>
        </div>
        <TweetActions
          isOwner={isOwner}
          ownerId={ownerId}
          tweetId={id}
          parentId={parent?.id}
          parentUsername={parent?.username}
          username={username}
          hasImages={!!images || !!card || !!quotedTweet}
          createdBy={createdBy}
          viewTweet
          threadMuted={threadMuted}
        />
        {parent && (
          <p className={cn('mt-3', mediaModalSecondaryText)}>
            Replying to{' '}
            <Link
              href={getUserPath(parent.username)}
              className='custom-underline text-main-accent'
            >
              {parentDisplayUsername}
            </Link>
          </p>
        )}
        {text && (
          <TweetText
            className='mt-3 min-w-0 leading-5 [overflow-wrap:anywhere]'
            text={text}
          />
        )}
        <Link
          href={tweetLink}
          className={cn(
            'custom-underline mt-4 block text-[15px] leading-5',
            mediaModalSecondaryText
          )}
        >
          {formatDate(createdAt, 'full')}· Twitter Web App
        </Link>
        <MediaTweetStatsRow tweet={tweet} />
        <ConversationActionBar tweet={tweet} root={root} onReply={onReply} />
      </article>
    );

  return (
    <article
      className={cn(
        'relative border-b px-4 text-[15px]',
        mediaModalBorder,
        root ? 'pt-3 pb-0' : 'hover-card py-3 duration-200'
      )}
    >
      <div className='grid grid-cols-[auto_minmax(0,1fr)] gap-3'>
        <UserAvatar
          className='mt-0.5'
          size={40}
          src={photoURL}
          alt={name}
          username={username}
        />
        <div className={cn('min-w-0', root ? 'pr-0' : 'pr-8')}>
          <div
            className={cn(
              'min-w-0',
              mediaModalSecondaryText,
              root ? 'flex flex-col' : 'flex flex-wrap items-center gap-x-1'
            )}
          >
            <UserName
              name={name}
              username={username}
              verified={verified}
              className={mediaModalPrimaryText}
            />
            <div className='flex min-w-0 items-center gap-1'>
              <UserUsername
                className={mediaModalSecondaryText}
                username={username}
              />
              {!root && (
                <>
                  <i>·</i>
                  <Link
                    href={tweetLink}
                    className='custom-underline whitespace-nowrap'
                  >
                    {formatDate(createdAt, 'tweet')}
                  </Link>
                </>
              )}
            </div>
          </div>
          {parent && (
            <p className={cn('mt-1', mediaModalSecondaryText)}>
              Replying to{' '}
              <Link
                href={getUserPath(parent.username)}
                className='custom-underline text-main-accent'
              >
                {parentDisplayUsername}
              </Link>
            </p>
          )}
          {text && (
            <TweetText
              className={cn(
                'min-w-0 [overflow-wrap:anywhere]',
                root ? 'mt-3 text-[15px] leading-5' : 'mt-1'
              )}
              text={text}
            />
          )}
          {!root && <ConversationAttachments images={images} />}
          {!root && (
            <TweetEmbed
              text={text}
              hasMedia={!!images?.length}
              card={displayCard}
              quotedTweet={quotedTweet}
              articleTweetPath={tweetLink}
            />
          )}
          {root && (
            <Link
              href={tweetLink}
              className={cn(
                'custom-underline mt-3 block text-[15px]',
                mediaModalSecondaryText
              )}
            >
              {formatDate(createdAt, 'full')}
            </Link>
          )}
          <ConversationActionBar tweet={tweet} root={root} onReply={onReply} />
        </div>
      </div>
      {!root && (
        <TweetActions
          isOwner={isOwner}
          ownerId={ownerId}
          tweetId={id}
          parentId={parent?.id}
          parentUsername={parent?.username}
          username={username}
          hasImages={!!images || !!card || !!quotedTweet}
          createdBy={createdBy}
          threadMuted={threadMuted}
        />
      )}
    </article>
  );
}

function MediaTweetStatsRow({ tweet }: { tweet: TweetWithUser }): JSX.Element {
  return (
    <ViewTweetStats
      media
      tweetId={tweet.id}
      username={tweet.user.username}
      currentQuotes={tweet.userQuotes}
      currentTweets={tweet.userRetweets.length}
      currentLikes={tweet.userLikes.length}
      currentReplies={0}
      quoteMove={0}
      tweetMove={0}
      likeMove={0}
      replyMove={0}
      isStatsVisible
    />
  );
}

function ConversationAttachments({
  images
}: Pick<TweetWithUser, 'images'>): JSX.Element | null {
  if (!images?.length) return null;

  const previewCount = images.length;

  return (
    <div
      className={cn(
        'mt-2 grid overflow-hidden rounded-2xl border bg-black',
        mediaModalBorder,
        previewCount === 1 ? 'grid-cols-1' : 'grid-cols-2',
        previewCount > 2 && 'grid-rows-2'
      )}
    >
      {images.slice(0, 4).map((media, index) => {
        const isGif = isGifMedia(media);
        const isVideo = isVideoMedia(media) && !isGif;
        const altText = getMediaAltText(media);

        return (
          <div
            className={cn(
              'relative overflow-hidden border-black/60 bg-black',
              previewCount === 1 ? 'h-44' : 'h-28',
              previewCount === 3 && index === 0 && 'row-span-2 h-full'
            )}
            key={media.id}
          >
            {isGif ? (
              <TwitterGifMedia media={media} className='h-full w-full' />
            ) : isVideo ? (
              <TwitterVideoPlayer
                className='h-full w-full'
                src={media.src}
                poster={media.poster}
                compact
                viewCount={media.viewCount}
              />
            ) : (
              <img
                className='h-full w-full object-cover'
                src={media.src}
                alt={altText || media.alt}
                draggable={false}
              />
            )}
            {altText && !isGif && (
              <span
                className='absolute bottom-0 left-0 m-1.5 rounded-md bg-black/70 px-2 py-0.5
                           text-[12px] font-extrabold leading-4 text-white'
              >
                ALT
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConversationActionBar({
  tweet,
  root,
  onReply,
  mediaOnly
}: ConversationActionBarProps): JSX.Element {
  const { push } = useRouter();
  const { user, userBookmarks } = useAuth();

  const {
    optimisticIds: optimisticLikes,
    active: tweetIsLiked,
    applyOptimisticActive: applyOptimisticLike,
    rollbackOptimisticIds: rollbackOptimisticLikes
  } = useOptimisticReactionIds(tweet.userLikes, user?.id);
  const {
    optimisticIds: optimisticRetweets,
    active: tweetIsRetweeted,
    applyOptimisticActive: applyOptimisticRetweet,
    rollbackOptimisticIds: rollbackOptimisticRetweets
  } = useOptimisticReactionIds(tweet.userRetweets, user?.id);
  const [optimisticBookmarked, setOptimisticBookmarked] = useState(
    !!userBookmarks?.some(({ id }) => id === tweet.id)
  );
  const [optimisticBookmarkCount, setOptimisticBookmarkCount] = useState(
    Math.max(tweet.bookmarkCount, optimisticBookmarked ? 1 : 0)
  );
  const [updatingLike, setUpdatingLike] = useState(false);
  const [updatingRetweet, setUpdatingRetweet] = useState(false);
  const [updatingBookmark, setUpdatingBookmark] = useState(false);

  const userId = user?.id as string | undefined;
  const visibleRetweets = optimisticRetweets.length + tweet.userQuotes;

  useEffect(() => {
    const bookmarked = !!userBookmarks?.some(({ id }) => id === tweet.id);

    setOptimisticBookmarked(bookmarked);
    setOptimisticBookmarkCount(
      Math.max(tweet.bookmarkCount, bookmarked ? 1 : 0)
    );
  }, [tweet.bookmarkCount, tweet.id, userBookmarks]);

  const openReplyTarget = (): void => {
    void push(getTweetPath(tweet.id, tweet.user.username));
  };

  const handleShare = async (): Promise<void> => {
    const url =
      getBskyTweetUrl(tweet.id, tweet.user.username) ??
      `${siteURL}${getTweetPath(tweet.id, tweet.user.username)}`;

    try {
      if (navigator.share) await navigator.share({ url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Copied to clipboard');
      }
    } catch {
      // Native share can reject when the user dismisses the sheet.
    }
  };

  const handleRetweet = async (): Promise<void> => {
    if (!userId) {
      void push('/');
      return;
    }

    if (updatingRetweet) return;

    const shouldRetweet = !tweetIsRetweeted;
    const previousRetweets = optimisticRetweets;

    setUpdatingRetweet(true);
    applyOptimisticRetweet(shouldRetweet);

    try {
      await manageRetweet(
        shouldRetweet ? 'retweet' : 'unretweet',
        userId,
        tweet.id
      )();
    } catch {
      rollbackOptimisticRetweets(previousRetweets);
      toast.error('Tweet could not be retweeted');
    } finally {
      setUpdatingRetweet(false);
    }
  };

  const handleLike = async (): Promise<void> => {
    if (!userId) {
      void push('/');
      return;
    }

    if (updatingLike) return;

    const shouldLike = !tweetIsLiked;
    const previousLikes = optimisticLikes;

    setUpdatingLike(true);
    applyOptimisticLike(shouldLike);

    try {
      await manageLike(shouldLike ? 'like' : 'unlike', userId, tweet.id)();
    } catch {
      rollbackOptimisticLikes(previousLikes);
      toast.error('Tweet could not be liked');
    } finally {
      setUpdatingLike(false);
    }
  };

  const handleBookmark = async (): Promise<void> => {
    if (!userId) {
      void push('/');
      return;
    }

    if (updatingBookmark) return;

    const shouldBookmark = !optimisticBookmarked;
    const previousBookmarked = optimisticBookmarked;
    const previousBookmarkCount = optimisticBookmarkCount;

    setUpdatingBookmark(true);
    setOptimisticBookmarked(shouldBookmark);
    setOptimisticBookmarkCount((currentCount) =>
      Math.max(0, currentCount + (shouldBookmark ? 1 : -1))
    );

    try {
      await manageBookmark(
        shouldBookmark ? 'bookmark' : 'unbookmark',
        userId,
        tweet.id
      );
      toast.success(
        shouldBookmark
          ? 'Tweet added to your Bookmarks'
          : 'Tweet removed from your Bookmarks'
      );
    } catch {
      setOptimisticBookmarked(previousBookmarked);
      setOptimisticBookmarkCount(previousBookmarkCount);
      toast.error('Tweet could not be bookmarked');
    } finally {
      setUpdatingBookmark(false);
    }
  };

  return (
    <div
      className={cn(
        'flex',
        mediaOnly
          ? `pointer-events-auto absolute inset-x-0 bottom-0 z-20 items-center
             justify-between bg-linear-to-t from-black via-black/80 to-transparent
             px-7 pb-5 pt-12 text-white lg:hidden`
          : cn(
              mediaModalSecondaryText,
              root
                ? cn(
                    'mt-3 justify-between border-t px-1 py-1.5',
                    mediaModalBorder
                  )
                : 'mt-2 max-w-md justify-between'
            )
      )}
    >
      <ConversationActionButton
        tip='Reply'
        iconName='TwitterReplyIcon'
        count={tweet.userReplies}
        root={mediaOnly ? true : root}
        className='hover:text-accent-blue focus-visible:text-accent-blue'
        iconClassName='group-hover:bg-accent-blue/10 group-active:bg-accent-blue/20 group-focus-visible:bg-accent-blue/10'
        countClassName={mediaOnly ? 'text-white' : undefined}
        onClick={onReply ?? openReplyTarget}
      />
      <ConversationActionButton
        tip={tweetIsRetweeted ? 'Undo Retweet' : 'Retweet'}
        iconName='TwitterRetweetIcon'
        count={visibleRetweets}
        active={tweetIsRetweeted}
        root={mediaOnly ? true : root}
        className='hover:text-accent-green focus-visible:text-accent-green'
        iconClassName='group-hover:bg-accent-green/10 group-active:bg-accent-green/20 group-focus-visible:bg-accent-green/10'
        countClassName={mediaOnly ? 'text-white' : undefined}
        onClick={handleRetweet}
      />
      <ConversationActionButton
        tip={tweetIsLiked ? 'Unlike' : 'Like'}
        iconName={tweetIsLiked ? 'TwitterLikeFilledIcon' : 'TwitterLikeIcon'}
        count={optimisticLikes.length}
        active={tweetIsLiked}
        root={mediaOnly ? true : root}
        actionEffect='like'
        className='hover:text-accent-pink focus-visible:text-accent-pink'
        iconClassName='group-hover:bg-accent-pink/10 group-active:bg-accent-pink/20 group-focus-visible:bg-accent-pink/10'
        countClassName={mediaOnly ? 'text-white' : undefined}
        onClick={handleLike}
      />
      {mediaOnly ? (
        <ConversationActionButton
          tip='Share'
          iconName='TwitterShareIcon'
          root
          className='hover:text-accent-blue focus-visible:text-accent-blue'
          iconClassName='group-hover:bg-accent-blue/10 group-active:bg-accent-blue/20 group-focus-visible:bg-accent-blue/10'
          onClick={handleShare}
        />
      ) : (
        <>
          <ConversationActionButton
            tip={optimisticBookmarked ? 'Remove from Bookmarks' : 'Bookmark'}
            iconName={
              optimisticBookmarked
                ? 'TwitterBookmarksFilledIcon'
                : 'TwitterBookmarksIcon'
            }
            count={optimisticBookmarkCount}
            active={optimisticBookmarked}
            root={root}
            className='hover:text-main-accent focus-visible:text-main-accent'
            iconClassName='group-hover:bg-main-accent/10 group-active:bg-main-accent/20 group-focus-visible:bg-main-accent/10'
            onClick={!updatingBookmark ? handleBookmark : undefined}
          />
          <TweetShare
            tweetId={tweet.id}
            username={tweet.user.username}
            viewTweet={root}
          />
        </>
      )}
    </div>
  );
}

function ConversationActionButton({
  tip,
  iconName,
  count,
  active,
  root,
  className,
  iconClassName,
  actionEffect,
  countClassName,
  onClick
}: ConversationActionButtonProps): JSX.Element {
  const [effectPlayKey, setEffectPlayKey] = useState(0);
  const activeClassName =
    iconName === 'TwitterRetweetIcon'
      ? 'text-accent-green'
      : iconName === 'TwitterLikeFilledIcon' || iconName === 'TwitterLikeIcon'
        ? 'text-accent-pink'
        : iconName === 'TwitterBookmarksIcon' ||
            iconName === 'TwitterBookmarksFilledIcon'
          ? 'text-main-accent'
          : null;
  const iconClassNameBySize = root
    ? 'h-[22.5px] w-[22.5px]'
    : 'h-[18.75px] w-[18.75px]';

  const handleClick = (): void => {
    if (actionEffect === 'like' && !active)
      setEffectPlayKey((currentKey) => currentKey + 1);

    if (onClick) void onClick();
  };

  return (
    <button
      className={cn(
        `tweet-action-button group flex items-center p-0 outline-none transition-colors
         duration-200 ease-out inner:transition-colors inner:duration-200
         inner:ease-out`,
        active && activeClassName,
        className
      )}
      aria-label={tip}
      onClick={preventBubbling(handleClick)}
    >
      <i
        className={cn(
          `tweet-action-icon-shell relative rounded-full not-italic
           group-focus-visible:ring-2`,
          root
            ? 'tweet-action-icon-shell--large'
            : 'tweet-action-icon-shell--normal',
          iconClassName
        )}
      >
        {actionEffect ? (
          <TweetActionEffect
            kind={actionEffect}
            active={active}
            playKey={effectPlayKey}
          >
            <AppIcon className={iconClassNameBySize} iconName={iconName} />
          </TweetActionEffect>
        ) : (
          <AppIcon className={iconClassNameBySize} iconName={iconName} />
        )}
      </i>
      {!!count && (
        <span
          className={cn(
            `tweet-action-count-static -ml-1.5 min-w-[10px] text-left
             text-[13px] leading-4`,
            countClassName ?? (root && mediaModalSecondaryText)
          )}
        >
          {formatNumber(count)}
        </span>
      )}
    </button>
  );
}

export function ImageModal({
  tweet,
  imageData,
  previewCount,
  profileMediaKind,
  tweetData,
  selectedIndex,
  handleNextIndex,
  closeModal
}: ImageModalProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const loadedIndexes = useRef<Set<number>>(new Set());
  const previousSelectedIndex = useRef(selectedIndex ?? 0);
  const [mediaDirection, setMediaDirection] = useState(1);

  const { src, alt } = imageData;

  const isVideo = isVideoMedia(imageData);
  const altText = getMediaAltText(imageData);

  const requireArrows = handleNextIndex && previewCount > 1;

  useEffect(() => {
    if (selectedIndex === undefined) return;

    const previousIndex = previousSelectedIndex.current;

    if (previousIndex !== selectedIndex) {
      const lastIndex = previewCount - 1;
      const nextDirection =
        previousIndex === lastIndex && selectedIndex === 0
          ? 1
          : previousIndex === 0 && selectedIndex === lastIndex
            ? -1
            : selectedIndex > previousIndex
              ? 1
              : -1;

      setMediaDirection(nextDirection);
      previousSelectedIndex.current = selectedIndex;
    }
  }, [previewCount, selectedIndex]);

  useEffect(() => {
    let cancelled = false;
    let loadingTimer: ReturnType<typeof setTimeout> | null = null;
    const newTweetMedia =
      tweet &&
      selectedIndex !== undefined &&
      !loadedIndexes.current.has(selectedIndex);

    const handleLoadingCompleted = (): void => {
      if (cancelled) return;
      if (loadingTimer) clearTimeout(loadingTimer);
      setLoading(false);
    };

    if (newTweetMedia) {
      loadedIndexes.current.add(selectedIndex as number);

      loadingTimer = setTimeout(() => {
        if (!cancelled) setLoading(true);
      }, 120);
    } else if (tweet) setLoading(false);
    else setLoading(true);

    if (isVideo) {
      handleLoadingCompleted();
      return () => {
        cancelled = true;
        if (loadingTimer) clearTimeout(loadingTimer);
      };
    }

    const media = new Image();

    media.onload = handleLoadingCompleted;
    media.onerror = handleLoadingCompleted;
    media.src = src;

    if (media.complete) handleLoadingCompleted();

    return () => {
      cancelled = true;
      if (loadingTimer) clearTimeout(loadingTimer);
    };
  }, [isVideo, selectedIndex, src, tweet]);

  useEffect(() => {
    if (!requireArrows) return;

    const handleKeyDown = ({ key }: KeyboardEvent): void => {
      const callback =
        key === 'ArrowLeft'
          ? handleNextIndex('prev')
          : key === 'ArrowRight'
            ? handleNextIndex('next')
            : null;

      if (callback) callback();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleNextIndex]);

  if (profileMediaKind)
    return (
      <ProfileFullscreenImageModal
        imageData={imageData}
        profileMediaKind={profileMediaKind}
        loading={loading}
        closeModal={closeModal}
      />
    );

  if (tweetData)
    return (
      <FullscreenImageModal
        imageData={imageData}
        tweetData={tweetData}
        previewCount={previewCount}
        selectedIndex={selectedIndex}
        loading={loading}
        mediaDirection={mediaDirection}
        handleNextIndex={handleNextIndex}
        closeModal={closeModal}
      />
    );

  return (
    <>
      {requireArrows &&
        arrowButtons.map(([name, className, iconName]) => (
          <Button
            className={cn(
              `absolute z-10 hover:bg-light-primary/10 active:bg-light-primary/20
               dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20`,
              name === 'prev' ? 'left-2' : 'right-2',
              className
            )}
            onClick={preventBubbling(handleNextIndex(name))}
            key={name}
          >
            <HeroIcon iconName={iconName} />
          </Button>
        ))}
      <AnimatePresence mode='wait'>
        {loading ? (
          <motion.div
            className='mx-auto'
            {...mediaFade}
            exit={tweet ? (mediaFade.exit as TargetAndTransition) : undefined}
          >
            <Loading iconClassName='w-20 h-20' />
          </motion.div>
        ) : (
          <motion.div className='relative mx-auto' {...mediaFade} key={src}>
            {isVideo ? (
              <div className='group relative flex h-[75vh] w-[80vw] max-w-3xl md:h-[80vh]'>
                <TwitterVideoPlayer
                  className={cn('rounded-md', loading ? 'hidden' : 'block')}
                  src={src}
                  poster={imageData.poster}
                  autoPlay
                  muted={false}
                  viewCount={imageData.viewCount}
                  objectFit='contain'
                />
              </div>
            ) : (
              <picture className='group relative flex max-w-3xl'>
                <source srcSet={src} type='image/*' />
                <img
                  className='max-h-[75vh] rounded-md object-contain md:max-h-[80vh]'
                  src={src}
                  alt={altText || alt}
                  onClick={preventBubbling()}
                />
                {altText && (
                  <span
                    className='trim-alt accent-tab absolute bottom-0 right-0 mx-2 mb-2
                             rounded-md bg-main-background/40 px-2 py-1 text-sm font-bold text-light-primary/80 opacity-0
                             transition-colors
                             group-hover:opacity-100 dark:text-dark-primary/80'
                  >
                    {altText}
                  </span>
                )}
              </picture>
            )}
            <a
              className='custom-underline absolute left-0 -bottom-7 font-medium text-light-primary/80
                         decoration-transparent underline-offset-2 transition hover:text-light-primary hover:underline
                         hover:decoration-light-primary focus-visible:text-light-primary dark:text-dark-primary/80 
                         dark:hover:text-dark-primary dark:hover:decoration-dark-primary dark:focus-visible:text-dark-primary'
              href={src}
              target='_blank'
              rel='noreferrer'
              onClick={preventBubbling(null, true)}
            >
              Open original
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
