import { formatDate } from '@lib/date';
import {
  formatProfileBirthday,
  isProfileBirthdayToday
} from '@lib/profile-birthday';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { TweetText } from '@components/tweet/tweet-text';
import { HeroIcon } from '@components/ui/hero-icon';
import { CustomIcon } from '@components/ui/custom-icon';
import { ToolTip } from '@components/ui/tooltip';
import { UserName } from './user-name';
import { UserFollowing } from './user-following';
import { UserFollowStats } from './user-follow-stats';
import { UserKnownFollowers } from './user-known-followers';
import type { IconName } from '@components/ui/hero-icon';
import type { User } from '@lib/types/user';

import type { JSX } from 'react';

type UserDetailsProps = Pick<
  User,
  | 'id'
  | 'bio'
  | 'pronouns'
  | 'birthday'
  | 'name'
  | 'website'
  | 'username'
  | 'verified'
  | 'createdAt'
  | 'following'
  | 'followingCount'
  | 'followersCount'
  | 'knownFollowers'
  | 'knownFollowersCount'
>;

type DetailType = 'website' | 'birthday' | 'joined';

type DetailIcon = {
  detail: string | null;
  icon: IconName | 'TwitterBirthdayIcon';
  type: DetailType;
};

function getExternalHref(value: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
}

export function UserDetails({
  id,
  bio,
  pronouns,
  birthday,
  name,
  website,
  username,
  verified,
  createdAt,
  following,
  followingCount,
  followersCount,
  knownFollowers,
  knownFollowersCount
}: UserDetailsProps): JSX.Element {
  const { user: authUser } = useAuth();
  const { hideBskySocialSuffix } = useTheme();
  const displayUsername = formatAtprotoDisplayIdentifier(username, {
    hideBskySocialSuffix
  });
  const isBirthdayToday = isProfileBirthdayToday(birthday);
  const birthdayLabel = birthday ? formatProfileBirthday(birthday) : null;
  const birthdayCelebration = isBirthdayToday
    ? authUser?.id === id
      ? 'Today is your birthday!'
      : 'Today is their birthday!'
    : null;
  const detailIcons: Readonly<DetailIcon[]> = [
    { detail: website, icon: 'LinkIcon', type: 'website' },
    {
      detail: birthdayLabel,
      icon: 'TwitterBirthdayIcon',
      type: 'birthday'
    },
    {
      detail: `Joined ${formatDate(createdAt, 'joined')}`,
      icon: 'CalendarDaysIcon',
      type: 'joined'
    }
  ];

  return (
    <div className='flex flex-col gap-3 text-[15px] leading-5'>
      <div className='min-w-0'>
        <UserName
          className='text-xl leading-6'
          name={name}
          iconClassName='h-5 w-5'
          verified={verified}
        />
        <div
          className='-mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0
                     text-light-secondary dark:text-dark-secondary'
        >
          <p>{displayUsername}</p>
          {pronouns && <p>{pronouns}</p>}
          <UserFollowing userTargetId={id} userTargetFollowing={following} />
        </div>
      </div>
      {bio && <TweetText className='leading-5' text={bio} />}
      <div
        className='flex flex-wrap items-center gap-x-3 gap-y-0.5
                   text-light-secondary dark:text-dark-secondary'
      >
        {detailIcons.map(({ detail, icon, type }) =>
          detail ? (
            <div className='flex max-w-full items-center gap-1' key={type}>
              <i className='inline-flex shrink-0 items-center leading-none'>
                {icon === 'TwitterBirthdayIcon' ? (
                  <CustomIcon className='h-[18px] w-[18px]' iconName={icon} />
                ) : (
                  <HeroIcon className='h-[18px] w-[18px]' iconName={icon} />
                )}
              </i>
              {type === 'website' ? (
                <a
                  className='custom-underline min-w-0 max-w-full truncate text-main-accent'
                  href={getExternalHref(detail)}
                  target='_blank'
                  rel='noreferrer'
                >
                  {detail}
                </a>
              ) : type === 'joined' ? (
                <button className='custom-underline group relative inline-flex min-w-0 max-w-full'>
                  <span className='truncate'>{detail}</span>
                  <ToolTip
                    className='translate-y-1'
                    tip={formatDate(createdAt, 'full')}
                  />
                </button>
              ) : (
                <span className='min-w-0 max-w-full'>
                  {detail}
                  {birthdayCelebration && (
                    <span className='font-medium text-main-accent'>
                      {' '}
                      · {birthdayCelebration}
                    </span>
                  )}
                </span>
              )}
            </div>
          ) : null
        )}
      </div>
      <UserFollowStats
        followingCount={followingCount}
        followersCount={followersCount}
      />
      <UserKnownFollowers
        id={id}
        username={username}
        knownFollowers={knownFollowers}
        knownFollowersCount={knownFollowersCount}
      />
    </div>
  );
}
