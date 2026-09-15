import Link from 'next/link';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { motion } from 'framer-motion';
import cn from 'clsx';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { useModal } from '@lib/hooks/useModal';
import { getTweetPath, getUserPath } from '@lib/routes';
import { Modal } from '@components/modal/modal';
import { TweetReplyModal } from '@components/modal/tweet-reply-modal';
import { ImagePreview } from '@components/input/image-preview';
import { FollowButton } from '@components/ui/follow-button';
import { UserAvatar } from '@components/user/user-avatar';
import { UserTooltip } from '@components/user/user-tooltip';
import { UserName } from '@components/user/user-name';
import { UserUsername } from '@components/user/user-username';
import { variants } from '@components/tweet/tweet';
import { TweetActions } from '@components/tweet/tweet-actions';
import { TweetEmbed } from '@components/tweet/tweet-embed';
import { TweetStats } from '@components/tweet/tweet-stats';
import { TweetText } from '@components/tweet/tweet-text';
import { TweetDate } from '@components/tweet/tweet-date';
import { TweetReplyRestrictionConversationNotice } from '@components/tweet/tweet-reply-restriction';
import {
  TweetTombstone,
  isViewableTweetTombstoneKind
} from '@components/tweet/tweet-tombstone';
import { Input } from '@components/input/input';
import type { RefObject } from 'react';
import type { User } from '@lib/types/user';
import type { Tweet, TweetWithUser } from '@lib/types/tweet';

type ViewTweetProps = Tweet & {
  user: User;
  viewTweetRef?: RefObject<HTMLElement | null>;
  onReplySent?: (tweet: TweetWithUser) => void;
};

export function ViewTweet(tweet: ViewTweetProps): JSX.Element {
  const {
    id: tweetId,
    text,
    images,
    mediaWarning,
    card,
    quotedTweet,
    parent,
    userLikes,
    createdBy,
    createdAt,
    bookmarkCount,
    userRetweets,
    userReplies,
    userQuotes = 0,
    tombstone,
    replySetting,
    viewerCanReply,
    threadMuted,
    viewTweetRef,
    user: tweetUserData,
    onReplySent
  } = tweet;

  const { id: ownerId, name, username, verified, photoURL } = tweetUserData;

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
  const mutedAccountTombstone: Tweet['tombstone'] =
    !isOwner && (tweetUserData.muting || tweetUserData.mutingByListName)
      ? 'muted-account'
      : null;
  const tweetTombstoneKind: Tweet['tombstone'] =
    tombstone ?? mutedAccountTombstone;
  const tweetIsHiddenByTombstone = !!tweetTombstoneKind && !tombstoneRevealed;

  const reply = !!parent;

  const { id: parentId, username: parentUsername = username } = parent ?? {};
  const parentDisplayUsername = formatAtprotoDisplayIdentifier(parentUsername, {
    hideBskySocialSuffix
  });

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

  const handleQuoteTweetSent = useCallback((): void => {
    setOptimisticQuoteCount((count) => count + 1);
  }, []);

  if (tweetIsHiddenByTombstone)
    return (
      <motion.article
        className='border-b border-light-border px-4 py-3 dark:border-dark-border'
        {...variants}
        animate={{ ...variants.animate, transition: { duration: 0.2 } }}
        exit={undefined}
        ref={viewTweetRef}
      >
        <TweetTombstone
          kind={tweetTombstoneKind}
          onView={
            isViewableTweetTombstoneKind(tweetTombstoneKind)
              ? (): void => setTombstoneRevealed(true)
              : undefined
          }
        />
      </motion.article>
    );

  return (
    <motion.article
      className={cn(
        `accent-tab h- relative flex cursor-default flex-col gap-3 border-b
         border-light-border px-4 py-3 outline-none dark:border-dark-border`,
        reply && 'scroll-m-[3.25rem] pt-0'
      )}
      {...variants}
      animate={{ ...variants.animate, transition: { duration: 0.2 } }}
      exit={undefined}
      ref={viewTweetRef}
    >
      <Modal
        className='flex items-start justify-center'
        modalClassName='bg-main-background rounded-2xl max-w-[600px] w-full mt-8 max-h-[90dvh] overflow-y-auto'
        open={open}
        closeModal={closeModal}
      >
        <TweetReplyModal
          tweet={tweet}
          closeModal={closeModal}
          onReplySent={handleReplySent}
        />
      </Modal>
      <div className='flex flex-col gap-2'>
        {reply && (
          <div className='flex w-12 items-center justify-center'>
            <i className='hover-animation h-2 w-0.5 bg-light-line-reply dark:bg-dark-line-reply' />
          </div>
        )}
        <div className='grid grid-cols-[auto_minmax(0,1fr)] gap-3'>
          <UserTooltip avatar {...tweetUserData}>
            <UserAvatar src={photoURL} alt={name} username={username} />
          </UserTooltip>
          <div className='flex min-w-0 justify-between'>
            <div className='flex flex-col truncate xs:overflow-visible xs:whitespace-normal'>
              <UserTooltip {...tweetUserData}>
                <UserName
                  className='-mb-1'
                  name={name}
                  username={username}
                  verified={verified}
                />
              </UserTooltip>
              <UserTooltip {...tweetUserData}>
                <UserUsername username={username} />
              </UserTooltip>
            </div>
            <div className='flex shrink-0 items-start gap-2 pl-3'>
              <FollowButton
                userTargetId={ownerId}
                userTargetUsername={username}
                userTargetFollowers={tweetUserData.followers}
                userTargetFollowing={tweetUserData.following}
                userTargetBlocking={tweetUserData.blocking}
                userTargetBlockedBy={tweetUserData.blockedBy}
                userTargetBlockingByListName={tweetUserData.blockingByListName}
              />
              <TweetActions
                viewTweet
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
            </div>
          </div>
        </div>
      </div>
      {reply && (
        <p className='text-light-secondary dark:text-dark-secondary'>
          Replying to{' '}
          <Link
            href={getUserPath(parentUsername)}
            className='custom-underline text-main-accent'
          >
            {parentDisplayUsername}
          </Link>
        </p>
      )}
      <div>
        {text && (
          <TweetText className='tweet-detail-display-font-size' text={text} />
        )}
        {images && (
          <ImagePreview
            viewTweet
            tweetData={tweet}
            imagesPreview={images}
            previewCount={images.length}
            moderationWarning={mediaWarning}
          />
        )}
        <TweetEmbed
          text={text}
          hasMedia={!!images?.length}
          card={displayCard}
          quotedTweet={quotedTweet}
          viewTweet
          articleAuthor={tweetUserData}
          articleTweetPath={tweetLink}
        />
        <div
          className='inner:hover-animation inner:border-b inner:border-light-border
                     dark:inner:border-dark-border'
        >
          <TweetDate viewTweet tweetLink={tweetLink} createdAt={createdAt} />
          <TweetStats
            viewTweet
            userId={userId}
            tweetId={tweetId}
            username={username}
            quoteTweet={tweet}
            userLikes={userLikes}
            bookmarkCount={bookmarkCount}
            userRetweets={userRetweets}
            userReplies={optimisticReplyCount}
            userQuotes={optimisticQuoteCount}
            openModal={openModal}
            viewerCanReply={viewerCanReply}
            onQuoteTweetSent={handleQuoteTweetSent}
          />
          <TweetReplyRestrictionConversationNotice
            replySetting={replySetting}
            viewerCanReply={viewerCanReply}
            username={username}
          />
        </div>
        {user && viewerCanReply !== false && (
          <Input
            reply
            parent={{ id: tweetId, username: username }}
            onTweetSent={handleReplySent}
          />
        )}
      </div>
    </motion.article>
  );
}
