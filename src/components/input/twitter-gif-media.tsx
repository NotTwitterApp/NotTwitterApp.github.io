/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type JSX } from 'react';
import { preventBubbling } from '@lib/utils';
import type { ImageData } from '@lib/types/file';

export function isGifMedia({ src, type }: ImageData): boolean {
  return type === 'gif' || !!type?.includes('gif') || /\.gif($|\?)/i.test(src);
}

function isVideoMedia({ src, type }: ImageData): boolean {
  return (
    !!type?.includes('video') || /\.(m3u8|mp4|mov|m4v|webm)($|\?)/i.test(src)
  );
}

function TwitterGifIcon({ playing }: { playing: boolean }): JSX.Element {
  return (
    <svg
      className='h-7 w-7 fill-current'
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      {playing ? (
        <path d='M7 5h3v14H7V5zm7 0h3v14h-3V5z' />
      ) : (
        <path d='M8 5v14l11-7L8 5z' />
      )}
    </svg>
  );
}

export function TwitterGifMedia({
  media,
  className
}: {
  media: ImageData;
  className?: string;
}): JSX.Element {
  const [playing, setPlaying] = useState(true);
  const [animationKey, setAnimationKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoSource = isVideoMedia(media);
  const label = playing ? 'Pause this GIF' : 'Play this GIF';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [playing]);

  const togglePlayback = (): void => {
    setPlaying((currentPlaying) => {
      const nextPlaying = !currentPlaying;

      if (nextPlaying && !videoSource) setAnimationKey((key) => key + 1);
      return nextPlaying;
    });
  };

  return (
    <div
      className={`group/gif relative h-full w-full overflow-hidden bg-black text-white outline-none ${className ?? ''}`}
      role='button'
      tabIndex={0}
      aria-label={label}
      onClick={preventBubbling(togglePlayback)}
      onKeyDown={(event): void => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          togglePlayback();
        }
      }}
    >
      {videoSource ? (
        <video
          ref={videoRef}
          className='h-full w-full object-cover object-center'
          src={media.src}
          poster={media.poster ?? undefined}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img
          className='h-full w-full object-cover object-center'
          src={playing ? media.src : (media.poster ?? media.src)}
          alt={media.alt}
          key={`${media.src}-${animationKey}-${playing ? 'playing' : 'paused'}`}
          draggable={false}
        />
      )}
      <span
        className='absolute bottom-2 left-2 rounded-sm bg-black/75 px-1.5 py-0.5
                   text-[11px] font-bold leading-4 tracking-[0.02em] text-white'
      >
        GIF
      </span>
      <span
        className={`bg-black/45 group-hover/gif:bg-black/55 absolute left-1/2 top-1/2 flex h-16 w-16
           -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white
           backdrop-blur-[1px] transition duration-150 group-focus-visible/gif:ring-2
           group-focus-visible/gif:ring-white/80 ${
             playing
               ? 'opacity-0 group-hover/gif:opacity-100 group-focus-visible/gif:opacity-100'
               : 'opacity-100'
           }`}
        aria-hidden='true'
      >
        <TwitterGifIcon playing={playing} />
      </span>
    </div>
  );
}
