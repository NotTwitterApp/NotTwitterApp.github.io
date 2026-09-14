import Link from 'next/link';
import cn from 'clsx';
import { MainLayout } from '@components/layout/main-layout';
import { ProtectedLayout } from '@components/layout/common-layout';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { MobileSidebar } from '@components/sidebar/mobile-sidebar';
import { NotTwitterBluePanel } from '@components/settings/not-twitter-blue-panel';
import { CustomIcon } from '@components/ui/custom-icon';
import type { ReactElement, ReactNode, JSX } from 'react';

const settingsRows = [
  { title: 'Your account', href: '/settings?section=account' },
  { title: 'Not Twitter Blue', href: '/not-twitter-blue', active: true },
  {
    title: 'Security and account access',
    href: '/settings?section=security'
  },
  { title: 'Privacy and safety', href: '/settings?section=privacy' },
  { title: 'Notifications', href: '/settings?section=notifications' },
  {
    title: 'Accessibility, display, and languages',
    href: '/settings?section=display'
  },
  { title: 'Additional resources', href: '/help-center' }
] as const;

function SettingsNavRow({
  title,
  href,
  active
}: {
  title: string;
  href: string;
  active?: boolean;
}): JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        `flex min-h-[78px] items-center justify-between border-r-4 border-b
         border-r-transparent border-light-border px-6 text-[19px] font-bold
         leading-6 transition hover:bg-light-primary/5
         dark:border-b-dark-border dark:hover:bg-dark-primary/5`,
        active &&
          `border-r-main-accent bg-light-primary/[0.035]
           dark:bg-dark-primary/[0.055]`
      )}
      aria-current={active ? 'page' : undefined}
    >
      <span className='min-w-0 truncate'>{title}</span>
      <CustomIcon
        className='ml-4 h-6 w-6 shrink-0 text-light-secondary dark:text-dark-secondary'
        iconName='TwitterChevronRightIcon'
      />
    </Link>
  );
}

export default function NotTwitterBlue(): JSX.Element {
  return (
    <MainContainer className='!max-w-[990px] pb-0'>
      <SEO title='Not Twitter Blue / Not Twitter' />
      <div className='grid min-h-screen md:grid-cols-[390px_minmax(0,600px)]'>
        <aside className='hidden border-r border-light-border dark:border-dark-border md:block'>
          <header
            className='sticky top-0 z-10 flex h-[53px] items-center border-b border-light-border
                       bg-main-background/90 px-6 backdrop-blur-md dark:border-dark-border'
          >
            <h2 className='text-[23px] font-extrabold leading-7'>Settings</h2>
          </header>
          <nav>
            {settingsRows.map((row) => (
              <SettingsNavRow {...row} key={row.href} />
            ))}
          </nav>
        </aside>
        <section className='min-w-0'>
          <header className='flex h-[53px] items-center gap-6 border-b border-light-border px-4 dark:border-dark-border md:hidden'>
            <MobileSidebar />
            <h2 className='-mt-1 text-xl font-bold'>Not Twitter Blue</h2>
          </header>
          <NotTwitterBluePanel />
        </section>
      </div>
    </MainContainer>
  );
}

NotTwitterBlue.getLayout = (page: ReactElement<any>): ReactNode => (
  <ProtectedLayout>
    <MainLayout>{page}</MainLayout>
  </ProtectedLayout>
);
