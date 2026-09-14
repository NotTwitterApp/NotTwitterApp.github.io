import { useEffect, type JSX } from 'react';
import { useRouter } from 'next/router';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { query, where } from '@lib/atproto/store';
import { getUserTabPath } from '@lib/routes';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { useUser } from '@lib/context/user-context';
import { useCollection } from '@lib/hooks/useCollection';
import { usersCollection } from '@lib/atproto/collections';
import { SEO } from '@components/common/seo';
import { UserCards } from '@components/user/user-cards';
import type { User } from '@lib/types/user';

type UserFollowProps = {
  type: 'following' | 'followers' | 'followers_you_follow';
};

export function UserFollow({ type }: UserFollowProps): JSX.Element {
  const { replace } = useRouter();
  const { user: authUser } = useAuth();
  const { hideBskySocialSuffix } = useTheme();
  const { user } = useUser();
  const { name, username } = user as User;
  const displayUsername = formatAtprotoDisplayIdentifier(username, {
    hideBskySocialSuffix
  });
  const hideOwnKnownFollowers =
    type === 'followers_you_follow' && authUser?.id === user?.id;
  const followTitle =
    type === 'following'
      ? `People followed by ${name} (${displayUsername})`
      : type === 'followers'
        ? `People following ${name} (${displayUsername})`
        : `Followers you know for ${name} (${displayUsername})`;

  const { data, loading } = useCollection(
    query(
      usersCollection,
      where(
        type === 'following'
          ? 'followers'
          : type === 'followers'
            ? 'following'
            : 'knownFollowers',
        'array-contains',
        user?.id
      )
    ),
    { allowNull: true, disabled: hideOwnKnownFollowers }
  );

  useEffect(() => {
    if (hideOwnKnownFollowers)
      void replace(getUserTabPath(username, 'followers'), undefined, {
        scroll: false
      });
  }, [hideOwnKnownFollowers, replace, username]);

  if (hideOwnKnownFollowers) return <SEO title={`${name} / Not Twitter`} />;

  return (
    <>
      <SEO title={`${followTitle} / Not Twitter`} />
      <UserCards follow data={data} type={type} loading={loading} />
    </>
  );
}
