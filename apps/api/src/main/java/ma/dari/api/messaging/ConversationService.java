package ma.dari.api.messaging;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.common.pagination.Cursor;
import ma.dari.api.common.pagination.CursorPage;
import ma.dari.api.common.pagination.TypedCursors;
import ma.dari.api.listing.Listing;
import ma.dari.api.listing.ListingRepository;
import ma.dari.api.messaging.dto.ConversationResponse;
import ma.dari.api.messaging.dto.CreateConversationRequest;
import ma.dari.api.messaging.dto.CreateMessageRequest;
import ma.dari.api.messaging.dto.MessageResponse;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class ConversationService {

    private static final int PAGE_SIZE = 20;

    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final UserRepository users;
    private final ListingRepository listings;

    public ConversationService(ConversationRepository conversations,
                              MessageRepository messages,
                              UserRepository users,
                              ListingRepository listings) {
        this.conversations = conversations;
        this.messages = messages;
        this.users = users;
        this.listings = listings;
    }

    @Transactional(readOnly = true)
    public CursorPage<ConversationResponse> list(User currentUser, String cursor) {
        TypedCursors.ConversationCursor decoded = cursor == null ? null : TypedCursors.conversation(cursor);
        Instant lastCreatedAt = decoded == null ? null : decoded.lastCreatedAt();
        UUID lastId = decoded == null ? null : decoded.lastId();

        List<Conversation> rows = lastCreatedAt == null && lastId == null
                ? conversations.findVisibleByUser(currentUser.getId(), PageRequest.of(0, PAGE_SIZE + 1))
                : conversations.findVisibleByUserAfter(currentUser.getId(), lastCreatedAt, lastId, PageRequest.of(0, PAGE_SIZE + 1));

        boolean hasMore = rows.size() > PAGE_SIZE;
        List<Conversation> pageRows = hasMore ? rows.subList(0, PAGE_SIZE) : rows;
        List<UUID> conversationIds = pageRows.stream().map(Conversation::getId).toList();
        java.util.Map<UUID, Message> latestByConversation = new java.util.HashMap<>();
        java.util.Map<UUID, Long> unreadByConversation = new java.util.HashMap<>();
        if (!conversationIds.isEmpty()) {
            latestByConversation.putAll(messages.findLatestByConversationIdIn(conversationIds).stream()
                    .collect(java.util.stream.Collectors.toMap(m -> m.getConversation().getId(), m -> m)));
            unreadByConversation.putAll(messages.countUnreadByConversationIdIn(conversationIds, currentUser.getId()).stream()
                    .collect(java.util.stream.Collectors.toMap(MessageRepository.UnreadCount::getConversationId,
                            MessageRepository.UnreadCount::getUnreadCount)));
        }
        List<ConversationResponse> items = pageRows.stream()
                .map(c -> toConversationResponse(c, currentUser, latestByConversation, unreadByConversation))
                .toList();

        String nextCursor = null;
        if (hasMore && !pageRows.isEmpty()) {
            var last = pageRows.get(pageRows.size() - 1);
            var payloadOut = Cursor.newPayload();
            payloadOut.put("mode", "conversations");
            payloadOut.put("lastCreatedAt", last.getCreatedAt().toString());
            payloadOut.put("lastId", last.getId().toString());
            nextCursor = Cursor.encode(payloadOut);
        }

        return CursorPage.of(items, nextCursor);
    }

    @Transactional
    public ConversationCreateResult create(User currentUser, CreateConversationRequest request) {
        if (request == null) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Conversation invalide");
        }

        Listing listing = request.listingId() == null ? null : listings.findByIdAndDeletedAtIsNull(request.listingId())
                .orElseThrow(() -> ApiException.notFound("Annonce introuvable"));

        User otherUser = resolveOtherUser(request, listing);
        if (currentUser.getId().equals(otherUser.getId())) {
            throw ApiException.forbidden("Vous ne pouvez pas démarrer une conversation avec vous-même");
        }

        UUID first = currentUser.getId();
        UUID second = otherUser.getId();
        Optional<Conversation> existing = listing == null
                ? conversations.findByParticipantPairWithoutListing(min(first, second), max(first, second))
                : conversations.findByListingAndParticipantPair(listing.getId(), min(first, second), max(first, second));

        Conversation conversation;
        boolean created;
        if (existing.isPresent()) {
            conversation = existing.get();
            created = false;
        } else {
            Conversation candidate = new Conversation(listing, currentUser, otherUser);
            try {
                int inserted = conversations.insertIfAbsent(
                        candidate.getId(), listing == null ? null : listing.getId(), min(first, second), max(first, second));
                conversation = conversations.findById(candidate.getId()).orElseGet(() -> listing == null
                        ? conversations.findByParticipantPairWithoutListing(min(first, second), max(first, second)).orElse(null)
                        : conversations.findByListingAndParticipantPair(listing.getId(), min(first, second), max(first, second)).orElse(null));
                if (conversation == null) {
                    throw new DataIntegrityViolationException("Conversation insert did not produce a readable row");
                }
                created = inserted == 1;
            } catch (DataIntegrityViolationException lostRace) {
                conversation = (listing == null
                        ? conversations.findByParticipantPairWithoutListing(min(first, second), max(first, second))
                        : conversations.findByListingAndParticipantPair(listing.getId(), min(first, second), max(first, second)))
                        .orElseThrow(() -> lostRace);
                created = false;
            }
        }

        if (request.body() != null && !request.body().isBlank()) {
            sendMessageInternal(conversation, currentUser, request.body());
        }

        return new ConversationCreateResult(toConversationResponse(conversation, currentUser), created);
    }

    @Transactional(readOnly = true)
    public ConversationResponse get(User currentUser, UUID conversationId) {
        Conversation conversation = findVisibleConversation(currentUser, conversationId);
        return toConversationResponse(conversation, currentUser);
    }

    /** Total unread across every conversation -- see {@link MessageRepository#countAllUnreadForUser}. */
    @Transactional(readOnly = true)
    public long unreadCount(User currentUser) {
        return messages.countAllUnreadForUser(currentUser.getId());
    }

    @Transactional(readOnly = true)
    public CursorPage<MessageResponse> listMessages(User currentUser, UUID conversationId, String cursor) {
        Conversation conversation = findVisibleConversation(currentUser, conversationId);
        TypedCursors.MessageCursor decoded = cursor == null ? null : TypedCursors.message(cursor, conversationId);
        Instant lastSentAt = decoded == null ? null : decoded.lastSentAt();
        UUID lastId = decoded == null ? null : decoded.lastId();

        List<Message> rows = lastSentAt == null && lastId == null
                ? messages.findVisibleByConversation(conversationId, PageRequest.of(0, PAGE_SIZE + 1))
                : messages.findVisibleByConversationAfter(conversationId, lastSentAt, lastId, PageRequest.of(0, PAGE_SIZE + 1));

        boolean hasMore = rows.size() > PAGE_SIZE;
        List<Message> pageRows = hasMore ? rows.subList(0, PAGE_SIZE) : rows;
        List<MessageResponse> items = pageRows.stream().map(MessageResponse::from).toList();

        String nextCursor = null;
        if (hasMore && !pageRows.isEmpty()) {
            Message last = pageRows.get(pageRows.size() - 1);
            var payloadOut = Cursor.newPayload();
            payloadOut.put("mode", "messages");
            payloadOut.put("conversationId", conversationId.toString());
            payloadOut.put("lastSentAt", last.getSentAt().toString());
            payloadOut.put("lastId", last.getId().toString());
            nextCursor = Cursor.encode(payloadOut);
        }

        return CursorPage.of(items, nextCursor);
    }

    @Transactional
    public MessageResponse sendMessage(User currentUser, UUID conversationId, CreateMessageRequest request) {
        if (request == null || request.body() == null || request.body().isBlank()) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Le message ne peut pas être vide");
        }

        Conversation conversation = findVisibleConversation(currentUser, conversationId);
        return MessageResponse.from(sendMessageInternal(conversation, currentUser, request.body()));
    }

    @Transactional
    public void markRead(User currentUser, UUID conversationId) {
        Conversation conversation = findVisibleConversation(currentUser, conversationId);
        List<Message> unread = messages.findUnreadForUser(conversation.getId(), currentUser.getId());
        for (Message message : unread) {
            message.setReadAt(Instant.now());
        }
    }

    private Message sendMessageInternal(Conversation conversation, User currentUser, String body) {
        Message message = new Message(conversation, currentUser, body);
        return messages.save(message);
    }

    private User resolveOtherUser(CreateConversationRequest request, Listing listing) {
        if (request.otherUserId() != null) {
            User otherUser = users.findByIdAndDeletedAtIsNull(request.otherUserId())
                    .orElseThrow(() -> ApiException.notFound("Utilisateur introuvable"));
            if (listing != null && !listing.getOwner().getId().equals(otherUser.getId())) {
                throw ApiException.forbidden("Cette annonce appartient à un autre utilisateur");
            }
            return otherUser;
        }
        if (listing != null) {
            return listing.getOwner();
        }
        throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Une conversation doit inclure un autre utilisateur ou une annonce");
    }

    private Conversation findVisibleConversation(User currentUser, UUID conversationId) {
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> ApiException.notFound("Conversation introuvable"));
        if (conversation.getDeletedAt() != null || !conversation.isParticipant(currentUser)) {
            throw ApiException.forbidden("Vous n'êtes pas autorisé à accéder à cette conversation");
        }
        return conversation;
    }

    private ConversationResponse toConversationResponse(Conversation conversation, User currentUser) {
        User otherUser = conversation.otherParticipant(currentUser);
        List<Message> latest = messages.findLatestByConversation(conversation.getId(), PageRequest.of(0, 1));
        Message lastMessage = latest.isEmpty() ? null : latest.get(0);
        long unreadCount = messages.countUnreadForUser(conversation.getId(), currentUser.getId());
        java.util.Map<UUID, Message> latestByConversation = new java.util.HashMap<>();
        latestByConversation.put(conversation.getId(), lastMessage);
        java.util.Map<UUID, Long> unreadByConversation = java.util.Map.of(conversation.getId(), unreadCount);
        return toConversationResponse(conversation, currentUser, latestByConversation, unreadByConversation);
    }

    private ConversationResponse toConversationResponse(Conversation conversation, User currentUser,
                                                         java.util.Map<UUID, Message> latestByConversation,
                                                         java.util.Map<UUID, Long> unreadByConversation) {
        User otherUser = conversation.otherParticipant(currentUser);
        Message lastMessage = latestByConversation.get(conversation.getId());
        long unreadCount = unreadByConversation.getOrDefault(conversation.getId(), 0L);
        return new ConversationResponse(
                conversation.getId(),
                conversation.getListing() == null ? null : conversation.getListing().getId(),
                conversation.getParticipantA().getId(),
                conversation.getParticipantB().getId(),
                otherUser.getId(),
                otherUser.getDisplayName(),
                conversation.getCreatedAt(),
                lastMessage == null ? null : lastMessage.getBody(),
                lastMessage == null ? null : lastMessage.getSentAt(),
                unreadCount,
                lastMessage == null ? null : lastMessage.getId(),
                lastMessage == null ? null : lastMessage.getReadAt()
        );
    }

    public record ConversationCreateResult(ConversationResponse response, boolean created) {
    }

    private UUID min(UUID left, UUID right) {
        return left.compareTo(right) <= 0 ? left : right;
    }

    private UUID max(UUID left, UUID right) {
        return left.compareTo(right) > 0 ? left : right;
    }
}
