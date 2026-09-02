package ma.dari.api.user.dto;

import ma.dari.api.user.User;

/**
 * Derived, never stored.
 *
 * <p>The design doc mentions a verification tier but the schema only carries two
 * booleans. A stored column would be a third source of truth that can drift out
 * of agreement with them, and a wrong trust badge on an anti-scam platform is
 * worse than no badge.
 *
 * <p>{@link #EMAIL_PHONE} is unreachable until phone verification ships; the
 * badge is designed with room for it anyway.
 */
public enum VerificationTier {

    NONE,
    EMAIL,
    EMAIL_PHONE;

    public static VerificationTier of(User user) {
        if (user.isEmailVerified() && user.isPhoneVerified()) return EMAIL_PHONE;
        if (user.isEmailVerified()) return EMAIL;
        return NONE;
    }
}
