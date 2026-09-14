/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type JSX } from 'react';
import { Dialog } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { useModal } from '@lib/hooks/useModal';
import { preventBubbling } from '@lib/utils';
import { ImageModal } from '@components/modal/image-modal';
import { Modal } from '@components/modal/modal';
import { NextImage } from '@components/ui/next-image';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { TwitterVideoPlayer } from '@components/ui/twitter-video-player';
import { TweetTombstone } from '@components/tweet/tweet-tombstone';
import { TwitterGifMedia, isGifMedia } from './twitter-gif-media';
import type { MotionProps } from 'framer-motion';
import type { ChangeEvent, CSSProperties, KeyboardEvent } from 'react';
import type { ImagesPreview, ImageData } from '@lib/types/file';
import type { TweetMediaWarning, TweetWithUser } from '@lib/types/tweet';

type ImagePreviewProps = {
  tweet?: boolean;
  viewTweet?: boolean;
  previewCount: number;
  imagesPreview: ImagesPreview;
  moderationWarning?: TweetMediaWarning | null;
  tweetData?: TweetWithUser;
  removeImage?: (targetId: string) => () => void;
  updateAltText?: (targetId: string, altText: string) => void;
};

const variants: MotionProps = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.15, ease: 'easeOut' }
  },
  exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeOut' } }
};

type PostImageBorderRadius = Record<number, string[]>;

const postImageBorderRadius: Readonly<PostImageBorderRadius> = {
  1: ['rounded-2xl'],
  2: ['rounded-tl-2xl rounded-bl-2xl', 'rounded-tr-2xl rounded-br-2xl'],
  3: ['rounded-tl-2xl rounded-bl-2xl', 'rounded-tr-2xl', 'rounded-br-2xl'],
  4: ['rounded-tl-2xl', 'rounded-tr-2xl', 'rounded-bl-2xl', 'rounded-br-2xl']
};

const DEFAULT_TWEET_MEDIA_RATIO = 16 / 9;
const MIN_SINGLE_TWEET_MEDIA_RATIO = 4 / 5;
const MAX_SINGLE_TWEET_MEDIA_RATIO = 16 / 9;
const ALT_TEXT_LIMIT = 1000;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isVideoMedia({ src, type }: ImageData): boolean {
  return (
    !!type?.includes('video') || /\.(m3u8|mp4|mov|m4v|webm)($|\?)/i.test(src)
  );
}

function getSingleGifStyle(
  media: ImageData | undefined
): CSSProperties | undefined {
  if (!media || !isGifMedia(media)) return undefined;

  const { aspectRatio } = media;
  const width =
    aspectRatio?.width && aspectRatio.width > 0 ? aspectRatio.width : 16;
  const height =
    aspectRatio?.height && aspectRatio.height > 0 ? aspectRatio.height : 9;

  return { aspectRatio: `${width} / ${height}` };
}

function getMediaRatio(media: ImageData | undefined): number {
  if (!media) return DEFAULT_TWEET_MEDIA_RATIO;

  const width = media.aspectRatio?.width;
  const height = media.aspectRatio?.height;

  if (!width || !height || width <= 0 || height <= 0)
    return DEFAULT_TWEET_MEDIA_RATIO;

  return width / height;
}

function getTweetMediaStyle({
  isTweet,
  previewCount,
  media
}: {
  isTweet: boolean | undefined;
  previewCount: number;
  media: ImageData | undefined;
}): CSSProperties | undefined {
  if (previewCount !== 1) return undefined;

  if (!isTweet) return getSingleGifStyle(media);

  const clampedRatio = clampNumber(
    getMediaRatio(media),
    MIN_SINGLE_TWEET_MEDIA_RATIO,
    MAX_SINGLE_TWEET_MEDIA_RATIO
  );

  return { aspectRatio: `${clampedRatio} / 1` };
}

function getMediaAltText(media: ImageData | undefined): string {
  return media?.altText?.trim() ?? '';
}

type AltTextModalProps = {
  media: ImagesPreview[number];
  editable: boolean;
  value: string;
  setValue: (value: string) => void;
  closeModal: () => void;
  saveAltText: () => void;
};

function AltTextModal({
  media,
  editable,
  value,
  setValue,
  closeModal,
  saveAltText
}: AltTextModalProps): JSX.Element {
  const altText = getMediaAltText(media);
  const mediaKind = isVideoMedia(media) ? 'Video' : 'Image';
  const characterCount = Array.from(value).length;
  const overLimit = characterCount > ALT_TEXT_LIMIT;

  const handleChange = ({
    target: { value: nextValue }
  }: ChangeEvent<HTMLTextAreaElement>): void => setValue(nextValue);

  return (
    <div
      className='w-full overflow-hidden rounded-2xl bg-main-background text-light-primary shadow-xl
                 dark:text-dark-primary xs:w-[600px]'
      onClick={preventBubbling(null, true)}
    >
      <header
        className='flex h-[53px] items-center border-b border-light-border px-2
                   dark:border-dark-border'
      >
        <Button
          className='dark-bg-tab group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0
                     hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          aria-label='Close'
          onClick={closeModal}
        >
          <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
        </Button>
        <Dialog.Title className='ml-5 text-xl font-bold leading-6'>
          {mediaKind} description
        </Dialog.Title>
        {editable && (
          <Button
            className='accent-tab ml-auto rounded-full bg-light-primary px-4 py-1.5 text-[15px]
                       font-bold leading-5 text-white transition hover:bg-light-primary/90
                       active:bg-light-primary/80 disabled:opacity-50 dark:bg-light-border
                       dark:text-light-primary dark:hover:bg-light-border/90'
            disabled={overLimit}
            onClick={saveAltText}
          >
            Done
          </Button>
        )}
      </header>
      <div className='px-4 py-3'>
        {editable ? (
          <>
            <textarea
              className='min-h-[160px] w-full resize-none rounded-md border border-light-border
                         bg-transparent p-3 text-[17px] leading-6 outline-none transition
                         placeholder:text-light-secondary focus:border-main-accent
                         dark:border-dark-border dark:placeholder:text-dark-secondary'
              maxLength={ALT_TEXT_LIMIT}
              placeholder='Description'
              value={value}
              onChange={handleChange}
              autoFocus
            />
            <div
              className={cn(
                'mt-2 text-right text-[13px] leading-4',
                overLimit
                  ? 'text-accent-red'
                  : 'text-light-secondary dark:text-dark-secondary'
              )}
            >
              {characterCount}/{ALT_TEXT_LIMIT}
            </div>
          </>
        ) : (
          <Dialog.Description className='max-h-[50vh] whitespace-pre-wrap break-words text-[17px] leading-6'>
            {altText}
          </Dialog.Description>
        )}
      </div>
    </div>
  );
}

export function ImagePreview({
  tweet,
  viewTweet,
  previewCount,
  imagesPreview,
  moderationWarning,
  tweetData,
  removeImage,
  updateAltText
}: ImagePreviewProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [warningRevealed, setWarningRevealed] = useState(false);
  const [altTextMedia, setAltTextMedia] = useState<
    ImagesPreview[number] | null
  >(null);
  const [altTextValue, setAltTextValue] = useState('');

  const { open, openModal, closeModal } = useModal();

  useEffect(() => {
    const imageData = imagesPreview[selectedIndex];
    setSelectedImage(imageData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  useEffect(() => {
    setWarningRevealed(false);
  }, [moderationWarning?.label, imagesPreview]);

  const handleSelectedImage = (index: number) => () => {
    setSelectedImage(imagesPreview[index]);
    setSelectedIndex(index);
    openModal();
  };

  const closeAltTextModal = (): void => {
    setAltTextMedia(null);
    setAltTextValue('');
  };

  const openAltTextModal = (media: ImagesPreview[number]) => (): void => {
    setAltTextMedia(media);
    setAltTextValue(getMediaAltText(media));
  };

  const saveAltText = (): void => {
    if (!altTextMedia || !updateAltText) return;

    updateAltText(altTextMedia.id, altTextValue);
    closeAltTextModal();
  };

  const handleNextIndex = (type: 'prev' | 'next') => () => {
    const mediaCount =
      imagesPreview.length > 0 ? imagesPreview.length : previewCount;
    const nextIndex =
      type === 'prev'
        ? selectedIndex === 0
          ? mediaCount - 1
          : selectedIndex - 1
        : selectedIndex === mediaCount - 1
          ? 0
          : selectedIndex + 1;

    setSelectedImage(imagesPreview[nextIndex]);
    setSelectedIndex(nextIndex);
  };

  const isTweet = tweet ?? viewTweet;
  const mediaCount =
    imagesPreview.length > 0 ? imagesPreview.length : previewCount;
  const useCarousel = isTweet && mediaCount > 4;
  const visibleMedia = useCarousel ? imagesPreview : imagesPreview.slice(0, 4);
  const visiblePreviewCount = Math.min(mediaCount, 4);
  const firstMedia = imagesPreview[0];
  const singleMedia = !useCarousel && visiblePreviewCount === 1;
  const tweetMediaStyle = getTweetMediaStyle({
    isTweet,
    previewCount: singleMedia ? visiblePreviewCount : visibleMedia.length,
    media: firstMedia
  });
  const singleGif = singleMedia && !!firstMedia && isGifMedia(firstMedia);
  const draftSingleGif = singleGif && !isTweet;
  const currentImage = selectedImage ?? imagesPreview[selectedIndex];
  const shouldWarnMedia = !!moderationWarning && !warningRevealed;

  if (shouldWarnMedia)
    return (
      <TweetTombstone
        kind={
          moderationWarning.noOverride ? 'age-restricted' : 'sensitive-media'
        }
        className='mt-2 w-full text-left'
        onView={
          moderationWarning.noOverride
            ? undefined
            : (): void => setWarningRevealed(true)
        }
      />
    );

  return (
    <div
      className={cn(
        useCarousel
          ? 'relative flex w-full gap-2 overflow-x-auto overflow-y-hidden py-2 scrollbar-hidden snap-x snap-mandatory rounded-2xl'
          : 'relative grid rounded-2xl',
        !useCarousel &&
          (singleMedia ? 'grid-cols-1 grid-rows-1' : 'grid-cols-2 grid-rows-2'),
        isTweet
          ? `dark:bg-dark-hover mt-2 w-full border border-light-border
             bg-light-line-reply dark:border-dark-border`
          : draftSingleGif
            ? 'mt-2 w-full overflow-hidden border border-light-border dark:border-dark-border'
            : !useCarousel
              ? 'h-[42vw] gap-3 xs:h-[37vw] md:h-[271px]'
              : '',
        !useCarousel && isTweet && 'overflow-hidden',
        !useCarousel && isTweet && singleMedia && 'max-h-[510px] min-h-[188px]',
        !useCarousel &&
          isTweet &&
          !singleMedia &&
          (viewTweet
            ? 'aspect-[16/9] max-h-[420px] min-h-[190px]'
            : 'aspect-[16/9] max-h-[285px] min-h-[180px]'),
        !useCarousel &&
          !isTweet &&
          draftSingleGif &&
          'max-h-[510px] min-h-[188px] gap-0',
        !useCarousel && isTweet && 'gap-0.5'
      )}
      style={useCarousel ? undefined : tweetMediaStyle}
    >
      <Modal
        modalClassName={cn(
          tweetData
            ? 'relative flex h-screen w-screen items-stretch overflow-hidden bg-black text-white'
            : 'flex justify-center w-full items-center relative',
          isTweet && !tweetData && 'h-full'
        )}
        className={tweetData ? '!overflow-hidden !p-0' : undefined}
        open={open}
        closeModal={closeModal}
        closePanelOnClick
      >
        <ImageModal
          tweet={isTweet}
          imageData={currentImage as ImageData}
          previewCount={mediaCount}
          tweetData={tweetData}
          selectedIndex={selectedIndex}
          handleNextIndex={handleNextIndex}
          closeModal={closeModal}
        />
      </Modal>
      <Modal
        modalClassName='w-full max-w-[600px]'
        open={!!altTextMedia}
        closeModal={closeAltTextModal}
      >
        {altTextMedia && (
          <AltTextModal
            media={altTextMedia}
            editable={!!updateAltText}
            value={altTextValue}
            setValue={setAltTextValue}
            saveAltText={saveAltText}
            closeModal={closeAltTextModal}
          />
        )}
      </Modal>
      <AnimatePresence>
        {visibleMedia.map((media, index) => {
          const { id, src, alt, poster, viewCount } = media;
          const isGif = isGifMedia(media);
          const isVideo = isVideoMedia(media) && !isGif;
          const mediaDescriptionKind = isVideo ? 'video' : 'image';
          const mediaAltText = getMediaAltText(media);
          const showAltTextBadge = !!mediaAltText || !!updateAltText;
          const imageRadius = isTweet
            ? (postImageBorderRadius[visiblePreviewCount][index] ??
              'rounded-2xl')
            : 'rounded-2xl';
          const shouldCropImage =
            Boolean(isTweet) || visiblePreviewCount > 1 || useCarousel;
          const carouselItemWidth = useCarousel
            ? 'w-[86vw] max-w-[560px] shrink-0 snap-center'
            : '';
          const carouselItemAspect = useCarousel ? 'aspect-[16/9]' : '';
          const mediaKey = `${id ?? src}-${index}`;
          const openPreview = handleSelectedImage(index);
          const handlePreviewKeyDown = (
            event: KeyboardEvent<HTMLDivElement>
          ): void => {
            if (event.key !== 'Enter' && event.key !== ' ') return;

            event.preventDefault();
            event.stopPropagation();
            openPreview();
          };

          return (
            <motion.div
              className={cn(
                'accent-tab group relative overflow-hidden transition-shadow',
                carouselItemWidth,
                carouselItemAspect,
                imageRadius,
                {
                  'col-span-1 row-span-1':
                    !useCarousel && visiblePreviewCount === 1,
                  'row-span-2':
                    !useCarousel &&
                    (visiblePreviewCount === 2 ||
                      (index === 0 && visiblePreviewCount === 3))
                }
              )}
              role={isGif ? undefined : 'button'}
              tabIndex={isGif ? undefined : 0}
              aria-label={isGif ? undefined : `Open image ${index + 1}`}
              {...variants}
              onClick={isGif ? preventBubbling() : preventBubbling(openPreview)}
              onKeyDown={isGif ? undefined : handlePreviewKeyDown}
              key={mediaKey}
            >
              {isGif ? (
                <TwitterGifMedia media={media} className={imageRadius} />
              ) : isVideo ? (
                <>
                  <Button
                    className='visible absolute top-0 right-0 z-10 -translate-x-1 translate-y-1 
                               bg-light-primary/75 p-1 opacity-0 backdrop-blur-sm transition
                               hover:bg-image-preview-hover/75 group-hover:opacity-100 xs:invisible'
                    onClick={preventBubbling(handleSelectedImage(index))}
                  >
                    <HeroIcon className='h-5 w-5' iconName='ArrowUpRightIcon' />
                  </Button>
                  <TwitterVideoPlayer
                    className={imageRadius}
                    videoClassName='object-center'
                    src={src}
                    poster={poster ?? undefined}
                    muted={!isTweet}
                    compact={!isTweet || visiblePreviewCount > 1}
                    viewCount={viewCount}
                  />
                </>
              ) : (
                <NextImage
                  className='relative h-full w-full cursor-pointer transition-colors duration-200'
                  imgClassName={cn(
                    imageRadius,
                    shouldCropImage && 'object-cover object-center'
                  )}
                  previewCount={
                    shouldCropImage ? undefined : visiblePreviewCount
                  }
                  layout='fill'
                  src={src}
                  alt={mediaAltText || alt}
                  useSkeleton={isTweet}
                />
              )}
              {showAltTextBadge && !isGif && (
                <Button
                  className={cn(
                    `absolute bottom-0 left-0 z-10 m-2 rounded-md bg-black/70 px-2
                     py-0.5 text-[13px] font-extrabold leading-4 text-white
                     backdrop-blur-sm transition hover:bg-black/80 focus-visible:ring-2
                     focus-visible:ring-white/70 active:bg-black/90`,
                    !mediaAltText && 'bg-black/55 text-white/90'
                  )}
                  aria-label={
                    updateAltText
                      ? `${
                          mediaAltText ? 'Edit' : 'Add'
                        } ${mediaDescriptionKind} description`
                      : `View ${mediaDescriptionKind} description`
                  }
                  onClick={preventBubbling(openAltTextModal(media))}
                >
                  {updateAltText && !mediaAltText ? '+ALT' : 'ALT'}
                </Button>
              )}
              {removeImage && (
                <Button
                  className={cn(
                    `group absolute top-0 left-0 translate-x-1 translate-y-1
                     bg-light-primary/75 p-1 backdrop-blur-sm hover:bg-image-preview-hover/75`,
                    draftSingleGif &&
                      `active:bg-black/85 translate-x-2 translate-y-2 bg-black/60 text-white
                       hover:bg-black/75`
                  )}
                  onClick={preventBubbling(removeImage(id))}
                >
                  <HeroIcon
                    className='h-5 w-5 text-white'
                    iconName='XMarkIcon'
                  />
                  <ToolTip className='translate-y-2' tip='Remove' />
                </Button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
