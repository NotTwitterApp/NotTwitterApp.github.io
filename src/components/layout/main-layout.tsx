import { SWRConfig } from 'swr';
import { Toaster } from 'react-hot-toast';
import { fetchJSON } from '@lib/fetch';
import { LiveUpdatesProvider } from '@lib/context/live-updates-context';
import { useWindow, WindowContextProvider } from '@lib/context/window-context';
import { Sidebar } from '@components/sidebar/sidebar';
import type { DefaultToastOptions } from 'react-hot-toast';
import type { LayoutProps } from './common-layout';

import type { JSX } from 'react';

const toastOptions: DefaultToastOptions = {
  style: {
    color: 'white',
    borderRadius: '4px',
    backgroundColor: 'rgb(var(--main-accent))'
  },
  success: { duration: 4000 }
};

const swrOptions = {
  fetcher: fetchJSON,
  dedupingInterval: 10000,
  focusThrottleInterval: 60000,
  revalidateOnReconnect: false,
  shouldRetryOnError: false
};

function MainToaster(): JSX.Element {
  const { isMobile } = useWindow();

  return (
    <Toaster
      position='bottom-center'
      toastOptions={toastOptions}
      containerClassName={isMobile ? 'mb-12' : 'mb-0'}
    />
  );
}

export function MainLayout({ children }: LayoutProps): JSX.Element {
  return (
    <div className='flex w-full justify-center'>
      <WindowContextProvider>
        <LiveUpdatesProvider>
          <Sidebar />
          <SWRConfig value={swrOptions}>{children}</SWRConfig>
        </LiveUpdatesProvider>
        <MainToaster />
      </WindowContextProvider>
    </div>
  );
}
