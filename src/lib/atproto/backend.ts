import { createArticleCache, getStandardSiteDocumentUris } from '@lib/standard-site-loader';
import {
  AppBskyEmbedExternal,
  AppBskyEmbedImages,
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedVideo,
  AppBskyFeedDefs,
  AppBskyGraphDefs,
  AppBskyLabelerDefs,
  Agent,
  AtpAgent,
  moderateNotification,
  moderatePost,
  RichText,
  type AppBskyActorProfile,
  type AppBskyActorDefs,
  type AppBskyEmbedGetEmbedExternalView,
  type AppBskyFeedPost,
  type AppBskyFeedThreadgate,
  type AppBskyNotificationListNotifications,
  type AppBskyUnspeccedDefs,
  type AppBskyUnspeccedGetPostThreadOtherV2,
  type AppBskyUnspeccedGetPostThreadV2,
  type AppBskyVideoDefs,
  type AppBskyVideoGetUploadLimits,
  type AtpSessionData,
  type BskyFeedViewPreference,
  type BskyThreadViewPreference,
  type ChatBskyActorDeclaration,
  type ChatBskyConvoDefs,
  type ComAtprotoModerationDefs,
  type ModerationCause,
  type ModerationOpts
} from '@atproto/api';
import { TID, type JsonValue } from '@atproto/common-web';
import {
  BlobRef as AtprotoBlobRef,
  jsonToLex as atprotoJsonToLex
} from '@atproto/lexicon';
import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { buildAtprotoLoopbackClientMetadata } from '@atproto/oauth-types';
import { ensureValidDid, isValidHandle } from '@atproto/syntax';
import { normalizeProfileBirthday } from '@lib/profile-birthday';
import { getYouTubeVideoInfo } from '@lib/youtube';

import {
  isAtprotoIdentityDid,
  normalizeAtprotoIdentifier,
  normalizeAtprotoLoginIdentifier,
  type AtprotoIdentityDid
} from './identity';
import { Timestamp } from './timestamp';
import type { BlobRef as LexiconBlobRef } from '@atproto/lexicon';
import type { OAuthSession } from '@atproto/oauth-client';
import type { Bookmark } from '@lib/types/bookmark';
import type { ImagesPreview, FilesWithId } from '@lib/types/file';
import type { Stats } from '@lib/types/stats';
import type {
  EmbeddedTweet,
  StandardSiteArticle,
  Tweet,
  TweetCard,
  TweetMediaWarning,
  TweetReplySetting,
  TweetTombstoneKind,
  TweetUnavailableReason,
  TweetWithUser
} from '@lib/types/tweet';
import type {
  ActivityNotificationCategory,
  User,
  UserKnownFollower
} from '@lib/types/user';

const OAUTH_SUB_KEY = 'twitter-clone:bsky-oauth-sub';
const OAUTH_ACCOUNTS_KEY = 'twitter-clone:bsky-oauth-accounts';
const CREDENTIAL_SESSION_KEY = 'twitter-clone:bsky-credential-session';
const ACTIVITY_NOTIFICATION_CATEGORIES_KEY =
  'twitter-clone:activity-notification-categories';
const BSKY_APPVIEW_DID = 'did:web:api.bsky.app';
const DEFAULT_ATPROTO_PDS_URL = 'https://bsky.social';
const BSKY_APPVIEW_SERVICE = 'bsky_appview';
const BSKY_APPVIEW_PROXY = `${BSKY_APPVIEW_DID}#${BSKY_APPVIEW_SERVICE}`;
const BSKY_APPVIEW_URL = 'https://api.bsky.app';
const PUBLIC_BSKY_APPVIEW_URL = 'https://public.api.bsky.app';
const BSKY_VIDEO_DID = 'did:web:video.bsky.app';
const BSKY_VIDEO_SERVICE = 'bsky_video';
const BSKY_VIDEO_PROXY = `${BSKY_VIDEO_DID}#${BSKY_VIDEO_SERVICE}`;
const BSKY_VIDEO_URL = 'https://video.bsky.app';
const BSKY_VIDEO_UPLOAD_AUTH_METHOD = 'com.atproto.repo.uploadBlob';
const BSKY_CHAT_DID = 'did:web:api.bsky.chat';
const BSKY_CHAT_SERVICE = 'bsky_chat';
const BSKY_CHAT_PROXY = `${BSKY_CHAT_DID}#${BSKY_CHAT_SERVICE}`;
const BSKY_CHAT_URL = 'https://api.bsky.chat';
const BSKY_MODERATION_DID = 'did:plc:ar7c4by46qjdydhdevvrndac';
const CHAT_SCOPE = 'transition:chat.bsky';
const GENERIC_SCOPE = 'transition:generic';
const OAUTH_SCOPES = [
  'atproto',
  GENERIC_SCOPE,
  CHAT_SCOPE,
  'account:email?action=manage',
  'identity:handle'
];
const OAUTH_SCOPE = OAUTH_SCOPES.join(' ');
const BSKY_POST_IMAGE_MAX_COUNT = 10;
const BSKY_POST_IMAGE_MAX_BYTES = 2_000_000;
const BSKY_POST_IMAGE_TARGET_BYTES = 1_900_000;
const BSKY_EXTERNAL_THUMB_MAX_BYTES = 1_000_000;
const BSKY_EXTERNAL_THUMB_TARGET_BYTES = 950_000;
const BSKY_PROFILE_IMAGE_MAX_BYTES = 1_000_000;
const BSKY_PROFILE_IMAGE_TARGET_BYTES = 950_000;
const BSKY_IMAGE_MAX_DIMENSION = 2000;
const BSKY_VIDEO_MAX_BYTES = 100_000_000;
const BSKY_VIDEO_MAX_DURATION_SECONDS = 180;
const BSKY_VIDEO_JOB_RETRIES = 90;
const BSKY_VIDEO_UPLOAD_TOKEN_TTL_SECONDS = 30 * 60;
const BSKY_PROFILE_IMAGE_MIME_TYPE = 'image/jpeg';
const BSKY_PROFILE_IMAGE_ACCEPTED_TYPES = /^image\/(?:jpe?g|png)$/i;
const BSKY_POST_IMAGE_ACCEPTED_TYPES = /^image\/(?:jpe?g|png|webp)$/i;
const BSKY_MEDIA_POST_VISIBILITY_RETRIES = 8;
const BSKY_THREAD_REPLY_DEPTH = 100;
const BSKY_THREAD_FULL_REPLY_DEPTH = 1000;
const BSKY_THREAD_FULL_PARENT_HEIGHT = 1000;
const BSKY_READER_AUTHOR_FEED_LIMIT = 100;
const BSKY_READER_AUTHOR_FEED_MAX_PAGES = 10;
const BSKY_THREAD_PARENT_PAGE_SIZE = 6;
const SERVICE_AUTH_TOKEN_TTL_SECONDS = 55;
const BSKY_CHAT_ACCESS_MESSAGE =
  'Messages need Bluesky DM access. Authorize messages with Bluesky to continue.';
const REFRESH_BSKY_LOGIN_MESSAGE =
  'Refresh your Bluesky login to load Bluesky data. Sign out and sign back in once so Bluesky grants Not Twitter AppView access.';
const THEME_KEY = 'twitter-clone:bsky-theme';
const DEFAULT_PROFILE_PHOTO_URL = '/assets/twitter-default-egg.png';
const DEFAULT_PROFILE_COVER_URL = '/assets/twitter-default-cover.png';
const CHAT_DECLARATION_COLLECTION = 'chat.bsky.actor.declaration';
const STANDARD_SITE_DOCUMENT_COLLECTION = 'site.standard.document';

type BskyServiceConfig = {
  did: string;
  service: string;
  proxy: string;
  url: string;
  chat: boolean;
  direct?: boolean;
};

const BSKY_APPVIEW_CONFIG: BskyServiceConfig = {
  did: BSKY_APPVIEW_DID,
  service: BSKY_APPVIEW_SERVICE,
  proxy: BSKY_APPVIEW_PROXY,
  url: BSKY_APPVIEW_URL,
  chat: false
};

const BSKY_CHAT_CONFIG: BskyServiceConfig = {
  did: BSKY_CHAT_DID,
  service: BSKY_CHAT_SERVICE,
  proxy: BSKY_CHAT_PROXY,
  url: BSKY_CHAT_URL,
  chat: true
};

const BSKY_VIDEO_CONFIG: BskyServiceConfig = {
  did: BSKY_VIDEO_DID,
  service: BSKY_VIDEO_SERVICE,
  proxy: BSKY_VIDEO_PROXY,
  url: BSKY_VIDEO_URL,
  chat: false,
  direct: true
};

const PUBLIC_BSKY_APPVIEW_METHODS = new Set([
  'app.bsky.actor.getProfile',
  'app.bsky.actor.getProfiles',
  'app.bsky.actor.searchActors',
  'app.bsky.actor.searchActorsTypeahead',
  'app.bsky.embed.getEmbedExternalView',
  'app.bsky.feed.getActorLikes',
  'app.bsky.feed.getAuthorFeed',
  'app.bsky.feed.getFeed',
  'app.bsky.feed.getFeedGenerator',
  'app.bsky.feed.getFeedGenerators',
  'app.bsky.feed.getLikes',
  'app.bsky.feed.getPostThread',
  'app.bsky.feed.getPosts',
  'app.bsky.feed.getQuotes',
  'app.bsky.feed.getRepostedBy',
  'app.bsky.graph.getFollowers',
  'app.bsky.graph.getFollows',
  'app.bsky.graph.getKnownFollowers',
  'app.bsky.graph.getActorStarterPacks',
  'app.bsky.graph.getList',
  'app.bsky.graph.getLists',
  'app.bsky.graph.getStarterPack',
  'app.bsky.labeler.getServices'
]);

type AuthUser = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
};

type CredentialSessionState = {
  session: AtpSessionData;
  serviceUrl: string;
};

type ResolvedAtprotoHandle = AtprotoIdentityDid | null;

type AtprotoHandleResolveOptions = {
  noCache?: boolean;
  signal?: AbortSignal;
};

type AtprotoHandleResolver = {
  resolve(
    handle: string,
    options?: AtprotoHandleResolveOptions
  ): Promise<ResolvedAtprotoHandle>;
};

export type SavedBlueskyAccount = {
  id: string;
  name: string;
  username: string;
  photoURL: string;
  verified: boolean;
  updatedAt: string;
};

type CollectionName = 'users' | 'tweets' | 'bookmarks' | 'stats';

type QueryFilter = {
  type: 'where';
  field: string;
  op: string;
  value: unknown;
};

type QueryLimit = {
  type: 'limit';
  count: number;
};

type QueryOrder = {
  type: 'orderBy';
  field: string;
  direction?: 'asc' | 'desc';
};

export type BackendConstraint = QueryFilter | QueryLimit | QueryOrder;

export type BackendCollection = {
  collectionName: CollectionName;
  path: string;
  ownerId?: string;
};

export type ModerationReportReason =
  | 'spam'
  | 'scam'
  | 'violation'
  | 'misleading'
  | 'misleading-elections'
  | 'impersonation'
  | 'sexual'
  | 'sexual-abuse'
  | 'child-safety'
  | 'rude'
  | 'harassment'
  | 'hate'
  | 'private-info'
  | 'violence'
  | 'graphic-violence'
  | 'self-harm'
  | 'prohibited-sales'
  | 'site-security'
  | 'ban-evasion'
  | 'other';

type PostRef = {
  uri: string;
  cid: string;
};

type ViewerReactionKind = 'like' | 'repost';

type ViewerReactionState = {
  active: boolean;
};

type PostReplyRef = {
  root: PostRef;
  parent: PostRef;
};

export type TweetThreadPage = {
  tweet: TweetWithUser;
  parents: TweetWithUser[];
  parentCursor: string | null;
  threadReplies: TweetWithUser[];
  replies: TweetWithUser[];
};

export type TweetThreadParentsPage = {
  parents: TweetWithUser[];
  cursor: string | null;
};

type ThreadItem =
  | AppBskyFeedDefs.ThreadViewPost
  | AppBskyFeedDefs.BlockedPost
  | AppBskyFeedDefs.NotFoundPost;

type ThreadV2Item =
  | AppBskyUnspeccedGetPostThreadV2.ThreadItem
  | AppBskyUnspeccedGetPostThreadOtherV2.ThreadItem;

type HiddenThreadAuthors = Map<string, TweetUnavailableReason>;

type BookmarkView = {
  subject?: PostRef;
  createdAt?: string;
  item?: unknown;
};

type BookmarksResponse = {
  cursor?: string;
  bookmarks: BookmarkView[];
};

type UploadedImage = {
  file: File;
  preview: ImagesPreview[number];
};

type StrictBlobRef = LexiconBlobRef & {
  ref: LexiconBlobRef['ref'];
  mimeType: string;
  size: number;
};

type BlobRefConstructor = {
  new (
    ref: LexiconBlobRef['ref'],
    mimeType: string,
    size: number
  ): StrictBlobRef;
  prototype: StrictBlobRef;
};

const BlobRef = AtprotoBlobRef as unknown as BlobRefConstructor;
const jsonToLex = atprotoJsonToLex as unknown as (value: JsonValue) => unknown;

export type ProfileMediaFiles = Partial<
  Record<'photoURL' | 'coverPhotoURL', FilesWithId>
>;

type PreparedImageUpload = {
  file: Blob;
  encoding: string;
  aspectRatio: AppBskyEmbedImages.Image['aspectRatio'];
};

type LocalProfileMediaUrls = Partial<Pick<User, 'photoURL' | 'coverPhotoURL'>>;

type ActorFeedPost = AppBskyFeedDefs.FeedViewPost;
type AppViewFeedResponse = {
  cursor?: string;
  feed: AppBskyFeedDefs.FeedViewPost[];
};
type AppViewFeedGeneratorResponse = {
  view: AppBskyFeedDefs.GeneratorView;
};
type AppViewFeedGeneratorsResponse = {
  feeds: AppBskyFeedDefs.GeneratorView[];
};
type AppViewFeedGeneratorSearchResponse = {
  cursor?: string;
  feeds: AppBskyFeedDefs.GeneratorView[];
};
type AppViewPostsResponse = {
  posts: AppBskyFeedDefs.PostView[];
};
type AppViewSearchPostsResponse = {
  cursor?: string;
  hitsTotal?: number;
  posts: AppBskyFeedDefs.PostView[];
};
type AppViewNotificationsResponse = {
  cursor?: string;
  notifications: AppBskyNotificationListNotifications.Notification[];
  priority?: boolean;
  seenAt?: string;
};
type AppViewListsResponse = {
  cursor?: string;
  lists: AppBskyGraphDefs.ListView[];
};
type AppViewListResponse = {
  cursor?: string;
  list: AppBskyGraphDefs.ListView;
  items: AppBskyGraphDefs.ListItemView[];
};
type AppViewActorStarterPacksResponse = {
  cursor?: string;
  starterPacks: AppBskyGraphDefs.StarterPackViewBasic[];
};
type AppViewStarterPackResponse = {
  starterPack: AppBskyGraphDefs.StarterPackView;
};
type ActorProfileView =
  | AppBskyActorDefs.ProfileViewBasic
  | AppBskyActorDefs.ProfileView
  | AppBskyActorDefs.ProfileViewDetailed;

export type FeedGeneratorPage = {
  uri: string;
  displayName: string;
  description: string | null;
  avatar: string | null;
  likeCount: number;
  cursor: string | null;
  feed: TweetWithUser[];
};

export type HomeFeedPage = {
  tweets: TweetWithUser[];
  cursor: string | null;
};

export type SubscribedHomeFeed = {
  id: string;
  type: 'feed' | 'timeline';
  uri: string;
  displayName: string;
  description: string | null;
  avatar: string | null;
  creatorName: string;
  creatorUsername: string;
  pinned: boolean;
};

export type FeedBrowserFeed = SubscribedHomeFeed & {
  editable: boolean;
  href: string;
  indexedAt: string | null;
  likeCount: number;
  saved: boolean;
};

export type FeedSearchPage = {
  feeds: FeedBrowserFeed[];
  cursor: string | null;
};

export type TweetStatsType = 'retweets' | 'likes' | 'quotes';

export type TweetStatsPage = {
  users: User[];
  tweets: TweetWithUser[];
  cursor: string | null;
};

export type SearchPostFilter = 'top' | 'latest' | 'photos' | 'videos';
export type SearchPeopleFilter = 'anyone' | 'followed';

export type SearchTweetsPage = {
  tweets: TweetWithUser[];
  cursor: string | null;
  hitsTotal: number | null;
};

export type SearchUsersPage = {
  users: User[];
  cursor: string | null;
};

export type UserListTab = 'follow' | 'moderation';

export type UserList = {
  uri: string;
  url: string;
  name: string;
  description: string | null;
  avatar: string | null;
  purpose: UserListTab;
  listItemCount: number;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar: string;
  viewerMuted: boolean;
  viewerBlocked: boolean;
  indexedAt: string | null;
};

export type UserListsPage = {
  lists: UserList[];
};

export type ProfileListsPage = {
  lists: UserList[];
  cursor: string | null;
};

export type ProfileStarterPack = {
  uri: string;
  url: string;
  name: string;
  description: string | null;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar: string;
  listItemCount: number;
  feedCount: number;
  joinedWeekCount: number;
  joinedAllTimeCount: number;
  indexedAt: string;
};

export type ProfileStarterPacksPage = {
  starterPacks: ProfileStarterPack[];
  cursor: string | null;
};

export type NotificationReason =
  | 'like'
  | 'repost'
  | 'follow'
  | 'mention'
  | 'reply'
  | 'quote'
  | 'starterpack-joined'
  | 'verified'
  | 'unverified'
  | 'like-via-repost'
  | 'repost-via-repost'
  | 'subscribed-post'
  | 'contact-match'
  | string;

export type NotificationItem = {
  id: string;
  user: User;
  reason: NotificationReason;
  text: string | null;
  tweet: Tweet | null;
  targetPostId: string | null;
  isRead: boolean;
  createdAt: Timestamp;
};

export type NotificationsPage = {
  notifications: NotificationItem[];
  cursor: string | null;
  seenAt: string | null;
};

type NotificationTweetLookup = {
  tweetByUri: Map<string, Tweet>;
  hiddenUris: Set<string>;
};

export type ChatParticipant = Pick<
  User,
  | 'id'
  | 'name'
  | 'username'
  | 'photoURL'
  | 'verified'
  | 'followingCount'
  | 'followersCount'
  | 'createdAt'
>;

export type ChatReaction = {
  value: string;
  senderId: string;
  createdAt: Timestamp;
};

export type ChatMessage = {
  id: string;
  text: string | null;
  senderId: string;
  sentAt: Timestamp;
  deleted: boolean;
  reactions: ChatReaction[];
  readBy: string[];
  deliveredBy?: string[];
};

export type ChatConvo = {
  id: string;
  kind: 'direct' | 'group' | string;
  groupName: string | null;
  memberCount: number | null;
  memberLimit: number | null;
  muted: boolean;
  opened: boolean;
  unreadCount: number;
  status: 'accepted' | 'request' | string;
  members: ChatParticipant[];
  lastMessage: ChatMessage | null;
};

export type ChatConvoPage = {
  convos: ChatConvo[];
  cursor: string | null;
};

export type ChatConvoRequestsPage = {
  requests: ChatConvo[];
  cursor: string | null;
};

export type ChatMessagesPage = {
  messages: ChatMessage[];
  cursor: string | null;
};

export type ChatAllowIncoming = 'all' | 'following' | 'none';

export type ChatSettings = {
  allowIncoming: ChatAllowIncoming;
};

export type SettingsLabelPreference = 'ignore' | 'warn' | 'hide';

export type SettingsContentLabel =
  | 'porn'
  | 'sexual'
  | 'nudity'
  | 'sexual-figurative'
  | 'graphic-media'
  | 'self-harm'
  | 'sensitive'
  | 'extremist'
  | 'intolerant'
  | 'threat'
  | 'rude'
  | 'illicit'
  | 'security'
  | 'unsafe-link'
  | 'impersonation'
  | 'misinformation'
  | 'scam'
  | 'engagement-farming'
  | 'spam'
  | 'rumor'
  | 'misleading'
  | 'inauthentic';

export type SettingsThreadSort = 'oldest' | 'newest' | 'most-likes' | 'hotness';

export type SettingsDefaultReply =
  | 'everyone'
  | 'following'
  | 'followers'
  | 'mentioned'
  | 'nobody'
  | 'custom';

export type SettingsDefaultQuote = 'enabled' | 'disabled' | 'custom';

export type SettingsMutedWordTarget = 'content' | 'tag';
export type SettingsMutedWordActorTarget = 'all' | 'exclude-following';

export type SettingsMutedWord = {
  id?: string;
  value: string;
  targets: SettingsMutedWordTarget[];
  actorTarget: SettingsMutedWordActorTarget;
  expiresAt?: string;
};

export type SettingsNotificationInclude = 'all' | 'follows' | 'accepted';

export type SettingsNotificationPreference = {
  include?: SettingsNotificationInclude;
  list: boolean;
  push: boolean;
};

export type SettingsNotificationKey =
  | 'chat'
  | 'follow'
  | 'like'
  | 'likeViaRepost'
  | 'mention'
  | 'quote'
  | 'reply'
  | 'repost'
  | 'repostViaRepost'
  | 'starterpackJoined'
  | 'subscribedPost'
  | 'unverified'
  | 'verified';

export type SettingsNotificationPreferences = Record<
  SettingsNotificationKey,
  SettingsNotificationPreference
>;

export type BlueskySettings = {
  account: {
    did: string;
    handle: string;
    email: string | null;
    emailConfirmed: boolean | null;
    emailAuthFactor: boolean | null;
    active: boolean | null;
    status: string | null;
  };
  feedView: BskyFeedViewPreference;
  threadView: BskyThreadViewPreference;
  contentLabels: Record<SettingsContentLabel, SettingsLabelPreference>;
  adultContentEnabled: boolean;
  mutedWords: SettingsMutedWord[];
  postInteractions: {
    defaultReply: SettingsDefaultReply;
    defaultQuote: SettingsDefaultQuote;
  };
  interests: string[];
  chat: {
    available: boolean;
    settings: ChatSettings | null;
    error: string | null;
  };
  notifications: {
    available: boolean;
    preferences: SettingsNotificationPreferences | null;
    error: string | null;
  };
};

export type BlockedUsersPage = {
  users: User[];
  cursor: string | null;
};

export class ChatAccessError extends Error {
  constructor(message = 'Authorize messages to continue.') {
    super(message);
    this.name = 'ChatAccessError';
  }
}

const userCache = new Map<string, User>();
const userHandleCache = new Map<string, User>();
const tweetCache = new Map<string, Tweet>();
const locallyCreatedTweets = new Map<string, Tweet>();
const localQuoteTargetIds = new Map<string, string>();
const locallyDeletedTweetIds = new Set<string>();
const locallyReportedTweetIds = new Set<string>();
const postRefCache = new Map<string, PostRef>();
const postReplyRefCache = new Map<string, PostReplyRef>();
const followUriCache = new Map<string, string>();
const localViewerFollowOverrides = new Map<string, boolean>();
const localViewerLikeOverrides = new Map<string, ViewerReactionState>();
const localViewerRepostOverrides = new Map<string, ViewerReactionState>();
const localViewerLikeUriCache = new Map<string, string>();
const localViewerRepostUriCache = new Map<string, string>();
const blockUriCache = new Map<string, string>();
const detailedUserCache = new Set<string>();
const profileRecordHydratedUsers = new Set<string>();
const chatDeclarationHydratedUsers = new Set<string>();
const didPdsEndpointCache = new Map<string, string | null>();
const stagedImages = new Map<string, UploadedImage[]>();
export type BackendChangeType =
  | 'auth'
  | 'content'
  | 'reaction'
  | 'relationship';

type BackendListener = (changeType: BackendChangeType) => void;

const listeners = new Map<BackendListener, Set<BackendChangeType> | null>();
const serviceAuthTokenCache = new Map<
  string,
  { token: string; expiresAt: number }
>();

let agent: Agent | null = null;
let credentialAgent: AtpAgent | null = null;
let publicAppViewAgent: Agent | null = null;
let oauthClientPromise: Promise<BrowserOAuthClient> | null = null;
let oauthClientRedirectUri: string | null = null;
let oauthSession: OAuthSession | null = null;
let oauthInitPromise: Promise<AuthUser | null> | null = null;
let sessionDid: string | null = null;
let activePdsDidPromise: Promise<string> | null = null;
let currentUser: User | null = null;
let currentFollowing = new Set<string>();
let malformedMediaRepairPromise: Promise<void> | null = null;
let moderationOptsPromise: Promise<ModerationOpts | null> | null = null;
let activeModerationOpts: ModerationOpts | null = null;
let moderationLabelerDids: string[] = [];

function hasStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export const activityNotificationCategoryIds: ActivityNotificationCategory[] = [
  'all',
  'tweets',
  'articles',
  'retweets',
  'replies'
];

const activityNotificationIndividualCategories: ActivityNotificationCategory[] =
  ['tweets', 'articles', 'retweets', 'replies'];

export function getActivityNotificationCategoryTitle(
  category: ActivityNotificationCategory
): string {
  switch (category) {
    case 'all':
      return 'All';
    case 'tweets':
      return 'Tweets';
    case 'articles':
      return 'Articles';
    case 'retweets':
      return 'Retweets';
    case 'replies':
      return 'Replies';
  }
}

export function normalizeActivityNotificationCategories(
  categories: readonly ActivityNotificationCategory[] | undefined
): ActivityNotificationCategory[] {
  if (!categories?.length) return [];
  if (categories.includes('all')) return ['all'];

  const next = activityNotificationIndividualCategories.filter((category) =>
    categories.includes(category)
  );

  return next.length === activityNotificationIndividualCategories.length
    ? ['all']
    : next;
}

export function activityNotificationCategoriesInclude(
  categories: readonly ActivityNotificationCategory[] | undefined,
  category: ActivityNotificationCategory
): boolean {
  const normalized = normalizeActivityNotificationCategories(categories);

  return normalized.includes('all') || normalized.includes(category);
}

function readActivityNotificationCategoriesByDid(): Record<
  string,
  ActivityNotificationCategory[]
> {
  if (!hasStorage()) return {};

  try {
    const value = window.localStorage.getItem(
      ACTIVITY_NOTIFICATION_CATEGORIES_KEY
    );
    const parsed: unknown = value ? JSON.parse(value) : {};

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(
        ([did, categories]) => [
          did,
          normalizeActivityNotificationCategories(
            Array.isArray(categories)
              ? (categories as ActivityNotificationCategory[])
              : []
          )
        ]
      )
    );
  } catch {
    return {};
  }
}

function writeActivityNotificationCategoriesByDid(
  value: Record<string, ActivityNotificationCategory[]>
): void {
  if (!hasStorage()) return;

  window.localStorage.setItem(
    ACTIVITY_NOTIFICATION_CATEGORIES_KEY,
    JSON.stringify(value)
  );
}

function getStoredActivityNotificationCategories(
  did: string
): ActivityNotificationCategory[] | null {
  const stored = readActivityNotificationCategoriesByDid();

  return Object.prototype.hasOwnProperty.call(stored, did)
    ? stored[did] ?? []
    : null;
}

function getProfileActivityNotificationCategories(
  did: string,
  activitySubscription?: { post?: boolean; reply?: boolean } | null
): ActivityNotificationCategory[] {
  const stored = getStoredActivityNotificationCategories(did);
  if (stored) return stored;

  return activitySubscription?.post || activitySubscription?.reply
    ? ['all']
    : [];
}

function splitAtprotoServiceList(value: string | undefined): string[] {
  return value?.split(/[\s,]+/).filter(Boolean) ?? [];
}

function normalizeAtprotoServiceUrl(value: string | undefined): string | null {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return null;

  const urlValue = /^https?:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const url = new URL(urlValue);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.search = '';
    url.hash = '';

    return url.toString().replace(/\/+$/g, '');
  } catch {
    return null;
  }
}

function getConfiguredAtprotoServiceUrls(): string[] {
  const configuredUrls = [
    ...splitAtprotoServiceList(process.env.NEXT_PUBLIC_ATPROTO_PDS_URLS),
    ...splitAtprotoServiceList(
      process.env.NEXT_PUBLIC_ATPROTO_HANDLE_RESOLVER_URLS
    ),
    process.env.NEXT_PUBLIC_ATPROTO_PDS_URL,
    process.env.NEXT_PUBLIC_ATPROTO_HANDLE_RESOLVER_URL,
    DEFAULT_ATPROTO_PDS_URL
  ];
  const seenUrls = new Set<string>();

  return configuredUrls.reduce<string[]>((urls, value) => {
    const normalizedUrl = normalizeAtprotoServiceUrl(value);

    if (!normalizedUrl || seenUrls.has(normalizedUrl)) return urls;

    seenUrls.add(normalizedUrl);
    urls.push(normalizedUrl);
    return urls;
  }, []);
}

function getPrimaryAtprotoServiceUrl(): string {
  return getConfiguredAtprotoServiceUrls()[0] ?? DEFAULT_ATPROTO_PDS_URL;
}

function getConfiguredBasePath(): string {
  const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? '';
  const basePath = rawBasePath.replace(/^\/+|\/+$/g, '');

  return basePath ? `/${basePath}` : '';
}

function usesHttpAtprotoService(): boolean {
  return getConfiguredAtprotoServiceUrls().some((serviceUrl) => {
    try {
      return new URL(serviceUrl).protocol === 'http:';
    } catch {
      return false;
    }
  });
}

async function resolveAtprotoHandleWithService(
  serviceUrl: string,
  handle: string,
  options?: AtprotoHandleResolveOptions
): Promise<ResolvedAtprotoHandle> {
  const url = new URL('/xrpc/com.atproto.identity.resolveHandle', serviceUrl);
  url.searchParams.set('handle', handle);

  const response = await fetch(url, {
    cache: options?.noCache ? 'no-cache' : undefined,
    redirect: 'error',
    signal: options?.signal
  });
  const body = (await response.json().catch(() => null)) as {
    did?: unknown;
    error?: unknown;
    message?: unknown;
  } | null;

  if (
    response.status === 400 &&
    body?.error === 'InvalidRequest' &&
    body?.message === 'Unable to resolve handle'
  ) {
    return null;
  }

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(
      typeof body?.message === 'string'
        ? body.message
        : `Unable to resolve handle through ${serviceUrl}.`
    );
  }

  if (typeof body?.did !== 'string') {
    throw new Error(`Invalid handle resolver response from ${serviceUrl}.`);
  }

  const did = body.did;
  ensureValidDid(did);

  if (!isAtprotoIdentityDid(did)) {
    throw new Error(`Unsupported AT Protocol DID returned by ${serviceUrl}.`);
  }

  return did;
}

function createMultiPdsHandleResolver(): AtprotoHandleResolver {
  const serviceUrls = getConfiguredAtprotoServiceUrls();

  return {
    async resolve(
      handle: string,
      options?: AtprotoHandleResolveOptions
    ): Promise<ResolvedAtprotoHandle> {
      let lastError: unknown = null;
      let failedResolvers = 0;

      for (const serviceUrl of serviceUrls) {
        try {
          const did = await resolveAtprotoHandleWithService(
            serviceUrl,
            handle,
            options
          );
          if (did) return did;
        } catch (error) {
          lastError = error;
          failedResolvers += 1;
        }
      }

      if (failedResolvers === serviceUrls.length && lastError) {
        throw lastError instanceof Error
          ? lastError
          : new Error('Unable to resolve AT Protocol handle.');
      }

      return null;
    }
  };
}

function normalizeCredentialSession(value: unknown): AtpSessionData | null {
  if (!value || typeof value !== 'object') return null;

  const parsedSession = value as Partial<AtpSessionData>;

  return parsedSession.did &&
    parsedSession.handle &&
    parsedSession.accessJwt &&
    parsedSession.refreshJwt
    ? (parsedSession as AtpSessionData)
    : null;
}

function readCredentialSession(): CredentialSessionState | null {
  if (!hasStorage()) return null;

  try {
    const storedSession = window.localStorage.getItem(CREDENTIAL_SESSION_KEY);
    if (!storedSession) return null;

    const parsedSession = JSON.parse(storedSession) as unknown;
    const parsedRecord =
      parsedSession && typeof parsedSession === 'object'
        ? (parsedSession as {
            service?: unknown;
            serviceUrl?: unknown;
            session?: unknown;
          })
        : null;
    const session = normalizeCredentialSession(
      parsedRecord?.session ?? parsedSession
    );
    const storedServiceUrl =
      typeof parsedRecord?.serviceUrl === 'string'
        ? parsedRecord.serviceUrl
        : typeof parsedRecord?.service === 'string'
        ? parsedRecord.service
        : undefined;

    if (!session) return null;

    return {
      session,
      serviceUrl:
        normalizeAtprotoServiceUrl(storedServiceUrl) ??
        getPrimaryAtprotoServiceUrl()
    };
  } catch {
    return null;
  }
}

function writeCredentialSession(
  session?: AtpSessionData,
  serviceUrl = getPrimaryAtprotoServiceUrl()
): void {
  if (!hasStorage()) return;

  if (session) {
    window.localStorage.setItem(
      CREDENTIAL_SESSION_KEY,
      JSON.stringify({
        serviceUrl:
          normalizeAtprotoServiceUrl(serviceUrl) ??
          getPrimaryAtprotoServiceUrl(),
        session
      })
    );
    return;
  }

  window.localStorage.removeItem(CREDENTIAL_SESSION_KEY);
}

function normalizeSavedAccount(value: unknown): SavedBlueskyAccount | null {
  if (!value || typeof value !== 'object') return null;

  const account = value as Partial<SavedBlueskyAccount>;

  if (
    typeof account.id !== 'string' ||
    typeof account.name !== 'string' ||
    typeof account.username !== 'string' ||
    typeof account.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: account.id,
    name: account.name,
    username: account.username,
    photoURL:
      typeof account.photoURL === 'string'
        ? account.photoURL
        : DEFAULT_PROFILE_PHOTO_URL,
    verified: !!account.verified,
    updatedAt: account.updatedAt
  };
}

function readSavedAccounts(): SavedBlueskyAccount[] {
  if (!hasStorage()) return [];

  try {
    const storedAccounts = window.localStorage.getItem(OAUTH_ACCOUNTS_KEY);
    if (!storedAccounts) return [];

    const parsedAccounts = JSON.parse(storedAccounts) as unknown;
    if (!Array.isArray(parsedAccounts)) return [];

    const seen = new Set<string>();
    return parsedAccounts
      .map(normalizeSavedAccount)
      .filter((account): account is SavedBlueskyAccount => {
        if (!account || seen.has(account.id)) return false;
        seen.add(account.id);
        return true;
      });
  } catch {
    return [];
  }
}

function writeSavedAccounts(accounts: SavedBlueskyAccount[]): void {
  if (!hasStorage()) return;

  if (accounts.length) {
    window.localStorage.setItem(OAUTH_ACCOUNTS_KEY, JSON.stringify(accounts));
    return;
  }

  window.localStorage.removeItem(OAUTH_ACCOUNTS_KEY);
}

function saveAccount(user: User): void {
  const savedAccount: SavedBlueskyAccount = {
    id: user.id,
    name: user.name,
    username: user.username,
    photoURL: user.photoURL,
    verified: user.verified,
    updatedAt: new Date().toISOString()
  };

  const accounts = readSavedAccounts();
  const nextAccounts = [
    savedAccount,
    ...accounts.filter((account) => account.id !== savedAccount.id)
  ];

  writeSavedAccounts(nextAccounts);
}

function updateSavedAccount(user: User): void {
  if (!readSavedAccounts().some((account) => account.id === user.id)) return;

  saveAccount(user);
}

function removeSavedAccount(
  id: string | null | undefined
): SavedBlueskyAccount[] {
  if (!id) return readSavedAccounts();

  const nextAccounts = readSavedAccounts().filter(
    (account) => account.id !== id
  );
  writeSavedAccounts(nextAccounts);
  return nextAccounts;
}

function clearModerationSettingsCache(): void {
  moderationOptsPromise = null;
  activeModerationOpts = null;
  moderationLabelerDids = [];
  tweetCache.clear();
}

function deleteCachedTweetsByAuthor(authorDid: string): void {
  tweetCache.forEach((tweet, id) => {
    if (tweet.createdBy === authorDid) tweetCache.delete(id);
  });
}

function clearActiveAuthState(): void {
  agent = null;
  credentialAgent = null;
  oauthSession = null;
  oauthInitPromise = null;
  sessionDid = null;
  activePdsDidPromise = null;
  currentUser = null;
  currentFollowing = new Set();
  malformedMediaRepairPromise = null;
  clearModerationSettingsCache();
  followUriCache.clear();
  localViewerFollowOverrides.clear();
  blockUriCache.clear();
  locallyCreatedTweets.clear();
  localQuoteTargetIds.clear();
  locallyDeletedTweetIds.clear();
  localViewerLikeOverrides.clear();
  localViewerRepostOverrides.clear();
  localViewerLikeUriCache.clear();
  localViewerRepostUriCache.clear();
  serviceAuthTokenCache.clear();

  if (hasStorage()) window.localStorage.removeItem(OAUTH_SUB_KEY);
  writeCredentialSession();
}

function getCredentialAgentServiceUrl(
  activeAgent: AtpAgent | null,
  fallbackServiceUrl: string
): string {
  const serviceUrl = activeAgent
    ? String(activeAgent.pdsUrl ?? activeAgent.serviceUrl)
    : fallbackServiceUrl;

  return normalizeAtprotoServiceUrl(serviceUrl) ?? fallbackServiceUrl;
}

function createCredentialAgent(
  serviceUrl = getPrimaryAtprotoServiceUrl()
): AtpAgent {
  const normalizedServiceUrl =
    normalizeAtprotoServiceUrl(serviceUrl) ?? getPrimaryAtprotoServiceUrl();
  let nextAgent: AtpAgent | null = null;

  nextAgent = new AtpAgent({
    service: normalizedServiceUrl,
    persistSession: (_event, session) =>
      writeCredentialSession(
        session,
        getCredentialAgentServiceUrl(nextAgent, normalizedServiceUrl)
      )
  });

  return nextAgent;
}

function getLoopbackRedirectUri(): string {
  const { protocol, hostname, port, pathname } = window.location;
  const redirectHost = hostname === 'localhost' ? '127.0.0.1' : hostname;
  const redirectPort = port ? `:${port}` : '';

  return `${protocol}//${redirectHost}${redirectPort}${pathname}`;
}

function redirectToCanonicalLoopbackHost(): Promise<never> | null {
  if (
    process.env.NEXT_PUBLIC_ATPROTO_CLIENT_ID ||
    window.location.hostname !== 'localhost'
  )
    return null;

  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.hostname = '127.0.0.1';

  window.location.replace(canonicalUrl.href);

  return new Promise<never>(() => undefined);
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

function getHostedOAuthClientId(): string {
  const basePath = getConfiguredBasePath();

  return `${window.location.origin}${basePath}/oauth/client-metadata.json`;
}

async function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (typeof window === 'undefined')
    throw new Error('Bluesky OAuth is only available in the browser.');

  const loopbackRedirect = redirectToCanonicalLoopbackHost();
  if (loopbackRedirect) return loopbackRedirect;

  const nextRedirectUri =
    !process.env.NEXT_PUBLIC_ATPROTO_CLIENT_ID &&
    isLoopbackHost(window.location.hostname)
      ? getLoopbackRedirectUri()
      : null;

  if (oauthClientPromise && oauthClientRedirectUri !== nextRedirectUri)
    oauthClientPromise = null;

  if (!oauthClientPromise) {
    oauthClientRedirectUri = nextRedirectUri;
    oauthClientPromise = (async (): Promise<BrowserOAuthClient> => {
      const configuredClientId = process.env.NEXT_PUBLIC_ATPROTO_CLIENT_ID;
      const oauthOptions = {
        handleResolver: createMultiPdsHandleResolver(),
        allowHttp: usesHttpAtprotoService()
      };

      if (configuredClientId) {
        return BrowserOAuthClient.load({
          clientId: configuredClientId,
          ...oauthOptions
        });
      }

      if (!isLoopbackHost(window.location.hostname)) {
        return BrowserOAuthClient.load({
          clientId: getHostedOAuthClientId(),
          ...oauthOptions
        });
      }

      return new BrowserOAuthClient({
        ...oauthOptions,
        clientMetadata: buildAtprotoLoopbackClientMetadata({
          scope: OAUTH_SCOPE,
          redirect_uris: [nextRedirectUri as never]
        })
      });
    })();
  }

  return oauthClientPromise;
}

function getAgent(): Agent {
  if (!agent) throw new Error('Sign in with Bluesky before loading this view.');
  return agent;
}

async function getActivePdsDid(): Promise<string> {
  if (!activePdsDidPromise) {
    activePdsDidPromise = getAgent()
      .com.atproto.server.describeServer()
      .then(({ data }) => {
        ensureValidDid(data.did);
        return data.did;
      });
  }

  return activePdsDidPromise;
}

function getXrpcPath(url: string): string {
  const path = url.startsWith('http')
    ? `${new URL(url).pathname}${new URL(url).search}`
    : url;
  const index = path.indexOf('/xrpc/');

  if (index < 0) throw new Error(`Unsupported Bluesky service request: ${url}`);

  return path.slice(index);
}

function getXrpcMethod(url: string): string {
  const path = getXrpcPath(url).split('?')[0];

  return decodeURIComponent(path.slice('/xrpc/'.length));
}

async function createResponseError(response: Response): Promise<
  Error & {
    status?: number;
  }
> {
  const fallbackMessage = response.statusText || `HTTP ${response.status}`;
  const message = (await readXrpcError(response)) || fallbackMessage;
  const error = new Error(message) as Error & { status?: number };

  error.status = response.status;
  return error;
}

function throwServiceError(service: BskyServiceConfig, error: unknown): never {
  if (service.chat) throwChatError(error);

  const status = getErrorStatus(error);
  const message = getUnknownErrorMessage(error);

  if (
    status === 401 ||
    status === 403 ||
    /auth|scope|permission|access/i.test(message)
  ) {
    throw new Error(REFRESH_BSKY_LOGIN_MESSAGE);
  }

  throw error instanceof Error ? error : new Error(message);
}

async function getServiceAuthToken(
  service: BskyServiceConfig,
  method: string
): Promise<string> {
  const audience =
    service.service === BSKY_VIDEO_SERVICE
      ? await getActivePdsDid()
      : service.did;
  const serviceAuthMethod =
    service.service === BSKY_VIDEO_SERVICE &&
    method === 'app.bsky.video.uploadVideo'
      ? BSKY_VIDEO_UPLOAD_AUTH_METHOD
      : method;
  const tokenTtlSeconds =
    service.service === BSKY_VIDEO_SERVICE &&
    method === 'app.bsky.video.uploadVideo'
      ? BSKY_VIDEO_UPLOAD_TOKEN_TTL_SECONDS
      : SERVICE_AUTH_TOKEN_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const cacheKey = `${service.proxy}:${audience}:${serviceAuthMethod}`;
  const cached = serviceAuthTokenCache.get(cacheKey);

  if (cached && cached.expiresAt > now + 5) return cached.token;

  const expiresAt = now + tokenTtlSeconds;
  const query = new URLSearchParams({
    aud: audience,
    exp: String(expiresAt),
    lxm: serviceAuthMethod
  });
  let token: string | null = null;

  if (oauthSession) {
    const response = await oauthSession.fetchHandler(
      `/xrpc/com.atproto.server.getServiceAuth?${query.toString()}`,
      { method: 'GET' }
    );

    if (!response.ok)
      throwServiceError(service, await createResponseError(response));

    const body = (await response.json().catch(() => null)) as {
      token?: unknown;
    } | null;

    token = typeof body?.token === 'string' ? body.token : null;
  } else {
    try {
      token = (
        await getAgent().com.atproto.server.getServiceAuth({
          aud: audience,
          exp: expiresAt,
          lxm: serviceAuthMethod
        })
      ).data.token;
    } catch (error) {
      throwServiceError(service, error);
    }
  }

  if (!token)
    throwServiceError(service, new Error('Missing Bluesky service token'));

  serviceAuthTokenCache.set(cacheKey, { token, expiresAt });
  return token;
}

async function fetchServiceXrpc(
  service: BskyServiceConfig,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const path = getXrpcPath(url);
  const method = getXrpcMethod(path);
  const headers = new Headers(init.headers);

  if (!service.direct) {
    headers.set('atproto-proxy', service.proxy);
    headers.delete('authorization');

    return oauthSession
      ? oauthSession.fetchHandler(path, { ...init, headers })
      : getAgent().fetchHandler(path, { ...init, headers });
  }

  const token = await getServiceAuthToken(service, method);
  headers.set('authorization', `Bearer ${token}`);
  headers.delete('atproto-proxy');

  return fetch(new URL(path, service.url), { ...init, headers });
}

function createAuthenticatedServiceAgent(service: BskyServiceConfig): Agent {
  return new Agent({
    did: sessionDid ?? undefined,
    fetchHandler: (url: string, init: RequestInit) =>
      fetchServiceXrpc(service, url, init)
  });
}

function getPublicAppViewAgent(): Agent {
  if (!publicAppViewAgent)
    publicAppViewAgent = new Agent(PUBLIC_BSKY_APPVIEW_URL);

  return publicAppViewAgent;
}

function configureModerationLabelers(api: Agent): Agent {
  if (moderationLabelerDids.length)
    api.configureLabelers(moderationLabelerDids);

  return api;
}

function getAppViewAgent(): Agent {
  if (oauthSession)
    return configureModerationLabelers(
      createAuthenticatedServiceAgent(BSKY_APPVIEW_CONFIG)
    );

  if (!agent) return configureModerationLabelers(getPublicAppViewAgent());

  return configureModerationLabelers(
    getAgent().withProxy(BSKY_APPVIEW_SERVICE, BSKY_APPVIEW_DID)
  );
}

function getChatAgent(): Agent {
  if (oauthSession) return createAuthenticatedServiceAgent(BSKY_CHAT_CONFIG);

  return getAgent().withProxy(BSKY_CHAT_SERVICE, BSKY_CHAT_DID);
}

function getVideoAgent(): Agent {
  return new Agent(BSKY_VIDEO_URL);
}

function getErrorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' ? status : null;
}

function getUnknownErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecordNotFoundError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const message = getUnknownErrorMessage(error);

  return (status === 404 || /RecordNotFound|record not found|could not locate|not found/i.test(message));
}

function throwChatError(error: unknown): never {
  const status = getErrorStatus(error);
  const message = getUnknownErrorMessage(error);

  if (
    error instanceof ChatAccessError ||
    status === 401 ||
    status === 403 ||
    /auth|scope|permission|access/i.test(message)
  ) {
    throw new ChatAccessError(BSKY_CHAT_ACCESS_MESSAGE);
  }

  throw new Error(`Bluesky messages failed: ${message}`);
}

function safeDecodeScopeValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseRpcScope(
  scope: string
): { audiences: string[]; methods: string[] } | null {
  if (scope !== 'rpc' && !scope.startsWith('rpc:') && !scope.startsWith('rpc?'))
    return null;

  const [resource, queryString = ''] = scope.split('?', 2);
  const positionalMethod = resource.startsWith('rpc:')
    ? resource.slice('rpc:'.length)
    : null;
  const params = new URLSearchParams(queryString);
  const methods = params.getAll('lxm');
  const audiences = params.getAll('aud');

  if (positionalMethod) methods.unshift(positionalMethod);

  return {
    audiences: audiences.map(safeDecodeScopeValue),
    methods: methods.map(safeDecodeScopeValue)
  };
}

function hasRpcScopeForAudience(
  scopes: Set<string>,
  serviceDid: string,
  serviceId: string,
  method?: string
): boolean {
  const proxy = `${serviceDid}#${serviceId}`;

  return Array.from(scopes).some((scope) => {
    const rpcScope = parseRpcScope(scope);
    if (!rpcScope) return false;

    const hasAudience = rpcScope.audiences.some(
      (audience) =>
        audience === '*' || audience === serviceDid || audience === proxy
    );
    const hasMethod =
      !method ||
      rpcScope.methods.includes('*') ||
      rpcScope.methods.includes(method);

    return hasAudience && hasMethod;
  });
}

async function hasAppViewAccessScope(method?: string): Promise<boolean> {
  if (!oauthSession) return false;

  const tokenInfo = await oauthSession.getTokenInfo('auto');
  const scopes = new Set(tokenInfo.scope.split(/\s+/).filter(Boolean));

  return (
    scopes.has(GENERIC_SCOPE) ||
    hasRpcScopeForAudience(
      scopes,
      BSKY_APPVIEW_DID,
      BSKY_APPVIEW_SERVICE,
      method
    )
  );
}

async function ensureAppViewAccessScope(method?: string): Promise<void> {
  if (await hasAppViewAccessScope(method)) return;

  throw new Error(REFRESH_BSKY_LOGIN_MESSAGE);
}

export function isChatAccessError(error: unknown): boolean {
  return (
    error instanceof ChatAccessError ||
    (error instanceof Error && error.name === 'ChatAccessError')
  );
}

async function hasChatAccessScope(): Promise<boolean> {
  if (!oauthSession) return false;

  const tokenInfo = await oauthSession.getTokenInfo('auto');
  const scopes = new Set(tokenInfo.scope.split(/\s+/).filter(Boolean));
  const hasChatRpcScope = hasRpcScopeForAudience(
    scopes,
    BSKY_CHAT_DID,
    BSKY_CHAT_SERVICE
  );

  return (
    (scopes.has(GENERIC_SCOPE) && scopes.has(CHAT_SCOPE)) || hasChatRpcScope
  );
}

async function ensureChatAccessScope(): Promise<void> {
  try {
    if (await hasChatAccessScope()) return;
  } catch (error) {
    throwChatError(error);
  }

  throw new ChatAccessError(BSKY_CHAT_ACCESS_MESSAGE);
}

async function callChat<T>(request: () => Promise<T>): Promise<T> {
  await ensureChatAccessScope();

  try {
    return await request();
  } catch (error) {
    throwChatError(error);
  }
}

function normalizeChatAllowIncoming(value: unknown): ChatAllowIncoming {
  if (value === 'none' || value === 'following' || value === 'all')
    return value;

  return 'all';
}

function buildXrpcPath(
  method: string,
  params: Record<string, unknown> = {}
): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    appendXrpcQueryParam(query, key, value);
  });

  const queryString = query.toString();

  return `/xrpc/${method}${queryString ? `?${queryString}` : ''}`;
}

async function callServiceRawXrpc<T>(
  service: BskyServiceConfig,
  method: string,
  params: Record<string, unknown>,
  data: Record<string, unknown> | undefined,
  httpMethod: 'GET' | 'POST'
): Promise<T> {
  const headers = new Headers();

  if (data) headers.set('content-type', 'application/json');
  if (service.service === BSKY_APPVIEW_SERVICE && moderationLabelerDids.length)
    headers.set('atproto-accept-labelers', moderationLabelerDids.join(','));

  const response = await fetchServiceXrpc(
    service,
    buildXrpcPath(method, params),
    {
      method: httpMethod,
      cache:
        method === 'app.bsky.embed.getEmbedExternalView' ? 'no-cache' : undefined,
      headers,
      body: data ? JSON.stringify(data) : undefined
    }
  );

  if (!response.ok) {
    throwServiceError(service, await createResponseError(response));
  }

  if (response.status === 204) return undefined as unknown as T;

  return response.json().catch(() => undefined) as Promise<T>;
}

async function callChatXrpc<T>(
  method: string,
  data: Record<string, unknown>
): Promise<T> {
  await ensureChatAccessScope();

  try {
    return await callServiceRawXrpc<T>(
      BSKY_CHAT_CONFIG,
      method,
      {},
      data,
      'POST'
    );
  } catch (error) {
    throwChatError(error);
  }
}

async function callChatQueryXrpc<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  await ensureChatAccessScope();

  try {
    return await callServiceRawXrpc<T>(
      BSKY_CHAT_CONFIG,
      method,
      params,
      undefined,
      'GET'
    );
  } catch (error) {
    throwChatError(error);
  }
}

async function readXrpcError(response: Response): Promise<string> {
  const fallbackMessage = response.statusText || `HTTP ${response.status}`;

  return response
    .json()
    .then((body) => getXrpcErrorMessage(body, fallbackMessage))
    .catch(() => fallbackMessage);
}

function getXrpcErrorMessage(body: unknown, fallbackMessage: string): string {
  if (!isPlainObject(body)) return fallbackMessage;

  return (
    [body.error, body.message]
      .filter((value): value is string => typeof value === 'string')
      .join(': ') || fallbackMessage
  );
}

function appendXrpcQueryParam(
  query: URLSearchParams,
  key: string,
  value: unknown
): void {
  if (value === undefined || value === null) return;

  if (Array.isArray(value)) {
    value.forEach((item) => appendXrpcQueryParam(query, key, item));
    return;
  }

  query.append(key, String(value));
}

async function callAppXrpc<T>(
  method: string,
  data: Record<string, unknown>
): Promise<T> {
  return callServiceRawXrpc<T>(BSKY_APPVIEW_CONFIG, method, {}, data, 'POST');
}

async function callAppQueryXrpc<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  return callServiceRawXrpc<T>(
    BSKY_APPVIEW_CONFIG,
    method,
    params,
    undefined,
    'GET'
  );
}

async function callRawAppViewQueryXrpc<T>(
  baseUrl: string,
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    appendXrpcQueryParam(query, key, value);
  });

  const queryString = query.toString();
  const headers = new Headers();

  if (moderationLabelerDids.length)
    headers.set('atproto-accept-labelers', moderationLabelerDids.join(','));

  const response = await fetch(
    `${baseUrl}/xrpc/${method}${queryString ? `?${queryString}` : ''}`,
    {
      headers,
      cache:
        method === 'app.bsky.embed.getEmbedExternalView' ? 'no-cache' : undefined
    }
  );

  if (!response.ok) {
    const fallbackMessage = response.statusText || `HTTP ${response.status}`;
    const error = new Error(
      (await readXrpcError(response)) || fallbackMessage
    ) as Error & {
      status?: number;
    };

    error.status = response.status;
    throw error;
  }

  return (await response.json()) as T;
}

async function callDirectAppQueryXrpc<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  return callRawAppViewQueryXrpc<T>(BSKY_APPVIEW_URL, method, params);
}

async function callPublicAppQueryXrpc<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  return callRawAppViewQueryXrpc<T>(PUBLIC_BSKY_APPVIEW_URL, method, params);
}

async function callPublicFallbackAppQueryXrpc<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  if (!PUBLIC_BSKY_APPVIEW_METHODS.has(method))
    return callAppQueryXrpc<T>(method, params);

  let directError: unknown = null;
  let proxyError: unknown = null;

  if (sessionDid || agent) {
    try {
      return await callAppQueryXrpc<T>(method, params);
    } catch (error) {
      proxyError = error;
    }
  }

  try {
    return await callDirectAppQueryXrpc<T>(method, params);
  } catch (error) {
    directError = error;
  }

  try {
    return await callAppQueryXrpc<T>(method, params);
  } catch (error) {
    proxyError = error;
    try {
      return await callPublicAppQueryXrpc<T>(method, params);
    } catch {
      throw proxyError instanceof Error
        ? proxyError
        : directError instanceof Error
        ? directError
        : new Error('Bluesky request failed.');
    }
  }
}

function clampAppViewLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), 100);
}

async function fetchAppViewFeed(
  feed: string,
  cursor?: string,
  limit = 30
): Promise<AppViewFeedResponse> {
  await getSafeModerationOpts();

  return callPublicFallbackAppQueryXrpc<AppViewFeedResponse>(
    'app.bsky.feed.getFeed',
    {
      feed,
      cursor,
      limit: clampAppViewLimit(limit)
    }
  );
}

async function fetchAppViewTimeline(
  cursor?: string,
  limit = 30
): Promise<AppViewFeedResponse> {
  await getSafeModerationOpts();
  await ensureAppViewAccessScope('app.bsky.feed.getTimeline');

  return callAppQueryXrpc<AppViewFeedResponse>('app.bsky.feed.getTimeline', {
    cursor,
    limit: clampAppViewLimit(limit)
  });
}

async function fetchAppViewPosts(
  uris: string[]
): Promise<AppViewPostsResponse> {
  await getSafeModerationOpts();

  return callPublicFallbackAppQueryXrpc<AppViewPostsResponse>(
    'app.bsky.feed.getPosts',
    {
      uris
    }
  );
}

async function fetchAppViewSearchPosts(
  params: Record<string, unknown>
): Promise<AppViewSearchPostsResponse> {
  await getSafeModerationOpts();

  return callAppQueryXrpc<AppViewSearchPostsResponse>(
    'app.bsky.feed.searchPosts',
    params
  );
}

function isTemporaryFeedUnavailableError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const message = getUnknownErrorMessage(error);

  return ((typeof status === 'number' && status >= 500 && status < 600) || /Bad Gateway|Gateway Timeout|InternalServerError|Service Unavailable|Upstream server responded/i.test(
    message
  ));
}

type SettingsContentLabelConfig = {
  label: SettingsContentLabel;
  defaultPreference: SettingsLabelPreference;
  labelerDid?: string;
};

const SETTINGS_CONTENT_LABELS: readonly SettingsContentLabelConfig[] = [
  { label: 'porn', defaultPreference: 'hide' },
  { label: 'sexual', defaultPreference: 'warn' },
  { label: 'nudity', defaultPreference: 'ignore' },
  {
    label: 'sexual-figurative',
    defaultPreference: 'ignore',
    labelerDid: BSKY_MODERATION_DID
  },
  { label: 'graphic-media', defaultPreference: 'warn' },
  {
    label: 'self-harm',
    defaultPreference: 'warn',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'sensitive',
    defaultPreference: 'warn',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'extremist',
    defaultPreference: 'hide',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'intolerant',
    defaultPreference: 'warn',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'threat',
    defaultPreference: 'hide',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'rude',
    defaultPreference: 'hide',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'illicit',
    defaultPreference: 'hide',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'security',
    defaultPreference: 'hide',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'unsafe-link',
    defaultPreference: 'hide',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'impersonation',
    defaultPreference: 'hide',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'misinformation',
    defaultPreference: 'warn',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'scam',
    defaultPreference: 'hide',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'engagement-farming',
    defaultPreference: 'hide',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'spam',
    defaultPreference: 'hide',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'rumor',
    defaultPreference: 'warn',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'misleading',
    defaultPreference: 'warn',
    labelerDid: BSKY_MODERATION_DID
  },
  {
    label: 'inauthentic',
    defaultPreference: 'hide',
    labelerDid: BSKY_MODERATION_DID
  }
];

const SETTINGS_CONTENT_LABEL_BY_VALUE = new Map<
  SettingsContentLabel,
  SettingsContentLabelConfig
>();

SETTINGS_CONTENT_LABELS.forEach((config) => {
  SETTINGS_CONTENT_LABEL_BY_VALUE.set(config.label, config);
});

const NOTIFICATION_KEYS: SettingsNotificationKey[] = [
  'chat',
  'follow',
  'like',
  'likeViaRepost',
  'mention',
  'quote',
  'reply',
  'repost',
  'repostViaRepost',
  'starterpackJoined',
  'subscribedPost',
  'unverified',
  'verified'
];

const FILTERABLE_NOTIFICATION_KEYS = new Set<SettingsNotificationKey>([
  'follow',
  'like',
  'likeViaRepost',
  'mention',
  'quote',
  'reply',
  'repost',
  'repostViaRepost'
]);

const DEFAULT_NOTIFICATION_PREFERENCES: SettingsNotificationPreferences = {
  chat: { include: 'all', list: true, push: true },
  follow: { include: 'all', list: true, push: true },
  like: { include: 'all', list: true, push: true },
  likeViaRepost: { include: 'all', list: true, push: true },
  mention: { include: 'all', list: true, push: true },
  quote: { include: 'all', list: true, push: true },
  reply: { include: 'all', list: true, push: true },
  repost: { include: 'all', list: true, push: true },
  repostViaRepost: { include: 'all', list: true, push: true },
  starterpackJoined: { list: true, push: true },
  subscribedPost: { list: true, push: true },
  unverified: { list: true, push: true },
  verified: { list: true, push: true }
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasJsonRepresentation(
  value: unknown
): value is { toJSON: () => unknown } {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { toJSON?: unknown }).toJSON === 'function'
  );
}

function isLikelyCidString(value: string): boolean {
  return value.length > 10 && /^[a-z0-9]+$/i.test(value);
}

function getBlobRefCidString(ref: unknown): string | null {
  if (typeof ref === 'string' && isLikelyCidString(ref)) return ref;

  if (isPlainObject(ref)) {
    const link = ref.$link ?? ref['/'];
    if (typeof link === 'string' && isLikelyCidString(link)) return link;
  }

  const toString = (ref as { toString?: unknown })?.toString;
  if (typeof toString === 'function') {
    const value: unknown = toString.call(ref);
    if (typeof value === 'string' && isLikelyCidString(value)) return value;
  }

  return null;
}

function normalizeJsonBlobRef(blob: unknown): unknown {
  const value = hasJsonRepresentation(blob) ? blob.toJSON() : blob;

  if (!isPlainObject(value) || value.$type !== 'blob') return value;

  const cid = getBlobRefCidString(value.ref);
  if (!cid || (isPlainObject(value.ref) && value.ref.$link === cid))
    return value;

  return {
    ...value,
    ref: { $link: cid }
  };
}

function asStrictBlobRef(blob: StrictBlobRef): StrictBlobRef {
  return blob as StrictBlobRef;
}

function parseBlobRef(blob: unknown): StrictBlobRef {
  if (blob instanceof BlobRef) {
    const normalizedBlob = jsonToLex(normalizeJsonBlobRef(blob) as JsonValue);

    if (normalizedBlob instanceof BlobRef)
      return asStrictBlobRef(normalizedBlob);

    return asStrictBlobRef(blob);
  }

  const parsedBlob = jsonToLex(normalizeJsonBlobRef(blob) as JsonValue);

  if (parsedBlob instanceof BlobRef) return asStrictBlobRef(parsedBlob);

  throw new Error('Bluesky did not return a valid media blob.');
}

function getBlobRefSize(blob: StrictBlobRef): number | null {
  return Number.isFinite(blob.size) && blob.size > 0 ? blob.size : null;
}

function getResolvedBlobRefSize(
  blob: StrictBlobRef,
  sizeOverride?: number
): number {
  const size =
    typeof sizeOverride === 'number' && sizeOverride > 0
      ? sizeOverride
      : getBlobRefSize(blob);

  if (!size)
    throw new Error('Bluesky returned a media blob without a valid size.');

  return size;
}

function toRepoRecordBlobRef(
  blob: unknown,
  sizeOverride?: number
): StrictBlobRef {
  const parsedBlob = parseBlobRef(blob);
  const size = getResolvedBlobRefSize(parsedBlob, sizeOverride);

  if (parsedBlob.size === size) return parsedBlob;

  return new BlobRef(parsedBlob.ref, parsedBlob.mimeType, size);
}

function isSerializedCidObject(value: unknown): boolean {
  if (!isPlainObject(value)) return false;

  return (
    typeof value.$link !== 'string' &&
    typeof value.code === 'number' &&
    typeof value.version === 'number' &&
    (isPlainObject(value.hash) || value.hash instanceof Uint8Array)
  );
}

function isMalformedImageBlob(value: unknown): boolean {
  if (!isPlainObject(value)) return false;

  return value.$type === 'blob' && isSerializedCidObject(value.ref);
}

function embedHasMalformedImageBlob(embed: unknown): boolean {
  if (!isPlainObject(embed)) return false;

  if (
    embed.$type === 'app.bsky.embed.recordWithMedia' &&
    embedHasMalformedImageBlob(embed.media)
  )
    return true;

  if (
    embed.$type === 'app.bsky.embed.gallery' &&
    Array.isArray(embed.items)
  ) {
    return embed.items.some(
      (image) =>
        isPlainObject(image) &&
        isMalformedImageBlob((image as { image?: unknown }).image)
    );
  }

  if (embed.$type !== 'app.bsky.embed.images' || !Array.isArray(embed.images))
    return false;

  return embed.images.some(
    (image) => isPlainObject(image) && isMalformedImageBlob(image.image)
  );
}

function recordHasMalformedImageBlob(record: unknown): boolean {
  return isPlainObject(record) && embedHasMalformedImageBlob(record.embed);
}

async function repairMalformedOwnImagePosts(api: Agent): Promise<void> {
  if (!sessionDid || malformedMediaRepairPromise) {
    await malformedMediaRepairPromise;
    return;
  }

  malformedMediaRepairPromise = (async (): Promise<void> => {
    let cursor: string | undefined;
    let checkedRecords = 0;
    let deletedRecords = 0;

    do {
      const response = await api.com.atproto.repo.listRecords({
        repo: sessionDid as string,
        collection: 'app.bsky.feed.post',
        limit: 100,
        cursor
      });

      for (const record of response.data.records) {
        checkedRecords += 1;
        if (!recordHasMalformedImageBlob(record.value)) continue;

        const rkey = getRkeyFromAtUri(record.uri);
        if (!rkey) continue;

        await api.com.atproto.repo.deleteRecord({
          repo: sessionDid as string,
          collection: 'app.bsky.feed.post',
          rkey
        });
        deletedRecords += 1;
      }

      cursor = response.data.cursor;
    } while (cursor && checkedRecords < 500);

    if (deletedRecords > 0) notify();
  })().finally(() => {
    malformedMediaRepairPromise = null;
  });

  await malformedMediaRepairPromise;
}

function getPostRefFromValue(value: unknown): PostRef | null {
  if (!isPlainObject(value)) return null;

  const { uri, cid } = value;
  return typeof uri === 'string' && typeof cid === 'string'
    ? { uri, cid }
    : null;
}

function getReplyRefFromRecord(record: unknown): PostReplyRef | null {
  if (!isPlainObject(record) || !isPlainObject(record.reply)) return null;

  const root = getPostRefFromValue(record.reply.root);
  const parent = getPostRefFromValue(record.reply.parent);

  return root && parent ? { root, parent } : null;
}

function cachePostReplyRef(id: string, record: unknown): void {
  const replyRef = getReplyRefFromRecord(record);
  if (replyRef) postReplyRefCache.set(id, replyRef);
}

function getLocalProfileOverride(data: Partial<User>): Partial<User> {
  const override: Partial<User> = {};

  if ('theme' in data) override.theme = data.theme ?? null;
  if ('accent' in data) override.accent = data.accent ?? null;

  return override;
}

function isUsableLocalProfileImageUrl(
  value: string | null | undefined
): boolean {
  return !!value && !value.startsWith('blob:');
}

function getProfileBlobExtension(blob: StrictBlobRef): string {
  if (blob.mimeType === 'image/png') return 'png';
  if (blob.mimeType === 'image/gif') return 'gif';

  return 'jpeg';
}

function getProfileMediaCdnUrl(
  userId: string,
  type: 'avatar' | 'banner',
  blob: StrictBlobRef | null | undefined
): string | undefined {
  if (!blob) return undefined;

  try {
    const parsedBlob = parseBlobRef(blob);
    const cid = encodeURIComponent(String(parsedBlob.ref));
    const extension = getProfileBlobExtension(parsedBlob);

    return (
      `https://cdn.bsky.app/img/${type}/plain/` +
      `${userId}/${cid}@${extension}`
    );
  } catch {
    return undefined;
  }
}

async function getLiveProfileRecord(
  api: Agent,
  userId: string
): Promise<Partial<AppBskyActorProfile.Record> | null> {
  try {
    const response = await api.com.atproto.repo.getRecord({
      repo: userId,
      collection: 'app.bsky.actor.profile',
      rkey: 'self'
    });

    return isPlainObject(response.data.value)
      ? (response.data.value as Partial<AppBskyActorProfile.Record>)
      : null;
  } catch (error) {
    if (isRecordNotFoundError(error)) return null;
    throw error;
  }
}

function getDidWebDocumentUrl(did: string): string | null {
  if (!did.startsWith('did:web:')) return null;

  const parts = did
    .slice('did:web:'.length)
    .split(':')
    .map((part) => decodeURIComponent(part));
  const host = parts.shift();

  if (!host) return null;

  const path = parts.length
    ? `/${parts.join('/')}/did.json`
    : '/.well-known/did.json';

  return `https://${host}${path}`;
}

function getAtprotoPdsEndpointFromDidDocument(value: unknown): string | null {
  if (!isPlainObject(value) || !Array.isArray(value.service)) return null;

  for (const service of value.service) {
    if (!isPlainObject(service)) continue;

    const type = service.type;
    const id = service.id;
    const endpoint = service.serviceEndpoint;
    const isAtprotoPds =
      type === 'AtprotoPersonalDataServer' ||
      (typeof id === 'string' && id.endsWith('#atproto_pds'));

    if (isAtprotoPds && typeof endpoint === 'string')
      return normalizeAtprotoServiceUrl(endpoint);
  }

  return null;
}

async function resolveAtprotoPdsEndpoint(did: string): Promise<string | null> {
  if (didPdsEndpointCache.has(did)) return didPdsEndpointCache.get(did) ?? null;

  const documentUrl = did.startsWith('did:plc:')
    ? `https://plc.directory/${encodeURIComponent(did)}`
    : getDidWebDocumentUrl(did);

  if (!documentUrl) {
    didPdsEndpointCache.set(did, null);
    return null;
  }

  const response = await fetch(documentUrl, {
    cache: 'force-cache',
    redirect: 'error'
  });

  if (!response.ok) {
    didPdsEndpointCache.set(did, null);
    return null;
  }

  const endpoint = getAtprotoPdsEndpointFromDidDocument(
    await response.json().catch(() => null)
  );

  didPdsEndpointCache.set(did, endpoint);
  return endpoint;
}

async function getPublicProfileRecord(
  userId: string
): Promise<Partial<AppBskyActorProfile.Record> | null> {
  const serviceUrl = await resolveAtprotoPdsEndpoint(userId);

  if (!serviceUrl) return null;

  const url = new URL('/xrpc/com.atproto.repo.getRecord', serviceUrl);

  url.searchParams.set('repo', userId);
  url.searchParams.set('collection', 'app.bsky.actor.profile');
  url.searchParams.set('rkey', 'self');

  const response = await fetch(url, { cache: 'no-cache' });

  if (response.status === 404) return null;
  if (!response.ok) throw await createResponseError(response);

  const body = (await response.json().catch(() => null)) as {
    value?: unknown;
  } | null;
  const value = body?.value;

  return isPlainObject(value)
    ? (value as Partial<AppBskyActorProfile.Record>)
    : null;
}

async function getLiveChatDeclarationRecord(
  api: Agent,
  userId: string
): Promise<Partial<ChatBskyActorDeclaration.Record> | null> {
  try {
    const response = await api.com.atproto.repo.getRecord({
      repo: userId,
      collection: CHAT_DECLARATION_COLLECTION,
      rkey: 'self'
    });

    return isPlainObject(response.data.value)
      ? (response.data.value as Partial<ChatBskyActorDeclaration.Record>)
      : null;
  } catch (error) {
    if (isRecordNotFoundError(error)) return null;
    throw error;
  }
}

async function getPublicChatDeclarationRecord(
  userId: string
): Promise<Partial<ChatBskyActorDeclaration.Record> | null> {
  const serviceUrl = await resolveAtprotoPdsEndpoint(userId);

  if (!serviceUrl) return null;

  const url = new URL('/xrpc/com.atproto.repo.getRecord', serviceUrl);

  url.searchParams.set('repo', userId);
  url.searchParams.set('collection', CHAT_DECLARATION_COLLECTION);
  url.searchParams.set('rkey', 'self');

  const response = await fetch(url, { cache: 'no-cache' });

  if (response.status === 404) return null;
  if (!response.ok) throw await createResponseError(response);

  const body = (await response.json().catch(() => null)) as {
    value?: unknown;
  } | null;
  const value = body?.value;

  return isPlainObject(value)
    ? (value as Partial<ChatBskyActorDeclaration.Record>)
    : null;
}

async function getReadableProfileRecord(
  userId: string
): Promise<Partial<AppBskyActorProfile.Record> | null> {
  if (agent) {
    const liveRecord = await getLiveProfileRecord(getAgent(), userId).catch(
      () => null
    );

    if (liveRecord) return liveRecord;
  }

  return getPublicProfileRecord(userId);
}

async function getReadableChatDeclarationRecord(
  userId: string
): Promise<Partial<ChatBskyActorDeclaration.Record> | null> {
  if (agent) {
    const liveRecord = await getLiveChatDeclarationRecord(
      getAgent(),
      userId
    ).catch(() => null);

    if (liveRecord) return liveRecord;
  }

  return getPublicChatDeclarationRecord(userId);
}

function applyProfileRecordUserData(
  userId: string,
  record: Partial<AppBskyActorProfile.Record>
): void {
  applyLocalProfileUpdate(userId, getProfileRecordUserData(userId, record));
  profileRecordHydratedUsers.add(userId);
}

async function hydrateProfileRecordUserData(userId: string): Promise<void> {
  if (profileRecordHydratedUsers.has(userId)) return;

  const record = await getReadableProfileRecord(userId);

  if (record) applyProfileRecordUserData(userId, record);
  else profileRecordHydratedUsers.add(userId);
}

function applyChatDeclarationUserData(
  userId: string,
  record: Partial<ChatBskyActorDeclaration.Record> | null
): void {
  applyLocalProfileUpdate(userId, {
    messageAllowIncoming: normalizeChatAllowIncoming(record?.allowIncoming)
  });
  chatDeclarationHydratedUsers.add(userId);
}

async function hydrateChatDeclarationUserData(userId: string): Promise<void> {
  if (chatDeclarationHydratedUsers.has(userId)) return;

  const record = await getReadableChatDeclarationRecord(userId);

  applyChatDeclarationUserData(userId, record);
}

function getProfileRecordUserData(
  userId: string,
  record: Partial<AppBskyActorProfile.Record>
): Partial<User> {
  const avatarUrl = getProfileMediaCdnUrl(userId, 'avatar', record.avatar);
  const bannerUrl = getProfileMediaCdnUrl(userId, 'banner', record.banner);
  const fallbackName =
    userCache.get(userId)?.username ?? currentUser?.username ?? '';

  return {
    name:
      typeof record.displayName === 'string' && record.displayName
        ? record.displayName
        : fallbackName,
    bio:
      typeof record.description === 'string' && record.description
        ? record.description
        : null,
    pronouns:
      typeof record.pronouns === 'string' && record.pronouns
        ? record.pronouns
        : null,
    birthday: normalizeProfileBirthday(record.birthday),
    website:
      typeof record.website === 'string' && record.website
        ? record.website
        : null,
    photoURL: avatarUrl ?? DEFAULT_PROFILE_PHOTO_URL,
    coverPhotoURL: bannerUrl ?? DEFAULT_PROFILE_COVER_URL
  };
}

function invalidateUserProfileCache(userId: string): void {
  const cachedUser = userCache.get(userId);

  userCache.delete(userId);
  detailedUserCache.delete(userId);
  profileRecordHydratedUsers.delete(userId);
  chatDeclarationHydratedUsers.delete(userId);

  if (cachedUser) {
    userHandleCache.delete(cachedUser.username);
  }

  userHandleCache.forEach((user, username) => {
    if (user.id === userId) userHandleCache.delete(username);
  });
}

function applyLocalProfileUpdate(
  userId: string,
  data: Partial<User>,
  mediaUrls: LocalProfileMediaUrls = {}
): void {
  const cachedUser = userCache.get(userId);
  const targetUser = currentUser?.id === userId ? currentUser : cachedUser;

  if (!targetUser) return;

  if ('name' in data) targetUser.name = data.name ?? '';
  if ('bio' in data) targetUser.bio = data.bio ? data.bio : null;
  if ('pronouns' in data)
    targetUser.pronouns = data.pronouns ? data.pronouns : null;
  if ('birthday' in data)
    targetUser.birthday = normalizeProfileBirthday(data.birthday);
  if ('messageAllowIncoming' in data)
    targetUser.messageAllowIncoming = data.messageAllowIncoming ?? null;
  if ('website' in data) targetUser.website = data.website ?? null;
  if ('photoURL' in data) {
    if (mediaUrls.photoURL) targetUser.photoURL = mediaUrls.photoURL;
    else if (isUsableLocalProfileImageUrl(data.photoURL))
      targetUser.photoURL = data.photoURL as string;
  }
  if ('coverPhotoURL' in data) {
    if (data.coverPhotoURL === null)
      targetUser.coverPhotoURL = DEFAULT_PROFILE_COVER_URL;
    else if (mediaUrls.coverPhotoURL)
      targetUser.coverPhotoURL = mediaUrls.coverPhotoURL;
    else if (isUsableLocalProfileImageUrl(data.coverPhotoURL))
      targetUser.coverPhotoURL = data.coverPhotoURL as string;
  }

  targetUser.updatedAt = Timestamp.now();
  userCache.set(targetUser.id, targetUser);
  userHandleCache.set(targetUser.username, targetUser);
  detailedUserCache.add(targetUser.id);

  if (currentUser?.id === userId) currentUser = targetUser;
}

function getImageAspectRatio(
  width: number,
  height: number
): PreparedImageUpload['aspectRatio'] {
  return width > 0 && height > 0
    ? {
        width: Math.round(width),
        height: Math.round(height)
      }
    : undefined;
}

function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const image = new Image();

    image.onload = (): void => {
      URL.revokeObjectURL(src);
      resolve(image);
    };

    image.onerror = (): void => {
      URL.revokeObjectURL(src);
      reject(new Error('Unable to load image.'));
    };

    image.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encodeCanvasImage(
  canvas: HTMLCanvasElement,
  targetBytes = BSKY_POST_IMAGE_TARGET_BYTES,
  mimeTypes: readonly string[] = ['image/webp', 'image/jpeg']
): Promise<Blob> {
  let fallbackBlob: Blob | null = null;
  const qualities = [0.92, 0.84, 0.76, 0.68, 0.6];

  for (const quality of qualities) {
    for (const mimeType of mimeTypes) {
      const blob = await canvasToBlob(canvas, mimeType, quality);

      if (!blob) continue;

      fallbackBlob = blob;
      if (blob.size <= targetBytes) return blob;
    }
  }

  if (fallbackBlob) return fallbackBlob;

  throw new Error('Unable to prepare image for Bluesky.');
}

function drawImageToCanvas(
  image: HTMLImageElement,
  outputMimeTypes: readonly string[]
): HTMLCanvasElement {
  const scale = Math.min(
    1,
    BSKY_IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const canvas = document.createElement('canvas');
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) throw new Error('Unable to prepare image for Bluesky.');

  if (outputMimeTypes.includes(BSKY_PROFILE_IMAGE_MIME_TYPE)) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, 0, 0, width, height);

  return canvas;
}

async function prepareImageForBluesky(
  file: File,
  options?: {
    acceptedTypes?: RegExp;
    outputMimeTypes?: readonly string[];
    maxBytes?: number;
    targetBytes?: number;
  }
): Promise<PreparedImageUpload> {
  const {
    acceptedTypes = BSKY_POST_IMAGE_ACCEPTED_TYPES,
    outputMimeTypes = ['image/webp', 'image/jpeg'],
    maxBytes = BSKY_POST_IMAGE_MAX_BYTES,
    targetBytes = BSKY_POST_IMAGE_TARGET_BYTES
  } = options ?? {};
  const image = await loadImageElement(file);
  const originalAspectRatio = getImageAspectRatio(
    image.naturalWidth,
    image.naturalHeight
  );

  if (file.size <= maxBytes && acceptedTypes.test(file.type)) {
    return {
      file,
      encoding: file.type || 'image/jpeg',
      aspectRatio: originalAspectRatio
    };
  }

  const canvas = drawImageToCanvas(image, outputMimeTypes);
  let blob = await encodeCanvasImage(canvas, targetBytes, outputMimeTypes);

  while (blob.size > maxBytes && canvas.width > 640 && canvas.height > 640) {
    const nextWidth = Math.max(1, Math.round(canvas.width * 0.82));
    const nextHeight = Math.max(1, Math.round(canvas.height * 0.82));
    const nextCanvas = document.createElement('canvas');

    nextCanvas.width = nextWidth;
    nextCanvas.height = nextHeight;

    const nextContext = nextCanvas.getContext('2d');

    if (!nextContext) break;

    nextContext.drawImage(canvas, 0, 0, nextWidth, nextHeight);
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    const resizedContext = canvas.getContext('2d');

    if (!resizedContext) break;

    if (outputMimeTypes.includes(BSKY_PROFILE_IMAGE_MIME_TYPE)) {
      resizedContext.fillStyle = '#ffffff';
      resizedContext.fillRect(0, 0, nextWidth, nextHeight);
    }

    resizedContext.drawImage(nextCanvas, 0, 0);

    blob = await encodeCanvasImage(canvas, targetBytes, outputMimeTypes);
  }

  if (blob.size > maxBytes) {
    throw new Error('Image is too large for Bluesky.');
  }

  return {
    file: blob,
    encoding: blob.type || 'image/jpeg',
    aspectRatio: getImageAspectRatio(canvas.width, canvas.height)
  };
}

function prepareProfileImageForBluesky(
  file: File
): Promise<PreparedImageUpload> {
  return prepareImageForBluesky(file, {
    acceptedTypes: BSKY_PROFILE_IMAGE_ACCEPTED_TYPES,
    outputMimeTypes: [BSKY_PROFILE_IMAGE_MIME_TYPE],
    maxBytes: BSKY_PROFILE_IMAGE_MAX_BYTES,
    targetBytes: BSKY_PROFILE_IMAGE_TARGET_BYTES
  });
}

function normalizeSettingsLabelPreference(
  value: unknown
): SettingsLabelPreference {
  if (value === 'hide' || value === 'warn' || value === 'ignore') return value;
  if (value === 'show') return 'ignore';

  return 'warn';
}

function getSettingsContentLabelConfig(
  label: SettingsContentLabel
): SettingsContentLabelConfig {
  const config = SETTINGS_CONTENT_LABEL_BY_VALUE.get(label);

  if (!config) throw new Error('Unsupported content label.');

  return config;
}

function getSettingsContentLabelPreference(
  moderationPrefs: ModerationOpts['prefs'],
  config: SettingsContentLabelConfig
): SettingsLabelPreference {
  const sourceLabels = config.labelerDid
    ? moderationPrefs.labelers.find(({ did }) => did === config.labelerDid)
        ?.labels
    : moderationPrefs.labels;

  return normalizeSettingsLabelPreference(
    sourceLabels?.[config.label] ?? config.defaultPreference
  );
}

function normalizeMutedWordTarget(
  value: unknown
): SettingsMutedWordTarget | null {
  if (value === 'content' || value === 'tag') return value;

  return null;
}

function normalizeMutedWordActorTarget(
  value: unknown
): SettingsMutedWordActorTarget {
  if (value === 'exclude-following') return value;

  return 'all';
}

function normalizeMutedWord(
  word: AppBskyActorDefs.MutedWord
): SettingsMutedWord {
  const targets = word.targets
    .map(normalizeMutedWordTarget)
    .filter((target): target is SettingsMutedWordTarget => !!target);

  return {
    id: word.id,
    value: word.value,
    targets,
    actorTarget: normalizeMutedWordActorTarget(word.actorTarget),
    expiresAt: word.expiresAt
  };
}

function normalizeNotificationInclude(
  value: unknown,
  fallback: SettingsNotificationInclude
): SettingsNotificationInclude {
  if (value === 'all' || value === 'follows' || value === 'accepted')
    return value;

  return fallback;
}

function normalizeNotificationPreference(
  key: SettingsNotificationKey,
  value: unknown
): SettingsNotificationPreference {
  const fallback = DEFAULT_NOTIFICATION_PREFERENCES[key];
  if (!isPlainObject(value)) return fallback;

  const next: SettingsNotificationPreference = {
    list: typeof value.list === 'boolean' ? value.list : fallback.list,
    push: typeof value.push === 'boolean' ? value.push : fallback.push
  };

  if (key === 'chat') {
    next.include = normalizeNotificationInclude(
      value.include,
      fallback.include ?? 'all'
    ) as 'all' | 'accepted';
  } else if (FILTERABLE_NOTIFICATION_KEYS.has(key)) {
    const include = normalizeNotificationInclude(
      value.include,
      fallback.include ?? 'all'
    );
    next.include = include === 'accepted' ? 'all' : include;
  }

  return next;
}

function normalizeNotificationPreferences(
  value: unknown
): SettingsNotificationPreferences {
  const source = isPlainObject(value) ? value : {};

  return NOTIFICATION_KEYS.reduce<SettingsNotificationPreferences>(
    (prefs, key) => ({
      ...prefs,
      [key]: normalizeNotificationPreference(key, source[key])
    }),
    { ...DEFAULT_NOTIFICATION_PREFERENCES }
  );
}

async function loadModerationOpts(): Promise<ModerationOpts | null> {
  if (!sessionDid) return null;

  const userDid = sessionDid;
  const prefs = await getAgent().getPreferences();

  moderationLabelerDids =
    prefs.moderationPrefs.labelers?.map(({ did }) => did) ?? [];

  const labelDefs = await getAppViewAgent()
    .getLabelDefinitions(prefs)
    .catch(() => undefined);

  const opts = {
    userDid,
    prefs: prefs.moderationPrefs,
    labelDefs
  };

  activeModerationOpts = opts;

  return opts;
}

function getModerationOpts(): Promise<ModerationOpts | null> {
  if (!moderationOptsPromise) {
    moderationOptsPromise = loadModerationOpts().catch((error) => {
      moderationOptsPromise = null;
      throw error;
    });
  }

  return moderationOptsPromise;
}

async function getSafeModerationOpts(): Promise<ModerationOpts | null> {
  try {
    const opts = await getModerationOpts();
    activeModerationOpts = opts;
    return opts;
  } catch {
    activeModerationOpts = null;
    return null;
  }
}

type LabelModerationCause = Extract<ModerationCause, { type: 'label' }>;

type ContentListModerationCause = Extract<
  ModerationCause,
  {
    type:
      | 'blocking'
      | 'blocked-by'
      | 'block-other'
      | 'muted'
      | 'mute-word'
      | 'hidden'
      | 'label';
  }
>;

const MEDIA_WARNING_LABEL_FALLBACKS: Partial<
  Record<SettingsContentLabel, string>
> = {
  porn: 'Adult content',
  sexual: 'Sexually suggestive',
  nudity: 'Non-sexual nudity',
  'sexual-figurative': 'Sexually suggestive',
  'graphic-media': 'Graphic media',
  'self-harm': 'Self-harm',
  sensitive: 'Sensitive content',
  extremist: 'Extremist content',
  intolerant: 'Intolerance',
  threat: 'Threats',
  rude: 'Rude content',
  illicit: 'Illicit content',
  security: 'Security concerns',
  'unsafe-link': 'Unsafe link',
  impersonation: 'Impersonation',
  misinformation: 'Misinformation',
  scam: 'Scam',
  'engagement-farming': 'Engagement farming',
  spam: 'Spam',
  rumor: 'Unconfirmed claim',
  misleading: 'Misleading',
  inauthentic: 'Inauthentic account'
};

function isLabelModerationCause(cause: unknown): cause is LabelModerationCause {
  return (
    isPlainObject(cause) &&
    cause.type === 'label' &&
    isPlainObject(cause.label) &&
    typeof cause.label.val === 'string' &&
    isPlainObject(cause.labelDef)
  );
}

function getModerationCauseLabelName(cause: LabelModerationCause): string {
  const labelName = cause.labelDef.locales?.find(
    ({ lang, name }) => lang === 'en' && !!name
  )?.name;
  const fallback =
    MEDIA_WARNING_LABEL_FALLBACKS[cause.label.val as SettingsContentLabel] ??
    cause.label.val;

  return labelName ?? fallback;
}

function getModerationWarningDescription(noOverride: boolean): string {
  if (noOverride)
    return 'This media is not available because it includes content limited by Bluesky.';

  return 'The Tweet author flagged this Tweet as showing sensitive content.';
}

function isMediaOnlyContentLabelCause(cause: unknown): boolean {
  if (!isLabelModerationCause(cause)) return false;
  if (cause.target !== 'content') return false;

  const contentBehavior = cause.labelDef.behaviors?.content;

  return (
    contentBehavior?.contentMedia === 'blur' &&
    !contentBehavior.contentList &&
    !contentBehavior.contentView
  );
}

const ADULT_TOMBSTONE_LABELS = new Set<string>([
  'porn',
  'sexual',
  'nudity',
  'sexual-figurative'
]);

const RULE_VIOLATION_TOMBSTONE_LABELS = new Set<string>([
  'extremist',
  'intolerant',
  'threat',
  'illicit',
  'security',
  'unsafe-link',
  'impersonation',
  'misinformation',
  'scam',
  'engagement-farming',
  'spam',
  'rumor',
  'misleading',
  'inauthentic'
]);

function isContentListModerationCause(
  cause: unknown
): cause is ContentListModerationCause {
  if (isLabelModerationCause(cause)) return true;

  return (
    isPlainObject(cause) &&
    typeof cause.type === 'string' &&
    [
      'blocking',
      'blocked-by',
      'block-other',
      'muted',
      'mute-word',
      'hidden'
    ].includes(cause.type)
  );
}

function getLabelTombstoneKind(
  cause: LabelModerationCause
): TweetTombstoneKind {
  const { val } = cause.label;

  if (
    cause.noOverride ||
    cause.labelDef.flags?.includes('adult') ||
    ADULT_TOMBSTONE_LABELS.has(val)
  )
    return 'age-restricted';

  if (RULE_VIOLATION_TOMBSTONE_LABELS.has(val)) return 'rules-violation';

  return 'sensitive';
}

function getPostContentListFilterCause(
  post: AppBskyFeedDefs.PostView,
  opts: ModerationOpts | null
): ContentListModerationCause | null {
  try {
    if (!opts) return null;

    const contentUi = moderatePost(post, opts).ui('contentList');

    return (
      contentUi.filters.find(
        (cause): cause is ContentListModerationCause =>
          !isMediaOnlyContentLabelCause(cause) &&
          isContentListModerationCause(cause)
      ) ?? null
    );
  } catch {
    return null;
  }
}

function getPostTombstoneKind(
  post: AppBskyFeedDefs.PostView,
  opts: ModerationOpts | null = activeModerationOpts
): TweetTombstoneKind | null {
  if (locallyReportedTweetIds.has(postIdFromUri(post.uri))) return 'reported';

  const cause = getPostContentListFilterCause(post, opts);
  if (!cause) return null;

  switch (cause.type) {
    case 'muted':
      return 'muted-account';
    case 'mute-word':
      return 'muted-word';
    case 'hidden':
      return 'reported';
    case 'label':
      return getLabelTombstoneKind(cause);
    default:
      return null;
  }
}

function getMediaModerationWarning(
  post: AppBskyFeedDefs.PostView,
  opts: ModerationOpts | null = activeModerationOpts,
  hasMedia = !!mapMedia(post.embed)
): TweetMediaWarning | null {
  if (!opts || !hasMedia) return null;

  try {
    const mediaUi = moderatePost(post, opts).ui('contentMedia');

    if (!mediaUi.blur) return null;

    const labelCause =
      (mediaUi.blurs.find(isLabelModerationCause) as
        | LabelModerationCause
        | undefined) ?? null;
    const label = labelCause
      ? getModerationCauseLabelName(labelCause)
      : 'Sensitive content';

    return {
      title: label,
      description: getModerationWarningDescription(mediaUi.noOverride),
      label,
      noOverride: mediaUi.noOverride
    };
  } catch {
    return null;
  }
}

function isModerationFilteredPost(
  post: AppBskyFeedDefs.PostView,
  opts: ModerationOpts | null
): boolean {
  return !!getPostContentListFilterCause(post, opts);
}

function isModerationFilteredWithoutTombstone(
  post: AppBskyFeedDefs.PostView,
  opts: ModerationOpts | null
): boolean {
  return (
    isModerationFilteredPost(post, opts) && !getPostTombstoneKind(post, opts)
  );
}

function isModerationFilteredNotification(
  notification: AppBskyNotificationListNotifications.Notification,
  opts: ModerationOpts | null
): boolean {
  try {
    return (
      !!opts &&
      moderateNotification(notification, opts).ui('contentList').filter
    );
  } catch {
    return false;
  }
}

function filterVisiblePostViews<T extends AppBskyFeedDefs.PostView>(
  posts: T[],
  opts: ModerationOpts | null
): T[] {
  if (!opts) return posts;

  return posts.filter(
    (post) =>
      !isModerationFilteredPost(post, opts) ||
      !!getPostTombstoneKind(post, opts)
  );
}

function filterVisibleFeedItems<T extends ActorFeedPost>(
  items: T[],
  opts: ModerationOpts | null
): T[] {
  if (!opts) return items;

  return items.filter(
    ({ post }) =>
      !isModerationFilteredPost(post, opts) ||
      !!getPostTombstoneKind(post, opts)
  );
}

function isVisibleThreadPost(
  thread: AppBskyFeedDefs.ThreadViewPost,
  opts: ModerationOpts | null
): boolean {
  if (
    thread.post.author.viewer?.blocking ||
    thread.post.author.viewer?.blockingByList ||
    thread.post.author.viewer?.blockedBy
  )
    return true;

  return (
    !isModerationFilteredPost(thread.post, opts) ||
    !!getPostTombstoneKind(thread.post, opts)
  );
}

function isThreadRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isThreadViewItem(
  item: unknown
): item is AppBskyFeedDefs.ThreadViewPost {
  return (
    AppBskyFeedDefs.isThreadViewPost(item) &&
    isThreadRecord(item) &&
    'post' in item
  );
}

function isBlockedThreadItem(
  item: unknown
): item is AppBskyFeedDefs.BlockedPost {
  const record = item as { uri?: unknown; author?: unknown };

  return (
    AppBskyFeedDefs.isBlockedPost(item) &&
    isThreadRecord(item) &&
    typeof record.uri === 'string' &&
    record.author !== undefined
  );
}

function isNotFoundThreadItem(
  item: unknown
): item is AppBskyFeedDefs.NotFoundPost {
  const record = item as { uri?: unknown };

  return (
    AppBskyFeedDefs.isNotFoundPost(item) &&
    isThreadRecord(item) &&
    typeof record.uri === 'string'
  );
}

function isUnavailableThreadItem(
  item: unknown
): item is AppBskyFeedDefs.BlockedPost | AppBskyFeedDefs.NotFoundPost {
  return isBlockedThreadItem(item) || isNotFoundThreadItem(item);
}

function isThreadItem(item: unknown): item is ThreadItem {
  return isThreadViewItem(item) || isUnavailableThreadItem(item);
}

function isVisibleThreadItem(
  item: ThreadItem,
  opts: ModerationOpts | null,
  hiddenAuthors?: HiddenThreadAuthors
): boolean {
  if (isThreadViewItem(item) && hiddenAuthors?.has(item.post.author.did))
    return true;

  return isThreadViewItem(item) ? isVisibleThreadPost(item, opts) : true;
}

function getRuleType(rule: unknown): string | null {
  if (!isPlainObject(rule)) return null;

  return typeof rule.$type === 'string' ? rule.$type : null;
}

function getDefaultReplyFromRules(
  rules: AppBskyActorDefs.PostInteractionSettingsPref['threadgateAllowRules']
): SettingsDefaultReply {
  if (rules === undefined) return 'everyone';
  if (rules.length === 0) return 'nobody';
  if (rules.length !== 1) return 'custom';

  const ruleType = getRuleType(rules[0]);
  if (ruleType === 'app.bsky.feed.threadgate#followingRule') return 'following';
  if (ruleType === 'app.bsky.feed.threadgate#followerRule') return 'followers';
  if (ruleType === 'app.bsky.feed.threadgate#mentionRule') return 'mentioned';

  return 'custom';
}

function getReplySettingFromThreadgate(
  threadgate?: AppBskyFeedDefs.ThreadgateView
): TweetReplySetting | null {
  const record = threadgate?.record;

  if (!isPlainObject(record)) return 'everyone';
  if (!('allow' in record)) return 'everyone';

  const { allow } = record;

  if (!Array.isArray(allow)) return null;
  if (allow.length === 0) return 'none';

  const ruleTypes = allow.map(getRuleType);

  if (ruleTypes.includes('app.bsky.feed.threadgate#followingRule'))
    return 'following';
  if (ruleTypes.includes('app.bsky.feed.threadgate#followerRule'))
    return 'followers';
  if (ruleTypes.includes('app.bsky.feed.threadgate#mentionRule'))
    return 'mentioned';

  return null;
}

function getViewerCanReplyToPost(
  post: AppBskyFeedDefs.PostView,
  replySetting: TweetReplySetting | null
): boolean | null {
  if (sessionDid && post.author.did === sessionDid) return true;
  if (typeof post.viewer?.replyDisabled === 'boolean')
    return !post.viewer.replyDisabled;
  if (replySetting === 'none') return false;

  return null;
}

function getReplyRulesFromDefault(
  setting: Exclude<SettingsDefaultReply, 'custom'>
): AppBskyActorDefs.PostInteractionSettingsPref['threadgateAllowRules'] {
  if (setting === 'everyone') return undefined;
  if (setting === 'nobody') return [];
  if (setting === 'following')
    return [{ $type: 'app.bsky.feed.threadgate#followingRule' }];
  if (setting === 'followers')
    return [{ $type: 'app.bsky.feed.threadgate#followerRule' }];

  return [{ $type: 'app.bsky.feed.threadgate#mentionRule' }];
}

function getDefaultQuoteFromRules(
  rules: AppBskyActorDefs.PostInteractionSettingsPref['postgateEmbeddingRules']
): SettingsDefaultQuote {
  if (!rules || rules.length === 0) return 'enabled';
  if (
    rules.length === 1 &&
    getRuleType(rules[0]) === 'app.bsky.feed.postgate#disableRule'
  )
    return 'disabled';

  return 'custom';
}

function getQuoteRulesFromDefault(
  setting: Exclude<SettingsDefaultQuote, 'custom'>
): AppBskyActorDefs.PostInteractionSettingsPref['postgateEmbeddingRules'] {
  if (setting === 'enabled') return undefined;

  return [{ $type: 'app.bsky.feed.postgate#disableRule' }];
}

async function getNotificationPreferences(): Promise<SettingsNotificationPreferences> {
  const response = await callAppQueryXrpc<{ preferences?: unknown }>(
    'app.bsky.notification.getPreferences',
    {}
  );

  return normalizeNotificationPreferences(response.preferences);
}

async function readBlueskyAccountSession(): Promise<
  BlueskySettings['account']
> {
  const response = await getAgent().com.atproto.server.getSession();

  return {
    did: response.data.did,
    handle: response.data.handle,
    email: response.data.email ?? null,
    emailConfirmed:
      typeof response.data.emailConfirmed === 'boolean'
        ? response.data.emailConfirmed
        : null,
    emailAuthFactor:
      typeof response.data.emailAuthFactor === 'boolean'
        ? response.data.emailAuthFactor
        : null,
    active:
      typeof response.data.active === 'boolean' ? response.data.active : null,
    status: response.data.status ?? null
  };
}

export async function getBlueskySettings(): Promise<BlueskySettings> {
  const api = getAgent();

  const [account, prefs, chatResult, notificationResult] = await Promise.all([
    readBlueskyAccountSession(),
    api.getPreferences(),
    getChatSettings()
      .then((settings) => ({
        available: true,
        settings,
        error: null
      }))
      .catch((error) => ({
        available: false,
        settings: null,
        error: getUnknownErrorMessage(error)
      })),
    getNotificationPreferences()
      .then((preferences) => ({
        available: true,
        preferences,
        error: null
      }))
      .catch((error) => ({
        available: false,
        preferences: null,
        error: getUnknownErrorMessage(error)
      }))
  ]);

  const labels = SETTINGS_CONTENT_LABELS.reduce<
    Record<SettingsContentLabel, SettingsLabelPreference>
  >(
    (contentLabels, config) => ({
      ...contentLabels,
      [config.label]: getSettingsContentLabelPreference(
        prefs.moderationPrefs,
        config
      )
    }),
    {} as Record<SettingsContentLabel, SettingsLabelPreference>
  );

  const postInteractionSettings = prefs.postInteractionSettings;

  return {
    account,
    feedView: prefs.feedViewPrefs.home,
    threadView: prefs.threadViewPrefs,
    contentLabels: labels,
    adultContentEnabled: prefs.moderationPrefs.adultContentEnabled,
    mutedWords: prefs.moderationPrefs.mutedWords.map(normalizeMutedWord),
    postInteractions: {
      defaultReply: getDefaultReplyFromRules(
        postInteractionSettings.threadgateAllowRules
      ),
      defaultQuote: getDefaultQuoteFromRules(
        postInteractionSettings.postgateEmbeddingRules
      )
    },
    interests: prefs.interests.tags,
    chat: chatResult,
    notifications: notificationResult
  };
}

export async function setAdultContentSetting(
  enabled: boolean
): Promise<BlueskySettings> {
  await getAgent().setAdultContentEnabled(enabled);
  clearModerationSettingsCache();
  notify();

  return getBlueskySettings();
}

export async function requestSettingsEmailUpdateToken(): Promise<boolean> {
  const response = await getAgent().com.atproto.server.requestEmailUpdate();

  return response.data.tokenRequired;
}

export async function updateSettingsHandle(
  handle: string
): Promise<BlueskySettings> {
  const safeHandle = handle.trim().replace(/^@/, '').toLowerCase();

  if (!isValidHandle(safeHandle)) throw new Error('Enter a valid handle.');

  await getAgent().com.atproto.identity.updateHandle({ handle: safeHandle });
  await refreshCurrentUser();
  notify();

  return getBlueskySettings();
}

export async function updateSettingsEmail(
  email: string,
  token: string | undefined,
  emailAuthFactor: boolean
): Promise<BlueskySettings> {
  const safeEmail = email.trim();
  const safeToken = token?.trim();

  if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail))
    throw new Error('Enter a valid email address.');

  await getAgent().com.atproto.server.updateEmail({
    email: safeEmail,
    emailAuthFactor,
    token: safeToken ? safeToken : undefined
  });
  notify();

  return getBlueskySettings();
}

export async function requestSettingsEmailConfirmation(): Promise<void> {
  await getAgent().com.atproto.server.requestEmailConfirmation();
}

export async function confirmSettingsEmail(
  email: string,
  token: string
): Promise<BlueskySettings> {
  const safeEmail = email.trim();
  const safeToken = token.trim();

  if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail))
    throw new Error('Enter the email address on your account.');
  if (!safeToken)
    throw new Error('Enter the confirmation token from your email.');

  await getAgent().com.atproto.server.confirmEmail({
    email: safeEmail,
    token: safeToken
  });
  notify();

  return getBlueskySettings();
}

export async function requestSettingsPasswordReset(
  email: string
): Promise<void> {
  const safeEmail = email.trim();

  if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail))
    throw new Error('Enter the email address on your account.');

  await getAgent().com.atproto.server.requestPasswordReset({
    email: safeEmail
  });
}

export async function resetSettingsPassword(
  token: string,
  password: string
): Promise<void> {
  const safeToken = token.trim();

  if (!safeToken) throw new Error('Enter the reset token from your email.');
  if (password.length < 8)
    throw new Error('Choose a password with at least 8 characters.');

  await getAgent().com.atproto.server.resetPassword({
    token: safeToken,
    password
  });
}

export async function setContentLabelSetting(
  label: SettingsContentLabel,
  preference: SettingsLabelPreference
): Promise<BlueskySettings> {
  const config = getSettingsContentLabelConfig(label);

  await getAgent().setContentLabelPref(label, preference, config.labelerDid);
  clearModerationSettingsCache();
  notify();

  return getBlueskySettings();
}

export async function setFeedViewSetting(
  pref: Partial<BskyFeedViewPreference>
): Promise<BlueskySettings> {
  const safePref: Partial<BskyFeedViewPreference> = {};

  if (typeof pref.hideReplies === 'boolean')
    safePref.hideReplies = pref.hideReplies;
  if (typeof pref.hideRepliesByUnfollowed === 'boolean')
    safePref.hideRepliesByUnfollowed = pref.hideRepliesByUnfollowed;
  if (typeof pref.hideReposts === 'boolean')
    safePref.hideReposts = pref.hideReposts;
  if (typeof pref.hideQuotePosts === 'boolean')
    safePref.hideQuotePosts = pref.hideQuotePosts;
  if (typeof pref.hideRepliesByLikeCount === 'number') {
    safePref.hideRepliesByLikeCount = Math.max(
      0,
      Math.min(1000, Math.round(pref.hideRepliesByLikeCount))
    );
  }

  await getAgent().setFeedViewPrefs('home', safePref);
  notify();

  return getBlueskySettings();
}

export async function setThreadViewSetting(
  pref: Partial<BskyThreadViewPreference>
): Promise<BlueskySettings> {
  const safePref: Partial<BskyThreadViewPreference> = {};

  if (
    pref.sort === 'oldest' ||
    pref.sort === 'newest' ||
    pref.sort === 'most-likes' ||
    pref.sort === 'hotness'
  ) {
    safePref.sort = pref.sort;
  }

  if (typeof pref.prioritizeFollowedUsers === 'boolean')
    safePref.prioritizeFollowedUsers = pref.prioritizeFollowedUsers;

  await getAgent().setThreadViewPrefs(safePref);
  notify();

  return getBlueskySettings();
}

export async function setDefaultReplySetting(
  setting: Exclude<SettingsDefaultReply, 'custom'>
): Promise<BlueskySettings> {
  const api = getAgent();
  const prefs = await api.getPreferences();

  await api.setPostInteractionSettings({
    threadgateAllowRules: getReplyRulesFromDefault(setting),
    postgateEmbeddingRules: prefs.postInteractionSettings.postgateEmbeddingRules
  });
  notify();

  return getBlueskySettings();
}

export async function setDefaultQuoteSetting(
  setting: Exclude<SettingsDefaultQuote, 'custom'>
): Promise<BlueskySettings> {
  const api = getAgent();
  const prefs = await api.getPreferences();

  await api.setPostInteractionSettings({
    threadgateAllowRules: prefs.postInteractionSettings.threadgateAllowRules,
    postgateEmbeddingRules: getQuoteRulesFromDefault(setting)
  });
  notify();

  return getBlueskySettings();
}

function normalizeInterestTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
        .filter((tag) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(tag))
    )
  ).slice(0, 20);
}

export async function getInterestsSetting(): Promise<string[]> {
  const prefs = await getAgent().getPreferences();

  return prefs.interests.tags;
}

export async function updateInterestsSetting(
  tags: string[]
): Promise<string[]> {
  const safeTags = normalizeInterestTags(tags);

  await getAgent().setInterestsPref({ tags: safeTags });
  notify();

  return safeTags;
}

export async function setInterestsSetting(
  tags: string[]
): Promise<BlueskySettings> {
  await updateInterestsSetting(tags);

  return getBlueskySettings();
}

export async function addSettingsMutedWord(
  value: string,
  targets: SettingsMutedWordTarget[],
  actorTarget: SettingsMutedWordActorTarget,
  expiresAt?: string
): Promise<BlueskySettings> {
  const safeValue = value.trim();
  const safeTargets = targets.filter(
    (target): target is SettingsMutedWordTarget =>
      target === 'content' || target === 'tag'
  );

  if (!safeValue) throw new Error('Enter a word or phrase to mute.');
  if (safeValue.length > 1000)
    throw new Error('Muted words must be 1000 characters or fewer.');
  if (!safeTargets.length)
    throw new Error('Choose where this muted word should apply.');

  const safeActorTarget =
    actorTarget === 'exclude-following' ? actorTarget : 'all';
  const safeExpiresAt = expiresAt ? new Date(expiresAt) : null;

  if (safeExpiresAt && Number.isNaN(safeExpiresAt.getTime()))
    throw new Error('Choose a valid expiration date.');

  await getAgent().addMutedWord({
    value: safeValue,
    targets: safeTargets,
    actorTarget: safeActorTarget,
    expiresAt: safeExpiresAt?.toISOString()
  });
  clearModerationSettingsCache();
  notify();

  return getBlueskySettings();
}

export async function removeSettingsMutedWord(
  mutedWord: SettingsMutedWord
): Promise<BlueskySettings> {
  await getAgent().removeMutedWord(mutedWord);
  clearModerationSettingsCache();
  notify();

  return getBlueskySettings();
}

export async function setSettingsChatAllowIncoming(
  allowIncoming: ChatAllowIncoming
): Promise<BlueskySettings> {
  await setChatSettings(allowIncoming);

  return getBlueskySettings();
}

export async function setSettingsNotificationPreference(
  key: SettingsNotificationKey,
  preference: Partial<SettingsNotificationPreference>
): Promise<BlueskySettings> {
  if (!NOTIFICATION_KEYS.includes(key))
    throw new Error('Unsupported notification preference.');

  const current = await getNotificationPreferences();
  const fallback = current[key];
  const nextPreference = normalizeNotificationPreference(key, {
    ...fallback,
    ...preference
  });

  await callAppXrpc<{ preferences?: unknown }>(
    'app.bsky.notification.putPreferencesV2',
    {
      [key]: nextPreference
    }
  );
  notify();

  return getBlueskySettings();
}

function notify(changeType: BackendChangeType = 'content'): void {
  if (changeType === 'content' || changeType === 'auth')
    authorFeedResponseCache.clear();

  listeners.forEach((changeTypes, listener) => {
    if (!changeTypes || changeTypes.has(changeType)) listener(changeType);
  });
}

export function subscribeBackend(
  listener: () => void,
  changeTypes?: BackendChangeType[]
): () => void {
  const backendListener: BackendListener = () => listener();
  listeners.set(backendListener, changeTypes ? new Set(changeTypes) : null);
  return () => {
    listeners.delete(backendListener);
  };
}

function safeAtob(value: string): string {
  if (typeof window !== 'undefined' && window.atob) return window.atob(value);
  return Buffer.from(value, 'base64').toString('utf8');
}

function safeBtoa(value: string): string {
  if (typeof window !== 'undefined' && window.btoa) return window.btoa(value);
  return Buffer.from(value, 'utf8').toString('base64');
}

export function postIdFromUri(uri: string): string {
  return safeBtoa(uri)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function uriFromPostId(id: string): string {
  const cachedRef = postRefCache.get(id);
  if (cachedRef) return cachedRef.uri;

  const padded = id.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (padded.length % 4)) % 4);
  return safeAtob(`${padded}${padding}`);
}

function rkeyFromAtUri(uri: string): string | null {
  const [, rkey] = uri.match(/^at:\/\/[^/]+\/[^/]+\/([^/]+)$/) ?? [];
  return rkey ?? null;
}

function compactArray(count: number, ownerId?: string): string[] {
  const safeCount = Math.max(0, count);
  const placeholders = Array.from({ length: safeCount }, (_, index) =>
    ownerId && index === 0 ? ownerId : `__count_${index}`
  );

  return ownerId && safeCount === 0 ? [ownerId] : placeholders;
}

function getViewerReactionOverrideMap(
  kind: ViewerReactionKind
): Map<string, ViewerReactionState> {
  return kind === 'like'
    ? localViewerLikeOverrides
    : localViewerRepostOverrides;
}

function getViewerReactionUriCache(
  kind: ViewerReactionKind
): Map<string, string> {
  return kind === 'like' ? localViewerLikeUriCache : localViewerRepostUriCache;
}

function getViewerReactionOverride(
  kind: ViewerReactionKind,
  tweetId: string
): ViewerReactionState | undefined {
  return getViewerReactionOverrideMap(kind).get(tweetId);
}

function setViewerReactionOverride(
  kind: ViewerReactionKind,
  tweetId: string,
  state: ViewerReactionState
): void {
  getViewerReactionOverrideMap(kind).set(tweetId, state);
}

function clearViewerReactionOverride(
  kind: ViewerReactionKind,
  tweetId: string
): void {
  getViewerReactionOverrideMap(kind).delete(tweetId);
}

function cacheViewerReactionUri(
  kind: ViewerReactionKind,
  tweetId: string,
  uri: string | null | undefined
): void {
  if (uri) getViewerReactionUriCache(kind).set(tweetId, uri);
}

function getCachedViewerReactionUri(
  kind: ViewerReactionKind,
  tweetId: string
): string | null {
  return getViewerReactionUriCache(kind).get(tweetId) ?? null;
}

function deleteCachedViewerReactionUri(
  kind: ViewerReactionKind,
  tweetId: string
): void {
  getViewerReactionUriCache(kind).delete(tweetId);
}

function getViewerReactionCollection(kind: ViewerReactionKind): string {
  return kind === 'like' ? 'app.bsky.feed.like' : 'app.bsky.feed.repost';
}

function getPostViewerReactionUri(
  post: AppBskyFeedDefs.PostView,
  kind: ViewerReactionKind
): string | null {
  return kind === 'like'
    ? post.viewer?.like ?? null
    : post.viewer?.repost ?? null;
}

function getViewerReactionField(
  kind: ViewerReactionKind
): 'userLikes' | 'userRetweets' {
  return kind === 'like' ? 'userLikes' : 'userRetweets';
}

function getEffectiveViewerReaction(
  kind: ViewerReactionKind,
  tweetId: string,
  serverActive: boolean,
  serverUri: string | null | undefined,
  serverCount: number
): { active: boolean; count: number } {
  cacheViewerReactionUri(kind, tweetId, serverUri);

  const override = sessionDid
    ? getViewerReactionOverride(kind, tweetId)
    : undefined;

  if (override && override.active === serverActive) {
    if (serverUri) cacheViewerReactionUri(kind, tweetId, serverUri);
    clearViewerReactionOverride(kind, tweetId);
  }

  const activeOverride = sessionDid
    ? getViewerReactionOverride(kind, tweetId)
    : undefined;
  const active = activeOverride ? activeOverride.active : serverActive;
  let count = Math.max(0, serverCount);

  if (activeOverride?.active && !serverActive) count += 1;
  if (activeOverride && !activeOverride.active && serverActive)
    count = Math.max(0, count - 1);

  return { active, count };
}

function updateCachedTweetViewerReaction(
  tweetId: string,
  kind: ViewerReactionKind,
  active: boolean
): void {
  if (!sessionDid) return;

  const tweet = tweetCache.get(tweetId) ?? locallyCreatedTweets.get(tweetId);
  if (!tweet) return;

  const field = getViewerReactionField(kind);
  const currentValues = tweet[field];

  tweet[field] = active
    ? [sessionDid, ...currentValues.filter((id) => id !== sessionDid)]
    : currentValues.filter((id) => id !== sessionDid);
}

function getThemeOverride(did: string): Partial<User> {
  if (!hasStorage()) return {};

  try {
    const themes = JSON.parse(
      window.localStorage.getItem(THEME_KEY) ?? '{}'
    ) as Record<string, Partial<User>>;
    const { theme, accent } = themes[did] ?? {};

    return {
      ...(theme !== undefined && { theme }),
      ...(accent !== undefined && { accent })
    };
  } catch {
    return {};
  }
}

function writeThemeOverride(did: string, data: Partial<User>): void {
  if (!hasStorage()) return;

  const override = getLocalProfileOverride(data);
  if (!Object.keys(override).length) return;

  const themes = JSON.parse(
    window.localStorage.getItem(THEME_KEY) ?? '{}'
  ) as Record<string, Partial<User>>;

  themes[did] = { ...(themes[did] ?? {}), ...override };
  window.localStorage.setItem(THEME_KEY, JSON.stringify(themes));
}

function hasDetailedProfileData(
  profile: ActorProfileView
): profile is AppBskyActorDefs.ProfileViewDetailed {
  return (
    'banner' in profile ||
    'followersCount' in profile ||
    'followsCount' in profile ||
    'postsCount' in profile ||
    'pinnedPost' in profile
  );
}

type ProfileVerificationState = {
  verifiedStatus?: unknown;
  trustedVerifierStatus?: unknown;
  verifications?: unknown;
};

type ProfileVerificationRecord = {
  isValid?: unknown;
  status?: unknown;
  verifiedStatus?: unknown;
  trustedVerifierStatus?: unknown;
};

function isValidVerificationStatus(status: unknown): boolean {
  return (
    typeof status === 'string' &&
    (status.toLowerCase() === 'valid' || status.toLowerCase() === 'verified')
  );
}

function isAbsentVerificationStatus(status: unknown): boolean {
  return (
    typeof status === 'string' &&
    ['invalid', 'none', 'unverified', 'not_verified'].includes(
      status.toLowerCase()
    )
  );
}

function isPositiveVerificationFlag(status: unknown): boolean {
  return status === true || isValidVerificationStatus(status);
}

function hasVerificationRecordCheckmark(record: unknown): boolean {
  if (!record || typeof record !== 'object') return false;

  const { isValid, status, verifiedStatus, trustedVerifierStatus } =
    record as ProfileVerificationRecord;
  const statuses = [status, verifiedStatus, trustedVerifierStatus];

  if (isValid === false) return false;
  if (isPositiveVerificationFlag(isValid)) return true;
  if (statuses.some(isPositiveVerificationFlag)) return true;
  if (statuses.some(isAbsentVerificationStatus)) return false;

  return true;
}

function hasProfileVerification(profile: ActorProfileView): boolean {
  const { verification } = profile as { verification?: unknown };
  if (!verification || typeof verification !== 'object') return false;

  const { verifiedStatus, trustedVerifierStatus, verifications } =
    verification as ProfileVerificationState;

  return (
    isPositiveVerificationFlag(verifiedStatus) ||
    isPositiveVerificationFlag(trustedVerifierStatus) ||
    (Array.isArray(verifications) &&
      verifications.some(hasVerificationRecordCheckmark))
  );
}

function mapKnownFollowerProfile(profile: ActorProfileView): UserKnownFollower {
  const existing = userCache.get(profile.did);
  const displayName = profile.displayName?.trim();

  return {
    id: profile.did,
    name: displayName ? displayName : existing?.name ?? profile.handle,
    username: profile.handle,
    photoURL: profile.avatar ?? existing?.photoURL ?? DEFAULT_PROFILE_PHOTO_URL,
    verified: existing?.verified === true || hasProfileVerification(profile)
  };
}

function getCachedUser(actor: string): User | null {
  return userCache.get(actor) ?? userHandleCache.get(actor) ?? null;
}

function isDefaultProfilePhotoURL(photoURL?: string | null): boolean {
  return (
    !photoURL ||
    photoURL === '/assets/twitter-avatar.jpg' ||
    photoURL === DEFAULT_PROFILE_PHOTO_URL
  );
}

function getProfilePhotoURL(
  profile: ActorProfileView,
  existing: User | undefined,
  isDetailed: boolean
): string {
  if (profile.avatar) return profile.avatar;
  if (!isDetailed && existing && !isDefaultProfilePhotoURL(existing.photoURL))
    return existing.photoURL;

  return DEFAULT_PROFILE_PHOTO_URL;
}

function getProfileCoverURL(
  profile: AppBskyActorDefs.ProfileViewDetailed,
  existing: User | undefined,
  isDetailed: boolean
): string {
  if (profile.banner) return profile.banner;
  if (!isDetailed && existing?.coverPhotoURL) return existing.coverPhotoURL;

  return DEFAULT_PROFILE_COVER_URL;
}

function mapProfile(profile: AppBskyActorDefs.ProfileViewDetailed): User;
function mapProfile(profile: AppBskyActorDefs.ProfileView): User;
function mapProfile(profile: AppBskyActorDefs.ProfileViewBasic): User;
function mapProfile(profile: ActorProfileView): User;
function mapProfile(profile: ActorProfileView): User {
  const existing = userCache.get(profile.did);
  const detailedProfile = profile as AppBskyActorDefs.ProfileViewDetailed;
  const profileRecord =
    detailedProfile as AppBskyActorDefs.ProfileViewDetailed &
      Record<string, unknown>;
  const isDetailed = hasDetailedProfileData(profile);
  const did = profile.did;
  const currentDid = sessionDid ?? '';
  const targetFollowsViewer = !!detailedProfile.viewer?.followedBy;
  const viewerFollowsTarget = !!detailedProfile.viewer?.following;
  const localViewerFollowsTarget = localViewerFollowOverrides.get(did);
  const effectiveViewerFollowsTarget =
    localViewerFollowsTarget ?? viewerFollowsTarget;
  const hasViewerState = !!detailedProfile.viewer;
  const viewerBlockingUri =
    typeof detailedProfile.viewer?.blocking === 'string'
      ? detailedProfile.viewer.blocking
      : null;
  const viewerBlockingByListName =
    detailedProfile.viewer?.blockingByList?.name ?? null;
  const blockingUri = hasViewerState
    ? viewerBlockingUri
    : existing?.blockingUri ?? blockUriCache.get(did) ?? null;
  const blockingByListName = hasViewerState
    ? viewerBlockingByListName
    : existing?.blockingByListName ?? null;
  const blocking = !!blockingUri || !!blockingByListName;
  const blockedBy = hasViewerState
    ? !!detailedProfile.viewer?.blockedBy
    : existing?.blockedBy ?? false;
  const muting = hasViewerState
    ? !!detailedProfile.viewer?.muted || !!detailedProfile.viewer?.mutedByList
    : existing?.muting ?? false;
  const mutingByListName = hasViewerState
    ? detailedProfile.viewer?.mutedByList?.name ?? null
    : existing?.mutingByListName ?? null;
  const isCurrentUser = currentUser?.id === did;
  const existingFollowing = existing?.following ?? [];
  const existingFollowers = existing?.followers ?? [];
  const following = isCurrentUser
    ? Array.from(currentFollowing)
    : targetFollowsViewer && currentDid
    ? [currentDid, ...existingFollowing.filter((id) => id !== currentDid)]
    : hasViewerState && currentDid
    ? existingFollowing.filter((id) => id !== currentDid)
    : existingFollowing;
  const followers =
    effectiveViewerFollowsTarget && currentDid
      ? [currentDid, ...existingFollowers.filter((id) => id !== currentDid)]
      : hasViewerState && currentDid
      ? existingFollowers.filter((id) => id !== currentDid)
      : existingFollowers;
  const viewerKnownFollowers = detailedProfile.viewer?.knownFollowers;
  const knownFollowers = isCurrentUser
    ? []
    : viewerKnownFollowers
    ? viewerKnownFollowers.followers.map(mapKnownFollowerProfile)
    : hasViewerState
    ? []
    : existing?.knownFollowers ?? [];
  const knownFollowersCount = isCurrentUser
    ? 0
    : viewerKnownFollowers
    ? viewerKnownFollowers.count
    : hasViewerState
    ? 0
    : existing?.knownFollowersCount ?? knownFollowers.length;
  const viewerActivitySubscription = (
    detailedProfile.viewer as
      | {
          activitySubscription?: { post?: boolean; reply?: boolean } | null;
        }
      | undefined
  )?.activitySubscription;

  if (detailedProfile.viewer?.following) {
    followUriCache.set(did, detailedProfile.viewer.following);
  } else if (hasViewerState && !effectiveViewerFollowsTarget) {
    followUriCache.delete(did);
  }
  if (blockingUri) {
    blockUriCache.set(did, blockingUri);
  } else if (hasViewerState) {
    blockUriCache.delete(did);
  }

  const profileCreatedAt = Timestamp.fromDate(
    new Date(
      detailedProfile.createdAt ??
        detailedProfile.indexedAt ??
        existing?.createdAt.toDate() ??
        Date.now()
    )
  );
  const pinnedTweet = detailedProfile.pinnedPost
    ? postIdFromUri(detailedProfile.pinnedPost.uri)
    : isDetailed
    ? null
    : existing?.pinnedTweet ?? null;

  if (detailedProfile.pinnedPost) {
    postRefCache.set(pinnedTweet as string, detailedProfile.pinnedPost);
  }

  const user: User = {
    id: did,
    bio: detailedProfile.description ?? existing?.bio ?? null,
    pronouns: profile.pronouns ?? existing?.pronouns ?? null,
    birthday:
      normalizeProfileBirthday(profileRecord.birthday) ??
      existing?.birthday ??
      null,
    messageAllowIncoming: existing?.messageAllowIncoming ?? null,
    activityNotificationCategories: getProfileActivityNotificationCategories(
      did,
      viewerActivitySubscription
    ),
    name: profile.displayName || existing?.name || profile.handle,
    theme: existing?.theme ?? null,
    accent: existing?.accent ?? null,
    website: detailedProfile.website ?? existing?.website ?? null,
    username: profile.handle,
    photoURL: getProfilePhotoURL(profile, existing, isDetailed),
    verified: (existing?.verified ?? false) || hasProfileVerification(profile),
    following,
    followers,
    followingCount: isCurrentUser
      ? existing?.followingCount ??
        detailedProfile.followsCount ??
        following.length
      : detailedProfile.followsCount ??
        existing?.followingCount ??
        following.length,
    followersCount:
      localViewerFollowsTarget !== undefined && existing
        ? existing.followersCount
        : detailedProfile.followersCount ??
          existing?.followersCount ??
          followers.length,
    knownFollowers,
    knownFollowersCount,
    muting,
    mutingByListName,
    blocking,
    blockedBy,
    blockingUri,
    blockingByListName,
    createdAt: profileCreatedAt,
    updatedAt: existing?.updatedAt ?? profileCreatedAt,
    totalTweets: detailedProfile.postsCount ?? existing?.totalTweets ?? 0,
    totalPhotos: existing?.totalPhotos ?? 0,
    pinnedTweet,
    coverPhotoURL: getProfileCoverURL(detailedProfile, existing, isDetailed),
    ...getThemeOverride(did)
  };

  userCache.set(did, user);
  userHandleCache.set(user.username, user);
  if (isDetailed) detailedUserCache.add(did);

  return user;
}

async function hydrateProfiles(profiles: ActorProfileView[]): Promise<User[]> {
  const missingDetailedDids = Array.from(
    new Set(
      profiles
        .filter(
          (profile) =>
            !detailedUserCache.has(profile.did) &&
            !hasDetailedProfileData(profile)
        )
        .map(({ did }) => did)
    )
  );

  if (missingDetailedDids.length) {
    try {
      for (let index = 0; index < missingDetailedDids.length; index += 25) {
        const response = await getAppViewAgent().getProfiles({
          actors: missingDetailedDids.slice(index, index + 25)
        });

        response.data.profiles.forEach(mapProfile);
      }
    } catch {
      // Lightweight profile views are still usable if public detail hydration fails.
    }
  }

  return profiles.map(
    (profile) => getCachedUser(profile.did) ?? mapProfile(profile)
  );
}

async function hydrateKnownFollowersUserData(actor: string): Promise<void> {
  if (!sessionDid) return;

  const normalizedActor = normalizeAtIdentifier(actor);
  if (!normalizedActor || normalizedActor === sessionDid) return;

  const response = await getAppViewAgent()
    .app.bsky.graph.getKnownFollowers({
      actor: normalizedActor,
      limit: 3
    })
    .catch(() => null);

  if (!response) return;

  const subject = mapProfile(response.data.subject);
  const knownFollowerProfiles = response.data.subject.viewer?.knownFollowers
    ?.followers.length
    ? response.data.subject.viewer.knownFollowers.followers
    : response.data.followers;
  const knownFollowers = knownFollowerProfiles.map(mapKnownFollowerProfile);
  const knownFollowersCount =
    response.data.subject.viewer?.knownFollowers?.count ??
    response.data.followers.length;
  const cachedSubject = userCache.get(subject.id) ?? subject;

  cachedSubject.knownFollowers = knownFollowers;
  cachedSubject.knownFollowersCount = Math.max(
    knownFollowersCount,
    knownFollowers.length
  );
  userCache.set(cachedSubject.id, cachedSubject);
  userHandleCache.set(cachedSubject.username, cachedSubject);

  await hydrateProfiles(response.data.followers);
}

function getPostText(record: unknown): string | null {
  if (!record || typeof record !== 'object' || !('text' in record)) return null;
  const text = (record as { text?: unknown }).text;
  return typeof text === 'string' && text ? text : null;
}

function normalizePostLanguage(
  value: string | null | undefined
): string | null {
  const normalized = value?.trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return null;

  const base = normalized.split('-')[0];

  return base && !['mul', 'und', 'zxx'].includes(base) ? base : null;
}

function getPostLanguages(record: unknown): string[] {
  if (!record || typeof record !== 'object' || !('langs' in record)) return [];

  const langs = (record as { langs?: unknown }).langs;
  if (!Array.isArray(langs)) return [];

  return Array.from(
    new Set(
      langs.flatMap((lang) =>
        typeof lang === 'string' ? normalizePostLanguage(lang) ?? [] : []
      )
    )
  );
}

function getDefaultPostLanguages(): string[] {
  if (typeof navigator === 'undefined') return [];

  const language = navigator.languages?.[0] ?? navigator.language;
  const normalized = normalizePostLanguage(language);

  return normalized ? [normalized] : [];
}

function getPostCreatedAt(record: unknown, fallback: string): Timestamp {
  const createdAt =
    record && typeof record === 'object' && 'createdAt' in record
      ? (record as { createdAt?: unknown }).createdAt
      : null;

  return Timestamp.fromDate(
    new Date(typeof createdAt === 'string' ? createdAt : fallback)
  );
}

function getHostname(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;

  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

type TenorGifInfo = {
  playbackUrl: string;
  aspectRatio: AppBskyEmbedImages.Image['aspectRatio'];
  alt: string;
  poster?: string | null;
};

function parseTenorGifUrl(value: string): TenorGifInfo | null {
  try {
    const url = new URL(value);
    if (url.hostname !== 'media.tenor.com') return null;

    let [, id, filename] = url.pathname.split('/');
    if (!id || !filename || !/\.gif$/i.test(filename)) return null;

    if (id.includes('AAAAC')) {
      if (typeof window !== 'undefined' && !isSafariBrowser()) {
        id = id.replace('AAAAC', 'AAAP3');
        filename = filename.replace(/\.gif$/i, '.webm');
      } else if (typeof window !== 'undefined') {
        id = id.replace('AAAAC', 'AAAP1');
        filename = filename.replace(/\.gif$/i, '.mp4');
      } else {
        id = id.replace('AAAAC', 'AAAAM');
      }
    }

    const width = Number(url.searchParams.get('ww'));
    const height = Number(url.searchParams.get('hh'));
    const alt = url.searchParams.get('alt') ?? '';

    return {
      playbackUrl: `https://t.gifs.bsky.app/${id}/${filename}`,
      aspectRatio: getImageAspectRatio(width, height),
      alt
    };
  } catch {
    return null;
  }
}

function isGifServiceHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '');

  return (
    host === 'tenor.com' ||
    host.endsWith('.tenor.com') ||
    host === 'giphy.com' ||
    host.endsWith('.giphy.com') ||
    host === 'klipy.com' ||
    host.endsWith('.klipy.com')
  );
}

function isPlayableGifServiceUrl(url: URL): boolean {
  if (/\.gif(?:$|[?#])/i.test(url.pathname)) return true;
  if (!isGifServiceHost(url.hostname)) return false;

  return /\.(gif|mp4|webm|webp)(?:$|[?#])/i.test(url.pathname);
}

function getGiphyMediaId(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  const mediaIndex = segments.indexOf('media');
  const mediaId = mediaIndex >= 0 ? segments[mediaIndex + 1] : null;

  if (mediaId && !mediaId.startsWith('v1.')) return mediaId;

  const slug = segments[segments.length - 1];
  if (!slug) return null;

  const slugParts = slug.split('-');
  const id = slugParts[slugParts.length - 1];
  return id && /^[a-z0-9]+$/i.test(id) ? id : null;
}

function getGiphyPlaybackUrl(url: URL): string | null {
  if (!url.hostname.endsWith('giphy.com')) return null;
  if (isPlayableGifServiceUrl(url)) return url.toString();

  const mediaId = getGiphyMediaId(url);
  return mediaId ? `https://media.giphy.com/media/${mediaId}/giphy.gif` : null;
}

function getThirdPartyGifUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function parseThirdPartyGifUrl(
  value: string,
  title?: string,
  poster?: string | null
): TenorGifInfo | null {
  const tenorGif = parseTenorGifUrl(value);
  if (tenorGif)
    return {
      ...tenorGif,
      alt: tenorGif.alt ? tenorGif.alt : title ?? 'GIF',
      poster
    };

  const url = getThirdPartyGifUrl(value);
  if (!url) return null;

  const giphyPlaybackUrl = getGiphyPlaybackUrl(url);
  const playbackUrl =
    giphyPlaybackUrl ?? (isPlayableGifServiceUrl(url) ? url.toString() : null);

  if (!playbackUrl) return null;

  const width = Number(url.searchParams.get('ww') ?? url.searchParams.get('w'));
  const height = Number(
    url.searchParams.get('hh') ?? url.searchParams.get('h')
  );

  return {
    playbackUrl,
    aspectRatio: getImageAspectRatio(width, height),
    alt: title ?? 'GIF',
    poster
  };
}

function isThirdPartyGifUrl(value: string): boolean {
  return !!parseThirdPartyGifUrl(value);
}

function getBskyWebUrl(uri: string): string {
  const atUriMatch = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!atUriMatch) return uri;

  const [, actor, collection, rkey] = atUriMatch;

  if (collection === 'app.bsky.feed.post')
    return `https://bsky.app/profile/${actor}/post/${rkey}`;
  if (collection === 'app.bsky.feed.generator')
    return `https://bsky.app/profile/${actor}/feed/${rkey}`;
  if (collection === 'app.bsky.graph.list')
    return `https://bsky.app/profile/${actor}/lists/${rkey}`;
  if (collection === 'app.bsky.graph.starterpack')
    return `https://bsky.app/starter-pack/${actor}/${rkey}`;

  return `https://bsky.app/profile/${actor}`;
}

function getCardAssociatedRefs(
  refs: AppBskyEmbedExternal.ViewExternal['associatedRefs']
): TweetCard['associatedRefs'] {
  if (!refs?.length) return null;

  return refs
    .map(({ uri, cid }) => (uri && cid ? { uri, cid } : null))
    .filter((ref): ref is { uri: string; cid: string } => !!ref);
}

const readStandardSiteArticle = createArticleCache<StandardSiteArticleSnapshot>(
  12_000,
  0
);

export type StandardSiteArticleSnapshot = {
  card: TweetCard;
  article: StandardSiteArticle;
};

function getRecordString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getRecordTags(record: Record<string, unknown>): string[] {
  const tags = record.tags;

  if (!Array.isArray(tags)) return [];

  return tags
    .filter((tag): tag is string => typeof tag === 'string' && !!tag.trim())
    .map((tag) => tag.trim());
}

function removeMdxComponentBlocks(lines: string[]): string[] {
  const nextLines: string[] = [];
  let skippingComponentBlock = false;

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (skippingComponentBlock) {
      if (/\/>\s*$/.test(trimmedLine) || /^<\/[A-Z]/.test(trimmedLine))
        skippingComponentBlock = false;

      return;
    }

    if (/^import\s/.test(trimmedLine) || /^export\s/.test(trimmedLine)) return;

    if (/^<[A-Z][\w.:-]*(\s|>|\/>)/.test(trimmedLine)) {
      if (!/\/>\s*$/.test(trimmedLine)) skippingComponentBlock = true;
      return;
    }

    nextLines.push(line.replace(/<\/?[^>]+>/g, ''));
  });

  return nextLines;
}

function stripReaderMarkdownPreamble(text: string): string {
  const normalizedText = text.replace(/\r\n?/g, '\n');
  const lines = normalizedText.split('\n');
  const scanLimit = Math.min(lines.length, 12);
  let sawTitle = false;
  let sawURLSource = false;

  for (let index = 0; index < scanLimit; index++) {
    const line = lines[index].trim();

    if (/^title:\s+/i.test(line)) sawTitle = true;
    if (/^url source:\s+/i.test(line)) sawURLSource = true;

    if (/^markdown content:\s*$/i.test(line) && sawTitle && sawURLSource)
      return lines
        .slice(index + 1)
        .join('\n')
        .replace(/^\n+/, '')
        .trim();
  }

  return normalizedText.trim();
}

function normalizeStandardSiteArticleText(text: string): string {
  return stripReaderMarkdownPreamble(
    removeMdxComponentBlocks(text.replace(/\r\n?/g, '\n').split('\n'))
      .join('\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

function getTextFromUnknownContent(value: unknown, depth = 0): string[] {
  if (depth > 5 || value === null || value === undefined) return [];
  if (typeof value === 'string') return [value];

  if (Array.isArray(value))
    return value.flatMap((item) => getTextFromUnknownContent(item, depth + 1));

  if (!isPlainObject(value)) return [];

  return ['text', 'plainText', 'markdown', 'content', 'children', 'value']
    .flatMap((key) => getTextFromUnknownContent(value[key], depth + 1))
    .filter((item) => item.trim());
}

function getStandardSiteDocumentText(
  record: Record<string, unknown>
): string | null {
  const textContent = getRecordString(record, 'textContent');
  const text = textContent
    ? textContent
    : getTextFromUnknownContent(record.content).join('\n\n');
  const normalizedText = normalizeStandardSiteArticleText(text);

  return normalizedText ? normalizedText : null;
}

function getStandardSiteDocumentRecord(
  records: AppBskyEmbedGetEmbedExternalView.OutputSchema['associatedRecords']
): Record<string, unknown> | null {
  const record = records?.find(
    (item): item is Record<string, unknown> =>
      isPlainObject(item) && item.$type === STANDARD_SITE_DOCUMENT_COLLECTION
  );

  return record ?? null;
}

async function fetchStandardSiteArticle(
  card: TweetCard
): Promise<StandardSiteArticleSnapshot | null> {
  const uris = getStandardSiteDocumentUris(card);

  if (!uris.length) return null;

  const response =
    await callPublicFallbackAppQueryXrpc<AppBskyEmbedGetEmbedExternalView.OutputSchema>(
      'app.bsky.embed.getEmbedExternalView',
      { url: card.url, uris }
    );
  const documentRecord = getStandardSiteDocumentRecord(
    response.associatedRecords
  );

  if (!documentRecord) return null;

  const textContent = getStandardSiteDocumentText(documentRecord) ?? '';

  const documentURI =
    uris.find((uri) =>
      uri.includes(`/${STANDARD_SITE_DOCUMENT_COLLECTION}/`)
    ) ?? null;

  const article: StandardSiteArticle = {
    revision:
      response.associatedRefs?.find((ref) => ref.uri === documentURI)?.cid ??
      JSON.stringify(documentRecord),
    url:
      getRecordString(documentRecord, 'canonicalUrl') ??
      response.view?.external.uri ??
      card.url,
    title: getRecordString(documentRecord, 'title') ?? card.title,
    description: getRecordString(documentRecord, 'description'),
    textContent,
    content: documentRecord.content,
    documentURI,
    publishedAt:
      getRecordString(documentRecord, 'publishedAt') ?? card.createdAt ?? null,
    updatedAt:
      getRecordString(documentRecord, 'updatedAt') ?? card.updatedAt ?? null,
    tags: getRecordTags(documentRecord)
  };
  return {
    article,
    card: response.view
      ? {
          ...mapExternalCard(response.view),
          associatedRefs: getCardAssociatedRefs(
            response.associatedRefs ?? response.view.external.associatedRefs
          )
        }
      : {
          ...card,
          title: article.title,
          description: article.description,
          updatedAt: article.updatedAt
        }
  };
}

export async function getStandardSiteArticleSnapshot(
  card: TweetCard
): Promise<StandardSiteArticleSnapshot | null> {
  const key = JSON.stringify([
    card.url,
    getStandardSiteDocumentUris(card).sort()
  ]);
  return readStandardSiteArticle(key, () => fetchStandardSiteArticle(card));
}

export async function getStandardSiteArticle(
  card: TweetCard
): Promise<StandardSiteArticle | null> {
  return (await getStandardSiteArticleSnapshot(card))?.article ?? null;
}

function getCardReadingTime(
  readingTime: AppBskyEmbedExternal.ViewExternal['readingTime']
): number | null {
  return typeof readingTime === 'number' && Number.isFinite(readingTime)
    ? Math.max(1, Math.round(readingTime))
    : null;
}

function getExternalSourceCardData(
  source: AppBskyEmbedExternal.ViewExternal['source']
): TweetCard['source'] {
  if (!source) return null;

  return {
    url: source.uri,
    title: source.title,
    description: source.description ?? null,
    icon: source.icon ?? null,
    theme: isPlainObject(source.theme) ? source.theme : null
  };
}

export async function getStandardSiteLinkCard(
  url: string,
  uris: string[]
): Promise<TweetCard | null> {
  const response =
    await callPublicFallbackAppQueryXrpc<AppBskyEmbedGetEmbedExternalView.OutputSchema>(
      'app.bsky.embed.getEmbedExternalView',
      { url, uris }
    );
  if (!response.view) return null;
  return {
    ...mapExternalCard(response.view),
    associatedRefs: getCardAssociatedRefs(
      response.associatedRefs ?? response.view.external.associatedRefs
    )
  };
}

function mapExternalCard(embed: AppBskyEmbedExternal.View): TweetCard {
  const { external } = embed;
  const youtubeInfo = getYouTubeVideoInfo(external.uri);
  const title = external.title
    ? external.title
    : youtubeInfo?.title ?? external.uri;

  return {
    type: youtubeInfo ? 'youtube' : 'external',
    url: youtubeInfo?.url ?? external.uri,
    title,
    description: external.description || null,
    image: external.thumb ?? youtubeInfo?.thumbnail ?? null,
    domain: youtubeInfo?.domain ?? getHostname(external.uri),
    source: getExternalSourceCardData(external.source),
    createdAt: external.createdAt ?? null,
    updatedAt: external.updatedAt ?? null,
    readingTime: getCardReadingTime(external.readingTime),
    associatedRefs: getCardAssociatedRefs(external.associatedRefs)
  };
}

function getStarterPackName(record: unknown): string | null {
  if (!record || typeof record !== 'object' || !('name' in record)) return null;
  const name = (record as { name?: unknown }).name;
  return typeof name === 'string' && name ? name : null;
}

function getStarterPackDescription(record: unknown): string | null {
  if (!record || typeof record !== 'object' || !('description' in record))
    return null;
  const description = (record as { description?: unknown }).description;
  return typeof description === 'string' && description ? description : null;
}

function getStarterPackRecordFeedCount(record: unknown): number {
  if (!record || typeof record !== 'object' || !('feeds' in record)) return 0;
  const feeds = (record as { feeds?: unknown }).feeds;
  return Array.isArray(feeds) ? feeds.length : 0;
}

function mapRecordSummaryCard(
  record: AppBskyEmbedRecord.View['record']
): TweetCard | null {
  if (AppBskyFeedDefs.isGeneratorView(record))
    return {
      type: 'summary',
      url: getBskyWebUrl(record.uri),
      title: record.displayName,
      description: record.description ?? `Feed by @${record.creator.handle}`,
      image: record.avatar ?? null,
      domain: 'bsky.app'
    };

  if (AppBskyGraphDefs.isListView(record))
    return {
      type: 'summary',
      url: getBskyWebUrl(record.uri),
      title: record.name,
      description: record.description ?? `List by @${record.creator.handle}`,
      image: record.avatar ?? null,
      domain: 'bsky.app'
    };

  if (AppBskyGraphDefs.isStarterPackViewBasic(record)) {
    const name = getStarterPackName(record.record);
    const description = getStarterPackDescription(record.record);

    return {
      type: 'summary',
      url: getBskyWebUrl(record.uri),
      title: name ?? 'Starter Pack',
      description: description ?? `Starter Pack by @${record.creator.handle}`,
      image: null,
      domain: 'bsky.app'
    };
  }

  if (AppBskyLabelerDefs.isLabelerView(record))
    return {
      type: 'summary',
      url: getBskyWebUrl(record.uri),
      title: record.creator.displayName
        ? record.creator.displayName
        : record.creator.handle,
      description: `Labeler by @${record.creator.handle}`,
      image: record.creator.avatar ?? null,
      domain: 'bsky.app'
    };

  return null;
}

function mapMedia(embed: unknown): ImagesPreview | null {
  if (!embed) return null;

  if (AppBskyEmbedExternal.isView(embed)) {
    const { external } = embed as AppBskyEmbedExternal.View;
    const thirdPartyGif = parseThirdPartyGifUrl(
      external.uri,
      external.title,
      external.thumb
    );

    if (thirdPartyGif)
      return [
        {
          id: `${external.uri}-third-party-gif`,
          src: thirdPartyGif.playbackUrl,
          alt: thirdPartyGif.alt,
          type: 'gif',
          poster: thirdPartyGif.poster ?? null,
          aspectRatio: thirdPartyGif.aspectRatio
        }
      ];
  }

  if (
    isPlainObject(embed) &&
    (embed.$type === 'app.bsky.embed.gallery' ||
      embed.$type === 'app.bsky.embed.gallery#view') &&
    Array.isArray(embed.items)
  ) {
    const galleryImages = embed.items
      .map((image, index) => {
        if (!isPlainObject(image)) return null;

        const src =
          typeof image.fullsize === 'string'
            ? image.fullsize
            : typeof image.thumbnail === 'string'
            ? image.thumbnail
            : null;
        if (!src) return null;

        const altText = typeof image.alt === 'string' ? image.alt.trim() : '';
        const aspectRatioValue = isPlainObject(image.aspectRatio)
          ? image.aspectRatio
          : null;
        const aspectRatio =
          isPlainObject(aspectRatioValue) &&
          typeof aspectRatioValue.width === 'number' &&
          typeof aspectRatioValue.height === 'number'
            ? {
                width: aspectRatioValue.width,
                height: aspectRatioValue.height
              }
            : null;

        return {
          id: `${src}-${index}`,
          src,
          alt: altText || 'Image',
          altText: altText || null,
          type: /\.gif($|\?)/i.test(src) ? 'gif' : 'image',
          aspectRatio
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item);

    return galleryImages;
  }

  if (AppBskyEmbedImages.isView(embed))
    return (embed as AppBskyEmbedImages.View).images.map((image, index) => {
      const altText = image.alt?.trim() ?? '';

      return {
        id: `${image.fullsize}-${index}`,
        src: image.fullsize,
        alt: altText || 'Image',
        altText: altText || null,
        type: /\.gif($|\?)/i.test(image.fullsize) ? 'gif' : 'image',
        aspectRatio: image.aspectRatio ?? null
      };
    });

  if (AppBskyEmbedVideo.isView(embed)) {
    const { viewCount } = embed as AppBskyEmbedVideo.View & {
      viewCount?: number;
    };
    const videoEmbed = embed as AppBskyEmbedVideo.View;

    const altText = videoEmbed.alt?.trim() ?? '';

    return [
      {
        id: `${videoEmbed.cid}-video`,
        src: videoEmbed.playlist,
        alt: altText || 'Video',
        altText: altText || null,
        type: 'video',
        poster: videoEmbed.thumbnail ?? null,
        viewCount: viewCount ?? null,
        aspectRatio: videoEmbed.aspectRatio ?? null
      }
    ];
  }

  if (AppBskyEmbedRecordWithMedia.isView(embed))
    return mapMedia((embed as AppBskyEmbedRecordWithMedia.View).media);

  return null;
}

function mapCard(embed: unknown): TweetCard | null {
  if (!embed) return null;

  if (AppBskyEmbedExternal.isView(embed)) {
    const externalEmbed = embed as AppBskyEmbedExternal.View;

    if (isThirdPartyGifUrl(externalEmbed.external.uri)) return null;

    return mapExternalCard(externalEmbed);
  }

  if (AppBskyEmbedRecordWithMedia.isView(embed)) {
    const recordWithMedia = embed as AppBskyEmbedRecordWithMedia.View;
    const mediaCard = mapCard(recordWithMedia.media);
    if (mediaCard) return mediaCard;
    return mapRecordSummaryCard(recordWithMedia.record.record);
  }

  if (AppBskyEmbedRecord.isView(embed))
    return mapRecordSummaryCard((embed as AppBskyEmbedRecord.View).record);

  return null;
}

function mapFirstEmbeddedMedia(
  embeds?: AppBskyEmbedRecord.ViewRecord['embeds']
): ImagesPreview | null {
  if (!embeds) return null;

  for (const embed of embeds) {
    const media = mapMedia(embed);
    if (media) return media;
  }

  return null;
}

function mapFirstEmbeddedCard(
  embeds?: AppBskyEmbedRecord.ViewRecord['embeds']
): TweetCard | null {
  if (!embeds) return null;

  for (const embed of embeds) {
    const card = mapCard(embed);
    if (card) return card;
  }

  return null;
}

function mapUnavailableEmbeddedTweet(
  unavailable: EmbeddedTweet['unavailable'],
  uri?: string
): EmbeddedTweet {
  return {
    id: uri ? postIdFromUri(uri) : null,
    authorName: null,
    authorUsername: null,
    authorAvatar: null,
    authorVerified: false,
    text: null,
    langs: [],
    createdAt: null,
    images: null,
    mediaWarning: null,
    card: null,
    unavailable
  };
}

function getEmbeddedRecordMediaWarning(
  record: AppBskyEmbedRecord.ViewRecord,
  images: ImagesPreview | null
): TweetMediaWarning | null {
  if (!images) return null;

  return getMediaModerationWarning(
    {
      uri: record.uri,
      cid: record.cid,
      author: record.author,
      record: record.value,
      embed: record.embeds?.[0] as AppBskyFeedDefs.PostView['embed'],
      labels: record.labels,
      indexedAt: record.indexedAt
    },
    activeModerationOpts,
    true
  );
}

function getEmbeddedRecordTombstone(
  record: AppBskyEmbedRecord.ViewRecord,
  author: User
): TweetTombstoneKind | null {
  if (author.muting || author.mutingByListName) return 'muted-account';

  return getPostTombstoneKind(
    {
      uri: record.uri,
      cid: record.cid,
      author: record.author,
      record: record.value,
      embed: record.embeds?.[0] as AppBskyFeedDefs.PostView['embed'],
      labels: record.labels,
      indexedAt: record.indexedAt
    },
    activeModerationOpts
  );
}

function mapEmbeddedRecord(
  record: AppBskyEmbedRecord.View['record']
): EmbeddedTweet | null {
  if (AppBskyEmbedRecord.isViewRecord(record)) {
    const id = postIdFromUri(record.uri);
    const author = mapProfile(record.author);
    const images = mapFirstEmbeddedMedia(record.embeds);

    if (author.blocking || author.blockedBy)
      return mapUnavailableEmbeddedTweet('blocked', record.uri);

    postRefCache.set(id, { uri: record.uri, cid: record.cid });
    cachePostReplyRef(id, record.value);

    return {
      id,
      authorName: author.name,
      authorUsername: author.username,
      authorAvatar: author.photoURL,
      authorVerified: author.verified,
      text: getPostText(record.value),
      langs: getPostLanguages(record.value),
      createdAt: getPostCreatedAt(record.value, record.indexedAt),
      images,
      mediaWarning: getEmbeddedRecordMediaWarning(record, images),
      card: mapFirstEmbeddedCard(record.embeds),
      tombstone: getEmbeddedRecordTombstone(record, author)
    };
  }

  if (AppBskyEmbedRecord.isViewNotFound(record))
    return mapUnavailableEmbeddedTweet('not-found', record.uri);

  if (AppBskyEmbedRecord.isViewBlocked(record))
    return mapUnavailableEmbeddedTweet('blocked', record.uri);

  if (AppBskyEmbedRecord.isViewDetached(record))
    return mapUnavailableEmbeddedTweet('detached', record.uri);

  return null;
}

function mapQuotedTweet(embed: unknown): EmbeddedTweet | null {
  if (!embed) return null;

  if (AppBskyEmbedRecordWithMedia.isView(embed))
    return mapEmbeddedRecord(
      (embed as AppBskyEmbedRecordWithMedia.View).record.record
    );

  if (AppBskyEmbedRecord.isView(embed))
    return mapEmbeddedRecord((embed as AppBskyEmbedRecord.View).record);

  return null;
}

function getPostBookmarkCount(post: AppBskyFeedDefs.PostView): number {
  const bookmarkCount = post.bookmarkCount;

  return typeof bookmarkCount === 'number' && Number.isFinite(bookmarkCount)
    ? bookmarkCount
    : 0;
}

function mapPost(
  post: AppBskyFeedDefs.PostView,
  parent?: { id: string; username: string } | null
): Tweet {
  const id = postIdFromUri(post.uri);
  const currentDid = sessionDid;
  const images = mapMedia(post.embed);
  const replySetting = getReplySettingFromThreadgate(post.threadgate);
  const viewerLikeUri = getPostViewerReactionUri(post, 'like');
  const viewerRepostUri = getPostViewerReactionUri(post, 'repost');
  const likeState = getEffectiveViewerReaction(
    'like',
    id,
    !!viewerLikeUri,
    viewerLikeUri,
    post.likeCount ?? 0
  );
  const repostState = getEffectiveViewerReaction(
    'repost',
    id,
    !!viewerRepostUri,
    viewerRepostUri,
    post.repostCount ?? 0
  );
  const tweet: Tweet = {
    id,
    text: getPostText(post.record),
    langs: getPostLanguages(post.record),
    images,
    mediaWarning: getMediaModerationWarning(
      post,
      activeModerationOpts,
      !!images
    ),
    card: mapCard(post.embed),
    quotedTweet: mapQuotedTweet(post.embed),
    tombstone: getPostTombstoneKind(post, activeModerationOpts),
    parent: parent ?? null,
    userLikes: compactArray(
      likeState.count,
      likeState.active && currentDid ? currentDid : undefined
    ),
    createdBy: post.author.did,
    createdAt: getPostCreatedAt(post.record, post.indexedAt),
    updatedAt: null,
    userReplies: post.replyCount ?? 0,
    userRetweets: compactArray(
      repostState.count,
      repostState.active && currentDid ? currentDid : undefined
    ),
    userQuotes: post.quoteCount ?? 0,
    bookmarkCount: getPostBookmarkCount(post),
    replySetting,
    viewerCanReply: getViewerCanReplyToPost(post, replySetting),
    threadMuted: post.viewer?.threadMuted ?? false
  };

  postRefCache.set(id, { uri: post.uri, cid: post.cid });
  cachePostReplyRef(id, post.record);
  tweetCache.set(id, tweet);
  mapProfile(post.author);

  return tweet;
}

function mapPostWithUser(
  post: AppBskyFeedDefs.PostView,
  parent?: { id: string; username: string } | null
): TweetWithUser {
  const tweet = mapPost(post, parent);
  return {
    ...tweet,
    user: getCachedUser(tweet.createdBy) ?? mapProfile(post.author)
  };
}

function getThreadParent(
  thread: AppBskyFeedDefs.ThreadViewPost
): { id: string; username: string } | null {
  const { parent } = thread;

  return isThreadViewItem(parent)
    ? {
        id: postIdFromUri(parent.post.uri),
        username: parent.post.author.handle
      }
    : null;
}

function getUnavailableThreadReason(
  item: AppBskyFeedDefs.BlockedPost | AppBskyFeedDefs.NotFoundPost
): TweetUnavailableReason {
  if (isNotFoundThreadItem(item)) return 'not-found';
  if (!isBlockedThreadItem(item)) return 'blocked';

  return item.author.viewer?.blockedBy ? 'blocked-by' : 'blocked';
}

function getThreadPostUnavailableReason(
  thread: AppBskyFeedDefs.ThreadViewPost
): TweetUnavailableReason | null {
  if (thread.post.author.viewer?.blockedBy) return 'blocked-by';
  if (
    thread.post.author.viewer?.blocking ||
    thread.post.author.viewer?.blockingByList
  )
    return 'blocked';

  return null;
}

function addHiddenThreadAuthor(
  hiddenAuthors: HiddenThreadAuthors,
  did: string | null,
  reason: TweetUnavailableReason | null
): void {
  if (!did || !reason || reason === 'not-found' || reason === 'unknown') return;

  const existingReason = hiddenAuthors.get(did);
  if (existingReason === 'blocked-by') return;

  if (!existingReason || reason === 'blocked-by')
    hiddenAuthors.set(did, reason);
}

function collectHiddenThreadAuthors(
  item: unknown,
  hiddenAuthors: HiddenThreadAuthors = new Map()
): HiddenThreadAuthors {
  if (isBlockedThreadItem(item)) {
    addHiddenThreadAuthor(
      hiddenAuthors,
      item.author.did,
      getUnavailableThreadReason(item)
    );
    return hiddenAuthors;
  }

  if (!isThreadViewItem(item)) return hiddenAuthors;

  addHiddenThreadAuthor(
    hiddenAuthors,
    item.post.author.did,
    getThreadPostUnavailableReason(item)
  );
  collectHiddenThreadAuthors(item.parent, hiddenAuthors);
  item.replies?.forEach((reply) =>
    collectHiddenThreadAuthors(reply, hiddenAuthors)
  );

  return hiddenAuthors;
}

function getUnavailableThreadUser(
  item: AppBskyFeedDefs.BlockedPost | AppBskyFeedDefs.NotFoundPost
): User {
  const authorDid = isBlockedThreadItem(item)
    ? item.author.did
    : `unknown:${item.uri}`;
  const existing = getCachedUser(authorDid);

  if (existing)
    return {
      ...existing,
      blocking: isBlockedThreadItem(item)
        ? !!item.author.viewer?.blocking || existing.blocking
        : existing.blocking,
      blockedBy: isBlockedThreadItem(item)
        ? !!item.author.viewer?.blockedBy || existing.blockedBy
        : existing.blockedBy
    };

  const now = Timestamp.now();

  return {
    id: authorDid,
    bio: null,
    pronouns: null,
    birthday: null,
    messageAllowIncoming: null,
    activityNotificationCategories: [],
    name: 'Unavailable',
    theme: null,
    accent: null,
    website: null,
    username: 'unavailable',
    photoURL: DEFAULT_PROFILE_PHOTO_URL,
    verified: false,
    following: [],
    followers: [],
    followingCount: 0,
    followersCount: 0,
    knownFollowers: [],
    knownFollowersCount: 0,
    muting: false,
    mutingByListName: null,
    blocking: isBlockedThreadItem(item)
      ? !!item.author.viewer?.blocking
      : false,
    blockedBy: isBlockedThreadItem(item)
      ? !!item.author.viewer?.blockedBy
      : false,
    blockingUri:
      isBlockedThreadItem(item) &&
      typeof item.author.viewer?.blocking === 'string'
        ? item.author.viewer.blocking
        : null,
    blockingByListName: null,
    createdAt: now,
    updatedAt: null,
    totalTweets: 0,
    totalPhotos: 0,
    pinnedTweet: null,
    coverPhotoURL: DEFAULT_PROFILE_COVER_URL
  };
}

function getUnavailableThreadParent(
  parent: unknown
): { id: string; username: string } | null {
  if (!isThreadItem(parent)) return null;

  return {
    id: postIdFromUri(isThreadViewItem(parent) ? parent.post.uri : parent.uri),
    username: isThreadViewItem(parent)
      ? parent.post.author.handle
      : 'unavailable'
  };
}

function mapUnavailableThreadItem(
  item: AppBskyFeedDefs.BlockedPost | AppBskyFeedDefs.NotFoundPost,
  parent?: unknown
): TweetWithUser {
  const createdAt = Timestamp.now();
  const unavailable = getUnavailableThreadReason(item);

  return {
    id: postIdFromUri(item.uri),
    text: null,
    langs: [],
    images: null,
    mediaWarning: null,
    card: null,
    quotedTweet: null,
    parent: getUnavailableThreadParent(parent),
    userLikes: [],
    createdBy: isBlockedThreadItem(item)
      ? item.author.did
      : `unknown:${item.uri}`,
    createdAt,
    updatedAt: null,
    userReplies: 0,
    userRetweets: [],
    userQuotes: 0,
    bookmarkCount: 0,
    replySetting: null,
    viewerCanReply: false,
    threadMuted: false,
    unavailable,
    user: getUnavailableThreadUser(item)
  };
}

function mapHiddenThreadPost(
  thread: AppBskyFeedDefs.ThreadViewPost,
  unavailable: TweetUnavailableReason
): TweetWithUser {
  const user = mapProfile(thread.post.author);

  return {
    id: postIdFromUri(thread.post.uri),
    text: null,
    langs: [],
    images: null,
    mediaWarning: null,
    card: null,
    quotedTweet: null,
    parent: getThreadParent(thread),
    userLikes: [],
    createdBy: thread.post.author.did,
    createdAt: getPostCreatedAt(thread.post.record, thread.post.indexedAt),
    updatedAt: null,
    userReplies: 0,
    userRetweets: [],
    userQuotes: 0,
    bookmarkCount: 0,
    replySetting: null,
    viewerCanReply: false,
    threadMuted: false,
    unavailable,
    user: {
      ...user,
      blocking: unavailable === 'blocked' || user.blocking,
      blockedBy: unavailable === 'blocked-by' || user.blockedBy
    }
  };
}

function mapThreadPost(
  thread: AppBskyFeedDefs.ThreadViewPost,
  hiddenAuthors?: HiddenThreadAuthors
): TweetWithUser {
  const unavailable =
    hiddenAuthors?.get(thread.post.author.did) ??
    getThreadPostUnavailableReason(thread);

  if (unavailable) return mapHiddenThreadPost(thread, unavailable);

  const user = mapProfile(thread.post.author);

  return {
    ...mapPost(thread.post, getThreadParent(thread)),
    user
  };
}

function mapThreadItem(
  item: ThreadItem,
  parent?: unknown,
  hiddenAuthors?: HiddenThreadAuthors
): TweetWithUser {
  if (isThreadViewItem(item)) return mapThreadPost(item, hiddenAuthors);
  if (isUnavailableThreadItem(item))
    return mapUnavailableThreadItem(item, parent);

  throw new Error('Unsupported thread item.');
}

function getThreadParentPosts(
  thread: AppBskyFeedDefs.ThreadViewPost
): ThreadItem[] {
  const parents: ThreadItem[] = [];
  let currentParent = thread.parent;

  while (isThreadItem(currentParent)) {
    parents.unshift(currentParent);
    if (!isThreadViewItem(currentParent)) break;
    currentParent = currentParent.parent;
  }

  return parents;
}

function mapVisibleThreadParents(
  parents: ThreadItem[],
  moderationOpts?: ModerationOpts | null,
  hiddenAuthors?: HiddenThreadAuthors
): TweetWithUser[] {
  return filterDeletedTweets(
    parents
      .filter((parent) =>
        isVisibleThreadItem(parent, moderationOpts ?? null, hiddenAuthors)
      )
      .map((parent) => mapThreadItem(parent, undefined, hiddenAuthors))
  );
}

function mapThreadParentPage(
  thread: AppBskyFeedDefs.ThreadViewPost,
  moderationOpts?: ModerationOpts | null,
  hiddenAuthors?: HiddenThreadAuthors
): TweetThreadParentsPage {
  const parentPosts = getThreadParentPosts(thread);
  const hasMoreParents = parentPosts.length > BSKY_THREAD_PARENT_PAGE_SIZE;
  const visibleParentPosts = hasMoreParents
    ? parentPosts.slice(1)
    : parentPosts;
  const parents = mapVisibleThreadParents(
    visibleParentPosts,
    moderationOpts,
    hiddenAuthors
  );

  return {
    parents,
    cursor: hasMoreParents ? parents[0]?.id ?? null : null
  };
}

function getVisibleThreadReplies(
  thread: AppBskyFeedDefs.ThreadViewPost,
  moderationOpts?: ModerationOpts | null,
  hiddenAuthors?: HiddenThreadAuthors
): ThreadItem[] {
  const replies: ThreadItem[] = [];

  for (const reply of thread.replies ?? []) {
    if (!isThreadItem(reply)) continue;
    if (!isVisibleThreadItem(reply, moderationOpts ?? null, hiddenAuthors))
      continue;
    replies.push(reply);
  }

  return replies;
}

function getThreadItemUri(item: ThreadItem): string {
  return isThreadViewItem(item) ? item.post.uri : item.uri;
}

function getThreadItemAuthorDid(item: ThreadItem): string | null {
  if (isThreadViewItem(item)) return item.post.author.did;
  if (isBlockedThreadItem(item)) return item.author.did;

  return null;
}

function getThreadItemCreatedAtTime(item: ThreadItem): number {
  return isThreadViewItem(item)
    ? getPostCreatedAt(item.post.record, item.post.indexedAt).toDate().getTime()
    : Number.MAX_SAFE_INTEGER;
}

function compareThreadItemsByCreatedAt(a: ThreadItem, b: ThreadItem): number {
  return (
    getThreadItemCreatedAtTime(a) - getThreadItemCreatedAtTime(b) ||
    getThreadItemUri(a).localeCompare(getThreadItemUri(b))
  );
}

function collectAuthorThreadReplies(
  thread: AppBskyFeedDefs.ThreadViewPost,
  authorDid: string,
  seenUris: Set<string>,
  moderationOpts?: ModerationOpts | null,
  hiddenAuthors?: HiddenThreadAuthors
): ThreadItem[] {
  const authorReplies = getVisibleThreadReplies(
    thread,
    moderationOpts,
    hiddenAuthors
  )
    .filter((reply) => getThreadItemAuthorDid(reply) === authorDid)
    .sort(compareThreadItemsByCreatedAt);
  const threadReplies: ThreadItem[] = [];

  authorReplies.forEach((reply) => {
    const uri = getThreadItemUri(reply);

    if (seenUris.has(uri)) return;

    seenUris.add(uri);
    threadReplies.push(
      reply,
      ...(isThreadViewItem(reply)
        ? collectAuthorThreadReplies(
            reply,
            authorDid,
            seenUris,
            moderationOpts,
            hiddenAuthors
          )
        : [])
    );
  });

  return threadReplies;
}

function mapThreadReplies(
  thread: AppBskyFeedDefs.ThreadViewPost,
  moderationOpts?: ModerationOpts | null,
  hiddenAuthors?: HiddenThreadAuthors
): {
  threadReplies: TweetWithUser[];
  replies: TweetWithUser[];
} {
  const threadReplyUris = new Set<string>();
  const authorThreadReplies = collectAuthorThreadReplies(
    thread,
    thread.post.author.did,
    threadReplyUris,
    moderationOpts,
    hiddenAuthors
  );
  const replies = getVisibleThreadReplies(
    thread,
    moderationOpts,
    hiddenAuthors
  ).filter((reply) => !threadReplyUris.has(getThreadItemUri(reply)));

  return {
    threadReplies: authorThreadReplies.map((reply) =>
      mapThreadItem(reply, thread, hiddenAuthors)
    ),
    replies: replies.map((reply) => mapThreadItem(reply, thread, hiddenAuthors))
  };
}

function getThreadV2Post(item: ThreadV2Item): AppBskyFeedDefs.PostView | null {
  if (!isThreadRecord(item.value)) return null;

  const value = item.value as { post?: unknown };
  if (!AppBskyFeedDefs.isPostView(value.post) || !isThreadRecord(value.post))
    return null;

  const post = value.post as AppBskyFeedDefs.PostView;
  return typeof post.uri === 'string' &&
    typeof post.cid === 'string' &&
    typeof post.indexedAt === 'string' &&
    isThreadRecord(post.author) &&
    isThreadRecord(post.record)
    ? post
    : null;
}

function getThreadV2PostValue(
  item: ThreadV2Item
): AppBskyUnspeccedDefs.ThreadItemPost | null {
  if (!isThreadRecord(item.value)) return null;
  if (!('post' in item.value)) return null;

  return item.value as AppBskyUnspeccedDefs.ThreadItemPost;
}

function getThreadV2PostCreatedAtTime(item: ThreadV2Item): number {
  const post = getThreadV2Post(item);

  return post
    ? getPostCreatedAt(post.record, post.indexedAt).toDate().getTime()
    : Number.MAX_SAFE_INTEGER;
}

function compareThreadV2Items(a: ThreadV2Item, b: ThreadV2Item): number {
  return (
    a.depth - b.depth ||
    getThreadV2PostCreatedAtTime(a) - getThreadV2PostCreatedAtTime(b) ||
    a.uri.localeCompare(b.uri)
  );
}

function mapAuthorThreadRepliesFromThreadV2Items(
  items: ThreadV2Item[],
  rootTweet: TweetWithUser,
  moderationOpts?: ModerationOpts | null
): TweetWithUser[] {
  const parent = { id: rootTweet.id, username: rootTweet.user.username };
  const seenIds = new Set<string>();
  const replies: TweetWithUser[] = [];

  for (const item of [...items].sort(compareThreadV2Items)) {
    if (item.depth <= 0 || item.uri === uriFromPostId(rootTweet.id)) continue;

    const value = getThreadV2PostValue(item);
    const post = getThreadV2Post(item);
    if (!value || !post) continue;
    if (!value.opThread || value.hiddenByThreadgate) continue;
    if (post.author.did !== rootTweet.createdBy) continue;
    if (isModerationFilteredWithoutTombstone(post, moderationOpts ?? null))
      continue;

    const id = postIdFromUri(post.uri);
    if (seenIds.has(id) || locallyDeletedTweetIds.has(id)) continue;

    seenIds.add(id);
    replies.push(mapPostWithUser(post, parent));
  }

  return replies;
}

function mergeThreadRepliesByFullThreadOrder(
  baseReplies: TweetWithUser[],
  fullReplies: TweetWithUser[]
): TweetWithUser[] {
  const baseById = new Map(baseReplies.map((reply) => [reply.id, reply]));
  const hasNewReply = fullReplies.some((reply) => !baseById.has(reply.id));

  if (!hasNewReply && fullReplies.length <= baseReplies.length)
    return baseReplies;

  const seenIds = new Set<string>();
  const merged = fullReplies.map((reply) => {
    seenIds.add(reply.id);
    return baseById.get(reply.id) ?? reply;
  });

  for (const reply of baseReplies) {
    if (!seenIds.has(reply.id)) merged.push(reply);
  }

  return merged;
}

function getReaderModeRootTweet(page: TweetThreadPage): TweetWithUser {
  return page.parents[0] ?? page.tweet;
}

function getReplyRefUri(
  record: unknown,
  refKey: 'root' | 'parent'
): string | null {
  if (!isThreadRecord(record)) return null;

  const { reply } = record;
  if (!isThreadRecord(reply)) return null;

  const ref = reply[refKey];
  if (!isThreadRecord(ref)) return null;

  return typeof ref.uri === 'string' ? ref.uri : null;
}

function getPostReplyRootUri(post: AppBskyFeedDefs.PostView): string | null {
  return getReplyRefUri(post.record, 'root');
}

function getPostReplyParentUri(post: AppBskyFeedDefs.PostView): string | null {
  return getReplyRefUri(post.record, 'parent');
}

function compareAuthorFeedItemsByCreatedAt(
  a: ActorFeedPost,
  b: ActorFeedPost
): number {
  return (
    getPostCreatedAt(a.post.record, a.post.indexedAt).toDate().getTime() -
      getPostCreatedAt(b.post.record, b.post.indexedAt).toDate().getTime() ||
    a.post.uri.localeCompare(b.post.uri)
  );
}

function getAuthorFeedItemParent(
  item: ActorFeedPost,
  rootTweet: TweetWithUser
): { id: string; username: string } | null {
  if (item.reply?.parent && AppBskyFeedDefs.isPostView(item.reply.parent))
    return {
      id: postIdFromUri(item.reply.parent.uri),
      username: item.reply.parent.author.handle
    };

  const parentUri = getPostReplyParentUri(item.post);

  return parentUri
    ? { id: postIdFromUri(parentUri), username: rootTweet.user.username }
    : null;
}

async function getReaderAuthorFeedItems(
  actor: string
): Promise<{ items: ActorFeedPost[]; moderationOpts: ModerationOpts | null }> {
  const moderationOpts = await getSafeModerationOpts();
  const items: ActorFeedPost[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < BSKY_READER_AUTHOR_FEED_MAX_PAGES; page++) {
    const response = await getAppViewAgent().getAuthorFeed({
      actor,
      filter: 'posts_with_replies',
      limit: BSKY_READER_AUTHOR_FEED_LIMIT,
      cursor
    });

    items.push(...response.data.feed);
    cursor = response.data.cursor;

    if (!cursor) break;
  }

  return { items, moderationOpts };
}

function selectReaderThreadItemsFromAuthorFeed(
  items: ActorFeedPost[],
  rootUri: string,
  authorDid: string,
  moderationOpts: ModerationOpts | null
): ActorFeedPost[] {
  const candidates = items
    .filter(({ post }) => {
      if (post.author.did !== authorDid) return false;
      if (post.uri === rootUri) return false;
      if (getPostReplyRootUri(post) !== rootUri) return false;
      return !isModerationFilteredWithoutTombstone(post, moderationOpts);
    })
    .sort(compareAuthorFeedItemsByCreatedAt);
  const byParentUri = new Map<string, ActorFeedPost[]>();

  for (const item of candidates) {
    const parentUri = getPostReplyParentUri(item.post);
    if (!parentUri) continue;

    const parentItems = byParentUri.get(parentUri) ?? [];
    parentItems.push(item);
    byParentUri.set(parentUri, parentItems);
  }

  byParentUri.forEach((parentItems) => {
    parentItems.sort(compareAuthorFeedItemsByCreatedAt);
  });

  const selected: ActorFeedPost[] = [];
  const seenUris = new Set<string>();
  let currentUri = rootUri;

  while (currentUri) {
    const nextItem = byParentUri
      .get(currentUri)
      ?.find((item) => !seenUris.has(item.post.uri));

    if (!nextItem) break;

    selected.push(nextItem);
    seenUris.add(nextItem.post.uri);
    currentUri = nextItem.post.uri;
  }

  for (const item of candidates) {
    if (seenUris.has(item.post.uri)) continue;

    selected.push(item);
    seenUris.add(item.post.uri);
  }

  return selected;
}

async function getFullThreadRepliesFromAuthorFeed(
  page: TweetThreadPage
): Promise<TweetWithUser[]> {
  try {
    const rootTweet = getReaderModeRootTweet(page);
    const rootUri = uriFromPostId(rootTweet.id);
    const { items, moderationOpts } = await getReaderAuthorFeedItems(
      rootTweet.createdBy
    );

    return selectReaderThreadItemsFromAuthorFeed(
      items,
      rootUri,
      rootTweet.createdBy,
      moderationOpts
    ).map((item) =>
      mapPostWithUser(item.post, getAuthorFeedItemParent(item, rootTweet))
    );
  } catch {
    return [];
  }
}

async function getFullThreadV2Items(uri: string): Promise<ThreadV2Item[]> {
  const api = getAppViewAgent().app.bsky.unspecced;
  const response = await api.getPostThreadV2({
    anchor: uri,
    above: true,
    below: BSKY_THREAD_FULL_REPLY_DEPTH,
    branchingFactor: BSKY_THREAD_FULL_REPLY_DEPTH,
    sort: 'oldest'
  });
  const items: ThreadV2Item[] = [...response.data.thread];

  if (response.data.hasOtherReplies) {
    const otherResponse = await api
      .getPostThreadOtherV2({ anchor: uri })
      .catch(() => null);

    if (otherResponse) items.push(...otherResponse.data.thread);
  }

  return items;
}

async function getFullThreadRepliesFromThreadV2(
  page: TweetThreadPage,
  uri: string
): Promise<TweetWithUser[]> {
  try {
    const moderationOpts = await getSafeModerationOpts();
    const items = await getFullThreadV2Items(uri);
    return mapAuthorThreadRepliesFromThreadV2Items(
      items,
      page.tweet,
      moderationOpts
    );
  } catch {
    return [];
  }
}

async function getThreadWithPublicSkeleton(
  thread: unknown,
  hiddenAuthors: HiddenThreadAuthors,
  params: { uri: string; depth: number; parentHeight: number }
): Promise<unknown> {
  if (!hiddenAuthors.size) return thread;

  const publicThread = (
    await getPublicAppViewAgent()
      .getPostThread(params)
      .catch(() => null)
  )?.data.thread;

  return isThreadItem(publicThread) ? publicThread : thread;
}

function postHasVisibleMedia(post: AppBskyFeedDefs.PostView): boolean {
  return !!mapMedia(post.embed)?.length;
}

async function waitForPublishedPost(
  uri: string,
  requiredMediaLabel?: 'image' | 'video'
): Promise<Tweet> {
  let lastError: unknown = null;

  for (
    let attempt = 0;
    attempt < BSKY_MEDIA_POST_VISIBILITY_RETRIES;
    attempt += 1
  ) {
    try {
      const post = (await fetchAppViewPosts([uri])).posts[0];

      if (post && (!requiredMediaLabel || postHasVisibleMedia(post)))
        return mapPost(post);
    } catch (error) {
      lastError = error;
    }

    await wait(700 + attempt * 200);
  }

  if (requiredMediaLabel) {
    throw new Error(
      `Bluesky accepted the Tweet, but did not publish its attached ${requiredMediaLabel}. Try a smaller file.`
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Bluesky did not publish the Tweet.');
}

function mapFeedItem(item: ActorFeedPost): Tweet {
  const parent =
    item.reply?.parent && AppBskyFeedDefs.isPostView(item.reply.parent)
      ? {
          id: postIdFromUri(item.reply.parent.uri),
          username: item.reply.parent.author.handle
        }
      : null;

  const tweet = mapPost(item.post, parent);

  if (item.reason && AppBskyFeedDefs.isReasonRepost(item.reason)) {
    const repostedBy = item.reason.by.did;

    if (!tweet.userRetweets.includes(repostedBy))
      tweet.userRetweets = [repostedBy, ...tweet.userRetweets];
  }

  return tweet;
}

function mapFeedItemWithUser(item: ActorFeedPost): TweetWithUser {
  const parent =
    item.reply?.parent && AppBskyFeedDefs.isPostView(item.reply.parent)
      ? {
          id: postIdFromUri(item.reply.parent.uri),
          username: item.reply.parent.author.handle
        }
      : null;
  const tweet = mapPostWithUser(item.post, parent);

  if (item.reason && AppBskyFeedDefs.isReasonRepost(item.reason)) {
    const repostedBy = item.reason.by.did;

    if (!tweet.userRetweets.includes(repostedBy))
      tweet.userRetweets = [repostedBy, ...tweet.userRetweets];
  }

  return tweet;
}

async function mapFeedItemsWithUsers(
  items: ActorFeedPost[]
): Promise<TweetWithUser[]> {
  const moderationOpts = await getSafeModerationOpts();
  const visibleItems = filterVisibleFeedItems(items, moderationOpts);
  const feed = visibleItems.map((item) => {
    const tweet = mapFeedItem(item);
    return { item, tweet };
  });
  const users = await hydrateProfiles(feed.map(({ item }) => item.post.author));
  const usersByDid = new Map<string, User>();

  users.forEach((user) => {
    usersByDid.set(user.id, user);
  });

  return filterDeletedTweets(
    feed.map(({ item, tweet }) => ({
      ...tweet,
      user: usersByDid.get(tweet.createdBy) ?? mapProfile(item.post.author)
    }))
  );
}

function filterDeletedTweets<T extends Tweet>(tweets: T[]): T[] {
  return tweets.filter(({ id }) => !locallyDeletedTweetIds.has(id));
}

function getLocalCreatedTweets(
  predicate: (tweet: Tweet) => boolean = (): boolean => true
): Tweet[] {
  return Array.from(locallyCreatedTweets.values())
    .filter(({ id }) => !locallyDeletedTweetIds.has(id))
    .filter(predicate);
}

function mergeLocalCreatedTweets<T extends Tweet>(
  tweets: T[],
  predicate?: (tweet: Tweet) => boolean
): Tweet[] {
  const visibleTweets = filterDeletedTweets(tweets);
  const seenIds = new Set(visibleTweets.map(({ id }) => id));
  const localTweets = getLocalCreatedTweets(predicate).filter(
    ({ id }) => !seenIds.has(id)
  );

  return [...sortByCreatedAt(localTweets), ...visibleTweets];
}

function getLocalTweetUser(tweet: Tweet): User | null {
  return (
    getCachedUser(tweet.createdBy) ??
    (tweet.createdBy === currentUser?.id ? currentUser : null)
  );
}

function mergeLocalCreatedTweetsWithUsers(
  tweets: TweetWithUser[],
  predicate?: (tweet: Tweet) => boolean
): TweetWithUser[] {
  const visibleTweets = filterDeletedTweets(tweets);
  const seenIds = new Set(visibleTweets.map(({ id }) => id));
  const localTweets = getLocalCreatedTweets(predicate)
    .filter(({ id }) => !seenIds.has(id))
    .map((tweet): TweetWithUser | null => {
      const user = getLocalTweetUser(tweet);
      return user ? { ...tweet, user } : null;
    })
    .filter((tweet): tweet is TweetWithUser => !!tweet);

  return [...sortByCreatedAt(localTweets), ...visibleTweets];
}

function mergeLocalCreatedQuotes(
  tweets: TweetWithUser[],
  targetTweetId: string
): TweetWithUser[] {
  return mergeLocalCreatedTweetsWithUsers(
    tweets,
    (tweet) => localQuoteTargetIds.get(tweet.id) === targetTweetId
  );
}

function isFollowedAuthor(tweet: Tweet): boolean {
  return (
    tweet.createdBy === sessionDid || currentFollowing.has(tweet.createdBy)
  );
}

function hasPhoto(tweet: Tweet): boolean {
  return !!tweet.images?.some((media) => !media.type?.includes('video'));
}

function hasVideo(tweet: Tweet): boolean {
  return !!tweet.images?.some((media) => media.type?.includes('video'));
}

export async function searchTweets(
  searchQuery: string,
  options?: {
    filter?: SearchPostFilter;
    people?: SearchPeopleFilter;
    cursor?: string;
    limit?: number;
  }
): Promise<SearchTweetsPage> {
  const trimmedQuery = searchQuery.trim();

  if (!trimmedQuery) return { tweets: [], cursor: null, hitsTotal: 0 };

  const filter = options?.filter ?? 'top';
  const apiLimit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const moderationOpts = await getSafeModerationOpts();
  const response = await fetchAppViewSearchPosts({
    q: trimmedQuery,
    sort: filter === 'latest' ? 'latest' : 'top',
    cursor: options?.cursor,
    limit: filter === 'photos' || filter === 'videos' ? 100 : apiLimit
  });

  const posts = filterVisiblePostViews(response.posts, moderationOpts).map(
    (post) => ({
      post,
      tweet: mapPost(post)
    })
  );
  const users = await hydrateProfiles(posts.map(({ post }) => post.author));
  const usersByDid = new Map<string, User>();

  users.forEach((user) => {
    usersByDid.set(user.id, user);
  });

  const tweets = posts
    .map(({ post, tweet }) => ({
      ...tweet,
      user: usersByDid.get(tweet.createdBy) ?? mapProfile(post.author)
    }))
    .filter((tweet) =>
      options?.people === 'followed' ? isFollowedAuthor(tweet) : true
    )
    .filter((tweet) => {
      if (filter === 'photos') return hasPhoto(tweet);
      if (filter === 'videos') return hasVideo(tweet);
      return true;
    })
    .slice(0, apiLimit);

  return {
    tweets,
    cursor: response.cursor ?? null,
    hitsTotal: response.hitsTotal ?? null
  };
}

export async function searchUsers(
  searchQuery: string,
  options?: {
    people?: SearchPeopleFilter;
    cursor?: string;
    limit?: number;
  }
): Promise<SearchUsersPage> {
  const trimmedQuery = searchQuery.trim();

  if (!trimmedQuery) return { users: [], cursor: null };

  const response = await getAppViewAgent().searchActors({
    q: trimmedQuery,
    cursor: options?.cursor,
    limit: Math.min(Math.max(options?.limit ?? 30, 1), 100)
  });
  const users = await hydrateProfiles(response.data.actors);

  return {
    users:
      options?.people === 'followed'
        ? users.filter(
            (user) => user.id === sessionDid || currentFollowing.has(user.id)
          )
        : users,
    cursor: response.data.cursor ?? null
  };
}

function mapGraphList(
  list: AppBskyGraphDefs.ListView,
  viewerState?: Partial<Pick<UserList, 'viewerMuted' | 'viewerBlocked'>>
): UserList {
  const creatorName = list.creator.displayName ?? list.creator.handle;

  return {
    uri: list.uri,
    url: getBskyWebUrl(list.uri),
    name: list.name,
    description: list.description ?? null,
    avatar: list.avatar ?? null,
    purpose:
      list.purpose === AppBskyGraphDefs.MODLIST ? 'moderation' : 'follow',
    listItemCount: list.listItemCount ?? 0,
    creatorName,
    creatorUsername: list.creator.handle,
    creatorAvatar: list.creator.avatar ?? DEFAULT_PROFILE_PHOTO_URL,
    viewerMuted: viewerState?.viewerMuted ?? !!list.viewer?.muted,
    viewerBlocked: viewerState?.viewerBlocked ?? !!list.viewer?.blocked,
    indexedAt: list.indexedAt ?? null
  };
}

async function getRealListItemCount(listUri: string): Promise<number | null> {
  let cursor: string | undefined;
  let itemCount = 0;

  do {
    const response = await callPublicFallbackAppQueryXrpc<AppViewListResponse>(
      'app.bsky.graph.getList',
      {
        list: listUri,
        cursor,
        limit: 100
      }
    );

    if (typeof response.list.listItemCount === 'number')
      return response.list.listItemCount;

    itemCount += response.items.length;
    cursor = response.cursor;
  } while (cursor);

  return itemCount;
}

async function hydrateGraphListCount(
  list: AppBskyGraphDefs.ListView
): Promise<AppBskyGraphDefs.ListView> {
  if (typeof list.listItemCount === 'number') return list;

  const listItemCount = await getRealListItemCount(list.uri).catch(() => null);

  return typeof listItemCount === 'number' ? { ...list, listItemCount } : list;
}

function mergeUserLists(lists: UserList[]): UserList[] {
  const mergedLists = new Map<string, UserList>();

  for (const list of lists) {
    const existingList = mergedLists.get(list.uri);

    mergedLists.set(
      list.uri,
      existingList
        ? {
            ...existingList,
            viewerMuted: existingList.viewerMuted || list.viewerMuted,
            viewerBlocked: existingList.viewerBlocked || list.viewerBlocked
          }
        : list
    );
  }

  return Array.from(mergedLists.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

type ProfileStarterPackView =
  | AppBskyGraphDefs.StarterPackViewBasic
  | AppBskyGraphDefs.StarterPackView;

function getStarterPackListItemCount(
  starterPack: ProfileStarterPackView
): number {
  if (
    'list' in starterPack &&
    typeof starterPack.list?.listItemCount === 'number'
  )
    return starterPack.list.listItemCount;

  if (
    'listItemCount' in starterPack &&
    typeof starterPack.listItemCount === 'number'
  )
    return starterPack.listItemCount;

  return 0;
}

function getStarterPackFeedCount(starterPack: ProfileStarterPackView): number {
  if ('feeds' in starterPack && Array.isArray(starterPack.feeds))
    return starterPack.feeds.length;

  return getStarterPackRecordFeedCount(starterPack.record);
}

async function hydrateStarterPackCount(
  starterPack: AppBskyGraphDefs.StarterPackViewBasic
): Promise<ProfileStarterPackView> {
  if (typeof starterPack.listItemCount === 'number') return starterPack;

  const hydratedStarterPack =
    await callPublicFallbackAppQueryXrpc<AppViewStarterPackResponse>(
      'app.bsky.graph.getStarterPack',
      {
        starterPack: starterPack.uri
      }
    )
      .then(({ starterPack }) => starterPack)
      .catch(() => starterPack as ProfileStarterPackView);

  if (
    'list' in hydratedStarterPack &&
    hydratedStarterPack.list &&
    typeof hydratedStarterPack.list.listItemCount !== 'number'
  ) {
    const listItemCount = await getRealListItemCount(
      hydratedStarterPack.list.uri
    ).catch(() => null);

    if (typeof listItemCount === 'number')
      return {
        ...hydratedStarterPack,
        list: { ...hydratedStarterPack.list, listItemCount }
      };
  }

  return hydratedStarterPack;
}

function mapStarterPack(
  starterPack: ProfileStarterPackView
): ProfileStarterPack {
  const creatorName =
    starterPack.creator.displayName ?? starterPack.creator.handle;

  return {
    uri: starterPack.uri,
    url: getBskyWebUrl(starterPack.uri),
    name: getStarterPackName(starterPack.record) ?? 'Starter Pack',
    description: getStarterPackDescription(starterPack.record),
    creatorName,
    creatorUsername: starterPack.creator.handle,
    creatorAvatar: starterPack.creator.avatar ?? DEFAULT_PROFILE_PHOTO_URL,
    listItemCount: getStarterPackListItemCount(starterPack),
    feedCount: getStarterPackFeedCount(starterPack),
    joinedWeekCount: starterPack.joinedWeekCount ?? 0,
    joinedAllTimeCount: starterPack.joinedAllTimeCount ?? 0,
    indexedAt: starterPack.indexedAt
  };
}

export async function getUserLists(tab: UserListTab): Promise<UserListsPage> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');

  const api = getAppViewAgent();
  const ownedListsResponse = await api.app.bsky.graph.getLists({
    actor: sessionDid,
    limit: 100
  });
  const ownedLists = ownedListsResponse.data.lists.map((list) =>
    mapGraphList(list)
  );

  if (tab === 'follow')
    return {
      lists: ownedLists.filter(({ purpose }) => purpose === 'follow')
    };

  const [mutedListsResponse, blockedListsResponse] = await Promise.all([
    api.app.bsky.graph.getListMutes({ limit: 100 }).catch(() => null),
    api.app.bsky.graph.getListBlocks({ limit: 100 }).catch(() => null)
  ]);
  const mutedLists =
    mutedListsResponse?.data.lists.map((list) =>
      mapGraphList(list, { viewerMuted: true })
    ) ?? [];
  const blockedLists =
    blockedListsResponse?.data.lists.map((list) =>
      mapGraphList(list, { viewerBlocked: true })
    ) ?? [];
  const moderationLists = ownedLists.filter(
    ({ purpose }) => purpose === 'moderation'
  );

  return {
    lists: mergeUserLists([...moderationLists, ...mutedLists, ...blockedLists])
  };
}

export async function getProfileLists(
  actor: string,
  cursor?: string,
  limit = 50
): Promise<ProfileListsPage> {
  const response = await callPublicFallbackAppQueryXrpc<AppViewListsResponse>(
    'app.bsky.graph.getLists',
    {
      actor,
      cursor,
      limit: clampAppViewLimit(limit)
    }
  );
  const lists = await Promise.all(response.lists.map(hydrateGraphListCount));

  return {
    lists: lists.map((list) => mapGraphList(list)),
    cursor: response.cursor ?? null
  };
}

export async function getProfileStarterPacks(
  actor: string,
  cursor?: string,
  limit = 50
): Promise<ProfileStarterPacksPage> {
  const response =
    await callPublicFallbackAppQueryXrpc<AppViewActorStarterPacksResponse>(
      'app.bsky.graph.getActorStarterPacks',
      {
        actor,
        cursor,
        limit: clampAppViewLimit(limit)
      }
    );
  const starterPacks = await Promise.all(
    response.starterPacks.map(hydrateStarterPackCount)
  );

  return {
    starterPacks: starterPacks.map((starterPack) =>
      mapStarterPack(starterPack)
    ),
    cursor: response.cursor ?? null
  };
}

export async function getFeedGeneratorPage(
  actor: string,
  rkey: string,
  cursor?: string,
  limit = 25
): Promise<FeedGeneratorPage> {
  const profile =
    await callPublicFallbackAppQueryXrpc<AppBskyActorDefs.ProfileViewDetailed>(
      'app.bsky.actor.getProfile',
      { actor }
    );
  const feedUri = `at://${profile.did}/app.bsky.feed.generator/${rkey}`;

  const [metadataResponse, feedResponse] = await Promise.all([
    callPublicFallbackAppQueryXrpc<AppViewFeedGeneratorResponse>(
      'app.bsky.feed.getFeedGenerator',
      { feed: feedUri }
    ),
    fetchAppViewFeed(feedUri, cursor, limit)
  ]);

  return {
    uri: feedUri,
    displayName: metadataResponse.view.displayName,
    description: metadataResponse.view.description ?? null,
    avatar: metadataResponse.view.avatar ?? null,
    likeCount: metadataResponse.view.likeCount ?? 0,
    cursor: feedResponse.cursor ?? null,
    feed: await mapFeedItemsWithUsers(feedResponse.feed)
  };
}

const DISCOVER_HOME_FEED_ACTOR = 'bsky.app';
const DISCOVER_HOME_FEED_RKEY = 'whats-hot';
export const DISCOVER_HOME_FEED_HREF = `/profile/${DISCOVER_HOME_FEED_ACTOR}/feed/${DISCOVER_HOME_FEED_RKEY}`;
let discoverHomeFeedUriPromise: Promise<string> | null = null;

async function getDiscoverHomeFeedUri(): Promise<string> {
  if (discoverHomeFeedUriPromise) return discoverHomeFeedUriPromise;

  discoverHomeFeedUriPromise =
    callPublicFallbackAppQueryXrpc<AppBskyActorDefs.ProfileViewDetailed>(
      'app.bsky.actor.getProfile',
      { actor: DISCOVER_HOME_FEED_ACTOR }
    )
      .then((profile) => {
        ensureValidDid(profile.did);
        return `at://${profile.did}/app.bsky.feed.generator/${DISCOVER_HOME_FEED_RKEY}`;
      })
      .catch((error) => {
        discoverHomeFeedUriPromise = null;
        throw error;
      });

  return discoverHomeFeedUriPromise;
}

export async function getDiscoverHomeFeedPage(
  cursor?: string,
  limit = 30
): Promise<HomeFeedPage> {
  const feedUri = await getDiscoverHomeFeedUri();
  const response = await fetchAppViewFeed(feedUri, cursor, limit);

  return {
    tweets: mergeLocalCreatedTweetsWithUsers(
      await mapFeedItemsWithUsers(response.feed)
    ),
    cursor: response.cursor ?? null
  };
}

function isFeedGeneratorUri(uri: string): boolean {
  return /^at:\/\/[^/]+\/app\.bsky\.feed\.generator\/[^/]+$/.test(uri);
}

function isFeedListUri(uri: string): boolean {
  return /^at:\/\/[^/]+\/app\.bsky\.graph\.list\/[^/]+$/.test(uri);
}

function getFeedGeneratorFallbackName(uri: string): string {
  const rkey = getRkeyFromAtUri(uri);
  if (!rkey) return 'Feed';

  return rkey
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isReservedHomeFeed(
  savedFeed: AppBskyActorDefs.SavedFeed,
  generator?: AppBskyFeedDefs.GeneratorView
): boolean {
  if (savedFeed.type === 'timeline') return true;
  if (savedFeed.type !== 'feed') return false;

  if (getRkeyFromAtUri(savedFeed.value) !== DISCOVER_HOME_FEED_RKEY)
    return false;

  return (
    generator?.creator.handle === DISCOVER_HOME_FEED_ACTOR ||
    getRepoFromAtUri(savedFeed.value) === DISCOVER_HOME_FEED_ACTOR
  );
}

function getFeedGeneratorHref(
  feedUri: string,
  generator?: AppBskyFeedDefs.GeneratorView
): string {
  const actor = generator?.creator.handle ?? getRepoFromAtUri(feedUri);
  const rkey = getRkeyFromAtUri(feedUri);

  if (!actor || !rkey) return getBskyWebUrl(feedUri);

  return `/profile/${encodeURIComponent(actor)}/feed/${encodeURIComponent(
    rkey
  )}`;
}

function mapSubscribedHomeFeed(
  savedFeed: AppBskyActorDefs.SavedFeed,
  generator?: AppBskyFeedDefs.GeneratorView
): SubscribedHomeFeed {
  if (savedFeed.type === 'timeline')
    return {
      id: savedFeed.id,
      type: 'timeline',
      uri: savedFeed.value,
      displayName: 'Following',
      description: null,
      avatar: null,
      creatorName: 'Bluesky',
      creatorUsername: 'bsky.app',
      pinned: savedFeed.pinned
    };

  return {
    id: savedFeed.id,
    type: 'feed',
    uri: savedFeed.value,
    displayName:
      generator?.displayName ?? getFeedGeneratorFallbackName(savedFeed.value),
    description: generator?.description ?? null,
    avatar: generator?.avatar ?? null,
    creatorName: generator?.creator.displayName ?? 'Bluesky',
    creatorUsername: generator?.creator.handle ?? 'bsky.app',
    pinned: savedFeed.pinned
  };
}

function mapFeedBrowserFeed(
  savedFeed: AppBskyActorDefs.SavedFeed | null,
  generator: AppBskyFeedDefs.GeneratorView
): FeedBrowserFeed {
  const feedId = savedFeed?.id ?? generator.uri;
  const pinned = savedFeed?.pinned ?? false;
  const reserved = savedFeed ? isReservedHomeFeed(savedFeed, generator) : false;

  return {
    id: feedId,
    type: 'feed',
    uri: generator.uri,
    displayName: generator.displayName,
    description: generator.description ?? null,
    avatar: generator.avatar ?? null,
    creatorName: generator.creator.displayName ?? generator.creator.handle,
    creatorUsername: generator.creator.handle,
    pinned,
    editable: !!savedFeed && !reserved,
    href: getFeedGeneratorHref(generator.uri, generator),
    indexedAt: generator.indexedAt ?? null,
    likeCount: generator.likeCount ?? 0,
    saved: !!savedFeed
  };
}

function mapSavedFeedBrowserFallback(
  savedFeed: AppBskyActorDefs.SavedFeed
): FeedBrowserFeed {
  const displayName = getFeedGeneratorFallbackName(savedFeed.value);

  return {
    id: savedFeed.id,
    type: 'feed',
    uri: savedFeed.value,
    displayName,
    description: null,
    avatar: null,
    creatorName: 'Bluesky',
    creatorUsername: getRepoFromAtUri(savedFeed.value) ?? 'bsky.app',
    pinned: savedFeed.pinned,
    editable: !isReservedHomeFeed(savedFeed),
    href: getFeedGeneratorHref(savedFeed.value),
    indexedAt: null,
    likeCount: 0,
    saved: true
  };
}

async function getFeedGeneratorsByUri(
  feedUris: string[]
): Promise<Map<string, AppBskyFeedDefs.GeneratorView>> {
  const generators = new Map<string, AppBskyFeedDefs.GeneratorView>();

  for (let index = 0; index < feedUris.length; index += 25) {
    const feeds = feedUris.slice(index, index + 25);

    try {
      const response =
        await callPublicFallbackAppQueryXrpc<AppViewFeedGeneratorsResponse>(
          'app.bsky.feed.getFeedGenerators',
          { feeds }
        );

      for (const generator of response.feeds)
        generators.set(generator.uri, generator);
    } catch {
      // Saved feeds can include stale or unavailable generators; keep the rest.
    }
  }

  return generators;
}

function getLegacySavedFeed(
  uri: string,
  pinned: boolean
): AppBskyActorDefs.SavedFeed | null {
  const type = isFeedGeneratorUri(uri)
    ? 'feed'
    : isFeedListUri(uri)
    ? 'list'
    : null;

  if (!type) return null;

  return {
    id: uri,
    type,
    value: uri,
    pinned
  };
}

function isSavedFeedItem(value: unknown): value is AppBskyActorDefs.SavedFeed {
  if (!isPlainObject(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.value === 'string' &&
    typeof value.pinned === 'boolean'
  );
}

function isSavedFeedsPrefV2Preference(
  value: unknown
): value is AppBskyActorDefs.SavedFeedsPrefV2 {
  return (
    isPlainObject(value) &&
    value.$type === 'app.bsky.actor.defs#savedFeedsPrefV2' &&
    Array.isArray(value.items)
  );
}

function isSavedFeedsPrefPreference(
  value: unknown
): value is AppBskyActorDefs.SavedFeedsPref {
  return (
    isPlainObject(value) &&
    value.$type === 'app.bsky.actor.defs#savedFeedsPref' &&
    Array.isArray(value.pinned) &&
    Array.isArray(value.saved)
  );
}

function findLastSavedFeedsPrefV2(
  preferences: AppBskyActorDefs.Preferences
): AppBskyActorDefs.SavedFeedsPrefV2 | null {
  for (let index = preferences.length - 1; index >= 0; index -= 1) {
    const preference = preferences[index];

    if (isSavedFeedsPrefV2Preference(preference)) return preference;
  }

  return null;
}

function findLastSavedFeedsPref(
  preferences: AppBskyActorDefs.Preferences
): AppBskyActorDefs.SavedFeedsPref | null {
  for (let index = preferences.length - 1; index >= 0; index -= 1) {
    const preference = preferences[index];

    if (isSavedFeedsPrefPreference(preference)) return preference;
  }

  return null;
}

function uniqueSavedFeedItems(
  items: AppBskyActorDefs.SavedFeed[]
): AppBskyActorDefs.SavedFeed[] {
  const seenIds = new Set<string>();
  const seenValues = new Set<string>();
  const savedFeeds: AppBskyActorDefs.SavedFeed[] = [];

  for (const item of items) {
    if (seenIds.has(item.id) || seenValues.has(item.value)) continue;

    seenIds.add(item.id);
    seenValues.add(item.value);
    savedFeeds.push(item);
  }

  return savedFeeds;
}

function getSavedFeedItemsFromPreferences(
  preferences: AppBskyActorDefs.Preferences
): AppBskyActorDefs.SavedFeed[] {
  const v2Preference = findLastSavedFeedsPrefV2(preferences);

  if (v2Preference)
    return uniqueSavedFeedItems(v2Preference.items.filter(isSavedFeedItem));

  const legacyPreference = findLastSavedFeedsPref(preferences);
  if (!legacyPreference) return [];

  const legacyFeeds = [
    ...legacyPreference.pinned.map((uri) => getLegacySavedFeed(uri, true)),
    ...legacyPreference.saved.map((uri) =>
      getLegacySavedFeed(uri, legacyPreference.pinned.includes(uri))
    )
  ].filter((feed): feed is AppBskyActorDefs.SavedFeed => !!feed);

  return uniqueSavedFeedItems(legacyFeeds);
}

function getSavedHomeFeedsFromPreferences(
  preferences: AppBskyActorDefs.Preferences
): AppBskyActorDefs.SavedFeed[] {
  return getSavedFeedItemsFromPreferences(preferences).filter(
    (feed) => feed.type === 'feed' && isFeedGeneratorUri(feed.value)
  );
}

async function getSavedFeedState(): Promise<{
  items: AppBskyActorDefs.SavedFeed[];
  preferences: AppBskyActorDefs.Preferences;
}> {
  const response = await getAgent().app.bsky.actor.getPreferences();
  const preferences = response.data.preferences;

  return {
    items: getSavedFeedItemsFromPreferences(preferences),
    preferences
  };
}

function getSavedFeedUriArrays(items: AppBskyActorDefs.SavedFeed[]): {
  pinned: string[];
  saved: string[];
} {
  const pinned: string[] = [];
  const saved: string[] = [];

  for (const item of items) {
    if (item.type !== 'feed' && item.type !== 'list') continue;

    saved.push(item.value);
    if (item.pinned) pinned.push(item.value);
  }

  return { pinned, saved };
}

async function putSavedFeedItems(
  preferences: AppBskyActorDefs.Preferences,
  items: AppBskyActorDefs.SavedFeed[]
): Promise<void> {
  const savedFeedsPrefV2: AppBskyActorDefs.SavedFeedsPrefV2 = {
    $type: 'app.bsky.actor.defs#savedFeedsPrefV2',
    items: uniqueSavedFeedItems(items)
  };
  const savedFeedsPref = findLastSavedFeedsPref(preferences);
  const updatedPreferences: AppBskyActorDefs.Preferences = [
    ...preferences.filter(
      (preference) => !isSavedFeedsPrefV2Preference(preference)
    ),
    savedFeedsPrefV2 as AppBskyActorDefs.Preferences[number]
  ];

  if (savedFeedsPref) {
    const v1Preference: AppBskyActorDefs.SavedFeedsPref = {
      ...savedFeedsPref,
      ...getSavedFeedUriArrays(savedFeedsPrefV2.items)
    };
    const nextPreferences: AppBskyActorDefs.Preferences = [
      ...updatedPreferences.filter(
        (preference) => !isSavedFeedsPrefPreference(preference)
      ),
      v1Preference as AppBskyActorDefs.Preferences[number]
    ];

    await getAgent().app.bsky.actor.putPreferences({
      preferences: nextPreferences
    });
    return;
  }

  await getAgent().app.bsky.actor.putPreferences({
    preferences: updatedPreferences
  });
}

export async function getSubscribedHomeFeeds(): Promise<SubscribedHomeFeed[]> {
  const response = await getAgent().app.bsky.actor.getPreferences();
  const savedFeeds = getSavedHomeFeedsFromPreferences(
    response.data.preferences
  );
  const feedUris = Array.from(new Set(savedFeeds.map(({ value }) => value)));
  const generators = await getFeedGeneratorsByUri(feedUris);

  return savedFeeds.map((savedFeed) =>
    mapSubscribedHomeFeed(savedFeed, generators.get(savedFeed.value))
  );
}

export async function getFeedBrowserFeeds(): Promise<FeedBrowserFeed[]> {
  const { items } = await getSavedFeedState();
  const savedFeeds = items.filter(
    (feed) => feed.type === 'feed' && isFeedGeneratorUri(feed.value)
  );
  const generators = await getFeedGeneratorsByUri(
    Array.from(new Set(savedFeeds.map(({ value }) => value)))
  );

  return savedFeeds.map((savedFeed) => {
    const generator = generators.get(savedFeed.value);

    return generator
      ? mapFeedBrowserFeed(savedFeed, generator)
      : mapSavedFeedBrowserFallback(savedFeed);
  });
}

export async function searchFeedGenerators(
  searchQuery = '',
  cursor?: string,
  limit = 25
): Promise<FeedSearchPage> {
  const [{ items }, response] = await Promise.all([
    getSavedFeedState(),
    callAppQueryXrpc<AppViewFeedGeneratorSearchResponse>(
      'app.bsky.unspecced.getPopularFeedGenerators',
      {
        query: searchQuery.trim() || undefined,
        cursor,
        limit: clampAppViewLimit(limit)
      }
    )
  ]);
  const savedFeedsByUri = new Map<string, AppBskyActorDefs.SavedFeed>();

  items.forEach((feed) => {
    if (feed.type === 'feed') savedFeedsByUri.set(feed.value, feed);
  });

  return {
    feeds: response.feeds.map((generator) =>
      mapFeedBrowserFeed(savedFeedsByUri.get(generator.uri) ?? null, generator)
    ),
    cursor: response.cursor ?? null
  };
}

export async function addSavedHomeFeed(
  feedUri: string
): Promise<FeedBrowserFeed[]> {
  if (!isFeedGeneratorUri(feedUri)) throw new Error('Choose a valid feed.');

  const { items, preferences } = await getSavedFeedState();

  if (!items.some((item) => item.type === 'feed' && item.value === feedUri)) {
    const generators = await getFeedGeneratorsByUri([feedUri]);
    if (!generators.has(feedUri))
      throw new Error('This feed is not available right now.');

    await putSavedFeedItems(preferences, [
      ...items,
      {
        id: TID.nextStr(),
        type: 'feed',
        value: feedUri,
        pinned: true
      }
    ]);
    notify();
  }

  return getFeedBrowserFeeds();
}

export async function removeSavedHomeFeed(
  feedId: string
): Promise<FeedBrowserFeed[]> {
  const { items, preferences } = await getSavedFeedState();
  const feed = items.find((item) => item.id === feedId);

  if (!feed || feed.type !== 'feed') return getFeedBrowserFeeds();

  const generators = await getFeedGeneratorsByUri([feed.value]);

  if (isReservedHomeFeed(feed, generators.get(feed.value)))
    throw new Error('For you and Following stay fixed on Home.');

  await putSavedFeedItems(
    preferences,
    items.filter((item) => item.id !== feedId)
  );
  notify();

  return getFeedBrowserFeeds();
}

export async function reorderSavedHomeFeeds(
  feedIds: string[]
): Promise<FeedBrowserFeed[]> {
  const { items, preferences } = await getSavedFeedState();
  const savedFeedUris = items
    .filter((item) => item.type === 'feed')
    .map(({ value }) => value);
  const generators = await getFeedGeneratorsByUri(
    Array.from(new Set(savedFeedUris))
  );
  const editableFeeds = items.filter(
    (item) =>
      item.type === 'feed' &&
      isFeedGeneratorUri(item.value) &&
      !isReservedHomeFeed(item, generators.get(item.value))
  );
  const editableFeedsById = new Map<string, AppBskyActorDefs.SavedFeed>();

  editableFeeds.forEach((feed) => {
    editableFeedsById.set(feed.id, feed);
  });
  const requestedIds = Array.from(new Set(feedIds));

  if (requestedIds.length !== editableFeeds.length)
    throw new Error('Feed order is out of date. Refresh and try again.');

  const orderedEditableFeeds = requestedIds.map((feedId) => {
    const feed = editableFeedsById.get(feedId);

    if (!feed)
      throw new Error('Feed order is out of date. Refresh and try again.');

    return feed;
  });
  const editableIds = new Set(editableFeeds.map(({ id }) => id));
  const nextItems: AppBskyActorDefs.SavedFeed[] = [];
  let insertedEditableFeeds = false;

  for (const item of items) {
    if (!editableIds.has(item.id)) {
      nextItems.push(item);
      continue;
    }

    if (!insertedEditableFeeds) {
      nextItems.push(...orderedEditableFeeds);
      insertedEditableFeeds = true;
    }
  }

  if (!insertedEditableFeeds) nextItems.push(...orderedEditableFeeds);

  await putSavedFeedItems(preferences, nextItems);
  notify();

  return getFeedBrowserFeeds();
}

export async function getSubscribedHomeFeedPage(
  feedUri: string,
  cursor?: string,
  limit = 30
): Promise<HomeFeedPage> {
  let response: AppViewFeedResponse;

  try {
    response = await fetchAppViewFeed(feedUri, cursor, limit);
  } catch (error) {
    if (isTemporaryFeedUnavailableError(error))
      throw new Error(
        'This Bluesky feed is temporarily unavailable. Try another Home tab or check back soon.'
      );

    throw error;
  }

  return {
    tweets: mergeLocalCreatedTweetsWithUsers(
      await mapFeedItemsWithUsers(response.feed)
    ),
    cursor: response.cursor ?? null
  };
}

export async function getFollowingHomeFeedPage(
  cursor?: string,
  limit = 30
): Promise<HomeFeedPage> {
  const response = await fetchAppViewTimeline(cursor, limit);

  return {
    tweets: mergeLocalCreatedTweetsWithUsers(
      await mapFeedItemsWithUsers(response.feed)
    ),
    cursor: response.cursor ?? null
  };
}

function getNotificationTargetPostId(
  notification: AppBskyNotificationListNotifications.Notification
): string | null {
  if (notification.reason === 'follow') return null;

  const targetUri =
    notification.reason === 'like' || notification.reason === 'repost'
      ? notification.reasonSubject
      : notification.uri;

  return targetUri ? postIdFromUri(targetUri) : null;
}

function getNotificationPreviewPostUri(
  notification: AppBskyNotificationListNotifications.Notification
): string | null {
  if (notification.reason !== 'like' && notification.reason !== 'repost')
    return null;

  return notification.reasonSubject ?? null;
}

function getNotificationTweetUri(
  notification: AppBskyNotificationListNotifications.Notification
): string | null {
  if (notification.reason === 'follow') return null;

  return notification.reason === 'like' || notification.reason === 'repost'
    ? notification.reasonSubject ?? null
    : notification.uri;
}

async function getNotificationTweetByUri(
  notifications: AppBskyNotificationListNotifications.Notification[],
  moderationOpts: ModerationOpts | null
): Promise<NotificationTweetLookup> {
  const uris = Array.from(
    new Set(
      notifications
        .map(getNotificationTweetUri)
        .filter((uri): uri is string => !!uri)
    )
  );
  const tweetByUri = new Map<string, Tweet>();
  const hiddenUris = new Set<string>();

  if (!uris.length) return { tweetByUri, hiddenUris };

  for (let index = 0; index < uris.length; index += 25) {
    try {
      const response = await fetchAppViewPosts(uris.slice(index, index + 25));

      response.posts.forEach((post) => {
        if (isModerationFilteredWithoutTombstone(post, moderationOpts)) {
          hiddenUris.add(post.uri);
          return;
        }

        tweetByUri.set(post.uri, mapPost(post));
      });
    } catch {
      // Activity rows can still render without a target Tweet preview.
    }
  }

  return { tweetByUri, hiddenUris };
}

function isNotificationView(
  notification: unknown
): notification is AppBskyNotificationListNotifications.Notification {
  return (
    !!notification &&
    typeof notification === 'object' &&
    typeof (notification as { uri?: unknown }).uri === 'string' &&
    typeof (notification as { cid?: unknown }).cid === 'string' &&
    typeof (notification as { reason?: unknown }).reason === 'string' &&
    typeof (notification as { indexedAt?: unknown }).indexedAt === 'string' &&
    !!(notification as { author?: unknown }).author
  );
}

function mapNotification(
  notification: AppBskyNotificationListNotifications.Notification,
  tweetByUri?: Map<string, Tweet>
): NotificationItem {
  const targetPostId = getNotificationTargetPostId(notification);
  const previewPostUri = getNotificationPreviewPostUri(notification);
  const tweetUri = getNotificationTweetUri(notification);
  const tweet = tweetUri ? tweetByUri?.get(tweetUri) ?? null : null;

  if (
    targetPostId &&
    ['mention', 'reply', 'quote', 'subscribed-post'].includes(
      notification.reason
    )
  ) {
    postRefCache.set(targetPostId, {
      uri: notification.uri,
      cid: notification.cid
    });
  }

  return {
    id: postIdFromUri(notification.uri),
    user: mapProfile(notification.author),
    reason: notification.reason,
    text: previewPostUri
      ? tweetByUri?.get(previewPostUri)?.text ?? null
      : getPostText(notification.record),
    tweet,
    targetPostId,
    isRead: notification.isRead,
    createdAt: Timestamp.fromDate(new Date(notification.indexedAt))
  };
}

function isStandardSiteArticleCard(card: TweetCard | null): boolean {
  if (!card) return false;
  if (card.domain?.toLowerCase() === 'standard.site') return true;
  if (/^https?:\/\/(?:www\.)?standard\.site\//i.test(card.url)) return true;

  return (
    card.associatedRefs?.some(({ uri }) =>
      uri.includes('/site.standard.document/')
    ) ?? false
  );
}

function subscribedPostNotificationMatchesActivityPreferences(
  notification: AppBskyNotificationListNotifications.Notification,
  tweetByUri: Map<string, Tweet>
): boolean {
  if (notification.reason !== 'subscribed-post') return true;

  const stored = getStoredActivityNotificationCategories(
    notification.author.did
  );
  if (!stored) return true;

  const categories = normalizeActivityNotificationCategories(stored);
  if (!categories.length) return false;
  if (categories.includes('all')) return true;

  const tweetUri = getNotificationTweetUri(notification);
  const tweet = tweetUri ? tweetByUri.get(tweetUri) : null;
  const isArticle = isStandardSiteArticleCard(tweet?.card ?? null);
  const isReply = !!tweet?.parent;

  if (
    isArticle &&
    activityNotificationCategoriesInclude(categories, 'articles')
  )
    return true;
  if (isReply && activityNotificationCategoriesInclude(categories, 'replies'))
    return true;

  return (
    !isArticle &&
    !isReply &&
    activityNotificationCategoriesInclude(categories, 'tweets')
  );
}

export async function listNotificationsPage(
  cursor?: string,
  options?: {
    mentionsOnly?: boolean;
    reasons?: NotificationReason[];
    limit?: number;
  }
): Promise<NotificationsPage> {
  const moderationOpts = await getSafeModerationOpts();
  const reasons =
    options?.reasons ??
    (options?.mentionsOnly ? ['mention', 'reply', 'quote'] : undefined);

  await ensureAppViewAccessScope('app.bsky.notification.listNotifications');

  const response = await callAppQueryXrpc<AppViewNotificationsResponse>(
    'app.bsky.notification.listNotifications',
    {
      cursor,
      limit: clampAppViewLimit(options?.limit ?? 30),
      reasons
    }
  );
  const responseNotifications = Array.isArray(response.notifications)
    ? response.notifications
        .filter(isNotificationView)
        .filter(
          (notification) =>
            !isModerationFilteredNotification(notification, moderationOpts)
        )
    : [];
  const [, { tweetByUri, hiddenUris }] = await Promise.all([
    hydrateProfiles(responseNotifications.map(({ author }) => author)),
    getNotificationTweetByUri(responseNotifications, moderationOpts)
  ]);

  return {
    notifications: responseNotifications.flatMap((notification) => {
      try {
        const tweetUri = getNotificationTweetUri(notification);
        if (tweetUri && hiddenUris.has(tweetUri)) return [];
        if (
          !subscribedPostNotificationMatchesActivityPreferences(
            notification,
            tweetByUri
          )
        )
          return [];

        return [mapNotification(notification, tweetByUri)];
      } catch {
        return [];
      }
    }),
    cursor: response.cursor ?? null,
    seenAt: response.seenAt ?? null
  };
}

export async function markNotificationsSeen(): Promise<void> {
  await getAppViewAgent().updateSeenNotifications(
    new Date().toISOString() as Parameters<Agent['updateSeenNotifications']>[0]
  );
  notify();
}

export async function setActivityNotificationCategoriesForUser(
  targetDid: string,
  categories: readonly ActivityNotificationCategory[]
): Promise<ActivityNotificationCategory[]> {
  const nextCategories = normalizeActivityNotificationCategories(categories);
  const stored = readActivityNotificationCategoriesByDid();
  const previousCategories = stored[targetDid] ?? null;
  stored[targetDid] = nextCategories;
  writeActivityNotificationCategoriesByDid(stored);

  const cachedUser = userCache.get(targetDid);
  if (cachedUser) cachedUser.activityNotificationCategories = nextCategories;

  try {
    await ensureAppViewAccessScope(
      'app.bsky.notification.putActivitySubscription'
    );
    await callAppXrpc('app.bsky.notification.putActivitySubscription', {
      subject: targetDid,
      activitySubscription: {
        post: nextCategories.length > 0,
        reply: activityNotificationCategoriesInclude(nextCategories, 'replies')
      }
    });
  } catch (error) {
    const rollback = readActivityNotificationCategoriesByDid();
    if (previousCategories) rollback[targetDid] = previousCategories;
    else delete rollback[targetDid];
    writeActivityNotificationCategoriesByDid(rollback);
    if (cachedUser)
      cachedUser.activityNotificationCategories = previousCategories ?? [];
    throw error;
  }

  notify('relationship');

  return nextCategories;
}

type RawChatMessage =
  | ChatBskyConvoDefs.MessageView
  | ChatBskyConvoDefs.DeletedMessageView
  | ChatBskyConvoDefs.SystemMessageView
  | { $type: string };

function getActorDid(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return null;

  const { did } = value as { did?: unknown };
  return typeof did === 'string' ? did : null;
}

function mapChatReactions(reactions: unknown): ChatReaction[] {
  if (!Array.isArray(reactions)) return [];

  return reactions
    .map((reaction) => {
      if (!reaction || typeof reaction !== 'object') return null;

      const reactionRecord = reaction as {
        value?: unknown;
        sender?: unknown;
        createdAt?: unknown;
      };
      const senderId = getActorDid(reactionRecord.sender);

      if (
        typeof reactionRecord.value !== 'string' ||
        !senderId ||
        typeof reactionRecord.createdAt !== 'string'
      ) {
        return null;
      }

      return {
        value: reactionRecord.value,
        senderId,
        createdAt: Timestamp.fromDate(new Date(reactionRecord.createdAt))
      };
    })
    .filter((reaction): reaction is ChatReaction => !!reaction);
}

function mapActorDids(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return values
    .map(getActorDid)
    .filter((did): did is string => typeof did === 'string');
}

function mapChatMessage(message?: RawChatMessage): ChatMessage | null {
  if (!message || typeof message !== 'object') return null;

  const messageRecord = message as {
    id?: unknown;
    text?: unknown;
    sender?: { did?: unknown };
    sentAt?: unknown;
    reactions?: unknown;
    readBy?: unknown;
    seenBy?: unknown;
    deliveredBy?: unknown;
  };

  if (
    typeof messageRecord.id !== 'string' ||
    typeof messageRecord.sender?.did !== 'string' ||
    typeof messageRecord.sentAt !== 'string'
  ) {
    return null;
  }

  const text =
    typeof messageRecord.text === 'string' ? messageRecord.text : null;

  return {
    id: messageRecord.id,
    text,
    senderId: messageRecord.sender.did,
    sentAt: Timestamp.fromDate(new Date(messageRecord.sentAt)),
    deleted: text === null,
    reactions: mapChatReactions(messageRecord.reactions),
    readBy: mapActorDids(messageRecord.readBy ?? messageRecord.seenBy),
    deliveredBy: mapActorDids(messageRecord.deliveredBy)
  };
}

function isRawChatConvoView(
  value: unknown
): value is ChatBskyConvoDefs.ConvoView {
  if (!value || typeof value !== 'object') return false;

  const convo = value as {
    id?: unknown;
    members?: unknown;
    muted?: unknown;
    unreadCount?: unknown;
  };

  return (
    typeof convo.id === 'string' &&
    Array.isArray(convo.members) &&
    typeof convo.muted === 'boolean' &&
    typeof convo.unreadCount === 'number'
  );
}

function getChatConvoMemberProfiles(
  convo: ChatBskyConvoDefs.ConvoView
): ActorProfileView[] {
  return convo.members as unknown as ActorProfileView[];
}

function getRawType(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;

  const { $type } = value as { $type?: unknown };

  return typeof $type === 'string' ? $type : null;
}

function getChatConvoKind(
  kind: ChatBskyConvoDefs.ConvoView['kind']
): 'direct' | 'group' | string {
  const rawType = getRawType(kind);

  if (rawType === 'chat.bsky.convo.defs#groupConvo') return 'group';
  if (rawType === 'chat.bsky.convo.defs#directConvo') return 'direct';

  return rawType ?? 'direct';
}

function getChatConvoGroupData(kind: ChatBskyConvoDefs.ConvoView['kind']): {
  name: string | null;
  memberCount: number | null;
  memberLimit: number | null;
} {
  if (!kind || typeof kind !== 'object') {
    return { name: null, memberCount: null, memberLimit: null };
  }

  const group = kind as {
    name?: unknown;
    memberCount?: unknown;
    memberLimit?: unknown;
  };

  return {
    name: typeof group.name === 'string' ? group.name : null,
    memberCount:
      typeof group.memberCount === 'number' ? group.memberCount : null,
    memberLimit:
      typeof group.memberLimit === 'number' ? group.memberLimit : null
  };
}

function getHydratedChatUser(
  profile: ActorProfileView,
  usersByDid?: Map<string, User>
): User {
  return (
    usersByDid?.get(profile.did) ??
    getCachedUser(profile.did) ??
    mapProfile(profile)
  );
}

async function getHydratedChatUsersByDid(
  convos: ChatBskyConvoDefs.ConvoView[]
): Promise<Map<string, User>> {
  const usersByDid = new Map<string, User>();
  const users = await hydrateProfiles(
    convos.flatMap(getChatConvoMemberProfiles)
  );

  users.forEach((user) => {
    usersByDid.set(user.id, user);
  });

  return usersByDid;
}

async function mapChatConvo(
  convo: ChatBskyConvoDefs.ConvoView,
  usersByDid?: Map<string, User>
): Promise<ChatConvo> {
  const convoRecord = convo as ChatBskyConvoDefs.ConvoView & {
    opened?: unknown;
    status?: unknown;
  };
  const groupData = getChatConvoGroupData(convo.kind);
  const memberProfiles = getChatConvoMemberProfiles(convo);
  const users = usersByDid
    ? memberProfiles.map((profile) => getHydratedChatUser(profile, usersByDid))
    : await hydrateProfiles(memberProfiles);
  const visibleMembers = users.filter((user) => user.id !== sessionDid);

  return {
    id: convo.id,
    kind: getChatConvoKind(convo.kind),
    groupName: groupData.name,
    memberCount: groupData.memberCount,
    memberLimit: groupData.memberLimit,
    muted: convo.muted,
    opened: !!convoRecord.opened,
    unreadCount: convo.unreadCount,
    status:
      typeof convoRecord.status === 'string' && convoRecord.status
        ? convoRecord.status
        : 'accepted',
    members: (visibleMembers.length ? visibleMembers : users).map(
      ({
        id,
        name,
        username,
        photoURL,
        verified,
        followingCount,
        followersCount,
        createdAt
      }) => ({
        id,
        name,
        username,
        photoURL,
        verified,
        followingCount,
        followersCount,
        createdAt
      })
    ),
    lastMessage: mapChatMessage(convo.lastMessage)
  };
}

async function mapChatConvos(
  convos: ChatBskyConvoDefs.ConvoView[]
): Promise<ChatConvo[]> {
  const usersByDid = await getHydratedChatUsersByDid(convos);

  return Promise.all(convos.map((convo) => mapChatConvo(convo, usersByDid)));
}

function sortChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => +a.sentAt.toDate() - +b.sentAt.toDate());
}

export async function getChatSettings(): Promise<ChatSettings> {
  await ensureChatAccessScope();

  if (!sessionDid) throw new ChatAccessError();

  try {
    const response = await getAgent().com.atproto.repo.getRecord({
      repo: sessionDid,
      collection: CHAT_DECLARATION_COLLECTION,
      rkey: 'self'
    });
    const record = response.data
      .value as Partial<ChatBskyActorDeclaration.Record>;

    return {
      allowIncoming: normalizeChatAllowIncoming(record.allowIncoming)
    };
  } catch (error) {
    if (isRecordNotFoundError(error)) return { allowIncoming: 'all' };

    throwChatError(error);
  }
}

export async function setChatSettings(
  allowIncoming: ChatAllowIncoming
): Promise<ChatSettings> {
  await ensureChatAccessScope();

  if (!sessionDid) throw new ChatAccessError();

  const normalizedAllowIncoming = normalizeChatAllowIncoming(allowIncoming);
  const record: ChatBskyActorDeclaration.Record = {
    $type: CHAT_DECLARATION_COLLECTION,
    allowIncoming: normalizedAllowIncoming
  };

  try {
    await getAgent().com.atproto.repo.putRecord({
      repo: sessionDid,
      collection: CHAT_DECLARATION_COLLECTION,
      rkey: 'self',
      record
    });
  } catch (error) {
    throwChatError(error);
  }

  applyChatDeclarationUserData(sessionDid, record);
  notify();
  return { allowIncoming: normalizedAllowIncoming };
}

export async function listChatConvos(
  cursor?: string,
  limit = 30
): Promise<ChatConvoPage> {
  const response = await callChat(() =>
    getChatAgent().chat.bsky.convo.listConvos({
      cursor,
      limit: Math.min(Math.max(limit, 1), 100)
    })
  );

  return {
    cursor: response.data.cursor ?? null,
    convos: await mapChatConvos(response.data.convos)
  };
}

type RawChatConvoRequestsResponse = {
  cursor?: string;
  requests?: unknown[];
};

export async function listChatConvoRequests(
  cursor?: string,
  limit = 30
): Promise<ChatConvoRequestsPage> {
  const response = await callChatQueryXrpc<RawChatConvoRequestsResponse>(
    'chat.bsky.convo.listConvoRequests',
    {
      cursor,
      limit: Math.min(Math.max(limit, 1), 100)
    }
  );
  const requests = await mapChatConvos(
    (response.requests ?? []).filter(isRawChatConvoView)
  );

  return {
    cursor: response.cursor ?? null,
    requests
  };
}

export async function getChatMessages(
  convoId: string,
  cursor?: string,
  limit = 50
): Promise<ChatMessagesPage> {
  const response = await callChat(() =>
    getChatAgent().chat.bsky.convo.getMessages({
      convoId,
      cursor,
      limit: Math.min(Math.max(limit, 1), 100)
    })
  );

  return {
    cursor: response.data.cursor ?? null,
    messages: sortChatMessages(
      response.data.messages
        .map(mapChatMessage)
        .filter((message): message is ChatMessage => !!message)
    )
  };
}

export async function sendChatMessage(
  convoId: string,
  text: string
): Promise<ChatMessage> {
  const trimmedText = text.trim();
  if (!trimmedText) throw new Error('Type a message first.');

  const api = getAgent();
  const richText = new RichText({ text: trimmedText }, { cleanNewlines: true });
  await richText.detectFacets(api);

  const response = await callChat(() =>
    getChatAgent().chat.bsky.convo.sendMessage({
      convoId,
      message: {
        text: richText.text,
        facets: richText.facets
      }
    })
  );
  const message = mapChatMessage(response.data);

  if (!message) throw new Error('Bluesky did not return the sent message.');

  notify();
  return message;
}

type ChatReactionResponse = {
  message?: RawChatMessage;
};

async function updateChatReaction(
  method: 'chat.bsky.convo.addReaction' | 'chat.bsky.convo.removeReaction',
  convoId: string,
  messageId: string,
  value: string
): Promise<ChatMessage> {
  const response = await callChatXrpc<ChatReactionResponse>(method, {
    convoId,
    messageId,
    value
  });
  const message = mapChatMessage(response.message);

  if (!message) {
    throw new Error('Bluesky did not return the reacted message.');
  }

  notify();
  return message;
}

export function addChatReaction(
  convoId: string,
  messageId: string,
  value: string
): Promise<ChatMessage> {
  return updateChatReaction(
    'chat.bsky.convo.addReaction',
    convoId,
    messageId,
    value
  );
}

export function removeChatReaction(
  convoId: string,
  messageId: string,
  value: string
): Promise<ChatMessage> {
  return updateChatReaction(
    'chat.bsky.convo.removeReaction',
    convoId,
    messageId,
    value
  );
}

export async function setChatConvoMuted(
  convoId: string,
  muted: boolean
): Promise<ChatConvo> {
  const response = await callChat(() =>
    muted
      ? getChatAgent().chat.bsky.convo.muteConvo({ convoId })
      : getChatAgent().chat.bsky.convo.unmuteConvo({ convoId })
  );

  notify();
  return mapChatConvo(response.data.convo);
}

export async function acceptChatConvo(convoId: string): Promise<ChatConvo> {
  await callChatXrpc<{ rev?: string }>('chat.bsky.convo.acceptConvo', {
    convoId
  });

  const response = await callChat(() =>
    getChatAgent().chat.bsky.convo.getConvo({ convoId })
  );

  notify();
  return mapChatConvo(response.data.convo);
}

export async function leaveChatConvo(convoId: string): Promise<void> {
  await callChat(() => getChatAgent().chat.bsky.convo.leaveConvo({ convoId }));
  notify();
}

export async function blockChatParticipant(actorDid: string): Promise<void> {
  await blockUser(actorDid);
}

export async function getBlockedUsersPage(
  cursor?: string,
  limit = 50
): Promise<BlockedUsersPage> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');

  const response = await getAppViewAgent().app.bsky.graph.getBlocks({
    cursor,
    limit: clampAppViewLimit(limit)
  });
  const users = response.data.blocks.map((profile) => {
    const user = mapProfile(profile);
    user.blocking = true;
    user.blockingUri = user.blockingUri ?? blockUriCache.get(user.id) ?? null;
    userCache.set(user.id, user);
    userHandleCache.set(user.username, user);
    return user;
  });

  return { users, cursor: response.data.cursor ?? null };
}

export async function reportChatParticipant(actorDid: string): Promise<void> {
  await getAgent()
    .withProxy('atproto_labeler', BSKY_MODERATION_DID)
    .createModerationReport({
      reasonType: getModerationReportReasonType('other'),
      reason: 'Reported from a direct message conversation.',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: actorDid
      },
      modTool: getModerationReportModTool('chat')
    });
}

export async function markChatConvoRead(
  convoId: string,
  messageId?: string
): Promise<void> {
  await callChat(() =>
    getChatAgent().chat.bsky.convo.updateRead({ convoId, messageId })
  );
  notify();
}

export async function getChatConvoForActor(actor: string): Promise<ChatConvo> {
  return getChatConvoForMembers([actor]);
}

export async function getChatConvoForMembers(
  actors: string[],
  groupName?: string
): Promise<ChatConvo> {
  const normalizedActors = actors.map((actor) => actor.trim()).filter(Boolean);
  const actorIds = new Set<string>();
  const users = await Promise.all(
    normalizedActors.map((actor) => getUser(actor))
  );
  const missingActor = normalizedActors.find((actor, index) => !users[index]);

  if (!normalizedActors.length || !users.length)
    throw new Error('Choose at least one person to message.');

  if (missingActor)
    throw new Error(`${missingActor} could not be found on Bluesky.`);

  users.forEach((user) => {
    if (!user) return;

    if (user.id === sessionDid)
      throw new Error('You cannot start a message thread with yourself.');

    actorIds.add(user.id);
  });

  const members = Array.from(actorIds);

  if (!members.length) throw new Error('Choose someone else to message.');
  if (members.length > 49)
    throw new Error('Bluesky group chats can include up to 49 other people.');

  if (members.length === 1) {
    const response = await callChat(() =>
      getChatAgent().chat.bsky.convo.getConvoForMembers({
        members
      })
    );

    return mapChatConvo(response.data.convo);
  }

  const trimmedGroupName = groupName?.trim();
  const normalizedGroupName = trimmedGroupName
    ? trimmedGroupName
    : users
        .filter((user): user is User => !!user)
        .map(({ name }) => name)
        .join(', ');

  const response = await callChat(() =>
    getChatAgent().chat.bsky.group.createGroup({
      members,
      name: normalizedGroupName.slice(0, 50)
    })
  );

  notify();
  return mapChatConvo(response.data.convo);
}

async function refreshCurrentUser(): Promise<User | null> {
  if (!sessionDid) return null;

  const api = getAgent();
  const appView = getAppViewAgent();
  const [profileResponse, followsResponse, liveProfileRecord] =
    await Promise.all([
      appView.getProfile({ actor: sessionDid }),
      appView.getFollows({ actor: sessionDid, limit: 100 }).catch(() => null),
      getLiveProfileRecord(api, sessionDid).catch(() => null)
    ]);

  currentFollowing = new Set(
    followsResponse?.data.follows.map((profile) => profile.did) ?? []
  );
  currentUser = mapProfile(profileResponse.data);
  if (liveProfileRecord)
    applyProfileRecordUserData(sessionDid, liveProfileRecord);
  currentUser = userCache.get(sessionDid) ?? currentUser;
  currentUser.following = Array.from(currentFollowing);
  userCache.set(currentUser.id, currentUser);
  userHandleCache.set(currentUser.username, currentUser);

  void repairMalformedOwnImagePosts(api).catch(() => undefined);

  return currentUser;
}

function getStoredOAuthSub(): string | null {
  if (!hasStorage()) return null;
  return window.localStorage.getItem(OAUTH_SUB_KEY);
}

async function activateOAuthSession(
  nextSession: OAuthSession
): Promise<AuthUser | null> {
  const previousState = {
    agent,
    credentialAgent,
    oauthSession,
    sessionDid,
    currentUser,
    currentFollowing
  };

  try {
    const did = nextSession.did as unknown as string;

    oauthSession = nextSession;
    credentialAgent = null;
    sessionDid = did;
    activePdsDidPromise = null;
    clearModerationSettingsCache();
    if (previousState.sessionDid !== did) {
      locallyCreatedTweets.clear();
      localQuoteTargetIds.clear();
      locallyDeletedTweetIds.clear();
      localViewerFollowOverrides.clear();
    }
    agent = new Agent(nextSession);

    const user = await refreshCurrentUser();
    if (user) saveAccount(user);

    if (hasStorage()) window.localStorage.setItem(OAUTH_SUB_KEY, did);
    writeCredentialSession();
    notify('auth');

    return user
      ? { uid: user.id, displayName: user.name, photoURL: user.photoURL }
      : null;
  } catch {
    agent = previousState.agent;
    credentialAgent = previousState.credentialAgent;
    oauthSession = previousState.oauthSession;
    sessionDid = previousState.sessionDid;
    currentUser = previousState.currentUser;
    currentFollowing = previousState.currentFollowing;
    return null;
  }
}

async function activateCredentialAgent(
  nextAgent: AtpAgent,
  shouldNotify = true
): Promise<AuthUser | null> {
  const previousState = {
    agent,
    credentialAgent,
    oauthSession,
    sessionDid,
    currentUser,
    currentFollowing
  };

  try {
    if (!nextAgent.session?.did) {
      throw new Error('Bluesky did not return a session.');
    }

    oauthSession = null;
    credentialAgent = nextAgent;
    agent = nextAgent;
    sessionDid = nextAgent.session.did;
    activePdsDidPromise = null;
    clearModerationSettingsCache();
    if (previousState.sessionDid !== nextAgent.session.did) {
      locallyCreatedTweets.clear();
      localQuoteTargetIds.clear();
      locallyDeletedTweetIds.clear();
      localViewerFollowOverrides.clear();
    }

    const user = await refreshCurrentUser();

    if (hasStorage()) window.localStorage.removeItem(OAUTH_SUB_KEY);
    writeCredentialSession(
      nextAgent.session,
      getCredentialAgentServiceUrl(nextAgent, getPrimaryAtprotoServiceUrl())
    );
    if (shouldNotify) notify('auth');

    return user
      ? { uid: user.id, displayName: user.name, photoURL: user.photoURL }
      : null;
  } catch {
    agent = previousState.agent;
    credentialAgent = previousState.credentialAgent;
    oauthSession = previousState.oauthSession;
    sessionDid = previousState.sessionDid;
    currentUser = previousState.currentUser;
    currentFollowing = previousState.currentFollowing;
    return null;
  }
}

async function resumeCredentialAuthUser(): Promise<AuthUser | null> {
  const storedCredentialSession = readCredentialSession();
  if (!storedCredentialSession) return null;

  const nextAgent = createCredentialAgent(storedCredentialSession.serviceUrl);

  try {
    await nextAgent.resumeSession(storedCredentialSession.session);
    return activateCredentialAgent(nextAgent);
  } catch {
    writeCredentialSession();
    return null;
  }
}

function isUnknownOAuthAuthorizationSession(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith('Unknown authorization session ')
  );
}

async function initOAuthSession(
  client: BrowserOAuthClient
): Promise<OAuthSession | null> {
  try {
    return (await client.init())?.session ?? null;
  } catch (error) {
    if (!isUnknownOAuthAuthorizationSession(error)) throw error;

    return (await client.initRestore().catch(() => undefined))?.session ?? null;
  }
}

export async function resumeAuthUser(): Promise<AuthUser | null> {
  if (oauthInitPromise) return oauthInitPromise;

  oauthInitPromise = (async (): Promise<AuthUser | null> => {
    const client = await getOAuthClient();
    const session = await initOAuthSession(client);

    if (session) return activateOAuthSession(session);

    const storedSub = getStoredOAuthSub();
    if (storedSub) {
      try {
        const user = await activateOAuthSession(
          await client.restore(storedSub)
        );
        if (user) return user;

        removeSavedAccount(storedSub);
        if (hasStorage()) window.localStorage.removeItem(OAUTH_SUB_KEY);
      } catch {
        removeSavedAccount(storedSub);
        if (hasStorage()) window.localStorage.removeItem(OAUTH_SUB_KEY);
      }
    }

    return resumeCredentialAuthUser();
  })().catch((error) => {
    oauthInitPromise = null;
    throw error;
  });

  return oauthInitPromise;
}

export async function signIn(identifier: string): Promise<AuthUser> {
  if (typeof window === 'undefined') {
    throw new Error('Bluesky sign-in is only available in the browser.');
  }

  const trimmedIdentifier = identifier.trim();
  if (!trimmedIdentifier) throw new Error('Enter your Bluesky handle or DID.');
  const loginIdentifier = normalizeAtprotoLoginIdentifier(trimmedIdentifier);

  writeCredentialSession();
  credentialAgent = null;

  const client = await getOAuthClient();
  const nextSession = await client.signIn(loginIdentifier);
  const user = await activateOAuthSession(nextSession);

  if (!user) throw new Error('Bluesky did not return a profile.');

  return user;
}

async function restoreFirstSavedAccount(): Promise<AuthUser | null> {
  const accounts = readSavedAccounts();
  if (!accounts.length) return null;

  const client = await getOAuthClient();

  for (const account of accounts) {
    try {
      const user = await activateOAuthSession(await client.restore(account.id));
      if (user) return user;
    } catch {
      // Try the next saved account.
    }

    removeSavedAccount(account.id);
  }

  return null;
}

export function getSavedBlueskyAccounts(): SavedBlueskyAccount[] {
  return readSavedAccounts();
}

export async function switchBlueskyAccount(id: string): Promise<AuthUser> {
  const accountId = id.trim();
  if (!accountId) throw new Error('Choose an account to switch to.');

  if (accountId === sessionDid && currentUser) {
    return {
      uid: currentUser.id,
      displayName: currentUser.name,
      photoURL: currentUser.photoURL
    };
  }

  const client = await getOAuthClient();

  try {
    const user = await activateOAuthSession(await client.restore(accountId));
    if (!user) throw new Error('Bluesky did not return a profile.');
    return user;
  } catch (error) {
    removeSavedAccount(accountId);
    notify('auth');

    throw new Error(
      error instanceof Error ? error.message : 'Unable to switch accounts.'
    );
  }
}

export async function removeBlueskyAccount(id: string): Promise<void> {
  const accountId = id.trim();
  if (!accountId) return;

  if (accountId === sessionDid || accountId === getStoredOAuthSub()) {
    await signOut();
    return;
  }

  try {
    const client = await getOAuthClient();
    await client.revoke(accountId);
  } catch {
    // Keep local account removal reliable if the provider cannot be reached.
  }

  removeSavedAccount(accountId);
  notify('auth');
}

export async function signOut(): Promise<void> {
  const signedOutDid = sessionDid ?? getStoredOAuthSub();

  try {
    if (oauthSession) await oauthSession.signOut();
    else if (credentialAgent?.hasSession) await credentialAgent.logout();
    else {
      const client = await getOAuthClient();
      const storedSub = getStoredOAuthSub();
      if (storedSub) await client.revoke(storedSub);
    }
  } catch {
    // Keep local sign-out reliable if the network is down.
  }

  removeSavedAccount(signedOutDid);
  clearActiveAuthState();

  const restoredUser = await restoreFirstSavedAccount();
  if (restoredUser) return;

  notify('auth');
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function getCurrentDid(): string | null {
  return sessionDid;
}

export function getCollection(path: string): BackendCollection {
  if (path === 'users') return { collectionName: 'users', path };
  if (path === 'tweets') return { collectionName: 'tweets', path };

  const bookmarksMatch = path.match(/^users\/([^/]+)\/bookmarks$/);
  if (bookmarksMatch) {
    return {
      collectionName: 'bookmarks',
      path,
      ownerId: bookmarksMatch[1]
    };
  }

  const statsMatch = path.match(/^users\/([^/]+)\/stats$/);
  if (statsMatch) {
    return { collectionName: 'stats', path, ownerId: statsMatch[1] };
  }

  return { collectionName: 'users', path };
}

function getLimit(constraints: BackendConstraint[]): number | undefined {
  return constraints.find(
    (constraint): constraint is QueryLimit => constraint.type === 'limit'
  )?.count;
}

function getWhere(
  constraints: BackendConstraint[],
  field: string,
  op?: string
): QueryFilter | undefined {
  return constraints.find(
    (constraint): constraint is QueryFilter =>
      constraint.type === 'where' &&
      constraint.field === field &&
      (!op || constraint.op === op)
  );
}

function sortByCreatedAt<T extends { createdAt: Timestamp }>(data: T[]): T[] {
  return [...data].sort(
    (a, b) => +b.createdAt.toDate() - +a.createdAt.toDate()
  );
}

function normalizeAtIdentifier(actor: string): string | null {
  return normalizeAtprotoIdentifier(actor.replace(/^@+/, ''));
}

export async function getUser(actor: string): Promise<User | null> {
  const normalizedActor = normalizeAtIdentifier(actor);
  if (!normalizedActor) return null;

  const cachedUser = getCachedUser(normalizedActor);
  const isCurrentUserProfile =
    normalizedActor === sessionDid ||
    cachedUser?.id === sessionDid ||
    currentUser?.username === normalizedActor;

  if (isCurrentUserProfile && currentUser) return currentUser;

  if (isCurrentUserProfile) {
    const refreshedUser = await refreshCurrentUser().catch(() => null);
    if (refreshedUser) return refreshedUser;
  }

  if (cachedUser && detailedUserCache.has(cachedUser.id)) {
    await Promise.all([
      hydrateProfileRecordUserData(cachedUser.id).catch(() => undefined),
      hydrateChatDeclarationUserData(cachedUser.id).catch(() => undefined),
      hydrateKnownFollowersUserData(cachedUser.id).catch(() => undefined)
    ]);
    return userCache.get(cachedUser.id) ?? cachedUser;
  }

  try {
    const response = await getAppViewAgent().getProfile({
      actor: normalizedActor
    });
    const user = mapProfile(response.data);

    await Promise.all([
      hydrateProfileRecordUserData(user.id).catch(() => undefined),
      hydrateChatDeclarationUserData(user.id).catch(() => undefined),
      hydrateKnownFollowersUserData(user.id).catch(() => undefined)
    ]);

    return userCache.get(user.id) ?? user;
  } catch (error) {
    if (isRecordNotFoundError(error)) return null;
    throw error;
  }
}

export async function getKnownFollowers(
  actor: string,
  limit = 50
): Promise<User[]> {
  if (!sessionDid) return [];

  const normalizedActor = normalizeAtIdentifier(actor);
  if (!normalizedActor) return [];
  if (normalizedActor === sessionDid) return [];

  const response = await getAppViewAgent()
    .app.bsky.graph.getKnownFollowers({
      actor: normalizedActor,
      limit: clampAppViewLimit(limit)
    })
    .catch(() => null);

  if (!response) return [];

  const subject = mapProfile(response.data.subject);
  const users = await hydrateProfiles(response.data.followers);
  const knownFollowers = response.data.followers.map(mapKnownFollowerProfile);
  const knownFollowersCount =
    response.data.subject.viewer?.knownFollowers?.count ??
    response.data.followers.length;
  const cachedSubject = userCache.get(subject.id) ?? subject;

  cachedSubject.knownFollowers = knownFollowers;
  cachedSubject.knownFollowersCount = Math.max(
    knownFollowersCount,
    knownFollowers.length
  );
  userCache.set(cachedSubject.id, cachedSubject);
  userHandleCache.set(cachedSubject.username, cachedSubject);

  return users;
}

export async function getTweet(id: string): Promise<Tweet | null> {
  if (!id || id === 'null') return null;
  if (locallyDeletedTweetIds.has(id)) return null;
  if (locallyCreatedTweets.has(id))
    return locallyCreatedTweets.get(id) as Tweet;

  const moderationOpts = await getSafeModerationOpts();
  const uri = uriFromPostId(id);
  const response = await getAppViewAgent().getPosts({ uris: [uri] });
  const post = response.data.posts[0];

  if (!post || isModerationFilteredWithoutTombstone(post, moderationOpts))
    return null;

  return mapPostWithUser(post);
}

async function getTweetThreadWithDepth(
  id: string,
  {
    depth = BSKY_THREAD_REPLY_DEPTH,
    parentHeight = BSKY_THREAD_PARENT_PAGE_SIZE + 1
  }: { depth?: number; parentHeight?: number } = {}
): Promise<TweetThreadPage | null> {
  if (!id || id === 'null') return null;
  if (locallyDeletedTweetIds.has(id)) return null;

  const uri = uriFromPostId(id);
  const moderationOpts = await getSafeModerationOpts();
  const threadParams = {
    uri,
    depth,
    parentHeight
  };

  try {
    const response = await getAppViewAgent().getPostThread(threadParams);
    const hiddenAuthors = collectHiddenThreadAuthors(response.data.thread);
    const thread = await getThreadWithPublicSkeleton(
      response.data.thread,
      hiddenAuthors,
      threadParams
    );

    if (isBlockedThreadItem(thread))
      return {
        tweet: mapThreadItem(thread, undefined, hiddenAuthors),
        parents: [],
        parentCursor: null,
        threadReplies: [],
        replies: []
      };

    if (!isThreadViewItem(thread)) return null;
    if (!isVisibleThreadItem(thread, moderationOpts, hiddenAuthors))
      return null;

    const tweet = mapThreadPost(thread, hiddenAuthors);
    if (locallyDeletedTweetIds.has(tweet.id)) return null;

    const { threadReplies, replies } = mapThreadReplies(
      thread,
      moderationOpts,
      hiddenAuthors
    );
    const parentPage = mapThreadParentPage(
      thread,
      moderationOpts,
      hiddenAuthors
    );

    return {
      tweet,
      parents: parentPage.parents,
      parentCursor: parentPage.cursor,
      threadReplies: filterDeletedTweets(threadReplies),
      replies: mergeLocalCreatedTweetsWithUsers(
        replies,
        (tweet) => tweet.parent?.id === id
      )
    };
  } catch (error) {
    if (isRecordNotFoundError(error)) return null;
    throw error;
  }
}

export async function getTweetThread(
  id: string
): Promise<TweetThreadPage | null> {
  return getTweetThreadWithDepth(id);
}

export async function getFullTweetThread(
  id: string
): Promise<TweetThreadPage | null> {
  const page = await getTweetThreadWithDepth(id, {
    depth: BSKY_THREAD_FULL_REPLY_DEPTH,
    parentHeight: BSKY_THREAD_FULL_PARENT_HEIGHT
  });

  if (!page) return null;

  const [fullThreadReplies, authorFeedThreadReplies] = await Promise.all([
    getFullThreadRepliesFromThreadV2(page, uriFromPostId(id)),
    getFullThreadRepliesFromAuthorFeed(page)
  ]);
  const mergedThreadReplies = mergeThreadRepliesByFullThreadOrder(
    mergeThreadRepliesByFullThreadOrder(page.threadReplies, fullThreadReplies),
    authorFeedThreadReplies
  );

  return {
    ...page,
    threadReplies: filterDeletedTweets(mergedThreadReplies)
  };
}

export async function getTweetThreadParentsPage(
  id: string
): Promise<TweetThreadParentsPage> {
  if (!agent) return { parents: [], cursor: null };
  if (!id || id === 'null') return { parents: [], cursor: null };
  if (locallyDeletedTweetIds.has(id)) return { parents: [], cursor: null };

  const uri = uriFromPostId(id);
  const moderationOpts = await getSafeModerationOpts();
  const threadParams = {
    uri,
    depth: 0,
    parentHeight: BSKY_THREAD_PARENT_PAGE_SIZE + 1
  };

  try {
    const response = await getAppViewAgent().getPostThread(threadParams);
    const hiddenAuthors = collectHiddenThreadAuthors(response.data.thread);
    const thread = await getThreadWithPublicSkeleton(
      response.data.thread,
      hiddenAuthors,
      threadParams
    );

    if (!isThreadViewItem(thread)) return { parents: [], cursor: null };
    if (!isVisibleThreadItem(thread, moderationOpts, hiddenAuthors))
      return { parents: [], cursor: null };

    return mapThreadParentPage(thread, moderationOpts, hiddenAuthors);
  } catch (error) {
    if (isRecordNotFoundError(error)) return { parents: [], cursor: null };
    throw error;
  }
}

async function getPostRef(id: string): Promise<PostRef | null> {
  const tweet = await getTweet(id);
  if (!tweet) return null;

  return postRefCache.get(tweet.id) ?? null;
}

function getModerationReportReasonType(
  reason: ModerationReportReason
): ComAtprotoModerationDefs.ReasonType {
  switch (reason) {
    case 'spam':
      return 'tools.ozone.report.defs#reasonMisleadingSpam';
    case 'scam':
      return 'tools.ozone.report.defs#reasonMisleadingScam';
    case 'impersonation':
      return 'tools.ozone.report.defs#reasonMisleadingImpersonation';
    case 'misleading-elections':
      return 'tools.ozone.report.defs#reasonMisleadingElections';
    case 'violation':
      return 'tools.ozone.report.defs#reasonRuleOther';
    case 'misleading':
      return 'tools.ozone.report.defs#reasonMisleadingOther';
    case 'sexual':
      return 'tools.ozone.report.defs#reasonSexualUnlabeled';
    case 'sexual-abuse':
      return 'tools.ozone.report.defs#reasonSexualAbuseContent';
    case 'child-safety':
      return 'tools.ozone.report.defs#reasonChildSafetyOther';
    case 'rude':
      return 'tools.ozone.report.defs#reasonHarassmentOther';
    case 'harassment':
      return 'tools.ozone.report.defs#reasonHarassmentTargeted';
    case 'hate':
      return 'tools.ozone.report.defs#reasonHarassmentHateSpeech';
    case 'private-info':
      return 'tools.ozone.report.defs#reasonHarassmentDoxxing';
    case 'violence':
      return 'tools.ozone.report.defs#reasonViolenceThreats';
    case 'graphic-violence':
      return 'tools.ozone.report.defs#reasonViolenceGraphicContent';
    case 'self-harm':
      return 'tools.ozone.report.defs#reasonSelfHarmContent';
    case 'prohibited-sales':
      return 'tools.ozone.report.defs#reasonRuleProhibitedSales';
    case 'site-security':
      return 'tools.ozone.report.defs#reasonRuleSiteSecurity';
    case 'ban-evasion':
      return 'tools.ozone.report.defs#reasonRuleBanEvasion';
    case 'other':
    default:
      return 'tools.ozone.report.defs#reasonOther';
  }
}

function getModerationReportReason(reason?: string): string | undefined {
  const trimmedReason = reason?.trim();

  if (!trimmedReason) return undefined;

  return Array.from(trimmedReason).slice(0, 2000).join('');
}

function getModerationReportModTool(surface: 'account' | 'chat' | 'post'): {
  $type: 'com.atproto.moderation.createReport#modTool';
  name: string;
  meta: { surface: 'account' | 'chat' | 'post'; client: string };
} {
  return {
    $type: 'com.atproto.moderation.createReport#modTool',
    name: 'not-twitter/web',
    meta: {
      client: 'not-twitter',
      surface
    }
  };
}

export async function listTweetStatsPage(
  tweetId: string,
  type: TweetStatsType,
  cursor?: string,
  limit = 25
): Promise<TweetStatsPage> {
  const ref = await getPostRef(tweetId);
  const pageLimit = Math.min(Math.max(limit, 1), 100);

  if (!ref) return { users: [], tweets: [], cursor: null };
  const moderationOpts = await getSafeModerationOpts();

  if (type === 'likes') {
    const response = await getAppViewAgent().getLikes({
      uri: ref.uri,
      cid: ref.cid,
      cursor,
      limit: pageLimit
    });

    return {
      users: await hydrateProfiles(
        response.data.likes.map(({ actor }) => actor)
      ),
      tweets: [],
      cursor: response.data.cursor ?? null
    };
  }

  if (type === 'retweets') {
    const response = await getAppViewAgent().getRepostedBy({
      uri: ref.uri,
      cid: ref.cid,
      cursor,
      limit: pageLimit
    });

    return {
      users: await hydrateProfiles(response.data.repostedBy),
      tweets: [],
      cursor: response.data.cursor ?? null
    };
  }

  const response = await getAppViewAgent().app.bsky.feed.getQuotes({
    uri: ref.uri,
    cid: ref.cid,
    cursor,
    limit: pageLimit
  });
  const quotePosts = filterVisiblePostViews(
    response.data.posts,
    moderationOpts
  ).map((post) => ({
    post,
    tweet: mapPost(post)
  }));
  const users = await hydrateProfiles(
    quotePosts.map(({ post }) => post.author)
  );
  const usersByDid = new Map<string, User>();

  users.forEach((user) => {
    usersByDid.set(user.id, user);
  });

  const tweets = quotePosts.map(({ post, tweet }) => ({
    ...tweet,
    user: usersByDid.get(tweet.createdBy) ?? mapProfile(post.author)
  }));

  return {
    users: [],
    tweets: cursor ? tweets : mergeLocalCreatedQuotes(tweets, tweetId),
    cursor: response.data.cursor ?? null
  };
}

async function getTimeline(limitCount?: number): Promise<Tweet[]> {
  const moderationOpts = await getSafeModerationOpts();
  const response = await getAppViewAgent().getTimeline({
    limit: limitCount ?? 30
  });
  return mergeLocalCreatedTweets(
    filterVisibleFeedItems(response.data.feed, moderationOpts).map(mapFeedItem)
  ).slice(0, limitCount);
}

type AuthorFeedFilter = 'posts_with_replies' | 'posts_no_replies';

type AuthorFeedResponse = {
  feed: ActorFeedPost[];
  moderationOpts: ModerationOpts | null;
};

type CachedAuthorFeedResponse = {
  fetchedAt: number;
  response: AuthorFeedResponse;
};

const AUTHOR_FEED_CACHE_MS = 30_000;
const authorFeedRequests = new Map<string, Promise<AuthorFeedResponse>>();
const authorFeedResponseCache = new Map<string, CachedAuthorFeedResponse>();

async function getAuthorFeedResponse(
  actor: string,
  filter: AuthorFeedFilter
): Promise<AuthorFeedResponse> {
  const requestKey = `${actor}:${filter}`;
  const cachedResponse = authorFeedResponseCache.get(requestKey);
  if (
    cachedResponse &&
    Date.now() - cachedResponse.fetchedAt < AUTHOR_FEED_CACHE_MS
  )
    return cachedResponse.response;

  const existingRequest = authorFeedRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = Promise.all([
    getSafeModerationOpts(),
    getAppViewAgent().getAuthorFeed({
      actor,
      limit: 50,
      filter
    })
  ]).then(([moderationOpts, response]) => ({
    moderationOpts,
    feed: response.data.feed
  }));

  authorFeedRequests.set(requestKey, request);

  try {
    const response = await request;
    authorFeedResponseCache.set(requestKey, {
      fetchedAt: Date.now(),
      response
    });
    return response;
  } finally {
    if (authorFeedRequests.get(requestKey) === request)
      authorFeedRequests.delete(requestKey);
  }
}

async function getAuthorFeed(
  actor: string,
  options?: { includeReplies?: boolean; onlyMedia?: boolean }
): Promise<TweetWithUser[]> {
  const filter = options?.includeReplies
    ? 'posts_with_replies'
    : 'posts_no_replies';
  const { feed, moderationOpts } = await getAuthorFeedResponse(actor, filter);
  const tweets = feed
    .filter(
      (item) => !isModerationFilteredWithoutTombstone(item.post, moderationOpts)
    )
    .filter((item) => item.post.author.did === actor)
    .map(mapFeedItemWithUser);
  const mergedTweets = mergeLocalCreatedTweetsWithUsers(
    options?.onlyMedia ? tweets.filter((tweet) => !!tweet.images) : tweets,
    (tweet) =>
      tweet.createdBy === actor && (!options?.onlyMedia || !!tweet.images)
  );

  return mergedTweets;
}

async function getRepostedFeed(actor: string): Promise<TweetWithUser[]> {
  const { feed, moderationOpts } = await getAuthorFeedResponse(
    actor,
    'posts_no_replies'
  );

  return feed
    .filter(
      (item) => !isModerationFilteredWithoutTombstone(item.post, moderationOpts)
    )
    .filter(
      (item) =>
        item.post.author.did !== actor &&
        item.reason &&
        AppBskyFeedDefs.isReasonRepost(item.reason) &&
        item.reason.by.did === actor
    )
    .map(mapFeedItemWithUser)
    .filter(({ id }) => !locallyDeletedTweetIds.has(id));
}

async function getLikedFeed(actor: string): Promise<Tweet[]> {
  const moderationOpts = await getSafeModerationOpts();
  const response = await getAppViewAgent()
    .getActorLikes({ actor, limit: 50 })
    .catch((error) => {
      if (isRecordNotFoundError(error)) return null;
      throw error;
    });

  if (!response) return [];

  return filterDeletedTweets(
    filterVisibleFeedItems(response.data.feed, moderationOpts).map((item) => {
      const tweet = mapFeedItem(item);
      if (!tweet.userLikes.includes(actor)) tweet.userLikes.unshift(actor);
      return tweet;
    })
  );
}

async function getThreadReplies(id: string): Promise<Tweet[]> {
  const uri = uriFromPostId(id);
  const moderationOpts = await getSafeModerationOpts();
  const response = await getAppViewAgent().getPostThread({ uri, depth: 2 });
  const thread = response.data.thread;

  if (!AppBskyFeedDefs.isThreadViewPost(thread)) return [];
  if (!isVisibleThreadPost(thread, moderationOpts)) return [];

  const replies = getVisibleThreadReplies(thread, moderationOpts).filter(
    isThreadViewItem
  );
  return mergeLocalCreatedTweets(
    replies.map((reply) =>
      mapPost(reply.post, {
        id,
        username: thread.post.author.handle
      })
    ),
    (tweet) => tweet.parent?.id === id
  );
}

async function queryUsers(constraints: BackendConstraint[]): Promise<User[]> {
  const usernameFilter = getWhere(constraints, 'username', '==');
  if (typeof usernameFilter?.value === 'string') {
    const user = await getUser(usernameFilter.value);
    return user ? [user] : [];
  }

  const followingFilter = getWhere(constraints, 'followers', 'array-contains');
  if (typeof followingFilter?.value === 'string') {
    const response = await getAppViewAgent().getFollows({
      actor: followingFilter.value,
      limit: getLimit(constraints) ?? 50
    });
    return hydrateProfiles(response.data.follows);
  }

  const followersFilter = getWhere(constraints, 'following', 'array-contains');
  if (typeof followersFilter?.value === 'string') {
    const response = await getAppViewAgent().getFollowers({
      actor: followersFilter.value,
      limit: getLimit(constraints) ?? 50
    });
    return hydrateProfiles(response.data.followers);
  }

  const knownFollowersFilter = getWhere(
    constraints,
    'knownFollowers',
    'array-contains'
  );
  if (typeof knownFollowersFilter?.value === 'string')
    return getKnownFollowers(
      knownFollowersFilter.value,
      getLimit(constraints) ?? 50
    );

  const response = await getAppViewAgent().getSuggestions({
    limit: getLimit(constraints) ?? 20
  });
  const excludeId = getWhere(constraints, 'id', '!=')?.value;

  const users = await hydrateProfiles(response.data.actors);

  return users.filter((user) => user.id !== excludeId);
}

async function queryTweets(constraints: BackendConstraint[]): Promise<Tweet[]> {
  const createdBy = getWhere(constraints, 'createdBy', '==')?.value;
  const likedBy = getWhere(constraints, 'userLikes', 'array-contains')?.value;
  const retweetedBy = getWhere(
    constraints,
    'userRetweets',
    'array-contains'
  )?.value;
  const parentEq = getWhere(constraints, 'parent', '==');
  const parentId = getWhere(constraints, 'parent.id', '==')?.value;
  const imageFilter = getWhere(constraints, 'images', '!=');
  const limitCount = getLimit(constraints);

  if (typeof parentId === 'string') return getThreadReplies(parentId);

  if (typeof likedBy === 'string') return getLikedFeed(likedBy);

  if (typeof retweetedBy === 'string')
    return sortByCreatedAt(await getRepostedFeed(retweetedBy)).slice(
      0,
      limitCount
    );

  if (typeof createdBy === 'string') {
    const tweets = await getAuthorFeed(createdBy, {
      includeReplies: !parentEq,
      onlyMedia: !!imageFilter
    });

    return sortByCreatedAt(tweets).slice(0, limitCount);
  }

  if (parentEq?.value === null) return getTimeline(limitCount);

  return getTimeline(limitCount);
}

async function readBookmarks(_userId: string): Promise<Bookmark[]> {
  void _userId;

  const moderationOpts = await getSafeModerationOpts();
  const bookmarks: Bookmark[] = [];
  let cursor: string | undefined;

  do {
    const response = await callAppQueryXrpc<BookmarksResponse>(
      'app.bsky.bookmark.getBookmarks',
      { limit: 100, cursor }
    );

    response.bookmarks.forEach(({ subject, item, createdAt }) => {
      if (!subject) return;

      const id = postIdFromUri(subject.uri);

      postRefCache.set(id, subject);
      if (AppBskyFeedDefs.isPostView(item)) {
        const postItem = item as AppBskyFeedDefs.PostView;

        if (!isModerationFilteredWithoutTombstone(postItem, moderationOpts))
          mapPost(postItem);
      }
      bookmarks.push({
        id,
        createdAt: createdAt
          ? Timestamp.fromDate(new Date(createdAt))
          : Timestamp.now()
      });
    });

    cursor = response.cursor;
  } while (cursor);

  return bookmarks;
}

export async function queryCollection<T>(
  collectionName: CollectionName,
  constraints: BackendConstraint[],
  ownerId?: string
): Promise<T[]> {
  if (!agent && collectionName !== 'users' && collectionName !== 'tweets')
    return [];

  if (collectionName === 'users')
    return (await queryUsers(constraints)) as unknown as T[];
  if (collectionName === 'tweets')
    return (await queryTweets(constraints)) as unknown as T[];
  if (collectionName === 'bookmarks')
    return (await readBookmarks(ownerId ?? '')) as unknown as T[];

  const likes = ownerId
    ? (await getLikedFeed(ownerId)).map((tweet) => tweet.id)
    : [];
  const stats: Stats = { likes, tweets: [], updatedAt: null };
  return [stats] as unknown as T[];
}

export async function getDocument<T>(
  collectionName: CollectionName,
  id: string,
  ownerId?: string
): Promise<T | null> {
  if (!agent && collectionName !== 'users' && collectionName !== 'tweets')
    return null;

  if (collectionName === 'users')
    return (await getUser(id)) as unknown as T | null;
  if (collectionName === 'tweets')
    return (await getTweet(id)) as unknown as T | null;
  if (collectionName === 'bookmarks') {
    const bookmark = (await readBookmarks(ownerId ?? '')).find(
      (item) => item.id === id
    );
    return (bookmark ?? null) as unknown as T | null;
  }

  const stats: Stats = { likes: [], tweets: [], updatedAt: null };
  return stats as unknown as T;
}

async function getQuoteRef(
  quoteTarget?: AddTweetData['quoteTarget']
): Promise<PostRef | undefined> {
  if (!quoteTarget) return undefined;

  const cachedRef = postRefCache.get(quoteTarget.id);
  if (cachedRef) return cachedRef;

  let uri = uriFromPostId(quoteTarget.id);
  if (!uri.startsWith('at://')) {
    if (!quoteTarget.createdBy) return undefined;
    uri = `at://${quoteTarget.createdBy}/app.bsky.feed.post/${quoteTarget.id}`;
  }

  const post = (await getAppViewAgent().getPosts({ uris: [uri] })).data
    .posts[0];
  if (!post) return undefined;

  const ref = { uri: post.uri, cid: post.cid };
  postRefCache.set(quoteTarget.id, ref);
  return ref;
}

function getRepoFromAtUri(uri: string): string | null {
  return /^at:\/\/([^/]+)\//.exec(uri)?.[1] ?? null;
}

function getRkeyFromAtUri(uri: string): string | null {
  return uri.split('/').pop() ?? null;
}

function getThreadgateAllow(
  replySetting?: TweetReplySetting
): AppBskyFeedThreadgate.Record['allow'] | undefined {
  if (!replySetting || replySetting === 'everyone') return undefined;
  if (replySetting === 'none') return [];
  if (replySetting === 'following')
    return [{ $type: 'app.bsky.feed.threadgate#followingRule' }];
  if (replySetting === 'followers')
    return [{ $type: 'app.bsky.feed.threadgate#followerRule' }];

  return [{ $type: 'app.bsky.feed.threadgate#mentionRule' }];
}

async function createThreadgate(
  api: Agent,
  postUri: string,
  replySetting?: TweetReplySetting
): Promise<void> {
  const allow = getThreadgateAllow(replySetting);
  if (allow === undefined) return;

  const repo = getRepoFromAtUri(postUri);
  const rkey = getRkeyFromAtUri(postUri);
  if (!repo || !rkey) return;

  await api.app.bsky.feed.threadgate.create(
    {
      repo,
      rkey
    },
    {
      post: postUri,
      allow,
      createdAt: new Date().toISOString()
    }
  );
}

function isVideoUpload({ file }: UploadedImage): boolean {
  return file.type === 'video/mp4' || /\.mp4$/i.test(file.name);
}

function isImageUpload(upload: UploadedImage): boolean {
  return !isVideoUpload(upload);
}

function getAuthoredAltText({ preview }: UploadedImage): string {
  return preview.altText?.trim() ?? '';
}

type VideoMetadata = {
  aspectRatio: AppBskyEmbedVideo.Main['aspectRatio'];
  duration: number;
};

function loadVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const video = document.createElement('video');

    const cleanup = (): void => {
      URL.revokeObjectURL(src);
      video.removeAttribute('src');
      video.load();
    };

    video.preload = 'metadata';
    video.onloadedmetadata = (): void => {
      const metadata = {
        aspectRatio: getImageAspectRatio(video.videoWidth, video.videoHeight),
        duration: Number.isFinite(video.duration) ? video.duration : 0
      };

      cleanup();
      resolve(metadata);
    };
    video.onerror = (): void => {
      cleanup();
      reject(new Error('Unable to read that video file.'));
    };
    video.src = src;
  });
}

async function waitForVideoJob(
  api: Agent,
  initialStatus: AppBskyVideoDefs.JobStatus
): Promise<AppBskyVideoDefs.JobStatus> {
  let status = initialStatus;

  for (let attempt = 0; attempt < BSKY_VIDEO_JOB_RETRIES; attempt += 1) {
    if (status.state === 'JOB_STATE_COMPLETED') return status;

    if (status.state === 'JOB_STATE_FAILED')
      throw new Error(
        status.message ?? status.error ?? 'Bluesky could not process the video.'
      );

    await wait(1000);
    status = (await api.app.bsky.video.getJobStatus({ jobId: status.jobId }))
      .data.jobStatus;
  }

  throw new Error('Bluesky is still processing that video. Try again shortly.');
}

function isVideoJobStatus(value: unknown): value is AppBskyVideoDefs.JobStatus {
  return (
    isPlainObject(value) &&
    typeof value.jobId === 'string' &&
    typeof value.state === 'string'
  );
}

function parseVideoJobStatus(value: unknown): AppBskyVideoDefs.JobStatus {
  if (isVideoJobStatus(value)) return value;

  if (isPlainObject(value) && isVideoJobStatus(value.jobStatus))
    return value.jobStatus;

  if (isPlainObject(value) && isPlainObject(value.jobStatus))
    return parseVideoJobStatus(value.jobStatus);

  if (isPlainObject(value) && value.blob)
    return {
      jobId: typeof value.jobId === 'string' ? value.jobId : '',
      did: typeof value.did === 'string' ? value.did : sessionDid ?? '',
      state: 'JOB_STATE_COMPLETED',
      blob: value.blob as AppBskyVideoDefs.JobStatus['blob'],
      error: typeof value.error === 'string' ? value.error : undefined,
      message: typeof value.message === 'string' ? value.message : undefined
    };

  throw new Error('Bluesky did not return a valid video processing job.');
}

function tryParseVideoJobStatus(
  value: unknown
): AppBskyVideoDefs.JobStatus | null {
  try {
    return parseVideoJobStatus(value);
  } catch {
    return null;
  }
}

function getVideoUploadName(file: File): string {
  const trimmedName = file.name.trim();
  const name = trimmedName || 'video.mp4';
  const extension = /\.mp4$/i.test(name) ? '' : '.mp4';
  const baseName = (extension ? name : name.replace(/\.mp4$/i, ''))
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  const uniqueSuffix = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  return `${baseName || 'video'}-${uniqueSuffix}.mp4`;
}

async function getVideoUploadLimits(): Promise<AppBskyVideoGetUploadLimits.OutputSchema | null> {
  try {
    return (
      await getAgent()
        .withProxy(BSKY_VIDEO_SERVICE, BSKY_VIDEO_DID)
        .app.bsky.video.getUploadLimits()
    ).data;
  } catch {
    return null;
  }
}

async function uploadVideoToBlueskyService(
  file: File
): Promise<AppBskyVideoDefs.JobStatus> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');

  const token = await getServiceAuthToken(
    BSKY_VIDEO_CONFIG,
    'app.bsky.video.uploadVideo'
  );
  const uploadUrl = new URL('/xrpc/app.bsky.video.uploadVideo', BSKY_VIDEO_URL);

  uploadUrl.searchParams.set('did', sessionDid);
  uploadUrl.searchParams.set('name', getVideoUploadName(file));

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'video/mp4'
    },
    body: file
  });

  const body: unknown = await response.json().catch(() => null);
  const jobStatus = tryParseVideoJobStatus(body);

  if (response.ok) {
    if (jobStatus) return jobStatus;

    throw new Error('Bluesky did not return a valid video processing job.');
  }

  if (response.status === 409 && jobStatus?.blob) return jobStatus;

  {
    const fallbackMessage = response.statusText || `HTTP ${response.status}`;
    throw new Error(getXrpcErrorMessage(body, fallbackMessage));
  }
}

async function uploadVideoForBluesky(
  upload: UploadedImage
): Promise<AppBskyEmbedVideo.Main> {
  const { file } = upload;

  if (!isVideoUpload(upload))
    throw new Error('Bluesky video uploads must be MP4 files.');

  if (file.size > BSKY_VIDEO_MAX_BYTES)
    throw new Error('Bluesky videos must be 100 MB or smaller.');

  const [metadata, limits] = await Promise.all([
    loadVideoMetadata(file),
    getVideoUploadLimits()
  ]);

  if (metadata.duration > BSKY_VIDEO_MAX_DURATION_SECONDS)
    throw new Error('Bluesky videos must be 3 minutes or shorter.');

  if (limits && !limits.canUpload)
    throw new Error(
      limits.message ?? limits.error ?? 'Bluesky is not allowing video uploads.'
    );

  const videoApi = getVideoAgent();
  const jobStatus = await waitForVideoJob(
    videoApi,
    await uploadVideoToBlueskyService(file)
  );

  if (!jobStatus.blob)
    throw new Error('Bluesky did not return a processed video blob.');

  return {
    $type: 'app.bsky.embed.video',
    video: toRepoRecordBlobRef(jobStatus.blob),
    alt: getAuthoredAltText(upload) || undefined,
    aspectRatio: metadata.aspectRatio,
    presentation: 'default'
  };
}

async function uploadExternalThumbForBluesky(
  api: Agent,
  image: string | null,
  title: string
): Promise<AppBskyEmbedExternal.External['thumb'] | undefined> {
  if (!image) return undefined;

  try {
    const response = await fetch(image);

    if (!response.ok) return undefined;

    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return undefined;

    const extension = blob.type.includes('png')
      ? 'png'
      : blob.type.includes('webp')
      ? 'webp'
      : 'jpg';
    const file = new File([blob], `${title || 'thumbnail'}.${extension}`, {
      type: blob.type
    });
    const preparedImage = await prepareImageForBluesky(file, {
      maxBytes: BSKY_EXTERNAL_THUMB_MAX_BYTES,
      targetBytes: BSKY_EXTERNAL_THUMB_TARGET_BYTES
    });
    const upload = await api.uploadBlob(preparedImage.file, {
      encoding: preparedImage.encoding
    });

    return toRepoRecordBlobRef(upload.data.blob, preparedImage.file.size);
  } catch {
    return undefined;
  }
}

async function buildExternalEmbed(
  api: Agent,
  card: TweetCard | null | undefined
): Promise<AppBskyEmbedExternal.Main | undefined> {
  if (!card || card.type !== 'external') return undefined;

  return {
    $type: 'app.bsky.embed.external',
    external: {
      uri: card.url,
      title: card.title || card.url,
      description: card.description ?? '',
      thumb: await uploadExternalThumbForBluesky(api, card.image, card.title),
      associatedRefs: card.associatedRefs?.length
        ? card.associatedRefs
        : undefined
    }
  };
}

type AddTweetData = Partial<Tweet> & {
  quoteTarget?: { id: string; createdBy: string };
  replySetting?: TweetReplySetting;
};

type PostRecordEmbed = NonNullable<AppBskyFeedPost.Record['embed']>;

export async function addTweet(data: AddTweetData): Promise<Tweet> {
  const api = getAgent();
  const text = data.text ?? '';
  const richText = new RichText({ text }, { cleanNewlines: true });
  await richText.detectFacets(api);

  const images = stagedImages.get(data.createdBy ?? '') ?? [];
  stagedImages.delete(data.createdBy ?? '');
  const imageUploads = images.filter(isImageUpload);
  const videoUploads = images.filter(isVideoUpload);

  if (imageUploads.length && videoUploads.length)
    throw new Error('Bluesky allows either one video or up to 10 images.');

  if (imageUploads.length > BSKY_POST_IMAGE_MAX_COUNT)
    throw new Error('Bluesky allows up to 10 images per Tweet.');

  if (videoUploads.length > 1)
    throw new Error('Bluesky allows only one video per Tweet.');

  const imageUploadsData =
    imageUploads.length > 0
      ? await Promise.all(
          imageUploads.map(async ({ file, preview }) => {
            const preparedImage = await prepareImageForBluesky(file);
            const upload = await api.uploadBlob(preparedImage.file, {
              encoding: preparedImage.encoding
            });

            return {
              image: toRepoRecordBlobRef(
                upload.data.blob,
                preparedImage.file.size
              ),
              alt: getAuthoredAltText({ file, preview }),
              aspectRatio: preparedImage.aspectRatio
            };
          })
        )
      : undefined;
  const imageEmbed =
    imageUploads.length > 4
      ? imageUploadsData
        ? ({
            $type: 'app.bsky.embed.gallery',
            items: imageUploadsData
          } as const)
        : undefined
      : imageUploadsData
        ? ({
            $type: 'app.bsky.embed.images',
            images: imageUploadsData
          } as const)
        : undefined;
  const videoEmbed = videoUploads[0]
    ? await uploadVideoForBluesky(videoUploads[0])
    : undefined;
  const externalEmbed = await buildExternalEmbed(api, data.card);
  const mediaEmbeds = [imageEmbed, videoEmbed, externalEmbed].filter(Boolean);

  if (mediaEmbeds.length > 1)
    throw new Error('Bluesky allows one media attachment type per Tweet.');

  const mediaEmbed = (imageEmbed ?? videoEmbed ?? externalEmbed) as
    | PostRecordEmbed
    | undefined;
  const quoteRef = await getQuoteRef(data.quoteTarget);
  const quoteEmbed = quoteRef
    ? ({
        $type: 'app.bsky.embed.record',
        record: quoteRef
      } as PostRecordEmbed)
    : undefined;
  const embed = (
    mediaEmbed && quoteEmbed
      ? {
          $type: 'app.bsky.embed.recordWithMedia',
          record: quoteEmbed,
          media: mediaEmbed
        }
      : mediaEmbed ?? quoteEmbed
  ) as AppBskyFeedPost.Record['embed'];

  const parentId = data.parent?.id;
  const parentRef = parentId ? await getPostRef(parentId) : undefined;
  if (parentId && !parentRef)
    throw new Error('Reply target was not available.');

  const parentReplyRef = parentId ? postReplyRefCache.get(parentId) : undefined;
  const replyRef = parentRef
    ? {
        root: parentReplyRef?.root ?? parentRef,
        parent: parentRef
      }
    : undefined;

  const postRecord: AppBskyFeedPost.Record = {
    $type: 'app.bsky.feed.post',
    text: richText.text,
    langs: getDefaultPostLanguages(),
    facets: richText.facets,
    embed,
    reply: replyRef,
    createdAt: new Date().toISOString()
  };
  const result = await api.post(postRecord);
  await createThreadgate(api, result.uri, data.replySetting);

  const localTweet: Tweet = {
    id: postIdFromUri(result.uri),
    text: richText.text || null,
    langs: getPostLanguages(postRecord),
    images: images.length
      ? images.map(({ preview }) => preview)
      : data.images ?? null,
    mediaWarning: null,
    card:
      data.card && isThirdPartyGifUrl(data.card.url) ? null : data.card ?? null,
    quotedTweet: data.quotedTweet ?? null,
    parent: data.parent ?? null,
    userLikes: [],
    createdBy: sessionDid ?? '',
    createdAt: Timestamp.now(),
    updatedAt: null,
    userReplies: 0,
    userRetweets: [],
    userQuotes: data.userQuotes ?? 0,
    bookmarkCount: data.bookmarkCount ?? 0,
    replySetting: data.replySetting ?? 'everyone',
    viewerCanReply: true,
    threadMuted: false
  };
  let visibleTweet = localTweet;

  if (imageEmbed || videoEmbed) {
    try {
      visibleTweet = {
        ...(await waitForPublishedPost(
          result.uri,
          imageEmbed ? 'image' : 'video'
        )),
        parent: localTweet.parent
      };
    } catch (error) {
      await api.deletePost(result.uri).catch(() => undefined);
      throw error;
    }
  }

  postRefCache.set(visibleTweet.id, result);
  if (replyRef) postReplyRefCache.set(visibleTweet.id, replyRef);
  if (data.quoteTarget?.id)
    localQuoteTargetIds.set(visibleTweet.id, data.quoteTarget.id);
  tweetCache.set(visibleTweet.id, visibleTweet);
  locallyDeletedTweetIds.delete(visibleTweet.id);
  locallyCreatedTweets.set(visibleTweet.id, visibleTweet);
  if (parentId) {
    const parentTweet = tweetCache.get(parentId);
    if (parentTweet) parentTweet.userReplies += 1;
  }
  if (data.quoteTarget?.id) {
    const quotedTweet = tweetCache.get(data.quoteTarget.id);
    if (quotedTweet) quotedTweet.userQuotes += 1;
  }
  notify();

  return visibleTweet;
}

export function stageImages(
  userId: string,
  files: FilesWithId,
  sourcePreviews: ImagesPreview = []
): ImagesPreview {
  const sourcePreviewById = new Map<string, ImagesPreview[number]>();

  sourcePreviews.forEach((preview) => {
    sourcePreviewById.set(preview.id, preview);
  });

  const previews = files.map((file) => {
    const sourcePreview = sourcePreviewById.get(file.id);

    return {
      id: file.id,
      src: URL.createObjectURL(file),
      alt: sourcePreview?.alt ?? file.name,
      altText: sourcePreview?.altText ?? null,
      type: file.type
    };
  });

  stagedImages.set(
    userId,
    files.map((file, index) => ({ file, preview: previews[index] }))
  );

  return previews;
}

async function fetchStoredBlobSize(
  api: Agent,
  blob: StrictBlobRef
): Promise<number | null> {
  if (!sessionDid) return null;

  try {
    const response = await api.com.atproto.sync.getBlob({
      did: sessionDid,
      cid: String(blob.ref)
    });

    return response.data.byteLength > 0 ? response.data.byteLength : null;
  } catch {
    return null;
  }
}

async function normalizeProfileBlobForWrite(
  api: Agent,
  blob: unknown
): Promise<StrictBlobRef | null> {
  if (!blob) return null;

  let parsedBlob: StrictBlobRef;

  try {
    parsedBlob = parseBlobRef(blob);
  } catch {
    return null;
  }

  const size =
    getBlobRefSize(parsedBlob) ?? (await fetchStoredBlobSize(api, parsedBlob));

  if (!size)
    throw new Error(
      'Bluesky did not provide a size for existing profile media.'
    );

  return toRepoRecordBlobRef(parsedBlob, size);
}

async function normalizeProfileRecordForWrite(
  api: Agent,
  profile: Partial<AppBskyActorProfile.Record>
): Promise<Partial<AppBskyActorProfile.Record>> {
  const nextProfile = { ...profile };

  if ('avatar' in nextProfile) {
    const avatar = await normalizeProfileBlobForWrite(api, nextProfile.avatar);
    if (avatar) nextProfile.avatar = avatar;
    else delete nextProfile.avatar;
  }

  if ('banner' in nextProfile) {
    const banner = await normalizeProfileBlobForWrite(api, nextProfile.banner);
    if (banner) nextProfile.banner = banner;
    else delete nextProfile.banner;
  }

  return nextProfile;
}

async function upsertProfileRecord(
  api: Agent,
  updateRecord: (
    existing: Partial<AppBskyActorProfile.Record>
  ) => Partial<AppBskyActorProfile.Record>
): Promise<void> {
  await api.upsertProfile(async (existing) => {
    const updated = (await normalizeProfileRecordForWrite(
      api,
      updateRecord(existing ?? {})
    )) as AppBskyActorProfile.Record;
    updated.$type = 'app.bsky.actor.profile';
    return updated;
  });
}

function normalizeProfileWebsiteForWrite(
  value: string | null | undefined
): string | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue) return null;

  return /^[a-z][a-z0-9+.-]*:/i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;
}

export async function updateProfile(
  userId: string,
  data: Partial<User>,
  mediaFiles?: ProfileMediaFiles
): Promise<void> {
  writeThemeOverride(userId, data);

  const avatarFile = mediaFiles?.photoURL?.[0];
  const bannerFile = mediaFiles?.coverPhotoURL?.[0];
  const api = getAgent();
  const [avatarUpload, bannerUpload] = await Promise.all([
    avatarFile
      ? prepareProfileImageForBluesky(avatarFile).then((preparedImage) =>
          api
            .uploadBlob(preparedImage.file, {
              encoding: preparedImage.encoding
            })
            .then(
              ({ data }) =>
                toRepoRecordBlobRef(
                  data.blob,
                  preparedImage.file.size
                ) as AppBskyActorProfile.Record['avatar']
            )
        )
      : null,
    bannerFile
      ? prepareProfileImageForBluesky(bannerFile).then((preparedImage) =>
          api
            .uploadBlob(preparedImage.file, {
              encoding: preparedImage.encoding
            })
            .then(
              ({ data }) =>
                toRepoRecordBlobRef(
                  data.blob,
                  preparedImage.file.size
                ) as AppBskyActorProfile.Record['banner']
            )
        )
      : null
  ]);
  const localMediaUrls: LocalProfileMediaUrls = {};
  const avatarCdnUrl = getProfileMediaCdnUrl(userId, 'avatar', avatarUpload);
  const bannerCdnUrl = getProfileMediaCdnUrl(userId, 'banner', bannerUpload);

  if (avatarCdnUrl) localMediaUrls.photoURL = avatarCdnUrl;
  if (bannerCdnUrl) localMediaUrls.coverPhotoURL = bannerCdnUrl;

  const shouldUpdateProfile =
    'name' in data ||
    'bio' in data ||
    'pronouns' in data ||
    'birthday' in data ||
    'website' in data ||
    !!avatarUpload ||
    !!bannerUpload ||
    ('coverPhotoURL' in data && data.coverPhotoURL === null);

  if (shouldUpdateProfile) {
    await upsertProfileRecord(api, (existing) => {
      const nextProfile = { ...existing };

      if ('name' in data) nextProfile.displayName = data.name ?? '';
      if ('bio' in data) nextProfile.description = data.bio ?? '';
      if ('pronouns' in data) {
        const nextPronouns = data.pronouns?.trim();

        if (nextPronouns) nextProfile.pronouns = nextPronouns;
        else delete nextProfile.pronouns;
      }
      if ('birthday' in data) {
        const nextBirthday = normalizeProfileBirthday(data.birthday);

        if (nextBirthday) nextProfile.birthday = nextBirthday;
        else delete nextProfile.birthday;
      }
      if ('website' in data) {
        const nextWebsite = normalizeProfileWebsiteForWrite(data.website);

        if (nextWebsite) nextProfile.website = nextWebsite;
        else delete nextProfile.website;
      }
      if (avatarUpload) nextProfile.avatar = avatarUpload;
      if (bannerUpload) nextProfile.banner = bannerUpload;
      else if ('coverPhotoURL' in data && data.coverPhotoURL === null)
        delete nextProfile.banner;

      return nextProfile;
    });
  }

  if (shouldUpdateProfile) {
    invalidateUserProfileCache(userId);
    applyLocalProfileUpdate(userId, data, localMediaUrls);
    await refreshCurrentUser().catch(() => null);
    applyLocalProfileUpdate(userId, data, localMediaUrls);
  } else {
    await refreshCurrentUser().catch(() => null);
  }

  if (currentUser?.id === userId) updateSavedAccount(currentUser);

  notify();
}

export async function setPinnedPost(tweetId: string | null): Promise<void> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');

  const api = getAgent();
  const pinnedPost = tweetId ? await getPostRef(tweetId) : null;

  if (tweetId && !pinnedPost)
    throw new Error('Tweet reference was not available to pin.');

  await upsertProfileRecord(api, (existing) => {
    const nextProfile = { ...existing };

    if (pinnedPost) nextProfile.pinnedPost = pinnedPost;
    else delete nextProfile.pinnedPost;

    return nextProfile;
  });

  const nextPinnedTweet = pinnedPost ? tweetId : null;

  if (currentUser) {
    currentUser.pinnedTweet = nextPinnedTweet;
    updateSavedAccount(currentUser);
  }

  const cachedCurrentUser = userCache.get(sessionDid);
  if (cachedCurrentUser) cachedCurrentUser.pinnedTweet = nextPinnedTweet;

  invalidateUserProfileCache(sessionDid);
  notify();
}

export async function followUser(targetDid: string): Promise<void> {
  const targetUser = userCache.get(targetDid);
  if (targetUser?.blocking || targetUser?.blockedBy) return;

  const previousOverride = localViewerFollowOverrides.get(targetDid);
  const wasFollowing =
    currentFollowing.has(targetDid) ||
    !!(targetUser && sessionDid && targetUser.followers.includes(sessionDid));

  try {
    const followRef = await getAgent().follow(targetDid);
    if (followRef.uri) followUriCache.set(targetDid, followRef.uri);
  } catch (error) {
    if (previousOverride === undefined) {
      localViewerFollowOverrides.delete(targetDid);
    } else {
      localViewerFollowOverrides.set(targetDid, previousOverride);
    }
    throw error;
  }

  localViewerFollowOverrides.set(targetDid, true);
  currentFollowing.add(targetDid);
  if (currentUser) {
    currentUser.following = Array.from(currentFollowing);
    if (!wasFollowing) currentUser.followingCount += 1;
  }

  if (targetUser && sessionDid && !targetUser.followers.includes(sessionDid)) {
    targetUser.followers = [sessionDid, ...targetUser.followers];
    targetUser.followersCount += 1;
  }

  notify('relationship');
}

function applyLocalFollowRemoval(targetDid: string): void {
  const targetUser = userCache.get(targetDid);
  const wasFollowing =
    currentFollowing.has(targetDid) ||
    !!(targetUser && sessionDid && targetUser.followers.includes(sessionDid));

  currentFollowing.delete(targetDid);
  followUriCache.delete(targetDid);
  localViewerFollowOverrides.set(targetDid, false);

  if (currentUser) {
    currentUser.following = Array.from(currentFollowing);
    if (wasFollowing)
      currentUser.followingCount = Math.max(0, currentUser.followingCount - 1);

    if (currentUser.followers.includes(targetDid)) {
      currentUser.followers = currentUser.followers.filter(
        (id) => id !== targetDid
      );
      currentUser.followersCount = Math.max(0, currentUser.followersCount - 1);
    }
  }

  if (targetUser && sessionDid) {
    const wasFollower = targetUser.followers.includes(sessionDid);
    targetUser.followers = targetUser.followers.filter(
      (id) => id !== sessionDid
    );
    if (wasFollower)
      targetUser.followersCount = Math.max(0, targetUser.followersCount - 1);
  }
}

export async function blockUser(targetDid: string): Promise<void> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');
  if (targetDid === sessionDid) return;

  const targetUser = userCache.get(targetDid);
  if (targetUser?.blocking && targetUser.blockingUri) return;

  const result = await getAgent().app.bsky.graph.block.create(
    { repo: sessionDid },
    {
      subject: targetDid,
      createdAt: new Date().toISOString()
    }
  );

  blockUriCache.set(targetDid, result.uri);
  applyLocalFollowRemoval(targetDid);
  deleteCachedTweetsByAuthor(targetDid);
  clearModerationSettingsCache();

  if (targetUser) {
    targetUser.blocking = true;
    targetUser.blockingUri = result.uri;
    targetUser.blockingByListName = null;
  }

  notify();
}

export async function unblockUser(targetDid: string): Promise<void> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');
  if (targetDid === sessionDid) return;

  const targetUser = userCache.get(targetDid);
  const blockUri =
    blockUriCache.get(targetDid) ??
    targetUser?.blockingUri ??
    (await getAppViewAgent().getProfile({ actor: targetDid })).data.viewer
      ?.blocking ??
    null;

  if (blockUri) {
    const rkey = rkeyFromAtUri(blockUri);
    if (!rkey) throw new Error('Could not resolve block record.');
    await getAgent().app.bsky.graph.block.delete({ repo: sessionDid, rkey });
  }

  blockUriCache.delete(targetDid);
  clearModerationSettingsCache();
  if (targetUser) {
    targetUser.blocking = false;
    targetUser.blockingUri = null;
    targetUser.blockingByListName = null;
  }

  notify();
}

export async function muteUser(targetDid: string): Promise<void> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');
  if (targetDid === sessionDid) return;

  const targetUser = userCache.get(targetDid);
  if (targetUser?.muting && !targetUser.mutingByListName) return;

  await getAgent().mute(targetDid);
  deleteCachedTweetsByAuthor(targetDid);
  clearModerationSettingsCache();

  if (targetUser) {
    targetUser.muting = true;
    targetUser.mutingByListName = null;
  }

  notify();
}

export async function unmuteUser(targetDid: string): Promise<void> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');
  if (targetDid === sessionDid) return;

  const targetUser = userCache.get(targetDid);
  if (targetUser?.mutingByListName) return;

  await getAgent().unmute(targetDid);
  clearModerationSettingsCache();

  if (targetUser) {
    targetUser.muting = false;
    targetUser.mutingByListName = null;
  }

  notify();
}

export async function reportUser(
  targetDid: string,
  reasonType: ModerationReportReason = 'other',
  reason?: string
): Promise<void> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');
  if (targetDid === sessionDid) return;

  await getAgent()
    .withProxy('atproto_labeler', BSKY_MODERATION_DID)
    .createModerationReport({
      reasonType: getModerationReportReasonType(reasonType),
      reason: getModerationReportReason(reason),
      subject: {
        $type: 'com.atproto.admin.defs#repoRef' as const,
        did: targetDid
      },
      modTool: getModerationReportModTool('account')
    });
}

export async function reportPost(
  tweetId: string,
  reasonType: ModerationReportReason = 'other',
  reason?: string
): Promise<void> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');

  const ref = await getPostRef(tweetId);
  if (!ref) throw new Error('Tweet reference was not available to report.');

  await getAgent()
    .withProxy('atproto_labeler', BSKY_MODERATION_DID)
    .createModerationReport({
      reasonType: getModerationReportReasonType(reasonType),
      reason: getModerationReportReason(reason),
      subject: {
        $type: 'com.atproto.repo.strongRef' as const,
        ...ref
      },
      modTool: getModerationReportModTool('post')
    });

  locallyReportedTweetIds.add(tweetId);
  const cachedTweet = tweetCache.get(tweetId);
  if (cachedTweet)
    tweetCache.set(tweetId, { ...cachedTweet, tombstone: 'reported' });
  notify();
}

async function resolveFollowUri(targetDid: string): Promise<string | null> {
  const cachedFollowUri = followUriCache.get(targetDid);
  if (cachedFollowUri) return cachedFollowUri;

  const viewerFollowUri =
    (
      await getAppViewAgent()
        .getProfile({ actor: targetDid })
        .catch(() => null)
    )?.data.viewer?.following ?? null;

  if (viewerFollowUri) {
    followUriCache.set(targetDid, viewerFollowUri);
    return viewerFollowUri;
  }

  if (!sessionDid) return null;

  let cursor: string | undefined;

  do {
    const response = await getAgent().com.atproto.repo.listRecords({
      repo: sessionDid,
      collection: 'app.bsky.graph.follow',
      limit: 100,
      cursor
    });

    for (const record of response.data.records) {
      if (isPlainObject(record.value) && record.value.subject === targetDid) {
        followUriCache.set(targetDid, record.uri);
        return record.uri;
      }
    }

    cursor = response.data.cursor;
  } while (cursor);

  return null;
}

export async function unfollowUser(targetDid: string): Promise<void> {
  const targetUser = userCache.get(targetDid);
  const previousOverride = localViewerFollowOverrides.get(targetDid);
  const wasFollowing =
    currentFollowing.has(targetDid) ||
    !!(targetUser && sessionDid && targetUser.followers.includes(sessionDid));

  localViewerFollowOverrides.set(targetDid, false);

  try {
    const followUri = await resolveFollowUri(targetDid);
    if (followUri) await getAgent().deleteFollow(followUri);
  } catch (error) {
    if (previousOverride === undefined) {
      localViewerFollowOverrides.delete(targetDid);
    } else {
      localViewerFollowOverrides.set(targetDid, previousOverride);
    }
    throw error;
  }

  currentFollowing.delete(targetDid);
  followUriCache.delete(targetDid);
  if (currentUser) {
    currentUser.following = Array.from(currentFollowing);
    if (wasFollowing) {
      currentUser.followingCount = Math.max(0, currentUser.followingCount - 1);
    }
  }

  if (targetUser && sessionDid) {
    const wasFollower = targetUser.followers.includes(sessionDid);
    targetUser.followers = targetUser.followers.filter(
      (id) => id !== sessionDid
    );
    if (wasFollower) {
      targetUser.followersCount = Math.max(0, targetUser.followersCount - 1);
    }
  }

  notify('relationship');
}

async function findViewerReactionUriInRepo(
  kind: ViewerReactionKind,
  ref: PostRef
): Promise<string | null> {
  if (!sessionDid) return null;

  const collection = getViewerReactionCollection(kind);
  let cursor: string | undefined;

  do {
    const response = await getAgent().com.atproto.repo.listRecords({
      repo: sessionDid,
      collection,
      limit: 100,
      cursor
    });

    for (const record of response.data.records) {
      const { value } = record;
      const subject = isPlainObject(value) ? value.subject : null;

      if (isPlainObject(subject) && subject.uri === ref.uri) {
        return record.uri;
      }
    }

    cursor = response.data.cursor;
  } while (cursor);

  return null;
}

async function resolveViewerReactionUri(
  kind: ViewerReactionKind,
  tweetId: string,
  ref: PostRef
): Promise<string | null> {
  const cachedUri = getCachedViewerReactionUri(kind, tweetId);
  if (cachedUri) return cachedUri;

  const post = (
    await getAppViewAgent()
      .getPosts({ uris: [ref.uri] })
      .catch(() => null)
  )?.data.posts[0];
  const viewerUri = post ? getPostViewerReactionUri(post, kind) : null;

  if (viewerUri) {
    cacheViewerReactionUri(kind, tweetId, viewerUri);
    return viewerUri;
  }

  const repoUri = await findViewerReactionUriInRepo(kind, ref);
  cacheViewerReactionUri(kind, tweetId, repoUri);
  return repoUri;
}

async function createViewerReaction(
  kind: ViewerReactionKind,
  tweetId: string,
  ref: PostRef
): Promise<void> {
  try {
    const result =
      kind === 'like'
        ? await getAgent().like(ref.uri, ref.cid)
        : await getAgent().repost(ref.uri, ref.cid);

    cacheViewerReactionUri(kind, tweetId, result.uri);
  } catch (error) {
    const existingUri = await resolveViewerReactionUri(
      kind,
      tweetId,
      ref
    ).catch(() => null);

    if (existingUri) return;
    throw error;
  }
}

async function deleteViewerReaction(
  kind: ViewerReactionKind,
  tweetId: string,
  ref: PostRef
): Promise<void> {
  const reactionUri = await resolveViewerReactionUri(kind, tweetId, ref);

  if (!reactionUri) return;

  try {
    if (kind === 'like') await getAgent().deleteLike(reactionUri);
    else await getAgent().deleteRepost(reactionUri);
  } catch (error) {
    if (!isRecordNotFoundError(error)) throw error;
  }

  deleteCachedViewerReactionUri(kind, tweetId);
}

function isViewerReactionActive(
  kind: ViewerReactionKind,
  tweetId: string,
  tweet: Tweet
): boolean {
  const override = getViewerReactionOverride(kind, tweetId);
  if (override) return override.active;
  if (!sessionDid) return false;
  return tweet[getViewerReactionField(kind)].includes(sessionDid);
}

export async function likePost(
  tweetId: string,
  type?: 'like' | 'unlike'
): Promise<void> {
  const tweet = await getTweet(tweetId);
  const ref = postRefCache.get(tweetId);
  if (!tweet || !ref || !sessionDid) return;

  const liked = isViewerReactionActive('like', tweetId, tweet);
  const shouldLike = type ? type === 'like' : !liked;
  if (shouldLike === liked) return;

  if (!shouldLike) await deleteViewerReaction('like', tweetId, ref);
  else await createViewerReaction('like', tweetId, ref);

  setViewerReactionOverride('like', tweetId, {
    active: shouldLike
  });
  updateCachedTweetViewerReaction(tweetId, 'like', shouldLike);
}

export async function repostPost(
  tweetId: string,
  type?: 'retweet' | 'unretweet'
): Promise<void> {
  const tweet = await getTweet(tweetId);
  const ref = postRefCache.get(tweetId);
  if (!tweet || !ref || !sessionDid) return;

  const reposted = isViewerReactionActive('repost', tweetId, tweet);
  const shouldRepost = type ? type === 'retweet' : !reposted;
  if (shouldRepost === reposted) return;

  if (!shouldRepost) await deleteViewerReaction('repost', tweetId, ref);
  else await createViewerReaction('repost', tweetId, ref);

  setViewerReactionOverride('repost', tweetId, {
    active: shouldRepost
  });
  updateCachedTweetViewerReaction(tweetId, 'repost', shouldRepost);
}

async function getThreadRootUri(tweetId: string): Promise<string | null> {
  const replyRef = postReplyRefCache.get(tweetId);
  if (replyRef) return replyRef.root.uri;

  const ref = postRefCache.get(tweetId) ?? (await getPostRef(tweetId));
  const resolvedReplyRef = postReplyRefCache.get(tweetId);

  return resolvedReplyRef?.root.uri ?? ref?.uri ?? null;
}

function setCachedThreadMuted(rootUri: string, muted: boolean): void {
  tweetCache.forEach((tweet, id) => {
    const ref = postRefCache.get(id);
    const replyRef = postReplyRefCache.get(id);
    const tweetRootUri = replyRef?.root.uri ?? ref?.uri;

    if (tweetRootUri === rootUri) tweet.threadMuted = muted;
  });

  locallyCreatedTweets.forEach((tweet, id) => {
    const ref = postRefCache.get(id);
    const replyRef = postReplyRefCache.get(id);
    const tweetRootUri = replyRef?.root.uri ?? ref?.uri;

    if (tweetRootUri === rootUri) tweet.threadMuted = muted;
  });
}

export async function setThreadMute(
  tweetId: string,
  muted: boolean
): Promise<void> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');

  const root = await getThreadRootUri(tweetId);
  if (!root) throw new Error('Tweet reference was not available.');

  await (muted
    ? getAgent().app.bsky.graph.muteThread({ root })
    : getAgent().app.bsky.graph.unmuteThread({ root }));

  setCachedThreadMuted(root, muted);
  notify();
}

export async function deletePost(tweetId: string): Promise<void> {
  const ref = postRefCache.get(tweetId);
  if (!ref) return;

  await getAgent().deletePost(ref.uri);
  tweetCache.delete(tweetId);
  locallyCreatedTweets.delete(tweetId);
  localQuoteTargetIds.delete(tweetId);
  locallyDeletedTweetIds.add(tweetId);
  notify();
}

export async function setBookmark(
  _userId: string,
  tweetId: string,
  bookmarked: boolean
): Promise<void> {
  void _userId;

  const ref = postRefCache.get(tweetId);
  if (!ref) throw new Error('Tweet reference was not available to bookmark.');

  await callAppXrpc(
    bookmarked
      ? 'app.bsky.bookmark.createBookmark'
      : 'app.bsky.bookmark.deleteBookmark',
    bookmarked ? ref : { uri: ref.uri }
  );
  notify();
}

export async function clearBookmarks(userId: string): Promise<void> {
  const bookmarks = await readBookmarks(userId);

  await Promise.all(
    bookmarks.map(async ({ id }) => {
      const ref = postRefCache.get(id);
      if (ref)
        await callAppXrpc('app.bsky.bookmark.deleteBookmark', {
          uri: ref.uri
        });
    })
  );

  notify();
}
