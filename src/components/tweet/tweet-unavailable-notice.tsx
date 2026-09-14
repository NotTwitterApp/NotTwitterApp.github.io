import {
  TweetTombstone,
  limitedVisibilityTweetMessage
} from './tweet-tombstone';

import type { JSX } from 'react';

export { limitedVisibilityTweetMessage };

export function TweetUnavailableNotice({
  className
}: {
  className?: string;
}): JSX.Element {
  return <TweetTombstone kind='limited-visibility' className={className} />;
}
