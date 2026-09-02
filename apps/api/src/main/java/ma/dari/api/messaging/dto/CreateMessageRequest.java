package ma.dari.api.messaging.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateMessageRequest(
        @NotBlank(message = "Le message ne peut pas être vide")
        @Size(max = 4000, message = "Le message est trop long")
        String body
) {
}
