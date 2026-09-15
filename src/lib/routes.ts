export type NotificationsTab = 'all' | 'mentions' | 'tweets';

const BSKY_APP_URL = 'https://bsky.app';

type PostUriParts = {
  actor: string;
  rkey: string;
};

export type BskyPostLink = PostUriParts & {
  url: string;
  tweetId: string;
};

function safeAtob(value: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.atob) return window.atob(value);

    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function safeBtoa(value: string): string {
  if (typeof window !== 'undefined' && window.btoa) return window.btoa(value);

  return Buffer.from(value, 'utf8').toString('base64');
}

export function postIdFromAtUri(uri: string): string {
  return safeBtoa(uri)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function atUriFromPostId(tweetId: string): string | null {
  const padded = tweetId.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (padded.length % 4)) % 4);

  return safeAtob(`${padded}${padding}`);
}

function decodePathSegment(value: string | undefined): string | null {
  if (!value) return null;

  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function getPostUriPartsFromAtUri(uri: string | null): PostUriParts | null {
  const match = uri?.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/);
  if (!match) return null;

  return {
    actor: match[1],
    rkey: match[2]
  };
}

function getPostUriPartsFromTweetId(tweetId: string): PostUriParts | null {
  return getPostUriPartsFromAtUri(atUriFromPostId(tweetId));
}

function trimUrlPunctuation(url: string): string {
  let trimmed = url;

  while (/[.,;:!?]$/.test(trimmed)) trimmed = trimmed.slice(0, -1);
  if (trimmed.endsWith(')') && !trimmed.includes('('))
    trimmed = trimmed.slice(0, -1);

  return trimmed;
}

function getBskyPostLinkFromUrl(rawUrl: string): BskyPostLink | null {
  const cleanUrl = trimUrlPunctuation(rawUrl);

  try {
    const url = new URL(cleanUrl);
    const segments = url.pathname
      .split('/')
      .filter(Boolean)
      .map(decodePathSegment);

    if (segments.some((segment) => !segment)) return null;

    const path = segments as string[];

    if (
      url.hostname === 'bsky.app' &&
      path[0] === 'profile' &&
      path[2] === 'post'
    ) {
      const actor = path[1];
      const rkey = path[3];

      if (!actor || !rkey) return null;

      return {
        actor,
        rkey,
        tweetId: postIdFromAtUri(`at://${actor}/app.bsky.feed.post/${rkey}`),
        url: cleanUrl
      };
    }

    const statusIndex = path.findIndex((segment) => segment === 'status');
    const statusActor = statusIndex > 0 ? path[statusIndex - 1] : undefined;
    const statusTweetId = statusIndex > 0 ? path[statusIndex + 1] : undefined;

    if (statusTweetId) {
      const parts = getPostUriPartsFromTweetId(statusTweetId);

      if (parts)
        return {
          ...parts,
          actor: statusActor ?? parts.actor,
          tweetId: statusTweetId,
          url: cleanUrl
        };

      if (statusActor)
        return {
          actor: statusActor,
          rkey: statusTweetId,
          tweetId: postIdFromAtUri(
            `at://${statusActor}/app.bsky.feed.post/${statusTweetId}`
          ),
          url: cleanUrl
        };
    }

    const tweetIndex = path.findIndex((segment) => segment === 'tweet');
    const tweetId = tweetIndex >= 0 ? path[tweetIndex + 1] : undefined;

    if (tweetId) {
      const parts = getPostUriPartsFromTweetId(tweetId);

      if (parts) return { ...parts, tweetId, url: cleanUrl };
    }
  } catch {
    return null;
  }

  return null;
}

export function getBskyUserUrl(username: string): string {
  return `${BSKY_APP_URL}/profile/${encodeURIComponent(username)}`;
}

export function getBskyTweetUrl(
  tweetId: string,
  username?: string | null
): string | null {
  const parts = getPostUriPartsFromTweetId(tweetId);
  const actor = username ?? parts?.actor;
  const rkey = parts?.rkey;

  if (!actor || !rkey) return null;

  return `${getBskyUserUrl(actor)}/post/${encodeURIComponent(rkey)}`;
}

export function getBskyPostLinkUrl(postLink: BskyPostLink): string {
  return `${getBskyUserUrl(postLink.actor)}/post/${encodeURIComponent(
    postLink.rkey
  )}`;
}

export function getBskyPostLinkFromText(text: string): BskyPostLink | null {
  const urls = text.match(/https?:\/\/[^\s<>"']+/gi);
  if (!urls) return null;

  for (const url of urls) {
    const postLink = getBskyPostLinkFromUrl(url);

    if (postLink) return postLink;
  }

  return null;
}

export function canonicalizeBskyPostLinksInText(text: string): string {
  const urls = text.match(/https?:\/\/[^\s<>"']+/gi);
  if (!urls) return text.trim();

  return urls
    .reduce((nextText, url) => {
      const postLink = getBskyPostLinkFromUrl(url);

      return postLink
        ? nextText.replace(postLink.url, getBskyPostLinkUrl(postLink))
        : nextText;
    }, text)
    .trim();
}

export function removeBskyPostLinkFromText(
  text: string,
  postLink: BskyPostLink | null
): string {
  if (!postLink) return text.trim();

  return text
    .replace(postLink.url, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getUserPath(username: string): string {
  return `/${encodeURIComponent(username)}`;
}

export function getProfileTweetSearchQuery(username: string): string {
  return `from:${username.trim().replace(/^@+/, '')}`;
}

export function getUserTabPath(username: string, path?: string): string {
  return `${getUserPath(username)}${path ? `/${path}` : ''}`;
}

export function getTweetPath(
  tweetId: string,
  username?: string | null
): string {
  return username
    ? `${getUserPath(username)}/status/${encodeURIComponent(tweetId)}`
    : `/tweet/${encodeURIComponent(tweetId)}`;
}

export function getTweetQuotesPath(
  tweetId: string,
  username?: string | null
): string {
  return `${getTweetPath(tweetId, username)}/retweets/with_comments`;
}

export function getNotificationsPath(tab: NotificationsTab = 'all'): string {
  if (tab === 'mentions') return '/notifications/mentions';
  if (tab === 'tweets') return '/notifications/tweets';

  return '/notifications';
}

function getConfiguredBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? '';

  if (!basePath || basePath === '/') return '';

  return `/${basePath.replace(/^\/+|\/+$/g, '')}`;
}

function normalizeRoutePath(path: string): string {
  let pathname = path.split(/[?#]/)[0] || '/';
  const basePath = getConfiguredBasePath();

  if (
    basePath &&
    (pathname === basePath || pathname.startsWith(`${basePath}/`))
  )
    pathname = pathname.slice(basePath.length) || '/';

  return pathname.replace(/\/+$/g, '') || '/';
}

export function getNotificationsTab(path: string): NotificationsTab {
  const pathname = normalizeRoutePath(path);

  if (pathname === getNotificationsPath('mentions')) return 'mentions';
  if (pathname === getNotificationsPath('tweets')) return 'tweets';

  return 'all';
}
