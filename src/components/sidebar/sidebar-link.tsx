import { useRouter } from 'next/router';
import Link from 'next/link';
import cn from 'clsx';
import { useWindow } from '@lib/context/window-context';
import { preventBubbling } from '@lib/utils';
import { CustomIcon } from '@components/ui/custom-icon';
import { isNavLinkActive } from './nav-links';
import type { NavLink } from './nav-links';

import type { JSX } from 'react';

type SidebarLinkProps = NavLink;

export function SidebarLink({
  href,
  iconName,
  activeIconName,
  linkName,
  disabled,
  canBeHidden,
  badgeCount,
  badgeDot
}: SidebarLinkProps): JSX.Element {
  const { asPath } = useRouter();
  const { isMobile } = useWindow();
  const isActive = isNavLinkActive(asPath, href);
  const renderedIconName = isActive ? (activeIconName ?? iconName) : iconName;
  const showBadgeCount = !!badgeCount;
  const showBadgeDot = !showBadgeCount && !!badgeDot;
  const badgeLabel = badgeCount
    ? badgeCount > 99
      ? '99+'
      : badgeCount.toString()
    : '';
  const compactCountBadgeClassName = cn(
    `absolute -top-1 -right-1 flex h-4 items-center justify-center rounded-full
     border border-main-background bg-main-accent text-[10px] font-bold leading-4 text-white`,
    badgeLabel.length === 1 ? 'w-4' : 'min-w-[18px] px-1'
  );

  return (
    <Link
      href={href}
      className={cn(
        'group py-1 outline-none',
        canBeHidden && isMobile ? 'hidden' : 'flex',
        disabled && 'cursor-not-allowed'
      )}
      onClick={disabled ? preventBubbling() : undefined}
    >
      <div
        className={cn(
          `custom-button flex min-h-[52px] items-center justify-center gap-4 self-start p-2 text-xl leading-7 transition
           duration-200 group-hover:bg-light-primary/10 group-focus-visible:ring-2
           group-focus-visible:ring-[#878a8c] dark:group-hover:bg-dark-primary/10
           dark:group-focus-visible:ring-white xs:p-3 xl:pr-5`,
          isActive && 'font-bold text-main-accent'
        )}
      >
        <span className='relative flex h-7 w-7 shrink-0 items-center justify-center leading-none'>
          <CustomIcon
            className='block h-7 w-7 shrink-0'
            iconName={renderedIconName}
          />
          {showBadgeCount && (
            <span className={compactCountBadgeClassName}>{badgeLabel}</span>
          )}
          {showBadgeDot && (
            <span
              className='absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full
                         border border-main-background bg-main-accent'
            />
          )}
        </span>
        <p className='hidden h-7 items-center leading-7 xl:flex'>{linkName}</p>
      </div>
    </Link>
  );
}
