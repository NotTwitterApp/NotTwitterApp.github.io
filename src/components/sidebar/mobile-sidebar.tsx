import { useAuth } from '@lib/context/auth-context';
import { useWindow } from '@lib/context/window-context';
import { useModal } from '@lib/hooks/useModal';
import { Button } from '@components/ui/button';
import { Modal } from '@components/modal/modal';
import { MobileSidebarModal } from '@components/modal/mobile-sidebar-modal';
import { UserAvatar } from '@components/user/user-avatar';
import type { Variants } from 'framer-motion';
import type { User } from '@lib/types/user';

import type { JSX } from 'react';

const variant: Variants = {
  initial: { x: '-100%', opacity: 1 },
  animate: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.2, ease: 'easeOut' }
  },
  exit: {
    x: '-100%',
    opacity: 1,
    transition: { duration: 0.15, ease: 'easeOut' }
  }
};

export function MobileSidebar(): JSX.Element {
  const { user } = useAuth();
  const { isMobile } = useWindow();

  const { photoURL, name } = user as User;

  const { open, openModal, closeModal } = useModal();

  return (
    <>
      <Modal
        className='!p-0'
        modalAnimation={variant}
        modalClassName='h-screen w-[280px] max-w-[80vw] overflow-hidden border-r border-light-border bg-main-background dark:border-dark-border'
        open={open}
        closeModal={closeModal}
      >
        <MobileSidebarModal {...(user as User)} closeModal={closeModal} />
      </Modal>
      {isMobile && (
        <Button className='accent-tab p-0' onClick={openModal}>
          <UserAvatar src={photoURL} alt={name} size={30} />
        </Button>
      )}
    </>
  );
}
