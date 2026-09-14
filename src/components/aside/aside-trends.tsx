import Link from 'next/link';
import cn from 'clsx';
import { motion } from 'framer-motion';
import { useTrends } from '@lib/api/trends';
import { Error } from '@components/ui/error';
import { Loading } from '@components/ui/loading';
import type { MotionProps } from 'framer-motion';

import type { JSX } from 'react';

export const variants: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2, ease: 'easeOut' }
};

type AsideTrendsProps = {
  inTrendsPage?: boolean;
};

export function AsideTrends({ inTrendsPage }: AsideTrendsProps): JSX.Element {
  const { data, loading } = useTrends(1, inTrendsPage ? 25 : 10, {
    refreshInterval: 30000
  });

  const { trends } = data ?? {};

  return (
    <section
      className={cn(
        !inTrendsPage &&
          'hover-animation rounded-2xl bg-main-sidebar-background'
      )}
    >
      {loading ? (
        <Loading />
      ) : trends ? (
        <motion.div
          className={cn('inner:px-4 inner:py-3', inTrendsPage && 'mt-0.5')}
          {...variants}
        >
          {!inTrendsPage && (
            <h2 className='text-xl font-extrabold'>What&apos;s happening</h2>
          )}
          {trends.map(
            ({
              kind,
              name,
              rank,
              query,
              displayName,
              description,
              category,
              url
            }) => (
              <Link href={url} key={`${kind}-${rank}-${query}`}>
                <a className='hover-animation accent-tab hover-card relative flex flex-col gap-0.5'>
                  <p className='text-sm text-light-secondary dark:text-dark-secondary'>
                    {kind === 'topic'
                      ? category
                        ? `${category} · Trending`
                        : 'Trending'
                      : 'Suggested feed'}
                  </p>
                  <p className='font-bold'>{displayName || name}</p>
                  {(description || kind === 'suggested') && (
                    <p className='text-sm text-light-secondary dark:text-dark-secondary'>
                      {description ?? 'Suggested feed'}
                    </p>
                  )}
                </a>
              </Link>
            )
          )}
          {!inTrendsPage && (
            <Link href='/explore'>
              <a
                className='custom-button accent-tab hover-card block w-full rounded-2xl
                           rounded-t-none text-center text-main-accent'
              >
                Show more
              </a>
            </Link>
          )}
        </motion.div>
      ) : (
        <Error />
      )}
    </section>
  );
}
