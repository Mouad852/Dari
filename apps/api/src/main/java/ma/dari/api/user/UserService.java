package ma.dari.api.user;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import ma.dari.api.common.auth.AuthenticatedUser;
import ma.dari.api.common.auth.FirebaseAuthFilter;
import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.listing.ListingRepository;
import ma.dari.api.listing.ListingStatus;
import ma.dari.api.media.ImageStore;
import ma.dari.api.moderation.BannedIdentityRepository;
import ma.dari.api.user.dto.CreateUserRequest;
import ma.dari.api.user.dto.PublicProfileResponse;
import ma.dari.api.user.dto.UpdateUserRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class UserService {

    private final FirebaseAuthFilter firebaseAuthFilter;
    private final UserRepository users;
    private final BannedIdentityRepository bannedIdentities;
    private final ListingRepository listings;
    private final ImageStore imageStore;
    private final FirebaseAuth firebaseAuth;

    public UserService(UserRepository users,
                       FirebaseAuthFilter firebaseAuthFilter,
                       BannedIdentityRepository bannedIdentities,
                       ListingRepository listings,
                       ImageStore imageStore,
                       FirebaseAuth firebaseAuth) {
        this.users = users;
        this.firebaseAuthFilter = firebaseAuthFilter;
        this.bannedIdentities = bannedIdentities;
        this.listings = listings;
        this.imageStore = imageStore;
        this.firebaseAuth = firebaseAuth;
    }

    /**
     * Replaces the caller's avatar.
     *
     * <p>Goes through the same {@link ImageStore} pipeline as listing photos, so
     * the re-encode that strips EXIF applies here too — a selfie taken at home
     * carries the same GPS problem a listing photo does.
     */
    @Transactional
    public User uploadAvatar(User user, MultipartFile file) {
        ImageStore.StoredImage stored = imageStore.store(ImageStore.AVATARS, user.getId(), file);

        String previous = user.getAvatarUrl();
        user.setAvatarUrl("/uploads/" + stored.storageKey());
        User saved = users.save(user);

        // Best-effort cleanup of the replaced file. A failure here must not fail
        // the upload: the new avatar is already stored and referenced, and an
        // orphaned old file is a housekeeping problem, not a user-facing one.
        if (previous != null && previous.startsWith("/uploads/")) {
            try {
                imageStore.delete(previous.substring("/uploads/".length()));
            } catch (RuntimeException ignored) {
                // deliberately swallowed; see above
            }
        }
        return saved;
    }

    /**
     * Deletes the caller's account.
     *
     * <p>Follows the policy recorded on {@code UserController#deleteMe}: the
     * Firebase identity goes, the row and the person's listings are
     * soft-deleted, and messages are retained — a conversation is two people's
     * data and one party cannot unilaterally erase the other's history.
     *
     * <p>The Firebase identity is removed last. If it were removed first and the
     * transaction then rolled back, the person would be left with a live Dari
     * row they could no longer authenticate against: locked out, still listed,
     * and unable to retry.
     */
    @Transactional
    public void deleteAccount(User user) {
        Instant now = Instant.now();

        listings.findByOwnerId(user.getId()).forEach(listing -> {
            if (listing.getDeletedAt() == null) {
                listing.setStatus(ListingStatus.SUSPENDED);
                listing.setDeletedAt(now);
                listings.save(listing);
            }
        });

        user.setDeletedAt(now);
        users.save(user);

        try {
            firebaseAuth.deleteUser(user.getFirebaseUid());
        } catch (FirebaseAuthException e) {
            // Left inside the transaction on purpose. Failing here rolls the
            // soft-delete back, which is the recoverable outcome: the account
            // still exists and the person can retry. The alternative -- commit
            // first, delete after -- can leave a live identity pointing at a
            // deleted profile, which is a state nothing in the app resolves.
            throw new ApiException(502, ErrorCode.INTERNAL_ERROR,
                    "La suppression du compte a échoué. Réessayez.");
        }
    }

    /**
     * Creates the Dari profile for an already-authenticated Firebase identity.
     *
     * <p>Identity fields come from the token. The body supplies only what the
     * person chose to tell us.
     */
    @Transactional
    public User create(AuthenticatedUser principal, CreateUserRequest request) {
        String email = principal.email();
        if (email != null && bannedIdentities.existsByEmailLower(email.trim().toLowerCase(Locale.ROOT))) {
            throw new ApiException(403, ErrorCode.IDENTITY_BANNED, "Inscription impossible");
        }

        return users.findByFirebaseUid(principal.firebaseUid())
                .orElseGet(() -> {
                    var user = new User(
                            principal.firebaseUid(),
                            principal.email(),
                            principal.emailVerified(),
                            request.displayName());
                    user.setFirstName(request.firstName());
                    user.setCity(request.city());
                    return users.save(user);
                });
    }

    @Transactional
    public User update(User user, UpdateUserRequest request) {
        if (request.displayName() != null) user.setDisplayName(request.displayName());
        if (request.firstName() != null) user.setFirstName(request.firstName());
        if (request.city() != null) user.setCity(request.city());
        if (request.bio() != null) user.setBio(request.bio());
        return users.save(user);
    }

    /**
     * A deleted or banned account has no public profile. Returning 404 rather
     * than an empty profile also avoids confirming that an account ever existed.
     */
    @Transactional(readOnly = true)
    public PublicProfileResponse publicProfile(UUID id) {
        User user = users.findByIdAndDeletedAtIsNull(id)
                .filter(u -> u.getStatus() != UserStatus.BANNED)
                .orElseThrow(() -> ApiException.notFound("Profil introuvable"));

        // Counts published + available listings only; a suspended listing is not
        // public information. Wired in phase 09, once listings exist.
        long activeListings = 0L;

        return PublicProfileResponse.from(user, activeListings);
    }

    @Transactional(readOnly = true)
    public boolean existsByFirebaseUid(String firebaseUid) {
        return users.existsByFirebaseUid(firebaseUid);
    }

}
