import { useEffect, useRef, useState, type JSX } from 'react';
import cn from 'clsx';
import type { CSSProperties, ReactNode } from 'react';

export type TweetActionEffectKind = 'like';

type TweetActionEffectProps = {
  kind: TweetActionEffectKind;
  active?: boolean;
  playKey?: number;
  className?: string;
  children: ReactNode;
};

const burstDots = Array.from({ length: 8 }, (_, index) => index);
const animationDurationMs: Readonly<Record<TweetActionEffectKind, number>> = {
  like: 800
};

export function TweetActionEffect({
  kind,
  playKey = 0,
  className,
  children
}: TweetActionEffectProps): JSX.Element {
  const mounted = useRef(false);
  const settleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPlayKey = useRef(playKey);
  const [animationKey, setAnimationKey] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const requestedReplay = playKey !== previousPlayKey.current;

    if (mounted.current && requestedReplay) {
      if (settleTimeout.current) clearTimeout(settleTimeout.current);

      setAnimationKey((currentKey) => currentKey + 1);
      setPlaying(true);

      settleTimeout.current = setTimeout(() => {
        setPlaying(false);
        settleTimeout.current = null;
      }, animationDurationMs[kind] + 80);
    }

    mounted.current = true;
    previousPlayKey.current = playKey;
  }, [kind, playKey]);

  useEffect(
    () => () => {
      if (settleTimeout.current) clearTimeout(settleTimeout.current);
    },
    []
  );

  return (
    <span
      className={cn(
        'tweet-action-effect',
        `tweet-action-effect--${kind}`,
        playing && 'tweet-action-effect--playing',
        className
      )}
    >
      <span
        className='tweet-action-effect__ring'
        aria-hidden
        key={`ring-${animationKey}`}
      />
      {kind === 'like' && (
        <span
          className='tweet-action-effect__burst'
          aria-hidden
          key={`burst-${animationKey}`}
        >
          {burstDots.map((dot) => (
            <span
              style={
                {
                  '--tweet-action-dot-angle': `${dot * 45}deg`
                } as CSSProperties
              }
              key={dot}
            />
          ))}
        </span>
      )}
      <span className='tweet-action-effect__icon' key={`icon-${animationKey}`}>
        {children}
      </span>
    </span>
  );
}
