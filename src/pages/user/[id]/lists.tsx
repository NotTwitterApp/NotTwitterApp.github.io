import { useEffect, useState, type JSX } from 'react';
import cn from 'clsx';
import useSWR from 'swr';
import {
  getProfileLists,
  type ProfileListsPage,
  type UserList
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

function getProfileLabel(count: number): string {
  return `${formatNumber(count)} ${count === 1 ? 'profile' : 'profiles'}`;
}

function mergeLists(
  currentLists: UserList[],
  nextLists: UserList[]
): UserList[] {
  const seenUris = new Set(currentLists.map(({ uri }) => uri));
  return [
    ...currentLists,
    ...nextLists.filter(({ uri }) => !seenUris.has(uri))
  ];
}

function ListStatus({
  viewerBlocked,
  viewerMuted,
  purpose
}: Pick<UserList, 'viewerBlocked' | 'viewerMuted' | 'purpose'>): JSX.Element {
  const label = viewerBlocked
    ? 'Blocked'
    : viewerMuted
      ? 'Muted'
      : purpose === 'moderation'
        ? 'Moderation'
        : 'List';

  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-3 py-0.5 text-sm font-bold',
        viewerBlocked || viewerMuted
          ? 'border-main-accent text-main-accent'
          : 'border-light-line-reply text-light-secondary dark:border-dark-line-reply dark:text-dark-secondary'
      )}
    >
      {label}
    </span>
  );
}

export default function UserLists(): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const { user } = useUser();
  const actor = user?.id ?? null;
  const [lists, setLists] = useState<UserList[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const listKey = actor ? (['profile-lists', actor] as const) : null;

  const { data, error } = useSWR<ProfileListsPage, Error>(
    listKey,
    () => getProfileLists(actor as string),
    { revalidateOnFocus: false }
  );
  const loading = !data && !error;

  useEffect(() => {
    if (!data) return;

    setLists(data.lists);
    setCursor(data.cursor);
  }, [data]);

  const loadMore = async (): Promise<void> => {
    if (!actor || !cursor || loadingMore) return;

    setLoadingMore(true);

    try {
      const nextPage = await getProfileLists(actor, cursor);

      setCursor(nextPage.cursor);
      setLists((currentLists) => mergeLists(currentLists, nextPage.lists));
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
        title={`Lists by ${name as string} (${displayUsername}) / Not Twitter`}
      />
      {loading ? (
        <Loading className='mt-5' />
      ) : error ? (
        <ErrorMessage message={getErrorMessage(error)} />
      ) : lists.length ? (
        <>
          {lists.map((list) => (
            <UserProfileResourceRow
              href={list.url}
              title={list.name}
              subtitle={`${getProfileLabel(
                list.listItemCount
              )} - ${formatAtprotoDisplayIdentifier(list.creatorUsername, {
                hideBskySocialSuffix
              })}`}
              description={list.description}
              footer={`Created by ${list.creatorName}`}
              imageUrl={list.avatar}
              imageAlt={list.name}
              fallbackIcon='ListBulletIcon'
              badge={
                <ListStatus
                  purpose={list.purpose}
                  viewerMuted={list.viewerMuted}
                  viewerBlocked={list.viewerBlocked}
                />
              }
              key={list.uri}
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
          title={`${displayUsername} hasn't created any Lists`}
          description='When they create public Lists, they will show up here.'
        />
      )}
    </section>
  );
}

UserLists.getLayout = (page: ReactElement<any>): ReactNode => (
  <PublicUserLayout>
    <UserDataLayout>
      <UserHomeLayout>{page}</UserHomeLayout>
    </UserDataLayout>
  </PublicUserLayout>
);
