import { useRef, type JSX } from 'react';
import cn from 'clsx';
import { MainHeader } from '@components/home/main-header';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { NextImage } from '@components/ui/next-image';
import { ToolTip } from '@components/ui/tooltip';
import type { ReactNode, ChangeEvent } from 'react';
import type { User } from '@lib/types/user';

type EditProfileModalProps = Pick<
  User,
  'name' | 'photoURL' | 'coverPhotoURL'
> & {
  loading: boolean;
  children: ReactNode;
  inputNameError: string;
  editImage: (
    type: 'cover' | 'profile'
  ) => ({ target: { files } }: ChangeEvent<HTMLInputElement>) => void;
  closeModal: () => void;
  updateData: () => Promise<void>;
  removeCoverImage: () => void;
  resetUserEditData: () => void;
};

export function EditProfileModal({
  name,
  loading,
  photoURL,
  children,
  coverPhotoURL,
  inputNameError,
  editImage,
  closeModal,
  updateData,
  removeCoverImage,
  resetUserEditData
}: EditProfileModalProps): JSX.Element {
  const coverInputFileRef = useRef<HTMLInputElement>(null);
  const profileInputFileRef = useRef<HTMLInputElement>(null);

  const handleClick = (type: 'cover' | 'profile') => (): void => {
    if (type === 'cover') coverInputFileRef.current?.click();
    else profileInputFileRef.current?.click();
  };

  return (
    <>
      <MainHeader
        useActionButton
        disableSticky
        iconName='XMarkIcon'
        tip='Close'
        className='absolute flex h-[53px] w-full items-center gap-6 rounded-t-2xl'
        title='Edit profile'
        action={closeModal}
      >
        <div className='ml-auto flex items-center gap-3'>
          <Button
            className='dark-bg-tab group relative p-2 hover:bg-light-primary/10
                       active:bg-light-primary/20 dark:hover:bg-dark-primary/10 
                       dark:active:bg-dark-primary/10'
            onClick={resetUserEditData}
            disabled={loading}
          >
            <HeroIcon className='h-5 w-5' iconName={'ArrowPathIcon'} />
            <ToolTip tip='Reset' />
          </Button>
          <Button
            className='bg-light-primary py-1 px-4 font-bold text-white focus-visible:bg-light-primary/90 
                       enabled:hover:bg-light-primary/90 enabled:active:bg-light-primary/80 disabled:brightness-75
                       dark:bg-light-border dark:text-light-primary dark:focus-visible:bg-light-border/90
                       dark:enabled:hover:bg-light-border/90 dark:enabled:active:bg-light-border/75'
            onClick={updateData}
            disabled={!!inputNameError}
            loading={loading}
          >
            Save
          </Button>
        </div>
      </MainHeader>
      <section
        className={cn(
          'h-full overflow-y-auto transition-opacity',
          loading && 'pointer-events-none opacity-50'
        )}
      >
        <div className='group relative mt-[53px] aspect-[3/1] w-full'>
          <input
            className='hidden'
            type='file'
            accept='image/*'
            ref={coverInputFileRef}
            onChange={editImage('cover')}
          />
          {coverPhotoURL ? (
            <NextImage
              useSkeleton
              className='relative h-full'
              imgClassName='object-cover'
              src={coverPhotoURL}
              alt={name}
              fill
            />
          ) : (
            <div className='h-full bg-light-line-reply dark:bg-dark-line-reply' />
          )}
          <div className='absolute left-1/2 top-1/2 flex -translate-y-1/2 -translate-x-1/2 gap-5'>
            <Button
              className='group/inner relative flex h-11 w-11 items-center justify-center bg-light-primary/60 p-0
                         hover:bg-image-preview-hover/50
                         focus-visible:bg-image-preview-hover/50'
              onClick={handleClick('cover')}
            >
              <HeroIcon
                className='hover-animation h-5 w-5 text-dark-primary group-hover:text-white'
                iconName='CameraIcon'
              />
              <ToolTip groupInner tip='Add photo' />
            </Button>
            {coverPhotoURL && (
              <Button
                className='group/inner relative flex h-11 w-11 items-center justify-center bg-light-primary/60 p-0
                           hover:bg-image-preview-hover/50
                           focus-visible:bg-image-preview-hover/50'
                onClick={removeCoverImage}
              >
                <HeroIcon
                  className='hover-animation h-5 w-5 text-dark-primary group-hover:text-white'
                  iconName='XMarkIcon'
                />
                <ToolTip groupInner tip='Remove photo' />
              </Button>
            )}
          </div>
        </div>
        <div className='relative flex flex-col gap-6 px-4 pt-[80px] pb-3'>
          <input
            className='hidden'
            type='file'
            accept='image/*'
            ref={profileInputFileRef}
            onChange={editImage('profile')}
          />
          <div
            className='profile-picture-frame group absolute left-4 top-0 aspect-square w-[120px] -translate-y-1/2
                       overflow-hidden bg-main-background p-1'
          >
            <NextImage
              useSkeleton
              className='profile-picture-frame relative h-full w-full overflow-hidden'
              imgClassName='profile-picture'
              src={photoURL}
              alt={name}
              fill
            />
            <Button
              className='group/inner absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2
                         -translate-y-1/2 items-center justify-center bg-light-primary/60 p-0
                         hover:bg-image-preview-hover/50 focus-visible:bg-image-preview-hover/50'
              onClick={handleClick('profile')}
            >
              <HeroIcon
                className='hover-animation h-5 w-5 text-dark-primary group-hover:text-white'
                iconName='CameraIcon'
              />
              <ToolTip groupInner tip='Add photo' />
            </Button>
          </div>
          {children}
          <Button
            className='accent-tab -mx-4 mb-4 flex cursor-not-allowed items-center justify-between rounded-none
                       py-2 hover:bg-light-primary/10 active:bg-light-primary/20 disabled:brightness-100
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          >
            <span className='mx-2 text-xl'>Switch to professional</span>
            <i>
              <HeroIcon
                className='h-6 w-6 text-light-secondary dark:text-dark-secondary'
                iconName='ChevronRightIcon'
              />
            </i>
          </Button>
        </div>
      </section>
    </>
  );
}
