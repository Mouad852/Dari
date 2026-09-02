package ma.dari.api.moderation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AdminActionRepository extends JpaRepository<AdminAction, UUID> {
}
