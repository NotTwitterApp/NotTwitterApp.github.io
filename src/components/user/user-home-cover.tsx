import { useModal } from '@lib/hooks/useModal';
import { Button } from '@components/ui/button';
import { NextImage } from '@components/ui/next-image';
import { Modal } from '@components/modal/modal';
import { ImageModal } from '@components/modal/image-modal';
import type { ImageData } from '@lib/types/file';

import type { JSX } from 'react';

type UserHomeCoverProps = {
  coverData?: ImageData | null;
};

export function UserHomeCover({ coverData }: UserHomeCoverProps): JSX.Element {
  const { open, openModal, closeModal } = useModal();

  return (
    <div className='aspect-[3/1] w-full'>
      <Modal
        className='!overflow-hidden !p-0'
        modalClassName='h-screen w-screen'
        open={open}
        closeModal={closeModal}
        closePanelOnClick
      >
        <ImageModal
          imageData={coverData as ImageData}
          previewCount={1}
          profileMediaKind='cover'
          closeModal={closeModal}
        />
      </Modal>
      {coverData ? (
        <Button
          className='accent-tab group relative h-full w-full rounded-none p-0 transition-colors'
          onClick={openModal}
        >
          <NextImage
            useSkeleton
            priority
            className='relative h-full w-full'
            fill
            imgClassName='object-cover'
            src={coverData.src}
            alt={coverData.alt}
            key={coverData.src}
          />
          <span className='pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10' />
        </Button>
      ) : (
        <div className='h-full bg-light-line-reply dark:bg-dark-line-reply' />
      )}
    </div>
  );
}
