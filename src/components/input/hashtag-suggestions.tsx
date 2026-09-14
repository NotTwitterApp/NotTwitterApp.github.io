import { motion } from 'framer-motion';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useSearchUsers } from '@lib/api/search';
import { useTheme } from '@lib/context/theme-context';
import { getHashtagSuggestions } from '@lib/hashtags';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { NextImage } from '@components/ui/next-image';
import type { MouseEvent, JSX } from 'react';
import type { User } from '@lib/types/user';

type HashtagSuggestionsProps = {
  query: string;
  onSelect: (tag: string) => void;
};

type MentionSuggestionsProps = {
  query: string;
  onSelect: (username: string) => void;
};

const menuAnimation = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.12, ease: 'easeOut' }
} as const;

export function HashtagSuggestions({
  query,
  onSelect
}: HashtagSuggestionsProps): JSX.Element | null {
  const suggestions = getHashtagSuggestions(query);

  if (!suggestions.length) return null;

  const selectHashtag =
    (tag: string) =>
    (event: MouseEvent<HTMLButtonElement>): void => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(tag);
    };

  return (
    <motion.div
      className='menu-container relative z-30 mt-2 max-h-[296px] overflow-y-auto rounded-2xl
                 bg-main-background py-2'
      role='listbox'
      aria-label='Hashtag suggestions'
      {...menuAnimation}
      onMouseDown={(event): void => event.preventDefault()}
    >
      {suggestions.map((tag) => (
        <button
          className='accent-tab hover-card flex w-full items-center gap-3 px-4 py-3 text-left'
          type='button'
          onMouseDown={selectHashtag(tag)}
          onClick={(event): void => {
            if (event.detail === 0) onSelect(tag);
          }}
          role='option'
          aria-selected={false}
          key={tag}
        >
          <span
            className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                       bg-main-accent/10 text-main-accent'
            aria-hidden='true'
          >
            <HeroIcon className='h-5 w-5' iconName='HashtagIcon' />
          </span>
          <span className='min-w-0'>
            <span className='block truncate font-bold'>#{tag}</span>
            <span className='block text-sm text-light-secondary dark:text-dark-secondary'>
              Trending
            </span>
          </span>
        </button>
      ))}
    </motion.div>
  );
}

function MentionSuggestionRow({
  user,
  onSelect
}: {
  user: User;
  onSelect: (username: string) => void;
}): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const displayUsername = formatAtprotoDisplayIdentifier(user.username, {
    hideBskySocialSuffix
  });

  const selectMention = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(user.username);
  };

  return (
    <button
      className='accent-tab hover-card flex w-full items-center gap-3 px-4 py-3 text-left'
      type='button'
      onMouseDown={selectMention}
      onClick={(event): void => {
        if (event.detail === 0) onSelect(user.username);
      }}
      role='option'
      aria-selected={false}
    >
      <NextImage
        className='profile-picture shrink-0'
        imgClassName='profile-picture'
        width={40}
        height={40}
        src={user.photoURL}
        alt={user.name}
        useSkeleton
      />
      <span className='min-w-0'>
        <span className='flex min-w-0 items-center gap-1'>
          <span className='truncate font-bold'>{user.name}</span>
          {user.verified && (
            <CustomIcon
              className='h-4 w-4 shrink-0'
              iconName='TwitterVerifiedIcon'
            />
          )}
        </span>
        <span className='block truncate text-sm text-light-secondary dark:text-dark-secondary'>
          {displayUsername}
        </span>
      </span>
    </button>
  );
}

export function MentionSuggestions({
  query,
  onSelect
}: MentionSuggestionsProps): JSX.Element {
  const trimmedQuery = query.trim();
  const { data, loading } = useSearchUsers(
    trimmedQuery,
    { disabled: !trimmedQuery },
    { revalidateOnFocus: false }
  );
  const users = data?.users.slice(0, 6) ?? [];

  return (
    <motion.div
      className='menu-container relative z-30 mt-2 max-h-[340px] overflow-y-auto rounded-2xl
                 bg-main-background py-2'
      role='listbox'
      aria-label='Mention suggestions'
      {...menuAnimation}
      onMouseDown={(event): void => event.preventDefault()}
    >
      {!trimmedQuery ? (
        <p className='px-8 py-5 text-center text-[15px] text-light-secondary dark:text-dark-secondary'>
          Search for people
        </p>
      ) : loading ? (
        <Loading className='py-4' />
      ) : users.length ? (
        users.map((user) => (
          <MentionSuggestionRow user={user} onSelect={onSelect} key={user.id} />
        ))
      ) : (
        <p className='px-8 py-5 text-center text-[15px] text-light-secondary dark:text-dark-secondary'>
          No people found
        </p>
      )}
    </motion.div>
  );
}
