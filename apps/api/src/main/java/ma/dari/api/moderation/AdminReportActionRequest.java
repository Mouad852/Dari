package ma.dari.api.moderation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminReportActionRequest(
        @NotBlank(message = "L'action est requise")
        String action,

        @Size(max = 1000, message = "La raison ne peut pas dépasser 1000 caractères")
        String reason
) {
}
