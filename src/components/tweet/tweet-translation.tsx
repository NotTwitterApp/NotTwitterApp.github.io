import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import cn from 'clsx';
import type { MouseEvent } from 'react';

type TweetTranslationProps = {
  text: string;
  langs?: readonly string[] | null;
  className?: string;
};

const UNKNOWN_LANGUAGE_CODES = new Set(['mul', 'und', 'zxx']);
const DEFAULT_TARGET_LANGUAGE = 'en';

type NativeTranslatorAvailability =
  'available' | 'downloadable' | 'downloading' | 'unavailable';

type NativeTranslator = {
  translate(text: string): Promise<string>;
  destroy?: () => void;
};

type NativeTranslatorConstructor = {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<NativeTranslatorAvailability>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<NativeTranslator>;
};

function getBaseLanguage(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return null;

  const base = normalized.split('-')[0];
  if (!base || UNKNOWN_LANGUAGE_CODES.has(base)) return null;

  return base;
}

function getBrowserPrimaryLanguage(): string {
  if (typeof navigator === 'undefined') return DEFAULT_TARGET_LANGUAGE;

  const language = navigator.languages?.[0] ?? navigator.language;

  return getBaseLanguage(language) ?? DEFAULT_TARGET_LANGUAGE;
}

function getPostLanguages(
  langs: readonly string[] | null | undefined
): string[] {
  if (!langs?.length) return [];

  return Array.from(
    new Set(langs.flatMap((lang) => getBaseLanguage(lang) ?? []))
  );
}

function getSourceLanguage(
  langs: readonly string[] | null | undefined,
  targetLanguage: string | null
): string | null {
  const target = getBaseLanguage(targetLanguage);
  const postLanguages = getPostLanguages(langs);

  return postLanguages.find((lang) => lang !== target) ?? null;
}

function shouldShowTranslation(
  langs: readonly string[] | null | undefined,
  targetLanguage: string | null
): boolean {
  if (!targetLanguage) return false;

  const target = getBaseLanguage(targetLanguage);
  const postLanguages = getPostLanguages(langs);

  if (!target || !postLanguages.length) return false;

  return !postLanguages.includes(target);
}

function getTranslatorLink(text: string, targetLanguage: string): string {
  return `https://translate.google.com/?sl=auto&tl=${targetLanguage}&text=${encodeURIComponent(
    text
  )}`;
}

function stopTweetNavigation(event: MouseEvent<HTMLElement>): void {
  event.preventDefault();
  event.stopPropagation();
}

function getNativeTranslator(): NativeTranslatorConstructor | null {
  if (typeof globalThis === 'undefined') return null;

  const { Translator } = globalThis as typeof globalThis & {
    Translator?: NativeTranslatorConstructor;
  };

  return Translator ?? null;
}

async function translateWithBrowser(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string | null> {
  const Translator = getNativeTranslator();
  if (!Translator) return null;

  const options = { sourceLanguage, targetLanguage };
  const availability = await Translator.availability(options);
  if (availability === 'unavailable') return null;

  const translator = await Translator.create(options);

  try {
    return await translator.translate(text);
  } finally {
    translator.destroy?.();
  }
}

function getLanguageName(language: string | null): string | null {
  if (!language) return null;

  try {
    return (
      new Intl.DisplayNames([getBrowserPrimaryLanguage()], {
        type: 'language',
        fallback: 'none'
      }).of(language) ?? null
    );
  } catch {
    return null;
  }
}

export function TweetTranslation({
  text,
  langs,
  className
}: TweetTranslationProps): JSX.Element | null {
  const [targetLanguage, setTargetLanguage] = useState<string | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    setTargetLanguage(getBrowserPrimaryLanguage());
  }, []);

  useEffect(() => {
    setTranslatedText(null);
    setIsTranslating(false);
  }, [text, langs]);

  const shouldTranslate = useMemo(
    () => shouldShowTranslation(langs, targetLanguage),
    [langs, targetLanguage]
  );

  const sourceLanguage = useMemo(
    () => getSourceLanguage(langs, targetLanguage),
    [langs, targetLanguage]
  );

  const activeTargetLanguage = targetLanguage ?? DEFAULT_TARGET_LANGUAGE;

  const openGoogleTranslate = useCallback((): void => {
    window.open(
      getTranslatorLink(text, activeTargetLanguage),
      '_blank',
      'noopener,noreferrer'
    );
  }, [activeTargetLanguage, text]);

  const handleTranslate = useCallback(
    async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
      stopTweetNavigation(event);
      if (isTranslating) return;

      if (!sourceLanguage) {
        openGoogleTranslate();
        return;
      }

      setIsTranslating(true);

      try {
        const browserTranslation = await translateWithBrowser(
          text,
          sourceLanguage,
          activeTargetLanguage
        );

        if (browserTranslation) {
          setTranslatedText(browserTranslation);
          return;
        }

        openGoogleTranslate();
      } catch {
        openGoogleTranslate();
      } finally {
        setIsTranslating(false);
      }
    },
    [
      activeTargetLanguage,
      isTranslating,
      openGoogleTranslate,
      sourceLanguage,
      text
    ]
  );

  if (!targetLanguage || !text.trim() || !shouldTranslate) return null;

  const sourceName = getLanguageName(sourceLanguage);

  if (translatedText)
    return (
      <div
        className={cn(
          'mt-2 flex min-w-0 flex-col gap-1 text-[15px]',
          className
        )}
        onClick={stopTweetNavigation}
      >
        <p className='whitespace-pre-line break-words leading-5 text-light-primary dark:text-dark-primary'>
          {translatedText}
        </p>
        <p className='text-[13px] leading-4 text-light-secondary dark:text-dark-secondary'>
          Translated{sourceName ? ` from ${sourceName}` : ''} by Chrome
        </p>
      </div>
    );

  return (
    <button
      className={cn(
        `custom-underline mt-1 inline-flex w-fit cursor-pointer border-0 bg-transparent
         p-0 text-left text-[15px] leading-5 text-main-accent outline-none`,
        isTranslating &&
          'cursor-default text-light-secondary no-underline dark:text-dark-secondary',
        className
      )}
      type='button'
      aria-disabled={isTranslating}
      onClick={handleTranslate}
    >
      {isTranslating ? 'Translating...' : 'Translate Tweet'}
    </button>
  );
}
