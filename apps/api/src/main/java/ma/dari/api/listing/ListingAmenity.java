package ma.dari.api.listing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * One amenity attached to one listing. The composite key on (listing, code)
 * means a listing cannot carry the same amenity twice, by construction.
 */
@Entity
@Table(name = "listing_amenities")
@IdClass(ListingAmenity.ListingAmenityId.class)
public class ListingAmenity {

    @Id
    @ManyToOne(optional = false)
    @JoinColumn(name = "listing_id", nullable = false)
    private Listing listing;

    @Id
    @Column(name = "amenity_code", nullable = false)
    private String amenityCode;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ListingAmenity() {
        // JPA
    }

    public ListingAmenity(Listing listing, String amenityCode) {
        this.listing = listing;
        this.amenityCode = amenityCode;
    }

    public Listing getListing() {
        return listing;
    }

    public String getAmenityCode() {
        return amenityCode;
    }

    /** Mirrors the entity's {@code @Id} fields by name, per the {@code @IdClass} contract. */
    public static class ListingAmenityId implements Serializable {

        private UUID listing;
        private String amenityCode;

        public ListingAmenityId() {
            // JPA
        }

        public ListingAmenityId(UUID listing, String amenityCode) {
            this.listing = listing;
            this.amenityCode = amenityCode;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof ListingAmenityId that)) {
                return false;
            }
            return Objects.equals(listing, that.listing) && Objects.equals(amenityCode, that.amenityCode);
        }

        @Override
        public int hashCode() {
            return Objects.hash(listing, amenityCode);
        }
    }
}
