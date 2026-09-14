import Link from 'next/link';
import cn from 'clsx';
import type { MouseEvent, ReactNode, JSX } from 'react';
import type { TweetTombstoneKind } from '@lib/types/tweet';

const LEARN_MORE_URL = '/help-center/articles/tweet-tombstones-and-notices';

const TWITTER_RULES_URL =
  'https://bsky.social/about/support/community-guidelines';

export const limitedVisibilityTweetMessage =
  'You’re unable to view this Tweet because this account owner limits who can view their Tweets.';

const viewableTombstones = new Set<TweetTombstoneKind>([
  'sensitive-media',
  'reported',
  'muted-account',
  'muted-word'
]);

type TweetTombstoneProps = {
  kind: TweetTombstoneKind;
  className?: string;
  username?: string;
  country?: string;
  onView?: () => void;
};

type TombstoneStyle = {
  className: string;
  linkIsStrong?: boolean;
  mediaAction?: boolean;
  strong: boolean;
};

function stopTweetNavigation(
  event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>
): void {
  event.stopPropagation();
}

function TombstoneLink({
  children,
  href = LEARN_MORE_URL,
  internal,
  strong
}: {
  children: ReactNode;
  href?: string;
  internal?: boolean;
  strong?: boolean;
}): JSX.Element {
  const className = cn(
    'custom-underline text-main-accent',
    strong ? 'font-bold' : 'font-normal'
  );
  const isInternal = internal ?? href.startsWith('/');

  if (isInternal)
    return (
      <Link href={href} className={className} onClick={stopTweetNavigation}>
        {children}
      </Link>
    );

  return (
    <a
      className={className}
      href={href}
      target='_blank'
      rel='noreferrer'
      onClick={stopTweetNavigation}
    >
      {children}
    </a>
  );
}

function ViewButton({
  accent,
  onView
}: {
  accent?: boolean;
  onView?: () => void;
}): JSX.Element {
  const handleView = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    stopTweetNavigation(event);
    onView?.();
  };

  return (
    <button
      className={cn(
        `accent-tab shrink-0 px-1 font-bold hover:text-main-accent
         dark:hover:text-main-accent`,
        accent
          ? 'text-[13px] leading-4 text-main-accent'
          : 'text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'
      )}
      type='button'
      onClick={handleView}
    >
      View
    </button>
  );
}

function getTombstoneStyle(kind: TweetTombstoneKind): TombstoneStyle {
  switch (kind) {
    case 'limited-visibility':
      return {
        className: 'rounded-2xl px-4 py-3 text-[15px] leading-5',
        strong: false
      };
    case 'sensitive':
      return {
        className: 'rounded-[14px] px-3 py-2 text-[15px] leading-5',
        strong: false
      };
    case 'age-restricted':
      return {
        className: 'rounded-2xl px-5 py-4 text-[16px] leading-5',
        linkIsStrong: true,
        strong: true
      };
    case 'sensitive-media':
      return {
        className: 'rounded-[3px] px-2 py-2 text-[13px] leading-4',
        mediaAction: true,
        strong: false
      };
    case 'reported':
    case 'muted-account':
    case 'muted-word':
      return {
        className: 'rounded-[3px] px-3 py-2.5 text-[15px] leading-5',
        strong: false
      };
    case 'withheld':
      return {
        className: 'rounded-[3px] px-3 py-2.5 text-[15px] leading-[18px]',
        strong: false
      };
    default:
      return {
        className: 'rounded-[3px] px-3 py-2.5 text-[15px] leading-5',
        strong: false
      };
  }
}

export function isViewableTweetTombstoneKind(
  kind: TweetTombstoneKind | null | undefined
): boolean {
  return !!kind && viewableTombstones.has(kind);
}

export function TweetTombstone({
  kind,
  className,
  username = '@username',
  country = '<country>',
  onView
}: TweetTombstoneProps): JSX.Element {
  const {
    className: styleClassName,
    linkIsStrong,
    mediaAction,
    strong
  } = getTombstoneStyle(kind);
  const boxClassName = cn(
    `max-w-full border border-light-line-reply bg-main-sidebar-background
     text-light-secondary dark:border-dark-border dark:text-dark-secondary`,
    styleClassName,
    strong && 'font-bold',
    className
  );

  if (kind === 'sensitive-media')
    return (
      <div
        className={cn(boxClassName, 'flex items-center justify-between gap-4')}
      >
        <div className='min-w-0'>
          <p>The following media includes potentially sensitive content.</p>
          <TombstoneLink href='/settings' internal>
            Change settings
          </TombstoneLink>
        </div>
        <ViewButton accent={mediaAction} onView={onView} />
      </div>
    );

  if (
    kind === 'reported' ||
    kind === 'muted-account' ||
    kind === 'muted-word'
  ) {
    const message =
      kind === 'reported'
        ? 'You reported this Tweet.'
        : kind === 'muted-account'
          ? 'This Tweet is from an account you muted.'
          : 'This Tweet includes a word you muted.';

    return (
      <div
        className={cn(boxClassName, 'flex items-center justify-between gap-4')}
      >
        <span>{message}</span>
        <ViewButton onView={onView} />
      </div>
    );
  }

  return (
    <div className={boxClassName}>
      {kind === 'limited-visibility' && (
        <>
          {limitedVisibilityTweetMessage}{' '}
          <TombstoneLink strong={linkIsStrong}>Learn more</TombstoneLink>
        </>
      )}
      {kind === 'sensitive' && 'This Tweet may include sensitive content.'}
      {kind === 'age-restricted' && (
        <>
          Age-restricted adult content. This content might not be appropriate
          for people under 18 years old.{' '}
          <TombstoneLink strong={linkIsStrong}>Learn more</TombstoneLink>
        </>
      )}
      {kind === 'rules-violation' && (
        <>
          This Tweet violated the{' '}
          <TombstoneLink href={TWITTER_RULES_URL}>
            Bluesky Community Guidelines
          </TombstoneLink>
          . <TombstoneLink strong={linkIsStrong}>Learn more</TombstoneLink>
        </>
      )}
      {kind === 'suspended' && (
        <>
          This Tweet is from a suspended account.{' '}
          <TombstoneLink strong={linkIsStrong}>Learn more</TombstoneLink>
        </>
      )}
      {kind === 'withheld' && (
        <>
          This Tweet from {username} has been withheld in {country} based on
          local law(s).{' '}
          <TombstoneLink strong={linkIsStrong}>Learn more</TombstoneLink>
        </>
      )}
      {kind === 'no-longer-exists' && (
        <>
          This Tweet is from an account that no longer exists.{' '}
          <TombstoneLink strong={linkIsStrong}>Learn more</TombstoneLink>
        </>
      )}
      {kind === 'unavailable' && (
        <>
          This Tweet is unavailable.{' '}
          <TombstoneLink strong={linkIsStrong}>Learn more</TombstoneLink>
        </>
      )}
    </div>
  );
}
