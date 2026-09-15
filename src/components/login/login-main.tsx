import { useModal } from '@lib/hooks/useModal';
import { NextImage } from '@components/ui/next-image';
import { CustomIcon } from '@components/ui/custom-icon';
import { Button } from '@components/ui/button';
import { TwemojiScope } from '@components/ui/twemoji-scope';
import { BlueskySignInModal } from './bluesky-sign-in-modal';

import type { JSX } from 'react';

export function LoginMain(): JSX.Element {
  const {
    open: signInOpen,
    openModal: openSignInModal,
    closeModal: closeSignInModal
  } = useModal();

  return (
    <>
      <BlueskySignInModal open={signInOpen} closeModal={closeSignInModal} />
      <TwemojiScope
        as='main'
        className='grid text-main-primary lg:grid-cols-[minmax(0,1fr)_45vw]'
      >
        <div className='relative hidden items-center justify-center  lg:flex'>
          <NextImage
            className='absolute inset-0'
            imgClassName='object-cover'
            blurClassName='bg-accent-blue'
            src='/assets/twitter-banner.png'
            alt='Not Twitter banner'
            fill
            useSkeleton
          />
          <i className='absolute'>
            <CustomIcon
              className='h-96 w-96 text-white'
              iconName='TwitterIcon'
            />
          </i>
        </div>
        <div className='flex flex-col items-center justify-between gap-6 p-8 lg:items-start lg:justify-center'>
          <i className='mb-0 self-center lg:mb-10 lg:self-auto'>
            <CustomIcon
              className='-mt-4 h-6 w-6 text-accent-blue lg:h-12 lg:w-12 dark:lg:text-twitter-icon'
              iconName='TwitterIcon'
            />
          </i>
          <div className='flex max-w-xs flex-col gap-4 font-twitter-chirp-extended lg:max-w-none lg:gap-16'>
            <h1
              className='text-3xl before:content-["See_what’s_happening_in_the_world_right_now."]
                         lg:text-6xl lg:before:content-["Happening_now"]'
            />
            <h2 className='hidden text-xl lg:block lg:text-3xl'>
              Join Not Twitter today.
            </h2>
          </div>
          <div className='flex w-full max-w-xs flex-col gap-3'>
            <a
              className='accent-tab flex min-h-[40px] items-center justify-center rounded-full bg-main-accent px-4
                         py-2 text-center font-bold text-white transition hover:bg-main-accent/90
                         focus-visible:bg-main-accent/90 active:bg-main-accent/80'
              href='https://bsky.app/'
              target='_blank'
              rel='noreferrer'
            >
              Create account
            </a>
            <p className='text-sm leading-5 text-main-secondary'>
              Create your account on Bluesky, then come back here and sign in
              with your handle or DID.
            </p>
            <p className='pt-8 font-bold text-main-primary'>
              Already have an account?
            </p>
            <Button
              className='border border-light-line-reply font-bold text-accent-blue transition hover:bg-accent-blue/10
                         focus-visible:bg-accent-blue/10 focus-visible:!ring-accent-blue/80 active:bg-accent-blue/20
                         dark:border-light-secondary'
              onClick={openSignInModal}
            >
              Sign in
            </Button>
          </div>
        </div>
      </TwemojiScope>
    </>
  );
}
