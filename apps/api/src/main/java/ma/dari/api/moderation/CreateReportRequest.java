package ma.dari.api.moderation;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateReportRequest(
        @NotNull(message = "Le type de cible est requis")
        ReportTarget targetType,

        @NotNull(message = "L'identifiant de la cible est requis")
        UUID targetId,

        @NotNull(message = "La raison est requise")
        ReportReason reason,

        @Size(max = 2000, message = "Le détail ne peut pas dépasser 2000 caractères")
        String details
) {
}
