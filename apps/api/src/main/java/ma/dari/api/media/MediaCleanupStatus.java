package ma.dari.api.media;

public enum MediaCleanupStatus {
    PENDING,
    DELETED,
    /**
     * Given up after {@code dari.media.cleanup-max-attempts} failures. The
     * object may still exist; the key stays revoked until an operator acts.
     */
    DEAD
}
