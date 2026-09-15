import useSWR from 'swr';
import { getArticleLink, getLinkCard } from '@lib/link-card';

export function useLinkCard(text: string | null | undefined, enabled = true) {
  const url = enabled ? getArticleLink(text ?? '') : null;
  const { data, isLoading } = useSWR(
    url ? ['link-card', url] : null,
    ([, value]) => getLinkCard(value),
    {
      keepPreviousData: false,
      revalidateOnFocus: false,
      dedupingInterval: 300_000
    }
  );
  return { card: url ? (data ?? null) : null, isLoading: !!url && isLoading };
}
