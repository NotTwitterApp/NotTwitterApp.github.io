import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX
} from 'react';
import cn from 'clsx';
import { formatNumber } from '@lib/date';
import { preventBubbling } from '@lib/utils';
import { Button } from './button';
import type Hls from 'hls.js';
import type { CSSProperties, SVGProps } from 'react';

type HlsConstructor = typeof Hls;

type TwitterVideoPlayerProps = {
  src: string;
  poster?: string | null;
  label?: string;
  className?: string;
  videoClassName?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  compact?: boolean;
  viewCount?: number | null;
  objectFit?: 'cover' | 'contain';
  initialVolume?: number;
};

type QualityOption = {
  label: string;
  src: string;
  height: number;
  bandwidth: number;
};

type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

const playbackSpeeds: readonly PlaybackSpeed[] = [0.5, 1, 1.5, 2];
const lowInitialVolume = 0.04;
const compactSettingsHeight = 560;
const tightControlsWidth = 430;
const videoFocusThreshold = 0.5;

function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';

  const roundedSeconds = Math.floor(seconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;
  const paddedSeconds = remainingSeconds.toString().padStart(2, '0');

  if (hours)
    return `${hours}:${minutes.toString().padStart(2, '0')}:${paddedSeconds}`;

  return `${minutes}:${paddedSeconds}`;
}

function getSpeedLabel(speed: PlaybackSpeed): string {
  return speed === 1 ? 'Normal' : `${speed}x speed`;
}

function getQualityLabel(height: number, bandwidth: number): string {
  if (height) return `${height}p`;

  return `${Math.max(Math.round(bandwidth / 1000), 1)} kbps`;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return lowInitialVolume;

  return Math.max(0, Math.min(value, 1));
}

function normalizeQualityOptions(options: QualityOption[]): QualityOption[] {
  return options
    .filter(
      (variant, index, allVariants) =>
        allVariants.findIndex(({ src }) => src === variant.src) === index
    )
    .sort((first, second) => {
      if (second.height !== first.height) return second.height - first.height;
      return second.bandwidth - first.bandwidth;
    });
}

function parseQualityOptions(
  playlist: string,
  playlistSrc: string
): QualityOption[] {
  const lines = playlist
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const variants: QualityOption[] = [];

  lines.forEach((line, index) => {
    if (!line.startsWith('#EXT-X-STREAM-INF')) return;

    const nextLine = lines[index + 1];
    if (!nextLine || nextLine.startsWith('#')) return;

    const resolution = line.match(/RESOLUTION=(\d+)x(\d+)/);
    const bandwidth = line.match(/BANDWIDTH=(\d+)/);
    const height = resolution ? Number(resolution[2]) : 0;
    const bitrate = bandwidth ? Number(bandwidth[1]) : 0;

    variants.push({
      label: getQualityLabel(height, bitrate),
      src: new URL(nextLine, playlistSrc).toString(),
      height,
      bandwidth: bitrate
    });
  });

  return normalizeQualityOptions(variants);
}

function getHlsQualityOptions(hls: Hls): QualityOption[] {
  return normalizeQualityOptions(
    hls.levels.map(({ bitrate, height, url }) => ({
      label: getQualityLabel(height, bitrate),
      src: url[0],
      height,
      bandwidth: bitrate
    }))
  );
}

function isHlsPlaylist(videoSrc: string): boolean {
  return /\.m3u8(?:$|[?#])/.test(videoSrc);
}

type TwitterVideoIconName =
  | 'check'
  | 'fullscreen'
  | 'fullscreen-exit'
  | 'pause'
  | 'play'
  | 'settings'
  | 'volume'
  | 'volume-muted';

function TwitterVideoIcon({
  iconName,
  className
}: SVGProps<SVGSVGElement> & {
  iconName: TwitterVideoIconName;
}): JSX.Element {
  const commonProps = {
    className,
    viewBox: '0 0 24 24',
    'aria-hidden': true
  };

  switch (iconName) {
    case 'check':
      return (
        <svg {...commonProps} fill='currentColor'>
          <polygon points='9.64 18.952 4.09 14.091 5.407 12.587 9.358 16.046 17.817 5.098 19.4 6.32 9.64 18.952' />
        </svg>
      );
    case 'fullscreen':
      return (
        <svg {...commonProps} fill='currentColor'>
          <path d='M3 5.5C3 4.12 4.12 3 5.5 3H10v2H5.5c-.28 0-.5.22-.5.5V10H3V5.5ZM14 3h4.5C19.88 3 21 4.12 21 5.5V10h-2V5.5c0-.28-.22-.5-.5-.5H14V3ZM5 14v4.5c0 .28.22.5.5.5H10v2H5.5C4.12 21 3 19.88 3 18.5V14h2Zm16 0v4.5c0 1.38-1.12 2.5-2.5 2.5H14v-2h4.5c.28 0 .5-.22.5-.5V14h2Z' />
        </svg>
      );
    case 'fullscreen-exit':
      return (
        <svg {...commonProps} fill='currentColor'>
          <path d='M10 2v5.5C10 8.88 8.88 10 7.5 10H2V8h5.5c.28 0 .5-.22.5-.5V2h2Zm6 0v5.5c0 .28.22.5.5.5H22v2h-5.5C15.12 10 14 8.88 14 7.5V2h2ZM2 14h5.5c1.38 0 2.5 1.12 2.5 2.5V22H8v-5.5c0-.28-.22-.5-.5-.5H2v-2Zm14.5 2c-.28 0-.5.22-.5.5V22h-2v-5.5c0-1.38 1.12-2.5 2.5-2.5H22v2h-5.5Z' />
        </svg>
      );
    case 'pause':
      return (
        <svg {...commonProps} fill='currentColor'>
          <path d='M4 2h5v20H4V2Zm11 20h5V2h-5v20Z' />
        </svg>
      );
    case 'play':
      return (
        <svg {...commonProps} fill='currentColor'>
          <path d='M21 12 4 2v20l17-10Z' />
        </svg>
      );
    case 'settings':
      return (
        <svg {...commonProps} fill='currentColor'>
          <path d='M10.54 1.75h2.92l1.57 2.36c.11.17.32.25.53.21l2.53-.59 2.17 2.17-.58 2.54c-.05.2.04.41.21.53l2.36 1.57v2.92l-2.36 1.57c-.17.12-.26.33-.21.53l.58 2.54-2.17 2.17-2.53-.59c-.21-.04-.42.04-.53.21l-1.57 2.36h-2.92l-1.58-2.36c-.11-.17-.32-.25-.52-.21l-2.54.59-2.17-2.17.58-2.54c.05-.2-.03-.41-.21-.53l-2.35-1.57v-2.92L4.1 8.97c.18-.12.26-.33.21-.53L3.73 5.9 5.9 3.73l2.54.59c.2.04.41-.04.52-.21l1.58-2.36Zm1.07 2-.98 1.47C10.05 6.08 9 6.5 7.99 6.27l-1.46-.34-.6.6.33 1.46c.24 1.01-.18 2.07-1.05 2.64l-1.46.98v.78l1.46.98c.87.57 1.29 1.63 1.05 2.64l-.33 1.46.6.6 1.46-.34c1.01-.23 2.06.19 2.64 1.05l.98 1.47h.78l.97-1.47c.58-.86 1.63-1.28 2.65-1.05l1.45.34.61-.6-.34-1.46c-.23-1.01.18-2.07 1.05-2.64l1.47-.98v-.78l-1.47-.98c-.87-.57-1.28-1.63-1.05-2.64l.34-1.46-.61-.6-1.45.34c-1.02.23-2.07-.19-2.65-1.05l-.97-1.47h-.78ZM12 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5c.82 0 1.5-.67 1.5-1.5s-.68-1.5-1.5-1.5ZM8.5 12c0-1.93 1.56-3.5 3.5-3.5 1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5c-1.94 0-3.5-1.57-3.5-3.5Z' />
        </svg>
      );
    case 'volume':
      return (
        <svg {...commonProps} fill='currentColor'>
          <path d='M15 22.94V1.06L6.68 7H3.5C2.12 7 1 8.12 1 9.5v5C1 15.88 2.12 17 3.5 17h3.18L15 22.94ZM3.5 9H6v6H3.5c-.28 0-.5-.22-.5-.5v-5c0-.28.22-.5.5-.5ZM13 19.06l-5-3.57V8.51l5-3.57v14.12Zm5.95-12.01c-.24-.24-.49-.45-.75-.65l1-1.75c.41.29.8.62 1.16.99 3.52 3.51 3.52 9.21 0 12.72-.36.37-.75.7-1.16.99l-1-1.75c.26-.2.51-.41.75-.65 2.73-2.73 2.73-7.17 0-9.9ZM17 12c0-.8-.31-1.52-.82-2.06l1.02-1.78c1.1.91 1.8 2.29 1.8 3.84s-.7 2.93-1.8 3.84l-1.02-1.78c.51-.54.82-1.26.82-2.06Z' />
        </svg>
      );
    case 'volume-muted':
      return (
        <svg {...commonProps} fill='currentColor'>
          <path d='M15 1.06v21.88L6.68 17H3.5C2.12 17 1 15.88 1 14.5v-5C1 8.12 2.12 7 3.5 7h3.18L15 1.06ZM6 9H3.5c-.28 0-.5.22-.5.5v5c0 .28.22.5.5.5H6V9Zm2 6.49 5 3.57V4.94L8 8.51v6.98Zm10.5-6.9 2 2 2-2L23.91 10l-2 2 2 2-1.41 1.41-2-2-2 2L17.09 14l2-2-2-2 1.41-1.41Z' />
        </svg>
      );
  }
}

function TwitterVideoInitialPlayIcon(): JSX.Element {
  return (
    <svg
      className='h-[50px] w-[50px] translate-x-[2px]'
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      <path fill='currentColor' d='M21 12 4 2v20l17-10Z' />
    </svg>
  );
}

export function TwitterVideoPlayer({
  src,
  poster,
  label = 'Video',
  className,
  videoClassName,
  autoPlay,
  loop,
  muted = true,
  compact,
  viewCount,
  objectFit = 'cover',
  initialVolume = lowInitialVolume
}: TwitterVideoPlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const hlsConstructorRef = useRef<HlsConstructor | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const resumeAfterSourceChangeRef = useRef(false);
  const mutedRef = useRef(muted);
  const playingRef = useRef(!!autoPlay);
  const focusMutedRef = useRef(false);
  const viewportFocusedRef = useRef(true);
  const pageFocusedRef = useRef(true);
  const playbackRateRef = useRef<PlaybackSpeed>(1);
  const initialClampedVolume = clampVolume(initialVolume);
  const volumeRef = useRef(initialClampedVolume);
  const previousVolumeRef = useRef(initialClampedVolume || 0.5);

  const [playing, setPlaying] = useState(!!autoPlay);
  const [hasStarted, setHasStarted] = useState(!!autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(initialClampedVolume);
  const [hlsSupported, setHlsSupported] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playerSize, setPlayerSize] = useState({ width: 0, height: 0 });
  const [playbackRate, setPlaybackRate] = useState<PlaybackSpeed>(1);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [selectedQualitySrc, setSelectedQualitySrc] = useState<string | null>(
    null
  );

  const activeSrc = selectedQualitySrc ?? src;
  const useHlsJs = hlsSupported && isHlsPlaylist(activeSrc);
  const nativeVideoSrc = useHlsJs ? undefined : activeSrc;
  const safeInitialVolume = useMemo(
    () => clampVolume(initialVolume),
    [initialVolume]
  );
  const progressPercent = useMemo(
    () => (duration ? Math.min((currentTime / duration) * 100, 100) : 0),
    [currentTime, duration]
  );
  const visibleVolume = isMuted ? 0 : volume;
  const volumePercent = visibleVolume * 100;
  const scrubberStyle = {
    '--twitter-video-progress': `${progressPercent}%`
  } as CSSProperties;
  const volumeSliderStyle = {
    '--twitter-video-volume': `${volumePercent}%`
  } as CSSProperties;
  const viewCountLabel =
    viewCount !== null && viewCount !== undefined
      ? `${formatNumber(viewCount)} views`
      : null;
  const showInitialPlayButton = !autoPlay && !hasStarted && !playing;
  const tightControls =
    playerSize.width > 0 && playerSize.width < tightControlsWidth;
  const compactSettings =
    !!compact ||
    tightControls ||
    (playerSize.height > 0 && playerSize.height < compactSettingsHeight);
  const showViewCount = !!viewCountLabel && !tightControls;
  const showVolumeButton = !compact && !tightControls;
  const settingsMaxHeight =
    playerSize.height > 0
      ? Math.max(
          96,
          Math.min(compactSettings ? 292 : 340, playerSize.height - 76)
        )
      : compactSettings
        ? 292
        : 340;

  const setMutedState = useCallback((nextMuted: boolean): void => {
    mutedRef.current = nextMuted;

    const video = videoRef.current;
    if (video) video.muted = nextMuted;

    setIsMuted(nextMuted);
  }, []);

  const syncAudioFocus = useCallback((): void => {
    const focused = viewportFocusedRef.current && pageFocusedRef.current;

    if (focused) {
      if (focusMutedRef.current && volumeRef.current > 0) {
        focusMutedRef.current = false;
        setMutedState(false);
      }

      return;
    }

    if (playingRef.current && !mutedRef.current && volumeRef.current > 0) {
      focusMutedRef.current = true;
      setMutedState(true);
    }
  }, [setMutedState]);

  useEffect(() => {
    let cancelled = false;

    if (!isHlsPlaylist(activeSrc)) {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      hlsConstructorRef.current = null;
      setHlsSupported(false);
      return undefined;
    }

    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;

      hlsConstructorRef.current = Hls;
      setHlsSupported(Hls.isSupported());
    });

    return () => {
      cancelled = true;
    };
  }, [activeSrc]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const updatePlayerSize = (): void => {
      const { width, height } = frame.getBoundingClientRect();
      setPlayerSize({ width, height });
    };

    updatePlayerSize();

    const observer = new ResizeObserver(updatePlayerSize);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    volumeRef.current = safeInitialVolume;
    setVolume(safeInitialVolume);
    if (safeInitialVolume > 0) previousVolumeRef.current = safeInitialVolume;

    const video = videoRef.current;
    if (!video) return;

    video.volume = safeInitialVolume;
  }, [safeInitialVolume]);

  useEffect(() => {
    mutedRef.current = isMuted;

    const video = videoRef.current;
    if (!video) return;

    video.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    playingRef.current = playing;

    if (playing) syncAudioFocus();
  }, [playing, syncAudioFocus]);

  useEffect(() => {
    const frame = frameRef.current;
    let observer: IntersectionObserver | null = null;

    const updatePageFocus = (): void => {
      pageFocusedRef.current =
        document.visibilityState === 'visible' && document.hasFocus();
      syncAudioFocus();
    };

    pageFocusedRef.current =
      document.visibilityState === 'visible' && document.hasFocus();

    if (frame && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          viewportFocusedRef.current =
            entry.isIntersecting &&
            entry.intersectionRatio >= videoFocusThreshold;
          syncAudioFocus();
        },
        {
          threshold: [0, 0.25, videoFocusThreshold, 0.75, 1]
        }
      );

      observer.observe(frame);
    }

    document.addEventListener('visibilitychange', updatePageFocus);
    window.addEventListener('focus', updatePageFocus);
    window.addEventListener('blur', updatePageFocus);

    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', updatePageFocus);
      window.removeEventListener('focus', updatePageFocus);
      window.removeEventListener('blur', updatePageFocus);
    };
  }, [syncAudioFocus]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;

    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const video = videoRef.current;
    const Hls = hlsConstructorRef.current;

    if (!video || !useHlsJs || !Hls) return undefined;

    hlsRef.current?.destroy();

    const hls = new Hls({
      enableWorker: true
    });

    hlsRef.current = hls;
    hls.attachMedia(video);

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(activeSrc);
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const hlsQualities = getHlsQualityOptions(hls);

      if (hlsQualities.length) setQualities(hlsQualities);

      video.muted = mutedRef.current;
      video.volume = volumeRef.current;
      video.playbackRate = playbackRateRef.current;

      if (autoPlay || resumeAfterSourceChangeRef.current)
        void video
          .play()
          .then(() => {
            playingRef.current = true;
            setHasStarted(true);
            setPlaying(true);
            syncAudioFocus();
          })
          .catch(() => {
            playingRef.current = false;
            setPlaying(false);
          });
    });

    hls.on(Hls.Events.ERROR, (eventName, data) => {
      if (eventName !== Hls.Events.ERROR || !data.fatal) return;

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls.startLoad();
        return;
      }

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
        return;
      }

      hls.destroy();
    });

    return () => {
      hls.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
    };
  }, [activeSrc, autoPlay, syncAudioFocus, useHlsJs]);

  useEffect(() => {
    const controller = new AbortController();

    setQualities([]);
    setSelectedQualitySrc(null);
    focusMutedRef.current = false;
    playingRef.current = !!autoPlay;
    setMutedState(muted);
    setPlaying(!!autoPlay);
    setHasStarted(!!autoPlay);

    if (!src.includes('.m3u8')) return undefined;

    void fetch(src, { signal: controller.signal })
      .then((response) => (response.ok ? response.text() : ''))
      .then((playlist) => {
        if (!controller.signal.aborted)
          setQualities(parseQualityOptions(playlist, src));
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [src, autoPlay, muted, setMutedState]);

  useEffect(() => {
    const handleFullscreenChange = (): void => {
      setFullscreen(document.fullscreenElement === frameRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const syncMetadata = (): void => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = volumeRef.current;
    setDuration(video.duration || 0);

    if (pendingSeekRef.current !== null) {
      video.currentTime = Math.min(pendingSeekRef.current, video.duration || 0);
      pendingSeekRef.current = null;
    }

    if (resumeAfterSourceChangeRef.current) {
      resumeAfterSourceChangeRef.current = false;
      void video
        .play()
        .then(() => {
          playingRef.current = true;
          setHasStarted(true);
          setPlaying(true);
          syncAudioFocus();
        })
        .catch(() => {
          playingRef.current = false;
          setPlaying(false);
        });
    }

    setCurrentTime(video.currentTime || 0);
  };

  const syncTime = (): void => {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime || 0);
  };

  const playVideo = async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      playingRef.current = true;
      setHasStarted(true);
      setPlaying(true);
      syncAudioFocus();
    } catch {
      playingRef.current = false;
      setPlaying(false);
    }
  };

  const pauseVideo = (): void => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    playingRef.current = false;
    setPlaying(false);
  };

  const togglePlay = (): void => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) void playVideo();
    else pauseVideo();
  };

  const handleSeek = (value: string): void => {
    const video = videoRef.current;
    if (!video) return;

    const nextTime = Number(value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolumeChange = (value: string): void => {
    const nextVolume = clampVolume(Number(value));
    const video = videoRef.current;

    volumeRef.current = nextVolume;
    setVolume(nextVolume);

    if (video) video.volume = nextVolume;

    if (nextVolume > 0) {
      previousVolumeRef.current = nextVolume;
      focusMutedRef.current = false;
      setMutedState(false);
      return;
    }

    focusMutedRef.current = false;
    setMutedState(true);
  };

  const toggleMute = (): void => {
    const video = videoRef.current;

    focusMutedRef.current = false;

    if (isMuted || volume === 0) {
      const nextVolume = previousVolumeRef.current || 0.5;

      volumeRef.current = nextVolume;
      setVolume(nextVolume);
      if (video) video.volume = nextVolume;
      setMutedState(false);
      return;
    }

    previousVolumeRef.current = volume;
    setMutedState(true);
  };

  const handlePlaybackRate = (speed: PlaybackSpeed): void => {
    setPlaybackRate(speed);
  };

  const handleQualityChange = (qualitySrc: string | null): void => {
    const video = videoRef.current;
    const wasPlaying = !!video && !video.paused;

    pendingSeekRef.current = video?.currentTime ?? null;
    resumeAfterSourceChangeRef.current = wasPlaying;
    setSelectedQualitySrc(qualitySrc);
  };

  const toggleFullscreen = async (): Promise<void> => {
    const frame = frameRef.current;
    if (!frame) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await frame.requestFullscreen();
  };

  return (
    <div
      className={cn(
        'group/video relative h-full w-full overflow-hidden bg-black text-white outline-none',
        className
      )}
      ref={frameRef}
      onClick={preventBubbling(togglePlay)}
      onDoubleClick={preventBubbling(() => void toggleFullscreen())}
      onKeyDown={(event): void => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          togglePlay();
        }
      }}
      role='button'
      tabIndex={0}
      aria-label={playing ? `Pause ${label}` : `Play ${label}`}
    >
      <video
        ref={videoRef}
        className={cn(
          'h-full w-full bg-black',
          objectFit === 'contain' ? 'object-contain' : 'object-cover',
          videoClassName
        )}
        src={nativeVideoSrc}
        poster={poster ?? undefined}
        autoPlay={autoPlay}
        loop={loop}
        muted={isMuted}
        playsInline
        onLoadedMetadata={syncMetadata}
        onTimeUpdate={syncTime}
        onPlay={(): void => {
          playingRef.current = true;
          setHasStarted(true);
          setPlaying(true);
          syncAudioFocus();
        }}
        onPause={(): void => {
          playingRef.current = false;
          setPlaying(false);
        }}
      >
        {nativeVideoSrc && <source src={nativeVideoSrc} type='video/*' />}
      </video>
      <span
        className={cn(
          `pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10
           to-black/10 opacity-0 transition-opacity duration-200`,
          (!playing || settingsOpen) && 'opacity-100',
          'group-focus-within/video:opacity-100 group-hover/video:opacity-100'
        )}
      />
      {showInitialPlayButton && (
        <span
          className='pointer-events-none absolute left-1/2 top-1/2 flex h-16 w-16
                     -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full
                     bg-main-accent text-white shadow-[0_0_0_5px_rgba(255,255,255,0.95),0_1px_5px_rgba(0,0,0,0.35)]'
          aria-hidden='true'
        >
          <TwitterVideoInitialPlayIcon />
        </span>
      )}
      <div
        className={cn(
          `absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 px-3 pb-2 pt-8
           text-white opacity-0 transition-opacity duration-200`,
          (!playing || settingsOpen) && 'opacity-100',
          'group-focus-within/video:opacity-100 group-hover/video:opacity-100'
        )}
        onClick={preventBubbling(null, true)}
      >
        <input
          className='twitter-video-scrubber w-full cursor-pointer'
          type='range'
          min={0}
          max={duration || 0}
          step='0.1'
          value={Math.min(currentTime, duration || currentTime)}
          aria-label='Seek video'
          onChange={({ target: { value } }): void => handleSeek(value)}
          style={scrubberStyle}
        />
        <div className='flex h-8 min-w-0 items-center gap-1.5 text-[13px] font-medium leading-none sm:gap-2'>
          <Button
            className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-white
                       hover:bg-white/10 focus-visible:ring-white/70 active:bg-white/20'
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={preventBubbling(togglePlay)}
          >
            <TwitterVideoIcon
              className='h-[22px] w-[22px]'
              iconName={playing ? 'pause' : 'play'}
            />
          </Button>
          {showViewCount && (
            <span className='hidden whitespace-nowrap text-[15px] font-bold sm:inline'>
              {viewCountLabel}
            </span>
          )}
          <span className='min-w-0 flex-1' />
          <span className='min-w-[78px] shrink-0 whitespace-nowrap text-right text-[15px] font-bold tabular-nums'>
            {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
          </span>
          {showVolumeButton && (
            <div className='group/volume flex h-8 shrink-0 items-center'>
              <Button
                className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-white
                           hover:bg-white/10 focus-visible:ring-white/70 active:bg-white/20'
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                onClick={preventBubbling(toggleMute)}
              >
                <TwitterVideoIcon
                  className='h-[23px] w-[23px]'
                  iconName={isMuted ? 'volume-muted' : 'volume'}
                />
              </Button>
              <span
                className='grid w-0 overflow-hidden transition-[width] duration-150 ease-out
                           group-focus-within/volume:w-[76px] group-hover/volume:w-[76px]'
              >
                <input
                  className='twitter-video-volume-slider ml-1 w-[72px] cursor-pointer'
                  type='range'
                  min={0}
                  max={1}
                  step='0.01'
                  value={visibleVolume}
                  aria-label='Volume'
                  aria-valuetext={`${Math.round(volumePercent)}%`}
                  onChange={({ target: { value } }): void =>
                    handleVolumeChange(value)
                  }
                  style={volumeSliderStyle}
                />
              </span>
            </div>
          )}
          <div className='relative'>
            <Button
              className={cn(
                `flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-white
                 hover:bg-white/10 focus-visible:ring-white/70 active:bg-white/20`,
                settingsOpen && 'bg-white/10'
              )}
              aria-label='Settings'
              aria-expanded={settingsOpen}
              onClick={preventBubbling(() => setSettingsOpen(!settingsOpen))}
            >
              <TwitterVideoIcon
                className='h-[23px] w-[23px]'
                iconName='settings'
              />
            </Button>
          </div>
          <Button
            className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-white
                       hover:bg-white/10 focus-visible:ring-white/70 active:bg-white/20'
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            onClick={preventBubbling(() => void toggleFullscreen())}
          >
            <TwitterVideoIcon
              className='h-[23px] w-[23px]'
              iconName={fullscreen ? 'fullscreen-exit' : 'fullscreen'}
            />
          </Button>
        </div>
      </div>
      {settingsOpen && (
        <div
          className={cn(
            'absolute right-3 bottom-[46px] z-20 w-[calc(100%-24px)]',
            compactSettings ? 'max-w-[300px]' : 'max-w-[340px]'
          )}
          style={{ maxHeight: settingsMaxHeight }}
          onClick={preventBubbling(null, true)}
        >
          <span
            className={cn(
              'absolute -bottom-[9px] h-[20px] w-[20px] rotate-45 bg-white',
              tightControls ? 'right-[34px]' : 'right-[55px]'
            )}
            aria-hidden='true'
          />
          <div
            className={cn(
              `twitter-video-settings-scroll relative z-10 max-h-[inherit] overflow-y-auto
               overscroll-contain rounded-2xl bg-white text-[#0f1419]
               shadow-[0_2px_14px_rgba(0,0,0,0.18)] ring-1 ring-black/5`,
              compactSettings ? 'px-4 py-3' : 'px-5 py-4'
            )}
            role='menu'
            aria-label='Video settings'
          >
            <h2
              className={cn(
                'text-left font-extrabold',
                compactSettings
                  ? 'text-[18px] leading-6'
                  : 'text-[20px] leading-7'
              )}
            >
              Playback speed
            </h2>
            <p
              className={cn(
                'mt-[2px] text-left leading-5 text-[#536471]',
                compactSettings ? 'text-[13px]' : 'text-[14px]'
              )}
            >
              Press the speed you would like to watch the video in.
            </p>
            <div
              className={cn(
                'flex flex-col',
                compactSettings ? 'mt-2' : 'mt-3 sm:mt-[22px]'
              )}
            >
              {playbackSpeeds.map((speed) => (
                <button
                  className={cn(
                    'flex items-center justify-between text-left',
                    compactSettings
                      ? 'h-7 text-[15px] leading-5'
                      : 'h-8 text-[16px] leading-5'
                  )}
                  type='button'
                  role='menuitemradio'
                  aria-checked={playbackRate === speed}
                  onClick={preventBubbling(() => handlePlaybackRate(speed))}
                  key={speed}
                >
                  <span>{getSpeedLabel(speed)}</span>
                  <span
                    className={cn(
                      `flex items-center justify-center rounded-full border-2
                       border-[#536471]`,
                      compactSettings ? 'h-6 w-6' : 'h-7 w-7',
                      playbackRate === speed &&
                        'border-main-accent bg-main-accent text-white'
                    )}
                    aria-hidden='true'
                  >
                    {playbackRate === speed && (
                      <TwitterVideoIcon
                        className={cn(
                          compactSettings ? 'h-3.5 w-3.5' : 'h-4 w-4'
                        )}
                        iconName='check'
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
            {!!qualities.length && (
              <>
                <div
                  className={cn(
                    'h-px bg-[#eff3f4]',
                    compactSettings ? 'my-2' : 'my-3 sm:my-5'
                  )}
                />
                <h3
                  className={cn(
                    'text-left font-extrabold leading-6',
                    compactSettings ? 'text-[15px]' : 'text-[16px]'
                  )}
                >
                  Quality
                </h3>
                <div
                  className={cn(
                    'flex flex-col',
                    compactSettings ? 'mt-1' : 'mt-2'
                  )}
                >
                  <button
                    className={cn(
                      'flex items-center justify-between text-left leading-6',
                      compactSettings ? 'h-7 text-[14px]' : 'h-8 text-[15px]'
                    )}
                    type='button'
                    role='menuitemradio'
                    aria-checked={!selectedQualitySrc}
                    onClick={preventBubbling(() => handleQualityChange(null))}
                  >
                    <span>Auto</span>
                    <span
                      className={cn(
                        `flex items-center justify-center rounded-full border-2
                         border-[#536471]`,
                        compactSettings ? 'h-6 w-6' : 'h-7 w-7',
                        !selectedQualitySrc &&
                          'border-main-accent bg-main-accent text-white'
                      )}
                      aria-hidden='true'
                    >
                      {!selectedQualitySrc && (
                        <TwitterVideoIcon
                          className={
                            compactSettings ? 'h-3.5 w-3.5' : 'h-4 w-4'
                          }
                          iconName='check'
                        />
                      )}
                    </span>
                  </button>
                  {qualities.map((quality) => (
                    <button
                      className={cn(
                        'flex items-center justify-between text-left leading-6',
                        compactSettings ? 'h-7 text-[14px]' : 'h-8 text-[15px]'
                      )}
                      type='button'
                      role='menuitemradio'
                      aria-checked={selectedQualitySrc === quality.src}
                      onClick={preventBubbling(() =>
                        handleQualityChange(quality.src)
                      )}
                      key={quality.src}
                    >
                      <span>{quality.label}</span>
                      <span
                        className={cn(
                          `flex items-center justify-center rounded-full border-2
                           border-[#536471]`,
                          compactSettings ? 'h-6 w-6' : 'h-7 w-7',
                          selectedQualitySrc === quality.src &&
                            'border-main-accent bg-main-accent text-white'
                        )}
                        aria-hidden='true'
                      >
                        {selectedQualitySrc === quality.src && (
                          <TwitterVideoIcon
                            className={
                              compactSettings ? 'h-3.5 w-3.5' : 'h-4 w-4'
                            }
                            iconName='check'
                          />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {viewCountLabel && (
              <>
                <div
                  className={cn(
                    'h-px bg-[#eff3f4]',
                    compactSettings ? 'my-2' : 'my-3 sm:my-5'
                  )}
                />
                <div
                  className={cn(
                    'flex items-center justify-between leading-6',
                    compactSettings ? 'text-[14px]' : 'text-[15px]'
                  )}
                >
                  <span className='font-bold'>Views</span>
                  <span>{viewCountLabel}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
