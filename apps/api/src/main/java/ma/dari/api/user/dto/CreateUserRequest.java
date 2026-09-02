package ma.dari.api.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * First-launch profile creation.
 *
 * <p>Note what is absent: email, verification state and uid all come from the
 * verified Firebase token, never from the body. A client that could name its own
 * email could claim someone else's.
 */
public record CreateUserRequest(

        @NotBlank(message = "Nom d'affichage requis")
        @Size(min = 2, max = 60, message = "Entre 2 et 60 caractères")
        String displayName,

        @Size(max = 60)
        String firstName,

        @Size(max = 60)
        String city) {
}
