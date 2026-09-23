import type { Message } from '@/types/api';

/** The optimistic placeholder's id prefix. A server id is always a bare UUID. */
export const PENDING_PREFIX = 'pending-';

export function isPending(message: Message): boolean {
  return message.id.startsWith(PENDING_PREFIX);
}

/**
 * Folds a page from the API into the thread on screen.
 *
 * An older page goes in front and a newer one at the end, each already
 * oldest-first. A message the thread already holds is replaced in place (its
 * read receipt may have changed) and never added twice, whichever request
 * brought it first. Optimistic messages stay last until their send resolves.
 *
 * The final stable sort by send time only matters when two people write at
 * once: a reply sent just before one's own message can arrive through the poll
 * after the send already confirmed that message.
 */
export function mergeMessages(current: readonly Message[], incoming: readonly Message[], position: 'older' | 'newer'): Message[] {
  const incomingById = new Map(incoming.map((message) => [message.id, message]));
  const confirmed = current.filter((message) => !isPending(message)).map((message) => incomingById.get(message.id) ?? message);
  const known = new Set(confirmed.map((message) => message.id));
  const added = incoming.filter((message) => !known.has(message.id));
  const merged = position === 'older' ? [...added, ...confirmed] : [...confirmed, ...added];
  merged.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
  return [...merged, ...current.filter(isPending)];
}

/** Swaps an optimistic message for the server's copy, which a poll may already have delivered. */
export function confirmPending(current: readonly Message[], pendingId: string, sent: Message): Message[] {
  return mergeMessages(current.filter((message) => message.id !== pendingId), [sent], 'newer');
}
