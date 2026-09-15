import {
  useLinkedTweet,
  toEmbeddedTweet as getQuotedTweetPreview
} from '@lib/hooks/use-linked-tweet';
import { UndoTweetComposerStatus } from './undo-tweet-status';
import Link from 'next/link';
import {
  useState,
  useEffect,
  useRef,
  useId,
  useMemo,
  useCallback,
  type JSX
} from 'react';
import { Dialog } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import TextArea from 'react-textarea-autosize';
import cn from 'clsx';
import { toast } from 'react-hot-toast';
import { RichText } from '@atproto/api';
import { tweetsCollection } from '@lib/atproto/collections';
import { addDoc, getDoc, serverTimestamp } from '@lib/atproto/store';
import {
  canonicalizeBskyPostLinksInText,
  getBskyPostLinkFromText,
  getTweetPath,
  getUserPath,
  removeBskyPostLinkFromText
} from '@lib/routes';
import {
  manageReply,
  uploadImages,
  manageTotalTweets,
  manageTotalPhotos
} from '@lib/atproto/utils';
import { useAuth } from '@lib/context/auth-context';
import {
  getHashtagSearchQuery,
  normalizeMention,
  type ActiveHashtag,
  type ActiveMention
} from '@lib/hashtags';
import { sleep } from '@lib/utils';
import { getImagesData } from '@lib/validation';
import {
  deleteTweetDraft,
  getTweetDraft,
  getTweetDraftId,
  getTweetDraftsForUser,
  saveTweetDraft,
  tweetDraftsChangedEvent,
  type LocalTweetDraft,
  type TweetDraftScope
} from '@lib/tweet-drafts';
import {
  shouldUseUndoTweet,
  useUndoTweetSettings,
  type UndoTweetKind
} from '@lib/hooks/use-undo-tweet-settings';
import { createYouTubeCardFromText } from '@lib/youtube';
import { UserAvatar } from '@components/user/user-avatar';
import { TweetEmbed } from '@components/tweet/tweet-embed';
import { Modal } from '@components/modal/modal';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { InputForm, fromTop } from './input-form';
import { ImagePreview } from './image-preview';
import { InputOptions } from './input-options';
import type { GifSelection } from './twitter-compose-picker';
import type { ReactNode, FormEvent, ChangeEvent, ClipboardEvent } from 'react';
import type { WithFieldValue } from '@lib/atproto/store';
import type { Variants } from 'framer-motion';
import type { User } from '@lib/types/user';
import type {
  Tweet,
  TweetCard,
  TweetReplySetting,
  TweetWithUser
} from '@lib/types/tweet';
import type { FilesWithId, ImagesPreview } from '@lib/types/file';

type InputProps = {
  modal?: boolean;
  reply?: boolean;
  compactReply?: boolean;
  focusSignal?: number;
  parent?: { id: string; username: string };
  disabled?: boolean;
  children?: ReactNode;
  quoteTweet?: TweetWithUser;
  replyModal?: boolean;
  closeModal?: () => void;
  onTweetSent?: (tweet: TweetWithUser) => void;
};

type TweetDraft = Omit<Tweet, 'id'> & {
  quoteTarget?: { id: string; createdBy: string };
  replySetting?: TweetReplySetting;
};

type TweetSubmissionSnapshot = {
  text: string;
  selectedImages: FilesWithId;
  imagesPreview: ImagesPreview;
  selectedGifCard: TweetCard | null;
  externalCard: TweetCard | null;
  quoteTweet: TweetWithUser | null;
  parent: { id: string; username: string } | undefined;
  isReplying: boolean;
  replySetting: TweetReplySetting;
  threadItems: ThreadComposerItem[];
};

type UndoTweetPending = {
  snapshot: TweetSubmissionSnapshot;
  expiresAt: number;
  durationSeconds: number;
};

type ThreadComposerItem = {
  id: string;
  text: string;
};

function getUndoTweetKind({
  isReplying,
  quoteTweet,
  threadItems
}: TweetSubmissionSnapshot): UndoTweetKind {
  if (threadItems.length) return 'thread';
  if (isReplying) return 'reply';
  if (quoteTweet) return 'quote';

  return 'tweet';
}

export const variants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 }
};

const BLUESKY_POST_GRAPHEME_LIMIT = 300;

function createThreadComposerItem(): ThreadComposerItem {
  return {
    id: `thread-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2)}`,
    text: ''
  };
}

function getPostGraphemeLength(text: string): number {
  return new RichText({ text }, { cleanNewlines: true }).graphemeLength;
}

function isValidThreadText(text: string): boolean {
  const trimmed = text.trim();
  return (
    !!trimmed && getPostGraphemeLength(text) <= BLUESKY_POST_GRAPHEME_LIMIT
  );
}

function getErrorMessage(error: unknown): string | null {
  return error instanceof Error && error.message ? error.message : null;
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.mp4$/i.test(file.name);
}

function isRemoteMediaUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

function revokePreviewUrl(src: string): void {
  if (!isRemoteMediaUrl(src)) URL.revokeObjectURL(src);
}

function revokeImagePreviews(previews: ImagesPreview): void {
  previews.forEach(({ src }) => revokePreviewUrl(src));
}

function getGifMediaUri({
  src,
  aspectRatio
}: Pick<GifSelection, 'src' | 'aspectRatio'>): string {
  try {
    const url = new URL(src);

    if (aspectRatio?.width && aspectRatio?.height) {
      url.searchParams.set('ww', String(aspectRatio.width));
      url.searchParams.set('hh', String(aspectRatio.height));
    }

    return url.toString();
  } catch {
    return src;
  }
}

function getCardDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function createGifCard(gif: GifSelection): TweetCard {
  const url = getGifMediaUri(gif);

  return {
    type: 'external',
    url,
    title: gif.title || 'GIF',
    description: `ALT: ${gif.title || 'GIF'}`,
    image: gif.preview || null,
    domain: getCardDomain(url)
  };
}

function formatDraftTime(updatedAt: number): string {
  return new Intl.DateTimeFormat('en-gb', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(updatedAt));
}

function getDraftContextLabel({
  type,
  parentUsername
}: LocalTweetDraft): string {
  if (type === 'reply') return `Reply to @${parentUsername ?? 'user'}`;
  if (type === 'quote') return 'Quote Tweet';

  return 'Tweet';
}

function getDraftPreviewText({ text, gifCard }: LocalTweetDraft): string {
  const trimmedText = text.trim();

  if (trimmedText) return trimmedText;
  if (gifCard) return gifCard.title || 'GIF';

  return 'Draft';
}

function TweetDraftsModal({
  open,
  drafts,
  currentDraftId,
  closeModal,
  selectDraft,
  deleteDraft
}: {
  open: boolean;
  drafts: LocalTweetDraft[];
  currentDraftId: string | null;
  closeModal: () => void;
  selectDraft: (draft: LocalTweetDraft) => void;
  deleteDraft: (draftId: string) => void;
}): JSX.Element {
  return (
    <Modal
      modalClassName='w-full max-w-xl overflow-hidden rounded-2xl bg-main-background text-light-primary shadow-xl dark:text-dark-primary'
      open={open}
      closeModal={closeModal}
    >
      <div
        className='grid h-[53px] grid-cols-[48px_minmax(0,1fr)_48px] items-center border-b
                   border-light-border px-1 dark:border-dark-border'
      >
        <Button
          className='dark-bg-tab group relative h-9 w-9 rounded-full p-0
                     hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          aria-label='Close'
          onClick={closeModal}
        >
          <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
        </Button>
        <Dialog.Title className='text-center text-xl font-extrabold'>
          Unsent Tweets
        </Dialog.Title>
        <span aria-hidden='true' />
      </div>
      <div className='max-h-[70vh] overflow-y-auto'>
        {drafts.length ? (
          drafts.map((draft) => {
            const selected = draft.id === currentDraftId;

            return (
              <div
                className='flex border-b border-light-border last:border-b-0 dark:border-dark-border'
                key={draft.id}
              >
                <button
                  className={cn(
                    `accent-bg-tab flex min-w-0 flex-1 flex-col gap-1 px-4 py-3
                     text-left hover:bg-light-primary/5 active:bg-light-primary/10
                     dark:hover:bg-dark-primary/5 dark:active:bg-dark-primary/10`,
                    selected && 'bg-main-accent/10'
                  )}
                  type='button'
                  onClick={(): void => selectDraft(draft)}
                >
                  <div className='flex w-full min-w-0 items-center gap-2 text-[13px] text-light-secondary dark:text-dark-secondary'>
                    <span className='font-bold text-light-primary dark:text-dark-primary'>
                      {getDraftContextLabel(draft)}
                    </span>
                    <span aria-hidden='true'>&middot;</span>
                    <span>{formatDraftTime(draft.updatedAt)}</span>
                    {draft.gifCard && (
                      <>
                        <span aria-hidden='true'>&middot;</span>
                        <span className='inline-flex items-center gap-1'>
                          <HeroIcon className='h-4 w-4' iconName='GifIcon' />
                          GIF
                        </span>
                      </>
                    )}
                  </div>
                  <p className='max-h-12 overflow-hidden whitespace-pre-wrap break-words text-[15px] leading-6'>
                    {getDraftPreviewText(draft)}
                  </p>
                </button>
                <Button
                  className='dark-bg-tab m-2 h-9 w-9 shrink-0 rounded-full p-0 text-light-secondary
                             hover:bg-accent-red/10 hover:text-accent-red
                             active:bg-accent-red/20 dark:text-dark-secondary'
                  aria-label='Delete draft'
                  title='Delete draft'
                  onClick={(): void => deleteDraft(draft.id)}
                >
                  <HeroIcon className='h-5 w-5' iconName='TrashIcon' />
                </Button>
              </div>
            );
          })
        ) : (
          <div className='px-8 py-14 text-center'>
            <p className='text-xl font-extrabold'>No unsent Tweets</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ThreadComposerStack({
  items,
  inputLimit,
  disabled,
  photoURL,
  name,
  username,
  setThreadInputRef,
  updateThreadItem,
  removeThreadItem
}: {
  items: ThreadComposerItem[];
  inputLimit: number;
  disabled: boolean;
  photoURL: string;
  name: string;
  username: string;
  setThreadInputRef: (id: string) => (node: HTMLTextAreaElement | null) => void;
  updateThreadItem: (id: string, text: string) => void;
  removeThreadItem: (id: string) => void;
}): JSX.Element | null {
  if (!items.length) return null;

  return (
    <div className='-ml-[60px] flex flex-col pl-[60px]'>
      {items.map(({ id, text }, index) => {
        const inputLength = getPostGraphemeLength(text);
        const remaining = inputLimit - inputLength;
        const showCount = remaining <= 20 || remaining < 0;
        const overLimit = remaining < 0;

        return (
          <div
            className='relative grid min-h-[86px] grid-cols-[48px_minmax(0,1fr)] gap-3 py-3'
            key={id}
          >
            <div className='relative flex justify-center'>
              <span className='absolute left-1/2 -top-3 h-5 w-0.5 -translate-x-1/2 bg-light-line-reply dark:bg-dark-line-reply' />
              {index < items.length - 1 && (
                <span className='absolute left-1/2 top-10 bottom-[-12px] w-0.5 -translate-x-1/2 bg-light-line-reply dark:bg-dark-line-reply' />
              )}
              <UserAvatar
                size={40}
                src={photoURL}
                alt={name}
                username={username}
              />
            </div>
            <div className='relative min-w-0'>
              <TextArea
                className={cn(
                  `w-full min-w-0 resize-none bg-transparent pr-10 text-[20px] leading-6
                   text-light-primary outline-none placeholder:text-light-secondary
                   dark:text-dark-primary dark:placeholder:text-dark-secondary`,
                  overLimit && 'text-accent-red'
                )}
                value={text}
                placeholder='Add another Tweet'
                minRows={2}
                maxRows={8}
                readOnly={disabled}
                onChange={({ target: { value } }): void =>
                  updateThreadItem(id, value)
                }
                ref={setThreadInputRef(id)}
              />
              <Button
                className='dark-bg-tab absolute right-0 top-[-2px] h-8 w-8 rounded-full p-0 text-light-secondary
                           hover:bg-accent-red/10 hover:text-accent-red
                           active:bg-accent-red/20 dark:text-dark-secondary'
                aria-label='Remove Tweet from thread'
                title='Remove Tweet from thread'
                disabled={disabled}
                onClick={(): void => removeThreadItem(id)}
              >
                <HeroIcon className='h-4 w-4' iconName='XMarkIcon' />
              </Button>
              {showCount && (
                <p
                  className={cn(
                    'mt-1 text-right text-[13px] leading-4 text-light-secondary dark:text-dark-secondary',
                    overLimit && 'font-bold text-accent-red'
                  )}
                >
                  {remaining}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Input({
  modal,
  reply,
  compactReply,
  focusSignal,
  parent,
  disabled,
  children,
  quoteTweet,
  replyModal,
  closeModal,
  onTweetSent
}: InputProps): JSX.Element {
  const [selectedImages, setSelectedImages] = useState<FilesWithId>([]);
  const [imagesPreview, setImagesPreview] = useState<ImagesPreview>([]);
  const [selectedGifCard, setSelectedGifCard] = useState<TweetCard | null>(
    null
  );
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [visited, setVisited] = useState(false);
  const [replySetting, setReplySetting] =
    useState<TweetReplySetting>('everyone');
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [availableDrafts, setAvailableDrafts] = useState<LocalTweetDraft[]>([]);
  const [hydratedDraftId, setHydratedDraftId] = useState<string | null>(null);
  const [pendingUndoTweet, setPendingUndoTweet] =
    useState<UndoTweetPending | null>(null);
  const [threadItems, setThreadItems] = useState<ThreadComposerItem[]>([]);

  const { user } = useAuth();
  const activeUser = user as User;
  const { id: userId, name, username, photoURL } = activeUser;
  const { undoTweetSettings } = useUndoTweetSettings();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>(
    {}
  );
  const undoTweetTimeoutRef = useRef<number | null>(null);
  const pendingUndoTweetRef = useRef<UndoTweetPending | null>(null);
  const quotedTweetId = quoteTweet?.id ?? null;
  const draftScope = useMemo<TweetDraftScope>(
    () => ({
      userId,
      type: quotedTweetId ? 'quote' : reply || replyModal ? 'reply' : 'tweet',
      parentId: parent?.id ?? null,
      parentUsername: parent?.username ?? null,
      quoteTweetId: quotedTweetId
    }),
    [parent?.id, parent?.username, quotedTweetId, reply, replyModal, userId]
  );
  const currentDraftId = useMemo(
    () => getTweetDraftId(draftScope),
    [draftScope]
  );
  const youtubeCard = useMemo(
    () => createYouTubeCardFromText(inputValue),
    [inputValue]
  );
  const detectedPostLink = useMemo(
    () => (quoteTweet ? null : getBskyPostLinkFromText(inputValue)),
    [inputValue, quoteTweet]
  );
  const linkedQuoteTweet = useLinkedTweet(detectedPostLink);
  const linkedQuoteIsCurrent = !!linkedQuoteTweet;
  const activeQuoteTweet =
    quoteTweet ?? (linkedQuoteIsCurrent ? linkedQuoteTweet : null);
  const submittedText = useMemo(
    () =>
      linkedQuoteIsCurrent && detectedPostLink
        ? removeBskyPostLinkFromText(inputValue, detectedPostLink)
        : canonicalizeBskyPostLinksInText(inputValue),
    [detectedPostLink, inputValue, linkedQuoteIsCurrent]
  );

  const previewCount = imagesPreview.length;
  const isUploadingImages = !!previewCount;
  const activeExternalCard =
    selectedGifCard ??
    (!isUploadingImages && !activeQuoteTweet ? youtubeCard : null);

  const refreshAvailableDrafts = useCallback((): void => {
    setAvailableDrafts(getTweetDraftsForUser(userId, draftScope.type));
  }, [draftScope.type, userId]);

  useEffect(() => {
    setHydratedDraftId(null);

    const draft = getTweetDraft(draftScope);

    if (draft) {
      setInputValue(draft.text);
      setReplySetting(draft.replySetting ?? 'everyone');
      setSelectedGifCard(draft.gifCard);
      setImagesPreview(draft.gifPreview ? [draft.gifPreview] : []);
      setSelectedImages([]);
      setThreadItems([]);
      setVisited(!!draft.text.trim() || !!draft.gifPreview);
    }

    setHydratedDraftId(getTweetDraftId(draftScope));
  }, [draftScope]);

  useEffect(() => {
    refreshAvailableDrafts();

    window.addEventListener(tweetDraftsChangedEvent, refreshAvailableDrafts);

    return () =>
      window.removeEventListener(
        tweetDraftsChangedEvent,
        refreshAvailableDrafts
      );
  }, [refreshAvailableDrafts]);

  useEffect(() => {
    if (hydratedDraftId !== currentDraftId) return;

    const gifPreview = selectedGifCard
      ? (imagesPreview.find(({ type }) => type === 'gif') ?? null)
      : null;

    saveTweetDraft(draftScope, {
      text: inputValue,
      replySetting,
      gifCard: selectedGifCard,
      gifPreview
    });
  }, [
    currentDraftId,
    draftScope,
    hydratedDraftId,
    imagesPreview,
    inputValue,
    replySetting,
    selectedGifCard
  ]);

  useEffect(
    () => {
      if (modal) inputRef.current?.focus();
      return cleanImage;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (!focusSignal) return;

    setVisited(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [focusSignal]);

  const clearCurrentDraft = useCallback((): void => {
    deleteTweetDraft(draftScope);
    refreshAvailableDrafts();
  }, [draftScope, refreshAvailableDrafts]);

  const clearUndoTweetTimer = (): void => {
    if (!undoTweetTimeoutRef.current) return;

    window.clearTimeout(undoTweetTimeoutRef.current);
    undoTweetTimeoutRef.current = null;
  };

  const clearPendingUndoTweet = (): void => {
    clearUndoTweetTimer();
    pendingUndoTweetRef.current = null;
    setPendingUndoTweet(null);
  };

  const createSubmissionSnapshot = (): TweetSubmissionSnapshot => ({
    text: submittedText,
    selectedImages: [...selectedImages],
    imagesPreview: imagesPreview.map((preview) => ({ ...preview })),
    selectedGifCard,
    externalCard: activeExternalCard,
    quoteTweet: activeQuoteTweet,
    parent,
    isReplying: !!(reply ?? replyModal),
    replySetting,
    threadItems: threadItems.map((item) => ({ ...item }))
  });

  const publishSingleTweet = async (
    snapshot: TweetSubmissionSnapshot
  ): Promise<TweetWithUser> => {
    const quotedTweet = snapshot.quoteTweet
      ? getQuotedTweetPreview(snapshot.quoteTweet)
      : null;
    const uploadedImages =
      (snapshot.selectedGifCard
        ? snapshot.imagesPreview
        : snapshot.selectedImages.length || snapshot.imagesPreview.length
          ? await uploadImages(
              userId,
              snapshot.selectedImages,
              snapshot.imagesPreview
            )
          : []) ?? [];

    const tweetData: WithFieldValue<TweetDraft> = {
      text: snapshot.text || null,
      langs: [],
      parent: snapshot.isReplying && snapshot.parent ? snapshot.parent : null,
      images: uploadedImages,
      mediaWarning: null,
      card: snapshot.externalCard,
      quotedTweet,
      userLikes: [],
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: null,
      userReplies: 0,
      userRetweets: [],
      userQuotes: 0,
      bookmarkCount: 0,
      replySetting: snapshot.isReplying ? undefined : snapshot.replySetting,
      quoteTarget: snapshot.quoteTweet
        ? {
            id: snapshot.quoteTweet.id,
            createdBy: snapshot.quoteTweet.createdBy
          }
        : undefined
    };

    await sleep(500);

    const [tweetRef] = await Promise.all([
      addDoc(tweetsCollection, tweetData as WithFieldValue<Omit<Tweet, 'id'>>),
      manageTotalTweets('increment', userId),
      uploadedImages.length && manageTotalPhotos('increment', userId),
      snapshot.isReplying &&
        manageReply('increment', snapshot.parent?.id as string)
    ]);

    const tweetSnapshot = await getDoc(tweetRef);
    const createdTweet = tweetSnapshot.data();
    const tweetId = tweetSnapshot.id;

    return {
      ...createdTweet,
      id: tweetId,
      user: activeUser
    };
  };

  const publishTweet = async (
    snapshot: TweetSubmissionSnapshot
  ): Promise<void> => {
    inputRef.current?.blur();
    setLoading(true);

    try {
      const createdTweets: TweetWithUser[] = [];
      const firstTweet = await publishSingleTweet(snapshot);
      createdTweets.push(firstTweet);

      let parentTweet = firstTweet;

      for (const threadItem of snapshot.threadItems) {
        const threadSnapshot: TweetSubmissionSnapshot = {
          ...snapshot,
          text: threadItem.text,
          selectedImages: [],
          imagesPreview: [],
          selectedGifCard: null,
          externalCard: null,
          quoteTweet: null,
          parent: { id: parentTweet.id, username },
          isReplying: true,
          replySetting: 'everyone',
          threadItems: []
        };
        parentTweet = await publishSingleTweet(threadSnapshot);
        createdTweets.push(parentTweet);
      }

      const [rootTweet] = createdTweets;

      onTweetSent?.(rootTweet);

      clearCurrentDraft();

      if (!modal && !replyModal) discardTweet();

      if (closeModal) closeModal();

      toast.success(
        () => (
          <span className='flex gap-2'>
            {snapshot.threadItems.length
              ? 'Your Thread was sent'
              : 'Your Tweet was sent'}
            <Link
              href={getTweetPath(rootTweet.id, username)}
              className='custom-underline font-bold'
            >
              View
            </Link>
          </span>
        ),
        { duration: 6000 }
      );
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(
        message
          ? `Tweet could not be sent: ${message}`
          : 'Tweet could not be sent'
      );
    } finally {
      setLoading(false);
    }
  };

  const queueUndoTweet = (snapshot: TweetSubmissionSnapshot): void => {
    inputRef.current?.blur();
    setLoading(true);

    const pendingTweet: UndoTweetPending = {
      snapshot,
      expiresAt: Date.now() + undoTweetSettings.intervalSeconds * 1000,
      durationSeconds: undoTweetSettings.intervalSeconds
    };

    pendingUndoTweetRef.current = pendingTweet;
    setPendingUndoTweet(pendingTweet);

    undoTweetTimeoutRef.current = window.setTimeout(
      () => sendPendingUndoTweet(),
      undoTweetSettings.intervalSeconds * 1000
    );
  };

  const sendPendingUndoTweet = (): void => {
    const pendingTweet = pendingUndoTweetRef.current;

    if (!pendingTweet) return;

    clearPendingUndoTweet();
    void publishTweet(pendingTweet.snapshot);
  };

  const undoPendingTweet = (): void => {
    if (!pendingUndoTweetRef.current) return;

    clearPendingUndoTweet();
    setLoading(false);
    inputRef.current?.focus();
  };

  const sendTweet = async (): Promise<void> => {
    const snapshot = createSubmissionSnapshot();
    const undoTweetKind = getUndoTweetKind(snapshot);

    if (shouldUseUndoTweet(undoTweetSettings, undoTweetKind)) {
      queueUndoTweet(snapshot);
      return;
    }

    await publishTweet(snapshot);
  };

  useEffect(
    () => () => {
      clearPendingUndoTweet();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleImageUpload = (
    e: ChangeEvent<HTMLInputElement> | ClipboardEvent<HTMLTextAreaElement>
  ): void => {
    const isClipboardEvent = 'clipboardData' in e;

    if (isClipboardEvent) {
      const isPastingText = e.clipboardData.getData('text');
      if (isPastingText) return;
    }

    const files = isClipboardEvent ? e.clipboardData.files : e.target.files;

    if (selectedGifCard) {
      toast.error('Remove the GIF before adding photos or video.');
      return;
    }

    const imagesData = getImagesData(files, {
      currentFiles: previewCount,
      allowUploadingVideos: true
    });

    if (!imagesData) {
      toast.error(
        'Please choose up to 10 JPG, PNG, or WebP images, or one MP4 video.'
      );
      return;
    }

    const { imagesPreviewData, selectedImagesData } = imagesData;
    const hasCurrentVideo = selectedImages.some(isVideoFile);
    const hasNewVideo = selectedImagesData.some(isVideoFile);

    if (
      (hasCurrentVideo && selectedImagesData.length) ||
      (hasNewVideo &&
        (selectedImages.length > 0 || selectedImagesData.length > 1))
    ) {
      revokeImagePreviews(imagesPreviewData);
      toast.error('Bluesky allows either one video or up to 10 images.');
      return;
    }

    setImagesPreview([...imagesPreview, ...imagesPreviewData]);
    setSelectedImages([...selectedImages, ...selectedImagesData]);

    inputRef.current?.focus();
  };

  const removeImage = (targetId: string) => (): void => {
    const removedPreview = imagesPreview.find(({ id }) => id === targetId);

    setSelectedImages(selectedImages.filter(({ id }) => id !== targetId));
    setImagesPreview(imagesPreview.filter(({ id }) => id !== targetId));
    if (removedPreview?.type === 'gif') setSelectedGifCard(null);

    if (removedPreview) revokePreviewUrl(removedPreview.src);
  };

  const updateImageAltText = (targetId: string, altText: string): void => {
    const normalizedAltText = altText.trim();

    setImagesPreview((currentPreviews) =>
      currentPreviews.map((preview) =>
        preview.id === targetId
          ? { ...preview, altText: normalizedAltText || null }
          : preview
      )
    );
  };

  const cleanImage = (): void => {
    revokeImagePreviews(imagesPreview);

    setSelectedImages([]);
    setImagesPreview([]);
    setSelectedGifCard(null);
  };

  const resetComposer = (): void => {
    setInputValue('');
    setThreadItems([]);
    setVisited(false);
    setReplySetting('everyone');
    cleanImage();
  };

  const discardTweet = (): void => {
    clearCurrentDraft();
    resetComposer();
    inputRef.current?.blur();
  };

  const openDraftsModal = (): void => {
    refreshAvailableDrafts();
    setDraftsOpen(true);
  };

  const closeDraftsModal = (): void => setDraftsOpen(false);

  const selectDraft = (draft: LocalTweetDraft): void => {
    setInputValue(draft.text);
    setReplySetting(draft.replySetting ?? 'everyone');
    setSelectedGifCard(draft.gifCard);
    setImagesPreview(draft.gifPreview ? [draft.gifPreview] : []);
    setSelectedImages([]);
    setThreadItems([]);
    setVisited(!!draft.text.trim() || !!draft.gifPreview);
    setDraftsOpen(false);

    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const deleteDraft = (draftId: string): void => {
    deleteTweetDraft(draftId);
    refreshAvailableDrafts();

    if (draftId === currentDraftId) resetComposer();
  };

  const handleChange = ({
    target: { value }
  }: ChangeEvent<HTMLTextAreaElement>): void => setInputValue(value);

  const setThreadInputRef =
    (id: string) =>
    (node: HTMLTextAreaElement | null): void => {
      threadInputRefs.current[id] = node;
    };

  const updateThreadItem = (id: string, text: string): void => {
    setThreadItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? { ...item, text } : item))
    );
  };

  const removeThreadItem = (id: string): void => {
    setThreadItems((currentItems) =>
      currentItems.filter((item) => item.id !== id)
    );
    delete threadInputRefs.current[id];
  };

  const addThreadItem = (): void => {
    const nextItem = createThreadComposerItem();
    setThreadItems((currentItems) => [...currentItems, nextItem]);

    requestAnimationFrame(() => {
      threadInputRefs.current[nextItem.id]?.focus();
    });
  };

  const handleEmojiSelect = (emoji: string): void => {
    const input = inputRef.current;
    const selectionStart = input?.selectionStart ?? inputValue.length;
    const selectionEnd = input?.selectionEnd ?? inputValue.length;
    const nextValue = `${inputValue.slice(
      0,
      selectionStart
    )}${emoji}${inputValue.slice(selectionEnd)}`;
    const nextCursorPosition = selectionStart + emoji.length;

    setInputValue(nextValue);

    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handleHashtagSelect = (
    tag: string,
    { start, end }: ActiveHashtag
  ): void => {
    const input = inputRef.current;
    const hashtag = getHashtagSearchQuery(tag);
    const suffix = inputValue[end] && !/\s/.test(inputValue[end]) ? ' ' : '';
    const nextValue = `${inputValue.slice(
      0,
      start
    )}${hashtag}${suffix}${inputValue.slice(end)}`;
    const nextCursorPosition = start + hashtag.length + suffix.length;

    setInputValue(nextValue);

    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handleMentionSelect = (
    username: string,
    { start, end }: ActiveMention
  ): void => {
    const input = inputRef.current;
    const mention = `@${normalizeMention(username)}`;
    const suffix = inputValue[end] && /\s/.test(inputValue[end]) ? '' : ' ';
    const nextValue = `${inputValue.slice(
      0,
      start
    )}${mention}${suffix}${inputValue.slice(end)}`;
    const nextCursorPosition = start + mention.length + suffix.length;

    setInputValue(nextValue);

    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handleGifSelect = ({
    id,
    title,
    src,
    preview,
    aspectRatio
  }: GifSelection): void => {
    if (previewCount || selectedImages.length) {
      toast.error('GIFs cannot be mixed with photos or videos on Bluesky.');
      return;
    }

    const gifPreview = {
      id: `gif-${id}`,
      src,
      alt: title,
      type: 'gif',
      poster: preview,
      aspectRatio
    };

    setSelectedGifCard(createGifCard({ id, title, src, preview, aspectRatio }));
    setImagesPreview([gifPreview]);
    setSelectedImages([]);

    inputRef.current?.focus();
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!isValidTweet || loading || pendingUndoTweet) return;
    void sendTweet();
  };

  const handleFocus = (): void => setVisited(!loading && !pendingUndoTweet);

  const formId = useId();

  const inputLimit = BLUESKY_POST_GRAPHEME_LIMIT;
  const quotedTweetPreview = activeQuoteTweet
    ? getQuotedTweetPreview(activeQuoteTweet)
    : null;
  const shouldCompactQuotedTweetPreview =
    isUploadingImages || !!activeExternalCard;
  const showModalHeader = !!modal && !!closeModal;
  const isUndoTweetPending = !!pendingUndoTweet;

  const inputLength = useMemo(
    () => getPostGraphemeLength(submittedText),
    [submittedText]
  );
  const isValidInput = !!submittedText.length;
  const isCharLimitExceeded = inputLength > inputLimit;
  const hasThreadItems = threadItems.length > 0;
  const areThreadItemsValid = threadItems.every(({ text }) =>
    isValidThreadText(text)
  );
  const lastThreadItem = threadItems[threadItems.length - 1];

  const isValidSingleTweet =
    !isCharLimitExceeded &&
    (isValidInput || isUploadingImages || !!activeQuoteTweet);
  const isValidTweet =
    isValidSingleTweet && (!hasThreadItems || areThreadItemsValid);
  const canAddThreadItem =
    !reply &&
    !replyModal &&
    !quoteTweet &&
    !activeQuoteTweet &&
    !loading &&
    !pendingUndoTweet &&
    (lastThreadItem
      ? isValidThreadText(lastThreadItem.text)
      : isValidSingleTweet);

  return (
    <form
      className={cn('flex flex-col', {
        '-mx-4': reply,
        'gap-2': replyModal,
        'cursor-not-allowed': disabled
      })}
      onSubmit={handleSubmit}
    >
      <TweetDraftsModal
        open={draftsOpen}
        drafts={availableDrafts}
        currentDraftId={currentDraftId}
        closeModal={closeDraftsModal}
        selectDraft={selectDraft}
        deleteDraft={deleteDraft}
      />
      {loading && !isUndoTweetPending && (
        <motion.div
          className='relative h-0.5 overflow-hidden bg-main-accent/20'
          role='progressbar'
          aria-label='Sending Tweet'
          aria-valuetext='Sending Tweet'
          {...variants}
        >
          <motion.span
            className='absolute inset-y-0 left-0 w-[38%] bg-main-accent'
            initial={{ x: '-110%' }}
            animate={{ x: '290%' }}
            transition={{
              duration: 1.05,
              ease: 'easeInOut',
              repeat: Infinity
            }}
          />
        </motion.div>
      )}
      {showModalHeader && (
        <header
          className='flex h-[53px] shrink-0 items-center justify-between border-b
                     border-light-border px-2 dark:border-dark-border'
        >
          <Button
            className='dark-bg-tab group relative h-9 w-9 rounded-full p-0
                       hover:bg-light-primary/10 active:bg-light-primary/20
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
            aria-label='Close'
            onClick={closeModal}
          >
            <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
          </Button>
          {isUndoTweetPending ? (
            <span className='pr-4 text-xl font-bold'>Tweet</span>
          ) : !quoteTweet ? (
            <Button
              className='accent-tab accent-bg-tab px-4 py-2 text-[15px] font-bold
                         leading-5 text-main-accent hover:bg-main-accent/10
                         active:bg-main-accent/20'
              onClick={openDraftsModal}
            >
              Unsent Tweets
            </Button>
          ) : null}
        </header>
      )}
      {children}
      {reply && visited && (
        <motion.p
          className={cn(
            '-mb-2 mt-2 text-light-secondary dark:text-dark-secondary',
            compactReply ? 'ml-[68px]' : 'ml-[75px]'
          )}
          {...fromTop}
        >
          Replying to{' '}
          <Link
            href={getUserPath(parent?.username as string)}
            className='custom-underline text-main-accent'
          >
            {parent?.username as string}
          </Link>
        </motion.p>
      )}
      <label
        className={cn(
          'hover-animation grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3',
          reply
            ? 'pt-3 pb-1'
            : replyModal
              ? 'pt-0'
              : modal
                ? 'pb-4'
                : 'border-b border-light-border dark:border-dark-border',
          compactReply && 'pr-5',
          (disabled || (loading && !isUndoTweetPending)) &&
            'pointer-events-none opacity-50'
        )}
        htmlFor={formId}
      >
        <UserAvatar
          size={compactReply ? 40 : undefined}
          src={photoURL}
          alt={name}
          username={username}
        />
        <div className='flex w-full min-w-0 flex-col gap-4'>
          {isUndoTweetPending && (
            <div className='flex flex-col leading-5'>
              <span className='font-bold'>{name}</span>
              <span className='text-light-secondary dark:text-dark-secondary'>
                @{username}
              </span>
            </div>
          )}
          <InputForm
            modal={modal}
            reply={reply}
            quote={!!activeQuoteTweet}
            formId={formId}
            visited={visited}
            loading={loading}
            readOnly={isUndoTweetPending}
            inputRef={inputRef}
            replyModal={replyModal}
            inputValue={inputValue}
            replySetting={replySetting}
            isValidTweet={isValidTweet}
            isUploadingImages={isUploadingImages}
            setReplySetting={setReplySetting}
            sendTweet={sendTweet}
            handleHashtagSelect={handleHashtagSelect}
            handleMentionSelect={handleMentionSelect}
            handleFocus={handleFocus}
            discardTweet={discardTweet}
            handleChange={handleChange}
            handleImageUpload={handleImageUpload}
          >
            <ThreadComposerStack
              items={threadItems}
              inputLimit={inputLimit}
              disabled={loading || isUndoTweetPending}
              photoURL={photoURL}
              name={name}
              username={username}
              setThreadInputRef={setThreadInputRef}
              updateThreadItem={updateThreadItem}
              removeThreadItem={removeThreadItem}
            />
            {isUploadingImages && (
              <ImagePreview
                imagesPreview={imagesPreview}
                previewCount={previewCount}
                removeImage={!loading ? removeImage : undefined}
                updateAltText={!loading ? updateImageAltText : undefined}
              />
            )}
            {youtubeCard &&
              !activeQuoteTweet &&
              !selectedGifCard &&
              !isUploadingImages && (
                <div className='min-w-0 max-w-full overflow-hidden'>
                  <TweetEmbed card={youtubeCard} quotedTweet={null} />
                </div>
              )}
            {quotedTweetPreview && (
              <div className='min-w-0 max-w-full overflow-hidden'>
                <TweetEmbed
                  card={null}
                  quotedTweet={quotedTweetPreview}
                  hideQuotedTweetMedia={shouldCompactQuotedTweetPreview}
                />
              </div>
            )}
          </InputForm>
          <AnimatePresence initial={false}>
            {(reply ? reply && visited && !loading : !loading) && (
              <InputOptions
                reply={reply}
                modal={modal}
                inputLimit={inputLimit}
                inputLength={inputLength}
                isValidTweet={isValidTweet}
                isCharLimitExceeded={isCharLimitExceeded}
                hideSubmit={isUndoTweetPending}
                canAddThreadItem={canAddThreadItem}
                onAddThreadItem={addThreadItem}
                handleImageUpload={handleImageUpload}
                handleEmojiSelect={handleEmojiSelect}
                handleGifSelect={handleGifSelect}
              />
            )}
          </AnimatePresence>
        </div>
        {pendingUndoTweet && (
          <div className='col-span-2'>
            <UndoTweetComposerStatus
              expiresAt={pendingUndoTweet.expiresAt}
              durationSeconds={pendingUndoTweet.durationSeconds}
              onUndo={undoPendingTweet}
              onSendNow={sendPendingUndoTweet}
            />
          </div>
        )}
      </label>
    </form>
  );
}
