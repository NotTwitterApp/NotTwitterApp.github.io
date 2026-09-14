import Link from 'next/link';
import cn from 'clsx';
import { getUserPath } from '@lib/routes';
import { NextImage } from '@components/ui/next-image';

import type { JSX } from 'react';

type UserAvatarProps = {
  src: string;
  alt: string;
  size?: number;
  username?: string;
  className?: string;
};

export function UserAvatar({
  src,
  alt,
  size,
  username,
  className
}: UserAvatarProps): JSX.Element {
  const pictureSize = size ?? 48;

  return (
    <Link
      href={username ? getUserPath(username) : '#'}
      className={cn(
        'blur-picture profile-picture flex self-start',
        !username && 'pointer-events-none',
        className
      )}
      tabIndex={username ? 0 : -1}
    >
      <NextImage
        useSkeleton
        imgClassName='profile-picture'
        width={pictureSize}
        height={pictureSize}
        src={src}
        alt={alt}
        key={src}
      />
    </Link>
  );
}
