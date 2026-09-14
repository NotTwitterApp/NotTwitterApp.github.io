import Link from 'next/link';
import cn from 'clsx';
import { useWindow } from '@lib/context/window-context';
import { formatNumber } from '@lib/date';
import { getUserPath } from '@lib/routes';
import { FollowButton } from '@components/ui/follow-button';
import { NextImage } from '@components/ui/next-image';
import { TweetText } from '@components/tweet/tweet-text';
import { UserAvatar } from './user-avatar';
import { UserName } from './user-name';
import { UserFollowing } from './user-following';
import { UserKnownFollowers } from './user-known-followers';
import { UserUsername } from './user-username';
import type { ReactNode, JSX } from 'react';
import type { User } from '@lib/types/user';

type UserTooltipProps = Pick<
  User,
  | 'id'
  | 'bio'
  | 'name'
  | 'verified'
  | 'username'
  | 'photoURL'
  | 'following'
  | 'followers'
  | 'followingCount'
  | 'followersCount'
  | 'knownFollowers'
  | 'knownFollowersCount'
  | 'blocking'
  | 'blockedBy'
  | 'blockingByListName'
  | 'coverPhotoURL'
> & {
  modal?: boolean;
  avatar?: boolean;
  children: ReactNode;
};

type Stats = [string, string, number];

export function UserTooltip({
  id,
  bio,
  name,
  modal,
  avatar,
  verified,
  children,
  photoURL,
  username,
  following,
  followers,
  followingCount,
  followersCount,
  knownFollowers,
  knownFollowersCount,
  blocking,
  blockedBy,
  blockingByListName,
  coverPhotoURL
}: UserTooltipProps): JSX.Element {
  const { isMobile } = useWindow();

  if (isMobile || modal) return <>{children}</>;

  const userLink = getUserPath(username);

  const allStats: Readonly<Stats[]> = [
    ['following', 'Following', followingCount],
    ['followers', 'Followers', followersCount]
  ];
  const exactNumber = new Intl.NumberFormat('en-GB');

  return (
    <div
      className={cn(
        'group relative z-0 self-start text-light-primary hover:z-[70] focus-within:z-[70] dark:text-dark-primary',
        avatar ? '[&>div]:translate-y-2' : 'grid [&>div]:translate-y-7'
      )}
    >
      {children}
      <div
        className='menu-container invisible absolute left-1/2 z-[80] w-72 -translate-x-1/2 rounded-2xl 
                   opacity-0 [transition:visibility_0ms_ease_400ms,opacity_200ms_ease_200ms] group-hover:visible 
                   group-hover:opacity-100 group-hover:delay-500'
      >
        <div className='flex flex-col gap-3 p-4'>
          <div className='flex flex-col gap-2'>
            <div className='-mx-4 -mt-4'>
              {coverPhotoURL ? (
                <Link href={userLink} className='blur-picture'>
                  <NextImage
                    useSkeleton
                    className='relative h-24'
                    imgClassName='rounded-t-2xl'
                    src={coverPhotoURL}
                    alt={name}
                    layout='fill'
                  />
                </Link>
              ) : (
                <div className='h-16 rounded-t-2xl bg-light-line-reply dark:bg-dark-line-reply' />
              )}
            </div>
            <div className='flex justify-between'>
              <div className='mb-10'>
                <UserAvatar
                  className='profile-picture-frame absolute -translate-y-1/2 bg-main-background p-1
                             [&:hover>figure>span]:bg-black/10
                             [&>figure>span]:[transition:background-color_200ms]'
                  src={photoURL}
                  alt={name}
                  size={64}
                  username={username}
                />
              </div>
              <FollowButton
                userTargetId={id}
                userTargetUsername={username}
                userTargetFollowers={followers}
                userTargetFollowing={following}
                userTargetBlocking={blocking}
                userTargetBlockedBy={blockedBy}
                userTargetBlockingByListName={blockingByListName}
              />
            </div>
            <div>
              <UserName
                className='-mb-1 text-lg'
                name={name}
                username={username}
                verified={verified}
              />
              <div className='flex items-center gap-1 text-light-secondary dark:text-dark-secondary'>
                <UserUsername username={username} />
                <UserFollowing
                  userTargetId={id}
                  userTargetFollowing={following}
                />
              </div>
            </div>
          </div>
          {bio && <TweetText text={bio} />}
          <div className='text-secondary flex gap-4'>
            {allStats.map(([id, label, stat]) => (
              <Link
                href={`${userLink}/${id}`}
                key={id}
                className='hover-animation flex h-4 items-center gap-1 border-b border-b-transparent 
                           outline-none hover:border-b-light-primary focus-visible:border-b-light-primary
                           dark:hover:border-b-dark-primary dark:focus-visible:border-b-dark-primary'
                title={`${exactNumber.format(stat)} ${label}`}
              >
                <p className='font-bold'>{formatNumber(stat)}</p>
                <p className='text-light-secondary dark:text-dark-secondary'>
                  {label}
                </p>
              </Link>
            ))}
          </div>
          <UserKnownFollowers
            className='-mt-0.5'
            id={id}
            username={username}
            knownFollowers={knownFollowers}
            knownFollowersCount={knownFollowersCount}
          />
        </div>
      </div>
    </div>
  );
}
