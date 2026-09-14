import { formatAtprotoHandleForDisplay } from '@lib/atproto/identity';
import { useTheme } from '@lib/context/theme-context';
import { useStandardSiteArticlesInline } from '@lib/hooks/use-standard-site-articles-inline';
import { InputAccentRadio } from '@components/input/input-accent-radio';
import { InputThemeRadio } from '@components/input/input-theme-radio';
import { Button } from '@components/ui/button';
import { UserAvatar } from '@components/user/user-avatar';
import { UserName } from '@components/user/user-name';
import type { ChangeEvent, JSX } from 'react';
import type { Theme, Accent, FontSize } from '@lib/types/theme';

type DisplayModalProps = {
  closeModal: () => void;
};

type DisplayToggleProps = {
  checked: boolean;
  description: string;
  label: string;
  onClick: () => void;
};

const themes: Readonly<[Theme, string][]> = [
  ['light', 'Default'],
  ['dim', 'Dim'],
  ['dark', 'Lights out']
];

const accentsColor: Readonly<Accent[]> = [
  'blue',
  'yellow',
  'pink',
  'purple',
  'orange',
  'green'
];

const fontSizeSteps: Readonly<FontSize[]> = ['xs', 'sm', 'md', 'lg', 'xl'];

function DisplayToggle({
  checked,
  description,
  label,
  onClick
}: DisplayToggleProps): JSX.Element {
  return (
    <button
      className='hover-animation flex w-full items-center justify-between gap-4 rounded-2xl
                 bg-main-sidebar-background px-4 py-3 text-left'
      type='button'
      role='switch'
      aria-checked={checked}
      onClick={onClick}
    >
      <span className='min-w-0'>
        <span className='block font-bold'>{label}</span>
        <span className='block text-sm leading-5 text-light-secondary dark:text-dark-secondary'>
          {description}
        </span>
      </span>
      <span
        className={`flex h-8 w-14 shrink-0 items-center rounded-full px-1 transition
                    ${
                      checked
                        ? 'bg-main-accent'
                        : 'bg-light-border dark:bg-dark-border'
                    }`}
        aria-hidden='true'
      >
        <span
          className={`h-6 w-6 rounded-full bg-white shadow transition
                      ${checked ? 'translate-x-6' : ''}`}
        />
      </span>
    </button>
  );
}

function DisplayFontSizeControl(): JSX.Element {
  const { fontSize, changeFontSize } = useTheme();
  const activeIndex = Math.max(0, fontSizeSteps.indexOf(fontSize));
  const progress = `${(activeIndex / (fontSizeSteps.length - 1)) * 100}%`;

  const handleFontSizeChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => {
    const nextFontSize = fontSizeSteps[Number(value)];

    if (nextFontSize) changeFontSize(nextFontSize);
  };

  return (
    <div className='flex w-full flex-col gap-1'>
      <label
        className='text-sm font-bold text-light-secondary dark:text-dark-secondary'
        htmlFor='display-font-size'
      >
        Font size
      </label>
      <div className='hover-animation rounded-2xl bg-main-sidebar-background px-4 py-4'>
        <div className='flex items-center gap-4'>
          <span className='shrink-0 text-sm font-bold leading-none'>Aa</span>
          <div className='relative h-8 flex-1'>
            <div
              className='absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full
                         bg-light-border dark:bg-dark-border'
              aria-hidden='true'
            >
              <span
                className='block h-full rounded-full bg-main-accent'
                style={{ width: progress }}
              />
            </div>
            <div
              className='pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2
                         justify-between'
              aria-hidden='true'
            >
              {fontSizeSteps.map((step, index) => (
                <span
                  className={`h-3 w-3 rounded-full border-2 border-main-sidebar-background
                              ${
                                index <= activeIndex
                                  ? 'bg-main-accent'
                                  : 'bg-light-line-reply dark:bg-dark-border'
                              }`}
                  key={step}
                />
              ))}
            </div>
            <input
              className='absolute inset-0 h-full w-full cursor-pointer opacity-0'
              id='display-font-size'
              type='range'
              min={0}
              max={fontSizeSteps.length - 1}
              step={1}
              value={activeIndex}
              onChange={handleFontSizeChange}
            />
          </div>
          <span className='shrink-0 text-xl font-bold leading-none'>Aa</span>
        </div>
      </div>
    </div>
  );
}

export function DisplayModal({ closeModal }: DisplayModalProps): JSX.Element {
  const {
    hideBskySocialSuffix,
    squareProfilePictures,
    toggleHideBskySocialSuffix,
    toggleSquareProfilePictures
  } = useTheme();
  const { standardSiteArticlesInline, toggleStandardSiteArticlesInline } =
    useStandardSiteArticlesInline();
  const previewUsername = formatAtprotoHandleForDisplay(
    'nottwitter.bsky.social',
    hideBskySocialSuffix
  );

  return (
    <div className='flex flex-col items-center gap-6'>
      <div className='flex flex-col gap-3 text-center'>
        <h2 className='text-2xl font-bold'>Customize your view</h2>
        <p className='text-light-secondary dark:text-dark-secondary'>
          These settings affect all the Not Twitter accounts on this browser.
        </p>
      </div>
      <article
        className='hover-animation mx-8 rounded-2xl border 
                   border-light-border px-4 py-3 dark:border-dark-border'
      >
        <div className='grid grid-cols-[auto,1fr] gap-3'>
          <UserAvatar src='/assets/twitter-avatar.jpg' alt='Not Twitter' />
          <div>
            <div className='flex gap-1'>
              <UserName verified name='Not Twitter' />
              <p className='text-light-secondary dark:text-dark-secondary'>
                @{previewUsername}
              </p>
              <div className='flex gap-1 text-light-secondary dark:text-dark-secondary'>
                <i>·</i>
                <p>26m</p>
              </div>
            </div>
            <p className='tweet-display-font-size whitespace-pre-line break-words'>
              At the heart of Not Twitter are short messages called Tweets —
              just like this one — which can include photos, videos, links,
              text, hashtags, and mentions.
            </p>
          </div>
        </div>
      </article>
      <DisplayFontSizeControl />
      <div className='flex w-full flex-col gap-1'>
        <p className='text-sm font-bold text-light-secondary dark:text-dark-secondary'>
          Visual tweaks
        </p>
        <div className='flex flex-col gap-2'>
          <DisplayToggle
            checked={hideBskySocialSuffix}
            label='Hide .bsky.social suffixes'
            description='Only generic Bluesky handles are shortened.'
            onClick={toggleHideBskySocialSuffix}
          />
          <DisplayToggle
            checked={squareProfilePictures}
            label='Squared profile pictures'
            description='Use rounded corners instead of circles.'
            onClick={toggleSquareProfilePictures}
          />
          <DisplayToggle
            checked={standardSiteArticlesInline}
            label='Inline Standard.site articles'
            description='Show supported links as inline article readers in Tweets.'
            onClick={toggleStandardSiteArticlesInline}
          />
        </div>
      </div>
      <div className='flex w-full flex-col gap-1'>
        <p className='text-sm font-bold text-light-secondary dark:text-dark-secondary'>
          Color
        </p>
        <div
          className='hover-animation grid grid-cols-3 grid-rows-2 justify-items-center gap-3 
                     rounded-2xl bg-main-sidebar-background py-3 xs:grid-cols-6 xs:grid-rows-none'
        >
          {accentsColor.map((accentColor) => (
            <InputAccentRadio type={accentColor} key={accentColor} />
          ))}
        </div>
      </div>
      <div className='flex w-full flex-col gap-1'>
        <p className='text-sm font-bold text-light-secondary dark:text-dark-secondary'>
          Background
        </p>
        <div
          className='hover-animation grid grid-rows-3 gap-3 overflow-visible rounded-2xl
                     bg-main-sidebar-background px-4 pb-5 pt-3 xs:grid-cols-3
                     xs:grid-rows-none'
        >
          {themes.map(([themeType, label]) => (
            <InputThemeRadio type={themeType} label={label} key={themeType} />
          ))}
        </div>
      </div>
      <Button
        className='bg-main-accent px-4 py-1.5 font-bold
                   text-white hover:bg-main-accent/90 active:bg-main-accent/75'
        onClick={closeModal}
      >
        Done
      </Button>
    </div>
  );
}
