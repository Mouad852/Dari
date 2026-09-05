package ma.dari.api.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

    @Column(nullable = false, columnDefinition = "text")
    private String payload;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected NotificationOutbox() {
    }

    public NotificationOutbox(String eventType, UUID recipientId, UUID aggregateId, String payload) {
        this.eventType = eventType;
        this.recipientId = recipientId;
        this.aggregateId = aggregateId;
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

    public String getPayload() {
        return payload;
    }
}
