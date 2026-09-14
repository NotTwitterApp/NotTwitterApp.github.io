import { Dialog } from '@headlessui/react';
import cn from 'clsx';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import {
  ensureServerConnectionFetchWatcher,
  SERVER_CONNECTION_PROBLEM_EVENT
} from '@lib/server-connection';
import { Button } from '@components/ui/button';
import { CustomIcon } from '@components/ui/custom-icon';
import type { Theme } from '@lib/types/theme';

ensureServerConnectionFetchWatcher();

type ServerConnectionModalTheme = {
  backdrop: string;
  panel: string;
  icon: string;
  description: string;
  refreshButton: string;
  logOutButton: string;
};

type ServerConnectionModalProps = {
  defaultOpen?: boolean;
};

const baseRefreshButton =
  'h-12 rounded-full bg-[#1da1f2] px-5 py-0 text-[15px] font-bold text-white hover:bg-[#1a91da] focus-visible:bg-[#1a91da] focus-visible:!ring-[#1da1f2]/70 active:bg-[#1681c2]';

const baseLogOutButton =
  'h-12 rounded-full border border-[#1da1f2] px-5 py-0 text-[15px] font-bold text-[#1da1f2] hover:bg-[#1da1f2]/10 focus-visible:bg-[#1da1f2]/10 focus-visible:!ring-[#1da1f2]/70 active:bg-[#1da1f2]/20';

const serverConnectionModalThemes: Record<Theme, ServerConnectionModalTheme> = {
  light: {
    backdrop: 'bg-[#999]',
    panel: 'bg-white text-[#14171a] shadow-[0_2px_6px_rgba(0,0,0,0.08)]',
    icon: 'text-[#1da1f2]',
    description: 'text-[#657786]',
    refreshButton: baseRefreshButton,
    logOutButton: cn(baseLogOutButton, 'bg-white')
  },
  dim: {
    backdrop: 'bg-[#5b7083]/40',
    panel:
      'bg-[#15202b] text-[#f5f8fa] shadow-[0_0_0_1px_rgba(136,153,166,0.2),0_2px_6px_rgba(0,0,0,0.32)]',
    icon: 'text-[#1da1f2]',
    description: 'text-[#8899a6]',
    refreshButton: baseRefreshButton,
    logOutButton: cn(baseLogOutButton, 'bg-transparent')
  },
  dark: {
    backdrop: 'bg-[#5b7083]/40',
    panel:
      'bg-black text-[#d9d9d9] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_2px_6px_rgba(0,0,0,0.5)]',
    icon: 'text-[#1da1f2]',
    description: 'text-[#6e767d]',
    refreshButton: baseRefreshButton,
    logOutButton: cn(baseLogOutButton, 'bg-transparent')
  }
};

export function ServerConnectionModal({
  defaultOpen
}: ServerConnectionModalProps): JSX.Element {
  const { signOut, user } = useAuth();
  const { theme } = useTheme();
  const modalTheme = serverConnectionModalThemes[theme];
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [loggingOut, setLoggingOut] = useState(false);
  const showLogOutButton = !!user;

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    ensureServerConnectionFetchWatcher();

    const openModal = (): void => setOpen(true);

    window.addEventListener(SERVER_CONNECTION_PROBLEM_EVENT, openModal);
    window.addEventListener('offline', openModal);

    return () => {
      window.removeEventListener(SERVER_CONNECTION_PROBLEM_EVENT, openModal);
      window.removeEventListener('offline', openModal);
    };
  }, []);

  const handleRefresh = useCallback((): void => {
    window.location.reload();
  }, []);

  const handleLogOut = useCallback(async (): Promise<void> => {
    setLoggingOut(true);

    try {
      await signOut();
      setOpen(false);
    } finally {
      setLoggingOut(false);
    }
  }, [signOut]);

  return (
    <Dialog
      className='relative z-[100]'
      open={open}
      onClose={(): void => undefined}
    >
      <div className={cn('fixed inset-0', modalTheme.backdrop)} aria-hidden />
      <div className='fixed inset-0 flex items-center justify-center px-4 py-8'>
        <Dialog.Panel
          data-server-connection-modal-panel
          className={cn(
            `flex max-h-[calc(100vh-32px)] w-full max-w-[576px] flex-col items-center
             overflow-y-auto rounded-[14px] px-8 text-center sm:px-16`,
            modalTheme.panel
          )}
          style={{
            minHeight: 'min(480px, calc(100vh - 32px))',
            paddingBottom: 'clamp(24px, 8vh, 48px)',
            paddingTop: 'clamp(30px, 11vh, 66px)'
          }}
        >
          <i className={modalTheme.icon}>
            <CustomIcon className='h-11 w-11' iconName='TwitterIcon' />
          </i>
          <div style={{ marginTop: 'clamp(28px, 11vh, 64px)' }}>
            <Dialog.Title className='text-[20px] font-bold leading-6'>
              Error
            </Dialog.Title>
            <Dialog.Description
              className={cn(
                'mt-3 text-[15px] leading-[18px]',
                modalTheme.description
              )}
            >
              Something went wrong, but don&apos;t fret — it&apos;s not your
              fault.
              <br />
              Let&apos;s try again.
            </Dialog.Description>
          </div>
          <div
            className={cn(
              'flex w-full max-w-[384px] flex-col',
              showLogOutButton && 'gap-4'
            )}
            style={{ marginTop: 'clamp(28px, 10vh, 64px)' }}
          >
            <Button
              className={modalTheme.refreshButton}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
            {showLogOutButton && (
              <Button
                className={modalTheme.logOutButton}
                loading={loggingOut}
                onClick={handleLogOut}
              >
                Log out
              </Button>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
