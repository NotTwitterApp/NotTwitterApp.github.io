import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { useUser } from '@lib/context/user-context';
import { useCollection } from '@lib/hooks/useCollection';
import { isPlural } from '@lib/utils';
import { tweetsCollection } from '@lib/atproto/collections';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { getProfileRouteId, getProfileRouteView } from '@lib/static-routes';
import { isStandardSiteArticleCard } from '@lib/standard-site';
import { orderBy, query, where } from '@lib/atproto/store';
import { UserName } from './user-name';
import type { Variants } from 'framer-motion';

import type { JSX } from 'react';

export const variants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeOut' } }
};

export function UserHeader(): JSX.Element {
  const {
    asPath,
    pathname,
    query: { id }
  } = useRouter();

  const { user, loading } = useUser();
  const { user: authUser } = useAuth();
  const { hideBskySocialSuffix } = useTheme();

  const userId = user ? user.id : null;
  const currentView = getProfileRouteView(asPath);
  const routeId = (Array.isArray(id) ? id[0] : id) ?? getProfileRouteId(asPath);
  const routeLabel = formatAtprotoDisplayIdentifier(routeId, {
    hideBskySocialSuffix
  });
  const displayUsername = formatAtprotoDisplayIdentifier(user?.username, {
    hideBskySocialSuffix
  });
  const currentPage = currentView ?? pathname.split('/').pop() ?? '';

  const isInTweetPage = ['[id]', 'tweets', 'with_replies'].includes(
    currentPage
  );
  const isInFollowPage = ['following', 'followers'].includes(currentPage);
  const isArticlesPage = currentPage === 'articles';
  const isMediaPage = currentPage === 'media';
  const isLikesPage = currentPage === 'likes';
  const likesVisible = !!authUser && authUser.id === userId;
  const profileRestricted = !!user?.blocking || !!user?.blockedBy;

  const { data: mediaTweets, loading: mediaLoading } = useCollection(
    query(
      tweetsCollection,
      where('createdBy', '==', userId ?? ''),
      where('images', '!=', null)
    ),
    {
      allowNull: true,
      disabled: !userId || !isMediaPage || profileRestricted
    }
  );

  const { data: articleTweets, loading: articlesLoading } = useCollection(
    query(
      tweetsCollection,
      where('createdBy', '==', userId ?? ''),
      where('parent', '==', null)
    ),
    {
      allowNull: true,
      disabled: !userId || !isArticlesPage || profileRestricted
    }
  );

  const { data: likedTweets, loading: likesLoading } = useCollection(
    query(
      tweetsCollection,
      where('userLikes', 'array-contains', userId ?? ''),
      orderBy('createdAt', 'desc')
    ),
    {
      allowNull: true,
      disabled: !userId || !isLikesPage || !likesVisible
    }
  );

  const totalArticles =
    isArticlesPage && !profileRestricted
      ? (articleTweets?.filter(({ card }) => isStandardSiteArticleCard(card))
          .length ?? 0)
      : 0;
  const [totalTweets, totalMedia, totalLikes] = [
    user?.totalTweets ?? 0,
    isMediaPage && !profileRestricted ? (mediaTweets?.length ?? 0) : 0,
    isLikesPage && likesVisible ? (likedTweets?.length ?? 0) : 0
  ];
  const statsLoading =
    (isArticlesPage && articlesLoading) ||
    (isMediaPage && mediaLoading) ||
    (isLikesPage && likesLoading);

  return (
    <AnimatePresence initial={false} mode='wait'>
      {loading || statsLoading ? (
        <motion.div
          key='loading'
          className='-mb-1 inner:animate-pulse inner:rounded-lg 
                     inner:bg-light-secondary dark:inner:bg-dark-secondary'
          {...variants}
        >
          <div className='mb-1 -mt-1 h-5 w-24' />
          <div className='h-4 w-12' />
        </motion.div>
      ) : !user ? (
        <motion.h2 key='not-found' className='text-xl font-bold' {...variants}>
          {isInFollowPage ? routeLabel : 'Profile'}
        </motion.h2>
      ) : (
        <motion.div key='found' className='-mb-1 truncate' {...variants}>
          <UserName
            tag='h2'
            name={user.name}
            className='-mt-1 text-xl'
            iconClassName='w-6 h-6'
            verified={user.verified}
          />
          <p className='text-xs text-light-secondary dark:text-dark-secondary'>
            {isInFollowPage
              ? displayUsername
              : isInTweetPage
                ? totalTweets
                  ? `${totalTweets} ${`Tweet${isPlural(totalTweets)}`}`
                  : 'No Tweet'
                : isMediaPage
                  ? totalMedia
                    ? `${totalMedia} Photo${isPlural(totalMedia)} & GIF${isPlural(
                        totalMedia
                      )}`
                    : 'No Photo & GIF'
                  : isArticlesPage
                    ? totalArticles
                      ? `${totalArticles} Article${isPlural(totalArticles)}`
                      : 'No Article'
                    : totalLikes
                      ? `${totalLikes} Like${isPlural(totalLikes)}`
                      : 'No Like'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
