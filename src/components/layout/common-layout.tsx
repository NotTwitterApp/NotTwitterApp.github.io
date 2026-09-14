import { useAuth } from '@lib/context/auth-context';
import { WindowContextProvider } from '@lib/context/window-context';
import { useRequireAuth } from '@lib/hooks/useRequireAuth';
import { Aside } from '@components/aside/aside';
import { AsideTrends } from '@components/aside/aside-trends';
import { Suggestions } from '@components/aside/suggestions';
import { Placeholder } from '@components/common/placeholder';
import { SearchFilters } from '@components/explore/search-filters';
import { MainLayout } from './main-layout';
import {
  LoggedOutProfileLayout,
  LoggedOutTwitterLayout
} from './logged-out-twitter-layout';
import type { ReactNode, JSX } from 'react';

export type LayoutProps = {
  children: ReactNode;
};

export function ProtectedLayout({ children }: LayoutProps): JSX.Element {
  const user = useRequireAuth();

  if (!user) return <Placeholder />;

  return <>{children}</>;
}

export function HomeLayout({ children }: LayoutProps): JSX.Element {
  return (
    <>
      {children}
      <Aside>
        <AsideTrends />
        <Suggestions />
      </Aside>
    </>
  );
}

export function UserLayout({ children }: LayoutProps): JSX.Element {
  return (
    <>
      {children}
      <Aside>
        <Suggestions />
        <AsideTrends />
      </Aside>
    </>
  );
}

export function PublicUserLayout({ children }: LayoutProps): JSX.Element {
  const { user } = useAuth();

  return user ? (
    <MainLayout>
      <UserLayout>{children}</UserLayout>
    </MainLayout>
  ) : (
    <LoggedOutProfileLayout>
      <WindowContextProvider>{children}</WindowContextProvider>
    </LoggedOutProfileLayout>
  );
}

export function PublicTweetLayout({ children }: LayoutProps): JSX.Element {
  const { user, loading } = useAuth();

  if (loading) return <Placeholder />;

  return user ? (
    <MainLayout>
      <HomeLayout>{children}</HomeLayout>
    </MainLayout>
  ) : (
    <LoggedOutTwitterLayout>
      <WindowContextProvider>
        <div className='mx-auto flex w-full max-w-xl'>{children}</div>
      </WindowContextProvider>
    </LoggedOutTwitterLayout>
  );
}

export function TrendsLayout({ children }: LayoutProps): JSX.Element {
  return (
    <>
      {children}
      <Aside>
        <SearchFilters />
        <Suggestions />
      </Aside>
    </>
  );
}

export function PeopleLayout({ children }: LayoutProps): JSX.Element {
  return (
    <>
      {children}
      <Aside>
        <AsideTrends />
      </Aside>
    </>
  );
}
