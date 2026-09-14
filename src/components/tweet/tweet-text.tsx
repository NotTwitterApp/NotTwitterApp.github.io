import Link from 'next/link';
import cn from 'clsx';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useTheme } from '@lib/context/theme-context';
import { getUserPath } from '@lib/routes';
import {
  getHashtagSearchQuery,
  normalizeHashtag,
  normalizeMention
} from '@lib/hashtags';
import { TwemojiScope } from '@components/ui/twemoji-scope';
import type { CSSProperties, MouseEvent, JSX } from 'react';

type TweetTextProps = {
  text: string;
  className?: string;
  linkClassName?: string;
  tag?: 'p' | 'span' | 'div';
  disableLinks?: boolean;
  disableDefaultSize?: boolean;
  style?: CSSProperties;
};

type TextPart =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string; href: string }
  | { type: 'hashtag'; value: string; tag: string }
  | { type: 'mention'; value: string; username: string };

const entityRegex =
  /((?:https?:\/\/|www\.)[^\s<>"']+|(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}(?:\/[^\s<>"']*)?)|#([A-Za-z0-9_]{1,139})|@([A-Za-z0-9_][A-Za-z0-9_.-]{0,251})/gi;

function getUrlHref(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function countCharacter(value: string, target: string): number {
  let count = 0;

  for (let index = 0; index < value.length; index += 1)
    if (value[index] === target) count += 1;

  return count;
}

function trimUrlTrailingPunctuation(value: string): {
  url: string;
  trailing: string;
} {
  let url = value;
  let trailing = '';
  const moveLastCharacter = (): void => {
    trailing = `${url.slice(-1)}${trailing}`;
    url = url.slice(0, -1);
  };

  while (/[.,!?;:]$/.test(url)) moveLastCharacter();

  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  while (/[)\]}]$/.test(url)) {
    const close = url.slice(-1);
    const open = pairs[close];
    const openCount = countCharacter(url, open);
    const closeCount = countCharacter(url, close);

    if (closeCount <= openCount) break;
    moveLastCharacter();
  }

  return { url, trailing };
}

function getTextParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = entityRegex.exec(text))) {
    const index = match.index;
    const url = match[1];

    if (url) {
      const previousCharacter = index > 0 ? text[index - 1] : '';
      const explicitUrl = /^(?:https?:\/\/|www\.)/i.test(url);

      if (
        !explicitUrl &&
        previousCharacter &&
        /[@A-Za-z0-9_.-]/.test(previousCharacter)
      )
        continue;

      const { url: trimmedUrl, trailing } = trimUrlTrailingPunctuation(url);

      if (index > lastIndex)
        parts.push({ type: 'text', value: text.slice(lastIndex, index) });

      if (trimmedUrl)
        parts.push({
          type: 'url',
          value: trimmedUrl,
          href: getUrlHref(trimmedUrl)
        });

      if (trailing) parts.push({ type: 'text', value: trailing });

      lastIndex = index + url.length;
      continue;
    }

    const previousCharacter = index > 0 ? text[index - 1] : '';
    const isHashtag = !!match[2];
    const invalidPreviousCharacter = isHashtag
      ? /[A-Za-z0-9_]/.test(previousCharacter)
      : /[A-Za-z0-9_.-]/.test(previousCharacter);

    if (previousCharacter && invalidPreviousCharacter) continue;

    if (index > lastIndex)
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });

    if (isHashtag) {
      parts.push({
        type: 'hashtag',
        value: match[0],
        tag: normalizeHashtag(match[2])
      });

      lastIndex = index + match[0].length;
      continue;
    }

    const username = normalizeMention(match[3]);
    const value = `@${username}`;

    if (!username) continue;

    parts.push({ type: 'mention', value, username });
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length)
    parts.push({ type: 'text', value: text.slice(lastIndex) });

  return parts;
}

function isEntityPart(part: TextPart): boolean {
  return (
    part.type === 'url' || part.type === 'hashtag' || part.type === 'mention'
  );
}

export function TweetText({
  text,
  className,
  linkClassName,
  tag,
  disableLinks,
  disableDefaultSize,
  style
}: TweetTextProps): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const stopEntityClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.stopPropagation();
  };
  const Tag = tag ?? 'p';
  const entityClassName =
    linkClassName ?? 'custom-underline text-main-accent outline-none';
  const disabledEntityClassName = linkClassName ?? 'text-main-accent';

  return (
    <TwemojiScope
      as={Tag}
      className={cn(
        !disableDefaultSize && 'tweet-display-font-size',
        'whitespace-pre-line break-words',
        className
      )}
      style={style}
    >
      {getTextParts(text).map((part, index) =>
        disableLinks ? (
          <span
            className={cn(isEntityPart(part) && disabledEntityClassName)}
            key={`${part.value}-${index}`}
          >
            {part.type === 'mention'
              ? formatAtprotoDisplayIdentifier(part.username, {
                  hideBskySocialSuffix
                })
              : part.value}
          </span>
        ) : part.type === 'url' ? (
          <a
            className={entityClassName}
            href={part.href}
            target='_blank'
            rel='noreferrer noopener'
            onClick={stopEntityClick}
            key={`${part.value}-${index}`}
          >
            {part.value}
          </a>
        ) : part.type === 'hashtag' ? (
          <Link
            href={{
              pathname: '/explore',
              query: {
                q: getHashtagSearchQuery(part.tag),
                src: 'hashtag_click'
              }
            }}
            key={`${part.value}-${index}`}
          >
            <a className={entityClassName} onClick={stopEntityClick}>
              {part.value}
            </a>
          </Link>
        ) : part.type === 'mention' ? (
          <Link
            href={getUserPath(part.username)}
            key={`${part.value}-${index}`}
          >
            <a className={entityClassName} onClick={stopEntityClick}>
              {formatAtprotoDisplayIdentifier(part.username, {
                hideBskySocialSuffix
              })}
            </a>
          </Link>
        ) : (
          <span key={`${part.value}-${index}`}>{part.value}</span>
        )
      )}
    </TwemojiScope>
  );
}
