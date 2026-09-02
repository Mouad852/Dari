package ma.dari.api.moderation;

/**
 * Why something was reported (design doc §6).
 *
 * <p>A closed list, not free text. Moderation at volume needs grouping and
 * counting, and a free-text field cannot be counted. The optional note beside it
 * is where nuance goes.
 */
public enum ReportReason {

    /** The room does not exist, or the photos are not of it. */
    FAKE_LISTING,

    /** Rent or deposit differs from what is advertised. */
    MISLEADING_PRICE,

    /** An agent posing as the occupant — the abuse Dari exists to displace. */
    UNAUTHORISED_BROKER,

    /** Harassment or abuse in messages. */
    INAPPROPRIATE_BEHAVIOR,

    /** Discriminatory content in a listing or a message. */
    DISCRIMINATION,

    /** Advance-payment and deposit-scam patterns. */
    SUSPECTED_SCAM,

    /** Sits outside the list. The note carries the detail. */
    OTHER
}
