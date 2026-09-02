package ma.dari.api.listing;

/**
 * The moderation axis of a listing's lifecycle (design doc §4).
 *
 * <p>Independent of {@link AvailabilityState}. Collapsing the two into one enum
 * is tempting and wrong: an owner marking a room found must not undo a
 * moderation decision, and a moderator suspending a listing must not silently
 * republish it when the owner later reopens.
 *
 * <p>Legal transitions are enforced by a state machine in phase 02, not by
 * scattered {@code setStatus} calls. The one that matters most:
 * {@code SUSPENDED} restores to the listing's {@code prior_status}, never
 * unconditionally to {@code PUBLISHED} — a listing suspended while still in
 * review must not become live because a report was dismissed.
 */
public enum ListingStatus {

    /** Being written. Visible only to its owner; wizard steps save here. */
    DRAFT,

    /** Submitted, awaiting a moderator. Not searchable. */
    PENDING_REVIEW,

    /** Approved and searchable — subject to availability_state. */
    PUBLISHED,

    /** Rejected with a reason. The owner may edit and resubmit. */
    REJECTED,

    /** Removed by moderation, from a report or an admin action. */
    SUSPENDED,

    /** Aged out (phase 10). Renewal re-enters PENDING_REVIEW, never PUBLISHED. */
    EXPIRED
}
