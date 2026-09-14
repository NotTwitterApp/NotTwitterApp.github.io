import { useState, type JSX } from 'react';
import cn from 'clsx';
import {
  undoTweetKinds,
  undoTweetIntervals,
  useUndoTweetSettings,
  type UndoTweetInterval,
  type UndoTweetKind
} from '@lib/hooks/use-undo-tweet-settings';
import {
  readerTextSizes,
  useNotTwitterBlueSettings,
  type NotTwitterBlueSettings
} from '@lib/hooks/use-not-twitter-blue-settings';
import { Button } from '@components/ui/button';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon } from '@components/ui/hero-icon';

const undoTweetKindLabels: Record<
  UndoTweetKind,
  { title: string; description: string }
> = {
  tweet: {
    title: 'Original Tweets',
    description: 'New Tweets that are not replies.'
  },
  reply: {
    title: 'Replies',
    description: 'Replies to existing Tweets.'
  },
  quote: {
    title: 'Quote Tweets',
    description: 'Tweets that quote another Tweet.'
  },
  thread: {
    title: 'Threads',
    description: 'Multiple Tweets sent together.'
  }
};

const readerTextSizeLabels: Record<
  NotTwitterBlueSettings['readerTextSize'],
  string
> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large'
};

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
        `flex h-[31px] w-[51px] shrink-0 items-center rounded-full px-0.5 transition
         focus-visible:outline focus-visible:outline-2 focus-visible:outline-main-accent`,
        checked ? 'bg-main-accent' : 'bg-light-border dark:bg-dark-border',
        disabled && 'cursor-not-allowed opacity-60'
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
          'h-[27px] w-[27px] rounded-full bg-white shadow transition',
          checked && 'translate-x-5'
        )}
      />
    </button>
  );
}

function SettingsRow({
  title,
  description,
  icon,
  children,
  onClick
}: {
  title: string;
  description?: string;
  icon?: JSX.Element;
  children?: JSX.Element;
  onClick?: () => void;
}): JSX.Element {
  const content = (
    <>
      {icon && (
        <div className='mt-0.5 flex h-9 w-[58px] shrink-0 items-center justify-center text-light-secondary dark:text-dark-secondary'>
          {icon}
        </div>
      )}
      <div className='min-w-0 flex-1'>
        <p className='text-[17px] font-bold leading-5'>{title}</p>
        {description && (
          <p className='mt-1 max-w-[520px] text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
            {description}
          </p>
        )}
      </div>
      {children ?? (
        <CustomIcon
          className='h-6 w-6 shrink-0 text-light-secondary dark:text-dark-secondary'
          iconName='TwitterChevronRightIcon'
        />
      )}
    </>
  );

  if (onClick)
    return (
      <button
        className='flex w-full gap-3 border-b border-light-border px-4 py-[22px]
                   text-left transition hover:bg-light-primary/5 active:bg-light-primary/10
                   dark:border-dark-border dark:hover:bg-dark-primary/5 dark:active:bg-dark-primary/10'
        type='button'
        onClick={onClick}
      >
        {content}
      </button>
    );

  return (
    <div className='flex gap-3 border-b border-light-border px-4 py-[22px] dark:border-dark-border'>
      {content}
    </div>
  );
}

function NotTwitterBlueLanding({
  openUndoTweet
}: {
  openUndoTweet: () => void;
}): JSX.Element {
  const { notTwitterBlueSettings, setReaderModeEnabled, setReaderTextSize } =
    useNotTwitterBlueSettings();

  return (
    <>
      <header className='flex h-[53px] items-center border-b border-light-border px-4 dark:border-dark-border'>
        <h2 className='text-[23px] font-extrabold leading-7'>
          Not Twitter Blue
        </h2>
      </header>
      <section>
        <h3 className='px-4 pt-6 pb-3 text-[25px] font-extrabold leading-8'>
          Feature Settings
        </h3>
        <SettingsRow
          title='Undo Tweet'
          description='Select which types of Tweets you want to undo before they’re public, plus the length of your undo period.'
          icon={<CustomIcon className='h-8 w-8' iconName='TwitterUndoIcon' />}
          onClick={openUndoTweet}
        />
        <SettingsRow
          title='Reader Mode'
          description='Turn long Tweet threads into a continuous reading view.'
          icon={<HeroIcon className='h-8 w-8' iconName='BookOpenIcon' />}
        >
          <Toggle
            checked={notTwitterBlueSettings.readerMode}
            label='Reader Mode'
            onChange={(): void =>
              setReaderModeEnabled(!notTwitterBlueSettings.readerMode)
            }
          />
        </SettingsRow>
        <SettingsRow
          title='Reader text size'
          description='Choose the text size used while reading threads.'
          icon={
            <span className='text-[24px] font-extrabold leading-8'>Aa</span>
          }
        >
          <div
            className='flex shrink-0 rounded-full border border-light-border p-0.5
                       dark:border-dark-border'
          >
            {readerTextSizes.map((size) => (
              <Button
                className={cn(
                  `rounded-full px-3 py-1.5 text-[14px] font-bold leading-5
                   transition`,
                  notTwitterBlueSettings.readerTextSize === size
                    ? 'bg-main-accent text-white'
                    : `text-light-secondary hover:bg-light-primary/5
                       active:bg-light-primary/10 dark:text-dark-secondary
                       dark:hover:bg-dark-primary/5 dark:active:bg-dark-primary/10`
                )}
                type='button'
                onClick={(): void => setReaderTextSize(size)}
                key={size}
              >
                {readerTextSizeLabels[size]}
              </Button>
            ))}
          </div>
        </SettingsRow>
      </section>
    </>
  );
}

function UndoTweetDetail({
  closeDetail
}: {
  closeDetail: () => void;
}): JSX.Element {
  const {
    undoTweetSettings,
    setUndoTweetEnabled,
    setUndoTweetIntervalSeconds,
    setUndoTweetKindEnabled
  } = useUndoTweetSettings();

  return (
    <>
      <header className='grid h-[53px] grid-cols-[48px,1fr,48px] items-center border-b border-light-border px-1 dark:border-dark-border'>
        <Button
          className='dark-bg-tab group relative ml-2 h-9 w-9 rounded-full p-0
                     hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          onClick={closeDetail}
          aria-label='Back'
        >
          <HeroIcon className='h-5 w-5' iconName='ArrowLeftIcon' />
        </Button>
        <h2 className='truncate text-center text-xl font-extrabold'>
          Undo Tweet
        </h2>
        <span aria-hidden='true' />
      </header>
      <section className='border-b border-light-border px-4 py-4 dark:border-dark-border'>
        <p className='text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
          Select which types of Tweets you want to undo before they’re public,
          plus the length of your undo period.
        </p>
      </section>
      <SettingsRow
        title='Undo Tweet'
        description='Set a timer to undo sent Tweets, and choose which kinds of Tweets you want to undo.'
      >
        <Toggle
          checked={undoTweetSettings.enabled}
          label='Undo Tweet'
          onChange={(): void => setUndoTweetEnabled(!undoTweetSettings.enabled)}
        />
      </SettingsRow>
      <section className='border-b border-light-border px-4 py-4 dark:border-dark-border'>
        <p className='text-[15px] font-bold leading-5'>Undo Tweet timing</p>
        <div className='mt-3 grid grid-cols-5 overflow-hidden rounded-full border border-light-border p-0.5 dark:border-dark-border'>
          {undoTweetIntervals.map((intervalSeconds) => {
            const selected =
              undoTweetSettings.intervalSeconds === intervalSeconds;

            return (
              <Button
                className={cn(
                  'h-9 rounded-full px-2 text-sm font-bold transition',
                  selected
                    ? 'bg-main-accent text-white'
                    : 'text-main-primary hover:bg-light-primary/10 dark:hover:bg-dark-primary/10',
                  !undoTweetSettings.enabled && 'cursor-not-allowed opacity-60'
                )}
                disabled={!undoTweetSettings.enabled}
                onClick={(): void =>
                  setUndoTweetIntervalSeconds(
                    intervalSeconds as UndoTweetInterval
                  )
                }
                key={intervalSeconds}
              >
                {intervalSeconds}s
              </Button>
            );
          })}
        </div>
      </section>
      {undoTweetKinds.map((kind) => {
        const { title, description } = undoTweetKindLabels[kind];

        return (
          <SettingsRow title={title} description={description} key={kind}>
            <Toggle
              checked={undoTweetSettings.kinds[kind]}
              disabled={!undoTweetSettings.enabled}
              label={`${title} Undo Tweet`}
              onChange={(): void =>
                setUndoTweetKindEnabled(kind, !undoTweetSettings.kinds[kind])
              }
            />
          </SettingsRow>
        );
      })}
      <SettingsRow title='View Tweet after sending'>
        <Toggle
          checked
          disabled
          label='View Tweet after sending'
          onChange={(): void => undefined}
        />
      </SettingsRow>
    </>
  );
}

export function NotTwitterBluePanel(): JSX.Element {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div className='min-h-screen bg-main-background'>
      {detailOpen ? (
        <UndoTweetDetail closeDetail={(): void => setDetailOpen(false)} />
      ) : (
        <NotTwitterBlueLanding
          openUndoTweet={(): void => setDetailOpen(true)}
        />
      )}
    </div>
  );
}
