package ma.dari.api.user.dto;

import ma.dari.api.user.User;

import java.time.Instant;
import java.util.UUID;

/**
 * What a stranger sees before deciding whether to reply — a trust surface, and
 * the leak surface that matters most on the user side.
 *
 * <p>The protection is structural: this record has no field that could hold an
 * email, a phone number, a Firebase uid or an internal status, so leaking one
 * requires deliberately adding a field rather than forgetting to remove it.
 * A test asserts against the raw JSON, not against this shape.
 */
public record PublicProfileResponse(UUID id,
                                    String displayName,
                                    String city,
                                    String bio,
                                    String avatarUrl,
                                    VerificationTier verification,
                                    Instant memberSince,
                                    long activeListingCount) {

    public static PublicProfileResponse from(User u, long activeListingCount) {
        return new PublicProfileResponse(
                u.getId(), u.getDisplayName(), u.getCity(), u.getBio(), u.getAvatarUrl(),
                VerificationTier.of(u), u.getCreatedAt(), activeListingCount);
    }
}
