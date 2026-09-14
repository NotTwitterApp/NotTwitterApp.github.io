import { createElement, useEffect, useRef, type JSX } from 'react';
import { parseTwemojiNode } from '@lib/twemoji';
import type { CSSProperties, ReactNode } from 'react';

type TwemojiScopeProps = {
  as?: keyof JSX.IntrinsicElements;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function TwemojiScope({
  as = 'span',
  children,
  className,
  style
}: TwemojiScopeProps): JSX.Element {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (ref.current) parseTwemojiNode(ref.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [children]);

  return createElement(as, { className, ref, style }, children);
}
