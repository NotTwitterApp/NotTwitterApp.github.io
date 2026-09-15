import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { listTweetStatsPage } from '@lib/atproto/backend';
import { Modal } from '@components/modal/modal';
import { ViewTweetStats } from './view-tweet-stats';

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@lib/atproto/backend', () => ({
  listTweetStatsPage: jest.fn(async () => ({
    users: [],
    tweets: [],
    cursor: null
  })),
  subscribeBackend: () => () => {}
}));
jest.mock('@components/tweet/tweet', () => ({ Tweet: () => null }));
jest.mock('@components/user/user-card', () => ({ UserCard: () => null }));
jest.mock('@components/sidebar/mobile-sidebar', () => ({
  MobileSidebar: () => null
}));

beforeEach(() => jest.clearAllMocks());
it.each([
  ['3 Quote Tweets', 'quotes', 'Quote Tweets'],
  ['6 Retweets', 'retweets', 'Retweeted by'],
  ['101 Likes', 'likes', 'Liked by']
])(
  'opens %s over the fullscreen media dialog',
  async (label, type, heading) => {
    render(
      <Modal open closeModal={() => {}}>
        <ViewTweetStats
          media
          tweetId='media-tweet'
          currentQuotes={3}
          currentTweets={6}
          currentLikes={101}
          currentReplies={0}
          quoteMove={0}
          tweetMove={0}
          likeMove={0}
          replyMove={0}
          isStatsVisible
        />
      </Modal>
    );
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(await screen.findByRole('heading', { name: heading })).toBeTruthy();
    await waitFor(() =>
      expect(listTweetStatsPage).toHaveBeenCalledWith(
        'media-tweet',
        type,
        undefined,
        25
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: heading })).toBeNull()
    );
    expect(screen.getByRole('button', { name: label })).toBeTruthy();
  }
);
