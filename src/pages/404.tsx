import Link from 'next/link';
import { useEffect, useState, type JSX } from 'react';
import { matchStaticRoute } from '@lib/static-routes';
import { SEO } from '@components/common/seo';
import { LoggedOutTwitterLayout } from '@components/layout/logged-out-twitter-layout';
import FeedPage from './profile/[actor]/feed/[rkey]';
import TweetPage from './tweet/[id]';
import UserFollowersPage from './user/[id]/followers';
import UserFollowersYouKnowPage from './user/[id]/followers_you_follow';
import UserFollowingPage from './user/[id]/following';
import UserArticlesPage from './user/[id]/articles';
import UserLikesPage from './user/[id]/likes';
import UserListsPage from './user/[id]/lists';
import UserMediaPage from './user/[id]/media';
import UserStarterPacksPage from './user/[id]/starter-packs';
import UserTweetsPage from './user/[id]';
import UserRepliesPage from './user/[id]/with_replies';
import type { ReactElement, ReactNode } from 'react';

type RoutedPage = {
  (): JSX.Element;
  getLayout?: (page: ReactElement<any>) => ReactNode;
};

function renderPage(Page: RoutedPage): ReactNode {
  const page = <Page />;

  return Page.getLayout ? Page.getLayout(page) : page;
}

export default function NotFound(): JSX.Element {
  const [fallbackPath, setFallbackPath] = useState<string | null>(null);
  const staticRoute = fallbackPath ? matchStaticRoute(fallbackPath) : null;

  useEffect(() => {
    setFallbackPath(`${window.location.pathname}${window.location.search}`);
  }, []);

  if (staticRoute?.type === 'feed') return <>{renderPage(FeedPage)}</>;
  if (staticRoute?.type === 'tweet') return <>{renderPage(TweetPage)}</>;

  if (staticRoute?.type === 'user')
    switch (staticRoute.view) {
      case 'followers':
        return <>{renderPage(UserFollowersPage)}</>;
      case 'followers_you_follow':
        return <>{renderPage(UserFollowersYouKnowPage)}</>;
      case 'following':
        return <>{renderPage(UserFollowingPage)}</>;
      case 'articles':
        return <>{renderPage(UserArticlesPage)}</>;
      case 'likes':
        return <>{renderPage(UserLikesPage)}</>;
      case 'lists':
        return <>{renderPage(UserListsPage)}</>;
      case 'media':
        return <>{renderPage(UserMediaPage)}</>;
      case 'starter-packs':
        return <>{renderPage(UserStarterPacksPage)}</>;
      case 'with_replies':
        return <>{renderPage(UserRepliesPage)}</>;
      default:
        return <>{renderPage(UserTweetsPage)}</>;
    }

  return (
    <>
      <SEO
        title='Page not found / Not Twitter'
        description='Sorry, that page doesn’t exist! Why not try a search to find something else?'
      />
      <LoggedOutTwitterLayout>
        <main className='border-t border-transparent'>
          <section className='mx-auto max-w-[720px] px-6 pt-[82px] text-center'>
            <h1 className='text-[31px] font-extrabold leading-9 tracking-normal text-[#14171a]'>
              Sorry, that page doesn’t exist!
            </h1>
            <p className='mt-[70px] text-[20px] leading-7 text-[#14171a]'>
              Why not try a{' '}
              <Link href='/explore' className='custom-underline text-[#1da1f2]'>
                search
              </Link>{' '}
              to find something else?
            </p>
          </section>
        </main>
      </LoggedOutTwitterLayout>
    </>
  );
}
