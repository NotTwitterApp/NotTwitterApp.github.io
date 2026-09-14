import { AnimatePresence } from 'framer-motion';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { query, where } from '@lib/atproto/store';
import { useCollection } from '@lib/hooks/useCollection';
import { tweetsCollection } from '@lib/atproto/collections';
import { useTheme } from '@lib/context/theme-context';
import { useUser } from '@lib/context/user-context';
import { mergeData } from '@lib/merge';
import { PublicUserLayout } from '@components/layout/common-layout';
import { SEO } from '@components/common/seo';
import { UserDataLayout } from '@components/layout/user-data-layout';
import { UserHomeLayout } from '@components/layout/user-home-layout';
import { Tweet } from '@components/tweet/tweet';
import { Loading } from '@components/ui/loading';
import { StatsEmpty } from '@components/tweet/stats-empty';
import type { ReactElement, ReactNode, JSX } from 'react';

export default function UserMedia(): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const { user } = useUser();

  const { id, name, username } = user ?? {};
  const displayUsername = formatAtprotoDisplayIdentifier(username, {
    hideBskySocialSuffix
  });
  const profileRestricted = !!user?.blocking || !!user?.blockedBy;
  const queriesDisabled = !id || profileRestricted;

  const { data, loading } = useCollection(
    query(
      tweetsCollection,
      where('createdBy', '==', id),
      where('images', '!=', null)
    ),
    { includeUser: true, allowNull: true, disabled: queriesDisabled }
  );

  const sortedTweets = mergeData(true, data);

  return (
    <section>
      <SEO
        title={`Media Tweets by ${
          name as string
        } (${displayUsername}) / Not Twitter`}
      />
      {loading ? (
        <Loading className='mt-5' />
      ) : !sortedTweets ? (
        <StatsEmpty
          title={`${displayUsername} hasn't Tweeted Media`}
          description='Once they do, those Tweets will show up here.'
          imageData={{ src: '/assets/no-media.png', alt: 'No media' }}
        />
      ) : (
        <AnimatePresence>
          {sortedTweets.map((tweet) => (
            <Tweet {...tweet} key={tweet.id} />
          ))}
        </AnimatePresence>
      )}
    </section>
  );
}

UserMedia.getLayout = (page: ReactElement<any>): ReactNode => (
  <PublicUserLayout>
    <UserDataLayout>
      <UserHomeLayout>{page}</UserHomeLayout>
    </UserDataLayout>
  </PublicUserLayout>
);
