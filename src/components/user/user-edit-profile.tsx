import { useState, useEffect, type JSX } from 'react';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { isSubmitShortcut } from '@lib/keyboard-shortcuts';
import { useUser } from '@lib/context/user-context';
import { useModal } from '@lib/hooks/useModal';
import { updateUserData } from '@lib/atproto/utils';
import {
  BIRTHDAY_MONTHS,
  getBirthdayDayCount,
  type ProfileBirthday
} from '@lib/profile-birthday';
import { sleep } from '@lib/utils';
import { getImagesData } from '@lib/validation';
import { Modal } from '@components/modal/modal';
import { EditProfileModal } from '@components/modal/edit-profile-modal';
import {
  EditMediaModal,
  type EditableProfileMedia,
  type EditedProfileMedia
} from '@components/modal/edit-media-modal';
import { Button } from '@components/ui/button';
import { InputField } from '@components/input/input-field';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { FilesWithId } from '@lib/types/file';
import type { User, EditableData, EditableUserData } from '@lib/types/user';
import type { InputFieldProps } from '@components/input/input-field';

type TextEditableData = Exclude<
  EditableData,
  'birthday' | 'photoURL' | 'coverPhotoURL'
>;

type RequiredInputFieldProps = Omit<InputFieldProps, 'handleChange'> & {
  inputId: TextEditableData;
};

type UserImages = Record<
  Extract<EditableData, 'photoURL' | 'coverPhotoURL'>,
  FilesWithId
>;

type TrimmedTexts = Pick<EditableUserData, TextEditableData>;

type UserEditProfileProps = {
  hide?: boolean;
};

function revokeObjectURL(src?: string | null): void {
  if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
}

function getErrorMessage(error: unknown): string | null {
  return error instanceof Error && error.message ? error.message : null;
}

function getEditableUserData(user: User): EditableUserData {
  const { bio, name, pronouns, birthday, website, photoURL, coverPhotoURL } =
    user;

  return { bio, name, pronouns, birthday, website, photoURL, coverPhotoURL };
}

type BirthdayFieldProps = {
  birthday: ProfileBirthday | null;
  handleMonthChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  handleDayChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  clearBirthday: () => void;
};

function BirthdayField({
  birthday,
  handleMonthChange,
  handleDayChange,
  clearBirthday
}: BirthdayFieldProps): JSX.Element {
  const dayCount = birthday ? getBirthdayDayCount(birthday.month) : 31;
  const selectClassName =
    'h-[58px] w-full rounded bg-main-background px-3 pt-5 text-base outline-none ring-1 ring-light-line-reply transition-shadow focus:ring-2 focus:!ring-main-accent dark:ring-dark-border';

  return (
    <div className='flex flex-col gap-1'>
      <div className='flex items-center justify-between'>
        <span className='text-sm text-light-secondary dark:text-dark-secondary'>
          Birthday
        </span>
        {birthday && (
          <button
            className='custom-underline text-sm text-main-accent'
            type='button'
            onClick={clearBirthday}
          >
            Clear
          </button>
        )}
      </div>
      <div className='grid grid-cols-[minmax(0,1.45fr)_minmax(86px,0.55fr)] gap-3'>
        <label className='relative'>
          <span className='absolute left-3 top-1 text-sm text-light-secondary dark:text-dark-secondary'>
            Month
          </span>
          <select
            className={selectClassName}
            value={birthday?.month ?? ''}
            onChange={handleMonthChange}
          >
            <option value=''>Month</option>
            {BIRTHDAY_MONTHS.map((month, index) => (
              <option value={index + 1} key={month}>
                {month}
              </option>
            ))}
          </select>
        </label>
        <label className='relative'>
          <span className='absolute left-3 top-1 text-sm text-light-secondary dark:text-dark-secondary'>
            Day
          </span>
          <select
            className={cn(selectClassName, !birthday && 'opacity-70')}
            value={birthday?.day ?? ''}
            onChange={handleDayChange}
            disabled={!birthday}
          >
            <option value=''>Day</option>
            {Array.from({ length: dayCount }, (_, index) => index + 1).map(
              (day) => (
                <option value={day} key={day}>
                  {day}
                </option>
              )
            )}
          </select>
        </label>
      </div>
    </div>
  );
}

export function UserEditProfile({ hide }: UserEditProfileProps): JSX.Element {
  const { user } = useUser();
  const { open, openModal, closeModal } = useModal();

  const [loading, setLoading] = useState(false);

  const currentUser = user as User;
  const { bio, name, pronouns, birthday, website, photoURL, coverPhotoURL } =
    currentUser;

  const [editUserData, setEditUserData] = useState<EditableUserData>(() =>
    getEditableUserData(currentUser)
  );

  const [userImages, setUserImages] = useState<UserImages>({
    photoURL: [],
    coverPhotoURL: []
  });

  const [editingMedia, setEditingMedia] = useState<EditableProfileMedia | null>(
    null
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => cleanImage, []);

  useEffect(() => {
    if (!open)
      setEditUserData({
        bio,
        name,
        pronouns,
        birthday,
        website,
        photoURL,
        coverPhotoURL
      });
  }, [open, bio, name, pronouns, birthday, website, photoURL, coverPhotoURL]);

  const inputNameError = !editUserData.name?.trim()
    ? "Name can't be blank"
    : '';

  const updateData = async (): Promise<void> => {
    setLoading(true);

    try {
      const userId = user?.id as string;

      const newImages: Partial<Pick<User, 'photoURL' | 'coverPhotoURL'>> = {
        coverPhotoURL:
          coverPhotoURL === editUserData.coverPhotoURL
            ? coverPhotoURL
            : editUserData.coverPhotoURL,
        ...(userImages.photoURL.length && {
          photoURL: editUserData.photoURL as string
        })
      };

      const trimmedKeys: Readonly<TextEditableData[]> = [
        'name',
        'bio',
        'pronouns',
        'website'
      ];

      const trimmedTexts = trimmedKeys.reduce(
        (acc, curr) => ({ ...acc, [curr]: editUserData[curr]?.trim() ?? null }),
        {} as TrimmedTexts
      );

      const newUserData: Readonly<EditableUserData> = {
        ...editUserData,
        ...trimmedTexts,
        ...newImages
      };

      await sleep(500);

      await updateUserData(userId, newUserData, userImages);

      closeModal();

      cleanImage();

      setEditUserData(newUserData);

      toast.success('Profile updated successfully');
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(
        message
          ? `Profile could not be updated: ${message}`
          : 'Profile could not be updated'
      );
    } finally {
      setLoading(false);
    }
  };

  const editImage =
    (type: 'cover' | 'profile') =>
    ({ target }: ChangeEvent<HTMLInputElement>): void => {
      const { files } = target;
      const imagesData = getImagesData(files);

      if (!imagesData) {
        toast.error('Please choose a valid GIF or Photo');
        return;
      }

      const { imagesPreviewData, selectedImagesData } = imagesData;

      setEditingMedia({
        type,
        src: imagesPreviewData[0].src,
        alt: imagesPreviewData[0].alt,
        file: selectedImagesData[0]
      });

      target.value = '';
    };

  const removeCoverImage = (): void => {
    revokeObjectURL(editUserData.coverPhotoURL);

    setEditUserData({
      ...editUserData,
      coverPhotoURL: null
    });

    setUserImages({
      ...userImages,
      coverPhotoURL: []
    });
  };

  const cleanImage = (): void => {
    const imagesKey: Readonly<Array<keyof UserImages>> = [
      'photoURL',
      'coverPhotoURL'
    ];

    imagesKey.forEach((image) => revokeObjectURL(editUserData[image]));
    revokeObjectURL(editingMedia?.src);

    setUserImages({
      photoURL: [],
      coverPhotoURL: []
    });
  };

  const closeMediaEditor = (): void => {
    revokeObjectURL(editingMedia?.src);
    setEditingMedia(null);
  };

  const applyEditedImage = ({ previewSrc, file }: EditedProfileMedia): void => {
    if (!editingMedia) return;

    const targetKey =
      editingMedia.type === 'cover' ? 'coverPhotoURL' : 'photoURL';

    if (previewSrc !== editingMedia.src) revokeObjectURL(editingMedia.src);

    setEditUserData((currentEditUserData) => {
      revokeObjectURL(currentEditUserData[targetKey]);

      return {
        ...currentEditUserData,
        [targetKey]: previewSrc
      };
    });

    setUserImages((currentUserImages) => ({
      ...currentUserImages,
      [targetKey]: [file]
    }));

    setEditingMedia(null);
  };

  const resetUserEditData = (): void => {
    cleanImage();
    closeMediaEditor();
    setEditUserData(getEditableUserData(currentUser));
  };

  const openEditProfile = (): void => {
    cleanImage();
    closeMediaEditor();
    setEditUserData(getEditableUserData(currentUser));
    openModal();
  };

  const handleCloseModal = (): void => {
    closeMediaEditor();
    closeModal();
  };

  const handleChange =
    (key: TextEditableData) =>
    ({
      target: { value }
    }: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setEditUserData({ ...editUserData, [key]: value });

  const handleBirthdayMonthChange = ({
    target: { value }
  }: ChangeEvent<HTMLSelectElement>): void => {
    const nextMonth = Number(value);

    setEditUserData((currentData) => {
      if (!nextMonth) return { ...currentData, birthday: null };

      const dayCount = getBirthdayDayCount(nextMonth);
      const nextDay = Math.min(currentData.birthday?.day ?? 1, dayCount);

      return {
        ...currentData,
        birthday: { month: nextMonth, day: nextDay }
      };
    });
  };

  const handleBirthdayDayChange = ({
    target: { value }
  }: ChangeEvent<HTMLSelectElement>): void => {
    const nextDay = Number(value);

    setEditUserData((currentData) => {
      if (!currentData.birthday || !nextDay) return currentData;

      return {
        ...currentData,
        birthday: { ...currentData.birthday, day: nextDay }
      };
    });
  };

  const clearBirthday = (): void =>
    setEditUserData((currentData) => ({ ...currentData, birthday: null }));

  const handleKeyboardShortcut = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    if (isSubmitShortcut(event) && !inputNameError && !loading) {
      event.preventDefault();
      event.currentTarget.blur();
      void updateData();
    }
  };

  const inputFields: Readonly<RequiredInputFieldProps[]> = [
    {
      label: 'Name',
      inputId: 'name',
      inputValue: editUserData.name,
      inputLimit: 50,
      errorMessage: inputNameError
    },
    {
      label: 'Bio',
      inputId: 'bio',
      inputValue: editUserData.bio,
      inputLimit: 160,
      useTextArea: true
    },
    {
      label: 'Pronouns',
      inputId: 'pronouns',
      inputValue: editUserData.pronouns,
      inputLimit: 20
    },
    {
      label: 'Website',
      inputId: 'website',
      inputValue: editUserData.website,
      inputLimit: 100
    }
  ];

  return (
    <form className={cn(hide && 'hidden md:block')}>
      <Modal
        modalClassName={cn(
          'relative w-full max-w-[600px] overflow-hidden rounded-2xl bg-main-background',
          editingMedia ? 'h-auto max-h-[90vh]' : 'h-[672px] max-h-[90vh]'
        )}
        open={open}
        closeModal={handleCloseModal}
      >
        {editingMedia ? (
          <EditMediaModal
            media={editingMedia}
            closeEditor={closeMediaEditor}
            applyImage={applyEditedImage}
          />
        ) : (
          <EditProfileModal
            name={name}
            loading={loading}
            photoURL={editUserData.photoURL}
            coverPhotoURL={editUserData.coverPhotoURL}
            inputNameError={inputNameError}
            editImage={editImage}
            closeModal={handleCloseModal}
            updateData={updateData}
            removeCoverImage={removeCoverImage}
            resetUserEditData={resetUserEditData}
          >
            {inputFields.map((inputData) => (
              <InputField
                {...inputData}
                handleChange={handleChange(inputData.inputId)}
                handleKeyboardShortcut={handleKeyboardShortcut}
                key={inputData.inputId}
              />
            ))}
            <BirthdayField
              birthday={editUserData.birthday}
              handleMonthChange={handleBirthdayMonthChange}
              handleDayChange={handleBirthdayDayChange}
              clearBirthday={clearBirthday}
            />
          </EditProfileModal>
        )}
      </Modal>
      <Button
        className='dark-bg-tab self-start border border-light-line-reply px-4 py-1.5 font-bold
                   hover:bg-light-primary/10 active:bg-light-primary/20 dark:border-light-secondary
                   dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
        onClick={openEditProfile}
      >
        Edit profile
      </Button>
    </form>
  );
}
