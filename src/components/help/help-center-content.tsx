import { useContext, useEffect, useMemo, useState, type JSX } from 'react';
import Link from 'next/link';
import cn from 'clsx';
import { ThemeContext } from '@lib/context/theme-context';
import { TweetTombstone } from '@components/tweet/tweet-tombstone';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon } from '@components/ui/hero-icon';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import type { TweetTombstoneKind } from '@lib/types/tweet';
import type { Theme } from '@lib/types/theme';

export const BSKY_HELP_HOME = 'https://blueskyweb.zendesk.com/hc/en-us';
export const BSKY_SUPPORT = 'https://bsky.social/about/support';
export const BSKY_MODERATION_HELP =
  'https://blueskyweb.zendesk.com/hc/en-us/articles/19002427251981-Moderation-and-Custom-Feeds';
export const BSKY_PRIVACY_HELP =
  'https://blueskyweb.zendesk.com/hc/en-us/articles/15835264007693-Data-Privacy';
export const BSKY_ACCOUNT_HELP =
  'https://blueskyweb.zendesk.com/hc/en-us/sections/20246216963981-Account';
export const BSKY_2FA_HELP =
  'https://blueskyweb.zendesk.com/hc/en-us/articles/44883632395405-Unable-to-receive-the-Two-Factor-Authentication-2FA-code';
export const BSKY_PASSWORD_HELP =
  'https://blueskyweb.zendesk.com/hc/en-us/articles/15835263959565-Password-Reset';
export const BSKY_HANDLE_HELP =
  'https://blueskyweb.zendesk.com/hc/en-us/articles/44878051792269-What-is-the-suggested-user-handle-format';
export const BSKY_EMAIL_HELP =
  'https://blueskyweb.zendesk.com/hc/en-us/articles/20247108126733-How-to-update-my-Bluesky-account-s-email-address';
export const BSKY_DELETE_HELP =
  'https://blueskyweb.zendesk.com/hc/en-us/articles/44879257093645-How-to-delete-deactivate-my-account';
export const BSKY_COMMUNITY_GUIDELINES =
  'https://bsky.social/about/support/community-guidelines';

type HelpCategory = {
  id: string;
  title: string;
  description: string;
  illustration:
    'blue-screens' | 'green-gears' | 'pink-privacy' | 'orange-trust';
  theme: {
    name: 'blue' | 'green' | 'pink' | 'orange';
    header: string;
    dark: string;
    light: string;
    extraLight: string;
    underline: string;
  };
  topics: string[];
};

export type HelpArticle = {
  slug: string;
  categoryId: string;
  title: string;
  description: string;
  updated: string;
  popular?: boolean;
  keywords: string[];
};

type HelpLayoutProps = {
  children: ReactNode;
};

type HelpLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

type SearchResult = HelpArticle & {
  categoryTitle: string;
};

type HelpFooterColumn = {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
};

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'using-twitter',
    title: 'Using Not Twitter',
    description:
      'How the Twitter-style frontend renders posts, profiles, search, tabs, and notices.',
    illustration: 'blue-screens',
    theme: {
      name: 'blue',
      header: '#1da1f2',
      dark: '#005fd1',
      light: '#71c9f8',
      extraLight: '#97e3ff',
      underline: '#1da1f2'
    },
    topics: [
      'Posts and threads',
      'Search and trends',
      'Profiles and tabs',
      'Direct Messages',
      'Custom feeds'
    ]
  },
  {
    id: 'managing-your-account',
    title: 'Managing your account',
    description:
      'Local sign-in, saved accounts, OAuth state, and where Bluesky account help lives.',
    illustration: 'green-gears',
    theme: {
      name: 'green',
      header: '#1fb650',
      dark: '#008951',
      light: '#68e090',
      extraLight: '#a5f2aa',
      underline: '#1fb650'
    },
    topics: [
      'Login and password',
      'Username and handle',
      'Account settings',
      'Notifications',
      'Saved accounts'
    ]
  },
  {
    id: 'safety-and-security',
    title: 'Safety and security',
    description:
      'Tombstones, muted items, sensitive labels, blocked content, and moderation links.',
    illustration: 'pink-privacy',
    theme: {
      name: 'pink',
      header: '#e0245e',
      dark: '#a01744',
      light: '#f6809a',
      extraLight: '#ffb8c2',
      underline: '#e0245e'
    },
    topics: [
      'Privacy',
      'Sensitive content',
      'Muted words',
      'Blocked accounts',
      'Local data'
    ]
  },
  {
    id: 'rules-and-policies',
    title: 'Rules and policies',
    description:
      'What common frontend messages mean and the fastest place to recover from them.',
    illustration: 'orange-trust',
    theme: {
      name: 'orange',
      header: '#f45d22',
      dark: '#d82e18',
      light: '#ff8d57',
      extraLight: '#ffbe78',
      underline: '#f45d22'
    },
    topics: [
      'Post notices',
      'Unavailable posts',
      'Bluesky guidelines',
      'Support links'
    ]
  }
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'tweet-tombstones-and-notices',
    categoryId: 'rules-and-policies',
    title: 'About Tweet tombstones and post notices',
    description:
      'What the gray notice boxes mean when a post is hidden, unavailable, muted, reported, or limited.',
    updated: 'May 24, 2026',
    popular: true,
    keywords: [
      'tombstone',
      'notice',
      'sensitive',
      'muted',
      'reported',
      'withheld',
      'unavailable',
      'blocked',
      'deleted',
      'rules'
    ]
  },
  {
    slug: 'sign-in-and-account-errors',
    categoryId: 'managing-your-account',
    title: 'Sign-in, saved accounts, and account errors',
    description:
      'How this frontend handles Bluesky OAuth, saved account switching, handle errors, and email-code prompts.',
    updated: 'May 24, 2026',
    popular: true,
    keywords: [
      'sign in',
      'oauth',
      'saved account',
      'switch account',
      'unsupported did',
      '2fa',
      'email',
      'password',
      'handle'
    ]
  },
  {
    slug: 'messages-and-chat-settings',
    categoryId: 'using-twitter',
    title: 'Messages, requests, and chat settings',
    description:
      'What the Messages screen shows, why a conversation can be empty, and where Bluesky chat support begins.',
    updated: 'May 24, 2026',
    keywords: [
      'messages',
      'chat',
      'conversation',
      'requests',
      'settings',
      'empty',
      'learn more'
    ]
  },
  {
    slug: 'feeds-search-and-profiles',
    categoryId: 'using-twitter',
    title: 'Feeds, search, and profile routes',
    description:
      'How Not Twitter resolves @handles, custom feeds, trends, profile tabs, and missing-route states.',
    updated: 'May 24, 2026',
    popular: true,
    keywords: [
      'feed',
      'search',
      'profile',
      'handle',
      'route',
      'go to',
      'trend',
      'lists',
      'starter pack'
    ]
  },
  {
    slug: 'timeline-and-notification-states',
    categoryId: 'using-twitter',
    title: 'Timeline, notification, and loading states',
    description:
      'Why Home, Notifications, lists, quote posts, or thread pages may show retry, empty, or unavailable states.',
    updated: 'May 24, 2026',
    keywords: [
      'home',
      'timeline',
      'notification',
      'loading',
      'retry',
      'server',
      'unavailable',
      'thread',
      'quote'
    ]
  },
  {
    slug: 'privacy-policy-and-data-links',
    categoryId: 'safety-and-security',
    title: 'Privacy policy and Bluesky data links',
    description:
      'What is documented locally here versus what should be read on Bluesky’s Help site.',
    updated: 'May 24, 2026',
    keywords: [
      'privacy',
      'data',
      'public',
      'blocks',
      'mutes',
      'local storage',
      'policy',
      'delete account'
    ]
  }
];

const externalResources = [
  {
    title: 'Bluesky Help Center',
    description: 'Official account, FAQ, and support articles from Bluesky.',
    href: BSKY_HELP_HOME
  },
  {
    title: 'Moderation and custom feeds',
    description:
      'Bluesky’s guide to mutes, blocks, reports, labels, and feeds.',
    href: BSKY_MODERATION_HELP
  },
  {
    title: 'Data Privacy',
    description: 'What Bluesky says is public, private, and portable.',
    href: BSKY_PRIVACY_HELP
  },
  {
    title: 'Community Guidelines',
    description: 'Bluesky’s current rules and enforcement policy.',
    href: BSKY_COMMUNITY_GUIDELINES
  }
];

const categoryLookup = HELP_CATEGORIES.reduce<Record<string, HelpCategory>>(
  (lookup, category) => {
    lookup[category.id] = category;
    return lookup;
  },
  {}
);

const HELP_MASTHEAD_IMAGE = '/assets/help-center/home-masthead-desktop.jpg';

const HELP_CARD_IMAGE = '/assets/help-center/htc-summary-card.jpg';

const doorwayCards = [
  {
    title: '🔐 Managing your account',
    categoryId: 'managing-your-account',
    links: [
      {
        label: 'Sign-in, saved accounts, and account errors',
        href: getHelpArticlePath('sign-in-and-account-errors')
      },
      {
        label: 'Bluesky Account Help',
        href: BSKY_ACCOUNT_HELP,
        external: true
      },
      { label: 'Password reset', href: BSKY_PASSWORD_HELP, external: true },
      { label: 'Handle format', href: BSKY_HANDLE_HELP, external: true }
    ]
  },
  {
    title: '📱 Using Not Twitter',
    categoryId: 'using-twitter',
    links: [
      {
        label: 'Messages, requests, and chat settings',
        href: getHelpArticlePath('messages-and-chat-settings')
      },
      {
        label: 'Feeds, search, and profile routes',
        href: getHelpArticlePath('feeds-search-and-profiles')
      },
      {
        label: 'Timeline, notification, and loading states',
        href: getHelpArticlePath('timeline-and-notification-states')
      },
      {
        label: 'Bluesky moderation and custom feeds',
        href: BSKY_MODERATION_HELP,
        external: true
      }
    ]
  },
  {
    title: '🤳 Safety and security',
    categoryId: 'safety-and-security',
    links: [
      {
        label: 'Privacy policy and Bluesky data links',
        href: getHelpArticlePath('privacy-policy-and-data-links')
      },
      {
        label: 'Bluesky Data Privacy',
        href: BSKY_PRIVACY_HELP,
        external: true
      },
      {
        label: 'Bluesky Community Guidelines',
        href: BSKY_COMMUNITY_GUIDELINES,
        external: true
      },
      { label: 'Contact Bluesky Support', href: BSKY_SUPPORT, external: true }
    ]
  },
  {
    title: '📝 Rules and policies',
    categoryId: 'rules-and-policies',
    links: [
      {
        label: 'About Tweet tombstones and post notices',
        href: getHelpArticlePath('tweet-tombstones-and-notices')
      },
      {
        label: 'Bluesky Community Guidelines',
        href: BSKY_COMMUNITY_GUIDELINES,
        external: true
      },
      {
        label: 'Bluesky moderation and custom feeds',
        href: BSKY_MODERATION_HELP,
        external: true
      },
      { label: 'Bluesky Help Center', href: BSKY_HELP_HOME, external: true }
    ]
  }
];

const whatsNewArticles = HELP_ARTICLES.slice(0, 6);

export const popularHelpArticles = HELP_ARTICLES.filter(
  ({ popular }) => popular
);

export function getHelpArticle(slug: string): HelpArticle | null {
  return HELP_ARTICLES.find((article) => article.slug === slug) ?? null;
}

export function getHelpArticlePath(slug: string): string {
  return `/help-center/articles/${slug}`;
}

function ExternalLink({
  href,
  children,
  className
}: HelpLinkProps): JSX.Element {
  return (
    <a
      className={cn('custom-underline text-[#1da1f2]', className)}
      href={href}
      target='_blank'
      rel='noreferrer'
    >
      {children}
    </a>
  );
}

function InternalLink({
  href,
  children,
  className
}: HelpLinkProps): JSX.Element {
  return (
    <Link
      href={href}
      className={cn('custom-underline text-[#1da1f2]', className)}
    >
      {children}
    </Link>
  );
}

function HelpHeader(): JSX.Element {
  return (
    <header className='fixed top-0 z-[1000] w-full bg-white text-[#14171a] shadow-[0_1px_0_rgba(0,0,0,0.08)] dark:bg-main-background dark:text-main-primary dark:shadow-[0_1px_0_rgba(255,255,255,0.14)]'>
      <div className='mx-auto flex h-24 w-full max-w-[1441px] items-center px-5 md:px-8 lg:px-12'>
        <Link
          href='/help-center'
          className='main-tab flex min-w-0 items-center gap-2 rounded-sm'
        >
          <CustomIcon
            className='h-7 w-7 shrink-0 text-[#1d9bf0]'
            iconName='TwitterIcon'
          />
          <span className='truncate text-2xl font-bold leading-8 tracking-[0.12px]'>
            Help Center
          </span>
        </Link>
        <nav
          className='ml-auto hidden h-full items-center gap-1 xl:flex'
          aria-label='Help Center navigation'
        >
          {HELP_CATEGORIES.map(({ id, title }) => (
            <Link
              href={`/help-center#${id}`}
              key={id}
              className='main-tab flex h-full items-center px-3 text-[15px] font-bold leading-6 text-[#314351] hover:text-[#14171a] dark:text-main-secondary dark:hover:text-main-primary'
            >
              {title}
            </Link>
          ))}
          <HelpHeaderDropdown
            title='Resources'
            links={[
              {
                label: 'Bluesky Help Center',
                href: BSKY_HELP_HOME,
                external: true
              },
              {
                label: 'Bluesky Support',
                href: BSKY_SUPPORT,
                external: true
              },
              {
                label: 'AT Protocol',
                href: 'https://atproto.com/',
                external: true
              }
            ]}
          />
          <a
            className='main-tab ml-2 rounded-full bg-[#14171a] px-5 py-3 text-[15px] font-bold leading-5 text-white hover:bg-[#314351] dark:bg-main-primary dark:text-main-background'
            href={BSKY_SUPPORT}
            target='_blank'
            rel='noreferrer'
          >
            Contact Us
          </a>
          <Link
            href='/help-center'
            className='main-tab ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[#314351] hover:bg-[#f3f7fa] hover:text-[#14171a] dark:text-main-secondary dark:hover:bg-white/10 dark:hover:text-main-primary'
          >
            <span className='sr-only'>Search</span>
            <HeroIcon className='h-6 w-6' iconName='MagnifyingGlassIcon' />
          </Link>
        </nav>
        <nav className='ml-auto flex items-center gap-2 xl:hidden'>
          <Link
            href='/help-center'
            className='main-tab flex h-11 w-11 items-center justify-center rounded-full text-[#314351] hover:bg-[#f3f7fa] dark:text-main-secondary dark:hover:bg-white/10'
          >
            <span className='sr-only'>Search</span>
            <HeroIcon className='h-6 w-6' iconName='MagnifyingGlassIcon' />
          </Link>
          <a
            className='main-tab rounded-full bg-[#14171a] px-4 py-2 text-sm font-bold text-white dark:bg-main-primary dark:text-main-background'
            href={BSKY_SUPPORT}
            target='_blank'
            rel='noreferrer'
          >
            Contact Us
          </a>
        </nav>
      </div>
    </header>
  );
}

function HelpHeaderDropdown({
  title,
  links
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}): JSX.Element {
  return (
    <div className='group relative flex h-full'>
      <button
        className='main-tab flex items-center gap-1 px-3 text-[15px] font-bold leading-6 text-[#314351] hover:text-[#14171a] dark:text-main-secondary dark:hover:text-main-primary'
        type='button'
      >
        {title}
        <HeroIcon className='h-4 w-4' iconName='ChevronDownIcon' />
      </button>
      <div
        className='invisible absolute top-full right-0 z-20 w-72 rounded bg-white py-2 text-[#14171a] opacity-0
                   shadow-[2px_2px_8px_2px_rgba(20,23,26,0.1)] transition group-focus-within:visible
                   group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:bg-main-sidebar-background dark:text-main-primary'
      >
        {links.map(({ label, href, external }) =>
          external ? (
            <a
              className='block px-6 py-3 text-[15px] font-bold leading-6 text-[#314351] hover:bg-[#f3f7fa] hover:text-[#14171a] dark:text-main-secondary dark:hover:bg-white/10'
              href={href}
              target='_blank'
              rel='noreferrer'
              key={href}
            >
              {label}
            </a>
          ) : (
            <Link
              href={href}
              key={href}
              className='block px-6 py-3 text-[15px] font-bold leading-6 text-[#314351] hover:bg-[#f3f7fa] hover:text-[#14171a] dark:text-main-secondary dark:hover:bg-white/10'
            >
              {label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

export function HelpCenterLayout({ children }: HelpLayoutProps): JSX.Element {
  return (
    <div className='min-h-screen bg-white pt-24 font-sans text-[#14171a] dark:bg-main-background dark:text-main-primary'>
      <HelpHeader />
      <main className='bg-white dark:bg-main-background'>{children}</main>
      <HelpFooter />
    </div>
  );
}

function HelpFooter(): JSX.Element {
  const footerColumns: HelpFooterColumn[] = [
    {
      title: 'Twitter platform',
      links: [
        { label: 'Home', href: '/' },
        { label: 'Explore', href: '/explore' },
        { label: 'Privacy Center', href: '/privacy' },
        { label: 'Embed a Tweet', href: '/help-center' }
      ]
    },
    {
      title: 'Help',
      links: HELP_CATEGORIES.map(({ id, title }) => ({
        label: title,
        href: `/help-center#${id}`
      }))
    },
    {
      title: 'Bluesky resources',
      links: [
        { label: 'Bluesky Help Center', href: BSKY_HELP_HOME, external: true },
        { label: 'Account', href: BSKY_ACCOUNT_HELP, external: true },
        { label: 'Data Privacy', href: BSKY_PRIVACY_HELP, external: true },
        {
          label: 'Community Guidelines',
          href: BSKY_COMMUNITY_GUIDELINES,
          external: true
        }
      ]
    },
    {
      title: 'Developer resources',
      links: [
        {
          label: 'AT Protocol',
          href: 'https://atproto.com/',
          external: true
        },
        {
          label: 'Bluesky docs',
          href: 'https://docs.bsky.app/',
          external: true
        },
        {
          label: 'Repository',
          href: 'https://github.com/EricKrouss/not-twitter',
          external: true
        }
      ]
    }
  ];

  return (
    <footer className='bg-[#14171a] px-5 py-9 text-white md:px-8 lg:px-12'>
      <div className='mx-auto grid max-w-[1441px] gap-6 sm:grid-cols-2 lg:grid-cols-4'>
        {footerColumns.map(({ title, links }) => (
          <section className='space-y-3' key={title}>
            <h2 className='text-sm font-bold text-white'>{title}</h2>
            <ul className='space-y-2 text-sm leading-5'>
              {links.map(({ label, href, external }) => (
                <li key={href}>
                  {external ? (
                    <a
                      className='custom-underline text-white/80 hover:text-white'
                      href={href}
                      target='_blank'
                      rel='noreferrer'
                    >
                      {label}
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className='custom-underline text-white/80 hover:text-white'
                    >
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className='mx-auto mt-8 flex max-w-[1441px] flex-wrap gap-x-5 gap-y-2 border-t border-white/20 pt-5 text-sm leading-5 text-white/80'>
        <HelpThemeSwitcher />
        <span>© 2026 Not Twitter</span>
        <Link href='/privacy' className='custom-underline hover:text-white'>
          Privacy
        </Link>
        <a
          className='custom-underline hover:text-white'
          href={BSKY_HELP_HOME}
          target='_blank'
          rel='noreferrer'
        >
          Bluesky Help Center
        </a>
      </div>
    </footer>
  );
}

function HelpThemeSwitcher(): JSX.Element {
  const themeContext = useContext(ThemeContext);
  const [fallbackTheme, setFallbackTheme] = useState<Theme>('light');
  const theme = themeContext?.theme ?? fallbackTheme;
  const themes: Readonly<[Theme, string][]> = [
    ['light', 'Default'],
    ['dim', 'Dim'],
    ['dark', 'Lights out']
  ];

  useEffect(() => {
    if (themeContext || typeof window === 'undefined') return;

    const savedTheme = localStorage.getItem('theme') as Theme | null;
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;

    setFallbackTheme(savedTheme ?? (prefersDark ? 'dark' : 'light'));
  }, [themeContext]);

  useEffect(() => {
    if (themeContext || typeof window === 'undefined') return;

    const root = document.documentElement;
    const targetTheme = fallbackTheme === 'dim' ? 'dark' : fallbackTheme;

    if (targetTheme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    root.style.setProperty(
      '--main-background',
      `var(--${fallbackTheme}-background)`
    );
    root.style.setProperty('--main-primary', `var(--${fallbackTheme}-primary)`);
    root.style.setProperty(
      '--main-secondary',
      `var(--${fallbackTheme}-secondary)`
    );
    root.style.setProperty(
      '--main-search-background',
      `var(--${fallbackTheme}-search-background)`
    );
    root.style.setProperty(
      '--main-sidebar-background',
      `var(--${fallbackTheme}-sidebar-background)`
    );
    localStorage.setItem('theme', fallbackTheme);
  }, [fallbackTheme, themeContext]);

  const handleThemeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    if (themeContext) {
      themeContext.changeTheme(event);
      return;
    }

    setFallbackTheme(event.target.value as Theme);
  };

  return (
    <fieldset className='flex flex-wrap items-center gap-2'>
      <legend className='mr-1 text-sm font-bold'>Background</legend>
      {themes.map(([themeType, label]) => (
        <label
          className='main-tab inline-flex min-h-[28px] cursor-pointer items-center gap-1 rounded-[12px] border border-white/60 px-3 text-sm leading-5 text-white/80 hover:text-white'
          key={themeType}
        >
          <input
            className='peer absolute h-0 w-0 opacity-0'
            type='radio'
            name='help-center-theme'
            value={themeType}
            checked={theme === themeType}
            onChange={handleThemeChange}
          />
          <span
            className={cn(
              'h-2 w-2 rounded-full border border-current',
              theme === themeType && 'bg-current'
            )}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function HelpHero({
  query,
  setQuery,
  results
}: {
  query: string;
  setQuery: (value: string) => void;
  results: SearchResult[];
}): JSX.Element {
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    document.getElementById('help-search-results')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  return (
    <section
      className='relative min-h-[420px] overflow-hidden bg-[#1d9bf0] px-5 py-16 text-white md:min-h-[512px] md:px-8 md:py-24 lg:px-12'
      style={{
        backgroundImage: `linear-gradient(90deg, rgba(20, 23, 26, 0.42), rgba(20, 23, 26, 0.05)), url(${HELP_MASTHEAD_IMAGE})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover'
      }}
    >
      <div className='relative mx-auto max-w-[1024px]'>
        <h1 className='max-w-[700px] text-[36px] font-bold leading-[42px] tracking-[-0.025rem] md:text-5xl md:leading-[56px]'>
          What can we help you find?
        </h1>
        <form
          className='mt-8 max-w-[560px] md:min-w-[500px]'
          role='search'
          onSubmit={handleSubmit}
        >
          <label
            className='flex h-16 items-center gap-4 rounded bg-white px-5 text-[#637888]
                       shadow-[0_4px_12px_rgba(20,23,26,0.18)] focus-within:ring-2 focus-within:ring-[#1d9bf0]'
          >
            <HeroIcon
              className='h-6 w-6 shrink-0'
              iconName='MagnifyingGlassIcon'
            />
            <input
              className='h-full min-w-0 flex-1 bg-transparent text-[18px] text-[#14171a] outline-none placeholder:text-[#637888]'
              value={query}
              placeholder='Search'
              type='search'
              onChange={({ target }): void => setQuery(target.value)}
            />
          </label>
        </form>
        {query && (
          <p className='mt-4 text-sm font-bold leading-5 text-white'>
            {results.length
              ? `${results.length} matching article${
                  results.length === 1 ? '' : 's'
                }`
              : 'No matching local articles. Try a Bluesky resource below.'}
          </p>
        )}
      </div>
    </section>
  );
}

export function HelpCenterHome(): JSX.Element {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const results = useMemo<SearchResult[]>(() => {
    if (!normalizedQuery) return [];

    return HELP_ARTICLES.filter((article) => {
      const haystack = [
        article.title,
        article.description,
        ...article.keywords,
        categoryLookup[article.categoryId]?.title ?? ''
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    }).map((article) => ({
      ...article,
      categoryTitle: categoryLookup[article.categoryId]?.title ?? 'Help'
    }));
  }, [normalizedQuery]);

  return (
    <>
      <HelpHero query={query} results={results} setQuery={setQuery} />
      <section id='help-search-results'>
        {normalizedQuery ? (
          <SearchResults results={results} />
        ) : (
          <DefaultHelpHome />
        )}
      </section>
    </>
  );
}

function SearchResults({ results }: { results: SearchResult[] }): JSX.Element {
  return (
    <div className='bg-[#f3f7fa] px-5 py-12 dark:bg-main-sidebar-background md:px-8 lg:px-12'>
      <div className='mx-auto max-w-[1024px]'>
        <h2 className='text-[32px] font-bold leading-10 text-[#14171a] dark:text-main-primary'>
          Search results
        </h2>
        <div className='mt-6 grid gap-6 md:grid-cols-2'>
          {results.length ? (
            results.map((article) => (
              <ArticleCard
                article={article}
                eyebrow={article.categoryTitle}
                key={article.slug}
              />
            ))
          ) : (
            <div className='rounded-lg border border-[#d3dce3] bg-white p-6 dark:border-dark-border dark:bg-main-background'>
              <h3 className='text-xl font-bold'>No local article found</h3>
              <p className='mt-2 text-[15px] leading-6 text-[#637888] dark:text-main-secondary'>
                If your question is about a Bluesky account, moderation
                decision, privacy rule, or service policy, use the official
                Bluesky links.
              </p>
              <div className='mt-4 flex flex-wrap gap-3'>
                <ExternalResourceButton href={BSKY_HELP_HOME}>
                  Bluesky Help Center
                </ExternalResourceButton>
                <ExternalResourceButton href={BSKY_SUPPORT}>
                  Bluesky Support
                </ExternalResourceButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DefaultHelpHome(): JSX.Element {
  return (
    <>
      <section className='bg-[#f3f7fa] px-5 py-8 dark:bg-main-sidebar-background md:px-8 lg:px-12'>
        <div className='mx-auto grid max-w-[1024px] gap-6 md:grid-cols-2'>
          {doorwayCards.map((card) => (
            <DoorwayCard card={card} key={card.categoryId} />
          ))}
        </div>
      </section>
      <section className='bg-white px-5 py-16 dark:bg-main-background md:px-8 lg:px-12'>
        <div className='mx-auto max-w-[1441px]'>
          <h2 className='mx-auto max-w-[1024px] text-[32px] font-bold leading-10 text-[#14171a] dark:text-main-primary'>
            What&apos;s new
          </h2>
          <div className='mt-8 flex gap-6 overflow-x-auto pb-4'>
            {whatsNewArticles.map((article) => (
              <ArticleCard
                article={article}
                eyebrow={categoryLookup[article.categoryId]?.title}
                image
                key={article.slug}
              />
            ))}
          </div>
        </div>
      </section>
      <section className='bg-[#f3f7fa] px-5 py-12 dark:bg-main-sidebar-background md:px-8 lg:px-12'>
        <div className='mx-auto max-w-[1024px]'>
          <h2 className='text-[32px] font-bold leading-10 text-[#14171a] dark:text-main-primary'>
            More resources
          </h2>
          <div className='mt-6 grid gap-4 md:grid-cols-2'>
            {externalResources.map((resource) => (
              <ResourceCard resource={resource} key={resource.href} />
            ))}
          </div>
        </div>
      </section>
      <section className='bg-[#f3f7fa] px-5 pb-24 dark:bg-main-sidebar-background md:px-8 lg:px-12'>
        <div className='mx-auto max-w-[1024px]'>
          <div className='rounded-lg border border-[#d3dce3] bg-white p-8 dark:border-dark-border dark:bg-main-background'>
            <h2 className='text-[28px] font-bold leading-9 text-[#14171a] dark:text-main-primary'>
              Stay in touch
            </h2>
            <p className='mt-2 max-w-[620px] text-[15px] leading-6 text-[#637888] dark:text-main-secondary'>
              Follow official Bluesky support for platform news, then use this
              Help Center for Not Twitter frontend states, messages, and
              visuals.
            </p>
            <a
              className='mt-5 inline-flex min-h-[44px] items-center rounded-full bg-[#14171a] px-6 text-[15px] font-bold text-white hover:bg-[#314351] dark:bg-main-primary dark:text-main-background'
              href={BSKY_SUPPORT}
              target='_blank'
              rel='noreferrer'
            >
              Contact Bluesky Support
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function DoorwayCard({
  card
}: {
  card: (typeof doorwayCards)[number];
}): JSX.Element {
  return (
    <section
      className='mx-auto w-full max-w-[528px] overflow-hidden rounded-lg border border-[#d3dce3] bg-white dark:border-dark-border dark:bg-main-background'
      id={card.categoryId}
    >
      <div className='border-b border-[#d3dce3] p-6 dark:border-dark-border md:px-6 md:py-8'>
        <h2 className='text-2xl font-bold leading-8 text-[#14171a] dark:text-main-primary'>
          {card.title}
        </h2>
      </div>
      {card.links.map(({ label, href, external }) =>
        external ? (
          <a
            className='flex min-h-[72px] items-center justify-between gap-4 border-b border-[#d3dce3] p-6 text-[17px] font-bold leading-6 text-[#067acc] last:border-b-0 hover:text-[#024e9a] dark:border-dark-border dark:text-[#1d9bf0]'
            href={href}
            target='_blank'
            rel='noreferrer'
            key={href}
          >
            <span>{label}</span>
            <HeroIcon
              className='h-5 w-5 shrink-0'
              iconName='ArrowTopRightOnSquareIcon'
            />
          </a>
        ) : (
          <Link
            href={href}
            key={href}
            className='flex min-h-[72px] items-center justify-between gap-4 border-b border-[#d3dce3] p-6 text-[17px] font-bold leading-6 text-[#067acc] last:border-b-0 hover:text-[#024e9a] dark:border-dark-border dark:text-[#1d9bf0]'
          >
            <span>{label}</span>
            <HeroIcon
              className='h-5 w-5 shrink-0'
              iconName='ChevronRightIcon'
            />
          </Link>
        )
      )}
    </section>
  );
}

function ResourceCard({
  resource: { title, description, href }
}: {
  resource: (typeof externalResources)[number];
}): JSX.Element {
  return (
    <a
      className='block rounded-lg border border-[#d3dce3] bg-white p-6 shadow-[0_0_8px_rgba(20,23,26,0.08)] hover:shadow-[0_0_12px_rgba(20,23,26,0.2)] dark:border-dark-border dark:bg-main-background'
      href={href}
      target='_blank'
      rel='noreferrer'
    >
      <span className='block text-xl font-bold leading-7 text-[#14171a] dark:text-main-primary'>
        {title}
      </span>
      <span className='mt-2 block text-[15px] leading-6 text-[#637888] dark:text-main-secondary'>
        {description}
      </span>
    </a>
  );
}

function ArticleCard({
  article,
  eyebrow,
  image
}: {
  article: HelpArticle;
  eyebrow?: string;
  image?: boolean;
}): JSX.Element {
  return (
    <Link
      href={getHelpArticlePath(article.slug)}
      className={cn(
        'group block overflow-hidden rounded border border-[#d3dce3] bg-white transition hover:border-[#1d9bf0] dark:border-dark-border dark:bg-main-sidebar-background',
        image
          ? 'w-[315px] shrink-0 shadow-[0_0_8px_rgba(20,23,26,0.2)] hover:shadow-[0_0_12px_rgba(20,23,26,0.35)] sm:w-[375px]'
          : 'p-6'
      )}
    >
      {image && (
        <div
          className='h-40 bg-[#1d9bf0] bg-cover bg-center'
          style={{ backgroundImage: `url(${HELP_CARD_IMAGE})` }}
        />
      )}
      <div className={image ? 'p-6' : ''}>
        {eyebrow && (
          <span className='text-sm font-bold leading-5 text-[#637888] dark:text-main-secondary'>
            {eyebrow}
          </span>
        )}
        <h3 className='mt-1 text-xl font-bold leading-7 text-[#14171a] group-hover:text-[#067acc] dark:text-main-primary dark:group-hover:text-[#1d9bf0]'>
          {article.title}
        </h3>
        <p className='mt-2 text-[15px] leading-6 text-[#637888] dark:text-main-secondary'>
          {article.description}
        </p>
      </div>
    </Link>
  );
}

function ExternalResourceButton({
  href,
  children
}: HelpLinkProps): JSX.Element {
  return (
    <a
      className='inline-flex min-h-[44px] items-center rounded-full bg-[#14171a] px-5 text-sm font-bold text-white hover:bg-[#314351] dark:bg-main-primary dark:text-main-background'
      href={href}
      target='_blank'
      rel='noreferrer'
    >
      {children}
    </a>
  );
}

export function HelpArticlePage({
  article
}: {
  article: HelpArticle;
}): JSX.Element {
  const category = categoryLookup[article.categoryId];

  return (
    <div className='bg-white dark:bg-main-background'>
      <section className='px-5 py-12 md:px-8 md:py-16 lg:px-12'>
        <div className='mx-auto max-w-[1024px]'>
          <div className='mx-auto max-w-[853px]'>
            <nav
              className='flex flex-wrap items-center gap-2 text-sm font-bold leading-5 text-[#314351] dark:text-main-secondary'
              aria-label='Breadcrumb'
            >
              <Link
                href='/help-center'
                className='custom-underline hover:text-[#14171a] dark:hover:text-main-primary'
              >
                Help Center
              </Link>
              <HeroIcon
                className='h-4 w-4 rotate-90 text-[#8196a7]'
                iconName='ChevronDownIcon'
              />
              <Link
                href={`/help-center#${category.id}`}
                className='custom-underline hover:text-[#14171a] dark:hover:text-main-primary'
              >
                {category.title}
              </Link>
              <HeroIcon
                className='h-4 w-4 rotate-90 text-[#8196a7]'
                iconName='ChevronDownIcon'
              />
              <span className='max-w-full truncate text-[#637888] dark:text-main-secondary'>
                {article.title}
              </span>
            </nav>
            <h1 className='mt-12 text-[36px] font-bold leading-[42px] tracking-[-0.025rem] text-[#14171a] dark:text-main-primary md:text-5xl md:leading-[58px]'>
              {article.title}
            </h1>
            <p className='mt-4 text-[15px] leading-6 text-[#637888] dark:text-main-secondary'>
              Updated {article.updated}
            </p>
            <div className='mt-12 border-t border-[#637888]' />
          </div>
        </div>
      </section>
      <section className='px-5 pb-20 md:px-8 lg:px-12'>
        <article className='mx-auto max-w-[760px] text-[18px] leading-8 text-[#14171a] dark:text-main-primary'>
          <div className='space-y-8'>
            <ArticleBody slug={article.slug} />
          </div>
          <ShareArticle title={article.title} />
        </article>
      </section>
    </div>
  );
}

function ShareArticle({ title }: { title: string }): JSX.Element {
  return (
    <section className='mt-16 border-t border-[#d3dce3] pt-10 dark:border-dark-border'>
      <h2 className='text-[32px] font-bold leading-10 text-[#14171a] dark:text-main-primary'>
        Share this article
      </h2>
      <a
        className='mt-6 inline-flex min-h-[56px] items-center gap-3 rounded-full bg-[#f3f7fa] px-8 text-lg font-bold text-[#14171a] hover:bg-[#e8eff3] dark:bg-main-sidebar-background dark:text-main-primary dark:hover:bg-white/10'
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
          title
        )}`}
        target='_blank'
        rel='noreferrer'
      >
        <CustomIcon
          className='h-[22px] w-[22px] text-[#1da1f2]'
          iconName='TwitterIcon'
        />
        Tweet
      </a>
    </section>
  );
}

function ArticleBody({ slug }: { slug: string }): JSX.Element {
  switch (slug) {
    case 'tweet-tombstones-and-notices':
      return <TombstonesArticle />;
    case 'sign-in-and-account-errors':
      return <SignInArticle />;
    case 'messages-and-chat-settings':
      return <MessagesArticle />;
    case 'feeds-search-and-profiles':
      return <FeedsSearchArticle />;
    case 'timeline-and-notification-states':
      return <TimelineStatesArticle />;
    case 'privacy-policy-and-data-links':
      return <PrivacyLinksArticle />;
    default:
      return <p>This article could not be loaded.</p>;
  }
}

function HelpSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section>
      <h2 className='text-2xl font-bold leading-8 text-[#14171a] dark:text-main-primary'>
        {title}
      </h2>
      <div className='mt-3 space-y-3 text-[17px] leading-7'>{children}</div>
    </section>
  );
}

function HelpList({ items }: { items: ReactNode[] }): JSX.Element {
  return (
    <ul className='list-disc space-y-2 pl-6'>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function RelatedLinks({
  links
}: {
  links: { label: string; href: string; external?: boolean }[];
}): JSX.Element {
  return (
    <div className='border border-[#e1e8ed] bg-[#f5f8fa] p-5 dark:border-dark-border dark:bg-main-sidebar-background'>
      <h2 className='text-xl font-bold leading-6 text-[#14171a] dark:text-main-primary'>
        Related links
      </h2>
      <ul className='mt-3 space-y-2 text-[15px] leading-6'>
        {links.map(({ label, href, external }) => (
          <li key={href}>
            {external ? (
              <ExternalLink href={href}>{label}</ExternalLink>
            ) : (
              <InternalLink href={href}>{label}</InternalLink>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TombstoneVisual({
  label,
  kind,
  username,
  country
}: {
  label: string;
  kind: TweetTombstoneKind;
  username?: string;
  country?: string;
}): JSX.Element {
  return (
    <div className='space-y-2'>
      <h3 className='text-[15px] font-bold leading-5 text-[#657786] dark:text-main-secondary'>
        {label}
      </h3>
      <div className='max-w-[620px] rounded-[3px] border border-[#e1e8ed] bg-white p-4 dark:border-dark-border dark:bg-main-sidebar-background'>
        <TweetTombstone
          kind={kind}
          username={username}
          country={country}
          onView={(): void => undefined}
        />
      </div>
    </div>
  );
}

function TombstonesArticle(): JSX.Element {
  return (
    <>
      <p>
        A tombstone is the gray notice box Not Twitter renders in place of a
        post when the frontend has enough information to show why the post is
        hidden, limited, or unavailable. These visuals are live dummy
        tombstones, not screenshots.
      </p>
      <HelpSection title='Common tombstones'>
        <div className='space-y-5'>
          <TombstoneVisual
            kind='limited-visibility'
            label='Limited visibility'
          />
          <TombstoneVisual kind='sensitive' label='Sensitive post notice' />
          <TombstoneVisual
            kind='sensitive-media'
            label='Sensitive media with a View action'
          />
          <TombstoneVisual kind='reported' label='A post you reported' />
          <TombstoneVisual kind='muted-account' label='Muted account' />
          <TombstoneVisual kind='muted-word' label='Muted word' />
        </div>
      </HelpSection>
      <HelpSection title='Unavailable or enforced posts'>
        <div className='space-y-5'>
          <TombstoneVisual kind='rules-violation' label='Rules violation' />
          <TombstoneVisual kind='suspended' label='Suspended account' />
          <TombstoneVisual
            country='Germany'
            kind='withheld'
            label='Withheld in a country'
            username='@example.com'
          />
          <TombstoneVisual
            kind='no-longer-exists'
            label='Account no longer exists'
          />
          <TombstoneVisual kind='unavailable' label='Unavailable post' />
          <TombstoneVisual kind='age-restricted' label='Age restricted' />
        </div>
      </HelpSection>
      <HelpSection title='What the buttons do'>
        <HelpList
          items={[
            'Learn more opens this article when the notice is a frontend explanation.',
            'Change settings opens Not Twitter settings because that control is local to this frontend surface.',
            'View appears only on tombstones that can be temporarily expanded in the current screen.'
          ]}
        />
      </HelpSection>
      <HelpSection title='Where Bluesky policy starts'>
        <p>
          Bluesky moderation, reporting, account status, labels, and policy
          enforcement are Bluesky topics. For those, use{' '}
          <ExternalLink href={BSKY_MODERATION_HELP}>
            Bluesky moderation help
          </ExternalLink>{' '}
          and the{' '}
          <ExternalLink href={BSKY_COMMUNITY_GUIDELINES}>
            Bluesky Community Guidelines
          </ExternalLink>
          .
        </p>
      </HelpSection>
      <RelatedLinks
        links={[
          {
            label: 'Bluesky moderation and custom feeds',
            href: BSKY_MODERATION_HELP,
            external: true
          },
          {
            label: 'Bluesky Community Guidelines',
            href: BSKY_COMMUNITY_GUIDELINES,
            external: true
          },
          {
            label: 'Privacy policy and Bluesky data links',
            href: getHelpArticlePath('privacy-policy-and-data-links')
          }
        ]}
      />
    </>
  );
}

function SignInArticle(): JSX.Element {
  return (
    <>
      <p>
        Not Twitter signs you in through Bluesky and AT Protocol OAuth. The
        frontend stores only the local session and saved account summaries it
        needs to switch accounts in this browser.
      </p>
      <HelpSection title='Messages from this frontend'>
        <HelpList
          items={[
            'Unsupported AT Protocol DID means the profile or service identifier is not a supported did:plc or hostname-level did:web value.',
            'Unable to switch accounts means the saved local account could not refresh its Bluesky session.',
            'A server connection warning means this frontend could not reach the configured Bluesky/API helper at that moment.',
            'A stale OAuth session can require signing out and signing in again from the same browser.'
          ]}
        />
      </HelpSection>
      <HelpSection title='Bluesky account help'>
        <p>
          Password resets, email confirmation, 2FA email codes, account
          deletion, and handle rules are controlled by Bluesky or your personal
          data server. Use Bluesky’s official articles for those flows.
        </p>
        <div className='grid gap-3 sm:grid-cols-2'>
          <ExternalResourceButton href={BSKY_PASSWORD_HELP}>
            Password reset
          </ExternalResourceButton>
          <ExternalResourceButton href={BSKY_2FA_HELP}>
            2FA email code help
          </ExternalResourceButton>
          <ExternalResourceButton href={BSKY_EMAIL_HELP}>
            Update email
          </ExternalResourceButton>
          <ExternalResourceButton href={BSKY_HANDLE_HELP}>
            Handle format
          </ExternalResourceButton>
        </div>
      </HelpSection>
      <HelpSection title='Clearing local account state'>
        <p>
          Signing out removes the active local account state from this app.
          Removing browser site data clears theme, display choices, OAuth cache,
          and saved account summaries for this deployment.
        </p>
      </HelpSection>
      <RelatedLinks
        links={[
          {
            label: 'Bluesky Account Help',
            href: BSKY_ACCOUNT_HELP,
            external: true
          },
          { label: 'Bluesky Support', href: BSKY_SUPPORT, external: true },
          { label: 'Not Twitter Privacy Policy', href: '/privacy' }
        ]}
      />
    </>
  );
}

function MessagesArticle(): JSX.Element {
  return (
    <>
      <p>
        Messages is a frontend view over Bluesky chat surfaces when your account
        can access them. Some states are local UI explanations; service-level
        chat behavior belongs to Bluesky.
      </p>
      <HelpSection title='Message screen states'>
        <HelpList
          items={[
            'No conversation selected means the left column has loaded, but no thread is open yet.',
            'An empty conversation means the route exists but this frontend has no renderable messages for it.',
            'Message requests are conversations separated from the main inbox by Bluesky chat settings.',
            'Chat settings updates use the Bluesky chat declaration record when it is available to the signed-in account.'
          ]}
        />
      </HelpSection>
      <HelpSection title='Learn more links'>
        <p>
          Learn more links in Messages now open this local article when they
          explain the frontend. If you need account or service support for
          Bluesky chat, go to{' '}
          <ExternalLink href={BSKY_SUPPORT}>Bluesky Support</ExternalLink>.
        </p>
      </HelpSection>
      <RelatedLinks
        links={[
          { label: 'Bluesky Support', href: BSKY_SUPPORT, external: true },
          {
            label: 'Sign-in, saved accounts, and account errors',
            href: getHelpArticlePath('sign-in-and-account-errors')
          }
        ]}
      />
    </>
  );
}

function FeedsSearchArticle(): JSX.Element {
  return (
    <>
      <p>
        Not Twitter keeps Twitter-style route shapes while resolving Bluesky
        handles, DIDs, custom feeds, trends, lists, and profile tabs through the
        frontend.
      </p>
      <HelpSection title='Search and handle routing'>
        <HelpList
          items={[
            'Typing a bare handle in search can route to a profile, and bare names are normalized toward .bsky.social when that is the intended handle form.',
            'Profiles can open through old Twitter-style paths or the internal /user path, then resolve to the same Bluesky actor.',
            'A missing profile or post route shows a local not-found screen rather than sending you to Bluesky.',
            'Custom feed pages use the profile/feed route and depend on the feed record being reachable from Bluesky.'
          ]}
        />
      </HelpSection>
      <HelpSection title='Custom feeds'>
        <p>
          Not Twitter can show subscribed feeds and feed tabs, but how custom
          feeds work is a Bluesky feature. Read Bluesky’s{' '}
          <ExternalLink href={BSKY_MODERATION_HELP}>
            Moderation and Custom Feeds
          </ExternalLink>{' '}
          article for the platform explanation.
        </p>
      </HelpSection>
      <RelatedLinks
        links={[
          {
            label: 'Bluesky moderation and custom feeds',
            href: BSKY_MODERATION_HELP,
            external: true
          },
          {
            label: 'Timeline, notification, and loading states',
            href: getHelpArticlePath('timeline-and-notification-states')
          }
        ]}
      />
    </>
  );
}

function TimelineStatesArticle(): JSX.Element {
  return (
    <>
      <p>
        Home, Notifications, quote-post lists, and thread pages all depend on
        live Bluesky responses. The frontend tries to keep failures readable
        instead of leaving a blank page.
      </p>
      <HelpSection title='What common states mean'>
        <HelpList
          items={[
            'Try reloading means the request failed or returned a shape this frontend could not safely render.',
            'No posts yet means the route loaded but the current feed, list, or tab returned no visible items.',
            'Post unavailable means the frontend could not load the post, or the post is blocked, deleted, withheld, or otherwise unavailable to the current viewer.',
            'Load more appears when Bluesky returned a cursor for the next page.'
          ]}
        />
      </HelpSection>
      <HelpSection title='When to use Bluesky help'>
        <p>
          If a post, account, notification, block, mute, label, or moderation
          result appears differently on the official Bluesky app, check{' '}
          <ExternalLink href={BSKY_HELP_HOME}>Bluesky Help</ExternalLink> or{' '}
          <ExternalLink href={BSKY_SUPPORT}>
            contact Bluesky Support
          </ExternalLink>
          .
        </p>
      </HelpSection>
      <RelatedLinks
        links={[
          {
            label: 'About Tweet tombstones and post notices',
            href: getHelpArticlePath('tweet-tombstones-and-notices')
          },
          { label: 'Bluesky Help Center', href: BSKY_HELP_HOME, external: true }
        ]}
      />
    </>
  );
}

function PrivacyLinksArticle(): JSX.Element {
  return (
    <>
      <p>
        The local Not Twitter privacy page documents this frontend’s browser
        storage, OAuth state, saved accounts, and app behavior. Bluesky’s Help
        site documents the Bluesky network and account data.
      </p>
      <HelpSection title='Use the local policy for'>
        <HelpList
          items={[
            'Local theme, accent, saved account, and OAuth browser storage in this deployment.',
            'What this frontend sends to Bluesky when you load timelines, profiles, posts, messages, and settings.',
            'What this source project intentionally does not include, such as a separate social graph database or ad pixel.'
          ]}
        />
      </HelpSection>
      <HelpSection title='Use Bluesky Help for'>
        <HelpList
          items={[
            'Whether posts, likes, blocks, mutes, profiles, and lists are public or private on Bluesky.',
            'Deleting or deactivating a Bluesky account.',
            'Bluesky community rules, enforcement, appeals, and support contact paths.'
          ]}
        />
      </HelpSection>
      <RelatedLinks
        links={[
          { label: 'Not Twitter Privacy Policy', href: '/privacy' },
          {
            label: 'Bluesky Data Privacy',
            href: BSKY_PRIVACY_HELP,
            external: true
          },
          {
            label: 'Delete or deactivate Bluesky account',
            href: BSKY_DELETE_HELP,
            external: true
          },
          { label: 'Bluesky Support', href: BSKY_SUPPORT, external: true }
        ]}
      />
    </>
  );
}
