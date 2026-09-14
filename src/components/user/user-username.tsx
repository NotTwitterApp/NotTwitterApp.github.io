import Link from 'next/link';
import cn from 'clsx';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useTheme } from '@lib/context/theme-context';
import { getUserPath } from '@lib/routes';

import type { JSX } from 'react';

type UserUsernameProps = {
  username: string;
  className?: string;
  disableLink?: boolean;
};

export function UserUsername({
  username,
  className,
  disableLink
}: UserUsernameProps): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const displayUsername = formatAtprotoDisplayIdentifier(username, {
    hideBskySocialSuffix
  });

  return (
    <Link href={getUserPath(username)}>
      <a
        className={cn(
          'truncate text-light-secondary dark:text-dark-secondary',
          className,
          disableLink && 'pointer-events-none'
        )}
        tabIndex={-1}
      >
        {displayUsername}
      </a>
    </Link>
  );
}
