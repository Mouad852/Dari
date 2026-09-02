package ma.dari.api.messaging.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CreateConversationRequest(UUID listingId, UUID otherUserId, String body) {
}
