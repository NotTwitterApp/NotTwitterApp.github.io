import { Dialog } from '@headlessui/react';
import { MainHeader } from '@components/home/main-header';
import type { ReactNode, JSX } from 'react';
import type { StatsType } from '@components/view/view-tweet-stats';

type TweetStatsModalProps = {
  children: ReactNode;
  statsType: StatsType | null;
  handleClose: () => void;
};

const titleByStatsType: Readonly<Record<StatsType, string>> = {
  likes: 'Liked by',
  retweets: 'Retweeted by',
  quotes: 'Quote Tweets'
};

export function TweetStatsModal({
  children,
  statsType,
  handleClose
}: TweetStatsModalProps): JSX.Element {
  return (
    <>
      <Dialog.Title as='span' className='sr-only'>
        {statsType ? titleByStatsType[statsType] : 'Tweet activity'}
      </Dialog.Title>
      <MainHeader
        useActionButton
        disableSticky
        tip='Close'
        iconName='XMarkIcon'
        className='absolute flex w-full items-center gap-6 rounded-tl-2xl'
        title={statsType ? titleByStatsType[statsType] : ''}
        action={handleClose}
      />
      {children}
    </>
  );
}
