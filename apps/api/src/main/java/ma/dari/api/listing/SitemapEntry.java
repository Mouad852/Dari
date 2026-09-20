package ma.dari.api.listing;

import java.time.Instant;
import java.util.UUID;

/** Public-only sitemap data. It deliberately carries no listing content or coordinates. */
public record SitemapEntry(UUID id, Instant updatedAt) {
}
