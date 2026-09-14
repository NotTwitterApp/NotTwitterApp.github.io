import { memo, useEffect, useMemo, useState, type JSX } from 'react';
import { useRouter } from 'next/router';
import { Popover } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { toast } from 'react-hot-toast';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { useModal } from '@lib/hooks/useModal';
import { tweetsCollection } from '@lib/atproto/collections';
import { doc, getDoc } from '@lib/atproto/store';
import { getTweetPath } from '@lib/routes';
import {
  removeTweet,
  manageBlock,
  manageMute,
  manageReply,
  manageFollow,
  managePinnedTweet,
  manageThreadMute,
  manageTotalTweets,
  manageTotalPhotos,
  reportTweet
} from '@lib/atproto/utils';
import { delayScroll, preventBubbling, sleep } from '@lib/utils';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { ReportModal } from '@components/modal/report-modal';
import { Button } from '@components/ui/button';
import { ToolTip } from '@components/ui/tooltip';
import { HeroIcon } from '@components/ui/hero-icon';
import { CustomIcon } from '@components/ui/custom-icon';
import type { Variants } from 'framer-motion';
import type { Tweet } from '@lib/types/tweet';
import type { ModerationReportReason } from '@lib/atproto/backend';

export const variants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.15, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: 'easeOut' }
  }
};

type TweetActionsProps = Pick<Tweet, 'createdBy' | 'threadMuted'> & {
  isOwner: boolean;
  ownerId: string;
  tweetId: string;
  username: string;
  parentId?: string;
  parentUsername?: string;
  hasImages: boolean;
  blocking?: boolean;
  blockingByListName?: string | null;
  muting?: boolean;
  mutingByListName?: string | null;
  viewTweet?: boolean;
  popoverClassName?: string;
  buttonClassName?: string;
  menuClassName?: string;
};

type PinModalData = Record<'title' | 'description' | 'mainBtnLabel', string>;

const pinModalData: Readonly<PinModalData[]> = [
  {
    title: 'Pin Tweet to from profile?',
    description:
      'This will appear at the top of your profile and replace any previously pinned Tweet.',
    mainBtnLabel: 'Pin'
  },
  {
    title: 'Unpin Tweet from profile?',
    description:
      'This will no longer appear automatically at the top of your profile.',
    mainBtnLabel: 'Unpin'
  }
];

function TweetActionsComponent({
  isOwner,
  ownerId,
  tweetId,
  parentId,
  parentUsername,
  username,
  hasImages,
  blocking,
  blockingByListName,
  muting,
  mutingByListName,
  viewTweet,
  createdBy,
  threadMuted,
  popoverClassName,
  buttonClassName,
  menuClassName
}: TweetActionsProps): JSX.Element {
  const { user, isAdmin } = useAuth();
  const { hideBskySocialSuffix } = useTheme();
  const { push } = useRouter();
  const displayUsername = formatAtprotoDisplayIdentifier(username, {
    hideBskySocialSuffix
  });

  const {
    open: removeOpen,
    openModal: removeOpenModal,
    closeModal: removeCloseModal
  } = useModal();

  const {
    open: pinOpen,
    openModal: pinOpenModal,
    closeModal: pinCloseModal
  } = useModal();
  const {
    open: blockOpen,
    openModal: blockOpenModal,
    closeModal: blockCloseModal
  } = useModal();
  const {
    open: muteOpen,
    openModal: muteOpenModal,
    closeModal: muteCloseModal
  } = useModal();
  const {
    open: reportOpen,
    openModal: reportOpenModal,
    closeModal: reportCloseModal
  } = useModal();

  const { id: userId, following = [], pinnedTweet } = user ?? {};

  const isInAdminControl = isAdmin && !isOwner;
  const tweetIsPinned = pinnedTweet === tweetId;
  const signedIn = !!userId;
  const [optimisticThreadMuted, setOptimisticThreadMuted] =
    useState(!!threadMuted);
  const [updatingThreadMute, setUpdatingThreadMute] = useState(false);

  useEffect(() => {
    setOptimisticThreadMuted(!!threadMuted);
  }, [threadMuted]);

  const handleRemove = async (): Promise<void> => {
    if (viewTweet)
      if (parentId) {
        const parentSnapshot = await getDoc(doc(tweetsCollection, parentId));
        if (parentSnapshot.exists()) {
          await push(getTweetPath(parentId, parentUsername), undefined, {
            scroll: false
          });
          delayScroll(200)();
          await sleep(50);
        } else await push('/home');
      } else await push('/home');

    await Promise.all([
      removeTweet(tweetId),
      manageTotalTweets('decrement', ownerId),
      hasImages && manageTotalPhotos('decrement', createdBy),
      parentId && manageReply('decrement', parentId)
    ]);

    toast.success(
      `${isInAdminControl ? `${displayUsername}'s` : 'Your'} Tweet was deleted`
    );

    removeCloseModal();
  };

  const handlePin = async (): Promise<void> => {
    await managePinnedTweet(tweetIsPinned ? 'unpin' : 'pin', userId, tweetId);
    toast.success(
      `Your tweet was ${tweetIsPinned ? 'unpinned' : 'pinned'} to your profile`
    );
    pinCloseModal();
  };

  const handleFollow =
    (closeMenu: () => void, ...args: Parameters<typeof manageFollow>) =>
    async (): Promise<void> => {
      const [type] = args;

      closeMenu();
      await manageFollow(...args);

      toast.success(
        `You ${
          type === 'follow' ? 'followed' : 'unfollowed'
        } ${displayUsername}`
      );
    };

  const handleBlockOpen = (closeMenu: () => void) => (): void => {
    closeMenu();
    blockOpenModal();
  };

  const handleBlock = async (): Promise<void> => {
    if (!userId) return;
    await manageBlock(blocking ? 'unblock' : 'block', userId, createdBy);
    toast.success(
      `You ${blocking ? 'unblocked' : 'blocked'} ${displayUsername}`
    );
    blockCloseModal();
  };

  const handleMuteOpen = (closeMenu: () => void) => (): void => {
    closeMenu();
    muteOpenModal();
  };

  const handleMute = async (): Promise<void> => {
    if (!userId) return;
    await manageMute(muting ? 'unmute' : 'mute', userId, createdBy);
    toast.success(`You ${muting ? 'unmuted' : 'muted'} ${displayUsername}`);
    muteCloseModal();
  };

  const handleThreadMute =
    (closeMenu: () => void) => async (): Promise<void> => {
      if (!userId || updatingThreadMute) return;

      closeMenu();

      const nextMuted = !optimisticThreadMuted;

      setUpdatingThreadMute(true);
      setOptimisticThreadMuted(nextMuted);

      try {
        await manageThreadMute(nextMuted ? 'mute' : 'unmute', userId, tweetId);
        toast.success(
          nextMuted
            ? 'This conversation has been muted'
            : 'This conversation has been unmuted'
        );
      } catch {
        setOptimisticThreadMuted(!nextMuted);
        toast.error('Conversation mute could not be updated');
      } finally {
        setUpdatingThreadMute(false);
      }
    };

  const handleReportOpen = (closeMenu: () => void) => (): void => {
    closeMenu();
    reportOpenModal();
  };

  const handleReportTweet = (
    reasonType: ModerationReportReason,
    reason?: string
  ): Promise<void> => {
    return reportTweet(tweetId, reasonType, reason);
  };

  const handleLoggedOutAction = (closeMenu: () => void) => (): void => {
    closeMenu();
    void push('/');
  };

  const userIsFollowed = following.includes(createdBy);

  const currentPinModalData = useMemo(
    () => pinModalData[+tweetIsPinned],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pinOpen]
  );

  return (
    <>
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={removeOpen}
        closeModal={removeCloseModal}
      >
        <ActionModal
          title='Delete Tweet?'
          description={`This can’t be undone and it will be removed from ${
            isInAdminControl ? `${displayUsername}'s` : 'your'
          } profile, the timeline of any accounts that follow ${
            isInAdminControl ? displayUsername : 'you'
          }, and from Not Twitter search results.`}
          mainBtnClassName='bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/75 accent-tab
                            focus-visible:bg-accent-red/90'
          mainBtnLabel='Delete'
          focusOnMainBtn
          action={handleRemove}
          closeModal={removeCloseModal}
        />
      </Modal>
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={pinOpen}
        closeModal={pinCloseModal}
      >
        <ActionModal
          {...currentPinModalData}
          mainBtnClassName='bg-light-primary hover:bg-light-primary/90 active:bg-light-primary/80 dark:text-light-primary
                            dark:bg-light-border dark:hover:bg-light-border/90 dark:active:bg-light-border/75'
          focusOnMainBtn
          action={handlePin}
          closeModal={pinCloseModal}
        />
      </Modal>
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={blockOpen}
        closeModal={blockCloseModal}
      >
        <ActionModal
          title={`${blocking ? 'Unblock' : 'Block'} ${displayUsername}?`}
          description={
            blocking
              ? 'They will be able to follow you and view your Tweets.'
              : 'They will not be able to follow you or view your Tweets, and you will not see their Tweets in your timeline.'
          }
          mainBtnLabel={blocking ? 'Unblock' : 'Block'}
          mainBtnClassName={
            blocking
              ? undefined
              : 'bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/80'
          }
          action={handleBlock}
          closeModal={blockCloseModal}
        />
      </Modal>
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={muteOpen}
        closeModal={muteCloseModal}
      >
        <ActionModal
          title={`${muting ? 'Unmute' : 'Mute'} ${displayUsername}?`}
          description={
            muting
              ? 'Their Tweets will be allowed back into your timelines and conversations.'
              : 'Their Tweets will be removed from your timelines and conversations. They will not know you muted them.'
          }
          mainBtnLabel={muting ? 'Unmute' : 'Mute'}
          mainBtnClassName={
            muting
              ? undefined
              : 'bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/80'
          }
          action={handleMute}
          closeModal={muteCloseModal}
        />
      </Modal>
      <Modal
        modalClassName='w-full max-w-xl overflow-hidden rounded-2xl bg-main-background'
        open={reportOpen}
        closeModal={reportCloseModal}
      >
        <ReportModal
          target='tweet'
          action={handleReportTweet}
          closeModal={reportCloseModal}
        />
      </Modal>
      <Popover className={popoverClassName}>
        {({ open, close }): JSX.Element => (
          <>
            <Popover.Button
              as={Button}
              className={cn(
                `main-tab group group p-2
                 hover:bg-accent-blue/10 focus-visible:bg-accent-blue/10
                 focus-visible:!ring-accent-blue/80 active:bg-accent-blue/20`,
                buttonClassName ?? 'absolute top-2 right-2',
                open && 'bg-accent-blue/10 [&>div>svg]:text-accent-blue'
              )}
              onClick={preventBubbling(null, true)}
            >
              <div className='group relative'>
                <HeroIcon
                  className='h-5 w-5 text-light-secondary group-hover:text-accent-blue
                             group-focus-visible:text-accent-blue dark:text-dark-secondary/80'
                  iconName='EllipsisHorizontalIcon'
                />
                {!open && <ToolTip tip='More' />}
              </div>
            </Popover.Button>
            <AnimatePresence>
              {open && (
                <Popover.Panel
                  className={
                    menuClassName ??
                    `menu-container group absolute top-[50px] right-2 whitespace-nowrap text-light-primary
                     dark:text-dark-primary`
                  }
                  as={motion.div}
                  {...variants}
                  static
                >
                  {(isAdmin || isOwner) && (
                    <Popover.Button
                      className='accent-tab flex w-full gap-3 rounded-md rounded-b-none p-4 text-accent-red
                                 hover:bg-main-sidebar-background'
                      as={Button}
                      onClick={preventBubbling(removeOpenModal)}
                    >
                      <HeroIcon iconName='TrashIcon' />
                      Delete
                    </Popover.Button>
                  )}
                  {!signedIn ? (
                    <Popover.Button
                      className='accent-tab flex w-full gap-3 rounded-md rounded-t-none p-4 hover:bg-main-sidebar-background'
                      as={Button}
                      onClick={preventBubbling(handleLoggedOutAction(close))}
                    >
                      <HeroIcon iconName='UserPlusIcon' />
                      Follow {displayUsername}
                    </Popover.Button>
                  ) : isOwner ? (
                    <Popover.Button
                      className='accent-tab flex w-full gap-3 rounded-md rounded-t-none p-4 hover:bg-main-sidebar-background'
                      as={Button}
                      onClick={preventBubbling(pinOpenModal)}
                    >
                      {tweetIsPinned ? (
                        <>
                          <CustomIcon iconName='PinOffIcon' />
                          Unpin from profile
                        </>
                      ) : (
                        <>
                          <CustomIcon iconName='PinIcon' />
                          Pin to your profile
                        </>
                      )}
                    </Popover.Button>
                  ) : userIsFollowed ? (
                    <Popover.Button
                      className='accent-tab flex w-full gap-3 rounded-md rounded-t-none p-4 hover:bg-main-sidebar-background'
                      as={Button}
                      onClick={preventBubbling(
                        handleFollow(close, 'unfollow', userId, createdBy)
                      )}
                    >
                      <HeroIcon iconName='UserMinusIcon' />
                      Unfollow {displayUsername}
                    </Popover.Button>
                  ) : (
                    <Popover.Button
                      className='accent-tab flex w-full gap-3 rounded-md rounded-t-none p-4 hover:bg-main-sidebar-background'
                      as={Button}
                      onClick={preventBubbling(
                        handleFollow(close, 'follow', userId, createdBy)
                      )}
                    >
                      <HeroIcon iconName='UserPlusIcon' />
                      Follow {displayUsername}
                    </Popover.Button>
                  )}
                  {signedIn && !isOwner && !blockingByListName && (
                    <Popover.Button
                      className={cn(
                        `accent-tab flex w-full gap-3 rounded-md rounded-t-none p-4
                         hover:bg-main-sidebar-background`,
                        !blocking && 'text-accent-red'
                      )}
                      as={Button}
                      onClick={preventBubbling(handleBlockOpen(close))}
                    >
                      <HeroIcon iconName='NoSymbolIcon' />
                      {blocking
                        ? `Unblock ${displayUsername}`
                        : `Block ${displayUsername}`}
                    </Popover.Button>
                  )}
                  {signedIn && !isOwner && (
                    <Popover.Button
                      className={cn(
                        `accent-tab flex w-full gap-3 rounded-md rounded-t-none p-4
                         hover:bg-main-sidebar-background`,
                        !muting && !mutingByListName && 'text-accent-red',
                        mutingByListName && 'cursor-not-allowed opacity-70'
                      )}
                      as={Button}
                      disabled={!!mutingByListName}
                      onClick={preventBubbling(handleMuteOpen(close))}
                    >
                      <HeroIcon
                        iconName={
                          muting ? 'SpeakerWaveIcon' : 'SpeakerXMarkIcon'
                        }
                      />
                      {mutingByListName
                        ? `Muted by ${mutingByListName}`
                        : muting
                          ? `Unmute ${displayUsername}`
                          : `Mute ${displayUsername}`}
                    </Popover.Button>
                  )}
                  {signedIn && (
                    <Popover.Button
                      className={cn(
                        `accent-tab flex w-full gap-3 rounded-md rounded-t-none p-4
                         hover:bg-main-sidebar-background disabled:cursor-not-allowed disabled:opacity-70`,
                        !optimisticThreadMuted && 'text-accent-red'
                      )}
                      as={Button}
                      disabled={updatingThreadMute}
                      onClick={preventBubbling(handleThreadMute(close))}
                    >
                      <HeroIcon
                        iconName={
                          optimisticThreadMuted
                            ? 'SpeakerWaveIcon'
                            : 'SpeakerXMarkIcon'
                        }
                      />
                      {optimisticThreadMuted
                        ? 'Unmute this conversation'
                        : 'Mute this conversation'}
                    </Popover.Button>
                  )}
                  {signedIn && !isOwner && (
                    <Popover.Button
                      className='accent-tab flex w-full gap-3 rounded-md rounded-t-none p-4 text-accent-red
                                 hover:bg-main-sidebar-background'
                      as={Button}
                      onClick={preventBubbling(handleReportOpen(close))}
                    >
                      <HeroIcon iconName='FlagIcon' />
                      Report Tweet
                    </Popover.Button>
                  )}
                </Popover.Panel>
              )}
            </AnimatePresence>
          </>
        )}
      </Popover>
    </>
  );
}

export const TweetActions = memo(TweetActionsComponent);
TweetActions.displayName = 'TweetActions';
