import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX
} from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useSWR from 'swr';
import TextArea from 'react-textarea-autosize';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import {
  acceptChatConvo,
  addChatReaction,
  blockChatParticipant,
  getChatConvoForActor,
  getChatConvoForMembers,
  getChatMessages,
  isChatAccessError,
  leaveChatConvo,
  listChatConvos,
  listChatConvoRequests,
  markChatConvoRead,
  reportChatParticipant,
  removeChatReaction,
  sendChatMessage,
  getChatSettings,
  setChatSettings,
  setChatConvoMuted,
  type ChatAllowIncoming,
  type ChatConvo,
  type ChatConvoPage,
  type ChatConvoRequestsPage,
  type ChatSettings,
  type ChatMessagesPage,
  type ChatMessage
} from '@lib/atproto/backend';
import { useSearchUsers } from '@lib/api/search';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { formatDate } from '@lib/date';
import { DEFAULT_PROFILE_PHOTO_URL } from '@lib/default-images';
import { isSubmitShortcut, SUBMIT_KEYSHORTCUTS } from '@lib/keyboard-shortcuts';
import { getUserPath } from '@lib/routes';
import { useModal } from '@lib/hooks/useModal';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { TwitterComposePicker } from '@components/input/twitter-compose-picker';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { NextImage } from '@components/ui/next-image';
import { Button } from '@components/ui/button';
import { CustomIcon, type CustomIconName } from '@components/ui/custom-icon';
import { Loading } from '@components/ui/loading';
import { TweetText } from '@components/tweet/tweet-text';
import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  CSSProperties,
  ReactElement,
  ReactNode,
  UIEvent
} from 'react';
import type { User } from '@lib/types/user';

function getRouteParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;

  return null;
}

function isGroupConvo(convo: ChatConvo): boolean {
  const hasMultipleMembers =
    typeof convo.memberCount === 'number'
      ? convo.memberCount > 1
      : convo.members.length > 1;

  return convo.kind === 'group' || !!convo.groupName || hasMultipleMembers;
}

function getConvoMemberCount(convo: ChatConvo): number {
  if (typeof convo.memberCount === 'number') return convo.memberCount;

  return convo.kind === 'group'
    ? convo.members.length + 1
    : convo.members.length;
}

function getConvoMembersLabel(convo: ChatConvo): string {
  const memberCount = getConvoMemberCount(convo);

  return `${memberCount} ${memberCount === 1 ? 'person' : 'people'}`;
}

function getConvoTitle(convo: ChatConvo): string {
  if (isGroupConvo(convo) && convo.groupName) return convo.groupName;
  if (!convo.members.length) return 'Conversation';
  return convo.members.map(({ name }) => name).join(', ');
}

function getConvoHandle(
  convo: ChatConvo,
  hideBskySocialSuffix = false
): string {
  if (!convo.members.length) return '';
  if (isGroupConvo(convo)) return getConvoMembersLabel(convo);

  return convo.members
    .map((member) =>
      formatAtprotoDisplayIdentifier(member.username, { hideBskySocialSuffix })
    )
    .join(', ');
}

function getConvoSearchText(
  convo: ChatConvo,
  hideBskySocialSuffix = false
): string {
  return [
    getConvoTitle(convo),
    getConvoHandle(convo, hideBskySocialSuffix),
    ...convo.members.flatMap((member) => [
      member.name,
      formatAtprotoDisplayIdentifier(member.username, {
        hideBskySocialSuffix
      }),
      member.username
    ])
  ].join(' ');
}

function getComposeGroupName(users: User[]): string {
  return users
    .map(({ name }) => name)
    .join(', ')
    .slice(0, 50);
}

function getMessagePreview(message: ChatMessage | null): string {
  if (!message) return 'No messages yet';
  if (message.deleted) return 'This message was deleted';
  return message.text ?? '';
}

function getConvoTimestamp(convo: ChatConvo): number {
  return convo.lastMessage ? +convo.lastMessage.sentAt.toDate() : 0;
}

function mergeConvos(
  currentConvos: ChatConvo[],
  nextConvos: ChatConvo[]
): ChatConvo[] {
  const byId = new Map<string, ChatConvo>();

  currentConvos.forEach((convo) => {
    byId.set(convo.id, convo);
  });

  nextConvos.forEach((convo) => {
    byId.set(convo.id, { ...byId.get(convo.id), ...convo });
  });

  return Array.from(byId.values()).sort(
    (a, b) => getConvoTimestamp(b) - getConvoTimestamp(a)
  );
}

function mergeMessages(
  currentMessages: ChatMessage[],
  nextMessages: ChatMessage[]
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();

  currentMessages.forEach((message) => {
    byId.set(message.id, message);
  });

  nextMessages.forEach((message) => byId.set(message.id, message));

  return Array.from(byId.values()).sort(
    (a, b) => +a.sentAt.toDate() - +b.sentAt.toDate()
  );
}

function mergeThreadPage(
  currentPage: ChatMessagesPage | null,
  nextPage: ChatMessagesPage,
  replaceCursor = false
): ChatMessagesPage {
  if (!currentPage) return nextPage;

  return {
    cursor: replaceCursor ? nextPage.cursor : currentPage.cursor,
    messages: mergeMessages(currentPage.messages, nextPage.messages)
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function formatThreadMessageTime(message: ChatMessage): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit'
  }).format(message.sentAt.toDate());
}

function getUnreadTotal(convos: ChatConvo[]): number {
  return convos.reduce((total, { unreadCount }) => total + unreadCount, 0);
}

function getUnreadLabel(count: number): string {
  return count > 99 ? '99+' : count.toString();
}

function isNestedActionTarget(target: EventTarget): boolean {
  return target instanceof Element && !!target.closest('a,button');
}

function openFromClickableRow(
  event: MouseEvent<HTMLElement>,
  onClick: () => void
): void {
  if (isNestedActionTarget(event.target)) return;
  onClick();
}

function openFromClickableRowKey(
  event: KeyboardEvent<HTMLElement>,
  onClick: () => void
): void {
  if (event.target !== event.currentTarget) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;

  event.preventDefault();
  onClick();
}

const BLUESKY_REACTION_VALUES = ['❤️', '😂', '👍', '😮', '😢', '😡'];
const CONVO_REFRESH_INTERVAL_MS = 10000;
const ACTIVE_THREAD_REFRESH_INTERVAL_MS = 5000;
const CHAT_ALLOW_INCOMING_OPTIONS: ReadonlyArray<{
  value: ChatAllowIncoming;
  label: string;
}> = [
  { value: 'none', label: 'No one' },
  { value: 'following', label: 'Users I follow' },
  { value: 'all', label: 'Everyone' }
];

type MessageDeliveryStatus = 'delivered' | 'read';

type ReactionGroup = {
  value: string;
  count: number;
  reactedByViewer: boolean;
};

function getMessageDeliveryStatus(
  message: ChatMessage,
  viewerId: string | undefined,
  isMine: boolean
): MessageDeliveryStatus | null {
  if (!viewerId || !isMine || message.deleted) return null;

  const readerIds = new Set(message.readBy);
  const hasRemoteReadSignal =
    Array.from(readerIds).some((readerId) => readerId !== viewerId) ||
    message.reactions.some(({ senderId }) => senderId !== viewerId);

  return hasRemoteReadSignal ? 'read' : 'delivered';
}

function getReactionGroups(
  message: ChatMessage,
  viewerId: string | undefined
): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();

  message.reactions.forEach(({ value, senderId }) => {
    const group = groups.get(value) ?? {
      value,
      count: 0,
      reactedByViewer: false
    };

    group.count += 1;
    group.reactedByViewer ||= !!viewerId && senderId === viewerId;
    groups.set(value, group);
  });

  return Array.from(groups.values());
}

function viewerReactedWith(
  message: ChatMessage,
  viewerId: string | undefined,
  value: string
): boolean {
  return message.reactions.some(
    (reaction) => reaction.value === value && reaction.senderId === viewerId
  );
}

type MessagesErrorProps = {
  error: Error;
  authorizingMessages: boolean;
  onAuthorizeMessages: () => void;
  className?: string;
};

function MessagesError({
  error,
  authorizingMessages,
  onAuthorizeMessages,
  className
}: MessagesErrorProps): JSX.Element {
  const canAuthorizeMessages = isChatAccessError(error);

  return (
    <div
      className={cn(
        `flex flex-col items-center justify-center gap-3 px-6 py-12 text-center
         text-light-secondary dark:text-dark-secondary`,
        className
      )}
    >
      <CustomIcon className='h-10 w-10' iconName='TwitterInfoIcon' />
      <p>{getErrorMessage(error)}</p>
      {canAuthorizeMessages && (
        <Button
          className='accent-tab accent-bg-tab mt-1 px-4 py-2 font-bold text-white'
          loading={authorizingMessages}
          onClick={onAuthorizeMessages}
        >
          Authorize messages
        </Button>
      )}
    </div>
  );
}

type IconButtonProps = {
  iconName: CustomIconName;
  label: string;
  className?: string;
  disabled?: boolean;
  iconClassName?: string;
  onClick?: () => void;
};

function IconButton({
  iconName,
  label,
  className,
  disabled,
  iconClassName,
  onClick
}: IconButtonProps): JSX.Element {
  return (
    <Button
      className={cn(
        `dark-bg-tab group relative shrink-0 p-2 text-main-accent hover:bg-main-accent/10
         active:bg-main-accent/20 disabled:cursor-default disabled:opacity-60`,
        className
      )}
      disabled={disabled}
      onClick={onClick}
      title={label}
    >
      <CustomIcon className={iconClassName ?? 'h-5 w-5'} iconName={iconName} />
    </Button>
  );
}

type MessageAvatarProps = {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
  username?: string;
  style?: CSSProperties;
};

function MessageAvatar({
  src,
  alt,
  size = 40,
  className,
  username,
  style
}: MessageAvatarProps): JSX.Element {
  const avatar = (
    <figure
      className={cn(
        'profile-picture flex shrink-0 items-center justify-center overflow-hidden bg-main-sidebar-background',
        !username && className
      )}
      style={{ width: size, height: size, ...style }}
    >
      {src ? (
        <NextImage
          useSkeleton
          imgClassName='profile-picture'
          width={size}
          height={size}
          src={src}
          alt={alt}
        />
      ) : (
        <CustomIcon
          className='h-1/2 w-1/2 text-light-secondary dark:text-dark-secondary'
          iconName='TwitterProfileIcon'
        />
      )}
    </figure>
  );

  if (!username) return avatar;

  return (
    <Link href={getUserPath(username)}>
      <a
        className={cn(
          'blur-picture profile-picture flex shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-main-accent/80',
          className
        )}
        aria-label={`Go to ${alt}'s profile`}
        onClick={(event): void => event.stopPropagation()}
        title='Go to profile'
      >
        {avatar}
      </a>
    </Link>
  );
}

type ConversationAvatarProps = {
  convo: ChatConvo;
  size?: number;
  className?: string;
};

function ConversationAvatar({
  convo,
  size = 48,
  className
}: ConversationAvatarProps): JSX.Element {
  const group = isGroupConvo(convo);
  const participant = convo.members[0];

  if (!group)
    return (
      <MessageAvatar
        className={className}
        src={participant?.photoURL}
        alt={participant?.name ?? 'Conversation'}
        size={size}
        username={participant?.username}
      />
    );

  const visibleMembers = convo.members.slice(0, 2);
  const avatarSegments =
    visibleMembers.length === 1 ? [visibleMembers[0], null] : visibleMembers;
  const segmentWidth = Math.ceil(size / 2);

  return (
    <div
      className={cn(
        `profile-picture flex shrink-0 overflow-hidden bg-main-sidebar-background
         text-main-accent`,
        className
      )}
      style={{ width: size, height: size }}
      aria-label={`${getConvoTitle(convo)} group conversation`}
      title={getConvoTitle(convo)}
    >
      {avatarSegments.length ? (
        avatarSegments.map((member, index) => (
          <span
            className='flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden
                       bg-main-sidebar-background'
            key={member?.id ?? `group-avatar-fallback-${index}`}
          >
            {member?.photoURL ? (
              <NextImage
                useSkeleton
                className='h-full w-full'
                imgClassName='!h-full !w-full !rounded-none object-cover'
                width={segmentWidth}
                height={size}
                src={member.photoURL}
                alt={member.name}
              />
            ) : (
              <CustomIcon
                className='h-1/2 w-1/2 text-light-secondary dark:text-dark-secondary'
                iconName='TwitterProfileIcon'
              />
            )}
          </span>
        ))
      ) : (
        <span className='flex h-full w-full items-center justify-center'>
          <CustomIcon
            className='h-1/2 w-1/2'
            iconName='TwitterPeopleGroupIcon'
          />
        </span>
      )}
    </div>
  );
}

type NewMessageUserRowProps = {
  user: User;
  selected: boolean;
  onSelect: (user: User) => void;
};

function NewMessageUserRow({
  user,
  selected,
  onSelect
}: NewMessageUserRowProps): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const displayUsername = formatAtprotoDisplayIdentifier(user.username, {
    hideBskySocialSuffix
  });

  return (
    <div
      className={cn(
        `main-tab hover-card flex min-h-[72px] w-full cursor-pointer items-center justify-between gap-3 rounded-none
         px-4 text-left font-normal`,
        selected && 'bg-main-accent/10'
      )}
      role='button'
      tabIndex={0}
      onClick={(event): void =>
        openFromClickableRow(event, (): void => onSelect(user))
      }
      onKeyDown={(event): void =>
        openFromClickableRowKey(event, (): void => onSelect(user))
      }
    >
      <span className='flex min-w-0 items-center gap-3'>
        <MessageAvatar src={user.photoURL} alt={user.name} size={48} />
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
          <span className='block truncate text-[15px] text-light-secondary dark:text-dark-secondary'>
            {displayUsername}
          </span>
        </span>
      </span>
      {selected && (
        <CustomIcon
          className='h-5 w-5 shrink-0 text-main-accent'
          iconName='TwitterCheckIcon'
        />
      )}
    </div>
  );
}

type NewMessageModalProps = {
  currentUserId: string | undefined;
  searchValue: string;
  selectedUsers: User[];
  starting: boolean;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSelectUser: (user: User) => void;
  onRemoveSelectedUser: (userId: string) => void;
  onStart: () => void;
};

function NewMessageModal({
  currentUserId,
  searchValue,
  selectedUsers,
  starting,
  onClose,
  onSearchChange,
  onSelectUser,
  onRemoveSelectedUser,
  onStart
}: NewMessageModalProps): JSX.Element {
  const trimmedSearch = searchValue.trim();
  const { data, error, loading } = useSearchUsers(
    trimmedSearch,
    { disabled: !trimmedSearch },
    { revalidateOnFocus: false }
  );
  const users =
    data?.users.filter(({ id }) => id !== currentUserId).slice(0, 12) ?? [];
  const selectedUserIds = useMemo(
    () => new Set(selectedUsers.map(({ id }) => id)),
    [selectedUsers]
  );
  const hasSelectedUsers = selectedUsers.length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (hasSelectedUsers) onStart();
  };

  const handleKeyboardShortcut = (
    event: KeyboardEvent<HTMLFormElement>
  ): void => {
    if (!isSubmitShortcut(event)) return;

    event.preventDefault();
    if (hasSelectedUsers && !starting) onStart();
  };

  const handleSearchChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => onSearchChange(value);

  return (
    <form
      className='flex h-[650px] max-h-[90vh] flex-col overflow-hidden'
      onSubmit={handleSubmit}
      onKeyDown={handleKeyboardShortcut}
    >
      <header className='flex h-[53px] shrink-0 items-center justify-between border-b border-light-border px-3 dark:border-dark-border'>
        <div className='flex min-w-0 items-center gap-5'>
          <Button
            className='dark-bg-tab p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
            onClick={onClose}
            title='Close'
          >
            <CustomIcon className='h-5 w-5' iconName='TwitterCloseIcon' />
          </Button>
          <h2 className='truncate text-xl font-extrabold'>New message</h2>
        </div>
        <Button
          className='accent-tab accent-bg-tab rounded-full bg-main-accent px-4 py-1.5
                     text-[15px] font-bold text-white disabled:opacity-50'
          disabled={!hasSelectedUsers}
          loading={starting}
          type='submit'
        >
          Next
        </Button>
      </header>

      <div className='flex min-h-[54px] shrink-0 flex-wrap items-center gap-2 border-b border-light-border px-4 py-2 dark:border-dark-border'>
        <span className='text-[15px] text-light-primary dark:text-dark-primary'>
          To:
        </span>
        {selectedUsers.map((selectedUser) => (
          <span
            className='flex min-w-0 max-w-full items-center gap-2 rounded-full border border-main-accent
                       bg-main-accent/10 py-1 pl-2 pr-1 text-main-accent'
            key={selectedUser.id}
          >
            <MessageAvatar
              src={selectedUser.photoURL}
              alt={selectedUser.name}
              size={24}
            />
            <span className='max-w-[150px] truncate text-[15px] font-bold'>
              {selectedUser.name}
            </span>
            <Button
              className='flex h-6 w-6 items-center justify-center rounded-full p-0 hover:bg-main-accent/10'
              onClick={(): void => onRemoveSelectedUser(selectedUser.id)}
              title='Remove'
            >
              <CustomIcon className='h-3.5 w-3.5' iconName='TwitterCloseIcon' />
            </Button>
          </span>
        ))}
        <input
          className='min-w-[180px] flex-1 bg-transparent text-[15px] outline-none
                     placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
          autoFocus
          placeholder={hasSelectedUsers ? '' : 'Search people'}
          value={searchValue}
          onChange={handleSearchChange}
        />
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {!trimmedSearch ? (
          <div className='px-8 py-5 text-center text-[15px] text-light-secondary dark:text-dark-secondary'>
            Search people
          </div>
        ) : loading ? (
          <Loading className='mt-5' />
        ) : error ? (
          <div className='px-8 py-5 text-center text-[15px] text-light-secondary dark:text-dark-secondary'>
            {getErrorMessage(error)}
          </div>
        ) : users.length ? (
          <>
            <h3 className='px-4 pt-4 pb-2 text-[15px] font-bold'>People</h3>
            {users.map((user) => (
              <NewMessageUserRow
                selected={selectedUserIds.has(user.id)}
                user={user}
                onSelect={onSelectUser}
                key={user.id}
              />
            ))}
          </>
        ) : (
          <div className='px-8 py-5 text-center text-[15px] text-light-secondary dark:text-dark-secondary'>
            No people found
          </div>
        )}
      </div>
    </form>
  );
}

type NewMessageToastProps = {
  convo: ChatConvo;
  onOpen: () => void;
};

function NewMessageToast({ convo, onOpen }: NewMessageToastProps): JSX.Element {
  return (
    <div
      className='main-tab flex max-w-sm cursor-pointer items-center gap-3 rounded-2xl border border-light-border
                 bg-main-background px-4 py-3 text-left shadow-lg dark:border-dark-border'
      role='button'
      tabIndex={0}
      onClick={(event): void => openFromClickableRow(event, onOpen)}
      onKeyDown={(event): void => openFromClickableRowKey(event, onOpen)}
    >
      <ConversationAvatar convo={convo} size={40} />
      <div className='min-w-0'>
        <div className='flex min-w-0 items-center gap-1'>
          <p className='truncate font-bold'>{getConvoTitle(convo)}</p>
          {!isGroupConvo(convo) && convo.members[0]?.verified && (
            <CustomIcon
              className='h-4 w-4 shrink-0'
              iconName='TwitterVerifiedIcon'
            />
          )}
        </div>
        <p className='truncate text-[15px] text-light-secondary dark:text-dark-secondary'>
          {getMessagePreview(convo.lastMessage)}
        </p>
      </div>
    </div>
  );
}

type MessageRequestsRowProps = {
  count: number;
  onClick: () => void;
};

function MessageRequestsRow({
  count,
  onClick
}: MessageRequestsRowProps): JSX.Element {
  return (
    <Button
      className='hover-card flex h-14 w-full items-center justify-between rounded-none border-b
                 border-light-border px-4 text-left text-[15px] dark:border-dark-border'
      title='Message requests'
      onClick={onClick}
    >
      <span className='font-normal'>Message requests</span>
      <span className='flex items-center gap-3'>
        {count > 0 && (
          <span className='flex h-6 min-w-[24px] items-center justify-center rounded-full bg-main-accent px-1.5 text-xs font-bold text-white'>
            {getUnreadLabel(count)}
          </span>
        )}
        <CustomIcon
          className='h-5 w-5 text-light-secondary dark:text-dark-secondary'
          iconName='TwitterChevronRightIcon'
        />
      </span>
    </Button>
  );
}

type MessageRequestsPanelProps = {
  requests: ChatConvo[];
  cursor: string | null;
  error?: Error;
  loading: boolean;
  loadingMore: boolean;
  authorizingMessages: boolean;
  processingRequestId: string | null;
  onAuthorizeMessages: () => void;
  onBack: () => void;
  onAccept: (convo: ChatConvo) => void;
  onDelete: (convo: ChatConvo) => void;
  onLoadMore: () => void;
  onOpenSettings: () => void;
};

function MessageRequestsPanel({
  requests,
  cursor,
  error,
  loading,
  loadingMore,
  authorizingMessages,
  processingRequestId,
  onAuthorizeMessages,
  onBack,
  onAccept,
  onDelete,
  onLoadMore,
  onOpenSettings
}: MessageRequestsPanelProps): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();

  return (
    <section className='flex min-h-0 flex-1 flex-col'>
      <header className='flex h-[53px] shrink-0 items-center justify-between px-3'>
        <div className='flex min-w-0 items-center gap-5'>
          <Button
            className='dark-bg-tab p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
            onClick={onBack}
            title='Back'
          >
            <CustomIcon className='h-5 w-5' iconName='TwitterArrowLeftIcon' />
          </Button>
          <h1 className='truncate text-xl font-extrabold'>Message requests</h1>
        </div>
        <Button
          className='dark-bg-tab p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          aria-label='Message request settings'
          onClick={onOpenSettings}
          title='Settings'
        >
          <CustomIcon className='h-5 w-5' iconName='TwitterSettingsIcon' />
        </Button>
      </header>
      <div className='px-8 pt-14'>
        <p className='max-w-[330px] text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
          Message requests from people you don&apos;t follow live here. To reply
          to their messages, you need to accept the request.{' '}
          <Link href='/help-center/articles/messages-and-chat-settings'>
            <a className='font-bold underline'>Learn more</a>
          </Link>
        </p>
        <div className='mt-11 border-t border-light-border dark:border-dark-border' />
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto'>
        {loading ? (
          <Loading className='mt-5' />
        ) : error ? (
          <MessagesError
            error={error}
            authorizingMessages={authorizingMessages}
            onAuthorizeMessages={onAuthorizeMessages}
          />
        ) : requests.length ? (
          <>
            {requests.map((convo) => {
              const participant = convo.members[0];
              const processing = processingRequestId === convo.id;
              const group = isGroupConvo(convo);

              return (
                <div
                  className='hover-card border-b border-light-border px-4 py-4 dark:border-dark-border'
                  key={convo.id}
                >
                  <div className='flex w-full items-start gap-3 text-left'>
                    <ConversationAvatar convo={convo} size={48} />
                    <div className='min-w-0 flex-1'>
                      <div className='flex min-w-0 items-center gap-1'>
                        <p className='truncate font-bold'>
                          {getConvoTitle(convo)}
                        </p>
                        {!group && participant?.verified && (
                          <CustomIcon
                            className='h-4 w-4 shrink-0'
                            iconName='TwitterVerifiedIcon'
                          />
                        )}
                        {convo.lastMessage && (
                          <p className='ml-auto shrink-0 text-sm text-light-secondary dark:text-dark-secondary'>
                            {formatDate(convo.lastMessage.sentAt, 'tweet')}
                          </p>
                        )}
                      </div>
                      <p className='truncate text-[15px] text-light-secondary dark:text-dark-secondary'>
                        {getConvoHandle(convo, hideBskySocialSuffix)}
                      </p>
                      <p className='mt-0.5 truncate text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
                        {getMessagePreview(convo.lastMessage)}
                      </p>
                    </div>
                  </div>
                  <div className='mt-4 flex justify-end gap-2'>
                    <Button
                      className='accent-tab rounded-full border border-light-line-reply px-5 py-1.5 text-[15px]
                                 font-bold text-accent-red hover:bg-accent-red/10 dark:border-dark-border'
                      disabled={processing}
                      onClick={(): void => onDelete(convo)}
                    >
                      Delete
                    </Button>
                    <Button
                      className='accent-tab accent-bg-tab rounded-full bg-main-accent px-5 py-1.5 text-[15px]
                                 font-bold text-white hover:bg-main-accent/90'
                      loading={processing}
                      onClick={(): void => onAccept(convo)}
                    >
                      Accept
                    </Button>
                  </div>
                </div>
              );
            })}
            {cursor && (
              <div className='border-b border-light-border px-4 py-3 text-center dark:border-dark-border'>
                <Button
                  className='accent-tab accent-bg-tab px-4 py-2 font-bold text-white'
                  loading={loadingMore}
                  onClick={onLoadMore}
                >
                  Show more
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className='min-h-full' />
        )}
      </div>
    </section>
  );
}

type ChatSettingsPanelProps = {
  settings?: ChatSettings;
  error?: Error;
  loading: boolean;
  savingAllowIncoming: ChatAllowIncoming | null;
  authorizingMessages: boolean;
  onAuthorizeMessages: () => void;
  onBack: () => void;
  onSelectAllowIncoming: (value: ChatAllowIncoming) => void;
};

function ChatSettingsPanel({
  settings,
  error,
  loading,
  savingAllowIncoming,
  authorizingMessages,
  onAuthorizeMessages,
  onBack,
  onSelectAllowIncoming
}: ChatSettingsPanelProps): JSX.Element {
  const selectedAllowIncoming = settings?.allowIncoming ?? 'all';

  return (
    <section className='flex min-h-0 flex-1 flex-col'>
      <header className='flex h-[53px] shrink-0 items-center gap-5 px-3'>
        <Button
          className='dark-bg-tab p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          onClick={onBack}
          title='Back'
        >
          <CustomIcon className='h-5 w-5' iconName='TwitterArrowLeftIcon' />
        </Button>
        <h1 className='truncate text-xl font-extrabold'>Chat</h1>
      </header>
      {loading ? (
        <Loading className='mt-5' />
      ) : error ? (
        <MessagesError
          error={error}
          authorizingMessages={authorizingMessages}
          onAuthorizeMessages={onAuthorizeMessages}
        />
      ) : (
        <div className='border-b border-light-border px-4 pt-10 pb-6 dark:border-dark-border'>
          <h2 className='text-[19px] font-extrabold leading-6'>
            Allow message requests from:
          </h2>
          <p className='mt-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
            People you follow will always be able to message you.{' '}
            <Link href='/help-center/articles/messages-and-chat-settings'>
              <a className='font-normal text-main-accent'>Learn more</a>
            </Link>
          </p>
          <div className='mt-2'>
            {CHAT_ALLOW_INCOMING_OPTIONS.map(({ value, label }) => {
              const selected = selectedAllowIncoming === value;
              const saving = savingAllowIncoming === value;

              return (
                <Button
                  className='flex min-h-[32px] w-full items-center justify-between rounded-none p-0
                             text-left text-[17px] font-normal disabled:opacity-70'
                  disabled={!!savingAllowIncoming}
                  onClick={(): void => onSelectAllowIncoming(value)}
                  key={value}
                >
                  <span>{label}</span>
                  <span
                    className={cn(
                      `flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full
                       border-2`,
                      selected
                        ? 'border-main-accent bg-main-accent text-white'
                        : 'border-light-secondary dark:border-dark-secondary'
                    )}
                  >
                    {selected && !saving && (
                      <CustomIcon
                        className='h-3.5 w-3.5'
                        iconName='TwitterCheckIcon'
                      />
                    )}
                    {saving && (
                      <CustomIcon
                        className='h-3.5 w-3.5'
                        iconName='SpinnerIcon'
                      />
                    )}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

type ConversationRowProps = {
  convo: ChatConvo;
  active: boolean;
  viewerId: string | undefined;
  onClick: () => void;
};

function ConversationRow({
  convo,
  active,
  viewerId,
  onClick
}: ConversationRowProps): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const participant = convo.members[0];
  const group = isGroupConvo(convo);
  const preview = getMessagePreview(convo.lastMessage);
  const participantUsername = formatAtprotoDisplayIdentifier(
    participant?.username,
    { hideBskySocialSuffix }
  );
  const lastMessageIsMine = convo.lastMessage?.senderId === viewerId;
  const deliveryStatus = convo.lastMessage
    ? getMessageDeliveryStatus(convo.lastMessage, viewerId, lastMessageIsMine)
    : null;

  return (
    <article
      className={cn(
        `main-tab accent-tab hover-card flex w-full cursor-pointer items-start gap-3 rounded-none border-r-2
         border-b border-light-border border-r-transparent px-4 py-4 text-left dark:border-dark-border`,
        active &&
          'border-r-main-accent bg-main-accent/10 dark:bg-main-accent/20'
      )}
      aria-current={active ? 'true' : undefined}
      role='button'
      tabIndex={0}
      onClick={(event): void => openFromClickableRow(event, onClick)}
      onKeyDown={(event): void => openFromClickableRowKey(event, onClick)}
    >
      <ConversationAvatar convo={convo} size={48} />
      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 items-center gap-1'>
          <p className='truncate font-bold'>{getConvoTitle(convo)}</p>
          {!group && participant?.verified && (
            <CustomIcon
              className='h-4 w-4 shrink-0'
              iconName='TwitterVerifiedIcon'
            />
          )}
          {participant && !group && (
            <p className='min-w-0 truncate text-light-secondary dark:text-dark-secondary'>
              {participantUsername}
            </p>
          )}
          {group && (
            <p className='min-w-0 truncate text-light-secondary dark:text-dark-secondary'>
              {getConvoMembersLabel(convo)}
            </p>
          )}
          {convo.lastMessage && (
            <p className='ml-auto shrink-0 text-sm text-light-secondary dark:text-dark-secondary'>
              {formatDate(convo.lastMessage.sentAt, 'tweet')}
            </p>
          )}
        </div>
        <div className='mt-0.5 flex items-center gap-2'>
          <p
            className={cn(
              'truncate text-[15px] text-light-secondary dark:text-dark-secondary',
              convo.unreadCount > 0 && 'font-bold text-main-accent'
            )}
          >
            {preview}
          </p>
          {convo.unreadCount > 0 ? (
            <span
              className='ml-auto flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full
                         bg-main-accent px-1.5 text-xs font-bold text-white'
            >
              {getUnreadLabel(convo.unreadCount)}
            </span>
          ) : (
            deliveryStatus && (
              <span className='ml-auto shrink-0'>
                <DeliveryCheck status={deliveryStatus} />
              </span>
            )
          )}
        </div>
      </div>
    </article>
  );
}

type ConversationInfoProps = {
  convo: ChatConvo;
  muting: boolean;
  blocking: boolean;
  reporting: boolean;
  onToggleMute: () => void;
  onBlockParticipant: () => void;
  onReportParticipant: () => void;
  onDeleteConversation: () => void;
};

type InfoSectionProps = {
  title: string;
  children: ReactNode;
};

function InfoSection({ title, children }: InfoSectionProps): JSX.Element {
  return (
    <section className='border-b border-light-border dark:border-dark-border'>
      <h3 className='px-4 pt-5 pb-2.5 text-[13px] font-bold leading-4 text-light-secondary dark:text-dark-secondary'>
        {title}
      </h3>
      {children}
    </section>
  );
}

type InfoRowProps = {
  children: ReactNode;
  destructive?: boolean;
  loading?: boolean;
  onClick: () => void;
};

function InfoRow({
  children,
  destructive,
  loading,
  onClick
}: InfoRowProps): JSX.Element {
  return (
    <Button
      className={cn(
        `hover-card flex min-h-[58px] w-full items-center gap-4 rounded-none
         px-4 py-3 text-left text-[15px] font-normal`,
        destructive
          ? 'justify-center text-center text-accent-red'
          : 'justify-between'
      )}
      loading={loading}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

type TogglePillProps = {
  enabled: boolean;
};

function TogglePill({ enabled }: TogglePillProps): JSX.Element {
  return (
    <span
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        enabled ? 'bg-main-accent' : 'bg-light-line-reply dark:bg-dark-border'
      )}
      aria-hidden='true'
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </span>
  );
}

function ConversationInfo({
  convo,
  muting,
  blocking,
  reporting,
  onToggleMute,
  onBlockParticipant,
  onReportParticipant,
  onDeleteConversation
}: ConversationInfoProps): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const group = isGroupConvo(convo);
  const firstMember = convo.members[0];
  const firstHandle = formatAtprotoDisplayIdentifier(firstMember?.username, {
    hideBskySocialSuffix
  });

  return (
    <div className='min-h-0 flex-1 overflow-y-auto'>
      <InfoSection title='People'>
        {convo.members.map((member) => (
          <Link href={getUserPath(member.username)} key={member.id}>
            <a
              className='hover-card flex min-h-[80px] w-full items-center gap-3 px-4 text-left
                         outline-none focus-visible:ring-2 focus-visible:ring-main-accent/80'
              aria-label={`Go to ${member.name}'s profile`}
              title='Go to profile'
            >
              <MessageAvatar
                src={member.photoURL}
                alt={member.name}
                size={48}
              />
              <div className='min-w-0 flex-1'>
                <div className='flex min-w-0 items-center gap-1'>
                  <p className='truncate font-bold'>{member.name}</p>
                  {member.verified && (
                    <CustomIcon
                      className='h-4 w-4 shrink-0'
                      iconName='TwitterVerifiedIcon'
                    />
                  )}
                </div>
                <p className='truncate text-[15px] text-light-secondary dark:text-dark-secondary'>
                  {formatAtprotoDisplayIdentifier(member.username, {
                    hideBskySocialSuffix
                  })}
                </p>
              </div>
              <CustomIcon
                className='h-5 w-5 shrink-0 text-light-secondary dark:text-dark-secondary'
                iconName='TwitterChevronRightIcon'
              />
            </a>
          </Link>
        ))}
      </InfoSection>

      <InfoSection title='Notifications'>
        <InfoRow loading={muting} onClick={onToggleMute}>
          <span>Snooze notifications</span>
          <TogglePill enabled={convo.muted} />
        </InfoRow>
      </InfoSection>

      <InfoSection title='Shared media'>
        <div className='flex h-[104px] items-center justify-center px-4 text-center text-[15px] text-light-secondary dark:text-dark-secondary'>
          No photos or videos shared yet.
        </div>
      </InfoSection>

      <InfoSection title='Privacy & support'>
        {firstMember && !group && (
          <>
            <InfoRow
              destructive
              loading={blocking}
              onClick={onBlockParticipant}
            >
              <span>Block {firstHandle}</span>
            </InfoRow>
            <InfoRow
              destructive
              loading={reporting}
              onClick={onReportParticipant}
            >
              <span>Report {firstHandle}</span>
            </InfoRow>
          </>
        )}
        <InfoRow destructive onClick={onDeleteConversation}>
          <span>{group ? 'Leave conversation' : 'Delete conversation'}</span>
        </InfoRow>
      </InfoSection>
    </div>
  );
}

type DeliveryCheckProps = {
  status: MessageDeliveryStatus;
};

function DeliveryCheck({ status }: DeliveryCheckProps): JSX.Element {
  const read = status === 'read';

  return (
    <span
      aria-label={read ? 'Read' : 'Delivered'}
      className={cn(
        'inline-flex h-4 w-4 items-center justify-center',
        read
          ? 'text-main-accent'
          : 'text-light-secondary dark:text-dark-secondary'
      )}
      role='img'
      title={read ? 'Read' : 'Delivered'}
    >
      <CustomIcon
        className='h-4 w-4'
        iconName={read ? 'TwitterDoubleCheckIcon' : 'TwitterCheckIcon'}
      />
    </span>
  );
}

type MessageReactionPillsProps = {
  message: ChatMessage;
  viewerId: string | undefined;
  disabled: boolean;
  isMine: boolean;
  onSelect: (message: ChatMessage, value: string) => void;
};

function MessageReactionPills({
  message,
  viewerId,
  disabled,
  isMine,
  onSelect
}: MessageReactionPillsProps): JSX.Element | null {
  const groups = getReactionGroups(message, viewerId);

  if (!groups.length) return null;

  return (
    <div
      className={cn(
        'flex max-w-full flex-wrap gap-1 px-2',
        isMine && 'justify-end'
      )}
    >
      {groups.map(({ value, count, reactedByViewer }) => (
        <Button
          className={cn(
            `flex h-7 items-center gap-1 rounded-full border border-light-border bg-main-background
             px-2 text-sm hover:bg-main-sidebar-background dark:border-dark-border`,
            reactedByViewer &&
              'border-main-accent bg-main-accent/10 text-main-accent'
          )}
          disabled={disabled}
          onClick={(): void => onSelect(message, value)}
          title={reactedByViewer ? 'Remove reaction' : 'React'}
          key={value}
        >
          <span aria-hidden='true'>{value}</span>
          <span className='text-xs font-bold'>{count}</span>
        </Button>
      ))}
    </div>
  );
}

type MessageReactionPickerProps = {
  message: ChatMessage;
  viewerId: string | undefined;
  disabled: boolean;
  isMine: boolean;
  onSelect: (message: ChatMessage, value: string) => void;
};

function MessageReactionPicker({
  message,
  viewerId,
  disabled,
  isMine,
  onSelect
}: MessageReactionPickerProps): JSX.Element {
  return (
    <div
      className={cn(
        `absolute bottom-full z-20 mb-2 flex rounded-full border border-light-border bg-main-background
         p-1 shadow-md dark:border-dark-border`,
        isMine ? 'right-0' : 'left-0'
      )}
    >
      {BLUESKY_REACTION_VALUES.map((value) => {
        const active = viewerReactedWith(message, viewerId, value);

        return (
          <Button
            className={cn(
              `flex h-8 w-8 items-center justify-center rounded-full text-base
               hover:bg-main-sidebar-background`,
              active && 'bg-main-accent/10'
            )}
            disabled={disabled}
            onClick={(): void => onSelect(message, value)}
            title={active ? 'Remove reaction' : 'React'}
            key={value}
          >
            <span aria-hidden='true'>{value}</span>
          </Button>
        );
      })}
    </div>
  );
}

export default function Messages(): JSX.Element {
  const { user, signInWithBluesky } = useAuth();
  const { hideBskySocialSuffix } = useTheme();
  const { isReady, query, replace } = useRouter();
  const [convos, setConvos] = useState<ChatConvo[]>([]);
  const [convoCursor, setConvoCursor] = useState<string | null>(null);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [composeSearchValue, setComposeSearchValue] = useState('');
  const [selectedComposeUsers, setSelectedComposeUsers] = useState<User[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [openingActor, setOpeningActor] = useState(false);
  const [startingConversation, setStartingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [authorizingMessages, setAuthorizingMessages] = useState(false);
  const [activeError, setActiveError] = useState<Error | null>(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<
    string | null
  >(null);
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(
    null
  );
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const [showMessageRequests, setShowMessageRequests] = useState(false);
  const [shouldLoadRequests, setShouldLoadRequests] = useState(false);
  const [mutingConvo, setMutingConvo] = useState(false);
  const [leavingConvo, setLeavingConvo] = useState(false);
  const [blockingParticipant, setBlockingParticipant] = useState(false);
  const [reportingParticipant, setReportingParticipant] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [requestConvos, setRequestConvos] = useState<ChatConvo[]>([]);
  const [requestCursor, setRequestCursor] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null
  );
  const [savingAllowIncoming, setSavingAllowIncoming] =
    useState<ChatAllowIncoming | null>(null);
  const unreadCountsRef = useRef<Map<string, number>>(new Map());
  const threadCacheRef = useRef<Map<string, ChatMessagesPage>>(new Map());
  const messagePageRequestsRef = useRef<Map<string, Promise<ChatMessagesPage>>>(
    new Map()
  );
  const initializedConvosRef = useRef(false);
  const activeConvoIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerAnchorRef = useRef<HTMLSpanElement>(null);
  const olderMessagesScrollAnchorRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const skipNextMessageScrollRef = useRef(false);
  const {
    open: deleteConversationOpen,
    openModal: openDeleteConversationModal,
    closeModal: closeDeleteConversationModal
  } = useModal();

  const { data, error, mutate } = useSWR<ChatConvoPage, Error>(
    user ? `chat-convos:${user.id}` : null,
    () => listChatConvos(),
    { revalidateOnFocus: false }
  );
  const {
    data: requestsData,
    error: requestsError,
    mutate: mutateRequests
  } = useSWR<ChatConvoRequestsPage, Error>(
    user && shouldLoadRequests ? `chat-convo-requests:${user.id}` : null,
    () => listChatConvoRequests(),
    { revalidateOnFocus: false }
  );
  const {
    data: chatSettingsData,
    error: chatSettingsError,
    mutate: mutateChatSettings
  } = useSWR<ChatSettings, Error>(
    user && showChatSettings ? `chat-settings:${user.id}` : null,
    () => getChatSettings(),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!data) return;

    setConvos((currentConvos) => mergeConvos(currentConvos, data.convos));
    setConvoCursor(data.cursor);
    data.convos.forEach(({ id, unreadCount }) =>
      unreadCountsRef.current.set(id, unreadCount)
    );
    initializedConvosRef.current = true;
  }, [data]);

  useEffect(() => {
    setShouldLoadRequests(false);
    threadCacheRef.current.clear();
    messagePageRequestsRef.current.clear();
  }, [user?.id]);

  useEffect(() => {
    if (user && (data || error)) setShouldLoadRequests(true);
  }, [data, error, user]);

  useEffect(() => {
    if (!requestsData) return;

    setRequestConvos(requestsData.requests);
    setRequestCursor(requestsData.cursor);
  }, [requestsData]);

  useEffect(() => {
    activeConvoIdRef.current = activeConvoId;
    olderMessagesScrollAnchorRef.current = null;
    setEmojiPickerOpen(false);
  }, [activeConvoId]);

  const activeConvo = useMemo(
    () => convos.find(({ id }) => id === activeConvoId) ?? null,
    [activeConvoId, convos]
  );

  const filteredConvos = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    if (!normalizedSearch) return convos;

    return convos.filter((convo) =>
      getConvoSearchText(convo, hideBskySocialSuffix)
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [convos, hideBskySocialSuffix, searchValue]);
  const unreadTotal = useMemo(() => getUnreadTotal(convos), [convos]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = unreadTotal
      ? `(${getUnreadLabel(unreadTotal)}) Messages / Not Twitter`
      : 'Messages / Not Twitter';
  }, [unreadTotal]);

  useEffect(() => {
    if (!activeConvoId || loadingMessages || loadingMoreMessages) return;
    if (skipNextMessageScrollRef.current) {
      skipNextMessageScrollRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [activeConvoId, loadingMessages, loadingMoreMessages, messages.length]);

  useLayoutEffect(() => {
    const anchor = olderMessagesScrollAnchorRef.current;
    const scrollContainer = messagesScrollRef.current;
    if (!anchor || !scrollContainer || loadingMoreMessages) return;

    scrollContainer.scrollTop =
      anchor.scrollTop + (scrollContainer.scrollHeight - anchor.scrollHeight);
    olderMessagesScrollAnchorRef.current = null;
  }, [loadingMoreMessages, messages.length]);

  const getMessagePage = useCallback(
    (convoId: string, cursor?: string | null): Promise<ChatMessagesPage> => {
      const requestKey = `${convoId}:${cursor ?? ''}`;
      const existingRequest = messagePageRequestsRef.current.get(requestKey);
      if (existingRequest) return existingRequest;

      const request = getChatMessages(convoId, cursor ?? undefined).finally(
        () => {
          if (messagePageRequestsRef.current.get(requestKey) === request)
            messagePageRequestsRef.current.delete(requestKey);
        }
      );

      messagePageRequestsRef.current.set(requestKey, request);
      return request;
    },
    []
  );

  const applyMessagesPage = useCallback(
    (
      convoId: string,
      page: ChatMessagesPage,
      replaceCursor = false
    ): ChatMessagesPage | null => {
      const nextPage = mergeThreadPage(
        threadCacheRef.current.get(convoId) ?? null,
        page,
        replaceCursor
      );

      threadCacheRef.current.set(convoId, nextPage);

      if (activeConvoIdRef.current !== convoId) return null;

      setMessages(nextPage.messages);
      setMessageCursor(nextPage.cursor);
      return nextPage;
    },
    []
  );

  const loadThread = useCallback(
    async (convoId: string): Promise<void> => {
      activeConvoIdRef.current = convoId;
      setActiveConvoId(convoId);
      setActiveError(null);
      setReactionPickerMessageId(null);
      setShowConversationInfo(false);

      const cachedPage = threadCacheRef.current.get(convoId);

      setMessages(cachedPage?.messages ?? []);
      setMessageCursor(cachedPage?.cursor ?? null);
      setLoadingMessages(!cachedPage);

      try {
        const page = await getMessagePage(convoId);
        const nextPage = applyMessagesPage(convoId, page);
        if (!nextPage) return;

        const lastMessage = nextPage.messages[nextPage.messages.length - 1];

        unreadCountsRef.current.set(convoId, 0);
        setConvos((currentConvos) =>
          currentConvos.map((convo) =>
            convo.id === convoId
              ? { ...convo, opened: true, unreadCount: 0 }
              : convo
          )
        );

        if (lastMessage) void markChatConvoRead(convoId, lastMessage.id);
      } catch (error) {
        if (activeConvoIdRef.current === convoId && !cachedPage)
          setActiveError(toError(error));
      } finally {
        if (activeConvoIdRef.current === convoId) setLoadingMessages(false);
      }
    },
    [applyMessagesPage, getMessagePage]
  );

  const openConversationShell = useCallback(
    (convo: ChatConvo): void => {
      const cachedPage = threadCacheRef.current.get(convo.id);

      activeConvoIdRef.current = convo.id;
      setConvos((currentConvos) => mergeConvos(currentConvos, [convo]));
      setActiveConvoId(convo.id);
      setMessages(cachedPage?.messages ?? []);
      setMessageCursor(cachedPage?.cursor ?? null);
      setActiveError(null);
      setReactionPickerMessageId(null);
      setShowConversationInfo(false);
      setShowMessageRequests(false);
      setShowChatSettings(false);
      setLoadingMessages(false);
      setLoadingMoreMessages(false);
      closeDeleteConversationModal();
    },
    [closeDeleteConversationModal]
  );

  useEffect(() => {
    if (
      activeConvoId ||
      showMessageRequests ||
      !convos.length ||
      openingActor ||
      typeof window === 'undefined' ||
      !window.matchMedia('(min-width: 768px)').matches
    )
      return;

    void loadThread(convos[0].id);
  }, [activeConvoId, convos, loadThread, openingActor, showMessageRequests]);

  useEffect(() => {
    if (!isReady) return;

    const actor = getRouteParam(query.actor);
    if (!actor) return;

    let canceled = false;

    setOpeningActor(true);
    setActiveError(null);

    void getChatConvoForActor(actor)
      .then(async (convo) => {
        if (canceled) return;

        openConversationShell(convo);
        setOpeningActor(false);
        void replace('/messages', undefined, { shallow: true });
        if (convo.lastMessage) await loadThread(convo.id);
      })
      .catch((error) => {
        if (canceled) return;

        const message = getErrorMessage(error);
        setActiveError(toError(error));
        toast.error(message);
      })
      .finally(() => {
        if (!canceled) setOpeningActor(false);
      });

    return () => {
      canceled = true;
    };
  }, [isReady, loadThread, openConversationShell, query.actor, replace]);

  const showNewMessageAlert = useCallback(
    (convo: ChatConvo): void => {
      const preview = getMessagePreview(convo.lastMessage);

      toast.custom(
        (toastData) => (
          <NewMessageToast
            convo={convo}
            onOpen={(): void => {
              toast.dismiss(toastData.id);
              void loadThread(convo.id);
            }}
          />
        ),
        { duration: 5500, position: 'bottom-left' }
      );

      if (
        typeof window !== 'undefined' &&
        document.hidden &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        const participant = convo.members[0];
        new window.Notification(getConvoTitle(convo), {
          body: preview,
          icon: participant?.photoURL ?? DEFAULT_PROFILE_PHOTO_URL
        });
      }
    },
    [loadThread]
  );

  const applyConvoPage = useCallback(
    (page: ChatConvoPage, alert = true): void => {
      setConvoCursor(page.cursor);
      setConvos((currentConvos) => mergeConvos(currentConvos, page.convos));

      page.convos.forEach((convo) => {
        const previousUnreadCount =
          unreadCountsRef.current.get(convo.id) ?? convo.unreadCount;
        const unreadIncreased = convo.unreadCount > previousUnreadCount;

        if (
          initializedConvosRef.current &&
          alert &&
          unreadIncreased &&
          !convo.muted &&
          convo.id !== activeConvoIdRef.current
        )
          showNewMessageAlert(convo);

        unreadCountsRef.current.set(convo.id, convo.unreadCount);
      });

      initializedConvosRef.current = true;
    },
    [showNewMessageAlert]
  );

  const refreshConvos = useCallback(async (): Promise<void> => {
    const page = await listChatConvos();
    applyConvoPage(page);
  }, [applyConvoPage]);

  const refreshActiveMessages = useCallback(async (): Promise<void> => {
    const activeId = activeConvoIdRef.current;
    if (!activeId) return;

    const page = await getMessagePage(activeId);
    const nextPage = applyMessagesPage(activeId, page);
    if (!nextPage) return;

    const lastMessage = nextPage.messages[nextPage.messages.length - 1];
    if (lastMessage) {
      unreadCountsRef.current.set(activeId, 0);
      setConvos((currentConvos) =>
        currentConvos.map((convo) =>
          convo.id === activeId ? { ...convo, unreadCount: 0 } : convo
        )
      );
      void markChatConvoRead(activeId, lastMessage.id);
    }
  }, [applyMessagesPage, getMessagePage]);

  useEffect(() => {
    if (!user) return;

    const intervalId = window.setInterval(
      () => void refreshConvos().catch(() => undefined),
      CONVO_REFRESH_INTERVAL_MS
    );

    return () => window.clearInterval(intervalId);
  }, [refreshConvos, user]);

  useEffect(() => {
    if (!activeConvoId) return;
    if (!activeConvo?.lastMessage && messages.length === 0) return;

    const intervalId = window.setInterval(
      () => void refreshActiveMessages().catch(() => undefined),
      ACTIVE_THREAD_REFRESH_INTERVAL_MS
    );

    return () => window.clearInterval(intervalId);
  }, [
    activeConvoId,
    activeConvo?.lastMessage,
    messages.length,
    refreshActiveMessages
  ]);

  const loadMoreConvos = async (): Promise<void> => {
    if (!convoCursor) return;

    setLoadingConvos(true);

    try {
      const nextPage = await listChatConvos(convoCursor);

      applyConvoPage(nextPage, false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingConvos(false);
    }
  };

  const loadMoreMessages = async (): Promise<void> => {
    if (!activeConvoId || !messageCursor) return;
    const convoId = activeConvoId;

    const scrollContainer = messagesScrollRef.current;
    if (scrollContainer)
      olderMessagesScrollAnchorRef.current = {
        scrollHeight: scrollContainer.scrollHeight,
        scrollTop: scrollContainer.scrollTop
      };

    skipNextMessageScrollRef.current = true;
    setLoadingMoreMessages(true);

    try {
      const nextPage = await getMessagePage(convoId, messageCursor);

      applyMessagesPage(convoId, nextPage, true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  const handleConvosScroll = ({
    currentTarget
  }: UIEvent<HTMLDivElement>): void => {
    const distanceFromBottom =
      currentTarget.scrollHeight -
      currentTarget.scrollTop -
      currentTarget.clientHeight;

    if (distanceFromBottom < 96 && convoCursor && !loadingConvos)
      void loadMoreConvos();
  };

  const handleMessagesScroll = ({
    currentTarget
  }: UIEvent<HTMLDivElement>): void => {
    if (currentTarget.scrollTop < 96 && messageCursor && !loadingMoreMessages)
      void loadMoreMessages();
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    if (!activeConvoId || !inputValue.trim() || sending) return;

    setSending(true);

    try {
      const message = await sendChatMessage(activeConvoId, inputValue);

      setInputValue('');
      setMessages((currentMessages) => {
        const nextMessages = mergeMessages(currentMessages, [message]);
        const cachedPage = threadCacheRef.current.get(activeConvoId);

        threadCacheRef.current.set(activeConvoId, {
          cursor: cachedPage?.cursor ?? messageCursor,
          messages: nextMessages
        });

        return nextMessages;
      });
      setConvos((currentConvos) =>
        mergeConvos(
          currentConvos.map((convo) =>
            convo.id === activeConvoId
              ? { ...convo, lastMessage: message, opened: true, unreadCount: 0 }
              : convo
          ),
          []
        )
      );
      void mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const handleAuthorizeMessages = async (): Promise<void> => {
    if (!user) return;

    setAuthorizingMessages(true);
    setShouldLoadRequests(true);

    try {
      await signInWithBluesky(user.username);
      await mutate();
      await mutateRequests();
      await mutateChatSettings();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAuthorizingMessages(false);
    }
  };

  const handleAuthorizeMessagesClick = (): void => {
    void handleAuthorizeMessages();
  };

  const closeThread = (): void => {
    setActiveConvoId(null);
    setMessages([]);
    setMessageCursor(null);
    setActiveError(null);
    setReactionPickerMessageId(null);
    setShowConversationInfo(false);
    setShowMessageRequests(false);
    setShowChatSettings(false);
    closeDeleteConversationModal();
  };

  const handleConvoClick =
    (convoId: string): (() => void) =>
    (): void => {
      setShowMessageRequests(false);
      setShowChatSettings(false);
      if (convoId === activeConvoIdRef.current) {
        setShowConversationInfo(false);
        return;
      }
      void loadThread(convoId);
    };

  const openMessageRequests = (): void => {
    setShouldLoadRequests(true);
    setShowMessageRequests(true);
    setShowChatSettings(false);
    setActiveConvoId(null);
    setMessages([]);
    setMessageCursor(null);
    setActiveError(null);
    setReactionPickerMessageId(null);
    setShowConversationInfo(false);
    closeDeleteConversationModal();
  };

  const openChatSettings = (): void => {
    setShowMessageRequests(true);
    setShowChatSettings(true);
    setActiveConvoId(null);
    setMessages([]);
    setMessageCursor(null);
    setActiveError(null);
    setReactionPickerMessageId(null);
    setShowConversationInfo(false);
    closeDeleteConversationModal();
  };

  const closeChatSettings = (): void => {
    setShowChatSettings(false);
  };

  const closeMessageRequests = (): void => {
    setShowMessageRequests(false);
    setShowChatSettings(false);
  };

  const updateAllowIncoming = async (
    allowIncoming: ChatAllowIncoming
  ): Promise<void> => {
    if (allowIncoming === chatSettingsData?.allowIncoming) return;

    setSavingAllowIncoming(allowIncoming);

    try {
      const nextSettings = await setChatSettings(allowIncoming);

      await mutateChatSettings(nextSettings, false);
      toast.success('Chat settings updated');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingAllowIncoming(null);
    }
  };

  const handleAllowIncomingSelect = (
    allowIncoming: ChatAllowIncoming
  ): void => {
    void updateAllowIncoming(allowIncoming);
  };

  const loadMoreRequests = async (): Promise<void> => {
    if (!requestCursor) return;

    setLoadingRequests(true);

    try {
      const nextPage = await listChatConvoRequests(requestCursor);

      setRequestCursor(nextPage.cursor);
      setRequestConvos((currentRequests) =>
        mergeConvos(currentRequests, nextPage.requests)
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingRequests(false);
    }
  };

  const acceptRequest = async (convo: ChatConvo): Promise<void> => {
    setProcessingRequestId(convo.id);

    try {
      const acceptedConvo = await acceptChatConvo(convo.id);

      setRequestConvos((currentRequests) =>
        currentRequests.filter(({ id }) => id !== convo.id)
      );
      setConvos((currentConvos) => mergeConvos(currentConvos, [acceptedConvo]));
      setShowMessageRequests(false);
      setShowChatSettings(false);
      await loadThread(acceptedConvo.id);
      void mutate();
      void mutateRequests();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProcessingRequestId(null);
    }
  };

  const acceptRequestClick = (convo: ChatConvo): void => {
    void acceptRequest(convo);
  };

  const deleteRequest = async (convo: ChatConvo): Promise<void> => {
    setProcessingRequestId(convo.id);

    try {
      await leaveChatConvo(convo.id);
      setRequestConvos((currentRequests) =>
        currentRequests.filter(({ id }) => id !== convo.id)
      );
      void mutateRequests();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProcessingRequestId(null);
    }
  };

  const deleteRequestClick = (convo: ChatConvo): void => {
    void deleteRequest(convo);
  };

  const openNewMessageModal = (): void => setNewMessageOpen(true);

  const closeNewMessageModal = (): void => {
    if (startingConversation) return;

    setNewMessageOpen(false);
    setComposeSearchValue('');
    setSelectedComposeUsers([]);
  };

  const selectComposeUser = (user: User): void => {
    setSelectedComposeUsers((currentUsers) =>
      currentUsers.some(({ id }) => id === user.id)
        ? currentUsers.filter(({ id }) => id !== user.id)
        : [...currentUsers, user]
    );
    setComposeSearchValue('');
  };

  const removeSelectedComposeUser = (userId: string): void => {
    setSelectedComposeUsers((currentUsers) =>
      currentUsers.filter(({ id }) => id !== userId)
    );
  };

  const startSelectedConversation = async (): Promise<void> => {
    if (!selectedComposeUsers.length) return;

    setStartingConversation(true);
    setActiveError(null);

    try {
      const convo = await getChatConvoForMembers(
        selectedComposeUsers.map(({ id }) => id),
        selectedComposeUsers.length > 1
          ? getComposeGroupName(selectedComposeUsers)
          : undefined
      );

      openConversationShell(convo);
      setNewMessageOpen(false);
      setComposeSearchValue('');
      setSelectedComposeUsers([]);
      if (convo.lastMessage) await loadThread(convo.id);
      void mutate();
    } catch (error) {
      const nextError = toError(error);

      setActiveError(nextError);
      toast.error(getErrorMessage(error));
    } finally {
      setStartingConversation(false);
    }
  };

  const startSelectedConversationClick = (): void => {
    void startSelectedConversation();
  };

  const handleSearchChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => setSearchValue(value);

  const handleInputChange = ({
    target: { value }
  }: ChangeEvent<HTMLTextAreaElement>): void => setInputValue(value);

  const handleMessageInputKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ): void => {
    if (!isSubmitShortcut(event)) return;

    event.preventDefault();
    if (!activeConvoId || !inputValue.trim() || sending) return;

    const form = event.currentTarget.form;

    if (form?.requestSubmit) form.requestSubmit();
    else
      form?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      );
  };

  const toggleReactionPicker =
    (messageId: string): (() => void) =>
    (): void => {
      setReactionPickerMessageId((currentMessageId) =>
        currentMessageId === messageId ? null : messageId
      );
    };

  const handleReactionSelect = async (
    message: ChatMessage,
    value: string
  ): Promise<void> => {
    if (!activeConvoId || !user) return;

    const reacted = viewerReactedWith(message, user.id, value);

    setReactingMessageId(message.id);

    try {
      const nextMessage = reacted
        ? await removeChatReaction(activeConvoId, message.id, value)
        : await addChatReaction(activeConvoId, message.id, value);

      setMessages((currentMessages) => {
        const nextMessages = mergeMessages(currentMessages, [nextMessage]);
        const cachedPage = threadCacheRef.current.get(activeConvoId);

        threadCacheRef.current.set(activeConvoId, {
          cursor: cachedPage?.cursor ?? messageCursor,
          messages: nextMessages
        });

        return nextMessages;
      });
      setConvos((currentConvos) =>
        currentConvos.map((convo) =>
          convo.id === activeConvoId && convo.lastMessage?.id === nextMessage.id
            ? { ...convo, lastMessage: nextMessage }
            : convo
        )
      );
      setReactionPickerMessageId(null);
      void mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setReactingMessageId(null);
    }
  };

  const openConversationInfo = (): void => setShowConversationInfo(true);

  const closeConversationInfo = (): void => setShowConversationInfo(false);

  const updateActiveConvo = (nextConvo: ChatConvo): void => {
    setConvos((currentConvos) =>
      mergeConvos(
        currentConvos.map((convo) =>
          convo.id === nextConvo.id ? nextConvo : convo
        ),
        []
      )
    );
  };

  const handleToggleMute = async (): Promise<void> => {
    if (!activeConvo) return;

    setMutingConvo(true);

    try {
      const nextConvo = await setChatConvoMuted(
        activeConvo.id,
        !activeConvo.muted
      );

      updateActiveConvo(nextConvo);
      toast.success(
        nextConvo.muted ? 'Notifications snoozed' : 'Notifications unsnoozed'
      );
      void mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setMutingConvo(false);
    }
  };

  const handleToggleMuteClick = (): void => {
    void handleToggleMute();
  };

  const handleDeleteConversation = async (): Promise<void> => {
    if (!activeConvoId) return;
    const group = !!activeConvo && isGroupConvo(activeConvo);

    setLeavingConvo(true);

    try {
      await leaveChatConvo(activeConvoId);
      setConvos((currentConvos) =>
        currentConvos.filter(({ id }) => id !== activeConvoId)
      );
      closeDeleteConversationModal();
      closeThread();
      toast.success(group ? 'Conversation left' : 'Conversation deleted');
      void mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLeavingConvo(false);
    }
  };

  const handleDeleteConversationClick = (): void => {
    void handleDeleteConversation();
  };

  const handleBlockParticipant = async (): Promise<void> => {
    if (!firstMember) return;

    setBlockingParticipant(true);

    try {
      await blockChatParticipant(firstMember.id);
      toast.success(`Blocked ${firstMemberDisplayUsername}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBlockingParticipant(false);
    }
  };

  const handleBlockParticipantClick = (): void => {
    void handleBlockParticipant();
  };

  const handleReportParticipant = async (): Promise<void> => {
    if (!firstMember) return;

    setReportingParticipant(true);

    try {
      await reportChatParticipant(firstMember.id);
      toast.success('Report submitted');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setReportingParticipant(false);
    }
  };

  const handleReportParticipantClick = (): void => {
    void handleReportParticipant();
  };

  const showThread = !!activeConvoId;
  const activeConvoGroup = !!activeConvo && isGroupConvo(activeConvo);
  const firstMember = activeConvo?.members[0];
  const firstMemberDisplayUsername = formatAtprotoDisplayIdentifier(
    firstMember?.username,
    { hideBskySocialSuffix }
  );

  return (
    <>
      <Modal
        modalClassName='w-full max-w-[600px] overflow-hidden rounded-2xl bg-main-background shadow-xl'
        open={newMessageOpen}
        closeModal={closeNewMessageModal}
      >
        <NewMessageModal
          currentUserId={user?.id}
          searchValue={composeSearchValue}
          selectedUsers={selectedComposeUsers}
          starting={startingConversation}
          onClose={closeNewMessageModal}
          onRemoveSelectedUser={removeSelectedComposeUser}
          onSearchChange={setComposeSearchValue}
          onSelectUser={selectComposeUser}
          onStart={startSelectedConversationClick}
        />
      </Modal>
      <Modal
        modalClassName='w-full max-w-xs rounded-2xl bg-main-background p-8'
        open={deleteConversationOpen}
        closeModal={closeDeleteConversationModal}
      >
        <ActionModal
          title={
            activeConvoGroup ? 'Leave conversation?' : 'Delete conversation?'
          }
          description={
            activeConvoGroup
              ? 'You will leave this conversation. Other people in the conversation will still be able to see it.'
              : 'This conversation will be deleted from your inbox. Other people in the conversation will still be able to see it.'
          }
          mainBtnClassName='accent-tab bg-accent-red hover:bg-accent-red/90 focus-visible:bg-accent-red/90 active:bg-accent-red/75'
          mainBtnLabel={
            leavingConvo
              ? activeConvoGroup
                ? 'Leaving...'
                : 'Deleting...'
              : activeConvoGroup
                ? 'Leave'
                : 'Delete'
          }
          action={handleDeleteConversationClick}
          closeModal={closeDeleteConversationModal}
        />
      </Modal>
      <MainContainer className='!h-[100dvh] !min-h-0 !max-w-[1296px] !overflow-hidden !pb-0'>
        <SEO title='Messages / Not Twitter' />
        <div className='flex h-full min-h-0 w-full overflow-hidden dark:bg-black'>
          <section
            className={cn(
              `flex min-h-0 w-full flex-col border-r border-light-border dark:border-dark-border
             md:shrink-0`,
              showChatSettings ? 'md:w-[600px]' : 'md:w-[360px]',
              showThread && !showMessageRequests && 'hidden md:flex'
            )}
          >
            {showChatSettings ? (
              <ChatSettingsPanel
                authorizingMessages={authorizingMessages}
                error={chatSettingsError}
                loading={!chatSettingsData && !chatSettingsError}
                savingAllowIncoming={savingAllowIncoming}
                settings={chatSettingsData}
                onAuthorizeMessages={handleAuthorizeMessagesClick}
                onBack={closeChatSettings}
                onSelectAllowIncoming={handleAllowIncomingSelect}
              />
            ) : showMessageRequests ? (
              <MessageRequestsPanel
                authorizingMessages={authorizingMessages}
                cursor={requestCursor}
                error={requestsError}
                loading={!requestsData && !requestsError}
                loadingMore={loadingRequests}
                processingRequestId={processingRequestId}
                requests={requestConvos}
                onAccept={acceptRequestClick}
                onAuthorizeMessages={handleAuthorizeMessagesClick}
                onBack={closeMessageRequests}
                onDelete={deleteRequestClick}
                onLoadMore={loadMoreRequests}
                onOpenSettings={openChatSettings}
              />
            ) : (
              <>
                <header className='flex h-16 shrink-0 items-center justify-between border-b border-light-border px-4 dark:border-dark-border'>
                  <h1 className='text-xl font-extrabold'>Messages</h1>
                  <IconButton
                    iconName='TwitterNewMessageIcon'
                    label='New message'
                    onClick={openNewMessageModal}
                  />
                </header>
                <MessageRequestsRow
                  count={requestConvos.length}
                  onClick={openMessageRequests}
                />
                <div className='border-b border-light-border px-4 py-4 dark:border-dark-border'>
                  <label
                    className='flex h-12 items-center gap-3 rounded-full bg-main-sidebar-background px-4
                               text-light-secondary dark:text-dark-secondary'
                  >
                    <CustomIcon
                      className='h-5 w-5 shrink-0'
                      iconName='TwitterSearchIcon'
                    />
                    <input
                      className='min-w-0 flex-1 bg-transparent text-[15px] text-light-primary outline-none
                                 placeholder:text-light-secondary dark:text-dark-primary
                                 dark:placeholder:text-dark-secondary'
                      placeholder='Search for people and groups'
                      value={searchValue}
                      onChange={handleSearchChange}
                    />
                  </label>
                </div>
                <div
                  className='min-h-0 flex-1 overflow-y-auto overscroll-contain'
                  onScroll={handleConvosScroll}
                >
                  {!data && !error && !convos.length ? (
                    <Loading className='mt-5' />
                  ) : error ? (
                    <MessagesError
                      error={error}
                      authorizingMessages={authorizingMessages}
                      onAuthorizeMessages={handleAuthorizeMessagesClick}
                    />
                  ) : filteredConvos.length ? (
                    <>
                      {filteredConvos.map((convo) => (
                        <ConversationRow
                          active={activeConvoId === convo.id}
                          convo={convo}
                          viewerId={user?.id}
                          onClick={handleConvoClick(convo.id)}
                          key={convo.id}
                        />
                      ))}
                      {loadingConvos && <Loading className='my-3' />}
                    </>
                  ) : (
                    <div className='mx-auto flex max-w-xs flex-col gap-2 px-8 py-16'>
                      <h2 className='text-2xl font-extrabold'>
                        No messages yet
                      </h2>
                      <p className='text-light-secondary dark:text-dark-secondary'>
                        Your Bluesky conversations will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          <section
            className={cn(
              `hidden min-h-0 min-w-0 flex-1 flex-col pb-[calc(53px+env(safe-area-inset-bottom))]
               md:flex md:pb-0`,
              showThread && '!flex'
            )}
          >
            {activeConvo ? (
              showConversationInfo ? (
                <>
                  <header className='flex h-16 shrink-0 items-center border-b border-light-border px-3 dark:border-dark-border'>
                    <div className='flex min-w-0 items-center gap-5'>
                      <Button
                        className='dark-bg-tab p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                                   dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
                        onClick={closeConversationInfo}
                        title='Back'
                      >
                        <CustomIcon
                          className='h-5 w-5'
                          iconName='TwitterArrowLeftIcon'
                        />
                      </Button>
                      <h2 className='truncate text-xl font-extrabold'>
                        Conversation info
                      </h2>
                    </div>
                  </header>
                  <ConversationInfo
                    blocking={blockingParticipant}
                    convo={activeConvo}
                    muting={mutingConvo}
                    reporting={reportingParticipant}
                    onBlockParticipant={handleBlockParticipantClick}
                    onDeleteConversation={openDeleteConversationModal}
                    onReportParticipant={handleReportParticipantClick}
                    onToggleMute={handleToggleMuteClick}
                  />
                </>
              ) : (
                <>
                  <header className='flex h-16 shrink-0 items-center justify-between border-b border-light-border px-4 dark:border-dark-border'>
                    <div className='flex min-w-0 items-center gap-3'>
                      <Button
                        className='dark-bg-tab mr-1 p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                               dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20 md:hidden'
                        onClick={closeThread}
                        title='Back'
                      >
                        <CustomIcon
                          className='h-5 w-5'
                          iconName='TwitterArrowLeftIcon'
                        />
                      </Button>
                      {activeConvoGroup && (
                        <ConversationAvatar convo={activeConvo} size={40} />
                      )}
                      <div className='min-w-0'>
                        <div className='flex min-w-0 items-center gap-1'>
                          <p className='truncate text-xl font-extrabold'>
                            {getConvoTitle(activeConvo)}
                          </p>
                          {!activeConvoGroup && firstMember?.verified && (
                            <CustomIcon
                              className='h-4 w-4 shrink-0'
                              iconName='TwitterVerifiedIcon'
                            />
                          )}
                        </div>
                        <p className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
                          {getConvoHandle(activeConvo, hideBskySocialSuffix)}
                        </p>
                      </div>
                    </div>
                    <IconButton
                      iconClassName='h-6 w-6'
                      iconName='TwitterInfoIcon'
                      label='Info'
                      onClick={openConversationInfo}
                    />
                  </header>
                  {loadingMessages ? (
                    <Loading className='mt-5' />
                  ) : activeError ? (
                    <MessagesError
                      className='flex-1'
                      error={activeError}
                      authorizingMessages={authorizingMessages}
                      onAuthorizeMessages={handleAuthorizeMessagesClick}
                    />
                  ) : (
                    <>
                      <div
                        ref={messagesScrollRef}
                        className='min-h-0 flex-1 overflow-y-auto overscroll-contain'
                        onScroll={handleMessagesScroll}
                      >
                        <div className='flex min-h-full flex-col justify-end gap-2 px-6 py-6'>
                          {loadingMoreMessages && <Loading className='my-2' />}
                          {messages.map((message, index) => {
                            const isMine = message.senderId === user?.id;
                            const sender = activeConvo.members.find(
                              ({ id }) => id === message.senderId
                            );
                            const previousMessage = messages[index - 1];
                            const nextMessage = messages[index + 1];
                            const groupedWithPrevious =
                              previousMessage?.senderId === message.senderId;
                            const groupedWithNext =
                              nextMessage?.senderId === message.senderId;
                            const showAvatar = !isMine && !groupedWithPrevious;
                            const showTimestamp = !groupedWithNext;
                            const deliveryStatus = getMessageDeliveryStatus(
                              message,
                              user?.id,
                              isMine
                            );
                            const reacting = reactingMessageId === message.id;
                            const messageBubbleClassName = cn(
                              'px-5 py-3 text-[17px] leading-6',
                              isMine
                                ? 'rounded-[28px] rounded-br bg-main-accent text-white'
                                : 'rounded-[28px] rounded-bl bg-main-sidebar-background',
                              groupedWithPrevious &&
                                (isMine ? 'rounded-tr-lg' : 'rounded-tl-lg'),
                              groupedWithNext &&
                                (isMine ? 'rounded-br-lg' : 'rounded-bl-lg'),
                              message.deleted &&
                                'italic text-light-secondary dark:text-dark-secondary'
                            );

                            return (
                              <div
                                className={cn(
                                  'group/message flex items-end gap-3',
                                  isMine && 'justify-end'
                                )}
                                key={message.id}
                              >
                                {!isMine &&
                                  (showAvatar ? (
                                    <MessageAvatar
                                      className='mb-5'
                                      src={sender?.photoURL}
                                      alt={sender?.name ?? 'Sender'}
                                      size={40}
                                      username={sender?.username}
                                    />
                                  ) : (
                                    <div className='w-10 shrink-0' />
                                  ))}
                                <div
                                  className={cn(
                                    'flex max-w-[70%] flex-col gap-1',
                                    isMine && 'items-end',
                                    !showTimestamp && 'mb-0.5'
                                  )}
                                >
                                  <div className='relative'>
                                    {message.deleted ? (
                                      <p className={messageBubbleClassName}>
                                        This message was deleted
                                      </p>
                                    ) : (
                                      <TweetText
                                        className={messageBubbleClassName}
                                        linkClassName={cn(
                                          'custom-underline outline-none',
                                          isMine
                                            ? 'text-white'
                                            : 'text-main-accent'
                                        )}
                                        text={message.text ?? ''}
                                      />
                                    )}
                                    {!message.deleted && (
                                      <div
                                        className={cn(
                                          'absolute top-1/2 -translate-y-1/2',
                                          isMine ? '-left-14' : '-right-14'
                                        )}
                                      >
                                        <Button
                                          className={cn(
                                            `dark-bg-tab flex h-11 w-11 items-center justify-center rounded-full
                                         text-main-accent opacity-0 hover:bg-main-accent/10 focus:opacity-100
                                         active:bg-main-accent/20 group-hover/message:opacity-100`,
                                            reactionPickerMessageId ===
                                              message.id && 'opacity-100'
                                          )}
                                          disabled={reacting}
                                          onClick={toggleReactionPicker(
                                            message.id
                                          )}
                                          title='React'
                                        >
                                          <CustomIcon
                                            className='h-6 w-6'
                                            iconName='TwitterEmojiIcon'
                                          />
                                        </Button>
                                        {reactionPickerMessageId ===
                                          message.id && (
                                          <MessageReactionPicker
                                            disabled={reacting}
                                            isMine={isMine}
                                            message={message}
                                            viewerId={user?.id}
                                            onSelect={handleReactionSelect}
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <MessageReactionPills
                                    disabled={reacting}
                                    isMine={isMine}
                                    message={message}
                                    viewerId={user?.id}
                                    onSelect={handleReactionSelect}
                                  />
                                  {showTimestamp && (
                                    <p
                                      className={cn(
                                        'flex items-center gap-1 px-2 text-sm text-light-secondary dark:text-dark-secondary',
                                        isMine && 'justify-end'
                                      )}
                                    >
                                      {formatThreadMessageTime(message)}
                                      {deliveryStatus && (
                                        <DeliveryCheck
                                          status={deliveryStatus}
                                        />
                                      )}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      </div>
                      <form
                        className='shrink-0 border-t border-light-border bg-main-background px-3 py-2.5 dark:border-dark-border
                                     md:px-4 md:py-3'
                        onSubmit={handleSubmit}
                      >
                        <div className='flex items-center gap-1.5 md:gap-2'>
                          <IconButton
                            className='p-2'
                            disabled
                            iconName='TwitterMediaIcon'
                            label='Media attachments are unavailable in Bluesky messages'
                          />
                          <IconButton
                            className='p-2'
                            disabled
                            iconName='TwitterGifIcon'
                            label='GIF attachments are unavailable in Bluesky messages'
                          />
                          <div
                            className='flex min-h-[40px] min-w-0 flex-1 items-center rounded-[20px]
                                         bg-main-sidebar-background px-3'
                          >
                            <TextArea
                              className='max-h-28 min-h-[38px] min-w-0 flex-1 resize-none bg-transparent py-2 text-[15px]
                                           leading-5 outline-none placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
                              maxRows={5}
                              placeholder='Start a new message'
                              value={inputValue}
                              aria-keyshortcuts={SUBMIT_KEYSHORTCUTS}
                              onChange={handleInputChange}
                              onKeyDown={handleMessageInputKeyDown}
                            />
                            <span
                              ref={emojiPickerAnchorRef}
                              className='relative -mr-2 flex shrink-0'
                            >
                              <IconButton
                                className='p-2'
                                iconName='TwitterEmojiIcon'
                                label='Emoji'
                                onClick={(): void =>
                                  setEmojiPickerOpen((open) => !open)
                                }
                              />
                            </span>
                          </div>
                          <Button
                            className='dark-bg-tab flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                                         bg-transparent p-2 text-main-accent hover:bg-main-accent/10
                                         active:bg-main-accent/20 disabled:bg-transparent disabled:opacity-40'
                            disabled={!inputValue.trim() || sending}
                            loading={sending}
                            title='Send'
                            type='submit'
                            aria-keyshortcuts={SUBMIT_KEYSHORTCUTS}
                          >
                            <CustomIcon
                              className='h-5 w-5'
                              iconName='TwitterSendIcon'
                            />
                          </Button>
                        </div>
                        {emojiPickerOpen && (
                          <TwitterComposePicker
                            anchorElement={emojiPickerAnchorRef.current}
                            placement='above'
                            type='emoji'
                            onClose={(): void => setEmojiPickerOpen(false)}
                            onSelectEmoji={(emoji): void =>
                              setInputValue((value) => `${value}${emoji}`)
                            }
                            onSelectGif={(): void => undefined}
                          />
                        )}
                      </form>
                    </>
                  )}
                </>
              )
            ) : openingActor ? (
              <Loading className='mt-5' />
            ) : (
              <div className='flex flex-1 items-center justify-center px-8'>
                <div className='max-w-sm'>
                  <h2 className='text-3xl font-extrabold'>Select a message</h2>
                  <p className='mt-2 text-light-secondary dark:text-dark-secondary'>
                    {showChatSettings ? (
                      'Choose who can start new message requests with you.'
                    ) : showMessageRequests ? (
                      <>
                        Message requests from people you don&apos;t follow live
                        here. To reply to their messages, you need to accept the
                        request.{' '}
                        <Link href='/help-center/articles/messages-and-chat-settings'>
                          <a className='font-bold underline'>Learn more</a>
                        </Link>
                      </>
                    ) : (
                      'Choose from your existing conversations.'
                    )}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </MainContainer>
    </>
  );
}

Messages.getLayout = (page: ReactElement<any>): ReactNode => (
  <ProtectedLayout>
    <MainLayout>{page}</MainLayout>
  </ProtectedLayout>
);
