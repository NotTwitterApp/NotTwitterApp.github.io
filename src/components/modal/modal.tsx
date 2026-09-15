import { motion } from 'framer-motion';
import { Dialog } from '@headlessui/react';
import cn from 'clsx';
import type { MouseEvent, ReactNode, JSX } from 'react';
import type { Variants } from 'framer-motion';

type ModalProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
  modalAnimation?: Variants;
  modalClassName?: string;
  closePanelOnClick?: boolean;
  closeModal: () => void;
};

const variants: Variants[] = [
  {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: 0.15, ease: 'easeOut' }
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.1, ease: 'easeOut' }
    }
  }
];

export const [backdrop, modal] = variants;

function stopModalClickPropagation(event: MouseEvent<HTMLDivElement>): void {
  event.stopPropagation();
}

export function Modal({
  open,
  children,
  className,
  modalAnimation,
  modalClassName,
  closePanelOnClick,
  closeModal
}: ModalProps): JSX.Element {
  // The dialog owns closing and focus cleanup. Composer animations can remount
  // during send completion and must not keep an invisible dialog alive.
  return (
    <Dialog
      transition
      className='relative z-50 transition-opacity duration-100 data-closed:opacity-0'
      open={open}
      onClose={closeModal}
    >
      <motion.div
        className='hover-animation fixed inset-0 bg-black/40 dark:bg-[#5B7083]/40'
        aria-hidden='true'
        onClick={stopModalClickPropagation}
        {...backdrop}
      />
      <div
        className={cn(
          'fixed inset-0 overflow-y-auto p-4',
          className ?? 'flex items-center justify-center'
        )}
        onClick={stopModalClickPropagation}
      >
        <Dialog.Panel
          className={modalClassName}
          as={motion.div}
          {...(modalAnimation ?? modal)}
          onClick={closePanelOnClick ? closeModal : undefined}
        >
          {children}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
