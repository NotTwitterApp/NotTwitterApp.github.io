import { useState, useRef, useEffect, type JSX } from 'react';
import { useRouter } from 'next/router';
import cn from 'clsx';
import { useSearchUsers } from '@lib/api/search';
import { useTheme } from '@lib/context/theme-context';
import {
  formatAtprotoDisplayIdentifier,
  normalizeProfileSearchActor
} from '@lib/atproto/identity';
import { getUserPath } from '@lib/routes';
import { NextImage } from '@components/ui/next-image';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon } from '@components/ui/hero-icon';
import { Button } from '@components/ui/button';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import type { User } from '@lib/types/user';

type SearchBarProps = {
  className?: string;
  labelClassName?: string;
  placeholder?: string;
  sticky?: boolean;
  withDropdown?: boolean;
};

const typeaheadDelayMs = 250;
const typeaheadUserLimit = 5;

function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function useDebouncedValue(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delay);

    return () => clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

function SearchUserRow({
  user,
  onSelect
}: {
  user: User;
  onSelect: (user: User) => void;
}): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const displayUsername = formatAtprotoDisplayIdentifier(user.username, {
    hideBskySocialSuffix
  });

  return (
    <button
      className='accent-tab hover-card flex w-full items-start gap-3 px-4 py-3 text-left'
      type='button'
      onClick={(): void => onSelect(user)}
    >
      <NextImage
        className='profile-picture w-10 shrink-0'
        imgClassName='profile-picture'
        width={40}
        height={40}
        src={user.photoURL}
        alt={user.name}
        useSkeleton
      />
      <span className='min-w-0 flex-1'>
        <span className='flex min-w-0 items-center gap-1 text-[15px] font-bold leading-5'>
          <span className='truncate'>{user.name}</span>
          {user.verified && (
            <CustomIcon
              className='h-4 w-4 shrink-0'
              iconName='TwitterVerifiedIcon'
            />
          )}
        </span>
        <span className='block truncate text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
          {displayUsername}
        </span>
        {user.bio && (
          <span
            className='mt-0.5 block overflow-hidden text-[15px] leading-5 [display:-webkit-box]
                       [-webkit-box-orient:vertical] [-webkit-line-clamp:2]'
          >
            {user.bio}
          </span>
        )}
      </span>
    </button>
  );
}

export function SearchBar({
  className,
  labelClassName,
  placeholder = 'Search Not Twitter',
  sticky = true,
  withDropdown = true
}: SearchBarProps): JSX.Element {
  const [inputValue, setInputValue] = useState('');
  const [focused, setFocused] = useState(false);

  const { push, query } = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { hideBskySocialSuffix } = useTheme();
  const trimmedInput = inputValue.trim();
  const profileActor = normalizeProfileSearchActor(trimmedInput);
  const profileActorLabel = formatAtprotoDisplayIdentifier(profileActor, {
    hideBskySocialSuffix
  });
  const debouncedInput = useDebouncedValue(trimmedInput, typeaheadDelayMs);
  const {
    data: usersData,
    loading: usersLoading,
    error: usersError
  } = useSearchUsers(
    debouncedInput,
    { disabled: !withDropdown || !focused || !debouncedInput },
    { revalidateOnFocus: false }
  );
  const users = usersData?.users.slice(0, typeaheadUserLimit) ?? [];
  const typeaheadLoading = trimmedInput !== debouncedInput || usersLoading;

  useEffect(() => {
    setInputValue(getRouteParam(query.q));
  }, [query.q]);

  const handleChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => setInputValue(value);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    if (!trimmedInput) return;

    void push({
      pathname: '/explore',
      query: { q: trimmedInput, src: 'typed_query' }
    });
  };

  const handleProfileClick = (): void => {
    if (!profileActor) return;

    void push(getUserPath(profileActor));
  };

  const handleUserSelect = (user: User): void => {
    void push(getUserPath(user.username));
  };

  const clearInputValue = (focus?: boolean) => (): void => {
    if (focus) inputRef.current?.focus();
    else inputRef.current?.blur();

    setInputValue('');
  };

  const handleFocus = (): void => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocused(true);
  };

  const handleBlur = (): void => {
    blurTimeoutRef.current = setTimeout(() => setFocused(false), 120);
  };

  const handleEscape = ({ key }: KeyboardEvent<HTMLInputElement>): void => {
    if (key === 'Escape') clearInputValue()();
  };

  return (
    <form
      className={cn(
        'hover-animation relative z-10 bg-main-background',
        sticky && 'sticky top-0 -my-2 py-2',
        className
      )}
      onSubmit={handleSubmit}
    >
      <label
        className={cn(
          `group flex h-11 items-center justify-between gap-4 rounded-full
           bg-main-search-background px-4 transition focus-within:bg-main-background
           focus-within:ring-2 focus-within:ring-main-accent`,
          labelClassName
        )}
      >
        <i>
          <HeroIcon
            className='h-5 w-5 text-light-secondary transition-colors 
                       group-focus-within:text-main-accent dark:text-dark-secondary'
            iconName='MagnifyingGlassIcon'
          />
        </i>
        <input
          className='peer flex-1 bg-transparent outline-none 
                     placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
          type='text'
          placeholder={placeholder}
          ref={inputRef}
          value={inputValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyUp={handleEscape}
        />
        <Button
          className={cn(
            'accent-tab bg-main-accent p-1 opacity-0 transition hover:bg-main-accent/90 disabled:opacity-0',
            inputValue && 'focus:opacity-100 peer-focus:opacity-100'
          )}
          onClick={clearInputValue(true)}
          disabled={!inputValue}
        >
          <HeroIcon className='h-3 w-3 stroke-white' iconName='XMarkIcon' />
        </Button>
      </label>
      {withDropdown && focused && (
        <div
          className='menu-container absolute top-full left-0 right-0 mt-2 overflow-hidden
                     rounded-2xl bg-main-background py-2'
          onMouseDown={(event): void => event.preventDefault()}
        >
          {trimmedInput ? (
            <>
              <button
                className='accent-tab hover-card flex w-full items-center gap-3 px-4 py-3 text-left'
                type='submit'
              >
                <HeroIcon
                  className='h-5 w-5 text-light-secondary dark:text-dark-secondary'
                  iconName='MagnifyingGlassIcon'
                />
                <span className='min-w-0 truncate'>
                  Search for &quot;{trimmedInput}&quot;
                </span>
              </button>
              {profileActor && (
                <button
                  className='accent-tab hover-card flex w-full items-center gap-3 px-4 py-3 text-left'
                  type='button'
                  onClick={handleProfileClick}
                >
                  <HeroIcon
                    className='h-5 w-5 text-light-secondary dark:text-dark-secondary'
                    iconName='UserCircleIcon'
                  />
                  <span className='min-w-0 truncate'>
                    Go to {profileActorLabel}
                  </span>
                </button>
              )}
              {typeaheadLoading ? (
                <div className='flex items-center gap-3 px-4 py-3 text-light-secondary dark:text-dark-secondary'>
                  <HeroIcon
                    className='h-5 w-5 animate-spin text-main-accent'
                    iconName='ArrowPathIcon'
                  />
                  <span className='text-[15px] leading-5'>Searching...</span>
                </div>
              ) : usersError ? (
                <p className='px-4 py-3 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
                  Something went wrong. Try searching again.
                </p>
              ) : users.length ? (
                users.map((user) => (
                  <SearchUserRow
                    user={user}
                    onSelect={handleUserSelect}
                    key={user.id}
                  />
                ))
              ) : (
                <p className='px-4 py-3 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
                  No people found for &quot;{trimmedInput}&quot;
                </p>
              )}
            </>
          ) : (
            <p className='px-8 py-5 text-center text-[15px] text-light-secondary dark:text-dark-secondary'>
              Try searching for people, topics, or keywords
            </p>
          )}
        </div>
      )}
    </form>
  );
}
