import { useRouter } from 'next/router';
import Link from 'next/link';
import cn from 'clsx';
import { getUserTabPath } from '@lib/routes';
import { getProfileRouteId, getProfileRouteView } from '@lib/static-routes';

import type { JSX } from 'react';

type UserNavLinkProps = {
  name: string;
  path: string;
  stationary?: boolean;
};

export function UserNavLink({
  name,
  path,
  stationary
}: UserNavLinkProps): JSX.Element {
  const {
    asPath,
    query: { id }
  } = useRouter();

  const routeId = (Array.isArray(id) ? id[0] : id) ?? getProfileRouteId(asPath);
  const routeView = getProfileRouteView(asPath);
  const userPath = getUserTabPath(routeId ?? '', path);
  const currentPath = asPath.split(/[?#]/)[0];
  const active =
    currentPath === userPath ||
    (path ? routeView === path : routeView === 'tweets');
  const minWidthClass = stationary
    ? 'min-w-0'
    : path === 'with_replies'
      ? 'min-w-[152px]'
      : path === 'starter-packs'
        ? 'min-w-[136px]'
        : 'min-w-[96px]';
  const interactiveClass = stationary
    ? cn(
        'min-w-0 flex-1 px-2 transition-colors duration-150',
        active
          ? 'text-light-primary dark:text-dark-primary'
          : 'text-light-secondary dark:text-dark-secondary'
      )
    : cn(
        active
          ? `flex-none px-4 text-light-primary
             dark:text-dark-primary`
          : `max-w-[160px] flex-1 px-3
             text-light-secondary hover:max-w-none hover:flex-none
             hover:px-4 focus-visible:max-w-none focus-visible:flex-none
             focus-visible:px-4 dark:text-dark-secondary`
      );

  return (
    <Link
      href={userPath}
      scroll={false}
      className={cn(
        `accent-tab hover-card group/tab relative flex h-[53px] items-center justify-center
         text-[15px] font-bold outline-none transition-[max-width,padding] duration-150`,
        interactiveClass,
        minWidthClass
      )}
      role='tab'
      aria-selected={active}
      aria-label={name}
      data-profile-tab={path || 'tweets'}
      data-profile-tab-path={userPath}
      draggable={false}
      title={name}
    >
      <span
        className={cn(
          'text-center leading-5',
          !stationary && 'whitespace-nowrap'
        )}
      >
        {name}
      </span>
      {active && (
        <i className='absolute bottom-0 h-1 w-14 rounded-full bg-main-accent' />
      )}
    </Link>
  );
}
