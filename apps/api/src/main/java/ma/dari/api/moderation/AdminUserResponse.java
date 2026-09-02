package ma.dari.api.moderation;

import ma.dari.api.user.User;
import ma.dari.api.user.UserRole;
import ma.dari.api.user.UserStatus;

import java.time.Instant;
import java.util.UUID;

public record AdminUserResponse(UUID id,
                               String email,
                               String displayName,
                               String firstName,
                               String city,
                               UserRole role,
                               UserStatus status,
                               long reportCount,
                               Instant createdAt) {

    public static AdminUserResponse from(User user, long reportCount) {
        return new AdminUserResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getFirstName(),
                user.getCity(),
                user.getRole(),
                user.getStatus(),
                reportCount,
                user.getCreatedAt()
        );
    }
}
