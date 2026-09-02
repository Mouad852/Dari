package ma.dari.api.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    /** Called on every authenticated request — keep the unique index on firebase_uid. */
    Optional<User> findByFirebaseUid(String firebaseUid);

    Optional<User> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByFirebaseUid(String firebaseUid);
}
