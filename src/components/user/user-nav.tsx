import { useRef, type JSX } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import { useUser } from '@lib/context/user-context';
import { getNextTabIndexFromShortcut } from '@lib/keyboard-shortcuts';
import { variants } from '@components/user/user-header';
import { UserNavLink } from './user-nav-link';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';

type UserNavProps = {
  follow?: boolean;
};

type UserNavData = {
  name: string;
  path: string;
};

const allNavs: ReadonlyArray<ReadonlyArray<UserNavData>> = [
  [
    { name: 'Tweets', path: '' },
    { name: 'Tweets & replies', path: 'with_replies' },
    { name: 'Articles', path: 'articles' },
    { name: 'Media', path: 'media' },
    { name: 'Likes', path: 'likes' },
    { name: 'Lists', path: 'lists' },
    { name: 'Starter Packs', path: 'starter-packs' }
  ],
  [
    { name: 'Following', path: 'following' },
    { name: 'Followers', path: 'followers' },
    { name: 'Followers you know', path: 'followers_you_follow' }
  ]
];

type ProfileTabsDragState = {
  dragging: boolean;
  moved: boolean;
  pendingPath: string | null;
  pointerId: number;
  scrollLeft: number;
  startX: number;
};

const initialDragState: ProfileTabsDragState = {
  dragging: false,
  moved: false,
  pendingPath: null,
  pointerId: 0,
  scrollLeft: 0,
  startX: 0
};

export function UserNav({ follow }: UserNavProps): JSX.Element {
  const { push } = useRouter();
  const { user: authUser } = useAuth();
  const { user: profileUser } = useUser();
  const scrollRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<ProfileTabsDragState>(initialDragState);
  const suppressNextClickRef = useRef(false);
  const isOwnProfile = !!authUser && authUser.id === profileUser?.id;
  const likesVisible = isOwnProfile;
  const userNav = allNavs[+!!follow].filter(({ path }) => {
    if (follow === true && path === 'followers_you_follow' && isOwnProfile)
      return false;

    return follow === true || path !== 'likes' || likesVisible;
  });

  const handlePointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (follow) return;
    if (event.button !== 0 || !scrollRef.current) return;

    const pendingTabLink =
      event.target instanceof HTMLElement
        ? (event.target.closest(
            '[data-profile-tab-path]'
          ) as HTMLAnchorElement | null)
        : null;
    const shouldUseNativeClick =
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

    dragStateRef.current = {
      dragging: true,
      moved: false,
      pendingPath: shouldUseNativeClick
        ? null
        : (pendingTabLink?.dataset.profileTabPath ?? null),
      pointerId: event.pointerId,
      scrollLeft: scrollRef.current.scrollLeft,
      startX: event.clientX
    };

    scrollRef.current.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>): void => {
    const dragState = dragStateRef.current;
    if (
      !dragState.dragging ||
      dragState.pointerId !== event.pointerId ||
      !scrollRef.current
    )
      return;

    const offset = event.clientX - dragState.startX;
    if (Math.abs(offset) > 4) dragState.moved = true;
    if (dragState.moved) event.preventDefault();
    scrollRef.current.scrollLeft = dragState.scrollLeft - offset;
  };

  const stopDragging = (event: PointerEvent<HTMLElement>): void => {
    const dragState = dragStateRef.current;
    if (!dragState.dragging || dragState.pointerId !== event.pointerId) return;

    if (dragState.moved) suppressNextClickRef.current = true;
    else if (dragState.pendingPath) {
      suppressNextClickRef.current = true;
      void push(dragState.pendingPath, undefined, { scroll: false });
    }

    dragStateRef.current = initialDragState;

    if (scrollRef.current?.hasPointerCapture(event.pointerId))
      scrollRef.current.releasePointerCapture(event.pointerId);
  };

  const handleClickCapture = (event: MouseEvent<HTMLElement>): void => {
    if (!suppressNextClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    suppressNextClickRef.current = false;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const tabLinks = Array.from(
      event.currentTarget.querySelectorAll<HTMLAnchorElement>(
        '[data-profile-tab-path]'
      )
    );
    const currentTab =
      event.target instanceof HTMLElement
        ? (event.target.closest(
            '[data-profile-tab-path]'
          ) as HTMLAnchorElement | null)
        : null;
    const currentIndex = currentTab ? tabLinks.indexOf(currentTab) : -1;
    const nextIndex = getNextTabIndexFromShortcut(
      event.key,
      currentIndex,
      tabLinks.length
    );
    const nextPath = tabLinks[nextIndex ?? -1]?.dataset.profileTabPath;

    if (nextIndex === null || !nextPath) return;

    event.preventDefault();
    tabLinks[nextIndex]?.focus();
    void push(nextPath, undefined, { scroll: false });
  };

  return (
    <motion.nav
      className={cn(
        `feed-tabs-scroll h-[53px] select-none overflow-y-hidden border-b
         border-light-border dark:border-dark-border`,
        follow ? 'overflow-x-hidden' : 'overflow-x-auto',
        follow && 'mt-1 mb-0.5'
      )}
      ref={scrollRef}
      role='tablist'
      aria-label={follow ? 'Profile follows' : 'Profile sections'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onClickCapture={handleClickCapture}
      onKeyDown={handleKeyDown}
      {...variants}
      exit={undefined}
    >
      <div className='flex h-full min-w-full'>
        {userNav.map(({ name, path }) => (
          <UserNavLink name={name} path={path} stationary={follow} key={name} />
        ))}
      </div>
    </motion.nav>
  );
}
