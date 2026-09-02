/**
 * Listings: the core aggregate.
 *
 * Owns the two-dimensional lifecycle from design doc section 4 -- status
 * (DRAFT / PENDING_REVIEW / PUBLISHED / REJECTED / SUSPENDED / EXPIRED) crossed
 * with availability_state (AVAILABLE / ROOM_FOUND / CLOSED). Those axes are
 * independent: an owner marking a room found must not undo moderation, and a
 * moderator suspending a listing must not silently republish it later.
 *
 * Also owns geospatial search (PostGIS geography, ST_DWithin) and the location
 * fuzzing chokepoint. Exact coordinates never leave this package except through
 * an admin-gated path.
 *
 * Built in phase 02, extended in phases 05 and 07.
 */
package ma.dari.api.listing;
