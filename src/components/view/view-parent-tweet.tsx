import { useEffect, type JSX } from 'react';
import Link from 'next/link';
import { doc } from '@lib/atproto/store';
import { useDocument } from '@lib/hooks/useDocument';
import { tweetsCollection } from '@lib/atproto/collections';
import { Tweet } from '@components/tweet/tweet';
import type { RefObject } from 'react';

type ViewParentTweetProps = {
  parentId: string;
  viewTweetRef: RefObject<HTMLElement | null>;
};

export function ViewParentTweet({
  parentId,
  viewTweetRef
}: ViewParentTweetProps): JSX.Element | null {
  const { data, loading } = useDocument(doc(tweetsCollection, parentId), {
    includeUser: true,
    allowNull: true
  });

  useEffect(() => {
    if (!loading) viewTweetRef.current?.scrollIntoView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, loading]);

  if (loading) return null;
  if (!data)
    return (
      <div className='px-4 pt-3 pb-2'>
        <p
          className='rounded-2xl bg-main-sidebar-background py-3 px-1 pl-4 
                     text-light-secondary dark:text-dark-secondary'
        >
          This Tweet was deleted by the Tweet author.{' '}
          <Link
            href='/help-center/articles/tweet-tombstones-and-notices'
            className='custom-underline text-main-accent'
          >
            Learn more
          </Link>
        </p>
      </div>
    );

  return <Tweet parentTweet {...data} />;
}
