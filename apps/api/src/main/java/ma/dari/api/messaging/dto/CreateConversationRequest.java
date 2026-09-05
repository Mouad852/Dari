package ma.dari.api.messaging.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;

import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CreateConversationRequest(
        UUID listingId,
        UUID otherUserId,
        @Size(max = 4000, message = "Le message est trop long")
        String body) {

    @AssertTrue(message = "Une conversation doit inclure un autre utilisateur ou une annonce")
    public boolean hasTarget() {
        return listingId != null || otherUserId != null;
    }
}
