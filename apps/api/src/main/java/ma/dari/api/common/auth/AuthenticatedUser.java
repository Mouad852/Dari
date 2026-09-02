package ma.dari.api.common.auth;

import ma.dari.api.user.User;

/**
 * The authenticated principal.
 *
 * <p>{@code internalUser} is nullable by design: a caller may hold a valid
 * Firebase token and have no Dari profile yet, because signup happens
 * client-side against Firebase and {@code POST /users} is a separate call. The
 * auth filter never creates that row — see {@link FirebaseAuthFilter}.
 */
public record AuthenticatedUser(String firebaseUid,
                                String email,
                                boolean emailVerified,
                                User internalUser) {

    public boolean hasProfile() {
        return internalUser != null;
    }
}
