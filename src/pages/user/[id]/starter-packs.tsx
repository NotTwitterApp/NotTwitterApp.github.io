import { useEffect, useState, type JSX } from 'react';
import useSWR from 'swr';
import {
  getProfileStarterPacks,
  type ProfileStarterPack,
  type ProfileStarterPacksPage
} from '@lib/atproto/backend';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { formatNumber } from '@lib/date';
import { useTheme } from '@lib/context/theme-context';
import { useUser } from '@lib/context/user-context';
import { PublicUserLayout } from '@components/layout/common-layout';
import { SEO } from '@components/common/seo';
import { UserDataLayout } from '@components/layout/user-data-layout';
import { UserHomeLayout } from '@components/layout/user-home-layout';
import { UserProfileResourceRow } from '@components/user/user-profile-resource-row';
import { Button } from '@components/ui/button';
import { Error as ErrorMessage } from '@components/ui/error';
import { Loading } from '@components/ui/loading';
import { StatsEmpty } from '@components/tweet/stats-empty';
import type { ReactElement, ReactNode } from 'react';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function mergeStarterPacks(
  currentPacks: ProfileStarterPack[],
  nextPacks: ProfileStarterPack[]
): ProfileStarterPack[] {
  const seenUris = new Set(currentPacks.map(({ uri }) => uri));
  return [
    ...currentPacks,
    ...nextPacks.filter(({ uri }) => !seenUris.has(uri))
  ];
}

function getStarterPackSubtitle(
  { listItemCount, feedCount, creatorUsername }: ProfileStarterPack,
  hideBskySocialSuffix: boolean
): string {
  const profileLabel = `${formatNumber(listItemCount)} ${
    listItemCount === 1 ? 'profile' : 'profiles'
  }`;
  const feedLabel =
    feedCount > 0
      ? `${formatNumber(feedCount)} ${feedCount === 1 ? 'feed' : 'feeds'}`
      : null;

  return [
    profileLabel,
    feedLabel,
    formatAtprotoDisplayIdentifier(creatorUsername, { hideBskySocialSuffix })
  ]
    .filter(Boolean)
    .join(' - ');
}

function getStarterPackFooter({
  creatorName,
  joinedAllTimeCount,
  joinedWeekCount
}: ProfileStarterPack): string {
  if (joinedWeekCount || joinedAllTimeCount)
    return `${formatNumber(joinedWeekCount)} joined this week - ${formatNumber(
      joinedAllTimeCount
    )} all time`;

  return `Created by ${creatorName}`;
}

export default function UserStarterPacks(): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const { user } = useUser();
  const actor = user?.id ?? null;
  const [starterPacks, setStarterPacks] = useState<ProfileStarterPack[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const starterPacksKey = actor
    ? (['profile-starter-packs', actor] as const)
    : null;

  const { data, error } = useSWR<ProfileStarterPacksPage, Error>(
    starterPacksKey,
    () => getProfileStarterPacks(actor as string),
    { revalidateOnFocus: false }
  );
  const loading = !data && !error;

  useEffect(() => {
    if (!data) return;

    setStarterPacks(data.starterPacks);
    setCursor(data.cursor);
  }, [data]);

  const loadMore = async (): Promise<void> => {
    if (!actor || !cursor || loadingMore) return;

    setLoadingMore(true);

    try {
      const nextPage = await getProfileStarterPacks(actor, cursor);

      setCursor(nextPage.cursor);
      setStarterPacks((currentPacks) =>
        mergeStarterPacks(currentPacks, nextPage.starterPacks)
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const { name, username } = user ?? {};
  const displayUsername = formatAtprotoDisplayIdentifier(username, {
    hideBskySocialSuffix
  });

  return (
    <section>
      <SEO
        title={`Starter Packs by ${
          name as string
        } (${displayUsername}) / Not Twitter`}
      />
      {loading ? (
        <Loading className='mt-5' />
      ) : error ? (
        <ErrorMessage message={getErrorMessage(error)} />
      ) : starterPacks.length ? (
        <>
          {starterPacks.map((starterPack) => (
            <UserProfileResourceRow
              href={starterPack.url}
              title={starterPack.name}
              subtitle={getStarterPackSubtitle(
                starterPack,
                hideBskySocialSuffix
              )}
              description={starterPack.description}
              footer={getStarterPackFooter(starterPack)}
              imageUrl={starterPack.creatorAvatar}
              imageAlt={starterPack.creatorName}
              fallbackIcon='UserGroupIcon'
              key={starterPack.uri}
            />
          ))}
          {cursor && (
            <div className='border-b border-light-border px-4 py-3 text-center dark:border-dark-border'>
              <Button
                className='accent-tab inline-flex h-10 items-center justify-center rounded-full border border-light-border px-5 py-0 text-center font-bold dark:border-dark-border'
                loading={loadingMore}
                onClick={(): void => void loadMore()}
              >
                Show more
              </Button>
            </div>
          )}
        </>
      ) : (
        <StatsEmpty
          title={`${displayUsername} hasn't created any Starter Packs`}
          description='When they make Starter Packs for people and feeds, they will show up here.'
        />
      )}
    </section>
  );
}

UserStarterPacks.getLayout = (page: ReactElement<any>): ReactNode => (
  <PublicUserLayout>
    <UserDataLayout>
      <UserHomeLayout>{page}</UserHomeLayout>
    </UserDataLayout>
  </PublicUserLayout>
);
