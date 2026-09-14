import cn from 'clsx';
import { Popover } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { preventBubbling } from '@lib/utils';
import { getBskyUserUrl } from '@lib/routes';
import { manageBlock, manageMute, reportAccount } from '@lib/atproto/utils';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { useModal } from '@lib/hooks/useModal';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { ReportModal } from '@components/modal/report-modal';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { variants } from '@components/tweet/tweet-actions';
import type { ModerationReportReason } from '@lib/atproto/backend';

import type { JSX } from 'react';

type UserShareProps = {
  targetId?: string;
  username: string;
  blocking?: boolean;
  blockingByListName?: string | null;
  muting?: boolean;
  mutingByListName?: string | null;
};

export function UserShare({
  targetId,
  username,
  blocking,
  blockingByListName,
  muting,
  mutingByListName
}: UserShareProps): JSX.Element {
  const { user } = useAuth();
  const { hideBskySocialSuffix } = useTheme();
  const displayUsername = formatAtprotoDisplayIdentifier(username, {
    hideBskySocialSuffix
  });
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
  const canModerate = !!user && !!targetId && user.id !== targetId;
  const blockIsListOnly = !!blocking && !!blockingByListName;
  const muteIsListOnly = !!muting && !!mutingByListName;

  const handleCopy = (closeMenu: () => void) => async (): Promise<void> => {
    closeMenu();
    await navigator.clipboard.writeText(getBskyUserUrl(username));
    toast.success('Copied to clipboard');
  };
  const handleOpenBlock = (closeMenu: () => void) => (): void => {
    closeMenu();
    blockOpenModal();
  };
  const handleOpenMute = (closeMenu: () => void) => (): void => {
    closeMenu();
    muteOpenModal();
  };
  const handleOpenReport = (closeMenu: () => void) => (): void => {
    closeMenu();
    reportOpenModal();
  };
  const handleBlock = async (): Promise<void> => {
    if (!user || !targetId) return;
    await manageBlock('block', user.id, targetId);
    blockCloseModal();
    toast.success(`${displayUsername} has been blocked`);
  };
  const handleUnblock = async (): Promise<void> => {
    if (!user || !targetId) return;
    await manageBlock('unblock', user.id, targetId);
    blockCloseModal();
    toast.success(`${displayUsername} has been unblocked`);
  };
  const handleMute = async (): Promise<void> => {
    if (!user || !targetId) return;
    await manageMute('mute', user.id, targetId);
    muteCloseModal();
    toast.success(`${displayUsername} has been muted`);
  };
  const handleUnmute = async (): Promise<void> => {
    if (!user || !targetId) return;
    await manageMute('unmute', user.id, targetId);
    muteCloseModal();
    toast.success(`${displayUsername} has been unmuted`);
  };
  const handleReport = (
    reasonType: ModerationReportReason,
    reason?: string
  ): Promise<void> => {
    if (!targetId) return Promise.resolve();
    return reportAccount(targetId, reasonType, reason);
  };
  const actionIsUnblock = !!blocking && !blockIsListOnly;
  const actionIsUnmute = !!muting && !muteIsListOnly;

  return (
    <>
      <Modal
        modalClassName='flex flex-col gap-6 max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={blockOpen}
        closeModal={blockCloseModal}
      >
        <ActionModal
          title={
            actionIsUnblock
              ? `Unblock ${displayUsername}?`
              : `Block ${displayUsername}?`
          }
          description={
            actionIsUnblock
              ? 'They will be able to follow you and view your Tweets.'
              : 'They will not be able to follow you or view your Tweets, and you will not see their Tweets in your timeline.'
          }
          mainBtnLabel={actionIsUnblock ? 'Unblock' : 'Block'}
          mainBtnClassName={
            actionIsUnblock
              ? undefined
              : 'bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/80'
          }
          action={actionIsUnblock ? handleUnblock : handleBlock}
          closeModal={blockCloseModal}
        />
      </Modal>
      <Modal
        modalClassName='flex flex-col gap-6 max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={muteOpen}
        closeModal={muteCloseModal}
      >
        <ActionModal
          title={
            actionIsUnmute
              ? `Unmute ${displayUsername}?`
              : `Mute ${displayUsername}?`
          }
          description={
            actionIsUnmute
              ? 'Their Tweets will be allowed back into your timelines and conversations.'
              : 'Their Tweets will be removed from your timelines and conversations. They will not know you muted them.'
          }
          mainBtnLabel={actionIsUnmute ? 'Unmute' : 'Mute'}
          mainBtnClassName={
            actionIsUnmute
              ? undefined
              : 'bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/80'
          }
          action={actionIsUnmute ? handleUnmute : handleMute}
          closeModal={muteCloseModal}
        />
      </Modal>
      <Modal
        modalClassName='w-full max-w-xl overflow-hidden rounded-2xl bg-main-background'
        open={reportOpen}
        closeModal={reportCloseModal}
      >
        <ReportModal
          target='account'
          username={username}
          action={handleReport}
          closeModal={reportCloseModal}
        />
      </Modal>
      <Popover className='relative'>
        {({ open, close }): JSX.Element => (
          <>
            <Popover.Button
              as={Button}
              className={cn(
                `dark-bg-tab group relative border border-light-line-reply p-2
                 hover:bg-light-primary/10 active:bg-light-primary/20 dark:border-light-secondary
                 dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20`,
                open && 'bg-light-primary/10 dark:bg-dark-primary/10'
              )}
            >
              <HeroIcon className='h-5 w-5' iconName='EllipsisHorizontalIcon' />
              {!open && <ToolTip tip='More' />}
            </Popover.Button>
            <AnimatePresence>
              {open && (
                <Popover.Panel
                  className='menu-container group absolute right-0 top-11 whitespace-nowrap
                             text-light-primary dark:text-dark-primary'
                  as={motion.div}
                  {...variants}
                  static
                >
                  <Popover.Button
                    className={cn(
                      'flex w-full gap-3 rounded-md p-4 hover:bg-main-sidebar-background',
                      canModerate && 'rounded-b-none'
                    )}
                    as={Button}
                    onClick={preventBubbling(handleCopy(close))}
                  >
                    <HeroIcon iconName='LinkIcon' />
                    Copy link to Profile
                  </Popover.Button>
                  {canModerate && (
                    <Popover.Button
                      className={cn(
                        `flex w-full gap-3 rounded-md rounded-t-none rounded-b-none p-4
                         hover:bg-main-sidebar-background`,
                        !actionIsUnmute && !muteIsListOnly && 'text-accent-red',
                        muteIsListOnly && 'cursor-not-allowed opacity-70'
                      )}
                      as={Button}
                      disabled={muteIsListOnly}
                      onClick={preventBubbling(handleOpenMute(close))}
                    >
                      <HeroIcon
                        iconName={
                          actionIsUnmute
                            ? 'SpeakerWaveIcon'
                            : 'SpeakerXMarkIcon'
                        }
                      />
                      {muteIsListOnly
                        ? `Muted by ${mutingByListName}`
                        : actionIsUnmute
                          ? `Unmute ${displayUsername}`
                          : `Mute ${displayUsername}`}
                    </Popover.Button>
                  )}
                  {canModerate && (
                    <Popover.Button
                      className={cn(
                        `flex w-full gap-3 rounded-md rounded-t-none rounded-b-none p-4
                         hover:bg-main-sidebar-background`,
                        !actionIsUnblock && 'text-accent-red',
                        blockIsListOnly && 'cursor-not-allowed opacity-70'
                      )}
                      as={Button}
                      disabled={blockIsListOnly}
                      onClick={preventBubbling(handleOpenBlock(close))}
                    >
                      <HeroIcon iconName='NoSymbolIcon' />
                      {blockIsListOnly
                        ? `Blocked by ${blockingByListName}`
                        : actionIsUnblock
                          ? `Unblock ${displayUsername}`
                          : `Block ${displayUsername}`}
                    </Popover.Button>
                  )}
                  {canModerate && (
                    <Popover.Button
                      className='flex w-full gap-3 rounded-md rounded-t-none p-4 text-accent-red
                                 hover:bg-main-sidebar-background'
                      as={Button}
                      onClick={preventBubbling(handleOpenReport(close))}
                    >
                      <HeroIcon iconName='FlagIcon' />
                      Report {displayUsername}
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
