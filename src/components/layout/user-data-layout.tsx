import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/router';
import { getUser, subscribeBackend } from '@lib/atproto/backend';
import { UserContextProvider } from '@lib/context/user-context';
import { useRouteBack } from '@lib/hooks/useRouteBack';
import { getProfileRouteId } from '@lib/static-routes';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { UserHeader } from '@components/user/user-header';
import type { LayoutProps } from './common-layout';
import type { User } from '@lib/types/user';

export function UserDataLayout({ children }: LayoutProps): JSX.Element {
  const {
    asPath,
    query: { id }
  } = useRouter();
  const routeBack = useRouteBack();
  const routeId = (Array.isArray(id) ? id[0] : id) ?? getProfileRouteId(asPath);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    let requestId = 0;

    const loadUser = (): void => {
      const currentRequestId = ++requestId;

      if (!routeId) {
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setUser(null);

      void getUser(routeId).then(
        (nextUser) => {
          if (canceled || currentRequestId !== requestId) return;

          setUser(nextUser);
          setLoading(false);
        },
        () => {
          if (canceled || currentRequestId !== requestId) return;

          setUser(null);
          setLoading(false);
        }
      );
    };

    loadUser();
    const unsubscribe = subscribeBackend(loadUser);

    return () => {
      canceled = true;
      unsubscribe();
    };
  }, [routeId]);

  return (
    <UserContextProvider value={{ user, loading }}>
      {!user && !loading && <SEO title='User not found / Not Twitter' />}
      <MainContainer>
        <MainHeader useActionButton action={routeBack}>
          <UserHeader />
        </MainHeader>
        {children}
      </MainContainer>
    </UserContextProvider>
  );
}
