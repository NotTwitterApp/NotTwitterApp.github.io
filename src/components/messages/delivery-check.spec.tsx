import { render, screen } from '@testing-library/react';
import { getMessageDeliveryStatus } from '@lib/message-delivery';
import { Timestamp } from '@lib/atproto/timestamp';
import type { ChatMessage } from '@lib/atproto/backend';
import { DeliveryCheck } from './delivery-check';

const viewerId = 'did:plc:sender';
const recipientId = 'did:plc:recipient';

function message(
  overrides: Partial<ChatMessage> & { deliveredBy?: string[] } = {}
): ChatMessage & { deliveredBy?: string[] } {
  return {
    id: 'message-1',
    text: 'Hello',
    senderId: viewerId,
    sentAt: Timestamp.fromDate(new Date('2021-08-01T12:00:00Z')),
    deleted: false,
    reactions: [],
    readBy: [],
    ...overrides
  };
}

describe('message delivery receipts', () => {
  it.each([
    ['sent', {}, 'Sent', 1, false],
    ['delivered', { deliveredBy: [recipientId] }, 'Delivered', 2, false],
    [
      'read',
      { deliveredBy: [recipientId], readBy: [recipientId] },
      'Read',
      2,
      true
    ]
  ] as const)(
    'renders the %s state from message data',
    (_, receipts, label, paths, blue) => {
      const data = message({
        deliveredBy: 'deliveredBy' in receipts ? [...receipts.deliveredBy] : [],
        readBy: 'readBy' in receipts ? [...receipts.readBy] : []
      });
      const status = getMessageDeliveryStatus(data, viewerId, true);
      expect(status).toBe(label.toLowerCase());
      render(<DeliveryCheck status={status!} />);
      const icon = screen.getByRole('img', { name: label });
      expect(icon.querySelectorAll('path')).toHaveLength(paths);
      expect(icon.classList.contains('text-accent-blue')).toBe(blue);
    }
  );

  it('does not treat reactions or the sender reading their own message as receipts', () => {
    const data = message({
      deliveredBy: [viewerId],
      readBy: [viewerId],
      reactions: [
        { value: '❤️', senderId: recipientId, createdAt: Timestamp.now() }
      ]
    });
    expect(getMessageDeliveryStatus(data, viewerId, true)).toBe('sent');
  });

  it('accepts an explicit read receipt even without a separate delivery receipt', () => {
    expect(
      getMessageDeliveryStatus(
        message({ readBy: [recipientId] }),
        viewerId,
        true
      )
    ).toBe('read');
  });

  it('hides receipts for incoming, deleted, and unauthenticated messages', () => {
    expect(getMessageDeliveryStatus(message(), viewerId, false)).toBeNull();
    expect(
      getMessageDeliveryStatus(message({ deleted: true }), viewerId, true)
    ).toBeNull();
    expect(getMessageDeliveryStatus(message(), undefined, true)).toBeNull();
  });
});
