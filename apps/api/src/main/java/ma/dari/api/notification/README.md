# Notification Delivery System

## Overview

The Dari notification delivery system is a **transactional outbox worker** that delivers SMTP notifications asynchronously, ensuring:

- **Durability** — Notifications enqueued with transactional events are persisted and survive crashes
- **Idempotency** — Pessimistic locks prevent duplicate delivery across instances
- **Resilience** — Bounded retries with exponential backoff handle temporary transport failures
- **Visibility** — State tracking and error logs enable production monitoring

Delivery is **opt-in** and disabled by default. See [SMTP_CONFIGURATION.md](../SMTP_CONFIGURATION.md) for production setup.

## Architecture

### Transactional Enqueueing

Notifications are enqueued **within the transaction of the event they describe**. This guarantees:

- Moderation decisions, listing expirations, and user actions all create notifications atomically
- Database crashes do not lose notifications
- Application crashes during `save()` roll back both the event and its notification

Example (from `ListingExpiryJob`):

```java
// Within a single transaction:
listingRepository.expirePublishedBefore(cutoff);   // Listing state change
notificationService.listingExpired(listing);       // Notification enqueue
// Both commit or both roll back
```

### Outbox Table

The `notification_outbox` table stores pending notifications:

```sql
notification_outbox {
  id uuid primary key,
  event_type varchar(64),             -- e.g., LISTING_APPROVED
  recipient_id uuid not null,         -- User who receives the email
  aggregate_id uuid,                  -- Listing ID (for listing events) or null (for user events)
  payload text not null,              -- Email body (French, plain text)
  created_at timestamptz not null,
  status varchar(16),                 -- PENDING, SENDING, SENT, DEAD
  attempts integer,                   -- Retry counter
  next_attempt_at timestamptz,        -- When to retry (exponentially backed off)
  locked_at timestamptz,              -- Claim timestamp (stale-claim recovery)
  sent_at timestamptz,                -- When delivery succeeded
  last_error text                     -- Most recent transport error or validation failure
}

-- Delivery query uses this composite index
create index idx_notification_outbox_delivery
on notification_outbox (status, next_attempt_at, created_at, id);
```

### Delivery Pipeline

The system runs on a fixed 30-second interval (configurable):

```
[NotificationDeliveryService.deliverPending()] scheduled every 30s
    ↓
[NotificationOutboxClaimService.claim()] claims up to 50 rows
    • Pessimistic write lock (SKIP LOCKED) — non-blocking
    • Filters: status = PENDING and now >= next_attempt_at
    • Filters: status = SENDING and locked_at > 15 minutes (stale recovery)
    • Updates status to SENDING, increments attempts
    ↓
For each claimed event:
    • Validate event type and payload
    • Fetch recipient email from User
    • Send via SMTP
    • On success: mark SENT, record sent_at
    • On SMTP failure: mark PENDING, schedule retry, record error
    • On validation failure: mark DEAD, record error
    ↓
Save all state updates
```

### Claim and Lock Management

**Pessimistic locking ensures multi-instance safety:**

- Only one instance can lock a row at a time
- Locks are held for the duration of the claim, not during SMTP (non-blocking)
- `SKIP LOCKED` allows the query to skip locked rows and process the next batch
- Stale locks (> 15 minutes old) are automatically reclaimed on the next cycle

Example scenario:
1. Instance A claims a message, marks SENDING, locked_at = now
2. Instance B tries to claim the same message → skipped (already locked)
3. Instance A crashes before sending
4. Instance B on the next cycle finds locked_at > 15 minutes, reclaims it
5. Message is retried without manual intervention

### Retry Behavior

Failures retry with **exponential backoff**:

```
Attempt 1: +60 seconds
Attempt 2: +120 seconds (60 * 2)
Attempt 3: +180 seconds (60 * 3)
Attempt 4: +240 seconds (60 * 4)
Attempt 5: +300 seconds (60 * 5) [max attempt]
After attempt 5: marked DEAD
```

Transient failures (network timeout, SMTP service unavailable) retry indefinitely until the limit is reached. Invalid recipient emails (no email on the User record) mark DEAD immediately to avoid cycles.

## Notification Events

All notifications are enqueued through `NotificationService`:

```java
public interface NotificationService {
    void listingApproved(Object listing);           // "Votre annonce a été approuvée"
    void listingRejected(Object listing, String reason);
    void listingSuspended(Object listing);          // "Votre annonce a été suspendue"
    void listingReinstated(Object listing);         // "Votre annonce a été rétablie"
    void listingExpiringSoon(Object listing, int daysRemaining);
    void listingExpired(Object listing);            // "Votre annonce a expiré et doit être renouvelée"
    void userWarned(User user, String reason);
    void userSuspended(User user, String reason);
    void userBanned(User user, String reason);
    void reportAcknowledged(User reporter);         // "Votre signalement a bien été reçu"
}
```

Implementations (currently `OutboxNotificationService`) persist to the outbox table. The delivery service sends the persisted payloads unchanged.

## Configuration

All behavior is environment-driven:

```yaml
dari:
  notifications:
    enabled: false                                  # false = entire system disabled
    from: no-reply@dari.ma                         # Sender email address
    batch-size: 50                                  # Rows to claim per cycle
    max-attempts: 5                                 # Before marking DEAD
    retry-delay-seconds: 60                        # Base delay for exponential backoff
    stale-after-minutes: 15                        # Claim timeout duration
    delivery-interval-ms: 30000                    # Schedule frequency (milliseconds)

spring:
  mail:
    host: smtp.gmail.com
    port: 587
    username: notifications@example.com
    password: ${SMTP_PASSWORD}
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
            required: true
```

See [SMTP_CONFIGURATION.md](../SMTP_CONFIGURATION.md) for provider-specific examples.

## Copy and Content

All French notification copy is defined at enqueue time in `OutboxNotificationService` and sent unchanged by the delivery service. The payloads are **plain text**:

- No HTML, no markdown
- No exclamation marks
- No emoji
- Sentence case, plain and non-blaming
- Report acknowledgments are generic (no outcome revealed)

Examples:
- Listing approval: `"Votre annonce a été approuvée"`
- Expiry warning: `"Votre annonce expire dans 7 jours"`
- Report acknowledged: `"Votre signalement a bien été reçu"`

## Testing

### Unit Tests

`NotificationDeliveryServiceTest` validates:

- Happy path: notification claimed, recipient email fetched, sent via SMTP, marked SENT
- Transient failure: retry scheduled with exponential backoff, error logged
- Malformed event: unsupported type or empty payload marked DEAD without sending
- Missing recipient email: marked DEAD without sending

Run with:
```bash
mvn -Dtest=NotificationDeliveryServiceTest test
```

### Integration Tests

The full API suite includes notification tests:

```bash
mvn test
```

Testcontainers PostgreSQL enables complete end-to-end testing:
- Notifications enqueued by listing/user changes
- Delivery service claims and sends
- State transitions verified in the outbox table

### Manual Testing

Use a fake SMTP server locally:

```bash
docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

Configure:
```yaml
spring.mail.host: localhost
spring.mail.port: 1025
dari.notifications.enabled: true
```

Create a listing:
```bash
curl -X POST http://localhost:8080/api/v1/listings \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "title": "...", ... }'
```

Approve it via admin:
```bash
curl -X PATCH http://localhost:8080/api/v1/admin/listings/{id}/approve \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Check the outbox:
```sql
select * from notification_outbox order by created_at desc limit 1;
```

View sent email at http://localhost:8025.

## Monitoring

### Query outbox health

```sql
-- Pending notifications
select count(*) from notification_outbox where status = 'PENDING';

-- Failed messages
select id, event_type, last_error, attempts
from notification_outbox
where status = 'DEAD'
order by created_at desc
limit 20;

-- Stuck SENDING messages (stale locks)
select id, locked_at, now() - locked_at as stuck_for
from notification_outbox
where status = 'SENDING' and locked_at < now() - interval '30 minutes'
order by locked_at desc;

-- Success rate by event type
select event_type,
  count(*) as total,
  sum(case when status = 'SENT' then 1 else 0 end) as sent,
  sum(case when status = 'DEAD' then 1 else 0 end) as dead,
  round(100.0 * sum(case when status = 'SENT' then 1 else 0 end) / count(*), 1) as success_pct
from notification_outbox
where created_at > now() - interval '24 hours'
group by event_type
order by event_type;
```

### Production observability

Recommended alerts:
- `DEAD` message count > threshold (e.g., > 10 in 1 hour)
- Delivery latency > threshold (e.g., time from created_at to sent_at > 5 minutes)
- SENDING messages locked > stale-after duration (indicates instance crash)

## Disabling Delivery

To disable notifications without removing the outbox infrastructure:

```yaml
dari:
  notifications:
    enabled: false  # Service bean not created; no scheduled task runs
```

The outbox table remains populated for future re-enabling, but no delivery occurs.

## Future Work

Potential enhancements (not in scope for launch):

- **SMS delivery** — Add `SmsSender` alongside SMTP
- **Template system** — Store templates in the database, compose at delivery time
- **Delivery webhooks** — Integrate with external notification services (SendGrid, Twilio)
- **In-app notifications** — Unread notification store on the user entity
- **Email preferences** — Allow users to opt out of specific notification types

---

**Last updated:** 2026-09-05  
**Version:** 1.0  
**Architecture Review:** Phase 10 (Scheduled jobs, notifications, hardening and launch readiness)
