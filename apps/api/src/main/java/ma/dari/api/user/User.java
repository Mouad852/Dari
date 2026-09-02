package ma.dari.api.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import ma.dari.api.common.jpa.Ids;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * A Dari account.
 *
 * <p>Distinct from the Firebase identity, which owns credentials and nothing
 * else. {@code firebaseUid} is the join between the two, and the only field that
 * may never change.
 *
 * <p>This entity is never serialized to a client. Every response goes through a
 * DTO whose fields are chosen explicitly, so leaking {@code email} or
 * {@code firebaseUid} takes a deliberate act rather than an oversight.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    private UUID id = Ids.newId();

    @Column(name = "firebase_uid", nullable = false, updatable = false, unique = true)
    private String firebaseUid;

    @Column(nullable = false)
    private String email;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    private String phone;

    @Column(name = "phone_verified", nullable = false)
    private boolean phoneVerified;

    @Column(name = "first_name")
    private String firstName;

    /** The only name shown publicly. Never render firstName to a stranger. */
    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "user_role")
    private UserRole role = UserRole.USER;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "user_status")
    private UserStatus status = UserStatus.ACTIVE;

    private String city;

    @Column(columnDefinition = "text")
    private String bio;

    @Column(name = "avatar_url")
    private String avatarUrl;

    /** Set by account deletion (phase 09). Every read path must filter on it. */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected User() {
        // JPA
    }

    public User(String firebaseUid, String email, boolean emailVerified, String displayName) {
        this.firebaseUid = firebaseUid;
        this.email = email;
        this.emailVerified = emailVerified;
        this.displayName = displayName;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public UUID getId() { return id; }

    public String getFirebaseUid() { return firebaseUid; }

    public String getEmail() { return email; }

    public void setEmail(String email) { this.email = email; }

    public boolean isEmailVerified() { return emailVerified; }

    public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }

    public String getPhone() { return phone; }

    public void setPhone(String phone) { this.phone = phone; }

    public boolean isPhoneVerified() { return phoneVerified; }

    public void setPhoneVerified(boolean phoneVerified) { this.phoneVerified = phoneVerified; }

    public String getFirstName() { return firstName; }

    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getDisplayName() { return displayName; }

    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public UserRole getRole() { return role; }

    public void setRole(UserRole role) { this.role = role; }

    public UserStatus getStatus() { return status; }

    public void setStatus(UserStatus status) { this.status = status; }

    public String getCity() { return city; }

    public void setCity(String city) { this.city = city; }

    public String getBio() { return bio; }

    public void setBio(String bio) { this.bio = bio; }

    public String getAvatarUrl() { return avatarUrl; }

    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public Instant getDeletedAt() { return deletedAt; }

    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }

    public Instant getCreatedAt() { return createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
}
