import { confirmPending, mergeMessages, newestFetched, PENDING_PREFIX, pollAnchor, POLL_OVERLAP_MS } from '../messages';
import type { Message } from '@/types/api';

function message(id: string, minute: number, extra: Partial<Message> = {}): Message {
  return {
    id,
    conversationId: 'conversation-1',
    senderId: 'other-user',
    body: `Message ${id}`,
    sentAt: new Date(Date.UTC(2026, 8, 20, 10, minute)).toISOString(),
    readAt: null,
    ...extra,
  };
}

const ids = (messages: Message[]) => messages.map((item) => item.id);

describe('mergeMessages', () => {
  it('appends a newer page after the messages already on screen', () => {
    const current = [message('a', 1), message('b', 2)];
    expect(ids(mergeMessages(current, [message('c', 3), message('d', 4)], 'newer'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('puts an older page in front and keeps the loaded messages', () => {
    const current = [message('c', 3), message('d', 4)];
    expect(ids(mergeMessages(current, [message('a', 1), message('b', 2)], 'older'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('never adds a message twice when a poll repeats one', () => {
    const current = [message('a', 1), message('b', 2)];
    const once = mergeMessages(current, [message('b', 2), message('c', 3)], 'newer');
    const twice = mergeMessages(once, [message('c', 3)], 'newer');
    expect(ids(twice)).toEqual(['a', 'b', 'c']);
  });

  it('adds nothing for an empty page', () => {
    const current = [message('a', 1)];
    expect(mergeMessages(current, [], 'newer')).toEqual(current);
  });

  it('replaces a known message in place, so a read receipt updates', () => {
    const current = [message('a', 1, { senderId: 'me' })];
    const merged = mergeMessages(current, [message('a', 1, { senderId: 'me', readAt: '2026-09-20T10:05:00.000Z' })], 'newer');
    expect(merged).toHaveLength(1);
    expect(merged[0]!.readAt).toBe('2026-09-20T10:05:00.000Z');
  });

  it('keeps an unconfirmed own message last, after replies that arrive meanwhile', () => {
    const pending = message(`${PENDING_PREFIX}1`, 9, { senderId: 'me' });
    const merged = mergeMessages([message('a', 1), pending], [message('b', 2)], 'newer');
    expect(ids(merged)).toEqual(['a', 'b', `${PENDING_PREFIX}1`]);
  });

  it('orders by send time when a reply written first arrives after the own message', () => {
    const own = message('own', 3, { senderId: 'me' });
    const merged = mergeMessages([message('a', 1), own], [message('reply', 2), own], 'newer');
    expect(ids(merged)).toEqual(['a', 'reply', 'own']);
  });
});

describe('confirmPending', () => {
  it('swaps the placeholder for the server copy', () => {
    const pending = message(`${PENDING_PREFIX}1`, 5, { senderId: 'me' });
    const sent = message('sent', 5, { senderId: 'me' });
    expect(ids(confirmPending([message('a', 1), pending], pending.id, sent))).toEqual(['a', 'sent']);
  });

  it('does not duplicate a message the poll already delivered', () => {
    const pending = message(`${PENDING_PREFIX}1`, 5, { senderId: 'me' });
    const sent = message('sent', 5, { senderId: 'me' });
    expect(ids(confirmPending([message('a', 1), sent, pending], pending.id, sent))).toEqual(['a', 'sent']);
  });
});

describe('pollAnchor', () => {
  const fetchedOf = (...messages: Message[]) => new Map(messages.map((item) => [item.id, item.sentAt]));

  it('anchors a full overlap window behind the newest fetched message', () => {
    const fetched = fetchedOf(message('a', 1), message('b', 2), message('c', 3), message('d', 4));
    expect(POLL_OVERLAP_MS).toBe(60_000);
    expect(pollAnchor(fetched)).toBe('c');
    expect(newestFetched(fetched)).toBe('d');
  });

  it('reads the newest page when no fetched message is old enough', () => {
    expect(pollAnchor(fetchedOf(message('a', 1)))).toBeNull();
    expect(pollAnchor(new Map())).toBeNull();
    expect(newestFetched(new Map())).toBeNull();
  });

  it('still brings in a message stamped before one already polled but committed after it', () => {
    // a and c were fetched; b was stamped 30 s before c and committed only after c was polled.
    const a = message('a', 1);
    const c = message('c', 3);
    const b = message('b', 2, { sentAt: new Date(Date.parse(c.sentAt) - 30_000).toISOString() });
    const fetched = fetchedOf(a, c);
    const anchor = pollAnchor(fetched);
    expect(anchor).toBe('a');
    // What after=a returns now, in the API's (sentAt, id) order: b, then c again.
    const page = [b, c].filter((item) => Date.parse(item.sentAt) > Date.parse(fetched.get(anchor!)!));
    expect(ids(page)).toEqual(['b', 'c']);
    expect(ids(mergeMessages([a, c], page, 'newer'))).toEqual(['a', 'b', 'c']);
  });
});
