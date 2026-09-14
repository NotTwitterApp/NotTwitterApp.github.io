import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { getStatsMove } from '@lib/utils';
import { formatNumber } from '@lib/date';

import type { JSX } from 'react';

type NumberStatsProps = {
  move: number;
  stats: number;
  label?: string;
  className?: string;
  containerClassName?: string;
  alwaysShowStats?: boolean;
};

export function NumberStats({
  move,
  stats,
  label,
  className,
  containerClassName,
  alwaysShowStats
}: NumberStatsProps): JSX.Element {
  return (
    <div className={cn('overflow-hidden', containerClassName)}>
      <AnimatePresence mode='wait' initial={false}>
        {(alwaysShowStats || !!stats) && (
          <motion.p
            className={className ?? 'text-sm'}
            {...getStatsMove(move)}
            key={stats}
          >
            {label ?? formatNumber(stats)}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
