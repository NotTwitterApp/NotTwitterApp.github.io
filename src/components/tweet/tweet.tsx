import Link from 'next/link';
import { useRouter } from 'next/router';
import { memo, useCallback, useEffect, useState, type JSX } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { useModal } from '@lib/hooks/useModal';
import { getTweetPath, getUserPath } from '@lib/routes';
import { delayScroll } from '@lib/utils';
import { Modal } from '@components/modal/modal';
import { TweetReplyModal } from '@components/modal/tweet-reply-modal';
import { ImagePreview } from '@components/input/image-preview';
import { UserAvatar } from '@components/user/user-avatar';
import { UserTooltip } from '@components/user/user-tooltip';
import { UserName } from '@components/user/user-name';
import { UserUsername } from '@components/user/user-username';
import { TweetActions } from './tweet-actions';
import { TweetEmbed } from './tweet-embed';
import { TweetStatus } from './tweet-status';
import { TweetStats } from './tweet-stats';
import { TweetDate } from './tweet-date';
import { TweetText } from './tweet-text';
import { TweetTranslation } from './tweet-translation';
import { TweetReplyRestrictionIndicator } from './tweet-reply-restriction';
import {
  TweetTombstone,
  isViewableTweetTombstoneKind
} from './tweet-tombstone';
import type { Variants } from 'framer-motion';
import type { KeyboardEvent, MouseEvent } from 'react';
import type {
  Tweet as TweetData,
  TweetTombstoneKind,
  TweetWithUser
} from '@lib/types/tweet';
import type { User } from '@lib/types/user';

export type TweetProps = TweetData & {
  user: User;
  modal?: boolean;
  pinned?: boolean;
  profile?: User | null;
  parentTweet?: boolean;
  conversationTweet?: boolean;
  onReplySent?: (tweet: TweetWithUser) => void;
  onTweetSent?: (tweet: TweetWithUser) => void;
};

export const variants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: 'easeOut' } }
};

const interactiveTweetChildSelector =
  'a, button, input, select, textarea, [role="button"]';

function eventStartedInInteractiveTweetChild(
  target: EventTarget | null,
  currentTarget: HTMLElement
): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const interactiveChild = target.closest(interactiveTweetChildSelector);

  return !!interactiveChild && interactiveChild !== currentTarget;
}

function ThreadRail({ className }: { className?: string }): JSX.Element {
  return (
    <div className={cn('flex w-10 justify-center', className)}>
      <i className='h-full w-0.5 bg-light-line-reply dark:bg-dark-line-reply' />
    </div>
  );
}

function BlockedTweetPlaceholder({
  unavailable,
  tombstoneKind,
  onView,
  parentTweet,
  conversationTweet
}: {
  unavailable?: TweetData['unavailable'];
  tombstoneKind?: TweetTombstoneKind | null;
  onView?: () => void;
  parentTweet?: boolean;
  conversationTweet?: boolean;
}): JSX.Element {
  const isConversationTweet = !!parentTweet || !!conversationTweet;
  const resolvedTombstoneKind =
    tombstoneKind ??
    (unavailable === 'not-found' || unavailable === 'unknown'
      ? 'unavailable'
      : 'limited-visibility');
  const tombstone = (
    <TweetTombstone
      kind={resolvedTombstoneKind}
      onView={
        isViewableTweetTombstoneKind(resolvedTombstoneKind) ? onView : undefined
      }
    />
  );

  return (
    <motion.article
      {...variants}
      className={cn(
        'px-4',
        isConversationTweet ? 'py-2.5' : 'py-3',
        !parentTweet && 'border-b border-light-border dark:border-dark-border'
      )}
    >
      {parentTweet ? (
        <div className='flex flex-col'>{tombstone}</div>
      ) : (
        tombstone
      )}
    </motion.article>
  );
}

function TweetComponent(tweet: TweetProps): JSX.Element {
  const {
    id: tweetId,
    text,
    langs = [],
    modal,
    images,
    mediaWarning,
    card,
    quotedTweet,
    parent,
    pinned,
    profile,
    userLikes,
    createdBy,
    createdAt,
    bookmarkCount,
    parentTweet,
    conversationTweet,
    userReplies,
    userQuotes = 0,
    userRetweets,
    tombstone,
    replySetting,
    viewerCanReply,
    unavailable,
    threadMuted,
    user: tweetUserData,
    onReplySent,
    onTweetSent
  } = tweet;

  const { id: ownerId, name, username, verified, photoURL } = tweetUserData;

  const router = useRouter();
  const { user } = useAuth();
  const { hideBskySocialSuffix } = useTheme();

  const { open, openModal, closeModal } = useModal();
  const [optimisticReplyCount, setOptimisticReplyCount] = useState(userReplies);
  const [optimisticQuoteCount, setOptimisticQuoteCount] = useState(userQuotes);
  const [tombstoneRevealed, setTombstoneRevealed] = useState(false);

  const tweetLink = getTweetPath(tweetId, username);
  const displayCard = card;

  const userId = user?.id ?? '';

  const isOwner = userId === createdBy;
  const mutedAccountTombstone: TweetData['tombstone'] =
    !isOwner && (tweetUserData.muting || tweetUserData.mutingByListName)
      ? 'muted-account'
      : null;
  const tweetTombstoneKind: TweetData['tombstone'] =
    tombstone ?? mutedAccountTombstone;
  const tweetIsHiddenByBlock =
    !!unavailable ||
    (!isOwner && (tweetUserData.blocking || tweetUserData.blockedBy));
  const tweetIsHiddenByTombstone = !!tweetTombstoneKind && !tombstoneRevealed;

  const { id: parentId, username: parentUsername = username } = parent ?? {};
  const parentDisplayUsername = formatAtprotoDisplayIdentifier(parentUsername, {
    hideBskySocialSuffix
  });

  const {
    id: profileId,
    name: profileName,
    username: profileUsername
  } = profile ?? {};

  const reply = !!parent;
  const tweetIsRetweeted = userRetweets.includes(profileId ?? '');

  useEffect(() => {
    setOptimisticReplyCount(userReplies);
  }, [userReplies]);

  useEffect(() => {
    setOptimisticQuoteCount(userQuotes);
  }, [userQuotes]);

  useEffect(() => {
    setTombstoneRevealed(false);
  }, [
    tweetId,
    tombstone,
    tweetUserData.muting,
    tweetUserData.mutingByListName
  ]);

  const handleReplySent = useCallback(
    (replyTweet: TweetWithUser): void => {
      setOptimisticReplyCount((count) => count + 1);
      onReplySent?.(replyTweet);
    },
    [onReplySent]
  );

  const handleQuoteTweetSent = useCallback(
    (quoteTweet: TweetWithUser): void => {
      setOptimisticQuoteCount((count) => count + 1);
      onTweetSent?.(quoteTweet);
    },
    [onTweetSent]
  );

  const openTweet = (): void => {
    void router.push(tweetLink, undefined, { scroll: !reply });
    delayScroll(200)();
  };

  const handleTweetClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (eventStartedInInteractiveTweetChild(event.target, event.currentTarget))
      return;

    openTweet();
  };

  const handleTweetKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter') return;
    if (eventStartedInInteractiveTweetChild(event.target, event.currentTarget))
      return;

    event.preventDefault();
    openTweet();
  };

  if (tweetIsHiddenByBlock)
    return (
      <BlockedTweetPlaceholder
        unavailable={unavailable}
        parentTweet={parentTweet}
        conversationTweet={conversationTweet}
      />
    );

  if (tweetIsHiddenByTombstone)
    return (
      <BlockedTweetPlaceholder
        tombstoneKind={tweetTombstoneKind}
        onView={(): void => setTombstoneRevealed(true)}
        parentTweet={parentTweet}
        conversationTweet={conversationTweet}
      />
    );

  return (
    <motion.article
      {...(!modal ? variants : {})}
      animate={{
        ...variants.animate,
        ...(parentTweet && { transition: { duration: 0.2 } })
      }}
    >
      <Modal
        className='flex items-start justify-center'
        modalClassName='bg-main-background rounded-2xl max-w-[600px] w-full my-8 max-h-[90dvh] overflow-y-auto'
        open={open}
        closeModal={closeModal}
      >
        <TweetReplyModal
          tweet={tweet}
          closeModal={closeModal}
          onReplySent={handleReplySent}
        />
      </Modal>
      <div
        className={cn(
          `accent-tab hover-card relative flex flex-col gap-y-4 px-4 py-3
           outline-none duration-200`,
          parentTweet
            ? 'mt-0.5 pt-2.5 pb-0'
            : 'border-b border-light-border dark:border-dark-border'
        )}
        role='link'
        tabIndex={0}
        draggable={false}
        onClick={handleTweetClick}
        onKeyDown={handleTweetKeyDown}
      >
        <div className='grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1'>
          <AnimatePresence initial={false}>
            {modal ? null : pinned ? (
              <TweetStatus type='pin'>Pinned Tweet</TweetStatus>
            ) : (
              tweetIsRetweeted && (
                <TweetStatus type='tweet'>
                  <Link
                    href={profileUsername ? getUserPath(profileUsername) : '#'}
                    className='custom-underline truncate'
                  >
                    {userId === profileId ? 'You' : profileName} Retweeted
                  </Link>
                </TweetStatus>
              )
            )}
          </AnimatePresence>
          <div className='flex flex-col items-center gap-2'>
            <UserTooltip avatar modal={modal} {...tweetUserData}>
              <UserAvatar src={photoURL} alt={name} username={username} />
            </UserTooltip>
            {parentTweet && <ThreadRail className='h-full' />}
          </div>
          <div className='flex min-w-0 flex-col'>
            <div className='flex justify-between gap-2 text-light-secondary dark:text-dark-secondary'>
              <div className='flex gap-1 truncate xs:overflow-visible xs:whitespace-normal'>
                <UserTooltip modal={modal} {...tweetUserData}>
                  <UserName
                    name={name}
                    username={username}
                    verified={verified}
                    className='text-light-primary dark:text-dark-primary'
                  />
                </UserTooltip>
                <UserTooltip modal={modal} {...tweetUserData}>
                  <UserUsername username={username} />
                </UserTooltip>
                <TweetDate tweetLink={tweetLink} createdAt={createdAt} />
              </div>
              <div className='px-4'>
                {!modal && (
                  <TweetActions
                    isOwner={isOwner}
                    ownerId={ownerId}
                    tweetId={tweetId}
                    parentId={parentId}
                    parentUsername={parentUsername}
                    username={username}
                    hasImages={!!images || !!displayCard || !!quotedTweet}
                    createdBy={createdBy}
                    blocking={tweetUserData.blocking}
                    blockingByListName={tweetUserData.blockingByListName}
                    muting={tweetUserData.muting}
                    mutingByListName={tweetUserData.mutingByListName}
                    threadMuted={threadMuted}
                  />
                )}
              </div>
            </div>
            {(reply || modal) && (
              <p
                className={cn(
                  'text-light-secondary dark:text-dark-secondary',
                  modal && 'order-1 my-2'
                )}
              >
                Replying to{' '}
                <Link
                  href={getUserPath(parentUsername)}
                  className='custom-underline text-main-accent'
                >
                  {parentDisplayUsername}
                </Link>
              </p>
            )}
            {text && (
              <>
                <TweetText text={text} />
                <TweetTranslation text={text} langs={langs} />
              </>
            )}
            <div className='mt-1 flex flex-col gap-2'>
              {!modal && !!images?.length && (
                <ImagePreview
                  tweet
                  tweetData={tweet}
                  imagesPreview={images}
                  previewCount={images.length}
                  moderationWarning={mediaWarning}
                />
              )}
              <TweetEmbed
                text={text}
                hasMedia={!!images?.length}
                contextOnly={modal}
                card={displayCard}
                quotedTweet={quotedTweet}
                articleAuthor={tweetUserData}
                articleTweetPath={tweetLink}
              />
              <TweetReplyRestrictionIndicator
                replySetting={replySetting}
                viewerCanReply={viewerCanReply}
                username={username}
              />
              {!modal && (
                <TweetStats
                  userId={userId}
                  tweetId={tweetId}
                  username={username}
                  quoteTweet={tweet}
                  userLikes={userLikes}
                  bookmarkCount={bookmarkCount}
                  userReplies={optimisticReplyCount}
                  userQuotes={optimisticQuoteCount}
                  userRetweets={userRetweets}
                  viewerCanReply={viewerCanReply}
                  openModal={openModal}
                  onQuoteTweetSent={handleQuoteTweetSent}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export const Tweet = memo(TweetComponent);
Tweet.displayName = 'Tweet';
