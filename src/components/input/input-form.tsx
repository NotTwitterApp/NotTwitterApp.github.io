import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import TextArea from 'react-textarea-autosize';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { useModal } from '@lib/hooks/useModal';
import {
  getActiveHashtag,
  getActiveMention,
  type ActiveHashtag,
  type ActiveMention
} from '@lib/hashtags';
import { isSubmitShortcut, SUBMIT_KEYSHORTCUTS } from '@lib/keyboard-shortcuts';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { HeroIcon } from '@components/ui/hero-icon';
import { Button } from '@components/ui/button';
import { HashtagSuggestions, MentionSuggestions } from './hashtag-suggestions';
import type {
  Dispatch,
  ReactNode,
  RefObject,
  SetStateAction,
  ChangeEvent,
  UIEvent,
  KeyboardEvent,
  ClipboardEvent
} from 'react';
import type { Variants } from 'framer-motion';
import type { TweetReplySetting } from '@lib/types/tweet';

type InputFormProps = {
  modal?: boolean;
  formId: string;
  loading: boolean;
  readOnly?: boolean;
  visited: boolean;
  reply?: boolean;
  quote?: boolean;
  children: ReactNode;
  footerStatus?: ReactNode;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  inputValue: string;
  replySetting: TweetReplySetting;
  replyModal?: boolean;
  isValidTweet: boolean;
  isUploadingImages: boolean;
  setReplySetting: Dispatch<SetStateAction<TweetReplySetting>>;
  sendTweet: () => Promise<void>;
  handleHashtagSelect: (tag: string, hashtag: ActiveHashtag) => void;
  handleMentionSelect: (username: string, mention: ActiveMention) => void;
  handleFocus: () => void;
  discardTweet: () => void;
  handleChange: ({
    target: { value }
  }: ChangeEvent<HTMLTextAreaElement>) => void;
  handleImageUpload: (
    e: ChangeEvent<HTMLInputElement> | ClipboardEvent<HTMLTextAreaElement>
  ) => void;
};

const variants: Variants[] = [
  {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } },
    exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeOut' } }
  },
  {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } },
    exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeOut' } }
  }
];

export const [fromTop, fromBottom] = variants;

type ComposerTextPart = {
  text: string;
  hashtag: boolean;
};

const replyOptions: Readonly<
  {
    value: TweetReplySetting;
    label: string;
    iconName:
      | 'GlobeAmericasIcon'
      | 'UserPlusIcon'
      | 'UserGroupIcon'
      | 'AtSymbolIcon'
      | 'NoSymbolIcon';
  }[]
> = [
  {
    value: 'everyone',
    label: 'Everyone can reply',
    iconName: 'GlobeAmericasIcon'
  },
  {
    value: 'following',
    label: 'People you follow can reply',
    iconName: 'UserPlusIcon'
  },
  {
    value: 'followers',
    label: 'Your followers can reply',
    iconName: 'UserGroupIcon'
  },
  {
    value: 'mentioned',
    label: 'Accounts you mention can reply',
    iconName: 'AtSymbolIcon'
  },
  {
    value: 'none',
    label: 'No one can reply',
    iconName: 'NoSymbolIcon'
  }
];

function getActiveTextEntity(
  value: string,
  cursorPosition: number
): {
  hashtag: ActiveHashtag | null;
  mention: ActiveMention | null;
} {
  const hashtag = getActiveHashtag(value, cursorPosition);

  return {
    hashtag,
    mention: hashtag ? null : getActiveMention(value, cursorPosition)
  };
}

function getComposerTextParts(text: string): ComposerTextPart[] {
  const parts: ComposerTextPart[] = [];
  const hashtagRegex = /(^|[\s([{])(#(?:[A-Za-z0-9_]{0,139}))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = hashtagRegex.exec(text))) {
    const prefix = match[1];
    const hashtag = match[2];
    const hashtagIndex = match.index + prefix.length;

    if (hashtagIndex > lastIndex)
      parts.push({ text: text.slice(lastIndex, hashtagIndex), hashtag: false });

    parts.push({ text: hashtag, hashtag: true });
    lastIndex = hashtagIndex + hashtag.length;
  }

  if (lastIndex < text.length)
    parts.push({ text: text.slice(lastIndex), hashtag: false });

  return parts;
}

export function InputForm({
  modal,
  reply,
  quote,
  formId,
  loading,
  readOnly,
  visited,
  children,
  footerStatus,
  inputRef,
  replyModal,
  inputValue,
  replySetting,
  isValidTweet,
  isUploadingImages,
  setReplySetting,
  sendTweet,
  handleHashtagSelect,
  handleMentionSelect,
  handleFocus,
  discardTweet,
  handleChange,
  handleImageUpload
}: InputFormProps): JSX.Element {
  const { open, openModal, closeModal } = useModal();
  const [activeHashtag, setActiveHashtag] = useState<ActiveHashtag | null>(
    null
  );
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(
    null
  );
  const [replyMenuOpen, setReplyMenuOpen] = useState(false);
  const [highlightScrollTop, setHighlightScrollTop] = useState(0);
  const replyMenuRef = useRef<HTMLDivElement>(null);

  const composerTextParts = useMemo(
    () => getComposerTextParts(inputValue),
    [inputValue]
  );
  const selectedReplyOption = replyOptions.find(
    ({ value }) => value === replySetting
  ) as (typeof replyOptions)[number];
  const isVisibilityShown = visited && !reply && !replyModal && !loading;
  const textareaMinRows =
    loading || reply || replyModal
      ? 1
      : modal && !isUploadingImages && !quote
        ? 4
        : 1;

  useEffect(() => handleShowHideNav(true), []);

  useEffect(() => {
    if (!isVisibilityShown) setReplyMenuOpen(false);
  }, [isVisibilityShown]);

  useEffect(() => {
    if (!replyMenuOpen) return;

    const closeReplyMenuOnOutsidePointerDown = ({
      target
    }: PointerEvent): void => {
      if (target instanceof Node && !replyMenuRef.current?.contains(target))
        setReplyMenuOpen(false);
    };

    document.addEventListener(
      'pointerdown',
      closeReplyMenuOnOutsidePointerDown
    );

    return () =>
      document.removeEventListener(
        'pointerdown',
        closeReplyMenuOnOutsidePointerDown
      );
  }, [replyMenuOpen]);

  useEffect(() => {
    const input = inputRef.current;
    const cursorPosition = input?.selectionStart ?? inputValue.length;
    const { hashtag, mention } = getActiveTextEntity(
      inputValue,
      cursorPosition
    );

    setActiveHashtag(hashtag);
    setActiveMention(mention);
  }, [inputRef, inputValue]);

  const handleKeyboardShortcut = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ): void => {
    const { key } = event;

    if (!modal && key === 'Escape')
      if (isValidTweet) {
        inputRef.current?.blur();
        openModal();
      } else discardTweet();
    else if (isSubmitShortcut(event)) {
      event.preventDefault();
      if (isValidTweet && !loading && !readOnly) void sendTweet();
    }
  };

  const handleShowHideNav = (blur?: boolean) => (): void => {
    const sidebar = document.getElementById('sidebar') as HTMLElement;

    if (!sidebar) return;

    if (blur) {
      setTimeout(() => (sidebar.style.opacity = ''), 200);
      return;
    }

    if (window.innerWidth < 500) sidebar.style.opacity = '0';
  };

  const handleFormFocus = (): void => {
    handleShowHideNav()();
    handleFocus();
  };

  const handleTextEntityState = (): void => {
    const input = inputRef.current;
    const cursorPosition = input?.selectionStart ?? inputValue.length;
    const { hashtag, mention } = getActiveTextEntity(
      inputValue,
      cursorPosition
    );

    setActiveHashtag(hashtag);
    setActiveMention(mention);
  };

  const handleTextAreaKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ): void => handleKeyboardShortcut(event);

  const handleTextAreaKeyUp = (): void => handleTextEntityState();

  const handleTextAreaScroll = ({
    currentTarget
  }: UIEvent<HTMLTextAreaElement>): void => {
    setHighlightScrollTop(currentTarget.scrollTop);
  };

  const selectHashtag = (tag: string): void => {
    const hashtag =
      activeHashtag ??
      getActiveHashtag(
        inputValue,
        inputRef.current?.selectionStart ?? inputValue.length
      );

    if (!hashtag) return;

    handleHashtagSelect(tag, hashtag);
    setActiveHashtag(null);
    setActiveMention(null);
  };

  const selectMention = (username: string): void => {
    const mention =
      activeMention ??
      getActiveMention(
        inputValue,
        inputRef.current?.selectionStart ?? inputValue.length
      );

    if (!mention) return;

    handleMentionSelect(username, mention);
    setActiveHashtag(null);
    setActiveMention(null);
  };

  const handleClose = (): void => {
    discardTweet();
    closeModal();
  };

  const selectReplySetting =
    (nextReplySetting: TweetReplySetting) => (): void => {
      setReplySetting(nextReplySetting);
      setReplyMenuOpen(false);
    };

  return (
    <div
      className={cn(
        'flex min-h-[48px] w-full min-w-0 flex-col justify-center',
        quote ? 'gap-2.5' : 'gap-3'
      )}
    >
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={open}
        closeModal={closeModal}
      >
        <ActionModal
          title='Discard Tweet?'
          description='This can’t be undone and you’ll lose your draft.'
          mainBtnClassName='bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/75'
          mainBtnLabel='Discard'
          action={handleClose}
          closeModal={closeModal}
        />
      </Modal>
      <div className={cn('flex min-w-0 flex-col', quote ? 'gap-3' : 'gap-6')}>
        <div className='flex min-h-[48px] items-center gap-3'>
          <div className='relative min-w-0 flex-1'>
            {inputValue && (
              <div
                className='pointer-events-none absolute inset-0 z-0 overflow-hidden text-[20px] leading-6
                           text-light-primary dark:text-dark-primary'
                aria-hidden
              >
                <div
                  className='whitespace-pre-wrap break-words'
                  style={
                    highlightScrollTop
                      ? { transform: `translateY(-${highlightScrollTop}px)` }
                      : undefined
                  }
                >
                  {composerTextParts.map(({ text, hashtag }, index) => (
                    <span
                      className={hashtag ? 'text-main-accent' : undefined}
                      key={`${text}-${index}`}
                    >
                      {text}
                    </span>
                  ))}
                  {inputValue.endsWith('\n') && <span>{'\u200b'}</span>}
                </div>
              </div>
            )}
            <TextArea
              id={formId}
              className='relative z-10 w-full min-w-0 resize-none bg-transparent text-[20px] leading-6
                         text-transparent caret-light-primary outline-none placeholder:text-light-secondary
                         dark:caret-dark-primary dark:placeholder:text-dark-secondary'
              value={inputValue}
              placeholder={
                quote
                  ? 'Add a comment'
                  : reply || replyModal
                    ? 'Tweet your reply'
                    : "What's happening?"
              }
              onBlur={handleShowHideNav(true)}
              minRows={textareaMinRows}
              maxRows={isUploadingImages ? 5 : 15}
              onFocus={handleFormFocus}
              onPaste={handleImageUpload}
              onClick={handleTextEntityState}
              onSelect={handleTextEntityState}
              onKeyDown={handleTextAreaKeyDown}
              onKeyUp={handleTextAreaKeyUp}
              onScroll={handleTextAreaScroll}
              onChange={handleChange}
              readOnly={readOnly}
              aria-keyshortcuts={SUBMIT_KEYSHORTCUTS}
              ref={inputRef}
            />
            <AnimatePresence>
              {activeHashtag ? (
                <HashtagSuggestions
                  query={activeHashtag.query}
                  onSelect={selectHashtag}
                />
              ) : activeMention ? (
                <MentionSuggestions
                  query={activeMention.query}
                  onSelect={selectMention}
                />
              ) : null}
            </AnimatePresence>
          </div>
          {reply && !visited && (
            <Button
              className='cursor-pointer bg-main-accent px-4 py-1.5 font-bold text-white opacity-50'
              onClick={handleFocus}
            >
              Reply
            </Button>
          )}
        </div>
      </div>
      {children}
      {footerStatus}
      {isVisibilityShown && (
        <motion.div
          className='flex border-b border-light-border pb-2 dark:border-dark-border'
          {...fromBottom}
        >
          <div className='relative' ref={replyMenuRef}>
            <button
              type='button'
              className='custom-button accent-tab accent-bg-tab flex items-center gap-1 py-0
                         px-0 pr-2 text-[15px] leading-5 text-main-accent hover:bg-main-accent/10
                         active:bg-main-accent/20'
              aria-haspopup='menu'
              aria-expanded={replyMenuOpen}
              onClick={(): void => {
                setReplyMenuOpen(!replyMenuOpen);
              }}
            >
              <HeroIcon
                className='h-4 w-4'
                iconName={selectedReplyOption.iconName}
              />
              <p className='font-bold'>{selectedReplyOption.label}</p>
              <HeroIcon className='h-4 w-4' iconName='ChevronDownIcon' />
            </button>
            <AnimatePresence>
              {replyMenuOpen && (
                <motion.div
                  className='menu-container absolute left-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-2xl
                             border border-light-line-reply bg-main-background py-2 shadow-xl
                             dark:border-dark-border'
                  role='menu'
                  {...fromBottom}
                >
                  {replyOptions.map(({ value, label, iconName }) => {
                    const selected = value === replySetting;

                    return (
                      <button
                        type='button'
                        className='accent-bg-tab flex w-full items-center gap-3 px-4 py-3 text-left
                                   hover:bg-main-accent/10 active:bg-main-accent/20'
                        role='menuitemradio'
                        aria-checked={selected}
                        onClick={selectReplySetting(value)}
                        key={value}
                      >
                        <HeroIcon
                          className='h-5 w-5 text-main-accent'
                          iconName={iconName}
                        />
                        <span className='min-w-0 flex-1 font-bold'>
                          {label}
                        </span>
                        {selected && (
                          <HeroIcon
                            className='h-5 w-5 text-main-accent'
                            iconName='CheckIcon'
                          />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
}
