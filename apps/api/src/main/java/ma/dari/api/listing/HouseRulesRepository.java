package ma.dari.api.listing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/**
 * Keyed by the listing's own id, because {@code house_rules.listing_id} is
 * both the primary key and the foreign key -- there is no separate id to
 * look one up by.
 */
public interface HouseRulesRepository extends JpaRepository<HouseRules, UUID> {
}
