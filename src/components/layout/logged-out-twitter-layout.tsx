import { useState, type FormEvent, type ReactNode, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTrends } from '@lib/api/trends';
import { useModal } from '@lib/hooks/useModal';
import { BlueskySignInModal } from '@components/login/bluesky-sign-in-modal';
import { Loading } from '@components/ui/loading';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon } from '@components/ui/hero-icon';
import { Button } from '@components/ui/button';

type LoggedOutTwitterLayoutProps = {
  children: ReactNode;
};

type LoggedOutAuthActionProps = {
  openSignInModal: () => void;
};

function LoggedOutSearch(): JSX.Element {
  const [value, setValue] = useState('');
  const { push } = useRouter();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const query = value.trim();
    if (!query) return;

    void push({
      pathname: '/explore',
      query: { q: query, src: 'typed_query' }
    });
  };

  return (
    <form
      className='mx-5 hidden h-11 min-w-0 max-w-[525px] flex-1 md:block'
      role='search'
      onSubmit={handleSubmit}
    >
      <label
        className='flex h-full items-center gap-4 rounded-full bg-main-search-background px-5 text-main-secondary
                   focus-within:bg-main-background focus-within:ring-1 focus-within:ring-main-accent'
      >
        <HeroIcon
          className='h-[22px] w-[22px]'
          iconName='MagnifyingGlassIcon'
        />
        <input
          className='min-w-0 flex-1 bg-transparent text-[17px] leading-6 text-main-primary outline-none
                     placeholder:text-main-secondary'
          type='text'
          value={value}
          placeholder='Search Not Twitter'
          onChange={({ target: { value } }): void => setValue(value)}
        />
      </label>
    </form>
  );
}

function LoggedOutTopBar(): JSX.Element {
  return (
    <header className='border-b border-light-border bg-main-background dark:border-dark-border'>
      <nav className='mx-auto flex h-14 w-full max-w-[1280px] items-center px-6'>
        <Link
          href='/'
          className='main-tab text-[#1da1f2]'
          aria-label='Not Twitter'
        >
          <CustomIcon className='h-[31px] w-[31px]' iconName='TwitterIcon' />
        </Link>
        <LoggedOutSearch />
        <div className='ml-auto flex items-center gap-3'>
          <Link
            href='/'
            className='main-tab hidden min-w-[87px] rounded-full border border-[#1da1f2] px-4 py-1.5
                       text-center text-[15px] font-bold leading-5 text-[#1da1f2] transition
                       hover:bg-[#1da1f2]/10 sm:block'
          >
            Log in
          </Link>
          <Link
            href='/'
            className='main-tab min-w-[97px] rounded-full bg-[#1da1f2] px-4 py-2 text-center
                       text-[15px] font-bold leading-5 text-white transition hover:bg-[#1a91da]'
          >
            Sign up
          </Link>
          <button
            className='main-tab hidden rounded-full p-2 text-[#1da1f2] transition hover:bg-[#1da1f2]/10 sm:block'
            type='button'
            aria-label='More'
          >
            <HeroIcon className='h-6 w-6' iconName='EllipsisHorizontalIcon' />
          </button>
        </div>
      </nav>
    </header>
  );
}

function LoggedOutProfileSidebar(): JSX.Element {
  return (
    <header className='hidden w-20 shrink-0 justify-end md:flex lg:w-24 xl:w-[275px]'>
      <div className='sticky top-0 flex h-screen w-20 flex-col px-3 py-3 xl:w-[275px]'>
        <Link
          href='/'
          className='main-tab mb-4 flex h-[50px] w-[50px] items-center justify-center rounded-full
                     text-main-accent transition hover:bg-main-primary/10'
          aria-label='Not Twitter'
        >
          <CustomIcon className='h-[30px] w-[30px]' iconName='TwitterIcon' />
        </Link>
        <nav className='flex flex-col gap-2'>
          <Link
            href='/explore'
            className='main-tab flex min-h-[50px] items-center gap-5 rounded-full px-3 text-xl
                       text-main-primary transition hover:bg-main-primary/10 xl:w-fit xl:pr-6'
          >
            <HeroIcon className='h-[27px] w-[27px]' iconName='HashtagIcon' />
            <span className='hidden xl:block'>Explore</span>
          </Link>
          <Link
            href='/settings'
            className='main-tab flex min-h-[50px] items-center gap-5 rounded-full px-3 text-xl
                       text-main-primary transition hover:bg-main-primary/10 xl:w-fit xl:pr-6'
          >
            <HeroIcon className='h-[27px] w-[27px]' iconName='Cog6ToothIcon' />
            <span className='hidden xl:block'>Settings</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function LoggedOutRailSearch(): JSX.Element {
  const [value, setValue] = useState('');
  const { push } = useRouter();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const query = value.trim();
    if (!query) return;

    void push({
      pathname: '/explore',
      query: { q: query, src: 'typed_query' }
    });
  };

  return (
    <form className='mb-[73px] h-11' role='search' onSubmit={handleSubmit}>
      <label
        className='flex h-full items-center gap-4 rounded-full bg-main-search-background px-4 text-main-secondary
                   focus-within:bg-main-background focus-within:ring-1 focus-within:ring-main-accent'
      >
        <HeroIcon className='h-5 w-5' iconName='MagnifyingGlassIcon' />
        <input
          className='min-w-0 flex-1 bg-transparent text-[15px] leading-5 text-main-primary outline-none
                     placeholder:text-main-secondary'
          type='text'
          value={value}
          placeholder='Search Not Twitter'
          onChange={({ target: { value } }): void => setValue(value)}
        />
      </label>
    </form>
  );
}

function LoggedOutSignupCard({
  openSignInModal
}: LoggedOutAuthActionProps): JSX.Element {
  return (
    <section className='mb-3 rounded-2xl border border-light-line-reply dark:border-dark-border bg-main-background px-4 py-3'>
      <h2 className='text-xl font-extrabold leading-6'>New to Not Twitter?</h2>
      <p className='mt-1 text-[13px] leading-4 text-main-secondary'>
        Create your account on Bluesky, then come back here and sign in.
      </p>
      <div className='mt-4 flex flex-col gap-3'>
        <a
          className='main-tab flex min-h-[38px] items-center justify-center rounded-full bg-main-primary px-4
                     text-center text-[15px] font-bold text-main-background transition hover:opacity-90'
          href='https://bsky.app/'
          target='_blank'
          rel='noreferrer'
        >
          Create account
        </a>
        <Button
          className='min-h-[38px] rounded-full border border-light-line-reply dark:border-dark-border bg-main-background px-4 py-2 text-[15px]
                     font-bold text-main-primary transition hover:bg-main-primary/10'
          onClick={openSignInModal}
        >
          Sign in with Bluesky
        </Button>
      </div>
      <p className='mt-3 text-[13px] leading-4 text-main-secondary'>
        By signing in, you agree to the{' '}
        <Link href='/privacy' className='custom-underline text-main-accent'>
          Privacy Policy
        </Link>
        .
      </p>
    </section>
  );
}

function LoggedOutWhatsHappening(): JSX.Element {
  const { data, loading } = useTrends(1, 6, {
    refreshInterval: 30000
  });

  const { trends } = data ?? {};

  return (
    <section className='mb-4 overflow-hidden rounded-2xl bg-main-sidebar-background'>
      <h2 className='px-4 py-3 text-xl font-extrabold leading-6'>
        What&apos;s happening
      </h2>
      {loading ? (
        <Loading className='py-6' />
      ) : trends?.length ? (
        <>
          {trends.map(
            ({
              kind,
              name,
              rank,
              query,
              displayName,
              description,
              category,
              url
            }) => (
              <Link
                href={url}
                key={`${kind}-${rank}-${query}`}
                className='hover-animation flex flex-col gap-0.5 px-4 py-3 hover:bg-main-primary/[0.03]'
              >
                <p className='text-[13px] leading-4 text-main-secondary'>
                  {kind === 'topic'
                    ? category
                      ? `${category} · Trending`
                      : 'Trending'
                    : 'Suggested feed'}
                </p>
                <p className='text-[15px] font-bold leading-5'>
                  {displayName || name}
                </p>
                {description && (
                  <p
                    className='overflow-hidden text-[13px] leading-4 text-main-secondary [display:-webkit-box]
                               [-webkit-box-orient:vertical] [-webkit-line-clamp:2]'
                  >
                    {description}
                  </p>
                )}
              </Link>
            )
          )}
          <Link
            href='/explore'
            className='hover-animation block px-4 py-4 text-[15px] leading-5 text-main-accent hover:bg-main-primary/[0.03]'
          >
            Show more
          </Link>
        </>
      ) : (
        <p className='px-4 pb-4 text-[15px] leading-5 text-main-secondary'>
          Something went wrong. Try reloading.
        </p>
      )}
    </section>
  );
}

function LoggedOutPublicFooter(): JSX.Element {
  return (
    <footer className='px-4 text-[13px] leading-4 text-main-secondary'>
      <nav className='flex flex-wrap gap-x-3 gap-y-1'>
        <Link href='/privacy' className='custom-underline'>
          Privacy Policy
        </Link>
        <Link href='/help-center' className='custom-underline'>
          Help Center
        </Link>
        <a
          className='custom-underline'
          href='https://bsky.app/'
          target='_blank'
          rel='noreferrer'
        >
          Bluesky
        </a>
        <a
          className='custom-underline'
          href='https://github.com/EricKrouss/not-twitter'
          target='_blank'
          rel='noreferrer'
        >
          Repository
        </a>
        <span>This is NOT Twitter this is Bluesky</span>
      </nav>
    </footer>
  );
}

function LoggedOutRightRail({
  openSignInModal
}: LoggedOutAuthActionProps): JSX.Element {
  return (
    <aside className='sticky top-0 hidden h-screen w-[380px] shrink-0 overflow-y-auto px-[15px] pb-[92px] pt-1 lg:block'>
      <LoggedOutRailSearch />
      <LoggedOutSignupCard openSignInModal={openSignInModal} />
      <LoggedOutWhatsHappening />
      <LoggedOutPublicFooter />
    </aside>
  );
}

function LoggedOutBottomBanner({
  openSignInModal
}: LoggedOutAuthActionProps): JSX.Element {
  return (
    <div
      className='fixed inset-x-0 bottom-0 z-40 bg-main-accent px-4 py-3
                 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-white'
    >
      <div className='mx-auto flex w-full max-w-[990px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <p className='text-xl font-extrabold leading-6'>
            Don&apos;t miss what&apos;s happening
          </p>
          <p className='text-[15px] leading-5'>
            People on Not Twitter are the first to know.
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-3'>
          <Button
            className='border-white/35 min-h-[36px] min-w-[74px] rounded-full border px-4 py-1.5
                       text-[15px] font-bold text-white transition hover:bg-white/10'
            onClick={openSignInModal}
          >
            Log in
          </Button>
          <a
            className='main-tab flex min-h-[36px] min-w-[80px] items-center justify-center rounded-full
                       bg-white px-4 py-1.5 text-[15px] font-bold text-light-primary transition hover:bg-[#e6e6e6]'
            href='https://bsky.app/'
            target='_blank'
            rel='noreferrer'
          >
            Sign up
          </a>
        </div>
      </div>
    </div>
  );
}

export function LoggedOutProfileLayout({
  children
}: LoggedOutTwitterLayoutProps): JSX.Element {
  const {
    open: signInOpen,
    openModal: openSignInModal,
    closeModal: closeSignInModal
  } = useModal();

  return (
    <div className='min-h-screen bg-main-background font-twitter-chirp text-main-primary'>
      <BlueskySignInModal open={signInOpen} closeModal={closeSignInModal} />
      <div className='mx-auto flex w-full max-w-[1265px] justify-center'>
        <LoggedOutProfileSidebar />
        <div className='w-full min-w-0 max-w-[600px] pb-40 sm:pb-24'>
          {children}
        </div>
        <LoggedOutRightRail openSignInModal={openSignInModal} />
      </div>
      <LoggedOutBottomBanner openSignInModal={openSignInModal} />
    </div>
  );
}

export function LoggedOutTwitterLayout({
  children
}: LoggedOutTwitterLayoutProps): JSX.Element {
  return (
    <div className='min-h-screen bg-main-background font-twitter-chirp text-main-primary'>
      <LoggedOutTopBar />
      {children}
    </div>
  );
}
