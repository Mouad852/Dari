/**
 * Reports, the moderation queue, and admin actions.
 *
 * Contains the auto-flag rule (three distinct reporters in a rolling seven-day
 * window) and the dismiss-restore branch, which must return a listing to its
 * prior_status rather than to PUBLISHED -- restoring a listing that was never
 * published is the most consequential bug available in this codebase.
 *
 * Built in phase 06.
 */
package ma.dari.api.moderation;
