import { useEffect, useMemo, useState, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import cn from 'clsx';
import useSWR from 'swr';
import { toast } from 'react-hot-toast';
import {
  addSettingsMutedWord,
  confirmSettingsEmail,
  getBlueskySettings,
  removeSettingsMutedWord,
  requestSettingsEmailConfirmation,
  requestSettingsEmailUpdateToken,
  requestSettingsPasswordReset,
  resetSettingsPassword,
  setAdultContentSetting,
  setContentLabelSetting,
  setDefaultQuoteSetting,
  setDefaultReplySetting,
  setFeedViewSetting,
  setSettingsChatAllowIncoming,
  setSettingsNotificationPreference,
  setThreadViewSetting,
  updateSettingsEmail,
  updateSettingsHandle,
  type BlueskySettings,
  type ChatAllowIncoming,
  type SettingsContentLabel,
  type SettingsDefaultQuote,
  type SettingsDefaultReply,
  type SettingsLabelPreference,
  type SettingsMutedWordActorTarget,
  type SettingsMutedWordTarget,
  type SettingsNotificationKey,
  type SettingsNotificationPreference,
  type SettingsThreadSort
} from '@lib/atproto/backend';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { useWindow } from '@lib/context/window-context';
import { useModal } from '@lib/hooks/useModal';
import { useStandardSiteArticlesInline } from '@lib/hooks/use-standard-site-articles-inline';
import { MainLayout } from '@components/layout/main-layout';
import { ProtectedLayout } from '@components/layout/common-layout';
import { SEO } from '@components/common/seo';
import { Modal } from '@components/modal/modal';
import { DisplayModal } from '@components/modal/display-modal';
import { Button } from '@components/ui/button';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon, type IconName } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import type { ChangeEvent, FormEvent, ReactElement, ReactNode } from 'react';

type SettingsSection =
  'account' | 'security' | 'privacy' | 'content' | 'notifications' | 'display';

type SettingsNavItem = {
  id: SettingsSection;
  title: string;
  description: string;
  iconName: IconName;
};

const SETTINGS_NAV: SettingsNavItem[] = [
  {
    id: 'account',
    title: 'Your account',
    description: 'See account information and supported account settings.',
    iconName: 'UserCircleIcon'
  },
  {
    id: 'security',
    title: 'Security and account access',
    description: 'Review OAuth access, email state, and account status.',
    iconName: 'ShieldCheckIcon'
  },
  {
    id: 'privacy',
    title: 'Privacy and safety',
    description: 'Control replies, quotes, messages, and muted words.',
    iconName: 'LockClosedIcon'
  },
  {
    id: 'content',
    title: 'Content you see',
    description: 'Tune home feed, reply sorting, labels, and interests.',
    iconName: 'AdjustmentsHorizontalIcon'
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Choose which Bluesky alerts appear in-app or as pushes.',
    iconName: 'BellIcon'
  },
  {
    id: 'display',
    title: 'Accessibility, display, and languages',
    description: 'Adjust the local Not Twitter-style display for this browser.',
    iconName: 'PaintBrushIcon'
  }
];

function getSettingsSection(
  value: string | string[] | undefined
): SettingsSection | null {
  const section = Array.isArray(value) ? value[0] : value;

  return SETTINGS_NAV.some(({ id }) => id === section)
    ? (section as SettingsSection)
    : null;
}

const CONTENT_LABELS: Readonly<
  { label: SettingsContentLabel; title: string; description: string }[]
> = [
  {
    label: 'porn',
    title: 'Adult Content',
    description: 'Explicit sexual images.'
  },
  {
    label: 'sexual',
    title: 'Sexually Suggestive',
    description: 'Does not include nudity.'
  },
  {
    label: 'nudity',
    title: 'Non-sexual Nudity',
    description: 'E.g. artistic nudes.'
  },
  {
    label: 'sexual-figurative',
    title: 'Sexually Suggestive (Cartoon)',
    description:
      'Art with explicit or suggestive sexual themes, including provocative imagery or partial nudity.'
  },
  {
    label: 'graphic-media',
    title: 'Graphic Media',
    description: 'Explicit or potentially disturbing media.'
  },
  {
    label: 'self-harm',
    title: 'Self-Harm',
    description:
      'Promotes self-harm, including graphic images, glorifying discussions, or triggering stories.'
  },
  {
    label: 'sensitive',
    title: 'Sensitive',
    description:
      'May be upsetting, covering topics like substance abuse or mental health issues, cautioning sensitive viewers.'
  },
  {
    label: 'extremist',
    title: 'Extremist',
    description:
      'Radical views advocating violence, hate, or discrimination against individuals or groups.'
  },
  {
    label: 'intolerant',
    title: 'Intolerance',
    description: 'Discrimination against protected groups.'
  },
  {
    label: 'threat',
    title: 'Threats',
    description:
      'Promotes violence or harm towards others, including threats, incitement, or advocacy of harm.'
  },
  {
    label: 'rude',
    title: 'Rude',
    description:
      'Rude or impolite, including crude language and disrespectful comments, without constructive purpose.'
  },
  {
    label: 'illicit',
    title: 'Illicit',
    description:
      'Promoting or selling potentially illicit goods, services, or activities.'
  },
  {
    label: 'security',
    title: 'Security Concerns',
    description:
      'May be unsafe and could harm your device, steal your info, or get your account hacked.'
  },
  {
    label: 'unsafe-link',
    title: 'Unsafe link',
    description:
      'Links to harmful sites with malware, phishing, or violating content that risk security and privacy.'
  },
  {
    label: 'impersonation',
    title: 'Impersonation',
    description: 'Pretending to be someone else without permission.'
  },
  {
    label: 'misinformation',
    title: 'Misinformation',
    description:
      'Spreading false or misleading info, including unverified claims and harmful conspiracy theories.'
  },
  {
    label: 'scam',
    title: 'Scam',
    description: 'Scams, phishing and fraud.'
  },
  {
    label: 'engagement-farming',
    title: 'Engagement Farming',
    description:
      'Insincere content or bulk actions aimed at gaining followers, including frequent follows, posts, and likes.'
  },
  {
    label: 'spam',
    title: 'Spam',
    description: 'Unwanted, repeated, or unrelated actions that bother users.'
  },
  {
    label: 'rumor',
    title: 'Unconfirmed',
    description: 'This claim has not been confirmed by a credible source yet.'
  },
  {
    label: 'misleading',
    title: 'Misleading',
    description: 'Altered images/videos, deceptive links, or false statements.'
  },
  {
    label: 'inauthentic',
    title: 'Inauthentic Account',
    description: 'Bot or a person pretending to be someone else.'
  }
];

const LABEL_OPTIONS: Readonly<
  { value: SettingsLabelPreference; label: string }[]
> = [
  { value: 'ignore', label: 'Off' },
  { value: 'warn', label: 'Warn' },
  { value: 'hide', label: 'Hide' }
];

const REPLY_OPTIONS: Readonly<
  { value: Exclude<SettingsDefaultReply, 'custom'>; label: string }[]
> = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'following', label: 'People you follow' },
  { value: 'followers', label: 'Your followers' },
  { value: 'mentioned', label: 'People you mention' },
  { value: 'nobody', label: 'No one' }
];

const QUOTE_OPTIONS: Readonly<
  { value: Exclude<SettingsDefaultQuote, 'custom'>; label: string }[]
> = [
  { value: 'enabled', label: 'On' },
  { value: 'disabled', label: 'Off' }
];

const CHAT_OPTIONS: Readonly<{ value: ChatAllowIncoming; label: string }[]> = [
  { value: 'all', label: 'Everyone' },
  { value: 'following', label: 'People you follow' },
  { value: 'none', label: 'No one' }
];

const THREAD_SORT_OPTIONS: Readonly<
  { value: SettingsThreadSort; label: string }[]
> = [
  { value: 'hotness', label: 'Most relevant' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'newest', label: 'Newest first' },
  { value: 'most-likes', label: 'Most liked first' }
];

const NOTIFICATION_ROWS: Readonly<
  { key: SettingsNotificationKey; title: string; description: string }[]
> = [
  {
    key: 'chat',
    title: 'Messages',
    description: 'Direct message notifications.'
  },
  {
    key: 'mention',
    title: 'Mentions',
    description: 'Posts that mention you.'
  },
  {
    key: 'reply',
    title: 'Replies',
    description: 'Replies to your posts and threads.'
  },
  {
    key: 'follow',
    title: 'New followers',
    description: 'People who follow you.'
  },
  {
    key: 'like',
    title: 'Likes',
    description: 'Likes on your posts.'
  },
  {
    key: 'repost',
    title: 'Reposts',
    description: 'Reposts of your posts.'
  },
  {
    key: 'quote',
    title: 'Quotes',
    description: 'Quote posts of your posts.'
  },
  {
    key: 'verified',
    title: 'Verified interactions',
    description: 'Activity from verified accounts.'
  },
  {
    key: 'unverified',
    title: 'Unverified interactions',
    description: 'Activity from accounts without verification.'
  }
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function maskEmail(email: string | null): string {
  if (!email) return 'Not exposed by session';

  const [name, domain] = email.split('@');
  if (!domain) return 'Available in session';
  const visible = name.slice(0, Math.min(2, name.length));

  return `${visible}${name.length > 2 ? '***' : '*'}@${domain}`;
}

function getBooleanLabel(value: boolean | null): string {
  if (value === null) return 'Unknown';

  return value ? 'On' : 'Off';
}

function getStatusLabel(settings: BlueskySettings): string {
  if (settings.account.status) return settings.account.status;
  if (settings.account.active === false) return 'Inactive';

  return 'Active';
}

function getExpiryDate(option: string): string | undefined {
  if (option === 'never') return undefined;

  const now = Date.now();
  const durations: Record<string, number> = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000
  };

  return new Date(now + (durations[option] ?? durations.week)).toISOString();
}

const fieldClassName = `rounded-md border border-light-border bg-transparent px-3 text-[15px]
                        outline-none focus:border-main-accent dark:border-dark-border`;

const compactButtonClassName =
  'accent-tab inline-flex h-9 items-center justify-center rounded-full bg-main-accent px-4 py-0 text-center text-sm font-bold text-white';

const secondaryButtonClassName = `accent-tab inline-flex h-9 items-center justify-center rounded-full border border-light-border px-4
                                  py-0 text-center text-sm font-bold dark:border-dark-border`;

type ToggleProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
};

function Toggle({
  checked,
  disabled,
  label,
  onChange
}: ToggleProps): JSX.Element {
  return (
    <button
      className={cn(
        `flex h-8 w-14 shrink-0 items-center rounded-full px-1 transition
         focus-visible:outline focus-visible:outline-2 focus-visible:outline-main-accent`,
        checked ? 'bg-main-accent' : 'bg-light-border dark:bg-dark-border',
        disabled && 'cursor-wait opacity-60'
      )}
      type='button'
      role='switch'
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
    >
      <span
        className={cn(
          'h-6 w-6 rounded-full bg-white shadow transition',
          checked && 'translate-x-6'
        )}
      />
    </button>
  );
}

type SettingsRowProps = {
  title: string;
  description?: string;
  children?: ReactNode;
  childrenClassName?: string;
  stack?: boolean;
};

function SettingsRow({
  title,
  description,
  children,
  childrenClassName,
  stack
}: SettingsRowProps): JSX.Element {
  return (
    <div
      className={cn(
        `min-h-[64px] border-b border-light-border px-4 py-3
         dark:border-dark-border`,
        stack
          ? 'block'
          : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5'
      )}
    >
      <div className={cn('min-w-0', !stack && 'sm:flex-1')}>
        <p className='text-[15px] font-bold'>{title}</p>
        {description && (
          <p className='mt-0.5 text-[13px] leading-5 text-light-secondary dark:text-dark-secondary'>
            {description}
          </p>
        )}
      </div>
      {children && (
        <div
          className={cn(
            stack
              ? 'mt-3 w-full'
              : 'w-full sm:w-auto sm:max-w-[390px] sm:shrink-0',
            childrenClassName
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function SettingsLinkRow({
  title,
  description,
  href,
  meta
}: {
  title: string;
  description?: string;
  href: string;
  meta?: string;
}): JSX.Element {
  return (
    <Link href={href}>
      <a className='hover-card block outline-none focus-visible:ring-2 focus-visible:ring-main-accent'>
        <SettingsRow
          title={title}
          description={description}
          childrenClassName='flex justify-end'
        >
          <span className='flex min-w-0 items-center justify-end gap-3 text-[15px] font-bold text-light-secondary dark:text-dark-secondary'>
            {meta && <span className='truncate'>{meta}</span>}
            <CustomIcon
              className='h-4 w-4 shrink-0'
              iconName='TwitterChevronRightIcon'
            />
          </span>
        </SettingsRow>
      </a>
    </Link>
  );
}

function SectionHeading({
  title,
  description
}: {
  title: string;
  description?: string;
}): JSX.Element {
  return (
    <div className='border-b border-light-border px-4 pt-5 pb-3 dark:border-dark-border'>
      <h2 className='text-xl font-extrabold'>{title}</h2>
      {description && (
        <p className='mt-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
          {description}
        </p>
      )}
    </div>
  );
}

function ValuePill({ value }: { value: string }): JSX.Element {
  return (
    <span className='block max-w-full truncate rounded-full bg-main-accent/10 px-3 py-1 text-[13px] font-bold text-main-accent sm:max-w-[260px]'>
      {value}
    </span>
  );
}

type RadioChoice<T extends string> = {
  value: T;
  label: string;
};

function RadioButtons<T extends string>({
  value,
  options,
  disabled,
  savingValue,
  onChange
}: {
  value: T;
  options: Readonly<RadioChoice<T>[]>;
  disabled?: boolean;
  savingValue?: string | null;
  onChange: (value: T) => void;
}): JSX.Element {
  return (
    <div className='flex flex-wrap gap-2 sm:justify-end'>
      {options.map((option) => {
        const selected = option.value === value;
        const saving = savingValue === option.value;

        return (
          <Button
            className={cn(
              `inline-flex min-h-[34px] items-center justify-center rounded-full border px-3 py-1 text-center text-sm font-bold
               disabled:cursor-wait disabled:opacity-70`,
              selected
                ? 'border-main-accent bg-main-accent text-white'
                : `border-light-border bg-transparent text-main-primary
                   hover:bg-light-primary/10 dark:border-dark-border dark:hover:bg-dark-primary/10`
            )}
            disabled={disabled}
            onClick={(): void => onChange(option.value)}
            key={option.value}
          >
            {saving ? (
              <CustomIcon className='h-4 w-4' iconName='SpinnerIcon' />
            ) : (
              option.label
            )}
          </Button>
        );
      })}
    </div>
  );
}

function LabelPreferenceButtons({
  value,
  disabled,
  savingValue,
  onChange
}: {
  value: SettingsLabelPreference;
  disabled?: boolean;
  savingValue?: string | null;
  onChange: (value: SettingsLabelPreference) => void;
}): JSX.Element {
  return (
    <div className='grid w-full grid-cols-3 overflow-hidden rounded-md border border-light-border dark:border-dark-border sm:min-w-[310px]'>
      {LABEL_OPTIONS.map((option) => {
        const selected = option.value === value;
        const saving = savingValue === option.value;

        return (
          <Button
            className={cn(
              `flex h-9 items-center justify-center rounded-none border-r border-light-border
               px-3 py-0 text-center text-sm font-bold last:border-r-0
               disabled:cursor-wait disabled:opacity-70 dark:border-dark-border`,
              selected
                ? 'bg-main-accent text-white'
                : `bg-transparent text-light-secondary hover:bg-light-primary/10
                   dark:text-dark-secondary dark:hover:bg-dark-primary/10`
            )}
            disabled={disabled}
            onClick={(): void => onChange(option.value)}
            key={option.value}
          >
            {saving ? (
              <CustomIcon className='h-4 w-4' iconName='SpinnerIcon' />
            ) : (
              option.label
            )}
          </Button>
        );
      })}
    </div>
  );
}

function SettingsError({
  error,
  onRetry
}: {
  error: Error;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div className='px-8 py-12 text-center'>
      <p className='text-xl font-extrabold'>Settings didn’t load</p>
      <p className='mt-2 text-light-secondary dark:text-dark-secondary'>
        {getErrorMessage(error)}
      </p>
      <Button
        className='accent-tab mt-5 inline-flex h-10 items-center justify-center rounded-full bg-main-accent px-5 py-0 text-center font-bold text-white hover:bg-main-accent/90'
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  );
}

function SettingsNotice({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className='border-b border-light-border px-4 py-5 dark:border-dark-border'>
      <p className='font-bold'>{title}</p>
      <p className='mt-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
        {description}
      </p>
      {action && <div className='mt-4'>{action}</div>}
    </div>
  );
}

function SettingsFormBlock({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className='border-b border-light-border px-4 py-4 dark:border-dark-border'>
      <p className='text-[15px] font-bold'>{title}</p>
      {description && (
        <p className='mt-0.5 text-[13px] leading-5 text-light-secondary dark:text-dark-secondary'>
          {description}
        </p>
      )}
      <div className='mt-3'>{children}</div>
    </div>
  );
}

function SettingsNavigation({
  activeSection,
  onSelect
}: {
  activeSection: SettingsSection;
  onSelect: (section: SettingsSection) => void;
}): JSX.Element {
  return (
    <section className='w-full shrink-0 md:w-[390px]'>
      <header className='sticky top-0 z-10 flex h-[53px] items-center bg-main-background/80 px-4 backdrop-blur-md'>
        <h1 className='text-xl font-extrabold'>Settings</h1>
      </header>
      <nav className='border-t border-light-border dark:border-dark-border xs:border-t-0'>
        {SETTINGS_NAV.map(({ id, title, description, iconName }) => {
          const active = activeSection === id;

          return (
            <Button
              className={cn(
                `hover-card flex min-h-[80px] w-full items-center gap-4 rounded-none border-b
                 border-light-border px-4 py-3 text-left dark:border-dark-border`,
                active && 'bg-main-sidebar-background'
              )}
              onClick={(): void => onSelect(id)}
              key={id}
            >
              <HeroIcon
                className={cn('h-6 w-6 shrink-0', active && 'text-main-accent')}
                iconName={iconName}
              />
              <span className='min-w-0 flex-1'>
                <span className='block text-[15px] font-bold'>{title}</span>
                <span className='mt-0.5 block text-[13px] leading-5 text-light-secondary dark:text-dark-secondary'>
                  {description}
                </span>
              </span>
              <CustomIcon
                className='h-4 w-4 shrink-0 text-light-secondary dark:text-dark-secondary'
                iconName='TwitterChevronRightIcon'
              />
            </Button>
          );
        })}
      </nav>
    </section>
  );
}

function SettingsPanelHeader({
  title,
  showBack,
  onBack
}: {
  title: string;
  showBack: boolean;
  onBack: () => void;
}): JSX.Element {
  return (
    <header className='sticky top-0 z-10 flex h-[53px] items-center gap-5 bg-main-background/80 px-3 backdrop-blur-md'>
      {showBack && (
        <Button
          className='dark-bg-tab p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          onClick={onBack}
          title='Back'
        >
          <CustomIcon className='h-5 w-5' iconName='TwitterArrowLeftIcon' />
        </Button>
      )}
      <h1 className='truncate text-xl font-extrabold'>{title}</h1>
    </header>
  );
}

export default function Settings(): JSX.Element {
  const { user, signInWithBluesky } = useAuth();
  const { hideBskySocialSuffix, toggleHideBskySocialSuffix } = useTheme();
  const { standardSiteArticlesInline, toggleStandardSiteArticlesInline } =
    useStandardSiteArticlesInline();
  const { isMobile } = useWindow();
  const router = useRouter();
  const displayModal = useModal();
  const [activeSection, setActiveSection] =
    useState<SettingsSection>('account');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailTokenInput, setEmailTokenInput] = useState('');
  const [emailConfirmationToken, setEmailConfirmationToken] = useState('');
  const [emailTokenRequired, setEmailTokenRequired] = useState<boolean | null>(
    null
  );
  const [emailAuthFactorInput, setEmailAuthFactorInput] = useState(false);
  const [passwordResetEmail, setPasswordResetEmail] = useState('');
  const [passwordResetToken, setPasswordResetToken] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [replyLikeCount, setReplyLikeCount] = useState(0);
  const [mutedWordValue, setMutedWordValue] = useState('');
  const [mutedTargets, setMutedTargets] = useState<SettingsMutedWordTarget[]>([
    'content',
    'tag'
  ]);
  const [mutedActorTarget, setMutedActorTarget] =
    useState<SettingsMutedWordActorTarget>('all');
  const [mutedExpiry, setMutedExpiry] = useState('never');

  const {
    data: settings,
    error,
    mutate
  } = useSWR<BlueskySettings, Error>(
    user ? `bluesky-settings:${user.id}` : null,
    getBlueskySettings
  );

  useEffect(() => {
    if (!settings) return;

    setHandleInput(settings.account.handle);
    setEmailInput(
      (currentEmail) => currentEmail || (settings.account.email ?? '')
    );
    setEmailAuthFactorInput(settings.account.emailAuthFactor ?? false);
    setPasswordResetEmail(
      (currentEmail) => currentEmail || (settings.account.email ?? '')
    );
    setReplyLikeCount(settings.feedView.hideRepliesByLikeCount ?? 0);
  }, [settings]);

  useEffect(() => {
    if (!router.isReady) return;

    const section = getSettingsSection(router.query.section);
    if (!section) return;

    setActiveSection(section);
    if (isMobile) setMobileDetailOpen(true);
  }, [isMobile, router.isReady, router.query.section]);

  const activeTitle = useMemo(
    () => SETTINGS_NAV.find(({ id }) => id === activeSection)?.title ?? '',
    [activeSection]
  );

  const runUpdate = async (
    key: string,
    action: () => Promise<BlueskySettings>,
    message = 'Settings updated'
  ): Promise<void> => {
    setSavingKey(key);

    try {
      const nextSettings = await action();

      await mutate(nextSettings, false);
      toast.success(message);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingKey(null);
    }
  };

  const runAction = async (
    key: string,
    action: () => Promise<string | void>,
    message = 'Done'
  ): Promise<void> => {
    setSavingKey(key);

    try {
      const nextMessage = await action();

      toast.success(nextMessage ?? message);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingKey(null);
    }
  };

  const handleSectionSelect = (section: SettingsSection): void => {
    setActiveSection(section);
    if (isMobile) setMobileDetailOpen(true);
    void router.replace(
      {
        pathname: '/settings',
        query: { section }
      },
      undefined,
      { scroll: false, shallow: true }
    );
  };

  const handleHandleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    void runUpdate(
      'handle-update',
      () => updateSettingsHandle(handleInput),
      'Handle updated'
    );
  };

  const handleEmailTokenRequest = (): void => {
    void runAction('email-token-request', async () => {
      const tokenRequired = await requestSettingsEmailUpdateToken();

      setEmailTokenRequired(tokenRequired);

      return tokenRequired
        ? 'Check your current email for an update code.'
        : 'This account can update email without a code.';
    });
  };

  const handleEmailSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    void runUpdate(
      'email-update',
      () =>
        updateSettingsEmail(
          emailInput,
          emailTokenInput || undefined,
          emailAuthFactorInput
        ),
      'Email updated'
    );
  };

  const handleEmailConfirmationRequest = (): void => {
    void runAction(
      'email-confirmation-request',
      () => requestSettingsEmailConfirmation(),
      'Confirmation email sent'
    );
  };

  const handleEmailConfirmationSubmit = (
    event: FormEvent<HTMLFormElement>
  ): void => {
    event.preventDefault();

    void runUpdate(
      'email-confirmation',
      () => confirmSettingsEmail(emailInput, emailConfirmationToken),
      'Email confirmed'
    );
  };

  const handlePasswordResetRequest = (): void => {
    void runAction(
      'password-reset-request',
      () => requestSettingsPasswordReset(passwordResetEmail),
      'Password reset email sent'
    );
  };

  const handlePasswordResetSubmit = (
    event: FormEvent<HTMLFormElement>
  ): void => {
    event.preventDefault();

    void runAction(
      'password-reset-confirm',
      async () => {
        await resetSettingsPassword(passwordResetToken, newPasswordInput);
        setPasswordResetToken('');
        setNewPasswordInput('');
      },
      'Password updated'
    );
  };

  const handleReplyLikeSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void runUpdate('reply-like-count', () =>
      setFeedViewSetting({ hideRepliesByLikeCount: replyLikeCount })
    );
  };

  const handleMutedTargetToggle = (target: SettingsMutedWordTarget): void => {
    setMutedTargets((currentTargets) =>
      currentTargets.includes(target)
        ? currentTargets.filter((item) => item !== target)
        : [...currentTargets, target]
    );
  };

  const handleMutedWordSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    void runUpdate(
      'muted-word-add',
      () =>
        addSettingsMutedWord(
          mutedWordValue,
          mutedTargets,
          mutedActorTarget,
          getExpiryDate(mutedExpiry)
        ),
      'Muted word added'
    ).then(() => setMutedWordValue(''));
  };

  const handleAuthorizeMessages = (): void => {
    if (!user) return;

    void runUpdate('authorize-messages', async () => {
      await signInWithBluesky(user.username);
      return getBlueskySettings();
    });
  };

  const updateNotification = (
    key: SettingsNotificationKey,
    preference: Partial<SettingsNotificationPreference>
  ): void => {
    void runUpdate(
      `notification-${key}`,
      () => setSettingsNotificationPreference(key, preference),
      'Notification settings updated'
    );
  };

  const renderAccountPanel = (): JSX.Element | null => {
    if (!settings) return null;

    return (
      <>
        <SectionHeading
          title='Account information'
          description='See your account information, like your handle and email address.'
        />
        <SettingsRow
          title='Username'
          description='Your current Bluesky handle.'
        >
          <ValuePill
            value={formatAtprotoDisplayIdentifier(settings.account.handle, {
              hideBskySocialSuffix
            })}
          />
        </SettingsRow>
        <SettingsRow
          title='Account ID'
          description='Your decentralized identifier.'
        >
          <ValuePill value={settings.account.did} />
        </SettingsRow>
        <SettingsRow
          title='Email address'
          description='Masked on this screen; tokens and passwords are not shown.'
        >
          <ValuePill value={maskEmail(settings.account.email)} />
        </SettingsRow>
        <SettingsRow title='Email confirmed'>
          <ValuePill value={getBooleanLabel(settings.account.emailConfirmed)} />
        </SettingsRow>
        <SectionHeading
          title='Username'
          description='Change the handle people use to find you.'
        />
        <SettingsFormBlock
          title='Change username'
          description='Use a valid Bluesky handle, including custom domains when your PDS accepts them.'
        >
          <form
            className='flex flex-col gap-3 sm:flex-row'
            onSubmit={handleHandleSubmit}
          >
            <input
              className={cn(fieldClassName, 'h-11 min-w-0 flex-1')}
              placeholder='handle.bsky.social'
              value={handleInput}
              onChange={(event): void => setHandleInput(event.target.value)}
            />
            <Button
              className={compactButtonClassName}
              loading={savingKey === 'handle-update'}
              type='submit'
            >
              Save
            </Button>
          </form>
        </SettingsFormBlock>
        <SectionHeading
          title='Email'
          description='Change the email address associated with your Bluesky account.'
        />
        <SettingsFormBlock
          title='Update email address'
          description='Confirmed accounts may require a code sent to the current email before the new address can be saved.'
        >
          <form className='space-y-3' onSubmit={handleEmailSubmit}>
            <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]'>
              <input
                className={cn(fieldClassName, 'h-11')}
                type='email'
                placeholder='Email address'
                value={emailInput}
                onChange={(event): void => setEmailInput(event.target.value)}
              />
              <Button
                className={secondaryButtonClassName}
                loading={savingKey === 'email-token-request'}
                onClick={handleEmailTokenRequest}
              >
                Request code
              </Button>
            </div>
            <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]'>
              <input
                className={cn(fieldClassName, 'h-11')}
                placeholder={
                  emailTokenRequired === false
                    ? 'Update code optional'
                    : 'Update code'
                }
                value={emailTokenInput}
                onChange={(event): void =>
                  setEmailTokenInput(event.target.value)
                }
              />
              <label className='flex items-center gap-3 text-sm font-bold'>
                <Toggle
                  checked={emailAuthFactorInput}
                  disabled={savingKey === 'email-update'}
                  label='Email two-factor'
                  onChange={(): void =>
                    setEmailAuthFactorInput((enabled) => !enabled)
                  }
                />
                Email 2FA
              </label>
            </div>
            <Button
              className={compactButtonClassName}
              loading={savingKey === 'email-update'}
              type='submit'
            >
              Save
            </Button>
          </form>
        </SettingsFormBlock>
        <SettingsFormBlock
          title='Confirm email address'
          description='If your email is unconfirmed, request a confirmation code and enter it here.'
        >
          <form className='space-y-3' onSubmit={handleEmailConfirmationSubmit}>
            <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]'>
              <input
                className={cn(fieldClassName, 'h-11')}
                placeholder='Confirmation code'
                value={emailConfirmationToken}
                onChange={(event): void =>
                  setEmailConfirmationToken(event.target.value)
                }
              />
              <Button
                className={secondaryButtonClassName}
                loading={savingKey === 'email-confirmation-request'}
                onClick={handleEmailConfirmationRequest}
              >
                Send code
              </Button>
            </div>
            <Button
              className={compactButtonClassName}
              loading={savingKey === 'email-confirmation'}
              type='submit'
            >
              Confirm
            </Button>
          </form>
        </SettingsFormBlock>
      </>
    );
  };

  const renderSecurityPanel = (): JSX.Element | null => {
    if (!settings) return null;

    return (
      <>
        <SectionHeading
          title='Security and account access'
          description='Sensitive settings stay behind Bluesky OAuth. This app does not collect account passwords.'
        />
        <SettingsRow
          title='OAuth session'
          description='The active session is held by the Bluesky OAuth client in this browser.'
        >
          <ValuePill value='Connected' />
        </SettingsRow>
        <SettingsRow
          title='Email two-factor'
          description='Reported by com.atproto.server.getSession when available.'
        >
          <ValuePill
            value={getBooleanLabel(settings.account.emailAuthFactor)}
          />
        </SettingsRow>
        <SettingsRow
          title='Account status'
          description='Status exposed by your PDS for the current session.'
        >
          <ValuePill value={getStatusLabel(settings)} />
        </SettingsRow>
        <SectionHeading
          title='Password'
          description='Reset your account password using an email code from your PDS.'
        />
        <SettingsFormBlock
          title='Password reset'
          description='Send a reset email, then enter the token and your new password.'
        >
          <form className='space-y-3' onSubmit={handlePasswordResetSubmit}>
            <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]'>
              <input
                className={cn(fieldClassName, 'h-11')}
                type='email'
                placeholder='Account email'
                value={passwordResetEmail}
                onChange={(event): void =>
                  setPasswordResetEmail(event.target.value)
                }
              />
              <Button
                className={secondaryButtonClassName}
                loading={savingKey === 'password-reset-request'}
                onClick={handlePasswordResetRequest}
              >
                Send reset
              </Button>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              <input
                className={cn(fieldClassName, 'h-11')}
                placeholder='Reset token'
                value={passwordResetToken}
                onChange={(event): void =>
                  setPasswordResetToken(event.target.value)
                }
              />
              <input
                className={cn(fieldClassName, 'h-11')}
                type='password'
                placeholder='New password'
                value={newPasswordInput}
                onChange={(event): void =>
                  setNewPasswordInput(event.target.value)
                }
              />
            </div>
            <Button
              className={compactButtonClassName}
              loading={savingKey === 'password-reset-confirm'}
              type='submit'
            >
              Reset password
            </Button>
          </form>
        </SettingsFormBlock>
      </>
    );
  };

  const renderPrivacyPanel = (): JSX.Element | null => {
    if (!settings) return null;

    const chatSaving = savingKey?.startsWith('chat-');

    return (
      <>
        <SectionHeading
          title='Privacy and safety'
          description='Controls here are backed by Bluesky preferences, post interaction settings, or the chat declaration record.'
        />
        <SettingsRow
          title='Privacy policy'
          description='Read how Not Twitter uses browser storage and Bluesky data.'
        >
          <Link href='/privacy'>
            <a className={secondaryButtonClassName}>View policy</a>
          </Link>
        </SettingsRow>
        <SettingsRow
          title='Help Center'
          description='Read frontend-specific help for messages, notices, errors, and Bluesky support links.'
        >
          <Link href='/help-center'>
            <a className={secondaryButtonClassName}>Open help</a>
          </Link>
        </SettingsRow>
        <SettingsRow
          title='Default replies'
          description='Choose who can reply to new posts by default.'
        >
          {settings.postInteractions.defaultReply === 'custom' ? (
            <ValuePill value='Custom' />
          ) : (
            <RadioButtons
              value={settings.postInteractions.defaultReply}
              options={REPLY_OPTIONS}
              disabled={!!savingKey}
              savingValue={savingKey?.replace('reply-', '')}
              onChange={(value): void =>
                void runUpdate(`reply-${value}`, () =>
                  setDefaultReplySetting(value)
                )
              }
            />
          )}
        </SettingsRow>
        <SettingsRow
          title='Quote posts'
          description='Control whether new posts allow embedding by default.'
        >
          {settings.postInteractions.defaultQuote === 'custom' ? (
            <ValuePill value='Custom' />
          ) : (
            <RadioButtons
              value={settings.postInteractions.defaultQuote}
              options={QUOTE_OPTIONS}
              disabled={!!savingKey}
              savingValue={savingKey?.replace('quote-', '')}
              onChange={(value): void =>
                void runUpdate(`quote-${value}`, () =>
                  setDefaultQuoteSetting(value)
                )
              }
            />
          )}
        </SettingsRow>
        <SectionHeading title='Direct Messages' />
        {settings.chat.available && settings.chat.settings ? (
          <SettingsRow
            title='Allow message requests from'
            description='People you follow can always message you.'
          >
            <RadioButtons
              value={settings.chat.settings.allowIncoming}
              options={CHAT_OPTIONS}
              disabled={!!savingKey}
              savingValue={chatSaving ? savingKey?.replace('chat-', '') : null}
              onChange={(value): void =>
                void runUpdate(`chat-${value}`, () =>
                  setSettingsChatAllowIncoming(value)
                )
              }
            />
          </SettingsRow>
        ) : (
          <SettingsNotice
            title='Messages need authorization'
            description={
              settings.chat.error ??
              'Authorize Bluesky chat access to manage message requests.'
            }
            action={
              <Button
                className={compactButtonClassName}
                loading={savingKey === 'authorize-messages'}
                onClick={handleAuthorizeMessages}
              >
                Authorize messages
              </Button>
            }
          />
        )}
        <SectionHeading
          title='Muted words'
          description='Muted words are private account preferences.'
        />
        <form
          className='border-b border-light-border px-4 py-4 dark:border-dark-border'
          onSubmit={handleMutedWordSubmit}
        >
          <div className='flex flex-col gap-3'>
            <input
              className={cn(fieldClassName, 'h-11')}
              placeholder='Word or phrase'
              value={mutedWordValue}
              onChange={(event): void => setMutedWordValue(event.target.value)}
            />
            <div className='flex flex-wrap items-center gap-3 text-sm'>
              {(['content', 'tag'] as SettingsMutedWordTarget[]).map(
                (target) => (
                  <label className='flex items-center gap-2' key={target}>
                    <input
                      className='accent-main-accent'
                      type='checkbox'
                      checked={mutedTargets.includes(target)}
                      onChange={(): void => handleMutedTargetToggle(target)}
                    />
                    {target === 'content' ? 'Posts' : 'Tags'}
                  </label>
                )
              )}
              <select
                className={cn(fieldClassName, 'h-9 bg-main-background text-sm')}
                value={mutedActorTarget}
                onChange={(event): void =>
                  setMutedActorTarget(
                    event.target.value as SettingsMutedWordActorTarget
                  )
                }
              >
                <option value='all'>From anyone</option>
                <option value='exclude-following'>
                  Not from people you follow
                </option>
              </select>
              <select
                className={cn(fieldClassName, 'h-9 bg-main-background text-sm')}
                value={mutedExpiry}
                onChange={(event): void => setMutedExpiry(event.target.value)}
              >
                <option value='never'>Until you unmute</option>
                <option value='day'>24 hours</option>
                <option value='week'>7 days</option>
                <option value='month'>30 days</option>
              </select>
            </div>
            <Button
              className={cn(compactButtonClassName, 'self-start')}
              loading={savingKey === 'muted-word-add'}
              type='submit'
            >
              Add
            </Button>
          </div>
        </form>
        {settings.mutedWords.length ? (
          settings.mutedWords.map((word) => (
            <SettingsRow
              title={word.value}
              description={[
                word.targets.includes('content') ? 'Posts' : null,
                word.targets.includes('tag') ? 'Tags' : null,
                word.actorTarget === 'exclude-following'
                  ? 'excluding people you follow'
                  : 'from anyone'
              ]
                .filter(Boolean)
                .join(' · ')}
              key={word.id ?? `${word.value}-${word.expiresAt ?? ''}`}
            >
              <Button
                className='accent-tab inline-flex h-9 items-center justify-center rounded-full px-4 py-0 text-center font-bold text-accent-red hover:bg-accent-red/10'
                loading={savingKey === `muted-word-${word.id ?? word.value}`}
                onClick={(): void =>
                  void runUpdate(
                    `muted-word-${word.id ?? word.value}`,
                    () => removeSettingsMutedWord(word),
                    'Muted word removed'
                  )
                }
              >
                Remove
              </Button>
            </SettingsRow>
          ))
        ) : (
          <SettingsNotice
            title='No muted words'
            description='Add a word, phrase, or tag to reduce where it appears.'
          />
        )}
      </>
    );
  };

  const renderContentPanel = (): JSX.Element | null => {
    if (!settings) return null;

    return (
      <>
        <SectionHeading
          title='Content you see'
          description='These preferences come from app.bsky.actor.getPreferences.'
        />
        <SettingsRow
          title='Adult content'
          description='Enable adult-content handling for label preferences.'
        >
          <Toggle
            checked={settings.adultContentEnabled}
            disabled={!!savingKey}
            label='Adult content'
            onChange={(): void =>
              void runUpdate('adult-content', () =>
                setAdultContentSetting(!settings.adultContentEnabled)
              )
            }
          />
        </SettingsRow>
        <SettingsNotice
          title='Bluesky Moderation Service'
          description='Control @moderation.bsky.app labels with the same Off, Warn, and Hide rhythm as old Twitter.'
        />
        {CONTENT_LABELS.map(({ label, title, description }) => (
          <SettingsRow title={title} description={description} key={label}>
            <LabelPreferenceButtons
              value={settings.contentLabels[label]}
              disabled={!!savingKey}
              savingValue={
                savingKey?.startsWith(`label-${label}-`)
                  ? savingKey.replace(`label-${label}-`, '')
                  : null
              }
              onChange={(value): void =>
                void runUpdate(`label-${label}-${value}`, () =>
                  setContentLabelSetting(label, value)
                )
              }
            />
          </SettingsRow>
        ))}
        <SectionHeading title='Home feed' />
        <SettingsRow title='Hide replies'>
          <Toggle
            checked={settings.feedView.hideReplies}
            disabled={!!savingKey}
            label='Hide replies'
            onChange={(): void =>
              void runUpdate('feed-hide-replies', () =>
                setFeedViewSetting({
                  hideReplies: !settings.feedView.hideReplies
                })
              )
            }
          />
        </SettingsRow>
        <SettingsRow
          title='Hide replies from people you do not follow'
          description='Applies to home feed replies.'
        >
          <Toggle
            checked={settings.feedView.hideRepliesByUnfollowed}
            disabled={!!savingKey}
            label='Hide replies by unfollowed users'
            onChange={(): void =>
              void runUpdate('feed-hide-unfollowed-replies', () =>
                setFeedViewSetting({
                  hideRepliesByUnfollowed:
                    !settings.feedView.hideRepliesByUnfollowed
                })
              )
            }
          />
        </SettingsRow>
        <form onSubmit={handleReplyLikeSubmit}>
          <SettingsRow
            title='Minimum likes for replies'
            description='Replies below this like count can be hidden from home.'
          >
            <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
              <input
                className={cn(fieldClassName, 'h-9 w-24 text-sm')}
                min={0}
                max={1000}
                type='number'
                value={replyLikeCount}
                onChange={(event): void =>
                  setReplyLikeCount(Number(event.target.value))
                }
              />
              <Button
                className={compactButtonClassName}
                loading={savingKey === 'reply-like-count'}
                type='submit'
              >
                Save
              </Button>
            </div>
          </SettingsRow>
        </form>
        <SettingsRow title='Hide reposts'>
          <Toggle
            checked={settings.feedView.hideReposts}
            disabled={!!savingKey}
            label='Hide reposts'
            onChange={(): void =>
              void runUpdate('feed-hide-reposts', () =>
                setFeedViewSetting({
                  hideReposts: !settings.feedView.hideReposts
                })
              )
            }
          />
        </SettingsRow>
        <SettingsRow title='Hide quote posts'>
          <Toggle
            checked={settings.feedView.hideQuotePosts}
            disabled={!!savingKey}
            label='Hide quote posts'
            onChange={(): void =>
              void runUpdate('feed-hide-quotes', () =>
                setFeedViewSetting({
                  hideQuotePosts: !settings.feedView.hideQuotePosts
                })
              )
            }
          />
        </SettingsRow>
        <SectionHeading title='Threads' />
        <SettingsRow title='Reply sort'>
          <select
            className={cn(fieldClassName, 'h-9 bg-main-background text-sm')}
            value={settings.threadView.sort}
            onChange={(event: ChangeEvent<HTMLSelectElement>): void =>
              void runUpdate('thread-sort', () =>
                setThreadViewSetting({
                  sort: event.target.value as SettingsThreadSort
                })
              )
            }
          >
            {THREAD_SORT_OPTIONS.map(({ value, label }) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow title='Prioritize people you follow'>
          <Toggle
            checked={settings.threadView.prioritizeFollowedUsers === true}
            disabled={!!savingKey}
            label='Prioritize followed users'
            onChange={(): void =>
              void runUpdate('thread-followed', () =>
                setThreadViewSetting({
                  prioritizeFollowedUsers:
                    settings.threadView.prioritizeFollowedUsers !== true
                })
              )
            }
          />
        </SettingsRow>
        <SettingsLinkRow
          title='Interests'
          description='Choose topics used by Bluesky preferences.'
          href='/interests'
          meta={
            settings.interests.length
              ? `${settings.interests.length} selected`
              : 'Choose'
          }
        />
      </>
    );
  };

  const renderNotificationsPanel = (): JSX.Element | null => {
    if (!settings) return null;

    if (
      !settings.notifications.available ||
      !settings.notifications.preferences
    )
      return (
        <>
          <SectionHeading title='Notifications' />
          <SettingsNotice
            title='Notification preferences are unavailable'
            description={
              settings.notifications.error ??
              'The current Bluesky service did not return notification preferences.'
            }
          />
        </>
      );

    return (
      <>
        <SectionHeading
          title='Notifications'
          description='Notification preferences are read and written through the Bluesky notification API.'
        />
        {NOTIFICATION_ROWS.map(({ key, title, description }) => {
          const pref = settings.notifications.preferences?.[key];
          if (!pref) return null;

          return (
            <div
              className='border-b border-light-border px-4 py-4 dark:border-dark-border'
              key={key}
            >
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
                <div className='min-w-0'>
                  <p className='text-[15px] font-bold'>{title}</p>
                  <p className='mt-0.5 text-[13px] text-light-secondary dark:text-dark-secondary'>
                    {description}
                  </p>
                </div>
                {pref.include && (
                  <select
                    className={cn(
                      fieldClassName,
                      'h-9 bg-main-background text-sm'
                    )}
                    value={pref.include}
                    onChange={(event): void =>
                      updateNotification(key, {
                        include: event.target
                          .value as SettingsNotificationPreference['include']
                      })
                    }
                  >
                    <option value='all'>Anyone</option>
                    {key === 'chat' ? (
                      <option value='accepted'>Accepted only</option>
                    ) : (
                      <option value='follows'>People you follow</option>
                    )}
                  </select>
                )}
              </div>
              <div className='mt-4 flex flex-wrap gap-x-6 gap-y-3'>
                <label className='flex items-center gap-3 text-sm font-bold'>
                  <Toggle
                    checked={pref.list}
                    disabled={!!savingKey}
                    label={`${title} in-app notifications`}
                    onChange={(): void =>
                      updateNotification(key, { list: !pref.list })
                    }
                  />
                  In-app
                </label>
                <label className='flex items-center gap-3 text-sm font-bold'>
                  <Toggle
                    checked={pref.push}
                    disabled={!!savingKey}
                    label={`${title} push notifications`}
                    onChange={(): void =>
                      updateNotification(key, { push: !pref.push })
                    }
                  />
                  Push
                </label>
              </div>
            </div>
          );
        })}
      </>
    );
  };

  const renderDisplayPanel = (): JSX.Element => (
    <>
      <SectionHeading
        title='Accessibility, display, and languages'
        description='Bluesky does not expose these Not Twitter display choices as account settings here, so this section uses the clone’s local display controls.'
      />
      <SettingsRow
        title='Display'
        description='Change color, background, and font sizing for this browser.'
      >
        <Button
          className='accent-tab inline-flex h-10 items-center justify-center rounded-full border border-light-border px-4 py-0 text-center font-bold dark:border-dark-border'
          onClick={displayModal.openModal}
        >
          Open display
        </Button>
      </SettingsRow>
      <SettingsRow
        title='Hide .bsky.social suffixes'
        description='Shorten only generic Bluesky handles in visible usernames.'
      >
        <Toggle
          checked={hideBskySocialSuffix}
          label='Hide .bsky.social suffixes'
          onChange={toggleHideBskySocialSuffix}
        />
      </SettingsRow>
      <SettingsRow
        title='Standard.site articles'
        description='Show supported Standard.site links as inline article readers.'
      >
        <Toggle
          checked={standardSiteArticlesInline}
          label='Inline Standard.site articles'
          onChange={toggleStandardSiteArticlesInline}
        />
      </SettingsRow>
    </>
  );

  const renderPanel = (): JSX.Element => {
    if (error)
      return (
        <SettingsError error={error} onRetry={(): void => void mutate()} />
      );

    if (!settings)
      return (
        <div className='py-8'>
          <Loading />
        </div>
      );

    switch (activeSection) {
      case 'account':
        return renderAccountPanel() as JSX.Element;
      case 'security':
        return renderSecurityPanel() as JSX.Element;
      case 'privacy':
        return renderPrivacyPanel() as JSX.Element;
      case 'content':
        return renderContentPanel() as JSX.Element;
      case 'notifications':
        return renderNotificationsPanel() as JSX.Element;
      case 'display':
        return renderDisplayPanel();
    }
  };

  const showNavigation = !isMobile || !mobileDetailOpen;
  const showPanel = !isMobile || mobileDetailOpen;

  return (
    <>
      <SEO title='Settings / Not Twitter' />
      <Modal
        modalClassName='max-w-xl bg-main-background w-full p-8 rounded-2xl hover-animation'
        open={displayModal.open}
        closeModal={displayModal.closeModal}
      >
        <DisplayModal closeModal={displayModal.closeModal} />
      </Modal>
      <main className='flex min-h-screen w-full max-w-[990px] border-x border-light-border dark:border-dark-border'>
        {showNavigation && (
          <SettingsNavigation
            activeSection={activeSection}
            onSelect={handleSectionSelect}
          />
        )}
        {showPanel && (
          <section className='min-h-screen w-full border-l border-light-border dark:border-dark-border xs:flex-1'>
            <SettingsPanelHeader
              title={activeTitle}
              showBack={isMobile}
              onBack={(): void => setMobileDetailOpen(false)}
            />
            {renderPanel()}
          </section>
        )}
      </main>
    </>
  );
}

Settings.getLayout = (page: ReactElement<any>): ReactNode => (
  <ProtectedLayout>
    <MainLayout>{page}</MainLayout>
  </ProtectedLayout>
);
