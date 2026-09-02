package ma.dari.api.listing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import ma.dari.api.common.jpa.Ids;
import ma.dari.api.user.User;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "listings")
public class Listing {

    @Id
    private UUID id = Ids.newId();

    @ManyToOne
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String city;

    @Column(nullable = false)
    private String neighborhood;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(name = "location", insertable = false, updatable = false,
            columnDefinition = "geography(Point,4326)")
    private Object location;

    @Column(name = "price_rent", nullable = false, precision = 10, scale = 2)
    private BigDecimal priceRent;

    @Column(name = "price_deposit", precision = 10, scale = 2)
    private BigDecimal priceDeposit;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "wifi_included", nullable = false, columnDefinition = "charge_inclusion")
    private ChargeInclusion wifiIncluded = ChargeInclusion.NA;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "electricity_included", nullable = false, columnDefinition = "charge_inclusion")
    private ChargeInclusion electricityIncluded = ChargeInclusion.NA;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "water_included", nullable = false, columnDefinition = "charge_inclusion")
    private ChargeInclusion waterIncluded = ChargeInclusion.NA;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "property_type", columnDefinition = "property_type")
    private PropertyType propertyType;

    @Column(name = "num_bedrooms")
    private Short numBedrooms;

    @Column(name = "num_bathrooms")
    private Short numBathrooms;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "room_type", columnDefinition = "room_type")
    private RoomType roomType;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "room_furnishing", columnDefinition = "room_furnishing")
    private RoomFurnishing roomFurnishing;

    @Column(name = "common_areas_furnished", nullable = false)
    private Boolean commonAreasFurnished = false;

    @Column(name = "current_roommates_count")
    private Short currentRoommatesCount;

    @Column(name = "max_roommates")
    private Short maxRoommates;

    @Column(name = "available_from")
    private LocalDate availableFrom;

    @Column(name = "min_stay_months")
    private Short minStayMonths;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "listing_status")
    private ListingStatus status = ListingStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "availability_state")
    private AvailabilityState availabilityState = AvailabilityState.AVAILABLE;

    @Column(name = "auto_flagged", nullable = false)
    private boolean autoFlagged = false;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "prior_status", columnDefinition = "listing_status")
    private ListingStatus priorStatus;

    @Column(name = "rejection_reason", columnDefinition = "text")
    private String rejectionReason;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected Listing() {
        // JPA
    }

    public Listing(User owner, String title, String city, String neighborhood,
                   Double latitude, Double longitude, BigDecimal priceRent,
                   ListingStatus status, AvailabilityState availabilityState) {
        this.owner = owner;
        this.title = title;
        this.city = city;
        this.neighborhood = neighborhood;
        this.latitude = latitude;
        this.longitude = longitude;
        this.priceRent = priceRent;
        this.status = status;
        this.availabilityState = availabilityState;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getNeighborhood() {
        return neighborhood;
    }

    public void setNeighborhood(String neighborhood) {
        this.neighborhood = neighborhood;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Object getLocation() {
        return location;
    }

    public BigDecimal getPriceRent() {
        return priceRent;
    }

    public void setPriceRent(BigDecimal priceRent) {
        this.priceRent = priceRent;
    }

    public BigDecimal getPriceDeposit() {
        return priceDeposit;
    }

    public void setPriceDeposit(BigDecimal priceDeposit) {
        this.priceDeposit = priceDeposit;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public ChargeInclusion getWifiIncluded() {
        return wifiIncluded;
    }

    public void setWifiIncluded(ChargeInclusion wifiIncluded) {
        this.wifiIncluded = wifiIncluded;
    }

    public ChargeInclusion getElectricityIncluded() {
        return electricityIncluded;
    }

    public void setElectricityIncluded(ChargeInclusion electricityIncluded) {
        this.electricityIncluded = electricityIncluded;
    }

    public ChargeInclusion getWaterIncluded() {
        return waterIncluded;
    }

    public void setWaterIncluded(ChargeInclusion waterIncluded) {
        this.waterIncluded = waterIncluded;
    }

    public PropertyType getPropertyType() {
        return propertyType;
    }

    public void setPropertyType(PropertyType propertyType) {
        this.propertyType = propertyType;
    }

    public Short getNumBedrooms() {
        return numBedrooms;
    }

    public void setNumBedrooms(Short numBedrooms) {
        this.numBedrooms = numBedrooms;
    }

    public Short getNumBathrooms() {
        return numBathrooms;
    }

    public void setNumBathrooms(Short numBathrooms) {
        this.numBathrooms = numBathrooms;
    }

    public RoomType getRoomType() {
        return roomType;
    }

    public void setRoomType(RoomType roomType) {
        this.roomType = roomType;
    }

    public RoomFurnishing getRoomFurnishing() {
        return roomFurnishing;
    }

    public void setRoomFurnishing(RoomFurnishing roomFurnishing) {
        this.roomFurnishing = roomFurnishing;
    }

    public Boolean getCommonAreasFurnished() {
        return commonAreasFurnished;
    }

    public void setCommonAreasFurnished(Boolean commonAreasFurnished) {
        this.commonAreasFurnished = commonAreasFurnished;
    }

    public Short getCurrentRoommatesCount() {
        return currentRoommatesCount;
    }

    public void setCurrentRoommatesCount(Short currentRoommatesCount) {
        this.currentRoommatesCount = currentRoommatesCount;
    }

    public Short getMaxRoommates() {
        return maxRoommates;
    }

    public void setMaxRoommates(Short maxRoommates) {
        this.maxRoommates = maxRoommates;
    }

    public LocalDate getAvailableFrom() {
        return availableFrom;
    }

    public void setAvailableFrom(LocalDate availableFrom) {
        this.availableFrom = availableFrom;
    }

    public Short getMinStayMonths() {
        return minStayMonths;
    }

    public void setMinStayMonths(Short minStayMonths) {
        this.minStayMonths = minStayMonths;
    }

    public ListingStatus getStatus() {
        return status;
    }

    public void setStatus(ListingStatus status) {
        this.status = status;
    }

    public AvailabilityState getAvailabilityState() {
        return availabilityState;
    }

    public void setAvailabilityState(AvailabilityState availabilityState) {
        this.availabilityState = availabilityState;
    }

    public boolean isAutoFlagged() {
        return autoFlagged;
    }

    public void setAutoFlagged(boolean autoFlagged) {
        this.autoFlagged = autoFlagged;
    }

    public ListingStatus getPriorStatus() {
        return priorStatus;
    }

    public void setPriorStatus(ListingStatus priorStatus) {
        this.priorStatus = priorStatus;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
