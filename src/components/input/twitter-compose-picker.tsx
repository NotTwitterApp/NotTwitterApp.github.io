/* eslint-disable @next/next/no-img-element */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX
} from 'react';
import { createPortal } from 'react-dom';
import cn from 'clsx';
import { getTwemojiSvgUrl } from '@lib/twemoji';
import { Button } from '@components/ui/button';
import { CustomIcon } from '@components/ui/custom-icon';
import type { CSSProperties, ChangeEvent } from 'react';

export type ComposePickerType = 'gif' | 'emoji';

export type GifSelection = {
  id: string;
  title: string;
  src: string;
  preview: string;
  aspectRatio?: {
    width: number;
    height: number;
  } | null;
};

type TwitterComposePickerProps = {
  type: ComposePickerType;
  placement: 'above' | 'below';
  anchorElement?: HTMLElement | null;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gif: GifSelection) => void;
};

type KlipyMediaFormat = {
  url: string;
  preview?: string;
  dims?: [number, number];
};

type KlipyGif = {
  id: string;
  title?: string;
  content_description?: string;
  media_formats?: {
    gif?: KlipyMediaFormat;
    tinygif?: KlipyMediaFormat;
    mp4?: KlipyMediaFormat;
    tinymp4?: KlipyMediaFormat;
  };
};

type KlipyResponse = {
  results?: KlipyGif[];
};

type EmojiItem = {
  emoji: string;
  name: string;
  skinTone?: boolean;
};

type EmojiSection = {
  id: string;
  title: string;
  icon: string;
  emojis: readonly EmojiItem[];
};

type FilteredEmojiSection = {
  id: string;
  title: string;
  icon: string;
  emojis: EmojiItem[];
};

type FoundMediaCategory = {
  label: string;
  searchTerm: string;
};

type FoundMediaCategoryTile = FoundMediaCategory & {
  image: string | null;
};

const pickerViewportMargin = 12;
const emojiPickerWidth = 350;
const emojiPickerHeight = 520;
const pickerOffset = 12;

const klipySearchEndpoint = 'https://gifs.bsky.app/klipy/v2/search';
const recentEmojisKey = 'not-twitter:recent-emojis';

const skinToneOptions = [
  { label: 'Default', modifier: '' },
  { label: 'Light', modifier: '🏻' },
  { label: 'Medium-light', modifier: '🏼' },
  { label: 'Medium', modifier: '🏽' },
  { label: 'Medium-dark', modifier: '🏾' },
  { label: 'Dark', modifier: '🏿' }
] as const;

const emojiSkinToneRegex = /[\u{1f3fb}-\u{1f3ff}]/gu;

const foundMediaCategories: readonly FoundMediaCategory[] = [
  { label: 'Agree', searchTerm: 'agree' },
  { label: 'Applause', searchTerm: 'applause' },
  { label: 'Aww', searchTerm: 'aww' },
  { label: 'Dance', searchTerm: 'dance' },
  { label: 'Deal with it', searchTerm: 'deal with it' },
  { label: 'Do not want', searchTerm: 'do not want' },
  { label: 'Eww', searchTerm: 'eww' },
  { label: "Can't believe it", searchTerm: "can't believe it" },
  { label: 'Shocked', searchTerm: 'shocked' },
  { label: 'Fist bump', searchTerm: 'fist bump' },
  { label: 'You got this', searchTerm: 'you got this' },
  { label: 'Happy dance', searchTerm: 'happy dance' },
  { label: 'Love', searchTerm: 'love' },
  { label: 'High five', searchTerm: 'high five' },
  { label: 'Hug', searchTerm: 'hug' },
  { label: "I don't know", searchTerm: "i don't know" },
  { label: 'Kiss', searchTerm: 'kiss' },
  { label: 'Mic drop', searchTerm: 'mic drop' },
  { label: 'No', searchTerm: 'no' },
  { label: 'Oh no', searchTerm: 'oh no' },
  { label: 'Okay', searchTerm: 'okay' },
  { label: 'Oops', searchTerm: 'oops' },
  { label: 'Please', searchTerm: 'please' },
  { label: 'Popcorn', searchTerm: 'popcorn' },
  { label: 'Seriously?', searchTerm: 'seriously' },
  { label: 'Scared', searchTerm: 'scared' },
  { label: 'Surprised', searchTerm: 'surprised' },
  { label: 'Sigh', searchTerm: 'sigh' },
  { label: 'Slow clap', searchTerm: 'slow clap' },
  { label: 'Sorry', searchTerm: 'sorry' },
  { label: 'Thank you', searchTerm: 'thank you' },
  { label: 'Thumbs down', searchTerm: 'thumbs down' },
  { label: 'Thumbs up', searchTerm: 'thumbs up' },
  { label: 'Want', searchTerm: 'want' },
  { label: 'Win', searchTerm: 'win' },
  { label: 'Wink', searchTerm: 'wink' },
  { label: 'YOLO', searchTerm: 'yolo' },
  { label: 'Yawn', searchTerm: 'yawn' },
  { label: 'Yes', searchTerm: 'yes' },
  { label: 'Way to go', searchTerm: 'way to go' }
] as const;

function emoji(value: string, name: string, skinTone = false): EmojiItem {
  return { emoji: value, name, skinTone };
}

const emojiSections: readonly EmojiSection[] = [
  {
    id: 'smileys',
    title: 'Smileys & people',
    icon: '😀',
    emojis: [
      emoji('😀', 'grinning face'),
      emoji('😃', 'smiley happy'),
      emoji('😄', 'smile happy'),
      emoji('😁', 'grin'),
      emoji('😆', 'laughing'),
      emoji('😅', 'sweat smile'),
      emoji('😂', 'joy tears'),
      emoji('🤣', 'rolling laughing'),
      emoji('😊', 'blush happy'),
      emoji('😇', 'innocent angel'),
      emoji('🙂', 'slight smile'),
      emoji('🙃', 'upside down'),
      emoji('😉', 'wink'),
      emoji('😍', 'heart eyes love'),
      emoji('😘', 'kiss'),
      emoji('🥰', 'smiling hearts'),
      emoji('😎', 'cool sunglasses'),
      emoji('🤔', 'thinking'),
      emoji('🙄', 'eye roll'),
      emoji('😬', 'grimace'),
      emoji('😴', 'sleeping'),
      emoji('😢', 'cry'),
      emoji('😭', 'sob'),
      emoji('😡', 'angry'),
      emoji('🤯', 'mind blown'),
      emoji('👍', 'thumbs up like', true),
      emoji('👎', 'thumbs down dislike', true),
      emoji('👏', 'clap applause', true),
      emoji('🙌', 'raised hands celebrate', true),
      emoji('🙏', 'pray please thanks', true),
      emoji('👋', 'wave hello', true),
      emoji('💪', 'muscle strong', true),
      emoji('🤝', 'handshake', true),
      emoji('🫶', 'heart hands', true),
      emoji('💙', 'blue heart'),
      emoji('❤️', 'red heart'),
      emoji('🔥', 'fire'),
      emoji('✨', 'sparkles'),
      emoji('🎉', 'party popper celebrate')
    ]
  },
  {
    id: 'nature',
    title: 'Animals & nature',
    icon: '🐶',
    emojis: [
      emoji('🐶', 'dog'),
      emoji('🐱', 'cat'),
      emoji('🐭', 'mouse'),
      emoji('🐹', 'hamster'),
      emoji('🐰', 'rabbit'),
      emoji('🦊', 'fox'),
      emoji('🐻', 'bear'),
      emoji('🐼', 'panda'),
      emoji('🐨', 'koala'),
      emoji('🐯', 'tiger'),
      emoji('🦁', 'lion'),
      emoji('🐮', 'cow'),
      emoji('🐸', 'frog'),
      emoji('🐵', 'monkey'),
      emoji('🐔', 'chicken'),
      emoji('🐧', 'penguin'),
      emoji('🐦', 'bird'),
      emoji('🐝', 'bee'),
      emoji('🦋', 'butterfly'),
      emoji('🐢', 'turtle'),
      emoji('🌸', 'flower blossom'),
      emoji('🌻', 'sunflower'),
      emoji('🌲', 'evergreen tree'),
      emoji('🌵', 'cactus'),
      emoji('🌈', 'rainbow'),
      emoji('⭐', 'star'),
      emoji('🌙', 'moon'),
      emoji('☀️', 'sun')
    ]
  },
  {
    id: 'food',
    title: 'Food & drink',
    icon: '🍔',
    emojis: [
      emoji('🍏', 'green apple'),
      emoji('🍎', 'red apple'),
      emoji('🍓', 'strawberry'),
      emoji('🍒', 'cherries'),
      emoji('🍑', 'peach'),
      emoji('🍍', 'pineapple'),
      emoji('🥑', 'avocado'),
      emoji('🍞', 'bread'),
      emoji('🥐', 'croissant'),
      emoji('🍕', 'pizza'),
      emoji('🍔', 'burger'),
      emoji('🍟', 'fries'),
      emoji('🌮', 'taco'),
      emoji('🍣', 'sushi'),
      emoji('🍩', 'donut'),
      emoji('🍪', 'cookie'),
      emoji('🎂', 'cake birthday'),
      emoji('☕', 'coffee'),
      emoji('🍺', 'beer'),
      emoji('🥂', 'cheers')
    ]
  },
  {
    id: 'activity',
    title: 'Activities',
    icon: '⚽',
    emojis: [
      emoji('⚽', 'soccer football'),
      emoji('🏀', 'basketball'),
      emoji('🏈', 'football'),
      emoji('⚾', 'baseball'),
      emoji('🎾', 'tennis'),
      emoji('🏐', 'volleyball'),
      emoji('🎱', 'pool billiards'),
      emoji('🎮', 'video game'),
      emoji('🕹️', 'joystick'),
      emoji('🎧', 'headphones'),
      emoji('🎤', 'microphone'),
      emoji('🎬', 'movie clapper'),
      emoji('🎨', 'art palette'),
      emoji('🎲', 'dice'),
      emoji('🏆', 'trophy'),
      emoji('🥇', 'gold medal')
    ]
  },
  {
    id: 'travel',
    title: 'Travel & places',
    icon: '🚀',
    emojis: [
      emoji('🚗', 'car'),
      emoji('🚕', 'taxi'),
      emoji('🚌', 'bus'),
      emoji('🚎', 'trolleybus'),
      emoji('🏎️', 'race car'),
      emoji('🚓', 'police car'),
      emoji('🚑', 'ambulance'),
      emoji('🚒', 'fire truck'),
      emoji('🚲', 'bike bicycle'),
      emoji('✈️', 'airplane flight'),
      emoji('🚀', 'rocket'),
      emoji('🛸', 'ufo'),
      emoji('⛵', 'sailboat'),
      emoji('🚢', 'ship'),
      emoji('🏠', 'house'),
      emoji('🏙️', 'city'),
      emoji('🌉', 'bridge'),
      emoji('🗽', 'statue liberty')
    ]
  },
  {
    id: 'objects',
    title: 'Objects',
    icon: '💡',
    emojis: [
      emoji('💡', 'idea light bulb'),
      emoji('📱', 'phone mobile'),
      emoji('💻', 'laptop computer'),
      emoji('⌨️', 'keyboard'),
      emoji('🖥️', 'desktop computer'),
      emoji('📷', 'camera'),
      emoji('🎥', 'video camera'),
      emoji('📚', 'books'),
      emoji('✏️', 'pencil'),
      emoji('📝', 'memo note'),
      emoji('📌', 'pin'),
      emoji('🔒', 'lock'),
      emoji('🔑', 'key'),
      emoji('💰', 'money bag'),
      emoji('🎁', 'gift'),
      emoji('🔔', 'bell'),
      emoji('📣', 'megaphone'),
      emoji('🧵', 'thread')
    ]
  },
  {
    id: 'symbols',
    title: 'Symbols',
    icon: '❤️',
    emojis: [
      emoji('❤️', 'red heart'),
      emoji('🧡', 'orange heart'),
      emoji('💛', 'yellow heart'),
      emoji('💚', 'green heart'),
      emoji('💙', 'blue heart'),
      emoji('💜', 'purple heart'),
      emoji('🖤', 'black heart'),
      emoji('🤍', 'white heart'),
      emoji('💯', 'hundred'),
      emoji('✅', 'check mark'),
      emoji('☑️', 'check box'),
      emoji('❌', 'cross mark'),
      emoji('⚠️', 'warning'),
      emoji('🚫', 'prohibited'),
      emoji('♻️', 'recycle'),
      emoji('🔁', 'repeat'),
      emoji('🔴', 'red circle'),
      emoji('🔵', 'blue circle')
    ]
  },
  {
    id: 'flags',
    title: 'Flags',
    icon: '🏳️',
    emojis: [
      emoji('🏳️', 'white flag'),
      emoji('🏴', 'black flag'),
      emoji('🏁', 'checkered flag'),
      emoji('🚩', 'triangular flag'),
      emoji('🏳️‍🌈', 'rainbow flag pride'),
      emoji('🏳️‍⚧️', 'transgender flag pride'),
      emoji('🇺🇸', 'flag united states usa'),
      emoji('🇨🇦', 'flag canada'),
      emoji('🇬🇧', 'flag united kingdom'),
      emoji('🇪🇺', 'flag european union'),
      emoji('🇯🇵', 'flag japan'),
      emoji('🇰🇷', 'flag korea'),
      emoji('🇦🇺', 'flag australia'),
      emoji('🇲🇽', 'flag mexico'),
      emoji('🇧🇷', 'flag brazil'),
      emoji('🇺🇦', 'flag ukraine')
    ]
  }
] as const;

function getRecentEmojis(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(
      localStorage.getItem(recentEmojisKey) ?? '[]'
    ) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeRecentEmoji(nextEmoji: string): string[] {
  const nextEmojis = [
    nextEmoji,
    ...getRecentEmojis().filter((emoji) => emoji !== nextEmoji)
  ].slice(0, 32);

  try {
    localStorage.setItem(recentEmojisKey, JSON.stringify(nextEmojis));
  } catch {
    // Recent emojis are a convenience only.
  }

  return nextEmojis;
}

function applySkinTone(
  { emoji, skinTone }: EmojiItem,
  modifier: string
): string {
  if (!skinTone || !modifier) return emoji;

  const parts = Array.from(emoji.replace(emojiSkinToneRegex, ''));

  return parts.length
    ? `${parts[0]}${modifier}${parts.slice(1).join('')}`
    : emoji;
}

function Twemoji({
  emoji,
  className = 'h-7 w-7'
}: {
  emoji: string;
  className?: string;
}): JSX.Element {
  return (
    <img
      className={className}
      src={getTwemojiSvgUrl(emoji)}
      alt={emoji}
      draggable={false}
    />
  );
}

function mapKlipyGif(gif: KlipyGif): GifSelection | null {
  const gifMedia = gif.media_formats?.gif ?? gif.media_formats?.tinygif;
  const previewMedia = gif.media_formats?.tinygif ?? gifMedia;

  if (!gifMedia || !previewMedia) return null;

  const dimensions = gifMedia.dims ?? previewMedia.dims;

  return {
    id: gif.id,
    title: gif.content_description?.trim() || gif.title?.trim() || 'GIF',
    src: gifMedia.url,
    preview: previewMedia.url || gifMedia.preview || gifMedia.url,
    aspectRatio: dimensions
      ? { width: dimensions[0], height: dimensions[1] }
      : null
  };
}

function GifPicker({
  onClose,
  onSelectGif
}: Pick<TwitterComposePickerProps, 'onClose' | 'onSelectGif'>): JSX.Element {
  const [searchValue, setSearchValue] = useState('');
  const [categoryTiles, setCategoryTiles] = useState<FoundMediaCategoryTile[]>(
    () =>
      foundMediaCategories.map((category) => ({
        ...category,
        image: null
      }))
  );
  const [results, setResults] = useState<GifSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchQuery = searchValue.trim();
  const handleSearchChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => setSearchValue(value);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const getCategoryTile = async (
      category: FoundMediaCategory
    ): Promise<FoundMediaCategoryTile> => {
      const params = new URLSearchParams({
        q: category.searchTerm,
        limit: '1',
        media_filter: 'gif,tinygif,mp4,tinymp4',
        contentfilter: 'high'
      }).toString();

      try {
        const response = await fetch(`${klipySearchEndpoint}?${params}`, {
          signal: controller.signal
        });
        if (!response.ok)
          throw new Error(`KLIPY request failed: ${response.status}`);
        const { results = [] } = (await response.json()) as KlipyResponse;
        const gif = results.map(mapKlipyGif).find(Boolean);

        return { ...category, image: gif?.src ?? gif?.preview ?? null };
      } catch {
        return { ...category, image: null };
      }
    };

    void Promise.all(foundMediaCategories.map(getCategoryTile)).then(
      (nextTiles) => {
        if (!controller.signal.aborted) setCategoryTiles(nextTiles);
      }
    );

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setResults([]);
      return;
    }

    const controller = new AbortController();

    setLoading(true);

    const params = new URLSearchParams({
      q: searchQuery,
      limit: '45',
      media_filter: 'gif,tinygif,mp4,tinymp4',
      contentfilter: 'high'
    }).toString();

    void fetch(`${klipySearchEndpoint}?${params}`, {
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`KLIPY request failed: ${response.status}`);
        return response.json() as Promise<KlipyResponse>;
      })
      .then(({ results = [] }) => {
        setResults(
          results.map(mapKlipyGif).filter((gif): gif is GifSelection => !!gif)
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setResults([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [searchQuery]);

  const closeOrBack = (): void => {
    if (searchQuery) {
      setSearchValue('');
      return;
    }

    onClose();
  };

  const clearSearch = (): void => {
    setSearchValue('');
    searchInputRef.current?.focus();
  };

  return (
    <>
      <div className='flex h-10 items-center gap-2 bg-main-background px-2'>
        <Button
          className='accent-tab flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-main-accent
                     hover:bg-main-accent/10 active:bg-main-accent/20'
          onClick={closeOrBack}
          aria-label={searchQuery ? 'Back' : 'Close'}
          title={searchQuery ? 'Back' : 'Close'}
        >
          <CustomIcon
            className='h-5 w-5'
            iconName={searchQuery ? 'TwitterArrowLeftIcon' : 'TwitterCloseIcon'}
          />
        </Button>
        <label
          className='flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full border border-main-accent
                     bg-main-background px-3 text-[14px] leading-none text-light-secondary
                     dark:text-dark-secondary'
        >
          <CustomIcon
            className='h-4 w-4 shrink-0'
            iconName='TwitterSearchIcon'
          />
          <input
            className='min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-light-secondary
                       dark:placeholder:text-dark-secondary'
            placeholder='Search GIFs'
            value={searchValue}
            onChange={handleSearchChange}
            ref={searchInputRef}
          />
          {searchQuery && (
            <Button
              className='accent-tab -mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                         bg-main-accent p-0 text-main-background hover:bg-main-accent/90
                         active:bg-main-accent/80 dark:text-dark-primary'
              onClick={clearSearch}
              aria-label='Clear search'
              title='Clear search'
            >
              <CustomIcon className='h-3 w-3' iconName='TwitterCloseIcon' />
            </Button>
          )}
        </label>
      </div>
      {searchQuery && (
        <div className='flex h-[30px] items-center justify-between bg-main-background px-2 text-[14px] text-light-secondary dark:text-dark-secondary'>
          <span>Autoplay GIFs</span>
          <span
            className='relative h-4 w-8 rounded-full bg-main-accent'
            aria-hidden='true'
          >
            <span className='absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white' />
          </span>
        </div>
      )}
      <div
        className={cn(
          'overflow-y-auto overscroll-contain bg-main-background',
          searchQuery ? 'h-[488px]' : 'h-[520px]'
        )}
      >
        {!searchQuery ? (
          <div className='grid grid-cols-2 gap-0.5'>
            {categoryTiles.map((category, index) => {
              const selectCategory = (): void =>
                setSearchValue(category.searchTerm);

              return (
                <button
                  className='accent-tab group relative flex h-[130px] items-end overflow-hidden bg-main-search-background
                               p-2 text-left text-[17px] font-bold leading-5 text-white'
                  type='button'
                  onClick={selectCategory}
                  key={category.searchTerm}
                >
                  {category.image ? (
                    <img
                      className='absolute inset-0 h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-95'
                      src={category.image}
                      alt=''
                      draggable={false}
                    />
                  ) : (
                    <span
                      className={cn(
                        'absolute inset-0',
                        index % 5 === 0 &&
                          'bg-gradient-to-br from-accent-blue to-accent-purple',
                        index % 5 === 1 &&
                          'bg-gradient-to-br from-accent-orange to-accent-pink',
                        index % 5 === 2 &&
                          'bg-gradient-to-br from-accent-green to-accent-blue',
                        index % 5 === 3 &&
                          'bg-gradient-to-br from-accent-purple to-accent-pink',
                        index % 5 === 4 &&
                          'bg-gradient-to-br from-accent-yellow to-accent-orange'
                      )}
                    />
                  )}
                  <span className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent' />
                  <span className='relative z-10 drop-shadow'>
                    {category.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : loading ? (
          <div className='flex h-full items-center justify-center text-light-secondary dark:text-dark-secondary'>
            Loading GIFs
          </div>
        ) : results.length ? (
          <div className='columns-3 gap-1 [column-fill:_balance]'>
            {results.map((gif) => {
              const selectGif = (): void => onSelectGif(gif);
              const width = gif.aspectRatio?.width ?? 16;
              const height = gif.aspectRatio?.height ?? 9;

              return (
                <button
                  className='accent-tab group mb-1 block w-full break-inside-avoid overflow-hidden
                             bg-main-search-background'
                  type='button'
                  title={gif.title}
                  onClick={selectGif}
                  key={gif.id}
                  style={{ aspectRatio: `${width} / ${height}` }}
                >
                  <img
                    className='h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-95'
                    src={gif.src}
                    alt={gif.title}
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <div className='mx-auto flex h-full max-w-[320px] flex-col justify-center px-8'>
            <h3 className='text-[28px] font-extrabold leading-9'>
              No GIFs found
            </h3>
            <p className='mt-2 text-[15px] text-light-secondary dark:text-dark-secondary'>
              Try searching for something else.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function EmojiPicker({
  onSelectEmoji
}: Pick<TwitterComposePickerProps, 'onSelectEmoji'>): JSX.Element {
  const [searchValue, setSearchValue] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [skinToneModifier, setSkinToneModifier] = useState('');
  const [activeSectionId, setActiveSectionId] = useState(emojiSections[0].id);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const normalizedSearch = searchValue.trim().toLowerCase();
  const handleSearchChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => setSearchValue(value);

  useEffect(() => {
    searchInputRef.current?.focus();
    setRecentEmojis(getRecentEmojis());
  }, []);

  const allSections = useMemo<EmojiSection[]>(
    () => [
      ...(recentEmojis.length
        ? [
            {
              id: 'recent',
              title: 'Recently used',
              icon: '🕘',
              emojis: recentEmojis.map((recentEmoji) =>
                emoji(recentEmoji, 'recently used emoji')
              )
            }
          ]
        : []),
      ...emojiSections
    ],
    [recentEmojis]
  );

  const sections = useMemo<FilteredEmojiSection[]>(
    () =>
      allSections
        .map((section) => ({
          ...section,
          emojis: section.emojis
            .map((item) => ({
              ...item,
              emoji: applySkinTone(item, skinToneModifier)
            }))
            .filter(({ emoji, name }): boolean => {
              if (!normalizedSearch) return true;

              return (
                section.title.toLowerCase().includes(normalizedSearch) ||
                name.toLowerCase().includes(normalizedSearch) ||
                emoji.includes(normalizedSearch)
              );
            })
        }))
        .filter(({ emojis }): boolean => !!emojis.length),
    [allSections, normalizedSearch, skinToneModifier]
  );

  const clearSearch = (): void => {
    setSearchValue('');
    searchInputRef.current?.focus();
  };

  const selectSkinTone = (modifier: string) => (): void => {
    setSkinToneModifier(modifier);
  };

  const selectEmoji = (selectedEmoji: string): void => {
    setRecentEmojis(writeRecentEmoji(selectedEmoji));
    onSelectEmoji(selectedEmoji);
  };

  const scrollToSection = (sectionId: string) => (): void => {
    setSearchValue('');
    setActiveSectionId(sectionId);

    requestAnimationFrame(() => {
      sectionRefs.current[sectionId]?.scrollIntoView({ block: 'start' });
    });
  };

  const handleEmojiScroll = (): void => {
    if (normalizedSearch) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const containerTop = scrollContainer.getBoundingClientRect().top;
    let nextSectionId: string | null = null;

    for (const { id } of sections) {
      const section = sectionRefs.current[id];
      if (!section) continue;

      if (section.getBoundingClientRect().top - containerTop <= 16)
        nextSectionId = id;
    }

    if (nextSectionId) setActiveSectionId(nextSectionId);
  };

  return (
    <div className='flex h-[467px] flex-col'>
      <div className='px-3 pb-2'>
        <label
          className='flex h-11 items-center gap-3 rounded-full bg-main-search-background
                     px-4 text-light-secondary dark:text-dark-secondary'
        >
          <CustomIcon className='h-5 w-5' iconName='TwitterSearchIcon' />
          <input
            className='min-w-0 flex-1 bg-transparent outline-none placeholder:text-light-secondary
                       dark:placeholder:text-dark-secondary'
            placeholder='Search emojis'
            value={searchValue}
            onChange={handleSearchChange}
            ref={searchInputRef}
          />
          {normalizedSearch && (
            <Button
              className='accent-tab -mr-1 flex h-6 w-6 shrink-0 items-center justify-center
                         rounded-full bg-light-secondary p-0 text-main-background
                         hover:bg-light-secondary/90 active:bg-light-secondary/80
                         dark:bg-dark-secondary dark:text-light-primary'
              onClick={clearSearch}
              aria-label='Clear search'
              title='Clear search'
            >
              <CustomIcon className='h-3 w-3' iconName='TwitterCloseIcon' />
            </Button>
          )}
        </label>
      </div>
      <div className='flex h-10 items-center gap-1 px-3 pb-2'>
        {skinToneOptions.map(({ label, modifier }) => {
          const selected = modifier === skinToneModifier;
          const previewEmoji = applySkinTone(
            emoji('✋', label, true),
            modifier
          );

          return (
            <Button
              className={cn(
                `accent-tab flex h-8 w-8 items-center justify-center rounded-full p-0
                 hover:bg-main-accent/10 active:bg-main-accent/20`,
                selected && 'bg-main-accent/10 ring-2 ring-main-accent'
              )}
              onClick={selectSkinTone(modifier)}
              aria-label={`${label} skin tone`}
              title={`${label} skin tone`}
              key={label}
            >
              <Twemoji className='h-5 w-5' emoji={previewEmoji} />
            </Button>
          );
        })}
      </div>
      <div
        className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2'
        onScroll={handleEmojiScroll}
        ref={scrollContainerRef}
      >
        {sections.length ? (
          sections.map(({ id, title, emojis }) => (
            <section
              className='mb-4 scroll-mt-2'
              ref={(node): void => {
                sectionRefs.current[id] = node;
              }}
              key={id}
            >
              <h3 className='mb-2 text-[13px] font-bold uppercase text-light-secondary dark:text-dark-secondary'>
                {title}
              </h3>
              <div className='grid grid-cols-8 gap-1'>
                {emojis.map(({ emoji, name }) => {
                  const handleSelectEmoji = (): void => selectEmoji(emoji);

                  return (
                    <button
                      className='accent-tab flex h-9 w-9 items-center justify-center rounded-full
                                 hover:bg-main-accent/10 active:bg-main-accent/20'
                      type='button'
                      onClick={handleSelectEmoji}
                      aria-label={name}
                      title={name}
                      key={`${id}-${emoji}-${name}`}
                    >
                      <Twemoji emoji={emoji} />
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className='mx-auto flex h-full max-w-[300px] flex-col justify-center px-5'>
            <h3 className='text-[26px] font-extrabold leading-8'>
              No emojis found
            </h3>
            <p className='mt-2 text-[15px] text-light-secondary dark:text-dark-secondary'>
              Try searching for something else.
            </p>
          </div>
        )}
      </div>
      <div className='grid h-12 shrink-0 auto-cols-fr grid-flow-col border-t border-light-border dark:border-dark-border'>
        {allSections.map(({ id, title, icon }) => {
          const selected = id === activeSectionId && !normalizedSearch;

          return (
            <Button
              className={cn(
                `accent-tab relative flex h-12 items-center justify-center rounded-none p-0
                 text-light-secondary hover:bg-light-primary/5 active:bg-light-primary/10
                 dark:text-dark-secondary dark:hover:bg-dark-primary/5
                 dark:active:bg-dark-primary/10`,
                selected && 'text-main-accent'
              )}
              onClick={scrollToSection(id)}
              aria-label={title}
              title={title}
              key={id}
            >
              <Twemoji className='h-5 w-5' emoji={icon} />
              {selected && (
                <span className='absolute bottom-0 h-1 w-full bg-main-accent' />
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function clampPosition(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function getEmojiPickerStyle(
  anchorElement: HTMLElement | null | undefined,
  placement: TwitterComposePickerProps['placement']
): CSSProperties {
  if (!anchorElement)
    return {
      left: '50%',
      top: pickerViewportMargin,
      transform: 'translateX(-50%)'
    };

  const rect = anchorElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = viewportWidth - emojiPickerWidth - pickerViewportMargin;
  const left = clampPosition(rect.left, pickerViewportMargin, maxLeft);
  const topBelow = rect.bottom + pickerOffset;
  const topAbove = rect.top - emojiPickerHeight - pickerOffset;
  const preferredTop = placement === 'below' ? topBelow : topAbove;
  const fallbackTop = placement === 'below' ? topAbove : topBelow;
  const top =
    preferredTop < pickerViewportMargin ||
    preferredTop + emojiPickerHeight > viewportHeight - pickerViewportMargin
      ? fallbackTop
      : preferredTop;
  const maxTop = viewportHeight - emojiPickerHeight - pickerViewportMargin;

  return {
    left,
    top: clampPosition(top, pickerViewportMargin, maxTop)
  };
}

export function TwitterComposePicker({
  type,
  placement,
  anchorElement,
  onClose,
  onSelectEmoji,
  onSelectGif
}: TwitterComposePickerProps): JSX.Element {
  const [mounted, setMounted] = useState(false);
  const [emojiPickerStyle, setEmojiPickerStyle] = useState<CSSProperties>({});
  const isGifPicker = type === 'gif';

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!mounted || isGifPicker) return;

    const updatePosition = (): void => {
      setEmojiPickerStyle(getEmojiPickerStyle(anchorElement, placement));
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorElement, isGifPicker, mounted, placement]);

  if (!mounted) return <></>;

  if (isGifPicker)
    return createPortal(
      <div
        className='fixed inset-0 z-[70] bg-black/40 dark:bg-[#5B7083]/40'
        onClick={onClose}
      >
        <div
          className='fixed left-1/2 top-6 z-[80] w-[500px] max-w-[calc(100vw-24px)]
                     -translate-x-1/2 overflow-hidden rounded-[6px] bg-main-background text-light-primary
                     dark:text-dark-primary'
          role='dialog'
          aria-label='Choose a GIF'
          onClick={(event): void => event.stopPropagation()}
        >
          <GifPicker onClose={onClose} onSelectGif={onSelectGif} />
        </div>
      </div>,
      document.body
    );

  return createPortal(
    <div
      className='menu-container fixed z-[90] w-[350px] max-w-[calc(100vw-24px)] overflow-hidden
                 rounded-2xl border border-light-border bg-main-background text-light-primary
                 dark:border-dark-border dark:text-dark-primary'
      style={emojiPickerStyle}
      role='dialog'
      aria-label='Add an emoji'
    >
      <div className='grid h-[53px] grid-cols-[40px,1fr,40px] items-center px-2'>
        <Button
          className='accent-tab accent-bg-tab rounded-full p-2 text-light-primary
                     hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:text-dark-primary dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          onClick={onClose}
          aria-label='Close'
          title='Close'
        >
          <CustomIcon className='h-5 w-5' iconName='TwitterCloseIcon' />
        </Button>
        <h2 className='text-center text-xl font-extrabold'>
          {isGifPicker ? 'Choose a GIF' : 'Add an emoji'}
        </h2>
        <span aria-hidden='true' />
      </div>
      <EmojiPicker onSelectEmoji={onSelectEmoji} />
    </div>,
    document.body
  );
}
