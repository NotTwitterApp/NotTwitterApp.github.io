import { useRef } from 'react';
import useSWR from 'swr';
import { isStandardSiteArticleCard } from '@lib/standard-site';
import { getStandardSiteDocumentUris } from '@lib/standard-site-loader';
import type { TweetCard } from '@lib/types/tweet';

export const articleRefreshInterval = 60_000;

export function useStandardSiteArticle(card: TweetCard) {
  const cardRef = useRef(card);
  cardRef.current = card;
  const uris = getStandardSiteDocumentUris(card).sort();
  const enabled = isStandardSiteArticleCard(card) && uris.length > 0;
  const { data, isLoading } = useSWR(
    enabled ? ['standard-site-current', card.url, ...uris] : null,
    async () => {
      const { getStandardSiteArticleSnapshot } =
        await import('@lib/atproto/backend');
      const snapshot = await getStandardSiteArticleSnapshot(cardRef.current);
      // A refresh failure must not replace an already loaded revision.
      if (!snapshot) throw new Error('Article refresh unavailable');
      return snapshot;
    },
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: articleRefreshInterval,
      refreshWhenHidden: false,
      dedupingInterval: 2000,
      keepPreviousData: false
    }
  );
  return {
    snapshot: enabled ? data : undefined,
    loading: enabled && isLoading
  };
}
