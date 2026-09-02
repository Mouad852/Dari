package ma.dari.api.listing;

import org.springframework.data.repository.Repository;

import java.util.UUID;

/**
 * Public search reads from the published_listings view, so the invariant cannot be
 * bypassed by a repository method that reads the base table.
 */
public interface PublishedListingRepository extends Repository<Listing, UUID> {
}
