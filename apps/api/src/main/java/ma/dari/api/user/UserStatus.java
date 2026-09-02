package ma.dari.api.user;

/**
 * Moderation state of an account (design doc §6).
 *
 * <p>SUSPENDED is temporary and keeps conversation history reachable; BANNED is
 * terminal, rejected in the auth filter, and cascades to the account's listings.
 */
public enum UserStatus {
    ACTIVE,
    SUSPENDED,
    BANNED
}
