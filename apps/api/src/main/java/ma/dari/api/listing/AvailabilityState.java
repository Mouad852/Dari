package ma.dari.api.listing;

/**
 * The owner's axis of a listing's lifecycle (design doc §4).
 *
 * <p>Owned entirely by the owner; moderation never writes it. A listing appears
 * in search only when {@code status = PUBLISHED AND availability_state =
 * AVAILABLE}, an invariant enforced by a database view rather than remembered
 * at every call site.
 */
public enum AvailabilityState {

    /** Taking enquiries. The only state that appears in search. */
    AVAILABLE,

    /**
     * The room is let. Kept visible to existing conversations and to anyone who
     * favorited it, marked unavailable — a saved listing that vanishes without
     * explanation reads as a bug.
     */
    ROOM_FOUND,

    /** Withdrawn by the owner without letting it. */
    CLOSED
}
