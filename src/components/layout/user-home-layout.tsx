import { useRouter } from 'next/router';
import { useEffect, useState, type JSX } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { useUser } from '@lib/context/user-context';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { isProfileBirthdayToday } from '@lib/profile-birthday';
import { getProfileTweetSearchQuery } from '@lib/routes';
import { getProfileRouteId } from '@lib/static-routes';
import { SEO } from '@components/common/seo';
import { UserHomeCover } from '@components/user/user-home-cover';
import { UserHomeAvatar } from '@components/user/user-home-avatar';
import { UserDetails } from '@components/user/user-details';
import { UserNav } from '@components/user/user-nav';
import { Button } from '@components/ui/button';
import { Loading } from '@components/ui/loading';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { FollowButton } from '@components/ui/follow-button';
import { variants } from '@components/user/user-header';
import { UserEditProfile } from '@components/user/user-edit-profile';
import { UserBirthdayBalloons } from '@components/user/user-birthday-balloons';
import { UserShare } from '@components/user/user-share';
import type { LayoutProps } from './common-layout';
import type { ActivityNotificationCategory, User } from '@lib/types/user';

const activityNotificationCategoryIds: ActivityNotificationCategory[] = [
  'all',
  'tweets',
  'articles',
  'retweets',
  'replies'
];

const activityNotificationIndividualCategories: ActivityNotificationCategory[] =
  ['tweets', 'articles', 'retweets', 'replies'];

const activityNotificationTitles: Record<ActivityNotificationCategory, string> =
  {
    all: 'All',
    tweets: 'Tweets',
    articles: 'Articles',
    retweets: 'Retweets',
    replies: 'Replies'
  };

function normalizeActivityNotificationCategories(
  categories: readonly ActivityNotificationCategory[]
): ActivityNotificationCategory[] {
  if (categories.includes('all')) return ['all'];

  const next = activityNotificationIndividualCategories.filter((category) =>
    categories.includes(category)
  );

  return next.length === activityNotificationIndividualCategories.length
    ? ['all']
    : next;
}

function activityNotificationCategoriesInclude(
  categories: readonly ActivityNotificationCategory[],
  category: ActivityNotificationCategory
): boolean {
  const normalized = normalizeActivityNotificationCategories(categories);

  return normalized.includes('all') || normalized.includes(category);
}

function getToggledActivityNotificationCategories(
  current: readonly ActivityNotificationCategory[],
  category: ActivityNotificationCategory
): ActivityNotificationCategory[] {
  const normalized = normalizeActivityNotificationCategories(current);
  if (category === 'all') return normalized.includes('all') ? [] : ['all'];

  const expanded = normalized.includes('all')
    ? [...activityNotificationIndividualCategories]
    : [...normalized];
  const next = expanded.includes(category)
    ? expanded.filter((item) => item !== category)
    : [...expanded, category];

  return normalizeActivityNotificationCategories(next);
}

function canViewerMessageUser(
  targetUser: User,
  viewerId: string | undefined
): boolean {
  if (!viewerId) return false;

  if (targetUser.messageAllowIncoming === 'all') return true;
  if (targetUser.messageAllowIncoming === 'following')
    return targetUser.following.includes(viewerId);

  return false;
}

function ActivityNotificationButton({
  targetUser
}: {
  targetUser: User;
}): JSX.Element | null {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [categories, setCategories] = useState<ActivityNotificationCategory[]>(
    targetUser.activityNotificationCategories
  );

  useEffect(() => {
    if (!updating) setCategories(targetUser.activityNotificationCategories);
  }, [targetUser.activityNotificationCategories, updating]);

  if (!user || user.id === targetUser.id) return null;

  const enabled = categories.length > 0;

  const handleToggle = async (
    category: ActivityNotificationCategory
  ): Promise<void> => {
    if (updating) return;

    const previous = categories;
    const next = getToggledActivityNotificationCategories(categories, category);

    setUpdating(true);
    setCategories(next);

    try {
      const { setActivityNotificationCategoriesForUser } =
        await import('@lib/atproto/backend');
      const saved = await setActivityNotificationCategoriesForUser(
        targetUser.id,
        next
      );
      setCategories(saved);
    } catch {
      setCategories(previous);
      toast.error('Could not update notifications for this account');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className='relative'>
      <Button
        className='dark-bg-tab group relative border border-light-line-reply p-2
                   hover:bg-light-primary/10 active:bg-light-primary/20 dark:border-light-secondary
                   dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
        aria-label='Notifications'
        aria-expanded={open}
        disabled={updating}
        onClick={(event): void => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <CustomIcon
          className='h-5 w-5'
          iconName={
            enabled
              ? 'TwitterNotificationsFilledIcon'
              : 'TwitterNotificationsIcon'
          }
        />
        <ToolTip tip='Notifications' />
      </Button>
      {open && (
        <div
          className='absolute right-0 top-11 z-10 w-52 overflow-hidden rounded-2xl border border-light-border
                     bg-main-background py-1 text-left text-[15px] shadow-xl dark:border-dark-border'
        >
          {activityNotificationCategoryIds.map((category) => {
            const checked = activityNotificationCategoriesInclude(
              categories,
              category
            );

            return (
              <button
                className='flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-light-primary/5
                           focus-visible:bg-light-primary/5 focus-visible:outline-none
                           dark:hover:bg-dark-primary/5 dark:focus-visible:bg-dark-primary/5'
                type='button'
                key={category}
                disabled={updating}
                onClick={(): void => void handleToggle(category)}
              >
                <span
                  className='flex h-5 w-5 shrink-0 items-center justify-center rounded border
                             border-light-secondary text-main-accent dark:border-dark-secondary'
                  aria-hidden='true'
                >
                  {checked && (
                    <CustomIcon
                      className='h-3.5 w-3.5'
                      iconName='TwitterCheckIcon'
                    />
                  )}
                </span>
                <span className='font-bold'>
                  {activityNotificationTitles[category]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileSearchButton({
  displayUsername,
  onClick
}: {
  displayUsername: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <Button
      className='dark-bg-tab group relative border border-light-line-reply p-2
                 hover:bg-light-primary/10 active:bg-light-primary/20 dark:border-light-secondary
                 dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
      aria-label={`Search Tweets from ${displayUsername}`}
      onClick={onClick}
    >
      <HeroIcon className='h-5 w-5' iconName='MagnifyingGlassIcon' />
      <ToolTip tip='Search' />
    </Button>
  );
}

export function UserHomeLayout({ children }: LayoutProps): JSX.Element {
  const { user, isAdmin } = useAuth();
  const { hideBskySocialSuffix } = useTheme();
  const { user: userData, loading } = useUser();

  const {
    asPath,
    push,
    query: { id }
  } = useRouter();
  const routeId = (Array.isArray(id) ? id[0] : id) ?? getProfileRouteId(asPath);
  const routeLabel = formatAtprotoDisplayIdentifier(routeId, {
    hideBskySocialSuffix
  });
  const profileTitleUsername = formatAtprotoDisplayIdentifier(
    userData?.username,
    { hideBskySocialSuffix }
  );

  const coverData = userData?.coverPhotoURL
    ? { src: userData.coverPhotoURL, alt: userData.name }
    : null;

  const profileData = userData
    ? { src: userData.photoURL, alt: userData.name }
    : null;

  const { id: userId } = user ?? {};

  const isOwner = userData?.id === userId;
  const signedIn = !!user;
  const viewerBlocksUser = !!userData?.blocking;
  const viewerBlockedByUser = !!userData?.blockedBy;
  const profileIsBlocked =
    !!userData && (viewerBlockedByUser || viewerBlocksUser);
  const showMessageButton =
    !!userData &&
    signedIn &&
    !profileIsBlocked &&
    canViewerMessageUser(userData, userId);
  const showProfileSearchButton = !!userData && !profileIsBlocked;
  const showBirthdayBalloons =
    !!userData &&
    !profileIsBlocked &&
    isProfileBirthdayToday(userData.birthday);

  const handleMessageClick = (): void => {
    if (userData)
      void push(`/messages?actor=${encodeURIComponent(userData.username)}`);
  };

  const handleProfileSearchClick = (): void => {
    if (!userData) return;

    void push({
      pathname: '/explore',
      query: {
        q: getProfileTweetSearchQuery(userData.username),
        src: 'profile'
      }
    });
  };

  return (
    <>
      {userData && (
        <SEO
          title={`${`${userData.name} (${profileTitleUsername})`} / Not Twitter`}
        />
      )}
      {showBirthdayBalloons && <UserBirthdayBalloons />}
      <motion.section className='relative' {...variants} exit={undefined}>
        {loading ? (
          <Loading className='mt-5' />
        ) : !userData ? (
          <>
            <UserHomeCover />
            <div className='flex flex-col'>
              <div className='relative flex flex-col gap-3 px-4 py-3 pb-12'>
                <UserHomeAvatar />
                <p className='break-words text-xl font-extrabold'>
                  {routeLabel}
                </p>
              </div>
              <div className='mx-auto w-full max-w-[250px] px-8 pt-5 text-left'>
                <p className='text-[27px] font-extrabold leading-8'>
                  This account doesn’t exist
                </p>
                <p className='mt-2 text-[15px] text-light-secondary dark:text-dark-secondary'>
                  Try searching for another.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <UserHomeCover coverData={coverData} />
            <div className='relative flex flex-col gap-2 px-4 py-3'>
              <div className='flex justify-between'>
                <UserHomeAvatar profileData={profileData} />
                {isOwner ? (
                  <div className='flex gap-2 self-start'>
                    {showProfileSearchButton && (
                      <ProfileSearchButton
                        displayUsername={profileTitleUsername}
                        onClick={handleProfileSearchClick}
                      />
                    )}
                    <UserEditProfile />
                  </div>
                ) : (
                  <div className='flex gap-2 self-start'>
                    {showProfileSearchButton && (
                      <ProfileSearchButton
                        displayUsername={profileTitleUsername}
                        onClick={handleProfileSearchClick}
                      />
                    )}
                    {showMessageButton && (
                      <Button
                        className='dark-bg-tab group relative border border-light-line-reply p-2
                                   hover:bg-light-primary/10 active:bg-light-primary/20 dark:border-light-secondary
                                   dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
                        onClick={handleMessageClick}
                      >
                        <CustomIcon
                          className='h-5 w-5'
                          iconName='TwitterMessagesIcon'
                        />
                        <ToolTip tip='Message' />
                      </Button>
                    )}
                    <ActivityNotificationButton targetUser={userData} />
                    <UserShare
                      targetId={userData.id}
                      username={userData.username}
                      blocking={userData.blocking}
                      blockingByListName={userData.blockingByListName}
                      muting={userData.muting}
                      mutingByListName={userData.mutingByListName}
                    />
                    <FollowButton
                      userTargetId={userData.id}
                      userTargetUsername={userData.username}
                      userTargetFollowers={userData.followers}
                      userTargetFollowing={userData.following}
                      userTargetBlocking={userData.blocking}
                      userTargetBlockedBy={userData.blockedBy}
                      userTargetBlockingByListName={userData.blockingByListName}
                    />
                    {isAdmin && <UserEditProfile hide />}
                  </div>
                )}
              </div>
              <UserDetails {...userData} />
            </div>
          </>
        )}
      </motion.section>
      {userData &&
        (profileIsBlocked ? (
          <BlockedProfileState
            username={userData.username}
            blockedBy={viewerBlockedByUser}
            blockedByListName={userData.blockingByListName}
          />
        ) : (
          <>
            <UserNav />
            {children}
          </>
        ))}
    </>
  );
}

function BlockedProfileState({
  username,
  blockedBy,
  blockedByListName
}: {
  username: string;
  blockedBy: boolean;
  blockedByListName: string | null;
}): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const displayUsername = formatAtprotoDisplayIdentifier(username, {
    hideBskySocialSuffix
  });
  const title = blockedBy ? 'You’re blocked' : `You blocked ${displayUsername}`;
  const description = blockedBy
    ? `You can’t follow or see ${displayUsername}’s Tweets.`
    : blockedByListName
      ? `This account is blocked by ${blockedByListName}.`
      : `You can’t follow or see ${displayUsername}’s Tweets.`;

  return (
    <div
      className='border-t border-light-border px-8 py-10 text-left dark:border-dark-border
                 xs:px-4'
    >
      <div className='mx-auto flex w-full max-w-[360px] flex-col gap-3'>
        <p className='text-[31px] font-extrabold leading-9'>{title}</p>
        <p className='text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
          {description}
        </p>
      </div>
    </div>
  );
}
