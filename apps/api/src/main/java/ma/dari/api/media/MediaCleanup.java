package ma.dari.api.media;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import ma.dari.api.common.jpa.Ids;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "media_cleanup")
public class MediaCleanup {
    @Id
    private UUID id = Ids.newId();
    @Column(name = "storage_key", nullable = false, unique = true)
    private String storageKey;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "text")
    private MediaCleanupStatus status = MediaCleanupStatus.PENDING;
    @Column(nullable = false)
    private int attempts;
    @Column(name = "next_attempt_at", nullable = false)
    private Instant nextAttemptAt = Instant.now();
    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected MediaCleanup() {
    }

    public MediaCleanup(String storageKey) {
        this.storageKey = storageKey;
    }

    public UUID getId() { return id; }
    public String getStorageKey() { return storageKey; }
    public MediaCleanupStatus getStatus() { return status; }
    public void setStatus(MediaCleanupStatus status) { this.status = status; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }
    public Instant getNextAttemptAt() { return nextAttemptAt; }
    public void setNextAttemptAt(Instant nextAttemptAt) { this.nextAttemptAt = nextAttemptAt; }
    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
