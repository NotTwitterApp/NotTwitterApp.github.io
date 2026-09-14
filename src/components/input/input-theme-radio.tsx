import cn from 'clsx';
import { useTheme } from '@lib/context/theme-context';
import { HeroIcon } from '@components/ui/hero-icon';
import type { Theme } from '@lib/types/theme';

import type { JSX } from 'react';

type InputThemeRadioProps = {
  type: Theme;
  label: string;
};

type InputThemeData = Record<
  Theme,
  {
    textColor: string;
    backgroundColor: string;
    iconBorderColor: string;
    hoverBackgroundColor: string;
  }
>;

const inputThemeData: Readonly<InputThemeData> = {
  light: {
    textColor: 'text-black',
    backgroundColor: 'bg-white',
    iconBorderColor: 'border-[#B9CAD3]',
    hoverBackgroundColor:
      '[&:hover>div]:bg-light-secondary/10 [&:active>div]:bg-light-secondary/20'
  },
  dim: {
    textColor: 'text-[#F7F9F9]',
    backgroundColor: 'bg-[#15202B]',
    iconBorderColor: 'border-[#5C6E7E]',
    hoverBackgroundColor:
      '[&:hover>div]:bg-light-secondary/10 [&:active>div]:bg-light-secondary/20'
  },
  dark: {
    textColor: 'text-dark-primary',
    backgroundColor: 'bg-black',
    iconBorderColor: 'border-[#3E4144]',
    hoverBackgroundColor:
      '[&:hover>div]:bg-dark-primary/10 [&:active>div]:bg-dark-primary/20'
  }
};

export function InputThemeRadio({
  type,
  label
}: InputThemeRadioProps): JSX.Element {
  const { theme, changeTheme } = useTheme();

  const { textColor, backgroundColor, iconBorderColor, hoverBackgroundColor } =
    inputThemeData[type];

  const isChecked = type == theme;

  return (
    <label
      className={cn(
        `relative flex min-h-[72px] cursor-pointer items-center gap-2 overflow-visible rounded-xl
         border border-light-border/70 p-3 pb-4 font-bold ring-main-accent ring-offset-2
         ring-offset-main-sidebar-background transition duration-200
         dark:border-dark-border/70 [&:has(div>input:checked)]:border-main-accent
         [&:has(div>input:checked)]:ring-2`,
        textColor,
        backgroundColor,
        hoverBackgroundColor
      )}
      htmlFor={type}
    >
      <div className='hover-animation flex h-10 w-10 shrink-0 items-center justify-center rounded-full'>
        <input
          className='peer absolute h-0 w-0 opacity-0'
          id={type}
          type='radio'
          name='theme'
          value={type}
          checked={isChecked}
          onChange={changeTheme}
        />
        <i
          className={cn(
            `relative z-10 flex h-5 w-5 items-center justify-center rounded-full
             border-2 border-[#B9CAD3] text-white transition
             duration-200 peer-checked:border-transparent
             peer-checked:bg-main-accent peer-checked:inner:opacity-100`,
            iconBorderColor
          )}
        >
          <HeroIcon
            className='h-full w-full p-0.5 opacity-0 transition-opacity duration-200'
            iconName='CheckIcon'
          />
        </i>
      </div>
      {label}
    </label>
  );
}
