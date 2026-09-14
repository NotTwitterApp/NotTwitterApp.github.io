import { useAuth } from '@lib/context/auth-context';

import type { JSX } from 'react';

type UserFollowingProps = {
  userTargetId: string;
  userTargetFollowing?: string[];
};

export function UserFollowing({
  userTargetId,
  userTargetFollowing
}: UserFollowingProps): JSX.Element | null {
  const { user } = useAuth();

  const isOwner =
    user?.id !== userTargetId &&
    (userTargetFollowing?.includes(user?.id ?? '') ??
      user?.followers.includes(userTargetId));

  if (!isOwner) return null;

  return (
    <p className='rounded bg-main-search-background px-1 text-xs'>
      Follows you
    </p>
  );
}
