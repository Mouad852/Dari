package ma.dari.api.common.error;

/**
 * The stable contract between server and client. Clients branch on these names;
 * humans read {@link ErrorResponse#message()}. Adding a value is safe, renaming
 * one is a breaking API change.
 */
public enum ErrorCode {

    // --- authentication / identity ------------------------------------------
    UNAUTHENTICATED,
    INVALID_TOKEN,
    ACCOUNT_BANNED,
    ACCOUNT_SUSPENDED,
    /** Valid Firebase token, no internal profile row. The client must POST /users. */
    PROFILE_NOT_FOUND,
    PROFILE_ALREADY_EXISTS,

    // --- authorization -------------------------------------------------------
    FORBIDDEN,
    NOT_OWNER,

    // --- request -------------------------------------------------------------
    VALIDATION_FAILED,
    NOT_FOUND,
    CONFLICT,
    ALREADY_REPORTED,
    IDENTITY_BANNED,
    INVALID_CURSOR,
    ILLEGAL_TRANSITION,
    RATE_LIMITED,

    // --- server --------------------------------------------------------------
    INTERNAL_ERROR,
    /** Route exists in the skeleton, built in a later phase. See NotImplementedYetException. */
    NOT_IMPLEMENTED
}
