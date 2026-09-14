import { AnimatePresence } from 'framer-motion';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { doc, query, where, orderBy } from '@lib/atproto/store';
import { useCollection } from '@lib/hooks/useCollection';
import { useDocument } from '@lib/hooks/useDocument';
import { tweetsCollection } from '@lib/atproto/collections';
import { useTheme } from '@lib/context/theme-context';
import { useUser } from '@lib/context/user-context';
import { PublicUserLayout } from '@components/layout/common-layout';
import { SEO } from '@components/common/seo';
import { UserDataLayout } from '@components/layout/user-data-layout';
import { UserHomeLayout } from '@components/layout/user-home-layout';
import { Tweet } from '@components/tweet/tweet';
import { Loading } from '@components/ui/loading';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { TweetWithParent } from '@components/tweet/tweet-with-parent';
import type { ReactElement, ReactNode, JSX } from 'react';

export default function UserWithReplies(): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const { user } = useUser();

  const { id, name, username, pinnedTweet } = user ?? {};
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
  const timelineQueryDisabled = queriesDisabled || awaitingPinnedTweet;

  const { data, loading } = useCollection(
    query(
      tweetsCollection,
      where('createdBy', '==', id),
      orderBy('createdAt', 'desc')
    ),
    { includeUser: true, allowNull: true, disabled: timelineQueryDisabled }
  );

  const availableTweets = awaitingPinnedTweet ? null : data;
  const timelineTweets = pinnedTweet
    ? (availableTweets?.filter(({ id }) => id !== pinnedTweet) ?? null)
    : availableTweets;

  const timelineLoading = awaitingPinnedTweet || loading;
  const hasProfileTweets = !!pinnedData || !!timelineTweets?.length;

  return (
    <section>
      <SEO
        title={`Tweets with replies by ${
          name as string
        } (${displayUsername}) / Not Twitter`}
      />
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
          {timelineTweets && <TweetWithParent data={timelineTweets} />}
        </AnimatePresence>
      )}
    </section>
  );
}

UserWithReplies.getLayout = (page: ReactElement<any>): ReactNode => (
  <PublicUserLayout>
    <UserDataLayout>
      <UserHomeLayout>{page}</UserHomeLayout>
    </UserDataLayout>
  </PublicUserLayout>
);
