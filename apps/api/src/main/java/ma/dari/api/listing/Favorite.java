package ma.dari.api.listing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import ma.dari.api.user.User;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A seeker's saved listing (phase 09). The composite key on (user, listing) is
 * the point: a duplicate {@code POST /favorites/{listingId}} is idempotent by
 * construction, not by an application-level check.
 */
@Entity
@Table(name = "favorites")
@IdClass(Favorite.FavoriteId.class)
public class Favorite {

    @Id
    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Id
    @ManyToOne(optional = false)
    @JoinColumn(name = "listing_id", nullable = false)
    private Listing listing;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Favorite() {
        // JPA
    }

    public Favorite(User user, Listing listing) {
        this.user = user;
        this.listing = listing;
    }

    public User getUser() {
        return user;
    }

    public Listing getListing() {
        return listing;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    /** Mirrors the entity's {@code @Id} fields by name, per the {@code @IdClass} contract. */
    public static class FavoriteId implements Serializable {

        private UUID user;
        private UUID listing;

        public FavoriteId() {
            // JPA
        }

        public FavoriteId(UUID user, UUID listing) {
            this.user = user;
            this.listing = listing;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof FavoriteId that)) {
                return false;
            }
            return Objects.equals(user, that.user) && Objects.equals(listing, that.listing);
        }

        @Override
        public int hashCode() {
            return Objects.hash(user, listing);
        }
    }
}
