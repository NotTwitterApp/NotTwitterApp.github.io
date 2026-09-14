import { useEffect, useRef, useState, type JSX } from 'react';
import Link from 'next/link';
import cn from 'clsx';
import { useWindow } from '@lib/context/window-context';
import { getUserPath } from '@lib/routes';
import { SearchBar } from './search-bar';
import type { ReactNode, WheelEvent } from 'react';

type AsideProps = {
  children: ReactNode;
};

type AsideFooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

const minAsideViewportWidth = 1120;
const ownerHandle = 'krouss.net';

const asideFooterLinks: Readonly<AsideFooterLink[]> = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Help Center', href: '/help-center' },
  {
    label: 'Repo',
    href: 'https://github.com/EricKrouss/not-twitter',
    external: true
  },
  { label: 'Follow the Developer', href: getUserPath(ownerHandle) }
];

const getPixelValue = (value: string): number => Number.parseFloat(value) || 0;

function getAsideAvailableHeight(aside: HTMLElement): number {
  const { paddingTop, paddingBottom } = getComputedStyle(aside);
  const { top } = aside.getBoundingClientRect();
  const visibleHeight = Math.max(
    0,
    Math.min(aside.clientHeight, window.innerHeight - Math.max(0, top))
  );

  return Math.max(
    0,
    visibleHeight - getPixelValue(paddingTop) - getPixelValue(paddingBottom)
  );
}

function getAsideContentHeight(content: HTMLElement): number {
  return Math.max(content.scrollHeight, content.getBoundingClientRect().height);
}

function shouldScrollAside(aside: HTMLElement, content: HTMLElement): boolean {
  return getAsideContentHeight(content) - getAsideAvailableHeight(aside) > 1;
}

function AsideFooter(): JSX.Element {
  return (
    <footer
      className='px-4 text-center text-[13px] leading-4 text-light-secondary dark:text-dark-secondary'
      aria-label='Footer'
    >
      <nav className='flex flex-wrap justify-center gap-x-3 gap-y-1'>
        {asideFooterLinks.map(({ label, href, external }) =>
          external ? (
            <a
              className='custom-underline'
              href={href}
              target='_blank'
              rel='noreferrer'
              key={href}
            >
              {label}
            </a>
          ) : (
            <Link href={href} key={href}>
              <a className='custom-underline'>{label}</a>
            </Link>
          )
        )}
      </nav>
    </footer>
  );
}

export function Aside({ children }: AsideProps): JSX.Element | null {
  const { width, height } = useWindow();
  const asideRef = useRef<HTMLElement>(null);
  const measuredContentRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    const aside = asideRef.current;
    const content = measuredContentRef.current;

    if (!aside || !content) return;

    const updateScrollable = (): void => {
      const nextIsScrollable = shouldScrollAside(aside, content);

      if (!nextIsScrollable) aside.scrollTop = 0;

      setIsScrollable(nextIsScrollable);
    };

    updateScrollable();
    window.addEventListener('resize', updateScrollable);

    if (!('ResizeObserver' in window))
      return () => window.removeEventListener('resize', updateScrollable);

    const resizeObserver = new ResizeObserver(updateScrollable);
    resizeObserver.observe(aside);
    resizeObserver.observe(content);

    return () => {
      window.removeEventListener('resize', updateScrollable);
      resizeObserver.disconnect();
    };
  }, [width, height]);

  const handleWheel = (event: WheelEvent<HTMLElement>): void => {
    if (event.ctrlKey) return;

    const aside = asideRef.current;
    const content = measuredContentRef.current;

    if (!aside || !content || shouldScrollAside(aside, content)) return;

    aside.scrollTop = 0;
    if (isScrollable) setIsScrollable(false);

    event.preventDefault();
    window.scrollBy({ top: event.deltaY, left: event.deltaX });
  };

  if (width < minAsideViewportWidth) return null;

  return (
    <aside
      ref={asideRef}
      className={cn(
        `scrollbar-hidden sticky top-0 h-screen w-96 shrink-0 self-start
         px-4 pb-4 pt-1`,
        isScrollable
          ? 'overflow-y-auto overscroll-contain'
          : 'overflow-y-hidden'
      )}
      onWheel={handleWheel}
    >
      <div className='flex flex-col gap-4'>
        <div ref={measuredContentRef} className='flex flex-col gap-4'>
          <SearchBar />
          {children}
        </div>
        <AsideFooter />
      </div>
    </aside>
  );
}
