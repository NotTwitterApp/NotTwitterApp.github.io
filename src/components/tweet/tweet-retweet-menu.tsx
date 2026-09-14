import cn from 'clsx';
import { Popover } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { preventBubbling } from '@lib/utils';
import { useModal } from '@lib/hooks/useModal';
import { Modal } from '@components/modal/modal';
import { TweetQuoteModal } from '@components/modal/tweet-quote-modal';
import { Button } from '@components/ui/button';
import { CustomIcon } from '@components/ui/custom-icon';
import { ToolTip } from '@components/ui/tooltip';
import { NumberStats } from './number-stats';
import { variants } from './tweet-actions';
import type { TweetWithUser } from '@lib/types/tweet';

import type { JSX } from 'react';

type TweetRetweetMenuProps = {
  tip: string;
  move?: number;
  stats?: number;
  disabled?: boolean;
  retweeted: boolean;
  viewTweet?: boolean;
  quoteTweet?: TweetWithUser | null;
  className?: string;
  iconClassName: string;
  iconSizeClassName?: string;
  statsContainerClassName?: string;
  onRetweet: () => Promise<void> | void;
  onQuoteTweetSent?: (tweet: TweetWithUser) => void;
};

export function TweetRetweetMenu({
  tip,
  move,
  stats,
  disabled,
  retweeted,
  viewTweet,
  quoteTweet,
  className,
  iconClassName,
  iconSizeClassName,
  statsContainerClassName,
  onRetweet,
  onQuoteTweetSent
}: TweetRetweetMenuProps): JSX.Element {
  const { open: modalOpen, openModal, closeModal } = useModal();

  const handleRetweet = (closeMenu: () => void) => (): void => {
    closeMenu();
    void onRetweet();
  };

  const handleQuoteTweet = (closeMenu: () => void) => (): void => {
    closeMenu();
    if (quoteTweet) openModal();
  };

  return (
    <>
      <Modal
        className='flex items-start justify-center'
        modalClassName='mt-8 w-full max-w-xl rounded-2xl bg-main-background'
        open={modalOpen}
        closeModal={closeModal}
      >
        {quoteTweet && (
          <TweetQuoteModal
            tweet={quoteTweet}
            closeModal={closeModal}
            onQuoteTweetSent={onQuoteTweetSent}
          />
        )}
      </Modal>
      <Popover className='relative'>
        {({ open, close }): JSX.Element => (
          <>
            <Popover.Button
              className={cn(
                `tweet-action-button group flex items-center p-0 outline-none transition-colors
                 duration-200 ease-out disabled:cursor-not-allowed
                 inner:transition-colors inner:duration-200 inner:ease-out`,
                disabled && 'cursor-not-allowed opacity-50',
                open && 'text-accent-green inner:bg-accent-green/10',
                className
              )}
              aria-label={tip}
              aria-disabled={disabled}
              disabled={disabled}
              onClick={preventBubbling(null, true)}
            >
              <i
                className={cn(
                  `tweet-action-icon-shell relative rounded-full not-italic
                   group-focus-visible:ring-2`,
                  viewTweet
                    ? 'tweet-action-icon-shell--large'
                    : 'tweet-action-icon-shell--normal',
                  iconClassName
                )}
              >
                <CustomIcon
                  className={
                    iconSizeClassName ??
                    (viewTweet
                      ? 'h-[22.5px] w-[22.5px]'
                      : 'h-[18.75px] w-[18.75px]')
                  }
                  iconName='TwitterRetweetIcon'
                />
                {!open && <ToolTip tip={tip} />}
              </i>
              {!viewTweet && (
                <NumberStats
                  className='tweet-action-count-text min-w-[10px] text-left text-[13px] leading-4'
                  containerClassName={
                    statsContainerClassName ?? 'tweet-action-count -ml-1.5'
                  }
                  move={move as number}
                  stats={stats as number}
                />
              )}
            </Popover.Button>
            <AnimatePresence>
              {open && (
                <Popover.Panel
                  className='menu-container absolute left-1/2 top-10 z-20 w-52 -translate-x-1/2
                             overflow-hidden py-2 text-[15px] font-bold text-light-primary
                             dark:text-dark-primary'
                  as={motion.div}
                  {...variants}
                  static
                >
                  <Popover.Button
                    className='accent-tab flex w-full items-center gap-3 rounded-none px-4 py-3
                               hover:bg-main-sidebar-background'
                    as={Button}
                    onClick={preventBubbling(handleRetweet(close))}
                  >
                    <CustomIcon
                      className='h-[18.75px] w-[18.75px]'
                      iconName='TwitterRetweetIcon'
                    />
                    {retweeted ? 'Undo Retweet' : 'Retweet'}
                  </Popover.Button>
                  <Popover.Button
                    className='accent-tab flex w-full items-center gap-3 rounded-none px-4 py-3
                               hover:bg-main-sidebar-background disabled:opacity-50'
                    as={Button}
                    disabled={!quoteTweet}
                    onClick={preventBubbling(handleQuoteTweet(close))}
                  >
                    <CustomIcon
                      className='h-[18.75px] w-[18.75px]'
                      iconName='FeatherIcon'
                    />
                    Quote Tweet
                  </Popover.Button>
                </Popover.Panel>
              )}
            </AnimatePresence>
          </>
        )}
      </Popover>
    </>
  );
}
