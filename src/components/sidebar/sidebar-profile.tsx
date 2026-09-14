import { useState, type JSX } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dialog, Menu } from '@headlessui/react';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { useModal } from '@lib/hooks/useModal';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { CustomIcon } from '@components/ui/custom-icon';
import { NextImage } from '@components/ui/next-image';
import { UserAvatar } from '@components/user/user-avatar';
import { UserName } from '@components/user/user-name';
import { UserUsername } from '@components/user/user-username';
import { variants } from './more-settings';
import type { ChangeEvent, FormEvent } from 'react';
import type { BlueskyAccount } from '@lib/atproto/auth';
import type { User } from '@lib/types/user';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function AccountAvatar({
  src,
  alt,
  size = 40,
  className
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    <figure
      className={cn(
        'blur-picture profile-picture pointer-events-none flex shrink-0 self-start',
        className
      )}
    >
      <NextImage
        useSkeleton
        imgClassName='profile-picture'
        width={size}
        height={size}
        src={src}
        alt={alt}
      />
    </figure>
  );
}

function AccountIdentity({
  account
}: {
  account: BlueskyAccount;
}): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const displayUsername = formatAtprotoDisplayIdentifier(account.username, {
    hideBskySocialSuffix
  });

  return (
    <div className='min-w-0 truncate text-left leading-5'>
      <div className='flex items-center gap-1 truncate font-bold'>
        <p className='truncate'>{account.name}</p>
        {account.verified && (
          <i className='shrink-0'>
            <CustomIcon className='h-5 w-5' iconName='TwitterVerifiedIcon' />
          </i>
        )}
      </div>
      <p className='truncate text-light-secondary dark:text-dark-secondary'>
        {displayUsername}
      </p>
    </div>
  );
}

type AccountRowProps = {
  account: BlueskyAccount;
  active?: boolean;
  onClick?: () => void;
};

export function AccountRow({
  account,
  active,
  onClick
}: AccountRowProps): JSX.Element {
  const content = (
    <>
      <div className='flex min-w-0 items-center gap-3'>
        <AccountAvatar src={account.photoURL} alt={account.name} />
        <AccountIdentity account={account} />
      </div>
      {active && (
        <i className='shrink-0 text-main-accent'>
          <HeroIcon className='h-5 w-5' iconName='CheckIcon' />
        </i>
      )}
    </>
  );

  if (active)
    return (
      <div className='flex items-center justify-between gap-3 px-4 py-3'>
        {content}
      </div>
    );

  return (
    <button
      className='accent-tab hover-animation flex w-full items-center justify-between gap-3 rounded-none
                 px-4 py-3 text-left hover:bg-light-primary/[0.03] active:bg-light-primary/[0.06]
                 dark:hover:bg-dark-primary/[0.06] dark:active:bg-dark-primary/[0.1]'
      type='button'
      onClick={onClick}
    >
      {content}
    </button>
  );
}

type AddAccountModalProps = {
  open: boolean;
  closeModal: () => void;
};

export function AddAccountModal({
  open,
  closeModal
}: AddAccountModalProps): JSX.Element {
  const { signInWithBluesky } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const trimmedIdentifier = identifier.trim();

  const handleIdentifierChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => {
    setIdentifier(value.replace(/^@+/, ''));
    if (errorMessage) setErrorMessage('');
  };

  const handleClose = (): void => {
    if (loading) return;
    closeModal();
    setIdentifier('');
    setErrorMessage('');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!trimmedIdentifier) {
      setErrorMessage('Enter your Bluesky handle or DID.');
      return;
    }

    setLoading(true);

    try {
      await signInWithBluesky(trimmedIdentifier);
      setLoading(false);
      closeModal();
      setIdentifier('');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Unable to add that account.'));
      setLoading(false);
    }
  };

  return (
    <Modal
      modalClassName='relative flex min-h-[520px] w-full max-w-xl flex-col rounded-2xl bg-main-background px-8 py-4'
      open={open}
      closeModal={handleClose}
    >
      <form className='flex flex-1 flex-col' onSubmit={handleSubmit}>
        <div className='relative mb-8 flex min-h-[40px] items-center justify-center'>
          <Button
            className='absolute left-0 p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
            onClick={handleClose}
            disabled={loading}
          >
            <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
          </Button>
          <CustomIcon
            className='h-8 w-8 text-accent-blue dark:text-twitter-icon'
            iconName='TwitterIcon'
          />
        </div>
        <Dialog.Title className='mb-8 text-3xl font-bold'>
          Add an existing account
        </Dialog.Title>
        <div className='flex flex-col gap-2'>
          <label
            className='relative rounded border border-light-line-reply transition focus-within:border-main-accent
                       focus-within:ring-1 focus-within:ring-main-accent dark:border-dark-border'
            htmlFor='add-bluesky-identifier'
          >
            <span className='absolute left-3 top-2 text-sm text-light-secondary dark:text-dark-secondary'>
              Bluesky handle or DID
            </span>
            <span className='mt-6 flex items-center px-3 pb-2'>
              <CustomIcon
                className='mr-2 h-5 w-5 shrink-0 text-light-secondary dark:text-dark-secondary'
                iconName='TwitterAtIcon'
              />
              <input
                className='min-w-0 flex-1 bg-transparent text-lg outline-none'
                id='add-bluesky-identifier'
                type='text'
                autoComplete='username'
                autoFocus
                value={identifier}
                onChange={handleIdentifierChange}
              />
            </span>
          </label>
          {errorMessage && (
            <p className='text-sm text-accent-red'>{errorMessage}</p>
          )}
        </div>
        <div className='mt-auto flex flex-col gap-3 pb-2 inner:py-2 inner:font-bold'>
          <Button
            className='bg-light-primary text-white transition enabled:hover:bg-light-primary/90
                       enabled:focus-visible:bg-light-primary/90 enabled:active:bg-light-primary/80
                       disabled:brightness-75 dark:bg-light-border dark:text-light-primary
                       dark:enabled:hover:bg-light-border/90 dark:enabled:focus-visible:bg-light-border/90
                       dark:enabled:active:bg-light-border/75'
            type='submit'
            loading={loading}
            disabled={!trimmedIdentifier}
          >
            Next
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function SidebarProfile(): JSX.Element {
  const { user, accounts, signOut, switchBlueskyAccount } = useAuth();
  const { hideBskySocialSuffix } = useTheme();
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

  const { id, name, username, verified, photoURL } = user as User;
  const activeAccount: BlueskyAccount = {
    id,
    name,
    username,
    verified,
    photoURL,
    updatedAt: ''
  };
  const visibleAccounts = [
    activeAccount,
    ...accounts.filter((account) => account.id !== id)
  ];
  const displayUsername = formatAtprotoDisplayIdentifier(username, {
    hideBskySocialSuffix
  });

  const handleSwitchAccount = async (accountId: string): Promise<void> => {
    try {
      await switchBlueskyAccount(accountId);
      if (typeof window !== 'undefined') window.location.reload();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to switch accounts.'));
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
      <Menu className='relative' as='section'>
        {({ open }): JSX.Element => (
          <>
            <Menu.Button
              className={cn(
                `custom-button main-tab dark-bg-tab flex w-full items-center 
                 justify-between hover:bg-light-primary/10 active:bg-light-primary/20
                 dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20`,
                open && 'bg-light-primary/10 dark:bg-dark-primary/10'
              )}
            >
              <div className='flex min-w-0 gap-3 truncate'>
                <UserAvatar src={photoURL} alt={name} size={40} />
                <div className='hidden min-w-0 text-start leading-5 xl:flex xl:flex-col'>
                  <UserName name={name} className='start' verified={verified} />
                  <UserUsername
                    username={username}
                    className='max-w-full'
                    disableLink
                  />
                </div>
              </div>
              <HeroIcon
                className='hidden h-6 w-6 xl:block'
                iconName='EllipsisHorizontalIcon'
              />
            </Menu.Button>
            <AnimatePresence>
              {open && (
                <Menu.Items
                  className='menu-container absolute bottom-full left-0 mb-3 w-[300px] overflow-visible
                             rounded-2xl text-[15px] xl:w-full'
                  as={motion.div}
                  {...variants}
                  static
                >
                  <div className='max-h-[360px] overflow-y-auto py-1'>
                    {visibleAccounts.map((account) => (
                      <Menu.Item
                        key={account.id}
                        as='div'
                        disabled={account.id === id}
                      >
                        <AccountRow
                          account={account}
                          active={account.id === id}
                          onClick={(): void =>
                            void handleSwitchAccount(account.id)
                          }
                        />
                      </Menu.Item>
                    ))}
                  </div>
                  <div className='border-t border-light-border py-1 dark:border-dark-border'>
                    <Menu.Item>
                      {({ active }): JSX.Element => (
                        <Button
                          className={cn(
                            `flex w-full justify-start rounded-none px-4 py-4 text-left font-bold
                             duration-200`,
                            active && 'bg-main-sidebar-background'
                          )}
                          onClick={addAccountOpenModal}
                        >
                          Add an existing account
                        </Button>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }): JSX.Element => (
                        <Button
                          className={cn(
                            `flex w-full justify-start rounded-none px-4 py-4 text-left font-bold
                             duration-200`,
                            active && 'bg-main-sidebar-background'
                          )}
                          onClick={logOutOpenModal}
                        >
                          Log out {displayUsername}
                        </Button>
                      )}
                    </Menu.Item>
                  </div>
                  <i
                    className='absolute -bottom-[10px] left-8 rotate-180
                               [filter:drop-shadow(#cfd9de_1px_-1px_1px)] 
                               dark:[filter:drop-shadow(#333639_1px_-1px_1px)]
                               xl:left-1/2 xl:-translate-x-1/2'
                  >
                    <CustomIcon
                      className='h-4 w-6 fill-main-background'
                      iconName='TriangleIcon'
                    />
                  </i>
                </Menu.Items>
              )}
            </AnimatePresence>
          </>
        )}
      </Menu>
    </>
  );
}
