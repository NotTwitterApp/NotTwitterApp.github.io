import cn from 'clsx';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { MobileSidebar } from '@components/sidebar/mobile-sidebar';
import type { ReactNode, JSX } from 'react';
import type { IconName } from '@components/ui/hero-icon';

type HomeHeaderProps = {
  tip?: string;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  iconName?: IconName;
  className?: string;
  disableSticky?: boolean;
  useActionButton?: boolean;
  useMobileSidebar?: boolean;
  action?: () => void;
};

export function MainHeader({
  tip,
  title,
  subtitle,
  children,
  iconName,
  className,
  disableSticky,
  useActionButton,
  useMobileSidebar,
  action
}: HomeHeaderProps): JSX.Element {
  return (
    <header
      className={cn(
        'hover-animation even z-10 bg-main-background/60 px-4 py-2 backdrop-blur-md',
        !disableSticky && 'sticky top-0',
        className ?? 'flex items-center gap-6'
      )}
    >
      {useActionButton && (
        <Button
          className='dark-bg-tab group relative p-2 hover:bg-light-primary/10 active:bg-light-primary/20 
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          onClick={action}
          aria-label={tip ?? 'Back'}
        >
          <HeroIcon
            className='h-5 w-5'
            iconName={iconName ?? 'ArrowLeftIcon'}
          />
          <ToolTip tip={tip ?? 'Back'} />
        </Button>
      )}
      {title && (
        <div className='flex min-w-0 items-center gap-8'>
          {useMobileSidebar && <MobileSidebar />}
          <div className='min-w-0'>
            <h2
              className={cn(
                'truncate text-xl font-bold',
                subtitle && 'leading-6'
              )}
              key={title}
            >
              {title}
            </h2>
            {subtitle && (
              <p className='-mt-0.5 truncate text-[13px] font-bold leading-4 text-light-secondary dark:text-dark-secondary'>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}
      {children}
    </header>
  );
}
