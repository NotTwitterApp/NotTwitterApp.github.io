import cn from 'clsx';
import Link from 'next/link';
import { getUserPath } from '@lib/routes';
import { CustomIcon } from '@components/ui/custom-icon';
import { TwemojiScope } from '@components/ui/twemoji-scope';

import type { JSX } from 'react';

type UserNameProps = {
  tag?: keyof JSX.IntrinsicElements;
  name: string;
  verified: boolean;
  username?: string;
  className?: string;
  iconClassName?: string;
  disableUnderline?: boolean;
};

export function UserName({
  tag,
  name,
  verified,
  username,
  className,
  iconClassName,
  disableUnderline
}: UserNameProps): JSX.Element {
  const CustomTag = tag ? tag : 'p';

  return (
    <Link href={username ? getUserPath(username) : '#'}>
      <a
        className={cn(
          `inline-flex min-w-0 max-w-full items-center gap-1 truncate
           align-bottom font-bold leading-[inherit]`,
          username
            ? disableUnderline
              ? `outline-none focus-visible:rounded-sm focus-visible:ring-2
                 focus-visible:ring-main-accent/80`
              : 'custom-underline'
            : 'pointer-events-none',
          className
        )}
        tabIndex={username ? 0 : -1}
      >
        <TwemojiScope
          as={CustomTag}
          className='min-w-0 truncate leading-[inherit]'
        >
          {name}
        </TwemojiScope>
        {verified && (
          <i className='inline-flex shrink-0 items-center leading-none'>
            <CustomIcon
              className={iconClassName ?? 'h-5 w-5'}
              iconName='TwitterVerifiedIcon'
            />
          </i>
        )}
      </a>
    </Link>
  );
}
