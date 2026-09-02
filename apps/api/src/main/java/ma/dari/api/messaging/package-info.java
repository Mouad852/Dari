/**
 * Conversations and messages.
 *
 * Postgres is authoritative. Whether a Firestore projection is added for
 * realtime delivery is an open decision (phase 04); the transactional outbox is
 * built regardless, because it is cheap now and requires a full backfill to
 * retrofit later.
 *
 * Built in phase 04.
 */
package ma.dari.api.messaging;
