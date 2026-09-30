package ma.dari.api.notification;

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
@Table(name = "notification_outbox")
public class NotificationOutbox {

    @Id
    private UUID id = Ids.newId();

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "recipient_id", nullable = false)
    private UUID recipientId;

    @Column(name = "aggregate_id")
    private UUID aggregateId;

    /** Null on rows queued before V31; the sender then uses a generic subject. */
    @Column(columnDefinition = "text")
    private String subject;

    @Column(nullable = false, columnDefinition = "text")
    private String payload;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private NotificationOutboxStatus status = NotificationOutboxStatus.PENDING;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "next_attempt_at", nullable = false)
    private Instant nextAttemptAt = Instant.now();

    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;

    protected NotificationOutbox() {
    }

    public NotificationOutbox(String eventType, UUID recipientId, UUID aggregateId, String payload) {
        this(eventType, recipientId, aggregateId, null, payload);
    }

    public NotificationOutbox(String eventType, UUID recipientId, UUID aggregateId, String subject, String payload) {
        this.eventType = eventType;
        this.recipientId = recipientId;
        this.aggregateId = aggregateId;
        this.subject = subject;
        this.payload = payload;
    }

    public String getEventType() {
        return eventType;
    }

    public UUID getRecipientId() {
        return recipientId;
    }

    public UUID getAggregateId() {
        return aggregateId;
    }

    public String getSubject() {
        return subject;
    }

    public String getPayload() {
        return payload;
    }

    public UUID getId() { return id; }

    public NotificationOutboxStatus getStatus() { return status; }

    public int getAttempts() { return attempts; }

    public Instant getNextAttemptAt() { return nextAttemptAt; }

    public String getLastError() { return lastError; }

    public void markSending(Instant now) {
        status = NotificationOutboxStatus.SENDING;
        attempts++;
        lockedAt = now;
        lastError = null;
    }

    public void markSent(Instant now) {
        status = NotificationOutboxStatus.SENT;
        sentAt = now;
        lockedAt = null;
        lastError = null;
    }

    public void markRetry(Instant nextAttempt, String error) {
        status = NotificationOutboxStatus.PENDING;
        nextAttemptAt = nextAttempt;
        lockedAt = null;
        lastError = error;
    }

    public void markDead(String error) {
        status = NotificationOutboxStatus.DEAD;
        lockedAt = null;
        lastError = error;
    }
}
