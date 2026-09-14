import { NextImage } from '@components/ui/next-image';
import { HeroIcon, type IconName } from '@components/ui/hero-icon';
import type { ReactNode, JSX } from 'react';

type UserProfileResourceRowProps = {
  href: string;
  title: string;
  subtitle: string;
  description?: string | null;
  footer?: string | null;
  imageUrl?: string | null;
  imageAlt: string;
  fallbackIcon: IconName;
  badge?: ReactNode;
};

export function UserProfileResourceRow({
  href,
  title,
  subtitle,
  description,
  footer,
  imageUrl,
  imageAlt,
  fallbackIcon,
  badge
}: UserProfileResourceRowProps): JSX.Element {
  return (
    <a
      className='accent-tab hover-card flex gap-3 border-b border-light-border px-4 py-3
                 outline-none dark:border-dark-border'
      href={href}
      target='_blank'
      rel='noreferrer'
    >
      {imageUrl ? (
        <NextImage
          className='h-14 w-14 shrink-0 overflow-hidden rounded-xl'
          imgClassName='rounded-xl'
          src={imageUrl}
          alt={imageAlt}
          width={56}
          height={56}
          useSkeleton
        />
      ) : (
        <span
          className='flex h-14 w-14 shrink-0 items-center justify-center rounded-xl
                     bg-main-accent/10 text-main-accent'
          aria-hidden='true'
        >
          <HeroIcon className='h-7 w-7' iconName={fallbackIcon} />
        </span>
      )}
      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='truncate text-[15px] font-bold leading-5'>{title}</p>
            <p className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
              {subtitle}
            </p>
          </div>
          {badge}
        </div>
        {description && (
          <p className='mt-1 max-h-10 overflow-hidden text-[15px] leading-5'>
            {description}
          </p>
        )}
        {footer && (
          <p className='mt-2 truncate text-sm text-light-secondary dark:text-dark-secondary'>
            {footer}
          </p>
        )}
      </div>
    </a>
  );
}
