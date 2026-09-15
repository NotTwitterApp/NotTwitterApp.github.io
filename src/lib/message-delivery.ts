import type { ChatMessage } from '@lib/atproto/backend';

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';

export function getMessageDeliveryStatus(
  message: ChatMessage,
  viewerId: string | undefined,
  isMine: boolean
): MessageDeliveryStatus | null {
  if (!viewerId || !isMine || message.deleted) return null;

  if (message.readBy.some((readerId) => readerId !== viewerId)) return 'read';
  if (message.deliveredBy?.some((recipientId) => recipientId !== viewerId))
    return 'delivered';

  // The standard Bluesky message response confirms sending, but does not
  // include recipient receipts. Never infer delivery or reading from reactions.
  return 'sent';
}
