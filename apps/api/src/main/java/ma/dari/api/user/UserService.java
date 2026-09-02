package ma.dari.api.user;

import ma.dari.api.common.auth.AuthenticatedUser;
import ma.dari.api.common.auth.FirebaseAuthFilter;
import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.moderation.BannedIdentityRepository;
import ma.dari.api.user.dto.CreateUserRequest;
import ma.dari.api.user.dto.PublicProfileResponse;
import ma.dari.api.user.dto.UpdateUserRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

@Service
public class UserService {

    private final FirebaseAuthFilter firebaseAuthFilter;
    private final UserRepository users;
    private final BannedIdentityRepository bannedIdentities;

    public UserService(UserRepository users, FirebaseAuthFilter firebaseAuthFilter, BannedIdentityRepository bannedIdentities) {
        this.users = users;
        this.firebaseAuthFilter = firebaseAuthFilter;
        this.bannedIdentities = bannedIdentities;
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
