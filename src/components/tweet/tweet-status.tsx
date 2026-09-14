import { motion } from 'framer-motion';
import { CustomIcon } from '@components/ui/custom-icon';
import { fromTop } from '@components/input/input-form';
import type { ReactNode, JSX } from 'react';

type TweetStatusProps = {
  type: 'pin' | 'tweet';
  children: ReactNode;
};

export function TweetStatus({ type, children }: TweetStatusProps): JSX.Element {
  return (
    <motion.div
      className='col-span-2 grid grid-cols-[48px,1fr] items-center gap-x-3
                 text-[13px] font-bold leading-5 text-light-secondary
                 dark:text-dark-secondary'
      {...fromTop}
    >
      <i className='flex h-5 w-5 items-center justify-center justify-self-end'>
        {type === 'pin' ? (
          <CustomIcon
            className='h-[18px] w-[18px] fill-current'
            iconName='TwitterPinIcon'
          />
        ) : (
          <CustomIcon
            className='h-4 w-4 fill-current'
            iconName='TwitterRetweetIcon'
          />
        )}
      </i>
      {children}
    </motion.div>
  );
}
