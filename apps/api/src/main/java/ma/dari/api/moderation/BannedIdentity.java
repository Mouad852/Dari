package ma.dari.api.moderation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import ma.dari.api.common.jpa.Ids;
import ma.dari.api.user.User;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Entity
@Table(name = "banned_identities")
public class BannedIdentity {

    @Id
    private UUID id = Ids.newId();

    @Column(name = "email_lower", unique = true)
    private String emailLower;

    @Column(unique = true)
    private String phone;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected BannedIdentity() {
    }

    public static BannedIdentity of(User user) {
        BannedIdentity banned = new BannedIdentity();
        banned.user = user;
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            banned.emailLower = user.getEmail().trim().toLowerCase(Locale.ROOT);
        }
        if (user.getPhone() != null && !user.getPhone().isBlank()) {
            banned.phone = user.getPhone().trim();
        }
        return banned;
    }

    public UUID getId() { return id; }
    public String getEmailLower() { return emailLower; }
    public String getPhone() { return phone; }
    public User getUser() { return user; }
    public Instant getCreatedAt() { return createdAt; }
}
