package ma.dari.api.listing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
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
 * <p>Deliberately a plain scalar {@code listingId}, not a JPA association to
 * {@link Listing}. Two shapes were tried and rejected first:
 *
 * <ul>
 *   <li>{@code @Id @OneToOne private Listing listing} — the shape
 *       {@link ListingAmenity}/{@code Favorite} use — fails at repository-bean
 *       creation with "does not define an IdClass": those two carry a
 *       *composite* key with an {@code @IdClass}, and Spring Data requires one
 *       for any entity whose {@code @Id} is an association. A single-column
 *       shared key is not that.</li>
 *   <li>A scalar {@code listingId} plus {@code @MapsId} on a parallel
 *       {@code @OneToOne} association compiles and passes schema validation,
 *       but only works when both entities are created in the same
 *       persistence context/transaction — the real production write path
 *       (a single {@code @Transactional} service method), but not a test that
 *       loads an already-saved {@code Listing} via one repository call and
 *       then saves {@code HouseRules} via another. There, Hibernate does not
 *       recognize the referenced {@code Listing} as already persisted and
 *       re-issues its {@code INSERT}, which collides on the primary key.
 *       Caught by a genuine duplicate-key failure in
 *       {@code ListingApiTest.publicDetailIncludesHouseRulesWhenPresent}, not
 *       by inspection — the mapping looked correct and passed schema
 *       validation.</li>
 * </ul>
 *
 * <p>Neither this entity nor anything reading it needs to navigate to the
 * {@code Listing} object graph — every caller already has the listing's id on
 * hand — so there is no association to get wrong. The database foreign key
 * (with {@code ON DELETE CASCADE}) still enforces referential integrity
 * regardless of whether the ORM models it as an object reference.
 *
 * <p>Every answer is nullable on purpose, and that is the whole design. The
 * V12 migration puts it as "NULL does not equal false; silence is not a
 * promise": an owner who never answered "animaux acceptés ?" has not said no,
 * so an unanswered listing must drop out of a preference filter rather than be
 * counted as a refusal. Boxed {@code Boolean} rather than {@code boolean}
 * keeps that distinction at the type level, where it cannot be lost by
 * accident.
 */
@Entity
@Table(name = "house_rules")
public class HouseRules {

    @Id
    @Column(name = "listing_id")
    private UUID listingId;

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

    public HouseRules(UUID listingId) {
        this.listingId = listingId;
    }

    public UUID getListingId() { return listingId; }

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
