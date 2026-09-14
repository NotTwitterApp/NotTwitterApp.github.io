import { useState, type JSX } from 'react';
import { Dialog } from '@headlessui/react';
import { useAuth } from '@lib/context/auth-context';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon } from '@components/ui/hero-icon';
import { Button } from '@components/ui/button';
import { Modal } from '@components/modal/modal';
import type { ChangeEvent, FormEvent } from 'react';

type BlueskySignInModalProps = {
  open: boolean;
  closeModal: () => void;
};

export function BlueskySignInModal({
  open,
  closeModal
}: BlueskySignInModalProps): JSX.Element {
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

  const handleModalClose = (): void => {
    if (loading) return;
    closeModal();
    setErrorMessage('');
  };

  const handleSignIn = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!trimmedIdentifier) {
      setErrorMessage('Enter your Bluesky handle or DID.');
      return;
    }

    setLoading(true);

    try {
      await signInWithBluesky(trimmedIdentifier);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to start sign in.'
      );
      setLoading(false);
    }
  };

  return (
    <Modal
      modalClassName='relative flex min-h-[520px] w-full max-w-xl flex-col rounded-2xl bg-main-background px-8 py-4'
      open={open}
      closeModal={handleModalClose}
    >
      <form
        className='flex flex-1 flex-col text-main-primary'
        onSubmit={handleSignIn}
      >
        <div className='relative mb-8 flex min-h-[40px] items-center justify-center'>
          <Button
            className='absolute left-0 p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
            onClick={handleModalClose}
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
          Sign in to Not Twitter
        </Dialog.Title>
        <div className='flex flex-col gap-2'>
          <label
            className='relative rounded border border-light-line-reply transition focus-within:border-main-accent
                       focus-within:ring-1 focus-within:ring-main-accent dark:border-dark-border'
            htmlFor='bluesky-identifier'
          >
            <span className='absolute left-3 top-2 text-sm text-main-secondary'>
              Bluesky handle or DID
            </span>
            <span className='mt-6 flex items-center px-3 pb-2'>
              <CustomIcon
                className='mr-2 h-5 w-5 shrink-0 text-main-secondary'
                iconName='TwitterAtIcon'
              />
              <input
                className='min-w-0 flex-1 bg-transparent text-lg outline-none'
                id='bluesky-identifier'
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
