package ma.dari.api.moderation;

/**
 * What a moderator decided (design doc §6). Every one writes an audit row.
 */
public enum ModerationAction {

    /**
     * No action. If the target was auto-suspended, this is what restores it —
     * to its {@code prior_status}, never unconditionally to PUBLISHED. That
     * branch is the highest-consequence code in the project: restoring a
     * listing that was only ever in review would publish something no moderator
     * ever approved.
     */
    DISMISS,

    /** Notifies the owner, changes no state. */
    WARN,

    /** Listing removed from search, or account access suspended. Reversible. */
    SUSPEND,

    /** Terminal for an account. Cascades to their listings, and blocks the identity. */
    BAN
}
