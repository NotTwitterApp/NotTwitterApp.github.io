import { useState, type JSX } from 'react';
import cn from 'clsx';
import { preventBubbling } from '@lib/utils';
import { AppIcon } from '@components/ui/app-icon';
import { ToolTip } from '@components/ui/tooltip';
import { NumberStats } from './number-stats';
import {
  TweetActionEffect,
  type TweetActionEffectKind
} from './tweet-action-effect';
import type { AppIconName } from '@components/ui/app-icon';

type TweetOption = {
  tip: string;
  move?: number;
  stats?: number;
  iconName: AppIconName;
  disabled?: boolean;
  className: string;
  active?: boolean;
  viewTweet?: boolean;
  iconClassName: string;
  iconSizeClassName?: string;
  actionEffect?: TweetActionEffectKind;
  onClick?: (...args: unknown[]) => unknown;
};

export function TweetOption({
  tip,
  move,
  stats,
  disabled,
  iconName,
  className,
  active,
  viewTweet,
  iconClassName,
  iconSizeClassName,
  actionEffect,
  onClick
}: TweetOption): JSX.Element {
  const [effectPlayKey, setEffectPlayKey] = useState(0);
  const iconClass =
    iconSizeClassName ??
    (viewTweet ? 'h-[22.5px] w-[22.5px]' : 'h-[18.75px] w-[18.75px]');

  const handleClick = (): void => {
    if (actionEffect === 'like' && !active)
      setEffectPlayKey((currentKey) => currentKey + 1);

    if (onClick) void onClick();
  };

  return (
    <button
      className={cn(
        `tweet-action-button group flex items-center p-0 transition-colors duration-200 ease-out
         disabled:cursor-not-allowed inner:transition-colors inner:duration-200 inner:ease-out`,
        disabled && 'cursor-not-allowed',
        className
      )}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={preventBubbling(handleClick)}
    >
      <i
        className={cn(
          `tweet-action-icon-shell relative rounded-full not-italic
           group-focus-visible:ring-2`,
          viewTweet
            ? 'tweet-action-icon-shell--large'
            : 'tweet-action-icon-shell--normal',
          iconClassName
        )}
      >
        {actionEffect ? (
          <TweetActionEffect
            kind={actionEffect}
            active={active}
            playKey={effectPlayKey}
          >
            <AppIcon className={iconClass} iconName={iconName} />
          </TweetActionEffect>
        ) : (
          <AppIcon className={iconClass} iconName={iconName} />
        )}
        <ToolTip tip={tip} />
      </i>
      {!viewTweet && (
        <NumberStats
          className='tweet-action-count-text min-w-[10px] text-left text-[13px] leading-4'
          containerClassName='tweet-action-count -ml-1.5'
          move={move as number}
          stats={stats as number}
        />
      )}
    </button>
  );
}
