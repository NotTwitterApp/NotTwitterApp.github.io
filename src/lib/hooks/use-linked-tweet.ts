import useSWR from 'swr';
import { useAuth } from '@lib/context/auth-context';
import { postIdFromAtUri } from '@lib/routes';
import type { BskyPostLink } from '@lib/routes';
import type { EmbeddedTweet, TweetWithUser } from '@lib/types/tweet';

export function toEmbeddedTweet(tweet: TweetWithUser): EmbeddedTweet {
  return {
    id: tweet.id,
    authorName: tweet.user.name,
    authorUsername: tweet.user.username,
    authorAvatar: tweet.user.photoURL,
    authorVerified: tweet.user.verified,
    text: tweet.text,
    langs: tweet.langs,
    createdAt: tweet.createdAt,
    images: tweet.images,
    mediaWarning: tweet.mediaWarning,
    card: tweet.card,
    tombstone: tweet.tombstone,
    unavailable:
      tweet.unavailable === 'blocked-by' ? 'blocked' : tweet.unavailable
  };
}

export function useLinkedTweet(
  link: BskyPostLink | null
): TweetWithUser | null {
  const { user } = useAuth();
  const { data } = useSWR(
    link ? ['linked-tweet', user?.id ?? '', link.actor, link.rkey] : null,
    async ([, , actor, rkey]): Promise<TweetWithUser | null> => {
      const { getUser, getTweet } = await import('@lib/atproto/backend');
      // getPosts expects a DID in the AT URI; web links often contain a handle.
      const author = await getUser(actor);
      if (!author) return null;
      const tweet = await getTweet(
        postIdFromAtUri(`at://${author.id}/app.bsky.feed.post/${rkey}`)
      );
      return tweet ? { ...tweet, user: author } : null;
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: false,
      dedupingInterval: 30_000,
      errorRetryCount: 1
    }
  );
  return link ? (data ?? null) : null;
}
