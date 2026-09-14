/* eslint-disable react-hooks/exhaustive-deps */

import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
  useMemo,
  type JSX
} from 'react';
import { useAuth } from './auth-context';
import type { ReactNode, ChangeEvent } from 'react';
import type { Theme, Accent, FontSize } from '@lib/types/theme';

type DarkTheme = Extract<Theme, 'dim' | 'dark'>;

type ThemeContext = {
  theme: Theme;
  accent: Accent;
  fontSize: FontSize;
  hideBskySocialSuffix: boolean;
  squareProfilePictures: boolean;
  changeTheme: ({ target: { value } }: ChangeEvent<HTMLInputElement>) => void;
  changeAccent: ({ target: { value } }: ChangeEvent<HTMLInputElement>) => void;
  changeFontSize: (fontSize: FontSize) => void;
  toggleColorScheme: () => void;
  toggleHideBskySocialSuffix: () => void;
  toggleSquareProfilePictures: () => void;
};

export const ThemeContext = createContext<ThemeContext | null>(null);

type ThemeContextProviderProps = {
  children: ReactNode;
};

const lastDarkThemeKey = 'lastDarkTheme';
const fontSizeKey = 'fontSize';
const fontSizeRootPixels: Record<FontSize, string> = {
  xs: '14px',
  sm: '15px',
  md: '16px',
  lg: '18px',
  xl: '20px'
};
const fontSizeScales: Record<FontSize, number> = {
  xs: 0.9,
  sm: 0.96,
  md: 1,
  lg: 1.08,
  xl: 1.16
};

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dim' || value === 'dark';
}

function isDarkTheme(value: string | null): value is DarkTheme {
  return value === 'dim' || value === 'dark';
}

function isFontSize(value: string | null): value is FontSize {
  return (
    value === 'xs' ||
    value === 'sm' ||
    value === 'md' ||
    value === 'lg' ||
    value === 'xl'
  );
}

function setInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';

  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  return isTheme(savedTheme) ? savedTheme : prefersDark ? 'dark' : 'light';
}

function setInitialAccent(): Accent {
  if (typeof window === 'undefined') return 'blue';

  const savedAccent = localStorage.getItem('accent') as Accent | null;

  return savedAccent ?? 'blue';
}

function setInitialFontSize(): FontSize {
  if (typeof window === 'undefined') return 'md';

  const savedFontSize = localStorage.getItem(fontSizeKey);

  return isFontSize(savedFontSize) ? savedFontSize : 'md';
}

function setInitialHideBskySocialSuffix(): boolean {
  if (typeof window === 'undefined') return false;

  return localStorage.getItem('hideBskySocialSuffix') === 'true';
}

function setInitialSquareProfilePictures(): boolean {
  if (typeof window === 'undefined') return false;

  return localStorage.getItem('squareProfilePictures') === 'true';
}

function setInitialLastDarkTheme(): DarkTheme {
  if (typeof window === 'undefined') return 'dark';

  const savedLastDarkTheme = localStorage.getItem(lastDarkThemeKey);
  const savedTheme = localStorage.getItem('theme');

  if (isDarkTheme(savedLastDarkTheme)) return savedLastDarkTheme;
  if (isDarkTheme(savedTheme)) return savedTheme;

  return 'dark';
}

export function ThemeContextProvider({
  children
}: ThemeContextProviderProps): JSX.Element {
  const [theme, setTheme] = useState<Theme>(setInitialTheme);
  const [accent, setAccent] = useState<Accent>(setInitialAccent);
  const [fontSize, setFontSize] = useState<FontSize>(setInitialFontSize);
  const [lastDarkTheme, setLastDarkTheme] = useState<DarkTheme>(
    setInitialLastDarkTheme
  );
  const [hideBskySocialSuffix, setHideBskySocialSuffix] = useState(
    setInitialHideBskySocialSuffix
  );
  const [squareProfilePictures, setSquareProfilePictures] = useState(
    setInitialSquareProfilePictures
  );

  const { user } = useAuth();
  const { id: userId, theme: userTheme, accent: userAccent } = user ?? {};

  useEffect(() => {
    if (user && userTheme) setTheme(userTheme);
  }, [userId, userTheme]);

  useEffect(() => {
    if (user && userAccent) setAccent(userAccent);
  }, [userId, userAccent]);

  useEffect(() => {
    const flipTheme = (theme: Theme): NodeJS.Timeout | undefined => {
      const root = document.documentElement;
      const targetTheme = theme === 'dim' ? 'dark' : theme;

      if (targetTheme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');

      root.style.setProperty('--main-background', `var(--${theme}-background)`);
      root.style.setProperty('--main-primary', `var(--${theme}-primary)`);
      root.style.setProperty('--main-secondary', `var(--${theme}-secondary)`);

      root.style.setProperty(
        '--main-search-background',
        `var(--${theme}-search-background)`
      );

      root.style.setProperty(
        '--main-sidebar-background',
        `var(--${theme}-sidebar-background)`
      );

      localStorage.setItem('theme', theme);

      if (user)
        return setTimeout(() => {
          void import('@lib/atproto/utils').then(({ updateUserTheme }) =>
            updateUserTheme(user.id, { theme })
          );
        }, 500);

      return undefined;
    };

    const timeoutId = flipTheme(theme);
    return () => clearTimeout(timeoutId);
  }, [userId, theme]);

  useEffect(() => {
    if (!isDarkTheme(theme)) return;

    setLastDarkTheme(theme);
    localStorage.setItem(lastDarkThemeKey, theme);
  }, [theme]);

  useEffect(() => {
    const flipAccent = (accent: Accent): NodeJS.Timeout | undefined => {
      const root = document.documentElement;

      root.style.setProperty('--main-accent', `var(--accent-${accent})`);

      localStorage.setItem('accent', accent);

      if (user)
        return setTimeout(() => {
          void import('@lib/atproto/utils').then(({ updateUserTheme }) =>
            updateUserTheme(user.id, { accent })
          );
        }, 500);

      return undefined;
    };

    const timeoutId = flipAccent(accent);
    return () => clearTimeout(timeoutId);
  }, [userId, accent]);

  useEffect(() => {
    const root = document.documentElement;
    const rootFontSize = fontSizeRootPixels[fontSize];
    const scale = fontSizeScales[fontSize];

    root.style.fontSize = rootFontSize;
    root.style.setProperty('--not-twitter-font-size', rootFontSize);
    root.style.setProperty('--display-font-scale', `${scale}`);
    root.style.setProperty('--tweet-font-size', `${15 * scale}px`);
    root.style.setProperty('--tweet-line-height', `${20 * scale}px`);
    root.style.setProperty('--tweet-detail-font-size', `${23 * scale}px`);
    root.style.setProperty('--tweet-detail-line-height', `${28 * scale}px`);
    root.style.setProperty('--quoted-tweet-font-size', `${15 * scale}px`);
    root.style.setProperty('--quoted-tweet-line-height', `${20 * scale}px`);
    root.style.setProperty('--article-font-size', `${17 * scale}px`);
    root.style.setProperty('--article-line-height', `${24 * scale}px`);
    root.style.setProperty('--article-heading-font-size', `${20 * scale}px`);
    root.style.setProperty('--article-heading-line-height', `${24 * scale}px`);
    root.style.setProperty('--article-code-font-size', `${14 * scale}px`);
    root.style.setProperty('--article-code-line-height', `${20 * scale}px`);
    root.dataset.fontSize = fontSize;
    localStorage.setItem(fontSizeKey, fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(
      'hideBskySocialSuffix',
      hideBskySocialSuffix ? 'true' : 'false'
    );
  }, [hideBskySocialSuffix]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--profile-picture-radius',
      squareProfilePictures ? '16%' : '9999px'
    );
    document.documentElement.style.setProperty(
      '--profile-picture-frame-radius',
      squareProfilePictures ? '19%' : '9999px'
    );
    localStorage.setItem(
      'squareProfilePictures',
      squareProfilePictures ? 'true' : 'false'
    );
  }, [squareProfilePictures]);

  const changeTheme = useCallback(
    ({ target: { value } }: ChangeEvent<HTMLInputElement>): void =>
      setTheme(value as Theme),
    []
  );

  const changeAccent = useCallback(
    ({ target: { value } }: ChangeEvent<HTMLInputElement>): void =>
      setAccent(value as Accent),
    []
  );

  const changeFontSize = useCallback(
    (nextFontSize: FontSize): void => setFontSize(nextFontSize),
    []
  );

  const toggleColorScheme = useCallback(
    (): void =>
      setTheme((currentTheme) =>
        currentTheme === 'light' ? lastDarkTheme : 'light'
      ),
    [lastDarkTheme]
  );

  const toggleHideBskySocialSuffix = useCallback(
    (): void => setHideBskySocialSuffix((currentValue) => !currentValue),
    []
  );

  const toggleSquareProfilePictures = useCallback(
    (): void => setSquareProfilePictures((currentValue) => !currentValue),
    []
  );

  const value = useMemo<ThemeContext>(
    () => ({
      theme,
      accent,
      fontSize,
      hideBskySocialSuffix,
      squareProfilePictures,
      changeTheme,
      changeAccent,
      changeFontSize,
      toggleColorScheme,
      toggleHideBskySocialSuffix,
      toggleSquareProfilePictures
    }),
    [
      accent,
      changeAccent,
      changeFontSize,
      changeTheme,
      fontSize,
      hideBskySocialSuffix,
      squareProfilePictures,
      theme,
      toggleColorScheme,
      toggleHideBskySocialSuffix,
      toggleSquareProfilePictures
    ]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContext {
  const context = useContext(ThemeContext);

  if (!context)
    throw new Error('useTheme must be used within an ThemeContextProvider');

  return context;
}
