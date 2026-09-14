import {
  createElement,
  Fragment,
  useCallback,
  useEffect,
  useRef,
  type JSX
} from 'react';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';

const routeHistoryKey = 'not-twitter:route-history';
const maxRouteHistoryEntries = 50;
const defaultBackFallbackPath = '/home';

type RouteHistoryUpdate = {
  browserTraversal?: boolean;
};

function getConfiguredBasePath(): string {
  const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? '';
  const basePath = rawBasePath.replace(/^\/+|\/+$/g, '');

  return basePath ? `/${basePath}` : '';
}

function stripBasePath(pathname: string): string {
  const basePath = getConfiguredBasePath();

  if (!basePath) return pathname;
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`))
    return pathname.slice(basePath.length) || '/';

  return pathname;
}

function hasDynamicRouteSegment(pathname: string): boolean {
  return pathname.split('/').some((segment) => /^\[.+\]$/.test(segment));
}

function normalizeRoutePath(path: string | null | undefined): string | null {
  if (!path) return null;

  try {
    const url = new URL(path, 'https://not-twitter.local');
    const pathname = stripBasePath(url.pathname).replace(/\/+$/g, '') || '/';

    if (hasDynamicRouteSegment(pathname)) return null;

    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function getCurrentBrowserPath(fallbackPath: string): string {
  if (typeof window === 'undefined') return fallbackPath;

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function compactRouteHistory(history: readonly string[]): string[] {
  return history
    .map(normalizeRoutePath)
    .filter((path): path is string => !!path)
    .slice(-maxRouteHistoryEntries);
}

export function updateRouteHistory(
  history: readonly string[],
  nextPath: string,
  { browserTraversal = false }: RouteHistoryUpdate = {}
): string[] {
  const normalizedNextPath = normalizeRoutePath(nextPath);
  if (!normalizedNextPath) return compactRouteHistory(history);

  const compactHistory = compactRouteHistory(history);
  const currentPath = compactHistory[compactHistory.length - 1];

  if (currentPath === normalizedNextPath) return compactHistory;

  if (browserTraversal) {
    const previousIndex = compactHistory.lastIndexOf(normalizedNextPath);

    if (previousIndex >= 0) return compactHistory.slice(0, previousIndex + 1);
  }

  if (currentPath === '/' && normalizedNextPath === '/home')
    return [normalizedNextPath];

  return [...compactHistory, normalizedNextPath].slice(-maxRouteHistoryEntries);
}

export function getRouteBackTarget(
  history: readonly string[],
  currentPath: string,
  fallbackPath = defaultBackFallbackPath
): string {
  const normalizedCurrentPath = normalizeRoutePath(currentPath);
  const normalizedFallbackPath =
    normalizeRoutePath(fallbackPath) ?? defaultBackFallbackPath;
  const compactHistory = compactRouteHistory(history);

  while (
    normalizedCurrentPath &&
    compactHistory[compactHistory.length - 1] === normalizedCurrentPath
  )
    compactHistory.pop();

  return compactHistory[compactHistory.length - 1] ?? normalizedFallbackPath;
}

function readRouteHistory(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const rawHistory = window.sessionStorage.getItem(routeHistoryKey);
    if (!rawHistory) return [];

    const parsedHistory: unknown = JSON.parse(rawHistory);

    return Array.isArray(parsedHistory)
      ? compactRouteHistory(
          parsedHistory.filter(
            (path): path is string => typeof path === 'string'
          )
        )
      : [];
  } catch {
    return [];
  }
}

function writeRouteHistory(history: readonly string[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      routeHistoryKey,
      JSON.stringify(compactRouteHistory(history))
    );
  } catch {
    // Losing the remembered route stack is non-fatal; the back button will use
    // its normal fallback instead.
  }
}

export function RouteHistoryRecorder({
  children
}: {
  children?: ReactNode;
}): JSX.Element {
  const router = useRouter();
  const browserTraversalRef = useRef(false);

  useEffect(() => {
    writeRouteHistory(
      updateRouteHistory(
        readRouteHistory(),
        getCurrentBrowserPath(router.asPath)
      )
    );
    // This should run only for the route mounted with the app shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handlePopState = (): void => {
      browserTraversalRef.current = true;
    };

    const handleRouteChangeComplete = (nextPath: string): void => {
      const browserTraversal = browserTraversalRef.current;

      browserTraversalRef.current = false;
      writeRouteHistory(
        updateRouteHistory(
          readRouteHistory(),
          getCurrentBrowserPath(nextPath),
          {
            browserTraversal
          }
        )
      );
    };

    window.addEventListener('popstate', handlePopState);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router.events]);

  return createElement(Fragment, null, children);
}

export function useRouteBack(
  fallbackPath = defaultBackFallbackPath
): () => void {
  const router = useRouter();

  return useCallback((): void => {
    const history = readRouteHistory();
    const targetPath = getRouteBackTarget(
      history,
      getCurrentBrowserPath(router.asPath),
      fallbackPath
    );

    writeRouteHistory(
      updateRouteHistory(history, targetPath, {
        browserTraversal: true
      })
    );

    void router.push(targetPath);
  }, [fallbackPath, router]);
}
