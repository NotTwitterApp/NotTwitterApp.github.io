import { AnimatePresence } from 'framer-motion';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { doc, query, where } from '@lib/atproto/store';
import { useTheme } from '@lib/context/theme-context';
import { useUser } from '@lib/context/user-context';
import { useCollection } from '@lib/hooks/useCollection';
import { useDocument } from '@lib/hooks/useDocument';
import { tweetsCollection } from '@lib/atproto/collections';
import { mergeData } from '@lib/merge';
import { PublicUserLayout } from '@components/layout/common-layout';
import { UserDataLayout } from '@components/layout/user-data-layout';
import { UserHomeLayout } from '@components/layout/user-home-layout';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { Loading } from '@components/ui/loading';
import { Tweet } from '@components/tweet/tweet';
import type { ReactElement, ReactNode, JSX } from 'react';

export default function UserTweets(): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const { user } = useUser();

  const { id, username, pinnedTweet } = user ?? {};
  const displayUsername = formatAtprotoDisplayIdentifier(username, {
    hideBskySocialSuffix
  });
  const profileRestricted = !!user?.blocking || !!user?.blockedBy;
  const queriesDisabled = !id || profileRestricted;

  const { data: pinnedData, loading: pinnedLoading } = useDocument(
    doc(tweetsCollection, pinnedTweet ?? 'null'),
    {
      disabled: !pinnedTweet || profileRestricted,
      allowNull: true,
      includeUser: true
    }
  );
  const awaitingPinnedTweet = !!pinnedTweet && pinnedLoading;
  const timelineQueriesDisabled = queriesDisabled || awaitingPinnedTweet;

  const { data: ownerTweets, loading: ownerLoading } = useCollection(
    query(
      tweetsCollection,
      where('createdBy', '==', id),
      where('parent', '==', null)
    ),
    { includeUser: true, allowNull: true, disabled: timelineQueriesDisabled }
  );

  const { data: peopleTweets, loading: peopleLoading } = useCollection(
    query(
      tweetsCollection,
      where('createdBy', '!=', id),
      where('userRetweets', 'array-contains', id)
    ),
    { includeUser: true, allowNull: true, disabled: timelineQueriesDisabled }
  );

  const mergedTweets = awaitingPinnedTweet
    ? null
    : mergeData(true, ownerTweets, peopleTweets);
  const timelineTweets = pinnedTweet
    ? (mergedTweets?.filter(({ id }) => id !== pinnedTweet) ?? null)
    : mergedTweets;

  const hasProfileTweets = !!pinnedData || !!timelineTweets?.length;
  const timelineLoading =
    awaitingPinnedTweet ||
    (!hasProfileTweets && (ownerLoading || peopleLoading));

  return (
    <section>
      {timelineLoading ? (
        <Loading className='mt-5' />
      ) : !hasProfileTweets ? (
        <StatsEmpty
          title={`${displayUsername} hasn't tweeted`}
          description='When they do, their Tweets will show up here.'
        />
      ) : (
        <AnimatePresence>
          {pinnedData && (
            <Tweet pinned {...pinnedData} key={`pinned-${pinnedData.id}`} />
          )}
          {timelineTweets?.map((tweet) => (
            <Tweet {...tweet} profile={user} key={tweet.id} />
          ))}
        </AnimatePresence>
      )}
    </section>
  );
}

UserTweets.getLayout = (page: ReactElement<any>): ReactNode => (
  <PublicUserLayout>
    <UserDataLayout>
      <UserHomeLayout>{page}</UserHomeLayout>
    </UserDataLayout>
  </PublicUserLayout>
);
