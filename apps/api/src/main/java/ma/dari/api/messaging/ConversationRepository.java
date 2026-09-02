package ma.dari.api.messaging;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    @Query("""
            select c from Conversation c
            where c.deletedAt is null
              and (c.participantA.id = :userId or c.participantB.id = :userId)
            order by c.createdAt desc, c.id desc
            """)
    List<Conversation> findVisibleByUser(@Param("userId") UUID userId, Pageable pageable);

    @Query("""
            select c from Conversation c
            where c.deletedAt is null
              and (c.participantA.id = :userId or c.participantB.id = :userId)
              and (c.createdAt < :lastCreatedAt or (c.createdAt = :lastCreatedAt and c.id < :lastId))
            order by c.createdAt desc, c.id desc
            """)
    List<Conversation> findVisibleByUserAfter(@Param("userId") UUID userId,
                                              @Param("lastCreatedAt") Instant lastCreatedAt,
                                              @Param("lastId") UUID lastId,
                                              Pageable pageable);

    @Query("""
            select c from Conversation c
            where c.deletedAt is null
              and c.listing.id = :listingId
              and ((c.participantA.id = :firstUserId and c.participantB.id = :secondUserId)
                   or (c.participantA.id = :secondUserId and c.participantB.id = :firstUserId))
            """)
    Optional<Conversation> findByListingAndParticipantPair(@Param("listingId") UUID listingId,
                                                           @Param("firstUserId") UUID firstUserId,
                                                           @Param("secondUserId") UUID secondUserId);

    @Query("""
            select c from Conversation c
            where c.deletedAt is null
              and c.listing is null
              and ((c.participantA.id = :firstUserId and c.participantB.id = :secondUserId)
                   or (c.participantA.id = :secondUserId and c.participantB.id = :firstUserId))
            """)
    Optional<Conversation> findByParticipantPairWithoutListing(@Param("firstUserId") UUID firstUserId,
                                                              @Param("secondUserId") UUID secondUserId);
}
