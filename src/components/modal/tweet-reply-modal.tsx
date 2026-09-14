import { Input } from '@components/input/input';
import { Tweet } from '@components/tweet/tweet';
import type { TweetProps } from '@components/tweet/tweet';
import type { TweetWithUser } from '@lib/types/tweet';

import type { JSX } from 'react';

type TweetReplyModalProps = {
  tweet: TweetProps;
  closeModal: () => void;
  onReplySent?: (tweet: TweetWithUser) => void;
};

export function TweetReplyModal({
  tweet,
  closeModal,
  onReplySent
}: TweetReplyModalProps): JSX.Element {
  return (
    <Input
      modal
      replyModal
      parent={{ id: tweet.id, username: tweet.user.username }}
      closeModal={closeModal}
      onTweetSent={onReplySent}
    >
      <Tweet modal parentTweet {...tweet} />
    </Input>
  );
}
