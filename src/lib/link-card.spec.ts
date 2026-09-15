import {
  getArticleLink,
  parseLinkMetadata,
  getLinkCard,
  resolveSubmissionLinkCard
} from './link-card';
import { fetchStandardSiteArticleHTML } from './standard-site-loader';
import {
  getStandardSiteLinkCard,
  getStandardSiteArticleSnapshot
} from './atproto/backend';
jest.mock('./standard-site-loader', () => ({
  ...jest.requireActual('./standard-site-loader'),
  fetchStandardSiteArticleHTML: jest.fn()
}));
jest.mock('./atproto/backend', () => ({
  getStandardSiteLinkCard: jest.fn(),
  getStandardSiteArticleSnapshot: jest.fn()
}));

it('discovers Standard.site records even when a page has no Open Graph tags', async () => {
  const url = 'https://erickrouss.github.io/blog/welcome/';
  const uri = 'at://did:plc:author/site.standard.document/3abc';
  jest
    .mocked(fetchStandardSiteArticleHTML)
    .mockResolvedValue(
      `<title>Welcome</title><meta name="description" content="My blog"><link rel="site.standard.document" href="${uri}">`
    );
  const card = {
    type: 'external' as const,
    url,
    title: 'Welcome to my blog',
    description: 'My blog',
    image: null,
    domain: 'erickrouss.github.io',
    associatedRefs: [{ uri, cid: 'document-cid' }]
  };
  jest.mocked(getStandardSiteLinkCard).mockResolvedValue(card);
  expect(await getLinkCard(url)).toEqual(card);
  expect(getStandardSiteLinkCard).toHaveBeenCalledWith(url, [uri]);
});
it('resolves relative posters and ignores unsafe poster protocols', () => {
  expect(
    parseLinkMetadata(
      '<meta property="og:image" content="/poster.png">',
      'https://example.com/post/'
    ).card.image
  ).toBe('https://example.com/poster.png');
  expect(
    parseLinkMetadata(
      '<meta property="og:image" content="javascript:alert(1)">',
      'https://example.com/'
    ).card.image
  ).toBeNull();
});
it('finds article links without treating Bluesky posts or YouTube as articles', () => {
  expect(
    getArticleLink(
      'https://bsky.app/profile/example.com/post/abc https://youtu.be/dQw4w9WgXcQ https://example.com/article.'
    )
  ).toBe('https://example.com/article');
});

it('awaits link metadata when Send happens before the composer preview is ready', async () => {
  let finish!: (html: string) => void;
  jest.mocked(fetchStandardSiteArticleHTML).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const pending = resolveSubmissionLinkCard({
    text: 'https://example.com/fast-send',
    card: null,
    hasMedia: false,
    hasQuote: false
  });
  await Promise.resolve();
  finish(
    '<title>A real article</title><meta name="description" content="Article description">'
  );
  expect(await pending).toMatchObject({
    type: 'external',
    url: 'https://example.com/fast-send',
    title: 'A real article'
  });
});
it('does not attach a link card alongside native media or an explicit quote', async () => {
  jest.mocked(fetchStandardSiteArticleHTML).mockClear();
  for (const flags of [
    { hasMedia: true, hasQuote: false },
    { hasMedia: false, hasQuote: true }
  ]) {
    expect(
      await resolveSubmissionLinkCard({
        text: 'https://example.com/ignored',
        card: null,
        ...flags
      })
    ).toBeNull();
  }
  expect(fetchStandardSiteArticleHTML).not.toHaveBeenCalled();
});

it('uses the current article revision when sending an older composer preview', async () => {
  const card = {
    type: 'external' as const,
    url: 'https://example.com/edit',
    title: 'Original',
    description: null,
    image: null,
    domain: 'example.com',
    associatedRefs: [
      { uri: 'at://did:plc:author/site.standard.document/edit', cid: 'old-cid' }
    ]
  };
  const latest = {
    ...card,
    title: 'Edited',
    associatedRefs: [{ ...card.associatedRefs[0], cid: 'new-cid' }]
  };
  jest.mocked(getStandardSiteArticleSnapshot).mockResolvedValueOnce({
    card: latest,
    article: {
      url: card.url,
      title: 'Edited',
      description: null,
      textContent: 'Updated',
      publishedAt: null,
      updatedAt: null,
      tags: []
    }
  });
  expect(
    await resolveSubmissionLinkCard({
      text: card.url,
      card,
      hasMedia: false,
      hasQuote: false
    })
  ).toEqual(latest);
});
