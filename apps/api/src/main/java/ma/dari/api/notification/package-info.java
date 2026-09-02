/**
 * Outbound notifications.
 *
 * The interface is defined and stubbed in phase 06 so moderation code can call
 * it, and implemented in phase 10. Delivery is queued, never inline: an SMTP
 * timeout inside an admin action must not roll back a moderation decision.
 *
 * Copy follows the same rules as the interface -- French, vous, sentence case,
 * no emoji, no exclamation marks.
 */
package ma.dari.api.notification;
