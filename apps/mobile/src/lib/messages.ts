/**
 * Folding API pages into an open thread.
 *
 * Hand-ported from apps/web/src/lib/messages.ts -- the thread contract is the
 * API's, not a platform's: GET /conversations/{id}/messages opens on the newest
 * page, `cursor` leads to older messages, `after` returns newer ones.
 */

import type { Message } from '@/types/api';

/** The optimistic placeholder's id prefix. A server id is always a bare UUID. */
export const PENDING_PREFIX = 'pending-';

export function isPending(message: Message): boolean {
  return message.id.startsWith(PENDING_PREFIX);
}

/**
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

/**
 * How far behind the newest fetched message each poll reads again.
 *
 * The API stamps `sentAt` when it builds a message, but the message becomes
 * visible only when its transaction commits. One stamped just before another
 * can commit just after it, so a poll asking only for what is newer than the
 * message it already has would skip it for good. Reading this window again on
 * every poll catches it, and the merge by id drops what the thread already
 * holds. A send is a few statements, each cut off by the API's 30 s statement
 * timeout (`DARI_DB_STATEMENT_TIMEOUT`), so a commit landing more than a minute
 * after its stamp is not expected. The cost is re-reading, each poll, the
 * messages of the thread's last minute.
 */
export const POLL_OVERLAP_MS = 60_000;

/**
 * The message a poll asks for messages `after=`: the newest fetched one at
 * least POLL_OVERLAP_MS older than the newest fetched one. Null when none is
 * that old: the poll then reads the newest page instead.
 *
 * `fetched` maps the id of every message a GET returned to its `sentAt`. Only
 * fetched messages count, never one this client just sent: a reply written a
 * moment before one's own message is newer than any anchor chosen from them.
 */
export function pollAnchor(fetched: ReadonlyMap<string, string>): string | null {
  let newest = -Infinity;
  for (const sentAt of fetched.values()) newest = Math.max(newest, Date.parse(sentAt));
  let anchor: string | null = null;
  let anchorTime = -Infinity;
  for (const [id, sentAt] of fetched) {
    const time = Date.parse(sentAt);
    if (time <= newest - POLL_OVERLAP_MS && time > anchorTime) {
      anchor = id;
      anchorTime = time;
    }
  }
  return anchor;
}

/** The newest fetched message, which a poll reading the newest page continues from if that page does not reach it. */
export function newestFetched(fetched: ReadonlyMap<string, string>): string | null {
  let newest: string | null = null;
  let newestTime = -Infinity;
  for (const [id, sentAt] of fetched) {
    const time = Date.parse(sentAt);
    if (time > newestTime) {
      newest = id;
      newestTime = time;
    }
  }
  return newest;
}

/** Swaps an optimistic message for the server's copy, which a poll may already have delivered. */
export function confirmPending(current: readonly Message[], pendingId: string, sent: Message): Message[] {
  return mergeMessages(current.filter((message) => message.id !== pendingId), [sent], 'newer');
}
