import Link from 'next/link';
import { useAuth } from '@lib/context/auth-context';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { MainLayout } from '@components/layout/main-layout';
import { LoggedOutTwitterLayout } from '@components/layout/logged-out-twitter-layout';
import type { ReactElement, ReactNode, JSX } from 'react';

type PrivacySectionProps = {
  title: string;
  children: ReactNode;
};

type PrivacyListProps = {
  items: string[];
};

const lastUpdated = 'May 23, 2026';

const collectedData = [
  'The Bluesky handle or DID you enter to begin sign-in.',
  'OAuth session and account details held by the AT Protocol OAuth client in this browser.',
  'A local saved-account list so account switching works on this device.',
  'Public Bluesky profile, post, reply, like, repost, follow, list, trend, and notification data needed to render the app.',
  'Messages and chat settings when you open Messages or authorize Bluesky chat access.',
  'Account settings, such as handle and email state, when you open or update Settings.',
  'Media files you choose for posts, avatars, or cover photos while they are prepared locally and uploaded to your Bluesky personal data server.',
  'Local display preferences, including theme and accent color.'
];

const useCases = [
  'Authenticate you with Bluesky and keep you signed in on this browser.',
  'Load timelines, profiles, posts, notifications, messages, search results, trends, lists, and account settings.',
  'Publish the posts, replies, likes, reposts, follows, blocks, mutes, profile edits, message settings, and other actions you choose.',
  'Remember local preferences and saved accounts for this browser.',
  'Maintain security, debug failures, and prevent misuse of the deployed service.'
];

const sharingCases = [
  'Bluesky, your personal data server, the Bluesky AppView, and Bluesky chat services receive the requests needed to sign you in, load data, upload media, and perform actions you choose.',
  'Public AT Protocol content may be visible to other users, services, relays, crawlers, and indexers according to Bluesky and AT Protocol behavior.',
  'The hosting provider for a deployment may receive normal technical information, such as IP address, user agent, request time, and requested URL.',
  'Third-party sites you open from links in Not Twitter handle their own privacy practices.'
];

const choices = [
  'Sign out or remove a saved account from Not Twitter to clear the active local account state for this browser.',
  "Clear this site's browser storage to remove local theme, accent, OAuth, and saved-account data from the device.",
  'Use Bluesky account settings to revoke app sessions, update account information, or manage your personal data server account.',
  'Edit or delete posts, media, profile details, follows, blocks, mutes, lists, and other Bluesky data through Not Twitter or Bluesky.',
  'Contact the operator or repository maintainer for the specific Not Twitter deployment you are using.'
];

function PrivacySection({ title, children }: PrivacySectionProps): JSX.Element {
  return (
    <section className='border-t border-light-border px-4 py-6 dark:border-dark-border'>
      <h2 className='text-xl font-extrabold'>{title}</h2>
      <div className='mt-3 space-y-3 text-[15px] leading-6 text-light-secondary dark:text-dark-secondary'>
        {children}
      </div>
    </section>
  );
}

function PrivacyList({ items }: PrivacyListProps): JSX.Element {
  return (
    <ul className='list-disc space-y-2 pl-5'>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function PrivacyLayout({ children }: { children: ReactNode }): JSX.Element {
  const { user, loading } = useAuth();

  const page = (
    <MainContainer className='pb-24'>
      <MainHeader
        title='Privacy Policy'
        useMobileSidebar={!loading && !!user}
      />
      {children}
    </MainContainer>
  );

  if (!loading && user) return <MainLayout>{page}</MainLayout>;

  return (
    <LoggedOutTwitterLayout>
      <div className='mx-auto flex w-full max-w-xl'>{page}</div>
    </LoggedOutTwitterLayout>
  );
}

export default function Privacy(): JSX.Element {
  return (
    <>
      <SEO
        title='Privacy Policy / Not Twitter'
        description='How Not Twitter uses browser storage and Bluesky data.'
      />
      <article>
        <section className='px-4 pt-4 pb-6'>
          <p className='text-[15px] leading-6 text-light-secondary dark:text-dark-secondary'>
            Last updated: {lastUpdated}
          </p>
          <h1 className='mt-2 text-3xl font-extrabold'>Privacy Policy</h1>
          <p className='mt-4 text-[15px] leading-6 text-light-secondary dark:text-dark-secondary'>
            Not Twitter is a frontend for Bluesky and AT Protocol. It is not
            Twitter, X, Bluesky, or your personal data server. This policy
            explains what this app code does by default and what may happen when
            a particular deployment hosts it.
          </p>
        </section>

        <PrivacySection title='Information We Handle'>
          <PrivacyList items={collectedData} />
        </PrivacySection>

        <PrivacySection title='Information We Do Not Intentionally Collect'>
          <p>
            This codebase does not include a separate first-party social graph
            database, advertising pixel, analytics package, or payment system.
            It does not ask for your Bluesky password during the normal OAuth
            sign-in flow. If a deployment adds extra services, the operator
            should update this policy before collecting that additional data.
          </p>
        </PrivacySection>

        <PrivacySection title='How We Use Information'>
          <PrivacyList items={useCases} />
        </PrivacySection>

        <PrivacySection title='Browser Storage'>
          <p>
            Not Twitter uses browser storage instead of advertising cookies for
            local app state. Browser storage can include OAuth state, the active
            account identifier, saved account summaries, theme, accent color,
            and cached app preferences. Anyone with access to your browser
            profile, device, extensions, or developer tools may be able to view
            local data stored for this site.
          </p>
        </PrivacySection>

        <PrivacySection title='How Information Is Shared'>
          <PrivacyList items={sharingCases} />
          <p>
            Not Twitter does not sell personal information in this codebase and
            does not include cross-context behavioral advertising by default.
          </p>
        </PrivacySection>

        <PrivacySection title='Public Content'>
          <p>
            Bluesky posts, profiles, likes, reposts, follows, lists, and other
            public AT Protocol data may remain visible outside this app after
            they are published. Deleting or changing content in Not Twitter
            sends the related request to Bluesky or your personal data server,
            but copies may still exist in caches, embeds, relays, feeds, search
            indexes, backups, or services controlled by other people.
          </p>
        </PrivacySection>

        <PrivacySection title='Your Choices'>
          <PrivacyList items={choices} />
        </PrivacySection>

        <PrivacySection title='Children'>
          <p>
            Not Twitter is not directed to children under 13. Bluesky and your
            personal data server may have their own age rules for account
            creation and use.
          </p>
        </PrivacySection>

        <PrivacySection title='Security'>
          <p>
            The app uses AT Protocol OAuth where available and relies on
            Bluesky, your personal data server, browser storage, and the
            deployment host for key parts of security. No internet service can
            guarantee perfect security, so use a trusted device and sign out
            when you are finished on shared hardware.
          </p>
        </PrivacySection>

        <PrivacySection title='Changes'>
          <p>
            This policy may change as Not Twitter changes. Material updates
            should be reflected by changing the date at the top of the policy.
          </p>
        </PrivacySection>

        <PrivacySection title='Contact'>
          <p>
            For privacy questions about a specific deployment, contact the
            person or organization that provided that deployment. For the source
            project, use the{' '}
            <a
              className='custom-underline text-main-accent'
              href='https://github.com/EricKrouss/not-twitter/issues'
              target='_blank'
              rel='noreferrer'
            >
              project issue tracker
            </a>
            .
          </p>
          <p>
            You can also review Bluesky account and privacy controls directly on
            Bluesky.
          </p>
          <p>
            For frontend-specific messages and errors, use the{' '}
            <Link
              href='/help-center'
              className='custom-underline text-main-accent'
            >
              Help Center
            </Link>
            .
          </p>
          <Link href='/' className='custom-underline text-main-accent'>
            Return to Not Twitter
          </Link>
        </PrivacySection>
      </article>
    </>
  );
}

Privacy.getLayout = (page: ReactElement<any>): ReactNode => (
  <PrivacyLayout>{page}</PrivacyLayout>
);
