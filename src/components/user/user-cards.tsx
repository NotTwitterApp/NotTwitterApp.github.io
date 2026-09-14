import cn from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { Loading } from '@components/ui/loading';
import { variants } from '@components/user/user-header';
import { UserCard } from './user-card';
import type { User } from '@lib/types/user';
import type { StatsType } from '@components/view/view-tweet-stats';
import type { StatsEmptyProps } from '@components/tweet/stats-empty';

import type { JSX } from 'react';

type FollowType = 'following' | 'followers' | 'followers_you_follow';

type UserCardStatsType = Exclude<StatsType, 'quotes'>;

type CombinedTypes = UserCardStatsType | FollowType;

type UserCardsProps = {
  data: User[] | null;
  type: CombinedTypes;
  follow?: boolean;
  loading: boolean;
};

type NoStatsData = Record<CombinedTypes, StatsEmptyProps>;

const allNoStatsData: Readonly<NoStatsData> = {
  retweets: {
    title: 'Amplify Tweets you like',
    imageData: { src: '/assets/no-retweets.png', alt: 'No retweets' },
    description:
      'Share someone else’s Tweet on your timeline by Retweeting it. When you do, it’ll show up here.'
  },
  likes: {
    title: 'No Tweet Likes yet',
    imageData: { src: '/assets/no-likes.png', alt: 'No likes' },
    description: 'When you like a Tweet, it’ll show up here.'
  },
  following: {
    title: 'Be in the know',
    description:
      'Following accounts is an easy way to curate your timeline and know what’s happening with the topics and people you’re interested in.'
  },
  followers: {
    title: 'Looking for followers?',
    imageData: { src: '/assets/no-followers.png', alt: 'No followers' },
    description:
      'When someone follows this account, they’ll show up here. Tweeting and interacting with others helps boost followers.'
  },
  followers_you_follow: {
    title: 'No followers you know',
    description:
      'When people you follow also follow this account, they’ll show up here.'
  }
};

export function UserCards({
  data,
  type,
  follow,
  loading
}: UserCardsProps): JSX.Element {
  const noStatsData = allNoStatsData[type];
  const modal = ['retweets', 'likes'].includes(type);

  return (
    <section
      className={cn(
        modal && 'h-full overflow-y-auto [&>div:first-child>a]:mt-[52px]',
        loading && 'flex items-center justify-center'
      )}
    >
      {loading ? (
        <Loading className={modal ? 'mt-[52px]' : 'mt-5'} />
      ) : (
        <AnimatePresence>
          {data?.length ? (
            data.map((userData) => (
              <motion.div key={userData.id} {...variants}>
                <UserCard {...userData} follow={follow} modal={modal} />
              </motion.div>
            ))
          ) : (
            <StatsEmpty {...noStatsData} modal={modal} />
          )}
        </AnimatePresence>
      )}
    </section>
  );
}
