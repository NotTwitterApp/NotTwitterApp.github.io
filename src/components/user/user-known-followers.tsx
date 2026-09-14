import Link from 'next/link';
import cn from 'clsx';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { formatNumber } from '@lib/date';
import { getUserTabPath } from '@lib/routes';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { NextImage } from '@components/ui/next-image';
import type { User, UserKnownFollower } from '@lib/types/user';

import type { JSX } from 'react';

type UserKnownFollowersProps = Pick<
  User,
  'id' | 'username' | 'knownFollowers' | 'knownFollowersCount'
> & {
  className?: string;
};

function getKnownFollowerName(
  { name, username }: UserKnownFollower,
  hideBskySocialSuffix: boolean
): string {
  return (
    name || formatAtprotoDisplayIdentifier(username, { hideBskySocialSuffix })
  );
}

function KnownFollowersText({
  knownFollowers,
  knownFollowersCount
}: Pick<
  UserKnownFollowersProps,
  'knownFollowers' | 'knownFollowersCount'
>): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const namedFollowers = knownFollowers.slice(0, 2);
  const remainingCount = Math.max(
    0,
    knownFollowersCount - namedFollowers.length
  );

  if (!namedFollowers.length)
    return (
      <>
        Followed by {formatNumber(knownFollowersCount)}{' '}
        {knownFollowersCount === 1 ? 'person' : 'people'} you follow
      </>
    );

  return (
    <>
      Followed by{' '}
      {namedFollowers.map((knownFollower, index) => (
        <span key={knownFollower.id}>
          {index > 0 && (remainingCount > 0 ? ', ' : ' and ')}
          <span className='text-light-secondary dark:text-dark-secondary'>
            {getKnownFollowerName(knownFollower, hideBskySocialSuffix)}
          </span>
        </span>
      ))}
      {remainingCount > 0 && (
        <>
          {namedFollowers.length > 1 ? ', and ' : ' and '}
          {formatNumber(remainingCount)}{' '}
          {remainingCount === 1 ? 'other' : 'others'} you follow
        </>
      )}
    </>
  );
}

export function UserKnownFollowers({
  id,
  username,
  knownFollowers,
  knownFollowersCount,
  className
}: UserKnownFollowersProps): JSX.Element | null {
  const { user: authUser } = useAuth();

  if (authUser?.id === id || knownFollowersCount <= 0) return null;

  const displayedFollowers = knownFollowers.slice(0, 3);

  return (
    <Link href={getUserTabPath(username, 'followers_you_follow')}>
      <a
        className={cn(
          `accent-tab flex max-w-full items-center gap-2 text-[13px] leading-4
           text-light-secondary outline-none hover:underline focus-visible:underline
           dark:text-dark-secondary`,
          className
        )}
        aria-label='Followers you know'
      >
        {displayedFollowers.length > 0 && (
          <span className='flex shrink-0 -space-x-1.5' aria-hidden>
            {displayedFollowers.map(({ id, name, photoURL }, index) => (
              <span
                className='profile-picture relative flex h-5 w-5 overflow-hidden border-2
                           border-main-background bg-main-background dark:border-main-background'
                style={{ zIndex: displayedFollowers.length - index }}
                key={id}
              >
                <NextImage
                  useSkeleton
                  imgClassName='profile-picture'
                  width={20}
                  height={20}
                  src={photoURL}
                  alt={name}
                />
              </span>
            ))}
          </span>
        )}
        <span className='min-w-0'>
          <KnownFollowersText
            knownFollowers={knownFollowers}
            knownFollowersCount={knownFollowersCount}
          />
        </span>
      </a>
    </Link>
  );
}
