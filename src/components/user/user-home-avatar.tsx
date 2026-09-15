import { useModal } from '@lib/hooks/useModal';
import { Button } from '@components/ui/button';
import { NextImage } from '@components/ui/next-image';
import { Modal } from '@components/modal/modal';
import { ImageModal } from '@components/modal/image-modal';
import type { ImageData } from '@lib/types/file';

import type { JSX } from 'react';

type UserHomeAvatarProps = {
  profileData?: ImageData | null;
};

export function UserHomeAvatar({
  profileData
}: UserHomeAvatarProps): JSX.Element {
  const { open, openModal, closeModal } = useModal();

  return (
    <div className='mb-8 xs:mb-14 sm:mb-16'>
      <Modal
        className='!overflow-hidden !p-0'
        modalClassName='h-screen w-screen'
        open={open}
        closeModal={closeModal}
        closePanelOnClick
      >
        <ImageModal
          imageData={
            { src: profileData?.src, alt: profileData?.alt } as ImageData
          }
          previewCount={1}
          profileMediaKind='avatar'
          closeModal={closeModal}
        />
      </Modal>
      <Button
        className='accent-tab profile-picture-frame group absolute -mt-3 aspect-square w-24 -translate-y-1/2 overflow-hidden border-4 border-main-background bg-main-background p-0
                   disabled:cursor-auto disabled:opacity-100 xs:w-32 sm:w-36'
        onClick={openModal}
        disabled={!profileData}
      >
        {profileData ? (
          <NextImage
            useSkeleton
            className='profile-picture hover-animation relative h-full w-full overflow-hidden bg-main-background'
            imgClassName='profile-picture'
            src={profileData.src}
            alt={profileData.alt}
            fill
            key={profileData.src}
          />
        ) : (
          <div className='profile-picture h-full bg-main-sidebar-background' />
        )}
        <span className='pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10' />
      </Button>
    </div>
  );
}
