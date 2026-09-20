package ma.dari.api.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;
import java.time.Instant;
import java.util.List;

public interface UserRepository extends JpaRepository<User, UUID> {

    /** Called on every authenticated request — keep the unique index on firebase_uid. */
    Optional<User> findByFirebaseUid(String firebaseUid);

    Optional<User> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByIdAndDeletedAtIsNull(UUID id);

    boolean existsByFirebaseUid(String firebaseUid);

    @Query("""
            select u from User u
            where u.deletedAt is null
              and (:status is null or u.status = :status)
              and (:needle is null or lower(u.email) like :needle
                   or lower(u.displayName) like :needle
                   or lower(coalesce(u.firstName, '')) like :needle
                   or lower(coalesce(u.city, '')) like :needle)
            order by u.createdAt desc, u.id desc
            """)
    List<User> searchVisible(@Param("status") UserStatus status,
                             @Param("needle") String needle,
                             Pageable pageable);

    @Query("""
            select u from User u
            where u.deletedAt is null
              and (:status is null or u.status = :status)
              and (:needle is null or lower(u.email) like :needle
                   or lower(u.displayName) like :needle
                   or lower(coalesce(u.firstName, '')) like :needle
                   or lower(coalesce(u.city, '')) like :needle)
              and (u.createdAt < :lastCreatedAt or (u.createdAt = :lastCreatedAt and u.id < :lastId))
            order by u.createdAt desc, u.id desc
            """)
    List<User> searchVisibleAfter(@Param("status") UserStatus status,
                                  @Param("needle") String needle,
                                  @Param("lastCreatedAt") Instant lastCreatedAt,
                                  @Param("lastId") UUID lastId,
                                  Pageable pageable);
}
