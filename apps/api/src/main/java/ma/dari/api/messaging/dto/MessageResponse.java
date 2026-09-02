package ma.dari.api.messaging.dto;

import ma.dari.api.messaging.Message;

import java.time.Instant;
import java.util.UUID;

public record MessageResponse(
        UUID id,
        UUID conversationId,
        UUID senderId,
        String body,
        Instant sentAt,
        Instant readAt
) {
    public static MessageResponse from(Message message) {
        return new MessageResponse(
                message.getId(),
                message.getConversation().getId(),
                message.getSender().getId(),
                message.getBody(),
                message.getSentAt(),
                message.getReadAt()
        );
    }
}
