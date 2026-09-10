package ma.dari.api.messaging;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    @Query("""
            select m from Message m
            where m.deletedAt is null
              and m.conversation.id = :conversationId
            order by m.sentAt asc, m.id asc
            """)
    List<Message> findVisibleByConversation(@Param("conversationId") UUID conversationId, Pageable pageable);

    @Query("""
            select m from Message m
            where m.deletedAt is null
              and m.conversation.id = :conversationId
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
}
