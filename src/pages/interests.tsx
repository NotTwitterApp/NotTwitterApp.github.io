import { useEffect, useMemo, useState, type JSX } from 'react';
import cn from 'clsx';
import useSWR from 'swr';
import { toast } from 'react-hot-toast';
import {
  getInterestsSetting,
  updateInterestsSetting
} from '@lib/atproto/backend';
import { useAuth } from '@lib/context/auth-context';
import { useRouteBack } from '@lib/hooks/useRouteBack';
import { HomeLayout, ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { MobileSidebar } from '@components/sidebar/mobile-sidebar';
import { Button } from '@components/ui/button';
import { CustomIcon } from '@components/ui/custom-icon';
import { Loading } from '@components/ui/loading';
import { ToolTip } from '@components/ui/tooltip';
import type { ReactElement, ReactNode } from 'react';

type InterestOption = {
  label: string;
  value: string;
};

const blueskyInterestOptions: Readonly<InterestOption[]> = [
  { label: 'Animals', value: 'animals' },
  { label: 'Art', value: 'art' },
  { label: 'Books', value: 'books' },
  { label: 'Comedy', value: 'comedy' },
  { label: 'Comics', value: 'comics' },
  { label: 'Culture', value: 'culture' },
  { label: 'Software Dev', value: 'software-dev' },
  { label: 'Education', value: 'education' },
  { label: 'Finance', value: 'finance' },
  { label: 'Food', value: 'food' },
  { label: 'Video Games', value: 'video-games' },
  { label: 'Journalism', value: 'journalism' },
  { label: 'Movies', value: 'movies' },
  { label: 'Music', value: 'music' },
  { label: 'Nature', value: 'nature' },
  { label: 'News', value: 'news' },
  { label: 'Pets', value: 'pets' },
  { label: 'Photography', value: 'photography' },
  { label: 'Politics', value: 'politics' },
  { label: 'Science', value: 'science' },
  { label: 'Sports', value: 'sports' },
  { label: 'Tech', value: 'tech' },
  { label: 'TV', value: 'tv' },
  { label: 'Writers', value: 'writers' }
];

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  )
    return (error as { message: string }).message;

  return 'Something went wrong.';
}

function formatInterestLabel(value: string): string {
  if (value.toLowerCase() === 'tv') return 'TV';

  return value
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

function InterestsHeader(): JSX.Element {
  const routeBack = useRouteBack();

  return (
    <header className='hover-animation sticky top-0 z-20 border-b border-light-border bg-main-background/90 backdrop-blur-md dark:border-dark-border'>
      <div className='flex h-[53px] items-center gap-4 px-3'>
        <Button
          className='dark-bg-tab group relative p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          aria-label='Back'
          onClick={routeBack}
        >
          <CustomIcon className='h-5 w-5' iconName='TwitterArrowLeftIcon' />
          <ToolTip tip='Back' />
        </Button>
        <MobileSidebar />
        <h1 className='truncate text-xl font-extrabold'>Interests</h1>
      </div>
    </header>
  );
}

function InterestsPanel(): JSX.Element {
  const { user } = useAuth();
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(
    () => new Set()
  );
  const [savingInterest, setSavingInterest] = useState<string | null>(null);
  const {
    data: interests,
    error,
    mutate
  } = useSWR<string[], Error>(
    user ? `interests:${user.id}` : null,
    getInterestsSetting,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!interests) return;

    setSelectedInterests(new Set(interests));
  }, [interests]);

  const interestOptions = useMemo(() => {
    const knownInterests = new Set(
      blueskyInterestOptions.map(({ value }) => value)
    );
    const extraInterests = Array.from(selectedInterests)
      .filter((value) => !knownInterests.has(value))
      .map((value) => ({ label: formatInterestLabel(value), value }));

    return [...blueskyInterestOptions, ...extraInterests];
  }, [selectedInterests]);

  const handleInterestToggle = async (value: string): Promise<void> => {
    if (savingInterest) return;

    const previousInterests = selectedInterests;
    const nextInterests = new Set(selectedInterests);

    if (nextInterests.has(value)) nextInterests.delete(value);
    else nextInterests.add(value);

    setSelectedInterests(nextInterests);
    setSavingInterest(value);

    try {
      const savedInterests = await updateInterestsSetting(
        Array.from(nextInterests)
      );

      await mutate(savedInterests, false);
      toast.success('Interests updated');
    } catch (error) {
      setSelectedInterests(previousInterests);
      toast.error(getErrorMessage(error));
    } finally {
      setSavingInterest(null);
    }
  };

  if (error)
    return (
      <div className='px-8 py-12 text-center'>
        <p className='text-xl font-extrabold'>Interests didn’t load</p>
        <p className='mt-2 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
          {getErrorMessage(error)}
        </p>
        <Button
          className='accent-tab mt-5 inline-flex h-10 items-center justify-center rounded-full
                     bg-main-accent px-5 py-0 text-center font-bold text-white hover:bg-main-accent/90'
          onClick={(): void => void mutate()}
        >
          Try again
        </Button>
      </div>
    );

  if (!interests)
    return (
      <div className='py-12'>
        <Loading />
      </div>
    );

  return (
    <>
      <section className='border-b border-light-border px-5 py-5 dark:border-dark-border sm:px-8'>
        <h2 className='text-xl font-extrabold'>Your interests</h2>
        <p className='mt-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
          Choose topics used by Bluesky preferences.
        </p>
      </section>
      <section className='px-5 py-5 sm:px-8'>
        <div className='flex flex-wrap gap-3'>
          {interestOptions.map(({ label, value }) => {
            const selected = selectedInterests.has(value);
            const saving = savingInterest === value;

            return (
              <Button
                className={cn(
                  `h-9 rounded-full border px-5 py-0 text-[15px] font-bold transition
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-main-accent`,
                  selected
                    ? `border-main-accent bg-main-accent text-white hover:bg-main-accent/90
                       disabled:bg-main-accent`
                    : `border-transparent bg-main-sidebar-background text-light-primary hover:bg-light-primary/10
                       disabled:bg-main-sidebar-background dark:text-dark-primary dark:hover:bg-dark-primary/10`,
                  savingInterest && !saving && 'opacity-70',
                  saving && 'cursor-wait'
                )}
                aria-pressed={selected}
                disabled={!!savingInterest}
                loading={saving}
                onClick={(): void => void handleInterestToggle(value)}
                key={value}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </section>
    </>
  );
}

export default function Interests(): JSX.Element {
  return (
    <MainContainer className='pb-24'>
      <SEO title='Interests / Not Twitter' />
      <InterestsHeader />
      <InterestsPanel />
    </MainContainer>
  );
}

Interests.getLayout = (page: ReactElement<any>): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <HomeLayout>{page}</HomeLayout>
    </MainLayout>
  </ProtectedLayout>
);
