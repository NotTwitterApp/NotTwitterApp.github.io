import { useRouter } from 'next/router';
import { getUserPath } from '@lib/routes';
import { UserAvatar } from '@components/user/user-avatar';
import { FollowButton } from '@components/ui/follow-button';
import { TweetText } from '@components/tweet/tweet-text';
import { UserTooltip } from './user-tooltip';
import { UserName } from './user-name';
import { UserFollowing } from './user-following';
import { UserUsername } from './user-username';
import type { KeyboardEvent, MouseEvent, JSX } from 'react';
import type { User } from '@lib/types/user';

type UserCardProps = User & {
  modal?: boolean;
  follow?: boolean;
};

export function UserCard(user: UserCardProps): JSX.Element {
  const { push } = useRouter();
  const {
    id,
    bio,
    name,
    modal,
    follow,
    username,
    verified,
    photoURL,
    following,
    followers,
    blocking,
    blockedBy,
    blockingByListName
  } = user;
  const userPath = getUserPath(username);
  const openUser = (event: MouseEvent<HTMLElement>): void => {
    if ((event.target as HTMLElement).closest('a,button')) return;
    void push(userPath);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    void push(userPath);
  };

  return (
    <article
      className='accent-tab hover-animation grid cursor-pointer grid-cols-[auto,1fr] gap-3 px-4
                 py-3 hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
      role='link'
      tabIndex={0}
      onClick={openUser}
      onKeyDown={handleKeyDown}
    >
      <UserTooltip avatar {...user} modal={modal}>
        <UserAvatar src={photoURL} alt={name} username={username} />
      </UserTooltip>
      <div className='flex min-w-0 flex-col gap-1 truncate xs:overflow-visible'>
        <div className='flex items-center justify-between gap-2 truncate xs:overflow-visible'>
          <div className='flex min-w-0 flex-col justify-center truncate xs:overflow-visible xs:whitespace-normal'>
            <UserTooltip {...user} modal={modal}>
              <UserName
                className='-mb-1'
                name={name}
                username={username}
                verified={verified}
              />
            </UserTooltip>
            <div className='flex items-center gap-1 text-light-secondary dark:text-dark-secondary'>
              <UserTooltip {...user} modal={modal}>
                <UserUsername username={username} />
              </UserTooltip>
              {follow && (
                <UserFollowing
                  userTargetId={id}
                  userTargetFollowing={following}
                />
              )}
            </div>
          </div>
          <FollowButton
            userTargetId={id}
            userTargetUsername={username}
            userTargetFollowers={followers}
            userTargetFollowing={following}
            userTargetBlocking={blocking}
            userTargetBlockedBy={blockedBy}
            userTargetBlockingByListName={blockingByListName}
          />
        </div>
        {follow && bio && (
          <TweetText className='whitespace-normal' text={bio} />
        )}
      </div>
    </article>
  );
}
