package ma.dari.api.messaging;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    /**
     * A visible message of this conversation, or nothing — the anchor for
     * {@code after=}. Scoped by conversation so an id from another thread
     * resolves to nothing, exactly like an id that does not exist.
     */
    @Query("""
            select m from Message m
            where m.id = :id
              and m.deletedAt is null
              and m.conversation.id = :conversationId
            """)
    Optional<Message> findVisibleInConversation(@Param("id") UUID id,
                                                @Param("conversationId") UUID conversationId);

    /**
     * The next older page, newest first; the service reverses it.
     *
     * <p>The {@code sentAt <=} bound repeats what the keyset condition already
     * implies. It is there for the planner: the OR form alone is only a filter,
     * so the scan started at the thread's end and discarded every newer row;
     * with the bound it starts at the cursor on idx_messages_conversation_sent.
     * The same holds for {@link #findVisibleByConversationAfter}.
     */
    @Query("""
            select m from Message m
            where m.deletedAt is null
              and m.conversation.id = :conversationId
              and m.sentAt <= :beforeSentAt
              and (m.sentAt < :beforeSentAt or (m.sentAt = :beforeSentAt and m.id < :beforeId))
            order by m.sentAt desc, m.id desc
            """)
    List<Message> findVisibleByConversationBefore(@Param("conversationId") UUID conversationId,
                                                 @Param("beforeSentAt") Instant beforeSentAt,
                                                 @Param("beforeId") UUID beforeId,
                                                 Pageable pageable);

    @Query("""
            select m from Message m
            where m.deletedAt is null
              and m.conversation.id = :conversationId
              and m.sentAt >= :lastSentAt
              and (m.sentAt > :lastSentAt or (m.sentAt = :lastSentAt and m.id > :lastId))
            order by m.sentAt asc, m.id asc
            """)
    List<Message> findVisibleByConversationAfter(@Param("conversationId") UUID conversationId,
                                                @Param("lastSentAt") Instant lastSentAt,
                                                @Param("lastId") UUID lastId,
                                                Pageable pageable);

    @Query("""
            select m from Message m
            where m.deletedAt is null
              and m.conversation.id = :conversationId
            order by m.sentAt desc, m.id desc
            """)
    List<Message> findLatestByConversation(@Param("conversationId") UUID conversationId, Pageable pageable);

    @Query(value = """
            select distinct on (conversation_id) *
            from messages
            where deleted_at is null and conversation_id in (:conversationIds)
            order by conversation_id, sent_at desc, id desc
            """, nativeQuery = true)
    List<Message> findLatestByConversationIdIn(@Param("conversationIds") Collection<UUID> conversationIds);

    @Query(value = """
            select conversation_id as conversationId, count(*) as unreadCount
            from messages
            where deleted_at is null and conversation_id in (:conversationIds)
              and sender_id <> :userId and read_at is null
            group by conversation_id
            """, nativeQuery = true)
    List<UnreadCount> countUnreadByConversationIdIn(@Param("conversationIds") Collection<UUID> conversationIds,
                                                    @Param("userId") UUID userId);

    interface UnreadCount {
        UUID getConversationId();
        long getUnreadCount();
    }

    @Query("""
            select m from Message m
            where m.deletedAt is null
              and m.conversation.id = :conversationId
              and m.sender.id <> :userId
              and m.readAt is null
            order by m.sentAt asc, m.id asc
            """)
    List<Message> findUnreadForUser(@Param("conversationId") UUID conversationId,
                                    @Param("userId") UUID userId);

    @Query("""
            select count(m) from Message m
            where m.deletedAt is null
              and m.conversation.id = :conversationId
              and m.sender.id <> :userId
              and m.readAt is null
            """)
    long countUnreadForUser(@Param("conversationId") UUID conversationId,
                            @Param("userId") UUID userId);

    /**
     * Total unread across every conversation the user is part of -- backs the
     * mobile nav's Messages-tab badge, which needs one cheap number on every
     * page rather than the per-conversation count above (that one only
     * answers "how many unread in this one thread").
     */
    @Query("""
            select count(m) from Message m
            where m.deletedAt is null
              and m.readAt is null
              and m.sender.id <> :userId
              and m.conversation.deletedAt is null
              and (m.conversation.participantA.id = :userId or m.conversation.participantB.id = :userId)
            """)
    long countAllUnreadForUser(@Param("userId") UUID userId);
}
