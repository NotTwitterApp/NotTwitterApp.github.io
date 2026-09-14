/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useMemo, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { formatNumber } from '@lib/date';
import { getUserPath } from '@lib/routes';
import { getProfileRouteId } from '@lib/static-routes';
import { NumberStats } from '@components/tweet/number-stats';
import type { User } from '@lib/types/user';

type UserFollowStatsProps = Pick<User, 'followingCount' | 'followersCount'>;
type Stats = [string, string, number, number];

export function UserFollowStats({
  followingCount,
  followersCount
}: UserFollowStatsProps): JSX.Element {
  const totalFollowing = followingCount;
  const totalFollowers = followersCount;

  const [{ currentFollowers, currentFollowing }, setCurrentStats] = useState({
    currentFollowing: totalFollowing,
    currentFollowers: totalFollowers
  });

  useEffect(() => {
    setCurrentStats({
      currentFollowing: totalFollowing,
      currentFollowers: totalFollowers
    });
  }, [totalFollowing, totalFollowers]);

  const followingMove = useMemo(
    () => (totalFollowing > currentFollowing ? -25 : 25),
    [totalFollowing]
  );

  const followersMove = useMemo(
    () => (totalFollowers > currentFollowers ? -25 : 25),
    [totalFollowers]
  );

  const {
    asPath,
    query: { id }
  } = useRouter();

  const routeId = (Array.isArray(id) ? id[0] : id) ?? getProfileRouteId(asPath);
  const userPath = getUserPath(routeId ?? '');

  const allStats: Readonly<Stats[]> = [
    ['Following', `${userPath}/following`, followingMove, currentFollowing],
    ['Follower', `${userPath}/followers`, followersMove, currentFollowers]
  ];
  const exactNumber = new Intl.NumberFormat('en-GB');

  return (
    <div
      className='flex gap-4 text-light-secondary dark:text-dark-secondary
                 [&>a>div]:font-bold [&>a>div]:text-light-primary 
                 dark:[&>a>div]:text-dark-primary'
    >
      {allStats.map(([title, link, move, stats], index) => (
        <Link
          href={link}
          key={title}
          className='hover-animation mt-0.5 mb-[3px] flex h-4 items-center gap-1 border-b 
                     border-b-transparent outline-none hover:border-b-light-primary 
                     focus-visible:border-b-light-primary dark:hover:border-b-dark-primary
                     dark:focus-visible:border-b-dark-primary'
          title={`${exactNumber.format(stats)} ${title}`}
        >
          <NumberStats
            move={move}
            stats={stats}
            alwaysShowStats
            label={formatNumber(stats)}
          />
          <p>{index === 1 && stats > 1 ? `${title}s` : title}</p>
        </Link>
      ))}
    </div>
  );
}
