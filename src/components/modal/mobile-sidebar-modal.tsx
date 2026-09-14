import { useState, type JSX } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { useLongPress } from '@lib/hooks/useLongPress';
import { useModal } from '@lib/hooks/useModal';
import { formatNumber } from '@lib/date';
import { getUserPath } from '@lib/routes';
import { Button } from '@components/ui/button';
import { UserAvatar } from '@components/user/user-avatar';
import { UserName } from '@components/user/user-name';
import { UserUsername } from '@components/user/user-username';
import { MobileSidebarLink } from '@components/sidebar/mobile-sidebar-link';
import { navLinks } from '@components/sidebar/nav-links';
import {
  AccountAvatar,
  AccountRow,
  AddAccountModal
} from '@components/sidebar/sidebar-profile';
import { HeroIcon } from '@components/ui/hero-icon';
import { Modal } from './modal';
import { ActionModal } from './action-modal';
import { DisplayModal } from './display-modal';
import type { AppIconName } from '@components/ui/app-icon';
import type { BlueskyAccount } from '@lib/atproto/auth';
import type { User } from '@lib/types/user';

export type MobileNavLink = {
  href: string;
  linkName: string;
  iconName: AppIconName;
  disabled?: boolean;
};

const bottomNavLinks: Readonly<MobileNavLink[]> = [
  {
    href: '/settings',
    linkName: 'Settings and privacy',
    iconName: 'Cog8ToothIcon'
  },
  {
    href: '/privacy',
    linkName: 'Privacy Policy',
    iconName: 'DocumentTextIcon'
  },
  {
    href: '/help-center',
    linkName: 'Help center',
    iconName: 'QuestionMarkCircleIcon'
  }
];

type Stats = [string, string, number];
type MobileSidebarView = 'account-info' | 'accounts';

type MobileSidebarModalProps = Pick<
  User,
  | 'id'
  | 'name'
  | 'username'
  | 'verified'
  | 'photoURL'
  | 'followingCount'
  | 'followersCount'
> & {
  closeModal: () => void;
};

export function MobileSidebarModal({
  id,
  name,
  username,
  verified,
  photoURL,
  followingCount,
  followersCount,
  closeModal
}: MobileSidebarModalProps): JSX.Element {
  const { accounts, signOut, switchBlueskyAccount } = useAuth();
  const { hideBskySocialSuffix, theme, toggleColorScheme } = useTheme();
  const [view, setView] = useState<MobileSidebarView>('account-info');

  const {
    open: displayOpen,
    openModal: displayOpenModal,
    closeModal: displayCloseModal
  } = useModal();

  const {
    open: logOutOpen,
    openModal: logOutOpenModal,
    closeModal: logOutCloseModal
  } = useModal();
  const {
    open: addAccountOpen,
    openModal: addAccountOpenModal,
    closeModal: addAccountCloseModal
  } = useModal();
  const themeShortcutHandlers = useLongPress({
    onLongPress: displayOpenModal,
    onPress: toggleColorScheme
  });

  const allStats: Readonly<Stats[]> = [
    ['following', 'Following', followingCount],
    ['followers', 'Followers', followersCount]
  ];
  const exactNumber = new Intl.NumberFormat('en-GB');

  const userLink = getUserPath(username);
  const activeAccount: BlueskyAccount = {
    id,
    name,
    username,
    verified,
    photoURL,
    updatedAt: ''
  };
  const alternateAccounts = accounts.filter((account) => account.id !== id);
  const firstAlternateUsername = formatAtprotoDisplayIdentifier(
    alternateAccounts[0]?.username,
    { hideBskySocialSuffix }
  );
  const themeShortcutLabel = theme === 'light' ? 'Dark mode' : 'Light mode';
  const themeShortcutIcon = theme === 'light' ? 'MoonIcon' : 'SunIcon';

  const handleClose = (): void => {
    setView('account-info');
    closeModal();
  };

  const handleSwitchAccount = async (accountId: string): Promise<void> => {
    try {
      await switchBlueskyAccount(accountId);
      if (typeof window !== 'undefined') window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to switch accounts.'
      );
    }
  };

  const handleLogOut = async (): Promise<void> => {
    await signOut();
    logOutCloseModal();
  };

  return (
    <>
      <AddAccountModal
        open={addAccountOpen}
        closeModal={addAccountCloseModal}
      />
      <Modal
        className='items-center justify-center xs:flex'
        modalClassName='max-w-xl bg-main-background w-full p-8 rounded-2xl hover-animation'
        open={displayOpen}
        closeModal={displayCloseModal}
      >
        <DisplayModal closeModal={displayCloseModal} />
      </Modal>
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={logOutOpen}
        closeModal={logOutCloseModal}
      >
        <ActionModal
          useIcon
          focusOnMainBtn
          title='Log out of Not Twitter?'
          description='You can always log back in at any time. If you just want to switch accounts, you can do that by adding an existing account.'
          mainBtnLabel='Log out'
          action={handleLogOut}
          closeModal={logOutCloseModal}
        />
      </Modal>
      <header className='flex h-[53px] items-center justify-between px-4'>
        {view === 'accounts' ? (
          <div className='flex min-w-0 items-center gap-6'>
            <Button
              className='dark-bg-tab -ml-2 p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                         dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
              onClick={(): void => setView('account-info')}
            >
              <HeroIcon className='h-5 w-5' iconName='ArrowLeftIcon' />
            </Button>
            <h2 className='truncate text-xl font-bold'>Accounts</h2>
          </div>
        ) : (
          <h2 className='text-xl font-bold'>Account info</h2>
        )}
        <Button
          className='dark-bg-tab -mr-2 p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          onClick={handleClose}
        >
          <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
        </Button>
      </header>
      <section className='flex h-[calc(100vh-53px)] flex-col overflow-y-auto pb-4'>
        {view === 'accounts' ? (
          <>
            <div className='flex flex-col py-2'>
              <AccountRow account={activeAccount} active />
              {alternateAccounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onClick={(): void => void handleSwitchAccount(account.id)}
                />
              ))}
            </div>
            <i className='mx-4 h-px shrink-0 bg-light-border dark:bg-dark-border' />
            <Button
              className='accent-tab accent-bg-tab flex w-full justify-start rounded-none px-4 py-4 text-left font-bold transition
                         hover:bg-light-primary/10 focus-visible:ring-2 first:focus-visible:ring-[#878a8c] 
                         dark:hover:bg-dark-primary/10 dark:focus-visible:ring-white'
              onClick={addAccountOpenModal}
            >
              Add an existing account
            </Button>
          </>
        ) : (
          <>
            <div className='flex items-center justify-between gap-3 px-4 pt-3'>
              <UserAvatar
                username={username}
                src={photoURL}
                alt={name}
                size={40}
              />
              <div className='flex items-center gap-3'>
                {alternateAccounts[0] ? (
                  <>
                    <Button
                      className='accent-tab flex h-9 w-9 items-center justify-center rounded-full p-0
                                 transition hover:bg-light-primary/10 active:bg-light-primary/20
                                 dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
                      onClick={(): void =>
                        void handleSwitchAccount(alternateAccounts[0].id)
                      }
                      aria-label={`Switch to ${firstAlternateUsername}`}
                      title={`Switch to ${firstAlternateUsername}`}
                    >
                      <AccountAvatar
                        className='self-center'
                        src={alternateAccounts[0].photoURL}
                        alt={alternateAccounts[0].name}
                        size={32}
                      />
                    </Button>
                    <Button
                      className='accent-tab flex h-9 w-9 items-center justify-center rounded-full border
                                 border-light-line-reply p-0 transition hover:bg-light-primary/10
                                 active:bg-light-primary/20 dark:border-dark-border
                                 dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
                      onClick={(): void => setView('accounts')}
                      aria-label='Manage accounts'
                      title='Manage accounts'
                    >
                      <HeroIcon
                        className='h-5 w-5'
                        iconName='EllipsisHorizontalIcon'
                      />
                    </Button>
                  </>
                ) : (
                  <Button
                    className='accent-tab flex h-9 w-9 items-center justify-center rounded-full border
                               border-light-line-reply p-0 text-main-accent transition hover:bg-main-accent/10
                               active:bg-main-accent/20 dark:border-dark-border'
                    onClick={(): void => setView('accounts')}
                    aria-label='Manage accounts'
                    title='Manage accounts'
                  >
                    <HeroIcon className='h-5 w-5' iconName='PlusIcon' />
                  </Button>
                )}
              </div>
            </div>
            <div className='flex flex-col gap-3 px-4 pt-3 pb-3'>
              <div className='flex flex-col leading-5'>
                <UserName
                  name={name}
                  username={username}
                  verified={verified}
                  className='-mb-1'
                />
                <UserUsername username={username} />
              </div>
              <div className='text-secondary flex gap-5'>
                {allStats.map(([id, label, stat]) => (
                  <Link href={`${userLink}/${id}`} key={id}>
                    <a
                      className='hover-animation flex h-4 items-center gap-1 border-b border-b-transparent 
                                 outline-none hover:border-b-light-primary focus-visible:border-b-light-primary
                                 dark:hover:border-b-dark-primary dark:focus-visible:border-b-dark-primary'
                      title={`${exactNumber.format(stat)} ${label}`}
                    >
                      <p className='font-bold'>{formatNumber(stat)}</p>
                      <p className='text-light-secondary dark:text-dark-secondary'>
                        {label}
                      </p>
                    </a>
                  </Link>
                ))}
              </div>
            </div>
            <i className='mx-4 h-px shrink-0 bg-light-border dark:bg-dark-border' />
            <nav className='flex flex-col py-2'>
              {navLinks.map((linkData) => (
                <MobileSidebarLink {...linkData} key={linkData.href} />
              ))}
              <MobileSidebarLink
                href={userLink}
                iconName='TwitterProfileIcon'
                activeIconName='TwitterProfileFilledIcon'
                linkName='Profile'
              />
              <MobileSidebarLink
                href='/not-twitter-blue'
                iconName='TwitterBlueIcon'
                linkName='Not Twitter Blue'
              />
            </nav>
            <i className='mx-4 h-px shrink-0 bg-light-border dark:bg-dark-border' />
            <nav className='flex flex-col py-2'>
              {bottomNavLinks.map((linkData) => (
                <MobileSidebarLink bottom {...linkData} key={linkData.href} />
              ))}
              <Button
                className='accent-tab accent-bg-tab flex items-center gap-5 rounded-full px-4 py-3 text-left
                           font-bold transition hover:bg-light-primary/10 focus-visible:ring-2
                           first:focus-visible:ring-[#878a8c] dark:hover:bg-dark-primary/10
                           dark:focus-visible:ring-white'
                {...themeShortcutHandlers}
                title='Hold for display options'
              >
                <HeroIcon className='h-6 w-6' iconName={themeShortcutIcon} />
                {themeShortcutLabel}
              </Button>
              <Button
                className='accent-tab accent-bg-tab flex items-center gap-5 rounded-full px-4 py-3 text-left
                           font-bold transition hover:bg-light-primary/10 focus-visible:ring-2
                           first:focus-visible:ring-[#878a8c] dark:hover:bg-dark-primary/10
                           dark:focus-visible:ring-white'
                onClick={displayOpenModal}
              >
                <HeroIcon className='h-6 w-6' iconName='PaintBrushIcon' />
                Display
              </Button>
              <Button
                className='accent-tab accent-bg-tab flex items-center gap-5 rounded-full px-4 py-3 text-left
                           font-bold transition hover:bg-light-primary/10 focus-visible:ring-2
                           first:focus-visible:ring-[#878a8c] dark:hover:bg-dark-primary/10
                           dark:focus-visible:ring-white'
                onClick={logOutOpenModal}
              >
                <HeroIcon
                  className='h-6 w-6'
                  iconName='ArrowRightOnRectangleIcon'
                />
                Log out
              </Button>
            </nav>
          </>
        )}
      </section>
    </>
  );
}
