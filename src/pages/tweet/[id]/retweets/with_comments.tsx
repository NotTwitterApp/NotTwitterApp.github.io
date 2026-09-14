import { useRouter } from 'next/router';
import { getTweetRouteId } from '@lib/static-routes';
import { useRouteBack } from '@lib/hooks/useRouteBack';
import { SEO } from '@components/common/seo';
import { PublicTweetLayout } from '@components/layout/common-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { QuoteTweetsFeed } from '@components/view/quote-tweets-feed';
import { Error } from '@components/ui/error';
import type { ReactElement, ReactNode, JSX } from 'react';

function getRouteParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function TweetQuoteTweets(): JSX.Element {
  const { asPath, query: routeQuery } = useRouter();
  const routeBack = useRouteBack();
  const tweetId =
    getRouteParam(routeQuery.tweetId) ??
    getRouteParam(routeQuery.id) ??
    getTweetRouteId(asPath);

  return (
    <MainContainer className='!pb-[1280px]'>
      <SEO title='Quote Tweets / Not Twitter' />
      <MainHeader useActionButton title='Quote Tweets' action={routeBack} />
      {tweetId ? (
        <QuoteTweetsFeed tweetId={tweetId} />
      ) : (
        <Error message='Tweet not found' />
      )}
    </MainContainer>
  );
}

TweetQuoteTweets.getLayout = (page: ReactElement<any>): ReactNode => (
  <PublicTweetLayout>{page}</PublicTweetLayout>
);
