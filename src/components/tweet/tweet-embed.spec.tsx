import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { getTweet, getUser } from '@lib/atproto/backend';
import { Timestamp } from '@lib/atproto/timestamp';
import { TweetEmbed } from './tweet-embed';
import type { EmbeddedTweet, TweetCard } from '@lib/types/tweet';

jest.mock('@lib/atproto/identity', () => ({
  formatAtprotoDisplayIdentifier: (value: string) => `@${value}`
}));
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@lib/context/auth-context', () => ({
  useAuth: () => ({ user: null })
}));
jest.mock('@lib/context/theme-context', () => ({
  useTheme: () => ({ hideBskySocialSuffix: false })
}));
jest.mock('@lib/hooks/use-standard-site-articles-inline', () => ({
  useStandardSiteArticlesInline: () => ({ standardSiteArticlesInline: false })
}));
jest.mock('@lib/atproto/backend', () => ({
  getUser: jest.fn(),
  getTweet: jest.fn()
}));
jest.mock('@components/input/image-preview', () => ({
  ImagePreview: () => <div data-testid='native-media' />
}));

const card: TweetCard = {
  type: 'external',
  url: 'https://example.com/article',
  domain: 'example.com',
  title: 'Article',
  description: 'An article',
  image: 'https://example.com/poster.jpg'
};
const quote: EmbeddedTweet = {
  id: 'quoted',
  authorName: 'Author',
  authorUsername: 'author.test',
  authorAvatar: null,
  authorVerified: false,
  text: 'Read this article',
  langs: [],
  createdAt: null,
  images: null,
  mediaWarning: null,
  card
};
function show(node: React.ReactNode) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {node}
    </SWRConfig>
  );
}

it('does not turn a quoted link poster into an attached photo', () => {
  const { container } = show(<TweetEmbed card={null} quotedTweet={quote} />);
  expect(
    container.querySelector('img[src="https://example.com/poster.jpg"]')
  ).toBeNull();
  expect(screen.getByText('Read this article')).toBeTruthy();
});

it('loads a YouTube player only after Play is clicked', () => {
  const { container } = show(
    <TweetEmbed
      card={{
        ...card,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Video'
      }}
      quotedTweet={null}
    />
  );
  expect(container.querySelector('iframe')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Play Video' }));
  expect(container.querySelector('iframe')).toBeTruthy();
});

it('resolves a Bluesky link card to a quoted Tweet using the canonical DID', async () => {
  jest
    .mocked(getUser)
    .mockResolvedValue({
      id: 'did:plc:author',
      name: 'Linked author',
      username: 'author.test',
      photoURL: '',
      verified: false
    } as Awaited<ReturnType<typeof getUser>>);
  jest
    .mocked(getTweet)
    .mockResolvedValue({
      id: 'resolved',
      createdBy: 'did:plc:author',
      text: 'The linked Tweet',
      langs: [],
      createdAt: Timestamp.now(),
      images: null,
      card: null,
      mediaWarning: null,
      quotedTweet: null,
      parent: null,
      userLikes: [],
      updatedAt: null,
      userReplies: 0,
      userRetweets: [],
      userQuotes: 0,
      bookmarkCount: 0
    });
  show(
    <TweetEmbed
      card={{
        ...card,
        url: 'https://bsky.app/profile/author.test/post/3abc',
        title: 'A Bluesky post'
      }}
      quotedTweet={null}
    />
  );
  await waitFor(() =>
    expect(
      screen.getByRole('link', { name: 'Tweet by Linked author' })
    ).toBeTruthy()
  );
  expect(getUser).toHaveBeenCalledWith('author.test');
  const requestedId = jest.mocked(getTweet).mock.calls.at(-1)![0];
  expect(Buffer.from(requestedId, 'base64url').toString()).toBe(
    'at://did:plc:author/app.bsky.feed.post/3abc'
  );
});

it('gives native media precedence over a link card', () => {
  const { container } = show(
    <TweetEmbed card={card} quotedTweet={null} hasMedia />
  );
  expect(container.querySelector('[role="link"]')).toBeNull();
});

it('keeps reply context free of link posters and quoted media', () => {
  const { container } = show(
    <TweetEmbed
      card={card}
      quotedTweet={{
        ...quote,
        images: [
          {
            id: 'photo',
            src: 'https://example.com/photo.jpg',
            alt: 'Attached photo',
            type: 'image'
          }
        ]
      }}
      contextOnly
    />
  );
  expect(screen.getByText('Read this article')).toBeTruthy();
  expect(
    container.querySelector('img[src="https://example.com/photo.jpg"]')
  ).toBeNull();
  expect(
    container.querySelector('img[src="https://example.com/poster.jpg"]')
  ).toBeNull();
});

it('preserves the recorded quote instead of resolving a different link in its text', () => {
  jest.mocked(getUser).mockClear();
  show(
    <TweetEmbed
      card={null}
      text='https://bsky.app/profile/other.test/post/3xyz'
      quotedTweet={quote}
    />
  );
  expect(screen.getByText('Read this article')).toBeTruthy();
  expect(getUser).not.toHaveBeenCalled();
});

it('keeps a failed link poster clickable without an endless image placeholder', () => {
  const { container } = show(<TweetEmbed card={card} quotedTweet={null} />);
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByRole('link', { name: 'Article' })).toBeTruthy();
});
