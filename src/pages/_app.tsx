import '@styles/fonts.scss';
import '@styles/globals.css';

import dynamic from 'next/dynamic';
import { useEffect, useState, type JSX } from 'react';
import { AuthContextProvider } from '@lib/context/auth-context';
import { ThemeContextProvider } from '@lib/context/theme-context';
import { RouteHistoryRecorder } from '@lib/hooks/useRouteBack';
import {
  ensureServerConnectionFetchWatcher,
  SERVER_CONNECTION_PROBLEM_EVENT
} from '@lib/server-connection';
import { AppHead } from '@components/common/app-head';
import type { ReactElement, ReactNode } from 'react';
import type { NextPage } from 'next';
import type { AppProps } from 'next/app';

const ServerConnectionModal = dynamic<{ defaultOpen?: boolean }>(
  () =>
    import('@components/modal/server-connection-modal').then(
      (module) => module.ServerConnectionModal
    ),
  { ssr: false }
);

type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement<any>) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

function ServerConnectionModalLoader(): JSX.Element | null {
  const [loadModal, setLoadModal] = useState(false);

  useEffect(() => {
    ensureServerConnectionFetchWatcher();

    const requestModal = (): void => setLoadModal(true);

    window.addEventListener(SERVER_CONNECTION_PROBLEM_EVENT, requestModal);
    window.addEventListener('offline', requestModal);

    return () => {
      window.removeEventListener(SERVER_CONNECTION_PROBLEM_EVENT, requestModal);
      window.removeEventListener('offline', requestModal);
    };
  }, []);

  return loadModal ? <ServerConnectionModal defaultOpen /> : null;
}

export default function App({
  Component,
  pageProps
}: AppPropsWithLayout): ReactNode {
  const getLayout = Component.getLayout ?? ((page): ReactNode => page);

  return (
    <>
      <AppHead />
      <AuthContextProvider>
        <ThemeContextProvider>
          <RouteHistoryRecorder>
            {getLayout(<Component {...pageProps} />)}
            <ServerConnectionModalLoader />
          </RouteHistoryRecorder>
        </ThemeContextProvider>
      </AuthContextProvider>
    </>
  );
}
