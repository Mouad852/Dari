package ma.dari.api.listing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalTime;
import java.util.UUID;

/**
 * The house rules for one listing (§5). One row per listing, sharing the
 * listing's own id as its primary key, which is exactly what
 * {@code house_rules.listing_id PRIMARY KEY REFERENCES listings(id)} says.
 *
 * <p>The id is mapped as a scalar {@code listingId} with {@code @MapsId} on
 * the association, rather than putting {@code @Id} directly on the
 * association the way {@link ListingAmenity} and {@code Favorite} do. Those
 * two carry a *composite* key and therefore an {@code @IdClass}; Spring Data
 * requires an {@code @IdClass} for any entity whose {@code @Id} is an
 * association, so the single-association form fails at repository creation
 * with "does not define an IdClass". {@code @MapsId} keeps the shared-key
 * semantics without inventing a composite key that the table does not have.
 *
 * <p>Every answer is nullable on purpose, and that is the whole design. The
 * V12 migration puts it as "NULL does not equal false; silence is not a
 * promise": an owner who never answered "animaux acceptes ?" has not said no,
 * so an unanswered listing must drop out of a preference filter rather than
 * be counted as a refusal. Treating these as primitive booleans would erase
 * that distinction at the type level, which is why they are boxed.
 */
@Entity
@Table(name = "house_rules")
public class HouseRules {

    @Id
    @Column(name = "listing_id")
    private UUID listingId;

    @MapsId
    @OneToOne(optional = false)
    @JoinColumn(name = "listing_id", nullable = false)
    private Listing listing;

    @Column(name = "smoking_allowed")
    private Boolean smokingAllowed;

    @Column(name = "pets_allowed")
    private Boolean petsAllowed;

    @Column(name = "guests_allowed")
    private Boolean guestsAllowed;

    @Column(name = "quiet_hours_start")
    private LocalTime quietHoursStart;

    @Column(name = "quiet_hours_end")
    private LocalTime quietHoursEnd;

    @Column(name = "other_rules", columnDefinition = "text")
    private String otherRules;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected HouseRules() {
        // JPA
    }

    public HouseRules(Listing listing) {
        this.listing = listing;
    }

    public UUID getListingId() { return listingId; }

    public Listing getListing() { return listing; }

    public Boolean getSmokingAllowed() { return smokingAllowed; }

    public void setSmokingAllowed(Boolean smokingAllowed) { this.smokingAllowed = smokingAllowed; }

    public Boolean getPetsAllowed() { return petsAllowed; }

    public void setPetsAllowed(Boolean petsAllowed) { this.petsAllowed = petsAllowed; }

    public Boolean getGuestsAllowed() { return guestsAllowed; }

    public void setGuestsAllowed(Boolean guestsAllowed) { this.guestsAllowed = guestsAllowed; }

    public LocalTime getQuietHoursStart() { return quietHoursStart; }

    public void setQuietHoursStart(LocalTime quietHoursStart) { this.quietHoursStart = quietHoursStart; }

    public LocalTime getQuietHoursEnd() { return quietHoursEnd; }

    public void setQuietHoursEnd(LocalTime quietHoursEnd) { this.quietHoursEnd = quietHoursEnd; }

    public String getOtherRules() { return otherRules; }

    public void setOtherRules(String otherRules) { this.otherRules = otherRules; }

    public Instant getCreatedAt() { return createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
}
