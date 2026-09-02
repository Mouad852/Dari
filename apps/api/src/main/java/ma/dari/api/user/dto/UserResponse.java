package ma.dari.api.user.dto;

import ma.dari.api.user.User;
import ma.dari.api.user.UserRole;

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
                           VerificationTier verification,
                           Instant createdAt) {

    public static UserResponse from(User u) {
        return new UserResponse(
                u.getId(), u.getEmail(), u.isEmailVerified(), u.getPhone(), u.isPhoneVerified(),
                u.getFirstName(), u.getDisplayName(), u.getCity(), u.getBio(), u.getAvatarUrl(),
                u.getRole(), VerificationTier.of(u), u.getCreatedAt());
    }
}
