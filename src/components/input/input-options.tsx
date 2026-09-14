import { useRef, useState, type JSX } from 'react';
import { motion } from 'framer-motion';
import { SUBMIT_KEYSHORTCUTS } from '@lib/keyboard-shortcuts';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { variants } from './input';
import { ProgressBar } from './progress-bar';
import {
  TwitterComposePicker,
  type ComposePickerType,
  type GifSelection
} from './twitter-compose-picker';
import type { ChangeEvent, ClipboardEvent } from 'react';
import type { IconName } from '@components/ui/hero-icon';

type Options = {
  name: string;
  iconName: IconName;
  disabled: boolean;
  picker?: ComposePickerType;
  onClick?: () => void;
}[];

const options: Readonly<Options> = [
  {
    name: 'Media',
    iconName: 'PhotoIcon',
    disabled: false
  },
  {
    name: 'GIF',
    iconName: 'GifIcon',
    disabled: false,
    picker: 'gif'
  },
  {
    name: 'Poll',
    iconName: 'ChartBarIcon',
    disabled: true
  },
  {
    name: 'Emoji',
    iconName: 'FaceSmileIcon',
    disabled: false,
    picker: 'emoji'
  },
  {
    name: 'Schedule',
    iconName: 'CalendarDaysIcon',
    disabled: true
  },
  {
    name: 'Location',
    iconName: 'MapPinIcon',
    disabled: true
  }
];

type InputOptionsProps = {
  reply?: boolean;
  modal?: boolean;
  inputLimit: number;
  inputLength: number;
  isValidTweet: boolean;
  isCharLimitExceeded: boolean;
  hideSubmit?: boolean;
  canAddThreadItem?: boolean;
  onAddThreadItem?: () => void;
  handleImageUpload: (
    e: ChangeEvent<HTMLInputElement> | ClipboardEvent<HTMLTextAreaElement>
  ) => void;
  handleEmojiSelect: (emoji: string) => void;
  handleGifSelect: (gif: GifSelection) => void;
};

export function InputOptions({
  reply,
  modal,
  inputLimit,
  inputLength,
  isValidTweet,
  isCharLimitExceeded,
  hideSubmit,
  canAddThreadItem,
  onAddThreadItem,
  handleImageUpload,
  handleEmojiSelect,
  handleGifSelect
}: InputOptionsProps): JSX.Element {
  const [activePicker, setActivePicker] = useState<ComposePickerType | null>(
    null
  );

  const inputFileRef = useRef<HTMLInputElement>(null);
  const pickerAnchorRefs = useRef<
    Record<ComposePickerType, HTMLButtonElement | null>
  >({
    gif: null,
    emoji: null
  });

  const onClick = (): void => inputFileRef.current?.click();

  const togglePicker = (picker: ComposePickerType) => (): void => {
    setActivePicker(activePicker === picker ? null : picker);
  };

  const closePicker = (): void => setActivePicker(null);

  const selectEmoji = (emoji: string): void => {
    handleEmojiSelect(emoji);
  };

  const selectGif = (gif: GifSelection): void => {
    handleGifSelect(gif);
    setActivePicker(null);
  };

  let filteredOptions = options;

  if (reply)
    filteredOptions = filteredOptions.filter(
      (_, index) => ![2, 4].includes(index)
    );

  return (
    <motion.div className='flex justify-between' {...variants}>
      <div
        className='flex gap-1 text-main-accent xs:[&>button:nth-child(n+6)]:hidden
                   md:[&>button]:!block [&>button:nth-child(n+4)]:hidden'
      >
        <input
          className='hidden'
          type='file'
          accept='image/jpeg,image/png,image/webp,video/mp4'
          onChange={handleImageUpload}
          ref={inputFileRef}
          multiple
        />
        {filteredOptions.map(({ name, iconName, disabled, picker }, index) => {
          return (
            <Button
              className='accent-tab accent-bg-tab group relative h-9 w-9 rounded-full p-0
                         hover:bg-main-accent/10 active:bg-main-accent/20'
              ref={
                picker
                  ? (node): void => {
                      pickerAnchorRefs.current[picker] = node;
                    }
                  : undefined
              }
              onClick={
                index === 0
                  ? onClick
                  : picker
                    ? togglePicker(picker)
                    : undefined
              }
              disabled={disabled}
              key={name}
            >
              <HeroIcon className='h-5 w-5' iconName={iconName} />
              <ToolTip tip={name} modal={modal} />
            </Button>
          );
        })}
        {activePicker && (
          <TwitterComposePicker
            type={activePicker}
            placement={modal ? 'above' : 'below'}
            anchorElement={pickerAnchorRefs.current[activePicker]}
            onClose={closePicker}
            onSelectEmoji={selectEmoji}
            onSelectGif={selectGif}
          />
        )}
      </div>
      <div className='flex items-center gap-4'>
        <motion.div
          className='flex items-center gap-4'
          animate={{ opacity: inputLength ? 1 : 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <ProgressBar
            modal={modal}
            inputLimit={inputLimit}
            inputLength={inputLength}
            isCharLimitExceeded={isCharLimitExceeded}
          />
          {!reply && (
            <>
              <i className='hidden h-8 w-[1px] bg-[#B9CAD3] dark:bg-[#3E4144] xs:block' />
              <Button
                className='group relative hidden rounded-full border border-light-line-reply p-[1px]
                           text-main-accent dark:border-light-secondary xs:block'
                onClick={onAddThreadItem}
                disabled={!canAddThreadItem}
              >
                <HeroIcon className='h-5 w-5' iconName='PlusIcon' />
                <ToolTip tip='Add another Tweet' modal={modal} />
              </Button>
            </>
          )}
        </motion.div>
        {!hideSubmit && (
          <Button
            type='submit'
            className='accent-tab h-9 bg-main-accent px-4 py-0 text-[15px] font-bold leading-5 text-white
                       enabled:hover:bg-main-accent/90
                       enabled:active:bg-main-accent/75'
            disabled={!isValidTweet}
            aria-keyshortcuts={SUBMIT_KEYSHORTCUTS}
          >
            {reply ? 'Reply' : 'Tweet'}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
