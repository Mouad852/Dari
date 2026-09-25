package ma.dari.api.user;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import ma.dari.api.common.auth.AuthenticatedUser;
import ma.dari.api.common.auth.FirebaseAuthFilter;
import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.listing.AvailabilityState;
import ma.dari.api.listing.ListingRepository;
import ma.dari.api.listing.ListingStatus;
import ma.dari.api.media.ImageStore;
import ma.dari.api.media.MediaCleanupService;
import ma.dari.api.listing.ListingPhotoRepository;
import ma.dari.api.moderation.BannedIdentityRepository;
import ma.dari.api.notification.NotificationDeliveryService;
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
    private final MediaCleanupService mediaCleanup;
    private final ListingPhotoRepository listingPhotos;
    private final FirebaseAuth firebaseAuth;

    public UserService(UserRepository users,
                       FirebaseAuthFilter firebaseAuthFilter,
                       BannedIdentityRepository bannedIdentities,
                       ListingRepository listings,
                       ImageStore imageStore,
                       MediaCleanupService mediaCleanup,
                       ListingPhotoRepository listingPhotos,
                       FirebaseAuth firebaseAuth) {
        this.users = users;
        this.firebaseAuthFilter = firebaseAuthFilter;
        this.bannedIdentities = bannedIdentities;
        this.listings = listings;
        this.imageStore = imageStore;
        this.mediaCleanup = mediaCleanup;
        this.listingPhotos = listingPhotos;
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

        String previousKey = user.getAvatarStorageKey();
        user.setAvatarStorageKey(stored.storageKey());
        User saved = users.save(user);

        // The replaced photo is revoked in the same transaction that stops
        // referencing it. This used to be a swallowed best-effort call, but a
        // failure inside it marks the transaction rollback-only anyway, and a
        // replaced avatar that stays public is exactly what the person asked
        // to stop.
        if (previousKey != null) {
            mediaCleanup.enqueue(previousKey);
        }
        return saved;
    }

    /** The avatar as clients see it: rendered for this deployment's storage, or null. */
    public String avatarUrl(User user) {
        String key = user.getAvatarStorageKey();
        return key == null ? null : imageStore.publicUrl(key);
    }

    /**
     * Deletes the caller's account.
     *
     * <p>Follows the policy recorded on {@code UserController#deleteMe}: the
     * Firebase identity goes, the row and the person's listings are
     * soft-deleted, and messages are retained — a conversation is two people's
     * data and one party cannot unilaterally erase the other's history.
     * Everything that identifies the person beyond {@code deletedAt} itself —
     * email, phone, name, city, bio, avatar — is cleared, since a soft-deleted
     * row is still a live row in every backup and every database session an
     * admin opens.
     *
     * <p>Photos are not deleted here. Their storage keys are enqueued in the
     * media cleanup outbox in this transaction, which revokes them on commit,
     * and the cleanup worker deletes the objects afterwards. The Firebase
     * identity is removed last. If that fails, the whole transaction (the PII
     * scrub and the enqueued cleanups included) rolls back, which is the
     * recoverable outcome: the account still exists, undisturbed, with its
     * photos, and the person can retry.
     */
    @Transactional
    public void deleteAccount(User user) {
        Instant now = Instant.now();

        listings.findByOwnerId(user.getId()).forEach(listing -> {
            if (listing.getDeletedAt() == null) {
                listingPhotos.findByListingIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAsc(listing.getId())
                        .forEach(photo -> {
                            photo.setDeletedAt(now);
                            mediaCleanup.enqueue(photo.getStorageKey());
                            listingPhotos.save(photo);
                        });
                listing.setStatus(ListingStatus.SUSPENDED);
                listing.setDeletedAt(now);
                listings.save(listing);
            }
        });

        String avatarKey = user.getAvatarStorageKey();
        if (avatarKey != null) {
            // Persist the revocation before making the irreversible Firebase
            // call. MediaAccessInterceptor denies this key as soon as this
            // transaction commits, while the scheduled worker keeps retrying
            // the physical deletion if storage is temporarily unavailable.
            mediaCleanup.enqueue(avatarKey);
        }
        scrubPii(user);
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
     * Clears every field that identifies the person, beyond the {@code
     * deletedAt} flag itself. The row, its id, and any messages or moderation
     * history stay — those belong to counterparties and moderators, not
     * solely to this person — but nothing that identifies them personally
     * should still be readable from the row afterward.
     *
     * <p>{@code email} and {@code displayName} are schema-{@code NOT NULL} and
     * assumed present by other code, so they become an empty string and a
     * fixed French placeholder rather than {@code null}. {@link
     * NotificationDeliveryService} already treats a blank email exactly like a
     * missing one, so a notification already queued for this person before
     * deletion dies cleanly instead of erroring.
     */
    private void scrubPii(User user) {
        user.setEmail("");
        user.setEmailVerified(false);
        user.setPhone(null);
        user.setPhoneVerified(false);
        user.setFirstName(null);
        user.setDisplayName("Utilisateur supprimé");
        user.setCity(null);
        user.setBio(null);
        user.setAvatarStorageKey(null);
        // The legacy column can still point at the same photo until the
        // contract migration drops it.
        user.setAvatarUrl(null);
    }

    /**
     * Creates the Dari profile for an already-authenticated Firebase identity.
     *
     * <p>Identity fields come from the token. The body supplies only what the
     * person chose to tell us.
     */
    @Transactional
    public User create(AuthenticatedUser principal, CreateUserRequest request) {
        // Idempotent retries for an existing profile must remain harmless, but
        // no new internal profile may be created from an incomplete Firebase
        // identity. This keeps the identity boundary explicit and avoids a
        // database NOT NULL failure becoming a misleading 500.
        var existing = users.findByFirebaseUid(principal.firebaseUid());
        if (existing.isPresent()) return existing.get();

        if (principal.email() == null || principal.email().isBlank()) {
            throw new ApiException(400, ErrorCode.IDENTITY_EMAIL_REQUIRED,
                    "Une adresse e-mail Firebase est requise");
        }
        if (!principal.emailVerified()) {
            throw new ApiException(403, ErrorCode.IDENTITY_EMAIL_UNVERIFIED,
                    "Vérifiez votre adresse e-mail avant de créer votre profil");
        }

        String email = principal.email();
        if (email != null && bannedIdentities.existsByEmailLower(email.trim().toLowerCase(Locale.ROOT))) {
            throw new ApiException(403, ErrorCode.IDENTITY_BANNED, "Inscription impossible");
        }

        var user = new User(
                principal.firebaseUid(),
                principal.email().trim(),
                true,
                request.displayName());
        user.setFirstName(request.firstName());
        user.setCity(request.city());
        return users.save(user);
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
        // public information. Stale "wired in phase 09" TODO left this at a
        // hardcoded 0 well after listings existed -- found 2026-09-09 by
        // checking a real profile with 2 published listings against the 0
        // the page showed for it.
        long activeListings = listings.countByOwnerIdAndStatusAndAvailabilityStateAndDeletedAtIsNull(
                id, ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE);

        return PublicProfileResponse.from(user, avatarUrl(user), activeListings);
    }

    @Transactional(readOnly = true)
    public boolean existsByFirebaseUid(String firebaseUid) {
        return users.existsByFirebaseUid(firebaseUid);
    }

}
