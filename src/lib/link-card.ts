import {
  createArticleCache,
  fetchStandardSiteArticleHTML
} from './standard-site-loader';
import { getBskyPostLinkFromText } from './routes';
import { getYouTubeVideoInfo } from './youtube';
import type { TweetCard } from './types/tweet';

export function getArticleLink(text: string): string | null {
  for (const match of text.match(/https?:\/\/[^\s<>"']+/gi) ?? []) {
    const value = match.replace(/[),.;!?]+$/, '');
    if (getBskyPostLinkFromText(value) || getYouTubeVideoInfo(value)) continue;
    try {
      return new URL(value).href;
    } catch {
      /* Ignore incomplete URLs while typing. */
    }
  }
  return null;
}

function webUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function parseLinkMetadata(
  html: string,
  url: string
): { card: TweetCard; uris: string[] } {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const meta = (name: string): string | null =>
    document
      .querySelector(`meta[property="${name}"],meta[name="${name}"]`)
      ?.getAttribute('content')
      ?.trim() || null;
  const uris = [
    ...document.querySelectorAll(
      'link[rel="site.standard.document"],link[rel="site.standard.publication"]'
    )
  ]
    .map((link) => link.getAttribute('href') ?? '')
    .filter((uri) =>
      /^at:\/\/[^/]+\/site\.standard\.(document|publication)\/[^/]+$/.test(uri)
    )
    .slice(0, 4);
  return {
    uris,
    card: {
      type: 'external',
      url,
      title:
        meta('og:title') ??
        meta('twitter:title') ??
        (document.title.trim() || new URL(url).hostname),
      description:
        meta('og:description') ??
        meta('twitter:description') ??
        meta('description'),
      image: webUrl(meta('og:image') ?? meta('twitter:image'), url),
      domain: new URL(url).hostname
    }
  };
}

const readLinkCard = createArticleCache<TweetCard>(25_000);
export function getLinkCard(url: string): Promise<TweetCard | null> {
  return readLinkCard(url, async () => {
    const html = await fetchStandardSiteArticleHTML(
      url,
      `link-metadata:${url}`,
      (value) => /<(?:meta|title|link)\b/i.test(value)
    );
    if (!html) return null;
    const { card, uris } = parseLinkMetadata(html, url);
    if (uris.length) {
      try {
        const { getStandardSiteLinkCard } = await import('./atproto/backend');
        return (await getStandardSiteLinkCard(url, uris)) ?? card;
      } catch {
        /* Keep the HTML preview if the record resolver is unavailable. */
      }
    }
    return card;
  });
}

export async function resolveSubmissionLinkCard({
  text,
  card,
  hasMedia,
  hasQuote
}: {
  text: string;
  card: TweetCard | null;
  hasMedia: boolean;
  hasQuote: boolean;
}): Promise<TweetCard | null> {
  if (card || hasMedia || hasQuote) return card;
  const url = getArticleLink(text);
  return url ? getLinkCard(url) : null;
}
