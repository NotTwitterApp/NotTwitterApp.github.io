import { useState, type JSX } from 'react';
import cn from 'clsx';
import useSWR from 'swr';
import { getUserLists } from '@lib/atproto/backend';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useTheme } from '@lib/context/theme-context';
import { formatNumber } from '@lib/date';
import { HomeLayout, ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { MobileSidebar } from '@components/sidebar/mobile-sidebar';
import { CustomIcon } from '@components/ui/custom-icon';
import { Error } from '@components/ui/error';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { NextImage } from '@components/ui/next-image';
import { ToolTip } from '@components/ui/tooltip';
import type { ReactElement, ReactNode } from 'react';
import type {
  UserList,
  UserListsPage,
  UserListTab
} from '@lib/atproto/backend';

type ListsTabData = {
  label: string;
  value: UserListTab;
};

const listTabs: Readonly<ListsTabData[]> = [
  { label: 'Follow List', value: 'follow' },
  { label: 'Moderation List', value: 'moderation' }
];

function ListsTabs({
  activeTab,
  setActiveTab
}: {
  activeTab: UserListTab;
  setActiveTab: (tab: UserListTab) => void;
}): JSX.Element {
  return (
    <nav className='flex h-[53px] border-b border-light-border dark:border-dark-border'>
      {listTabs.map(({ label, value }) => {
        const active = activeTab === value;
        const selectTab = (): void => setActiveTab(value);

        return (
          <button
            className={cn(
              `accent-tab hover-card relative flex flex-1 items-center justify-center
               text-[15px] font-bold outline-none`,
              active
                ? 'text-light-primary dark:text-dark-primary'
                : 'text-light-secondary dark:text-dark-secondary'
            )}
            type='button'
            onClick={selectTab}
            key={value}
          >
            <span>{label}</span>
            {active && (
              <i className='absolute bottom-0 h-1 w-14 rounded-full bg-main-accent' />
            )}
          </button>
        );
      })}
    </nav>
  );
}

function ListAvatar({
  avatar,
  name
}: Pick<UserList, 'avatar' | 'name'>): JSX.Element {
  if (avatar)
    return (
      <NextImage
        className='h-14 w-14 shrink-0 overflow-hidden rounded-xl'
        imgClassName='rounded-xl'
        src={avatar}
        alt={name}
        width={56}
        height={56}
        useSkeleton
      />
    );

  return (
    <span
      className='flex h-14 w-14 shrink-0 items-center justify-center rounded-xl
                 bg-main-accent/10 text-main-accent'
      aria-hidden='true'
    >
      <CustomIcon className='h-7 w-7' iconName='TwitterListsIcon' />
    </span>
  );
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
        : 'Follow List';

  return (
    <span
      className='rounded-full border border-light-line-reply px-3 py-0.5 text-sm font-bold
                 text-light-secondary dark:border-dark-line-reply dark:text-dark-secondary'
    >
      {label}
    </span>
  );
}

function ListRow({ list }: { list: UserList }): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const {
    url,
    name,
    description,
    avatar,
    purpose,
    listItemCount,
    creatorName,
    creatorUsername,
    viewerMuted,
    viewerBlocked
  } = list;
  const memberLabel = `${formatNumber(listItemCount)} ${
    listItemCount === 1 ? 'member' : 'members'
  }`;
  const displayCreatorUsername = formatAtprotoDisplayIdentifier(
    creatorUsername,
    { hideBskySocialSuffix }
  );

  return (
    <a
      className='accent-tab hover-card flex gap-3 border-b border-light-border px-4 py-3
                 outline-none dark:border-dark-border'
      href={url}
      target='_blank'
      rel='noreferrer'
    >
      <ListAvatar avatar={avatar} name={name} />
      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='truncate text-[15px] font-bold leading-5'>{name}</p>
            <p className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
              {memberLabel} · {displayCreatorUsername}
            </p>
          </div>
          <ListStatus
            purpose={purpose}
            viewerMuted={viewerMuted}
            viewerBlocked={viewerBlocked}
          />
        </div>
        {description && (
          <p className='mt-1 max-h-10 overflow-hidden text-[15px] leading-5'>
            {description}
          </p>
        )}
        <p className='mt-2 truncate text-sm text-light-secondary dark:text-dark-secondary'>
          Created by {creatorName}
        </p>
      </div>
    </a>
  );
}

function ListsEmptyState({
  activeTab
}: {
  activeTab: UserListTab;
}): JSX.Element {
  const followList = activeTab === 'follow';

  return (
    <div className='mx-auto flex max-w-sm flex-col px-8 py-10'>
      <h2 className='text-[31px] font-extrabold leading-9'>
        {followList
          ? "You haven't made any Follow Lists yet"
          : 'No Moderation Lists yet'}
      </h2>
      <p className='mt-2 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
        {followList
          ? "When you create Follow Lists, they'll show up here as focused timelines you can come back to."
          : 'Mute or block Moderation Lists to manage whole groups of accounts from one place.'}
      </p>
    </div>
  );
}

export default function Lists(): JSX.Element {
  const [activeTab, setActiveTab] = useState<UserListTab>('follow');
  const listKey: readonly ['lists', UserListTab] = ['lists', activeTab];
  const { data, error } = useSWR<UserListsPage, Error>(listKey, () =>
    getUserLists(activeTab)
  );
  const loading = !data && !error;
  const lists = data?.lists ?? [];

  return (
    <MainContainer>
      <SEO title='Lists / Not Twitter' />
      <header className='hover-animation sticky top-0 z-20 bg-main-background/80 backdrop-blur-md'>
        <div className='flex h-[53px] items-center justify-between px-4'>
          <div className='flex min-w-0 items-center gap-8'>
            <MobileSidebar />
            <h2 className='truncate text-xl font-bold'>Lists</h2>
          </div>
          <button
            className='custom-button dark-bg-tab group relative cursor-not-allowed p-2 opacity-60
                       hover:bg-light-primary/10 active:bg-light-primary/20
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
            type='button'
            aria-label='New List'
            disabled
          >
            <HeroIcon className='h-5 w-5' iconName='PlusIcon' />
            <ToolTip tip='New List' />
          </button>
        </div>
        <ListsTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      </header>
      <section className='mt-0.5 xs:mt-0'>
        {loading ? (
          <Loading className='mt-5' />
        ) : error ? (
          <Error message='Something went wrong while loading your Lists.' />
        ) : lists.length ? (
          lists.map((list) => <ListRow list={list} key={list.uri} />)
        ) : (
          <ListsEmptyState activeTab={activeTab} />
        )}
      </section>
    </MainContainer>
  );
}

Lists.getLayout = (page: ReactElement<any>): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <HomeLayout>{page}</HomeLayout>
    </MainLayout>
  </ProtectedLayout>
);
