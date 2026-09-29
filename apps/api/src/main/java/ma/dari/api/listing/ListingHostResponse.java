package ma.dari.api.listing;

import ma.dari.api.user.User;
import ma.dari.api.user.dto.VerificationTier;

import java.time.Instant;
import java.util.UUID;

/**
 * Who offers a listing, as a seeker sees it before making contact: the same
 * trust signals as the public profile (verification, how long they have been
 * a member), and a link to it through {@code id}.
 *
 * <p>Like {@code PublicProfileResponse}, the protection is structural: there is
 * no field that could carry an email, a phone number, a Firebase uid or an
 * account status. {@code JsonWireContractApiTest} checks the raw JSON.
 */
public record ListingHostResponse(UUID id,
                                  String displayName,
                                  String avatarUrl,
                                  VerificationTier verification,
                                  Instant memberSince) {

    /** @param avatarUrl the owner's avatar already rendered for this deployment's storage, or null */
    static ListingHostResponse from(User owner, String avatarUrl) {
        return new ListingHostResponse(owner.getId(), owner.getDisplayName(), avatarUrl,
                VerificationTier.of(owner), owner.getCreatedAt());
    }
}
