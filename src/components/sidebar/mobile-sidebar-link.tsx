import { useRouter } from 'next/router';
import Link from 'next/link';
import cn from 'clsx';
import { preventBubbling } from '@lib/utils';
import { AppIcon, type AppIconName } from '@components/ui/app-icon';
import { isNavLinkActive } from './nav-links';

import type { JSX } from 'react';

type MobileSidebarLinkProps = {
  href: string;
  linkName: string;
  iconName: AppIconName;
  activeIconName?: AppIconName;
  disabled?: boolean;
  bottom?: boolean;
};

export function MobileSidebarLink({
  href,
  bottom,
  linkName,
  iconName,
  activeIconName,
  disabled
}: MobileSidebarLinkProps): JSX.Element {
  const { asPath } = useRouter();
  const isActive = !disabled && isNavLinkActive(asPath, href);
  const renderedIconName = isActive ? (activeIconName ?? iconName) : iconName;

  return (
    <Link
      href={href}
      key={href}
      className={cn(
        `custom-button accent-tab accent-bg-tab flex items-center rounded-full text-left font-bold 
         transition hover:bg-light-primary/10 focus-visible:ring-2 first:focus-visible:ring-[#878a8c]
         dark:hover:bg-dark-primary/10 dark:focus-visible:ring-white`,
        bottom
          ? 'gap-5 px-4 py-3 text-base leading-6'
          : 'gap-5 px-4 py-3 text-xl leading-7',
        isActive && 'text-main-accent',
        disabled && 'cursor-not-allowed'
      )}
      onClick={disabled ? preventBubbling() : undefined}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center leading-none',
          bottom ? 'h-6 w-6' : 'h-7 w-7'
        )}
      >
        <AppIcon
          className={bottom ? 'block h-6 w-6' : 'block h-7 w-7'}
          iconName={renderedIconName}
        />
      </span>
      <span className={bottom ? 'leading-6' : 'leading-7'}>{linkName}</span>
    </Link>
  );
}
