package ma.dari.api.moderation;

import jakarta.validation.constraints.Size;

public record BanUserRequest(
        @Size(max = 1000, message = "La raison ne peut pas dépasser 1000 caractères")
        String reason
) {
}
