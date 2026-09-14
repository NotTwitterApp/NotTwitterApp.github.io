import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import { useLiveUpdates } from '@lib/context/live-updates-context';
import { useWindow } from '@lib/context/window-context';
import { useModal } from '@lib/hooks/useModal';
import { getUserPath } from '@lib/routes';
import { Modal } from '@components/modal/modal';
import { CustomIcon } from '@components/ui/custom-icon';
import { Button } from '@components/ui/button';
import { SidebarLink } from './sidebar-link';
import { MoreSettings } from './more-settings';
import { navLinks } from './nav-links';
import { SidebarProfile } from './sidebar-profile';

import type { JSX } from 'react';

const Input = dynamic<{ modal?: boolean; closeModal?: () => void }>(
  () => import('@components/input/input').then((module) => module.Input),
  { ssr: false }
);

export function Sidebar(): JSX.Element {
  const { user } = useAuth();
  const { isMobile } = useWindow();
  const { homeBadgeCount, messageCount, notificationCount } = useLiveUpdates();
  const { asPath } = useRouter();

  const { open, openModal, closeModal } = useModal();

  const username = user?.username as string;
  const isMessagesRoute =
    (asPath.split(/[?#]/)[0] || '/').replace(/\/+$/g, '') === '/messages';

  return (
    <header
      id='sidebar'
      className={cn(
        'flex shrink-0 transition-opacity duration-200',
        isMobile
          ? 'w-0'
          : `w-20 md:w-24 lg:max-w-none xl:-mr-4 xl:w-72
             xl:max-w-[288px] xl:justify-end`
      )}
    >
      <Modal
        className='flex items-start justify-center'
        modalClassName='mt-8 w-full max-w-[600px] overflow-hidden rounded-2xl bg-main-background'
        open={open}
        closeModal={closeModal}
      >
        <Input modal closeModal={closeModal} />
      </Modal>
      <div
        className={cn(
          `fixed bottom-0 z-10 flex w-full flex-col justify-between border-t
           border-light-border bg-main-background py-0
           pb-[env(safe-area-inset-bottom)] dark:border-dark-border`,
          isMobile && 'left-0',
          !isMobile &&
            `top-0 h-full w-auto border-0 bg-transparent px-2 py-3 pt-2
             md:px-4 xl:w-72`
        )}
      >
        <section
          className={cn(
            'flex flex-col justify-center gap-2',
            !isMobile && 'items-center xl:items-stretch'
          )}
        >
          <h1 className={cn(isMobile ? 'hidden' : 'flex')}>
            <Link
              href='/home'
              className='custom-button main-tab text-accent-blue transition hover:bg-light-primary/10 
                         focus-visible:bg-accent-blue/10 focus-visible:!ring-accent-blue/80
                         dark:text-twitter-icon dark:hover:bg-dark-primary/10'
            >
              <CustomIcon className='h-7 w-7' iconName='TwitterIcon' />
            </Link>
          </h1>
          <nav
            className={cn(
              'flex items-center justify-around',
              !isMobile && 'flex-col justify-center xl:block'
            )}
          >
            {navLinks.map(({ ...linkData }) => (
              <SidebarLink
                {...linkData}
                badgeCount={
                  linkData.href === '/notifications'
                    ? notificationCount
                    : linkData.href === '/messages'
                      ? messageCount
                      : 0
                }
                badgeDot={linkData.href === '/home' && homeBadgeCount > 0}
                key={linkData.href}
              />
            ))}
            <SidebarLink
              href={getUserPath(username)}
              linkName='Profile'
              iconName='TwitterProfileIcon'
              activeIconName='TwitterProfileFilledIcon'
            />
            <SidebarLink
              href='/not-twitter-blue'
              linkName='Not Twitter Blue'
              iconName='TwitterBlueIcon'
              canBeHidden
            />
            {!isMobile && <MoreSettings />}
          </nav>
          <Button
            className={cn(
              `accent-tab flex h-[52px] items-center justify-center
               bg-main-accent text-center text-lg font-bold text-white outline-none
               transition-colors hover:bg-main-accent/90 active:bg-main-accent/75`,
              isMobile
                ? cn(
                    'absolute right-4 -translate-y-[72px]',
                    isMessagesRoute && 'hidden'
                  )
                : 'static translate-y-0 xl:w-11/12'
            )}
            onClick={openModal}
          >
            <CustomIcon
              className='block h-6 w-6 xl:hidden'
              iconName='FeatherIcon'
            />
            <p className='hidden xl:block'>Tweet</p>
          </Button>
        </section>
        {!isMobile && <SidebarProfile />}
      </div>
    </header>
  );
}
