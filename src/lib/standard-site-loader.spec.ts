import {
  createArticleCache,
  fetchStandardSiteArticleHTML,
  getStandardSiteArticleCacheKey,
  getStandardSiteDocumentUris
} from './standard-site-loader';
import type { TweetCard } from './types/tweet';

const card: TweetCard = {
  type: 'external',
  url: 'https://example.com/article',
  title: 'Article',
  description: null,
  image: null,
  domain: 'example.com'
};

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('keeps the document when unrelated references precede it', () => {
  const uri = 'at://did:plc:author/site.standard.document/post';
  const associatedRefs = ['one', 'two', 'three', 'four', uri].map((uri) => ({
    uri,
    cid: 'v1'
  }));
  expect(getStandardSiteDocumentUris({ ...card, associatedRefs })).toHaveLength(
    4
  );
  expect(getStandardSiteDocumentUris({ ...card, associatedRefs })[0]).toBe(uri);
});

it('invalidates the article when its record revision changes', () => {
  const ref = {
    uri: 'at://did:plc:author/site.standard.document/post',
    cid: 'v1'
  };
  expect(
    getStandardSiteArticleCacheKey({ ...card, associatedRefs: [ref] })
  ).not.toBe(
    getStandardSiteArticleCacheKey({
      ...card,
      associatedRefs: [{ ...ref, cid: 'v2' }]
    })
  );
});

it('shares simultaneous reads and retries a failed read', async () => {
  const cache = createArticleCache<string>();
  const read = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue('Recovered');
  const first = cache('article', read);
  expect(cache('article', read)).toBe(first);
  expect(await first).toBeNull();
  expect(await cache('article', read)).toBe('Recovered');
  expect(read).toHaveBeenCalledTimes(2);
});

it('refreshes successful articles after five minutes', async () => {
  jest.useFakeTimers();
  const cache = createArticleCache<string>();
  const read = jest.fn().mockResolvedValueOnce('Old').mockResolvedValue('New');
  expect(await cache('article', read)).toBe('Old');
  jest.advanceTimersByTime(300_001);
  expect(await cache('article', read)).toBe('New');
});

it('aborts a stalled host and loads the fallback reader', async () => {
  jest.useFakeTimers();
  const fetchMock = jest
    .fn()
    .mockImplementationOnce(
      (_, options) =>
        new Promise((_, reject) =>
          options.signal.addEventListener('abort', () =>
            reject(new Error('aborted'))
          )
        )
    )
    .mockResolvedValueOnce({ ok: true, text: async () => 'Recovered article' });
  const original = global.fetch;
  global.fetch = fetchMock;
  try {
    const result = fetchStandardSiteArticleHTML('https://example.com/stalled');
    await jest.advanceTimersByTimeAsync(6000);
    expect(await result).toBe('Recovered article');
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://r.jina.ai/https://example.com/stalled'
    );
  } finally {
    global.fetch = original;
  }
});

it('lets a stalled record lookup fall back and retry', async () => {
  jest.useFakeTimers();
  const cache = createArticleCache<string>(12_000);
  const first = cache('record', () => new Promise(() => {}));
  await jest.advanceTimersByTimeAsync(12_000);
  expect(await first).toBeNull();
  expect(await cache('record', async () => 'Recovered')).toBe('Recovered');
});

it('skips unusable HTML and retries when every host has failed', async () => {
  const original = global.fetch;
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, text: async () => '<html></html>' })
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce({ ok: true, text: async () => 'Article content' });
  global.fetch = fetchMock;
  try {
    const load = () =>
      fetchStandardSiteArticleHTML(
        'https://example.com/retry',
        'revision-one',
        (text) => text.includes('Article content')
      );
    expect(await load()).toBeNull();
    expect(await load()).toBe('Article content');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  } finally {
    global.fetch = original;
  }
});

it('shares an in-flight revision read but checks again after it completes', async () => {
  const cache = createArticleCache<string>(12_000, 0);
  const read = jest
    .fn()
    .mockResolvedValueOnce('Original')
    .mockResolvedValueOnce('Edited');
  const first = cache('same-document-uri', read);
  expect(cache('same-document-uri', read)).toBe(first);
  expect(await first).toBe('Original');
  expect(await cache('same-document-uri', read)).toBe('Edited');
});
it('revalidates HTML instead of retaining the old page after an edit', async () => {
  const original = global.fetch;
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, text: async () => 'Original HTML' })
    .mockResolvedValueOnce({ ok: true, text: async () => 'Edited HTML' });
  global.fetch = fetchMock;
  try {
    expect(
      await fetchStandardSiteArticleHTML('https://example.com/edited')
    ).toBe('Original HTML');
    expect(
      await fetchStandardSiteArticleHTML('https://example.com/edited')
    ).toBe('Edited HTML');
    expect(fetchMock.mock.calls[1][1].cache).toBe('no-cache');
  } finally {
    global.fetch = original;
  }
});
