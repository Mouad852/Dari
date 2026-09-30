package ma.dari.api.user.dto;

import ma.dari.api.user.User;
import ma.dari.api.user.UserRole;
import ma.dari.api.user.UserStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * The caller's own profile. Private fields are legitimate here and only here —
 * this shape is returned exclusively from {@code /users/me}.
 */
public record UserResponse(UUID id,
                           String email,
                           boolean emailVerified,
                           String phone,
                           boolean phoneVerified,
                           String firstName,
                           String displayName,
                           String city,
                           String bio,
                           String avatarUrl,
                           UserRole role,
                           /*
                            * ACTIVE or SUSPENDED: a suspended account can still sign in
                            * and read, and the web shows why its writes are refused
                            * (audit P2-11). A banned or deleted one never gets here.
                            */
                           UserStatus status,
                           VerificationTier verification,
                           Instant createdAt) {

    /**
     * @param avatarUrl the stored avatar key already rendered for this
     *                  deployment's storage ({@code UserService#avatarUrl}), or null
     */
    public static UserResponse from(User u, String avatarUrl) {
        return new UserResponse(
                u.getId(), u.getEmail(), u.isEmailVerified(), u.getPhone(), u.isPhoneVerified(),
                u.getFirstName(), u.getDisplayName(), u.getCity(), u.getBio(), avatarUrl,
                u.getRole(), u.getStatus(), VerificationTier.of(u), u.getCreatedAt());
    }
}
