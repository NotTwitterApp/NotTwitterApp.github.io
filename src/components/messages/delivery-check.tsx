import cn from 'clsx';
import type { JSX } from 'react';
import type { MessageDeliveryStatus } from '@lib/message-delivery';
import { CustomIcon } from '@components/ui/custom-icon';

type DeliveryCheckProps = {
  status: MessageDeliveryStatus;
};

export function DeliveryCheck({ status }: DeliveryCheckProps): JSX.Element {
  const read = status === 'read';
  const label = { sent: 'Sent', delivered: 'Delivered', read: 'Read' }[status];

  return (
    <span
      aria-label={label}
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center leading-none',
        read
          ? 'text-accent-blue'
          : 'text-light-secondary dark:text-dark-secondary'
      )}
      role='img'
      title={label}
    >
      <CustomIcon
        className='h-4 w-4'
        iconName={
          status === 'sent' ? 'TwitterCheckIcon' : 'TwitterDoubleCheckIcon'
        }
      />
    </span>
  );
}
