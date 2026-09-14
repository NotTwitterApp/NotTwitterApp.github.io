import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useTheme } from '@lib/context/theme-context';
import { AppIcon } from '@components/ui/app-icon';
import type { AppIconName } from '@components/ui/app-icon';
import type { TweetReplySetting } from '@lib/types/tweet';

import type { JSX } from 'react';

type TweetReplyRestrictionProps = {
  replySetting?: TweetReplySetting | null;
  viewerCanReply?: boolean | null;
  username: string;
};

type ReplyRestrictionDisplay = {
  iconName: AppIconName;
  timelineText: string;
  conversationText: string;
};

export function getReplyRestrictionDisplay({
  replySetting,
  viewerCanReply,
  username
}: TweetReplyRestrictionProps): ReplyRestrictionDisplay | null {
  const usernameLabel = username.startsWith('@') ? username : `@${username}`;

  if (!replySetting || replySetting === 'everyone') {
    if (viewerCanReply !== false) return null;

    return {
      iconName: 'TwitterNoIcon',
      timelineText: 'You cannot reply to this conversation',
      conversationText: 'You cannot reply to this conversation.'
    };
  }

  if (replySetting === 'mentioned')
    return {
      iconName: 'TwitterAtIcon',
      timelineText: 'People they mentioned can reply',
      conversationText: `A conversation between ${usernameLabel} and people they mentioned in this Tweet.`
    };

  if (replySetting === 'none')
    return {
      iconName: 'TwitterNoIcon',
      timelineText: 'No one can reply',
      conversationText: 'No one can reply to this conversation.'
    };

  if (replySetting === 'followers')
    return {
      iconName: 'TwitterPeopleGroupIcon',
      timelineText: `People following ${usernameLabel} or mentioned can reply`,
      conversationText: `A conversation between ${usernameLabel} and people following them or mentioned in this Tweet.`
    };

  return {
    iconName: 'TwitterPeopleGroupIcon',
    timelineText: 'People they follow or mentioned can reply',
    conversationText: `A conversation between ${usernameLabel} and people they follow or mentioned in this Tweet.`
  };
}

export function TweetReplyRestrictionIndicator({
  replySetting,
  viewerCanReply,
  username
}: TweetReplyRestrictionProps): JSX.Element | null {
  const { hideBskySocialSuffix } = useTheme();
  const display = getReplyRestrictionDisplay({
    replySetting,
    viewerCanReply,
    username: formatAtprotoDisplayIdentifier(username, { hideBskySocialSuffix })
  });

  if (!display) return null;

  return (
    <div
      className='mt-2 flex items-center gap-1.5 text-[13px] leading-4
                 text-light-secondary dark:text-dark-secondary'
      title={display.conversationText}
    >
      <AppIcon
        className='h-4 w-4 shrink-0 text-light-secondary dark:text-dark-secondary'
        iconName={display.iconName}
      />
      <span>{display.timelineText}</span>
    </div>
  );
}

export function TweetReplyRestrictionConversationNotice({
  replySetting,
  viewerCanReply,
  username
}: TweetReplyRestrictionProps): JSX.Element | null {
  const { hideBskySocialSuffix } = useTheme();
  const display = getReplyRestrictionDisplay({
    replySetting,
    viewerCanReply,
    username: formatAtprotoDisplayIdentifier(username, { hideBskySocialSuffix })
  });

  if (!display) return null;

  return (
    <div
      className='px-1 py-4 text-[15px] leading-5 text-light-secondary
                 dark:text-dark-secondary'
      title={display.conversationText}
    >
      {display.conversationText}
    </div>
  );
}
