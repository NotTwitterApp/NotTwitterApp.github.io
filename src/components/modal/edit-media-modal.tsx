/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import cn from 'clsx';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import type {
  ChangeEvent,
  CSSProperties,
  PointerEvent as ReactPointerEvent
} from 'react';
import type { FileWithId } from '@lib/types/file';

type MediaType = 'cover' | 'profile';

export type EditableProfileMedia = {
  type: MediaType;
  src: string;
  alt: string;
  file: FileWithId;
};

export type EditedProfileMedia = {
  previewSrc: string;
  file: FileWithId;
};

type EditMediaModalProps = {
  media: EditableProfileMedia;
  closeEditor: () => void;
  applyImage: (media: EditedProfileMedia) => void;
};

type Size = {
  width: number;
  height: number;
};

type Offset = {
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

const emptySize: Size = { width: 0, height: 0 };
const emptyOffset: Offset = { x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getOffsetBounds(displaySize: Size, frameSize: Size): Offset {
  return {
    x: Math.max((displaySize.width - frameSize.width) / 2, 0),
    y: Math.max((displaySize.height - frameSize.height) / 2, 0)
  };
}

function clampOffset(offset: Offset, bounds: Offset): Offset {
  return {
    x: clamp(offset.x, -bounds.x, bounds.x),
    y: clamp(offset.y, -bounds.y, bounds.y)
  };
}

function getCroppedFileName(name: string, type: string): string {
  const extension =
    type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png';
  const extensionPattern = /\.[^.]+$/;

  return extensionPattern.test(name)
    ? name.replace(extensionPattern, `.${extension}`)
    : `${name}.${extension}`;
}

function getCanvasType(type: string): string {
  return type === 'image/jpeg' || type === 'image/webp' ? type : 'image/png';
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Unable to crop image'));
      },
      type,
      0.92
    );
  });
}

export function EditMediaModal({
  media,
  closeEditor,
  applyImage
}: EditMediaModalProps): JSX.Element {
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>(emptyOffset);
  const [imageSize, setImageSize] = useState<Size>(emptySize);
  const [frameSize, setFrameSize] = useState<Size>(emptySize);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [applying, setApplying] = useState(false);

  const cover = media.type === 'cover';
  const ready =
    imageSize.width > 0 &&
    imageSize.height > 0 &&
    frameSize.width > 0 &&
    frameSize.height > 0;

  const baseScale = ready
    ? Math.max(
        frameSize.width / imageSize.width,
        frameSize.height / imageSize.height
      )
    : 1;

  const displaySize = useMemo(
    () => ({
      width: imageSize.width * baseScale * zoom,
      height: imageSize.height * baseScale * zoom
    }),
    [baseScale, imageSize.height, imageSize.width, zoom]
  );

  const offsetBounds = useMemo(
    () => getOffsetBounds(displaySize, frameSize),
    [displaySize, frameSize]
  );

  const imageStyle: CSSProperties = ready
    ? {
        width: `${displaySize.width}px`,
        height: `${displaySize.height}px`,
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translate3d(${offset.x}px, ${offset.y}px, 0)`
      }
    : {
        left: '50%',
        top: '50%',
        maxWidth: '100%',
        maxHeight: '100%',
        transform: 'translate(-50%, -50%)'
      };

  useEffect(() => {
    setZoom(1);
    setOffset(emptyOffset);
    setImageSize(emptySize);
    setFrameSize(emptySize);
    setDragState(null);
    setApplying(false);
  }, [media.src]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const updateFrameSize = (): void => {
      setFrameSize({
        width: frame.clientWidth,
        height: frame.clientHeight
      });
    };

    updateFrameSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateFrameSize);
      return () => window.removeEventListener('resize', updateFrameSize);
    }

    const resizeObserver = new ResizeObserver(updateFrameSize);
    resizeObserver.observe(frame);

    return () => resizeObserver.disconnect();
  }, [media.type]);

  useEffect(() => {
    setOffset((currentOffset) => clampOffset(currentOffset, offsetBounds));
  }, [offsetBounds]);

  const handleImageLoad = (): void => {
    const image = imageRef.current;
    if (!image) return;

    setImageSize({
      width: image.naturalWidth,
      height: image.naturalHeight
    });
  };

  const handleZoomChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => {
    setZoom(Number(value));
  };

  const handlePointerDown = ({
    pointerId,
    clientX,
    clientY,
    currentTarget
  }: ReactPointerEvent<HTMLDivElement>): void => {
    currentTarget.setPointerCapture(pointerId);
    setDragState({
      pointerId,
      startX: clientX,
      startY: clientY,
      originX: offset.x,
      originY: offset.y
    });
  };

  const handlePointerMove = ({
    pointerId,
    clientX,
    clientY
  }: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragState || dragState.pointerId !== pointerId) return;

    setOffset(
      clampOffset(
        {
          x: dragState.originX + clientX - dragState.startX,
          y: dragState.originY + clientY - dragState.startY
        },
        offsetBounds
      )
    );
  };

  const handlePointerUp = ({
    pointerId,
    currentTarget
  }: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragState || dragState.pointerId !== pointerId) return;

    currentTarget.releasePointerCapture(pointerId);
    setDragState(null);
  };

  const cropImage = async (): Promise<EditedProfileMedia> => {
    const image = imageRef.current;
    if (!image || !ready) return { previewSrc: media.src, file: media.file };

    const imageScale = displaySize.width / imageSize.width;
    const sourceWidth = Math.min(frameSize.width / imageScale, imageSize.width);
    const sourceHeight = Math.min(
      frameSize.height / imageScale,
      imageSize.height
    );
    const sourceX = clamp(
      (displaySize.width / 2 - frameSize.width / 2 - offset.x) / imageScale,
      0,
      Math.max(imageSize.width - sourceWidth, 0)
    );
    const sourceY = clamp(
      (displaySize.height / 2 - frameSize.height / 2 - offset.y) / imageScale,
      0,
      Math.max(imageSize.height - sourceHeight, 0)
    );
    const canvas = document.createElement('canvas');
    const outputSize = cover
      ? { width: 1500, height: 500 }
      : { width: 400, height: 400 };
    const context = canvas.getContext('2d');
    const outputType = getCanvasType(media.file.type);

    if (!context) return { previewSrc: media.src, file: media.file };

    canvas.width = outputSize.width;
    canvas.height = outputSize.height;
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputSize.width,
      outputSize.height
    );

    const blob = await canvasToBlob(canvas, outputType);
    const file = Object.assign(
      new File([blob], getCroppedFileName(media.file.name, blob.type), {
        type: blob.type,
        lastModified: Date.now()
      }),
      { id: media.file.id }
    );

    return {
      previewSrc: URL.createObjectURL(file),
      file
    };
  };

  const handleApply = async (): Promise<void> => {
    setApplying(true);

    let editedMedia: EditedProfileMedia;

    try {
      editedMedia = await cropImage();
    } catch {
      editedMedia = { previewSrc: media.src, file: media.file };
    }

    setApplying(false);
    applyImage(editedMedia);
  };

  return (
    <div
      className={cn(
        'flex max-h-[90vh] w-full flex-col bg-main-background text-light-primary dark:text-dark-primary',
        cover ? 'h-[560px]' : 'h-[652px]'
      )}
    >
      <header className='flex h-[53px] shrink-0 items-center px-4'>
        <Button
          className='dark-bg-tab group relative -ml-2 flex h-9 w-9 items-center justify-center p-0
                     hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          aria-label='Back'
          onClick={closeEditor}
        >
          <HeroIcon className='h-5 w-5' iconName='ArrowLeftIcon' />
        </Button>
        <h2 className='ml-5 text-xl font-bold leading-6'>Edit media</h2>
        <Button
          className='ml-auto bg-light-primary px-4 py-1.5 font-bold text-white
                     focus-visible:bg-light-primary/90 enabled:hover:bg-light-primary/90
                     enabled:active:bg-light-primary/80 disabled:brightness-75
                     dark:bg-light-border dark:text-light-primary dark:focus-visible:bg-light-border/90
                     dark:enabled:hover:bg-light-border/90 dark:enabled:active:bg-light-border/75'
          onClick={handleApply}
          disabled={!ready}
          loading={applying}
        >
          Apply
        </Button>
      </header>
      <div
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden bg-light-border dark:bg-[#16181C]',
          dragState ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          className='absolute max-w-none select-none'
          style={imageStyle}
          src={media.src}
          alt={media.alt}
          draggable={false}
          ref={imageRef}
          onLoad={handleImageLoad}
        />
        <div
          className={cn(
            `pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2
             -translate-y-1/2 border-[3px] border-main-accent`,
            cover
              ? 'aspect-[3/1] w-[72%] max-w-[500px]'
              : 'aspect-square w-[calc(100%-90px)] max-w-[500px]'
          )}
          ref={frameRef}
        />
      </div>
      <footer className='flex h-[56px] shrink-0 items-center justify-center px-10'>
        <div className='flex w-full max-w-[360px] items-center gap-3 text-light-secondary dark:text-dark-secondary'>
          <HeroIcon className='h-5 w-5' iconName='MagnifyingGlassMinusIcon' />
          <input
            className='h-1 flex-1 cursor-pointer accent-main-accent'
            type='range'
            min='1'
            max='3'
            step='0.01'
            value={zoom}
            aria-label='Zoom'
            onChange={handleZoomChange}
          />
          <HeroIcon className='h-5 w-5' iconName='MagnifyingGlassPlusIcon' />
        </div>
      </footer>
    </div>
  );
}
