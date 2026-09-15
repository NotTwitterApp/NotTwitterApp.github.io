import type { TweetCard } from './types/tweet';

export function getStandardSiteDocumentUris(card: TweetCard): string[] {
  const uris = [...new Set(card.associatedRefs?.map(({ uri }) => uri) ?? [])];
  return uris
    .sort(
      (a, b) =>
        Number(b.includes('/site.standard.document/')) -
        Number(a.includes('/site.standard.document/'))
    )
    .slice(0, 4);
}

export function getStandardSiteArticleCacheKey(card: TweetCard): string {
  const refs =
    card.associatedRefs?.map(({ uri, cid }) => `${uri}:${cid}`).sort() ?? [];
  return JSON.stringify([card.url, card.updatedAt, refs]);
}

// Share in-flight requests, but let failed reads recover on the next attempt.
export function createArticleCache<T>(
  timeoutMs = 30_000,
  maxAgeMs = 5 * 60_000
) {
  const entries = new Map<
    string,
    { request: Promise<T | null>; expiresAt: number; pending: boolean }
  >();
  return (key: string, read: () => Promise<T | null>): Promise<T | null> => {
    const cached = entries.get(key);
    if (cached && (cached.pending || cached.expiresAt > Date.now()))
      return cached.request;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const request = Promise.race([Promise.resolve().then(read), deadline])
      .catch(() => null)
      .finally(() => clearTimeout(timer));
    const entry = { request, expiresAt: Infinity, pending: true };
    entries.delete(key);
    entries.set(key, entry);
    if (entries.size > 100) entries.delete(entries.keys().next().value!);
    void request.then((value) => {
      entry.pending = false;
      entry.expiresAt = Date.now() + maxAgeMs;
      if ((value === null || maxAgeMs === 0) && entries.get(key) === entry)
        entries.delete(key);
    });
    return request;
  };
}

const readHtml = createArticleCache<string>(30_000, 0);

export function fetchStandardSiteArticleHTML(
  url: string,
  revision = url,
  accepts: (text: string) => boolean = () => true
): Promise<string | null> {
  return readHtml(revision, async () => {
    const proxy = process.env.NEXT_PUBLIC_STANDARD_SITE_HTML_PROXY?.trim();
    let proxyUrl: string | undefined;
    if (proxy) {
      try {
        if (proxy.includes('{url}'))
          proxyUrl = proxy.replace('{url}', encodeURIComponent(url));
        else {
          const parsed = new URL(proxy);
          parsed.searchParams.set('url', url);
          proxyUrl = parsed.href;
        }
      } catch {
        /* An invalid optional proxy must not prevent direct reads. */
      }
    }
    const candidates = [
      ...new Set(
        [proxyUrl, url, `https://r.jina.ai/${url}`].filter(
          (value): value is string => !!value
        )
      )
    ];
    for (const candidate of candidates) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const response = await fetch(candidate, {
          signal: controller.signal,
          cache: 'no-cache',
          credentials: 'omit',
          referrerPolicy: 'no-referrer'
        });
        if (!response.ok) continue;
        const text = await response.text();
        if (text.trim() && accepts(text)) return text;
      } catch {
        /* Try the next reader when the host fails or blocks cross-origin access. */
      } finally {
        clearTimeout(timer);
      }
    }
    return null;
  });
}
