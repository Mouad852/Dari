package ma.dari.api.moderation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface BannedIdentityRepository extends JpaRepository<BannedIdentity, UUID> {
    boolean existsByEmailLower(String emailLower);
    boolean existsByPhone(String phone);
}
