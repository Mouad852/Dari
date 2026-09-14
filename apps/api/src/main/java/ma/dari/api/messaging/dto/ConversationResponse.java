package ma.dari.api.messaging.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Built by {@code ConversationService#toConversationResponse}, which looks up
 * the real last message — there is no {@code from(Conversation, User)} factory
 * here on purpose. An earlier one existed but always hardcoded a null last
 * message, since a static factory has no way to reach {@link
 * ma.dari.api.messaging.MessageRepository} to look one up.
 */
public record ConversationResponse(
        UUID id,
        UUID listingId,
        UUID participantAId,
        UUID participantBId,
        UUID otherUserId,
        String otherUserDisplayName,
        Instant createdAt,
        String lastMessage,
        Instant lastMessageAt,
        long unreadCount,
        /**
         * The last message's own id and read state, regardless of who sent it.
         * A read-receipt poll on the thread page reconciles this against
         * whichever message it already has locally at that position -- a
         * single cheap row, not a full message-list refetch, since the poll
         * only needs to know whether one specific message became read.
         */
        UUID lastMessageId,
        Instant lastMessageReadAt
) {
}
