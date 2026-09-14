import { motion } from 'framer-motion';
import { where } from '@lib/atproto/store';
import { useAuth } from '@lib/context/auth-context';
import { useRouteBack } from '@lib/hooks/useRouteBack';
import { usersCollection } from '@lib/atproto/collections';
import { useInfiniteScroll } from '@lib/hooks/useInfiniteScroll';
import {
  PeopleLayout,
  ProtectedLayout
} from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainHeader } from '@components/home/main-header';
import { MainContainer } from '@components/home/main-container';
import { UserCard } from '@components/user/user-card';
import { Loading } from '@components/ui/loading';
import { Error } from '@components/ui/error';
import { variants } from '@components/aside/aside-trends';
import type { ReactElement, ReactNode, JSX } from 'react';

export default function People(): JSX.Element {
  const { user } = useAuth();

  const { data, loading, LoadMore } = useInfiniteScroll(
    usersCollection,
    [where('id', '!=', user?.id)],
    { allowNull: true, preserve: true },
    { marginBottom: 500 }
  );

  const routeBack = useRouteBack();

  return (
    <MainContainer>
      <SEO title='People / Not Twitter' />
      <MainHeader useActionButton title='People' action={routeBack} />
      <section>
        {loading ? (
          <Loading className='mt-5' />
        ) : !data ? (
          <Error message='Something went wrong' />
        ) : (
          <>
            <motion.div className='mt-0.5' {...variants}>
              {data?.map((userData) => (
                <UserCard {...userData} key={userData.id} follow />
              ))}
            </motion.div>
            <LoadMore />
          </>
        )}
      </section>
    </MainContainer>
  );
}

People.getLayout = (page: ReactElement<any>): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <PeopleLayout>{page}</PeopleLayout>
    </MainLayout>
  </ProtectedLayout>
);
