package ma.dari.api.listing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import ma.dari.api.common.jpa.Ids;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * One physical room in a listing's apartment — design doc §3's explicit
 * "2 chambres + salon" model, rather than relying only on the listing's own
 * denormalized bedroom/bathroom counts.
 *
 * <p>{@code rentable} handles the salon-as-bedroom case: a SALON row can be the
 * room actually offered to a roommate, so "is this the room for rent" is a
 * separate flag from what the room physically is.
 *
 * <p>Plain {@code @ManyToOne} rather than the shared-identity mapping
 * {@link HouseRules} needed: rooms are genuinely one-to-many, so there is no
 * primary key to share and none of the {@code @MapsId} hazards apply. This is
 * the same shape as {@link ListingPhoto}.
 */
@Entity
@Table(
        name = "listing_rooms",
        indexes = {
                @Index(name = "idx_listing_rooms_listing_id", columnList = "listing_id")
        }
)
public class ListingRoom {

    @Id
    private UUID id = Ids.newId();

    @ManyToOne(optional = false)
    @JoinColumn(name = "listing_id", nullable = false)
    private Listing listing;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "room_type", nullable = false, columnDefinition = "listing_room_type")
    private ListingRoomType roomType;

    @Column(name = "is_rentable", nullable = false)
    private boolean rentable;

    @Column(name = "is_shared", nullable = false)
    private boolean shared;

    @Column(columnDefinition = "text")
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ListingRoom() {
        // JPA
    }

    public ListingRoom(Listing listing, ListingRoomType roomType, boolean rentable, boolean shared, String description) {
        this.listing = listing;
        this.roomType = roomType;
        this.rentable = rentable;
        this.shared = shared;
        this.description = description;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Listing getListing() {
        return listing;
    }

    public ListingRoomType getRoomType() {
        return roomType;
    }

    public void setRoomType(ListingRoomType roomType) {
        this.roomType = roomType;
    }

    public boolean isRentable() {
        return rentable;
    }

    public void setRentable(boolean rentable) {
        this.rentable = rentable;
    }

    public boolean isShared() {
        return shared;
    }

    public void setShared(boolean shared) {
        this.shared = shared;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
