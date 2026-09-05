# SMTP Configuration Guide for Dari Notification Delivery

This guide covers production SMTP setup for the Dari notification delivery system.

## Overview

Notification delivery is an opt-in, asynchronous SMTP worker that:

- **Enqueues** notifications transactionally with listing/user events through the `notification_outbox` table
- **Claims** pending notifications with pessimistic locks, preventing duplicate delivery across instances
- **Sends** through Spring's `JavaMailSender` with configurable retry behavior and exponential backoff
- **Tracks** state with idempotent sent/dead state handling
- **Preserves** existing French notification copy unchanged

The system is **disabled by default** in development. Production deployment requires explicit configuration of SMTP credentials and sender details.

## Configuration

### Basic Setup

Add the following environment variables or application properties to enable notifications:

```yaml
# application.yml or environment
spring:
  mail:
    host: ${SMTP_HOST}
    port: ${SMTP_PORT:587}
    username: ${SMTP_USERNAME}
    password: ${SMTP_PASSWORD}
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
            required: true
        from: ${DARI_NOTIFICATIONS_FROM}

dari:
  notifications:
    enabled: ${DARI_NOTIFICATIONS_ENABLED:false}
    from: ${DARI_NOTIFICATIONS_FROM:no-reply@dari.ma}
    batch-size: ${DARI_NOTIFICATIONS_BATCH_SIZE:50}
    max-attempts: ${DARI_NOTIFICATIONS_MAX_ATTEMPTS:5}
    retry-delay-seconds: ${DARI_NOTIFICATIONS_RETRY_DELAY_SECONDS:60}
    stale-after-minutes: ${DARI_NOTIFICATIONS_STALE_AFTER_MINUTES:15}
    delivery-interval-ms: ${DARI_NOTIFICATIONS_DELIVERY_INTERVAL_MS:30000}
```

### Required Environment Variables

- `DARI_NOTIFICATIONS_ENABLED=true` — Activates the delivery service
- `DARI_NOTIFICATIONS_FROM=noreply@example.com` — Sender email address
- `SMTP_HOST` — SMTP server hostname
- `SMTP_PORT` — SMTP port (default: 587 for TLS, 465 for SSL)
- `SMTP_USERNAME` — SMTP authentication user
- `SMTP_PASSWORD` — SMTP authentication password (never commit; use secret management)

### Behavior Configuration

These have sensible defaults and rarely need adjustment:

- `DARI_NOTIFICATIONS_BATCH_SIZE=50` — Notifications to claim per delivery cycle
- `DARI_NOTIFICATIONS_MAX_ATTEMPTS=5` — Maximum retry attempts before marking DEAD
- `DARI_NOTIFICATIONS_RETRY_DELAY_SECONDS=60` — Base delay between retries
- `DARI_NOTIFICATIONS_STALE_AFTER_MINUTES=15` — Duration after which SENDING becomes reclaimable
- `DARI_NOTIFICATIONS_DELIVERY_INTERVAL_MS=30000` — Scheduled delivery interval (milliseconds)

## Provider Examples

### Gmail / Google Workspace

Gmail SMTP requires App Passwords (not the account password).

**Setup steps:**
1. Enable 2-Step Verification on the Google account
2. Generate an [App Password](https://support.google.com/accounts/answer/185833)
3. Use the 16-character password (without spaces) as `SMTP_PASSWORD`

```yaml
# For local testing only — never commit credentials
spring:
  mail:
    host: smtp.gmail.com
    port: 587
    username: notifications@example.com
    password: xxxx xxxx xxxx xxxx  # 16-char App Password (without spaces)
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
            required: true
```

### Microsoft Outlook / Office 365

```yaml
spring:
  mail:
    host: smtp-mail.outlook.com
    port: 587
    username: notifications@example.onmicrosoft.com
    password: ${SMTP_PASSWORD}
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
            required: true
```

### Moroccan ISP (Example: Maroc Telecom)

```yaml
spring:
  mail:
    host: smtp.maroctelecom.ma
    port: 587
    username: ${SMTP_USERNAME}
    password: ${SMTP_PASSWORD}
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
            required: true
```

## Security Best Practices

1. **Never commit credentials** — Use environment variables or secure secret management (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault)

2. **Use application-local.yml only for testing** — The file `application-local.yml` is in `.gitignore` and safe for local dev credentials

3. **Enable TLS** — Always set `starttls.required: true` in production

4. **Isolate service account** — Create a dedicated SMTP service account with permission to send email only

5. **Rotate credentials regularly** — Treat SMTP passwords like any other secret

6. **Monitor delivery** — Query the `notification_outbox` table for DEAD messages and investigate failures

## Testing Delivery

### Local Testing with Fake SMTP

For development, use a test SMTP server (e.g., MailHog or PaperCut):

```bash
docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

Then configure:

```yaml
spring:
  mail:
    host: localhost
    port: 1025
    protocol: smtp
    properties:
      mail:
        smtp:
          auth: false

dari:
  notifications:
    enabled: true
    from: noreply@dari.local
```

Visit http://localhost:8025 to see sent emails.

### Production Validation

Before enabling in production:

1. **Verify sender address** — Confirm the From address is registered and authorized with the SMTP provider

2. **Test with a real recipient** — Send a test notification through the API and confirm delivery

3. **Check bounce handling** — Invalid recipient emails should land in the DEAD queue; verify `notification_outbox.status = 'DEAD'`

4. **Monitor the outbox** — Query for stuck SENDING messages:

```sql
select id, event_type, status, last_error, attempts, next_attempt_at
from notification_outbox
where status = 'SENDING' and locked_at < now() - interval '30 minutes'
order by locked_at desc;
```

5. **Test failover** — Restart the delivery service while messages are pending to verify stale-claim recovery

## Notification Events and Copy

The system delivers the following event types:

| Event Type | Recipient | Copy | Language |
|---|---|---|---|
| `LISTING_APPROVED` | Owner | "Votre annonce a été approuvée" | French |
| `LISTING_REJECTED` | Owner | Reason provided by moderator | French |
| `LISTING_SUSPENDED` | Owner | "Votre annonce a été suspendue" | French |
| `LISTING_REINSTATED` | Owner | "Votre annonce a été rétablie" | French |
| `LISTING_EXPIRING_SOON` | Owner | "Votre annonce expire dans X jours" | French |
| `LISTING_EXPIRED` | Owner | "Votre annonce a expiré et doit être renouvelée" | French |
| `USER_WARNED` | User | Reason provided by moderator | French |
| `USER_SUSPENDED` | User | Reason provided by moderator | French |
| `USER_BANNED` | User | Reason provided by moderator | French |
| `REPORT_ACKNOWLEDGED` | Reporter | "Votre signalement a bien été reçu" | French |

**Copy rules:**
- No exclamation marks
- No emoji
- Sentence case, plain and non-blaming
- Generic and minimal for report acknowledgments (no outcome revealed)
- Always `vous` form

## Troubleshooting

### Notifications not sending

1. **Check if enabled** — Confirm `DARI_NOTIFICATIONS_ENABLED=true` is set and the app logs show the service started
2. **Verify SMTP credentials** — Test with a mail client (Thunderbird, Outlook) using the same credentials
3. **Check firewall** — Ensure outbound SMTP (typically port 587) is allowed
4. **Review outbox status** — Query notifications with status = 'DEAD' to see the exact error

```sql
select id, event_type, recipient_id, last_error, attempts, created_at
from notification_outbox
where status = 'DEAD'
order by created_at desc
limit 10;
```

### Stuck SENDING messages

If messages remain SENDING for > 15 minutes, they can be reclaimed:

```sql
update notification_outbox
set status = 'PENDING', locked_at = null, next_attempt_at = now()
where status = 'SENDING' and locked_at < now() - interval '15 minutes';
```

### High retry volume

Check for systematic issues:

```sql
select event_type, count(*) as dead_count, last_error
from notification_outbox
where status = 'DEAD'
group by event_type, last_error
order by dead_count desc;
```

Common causes:
- Invalid recipient email (check `notification_outbox.recipient_id` against the `users` table)
- SMTP authentication failure (verify credentials)
- Daily rate limits exceeded (increase batch interval or stagger delivery times)

## Next Steps

1. Select an SMTP provider (Gmail, Outlook, or Moroccan ISP)
2. Obtain credentials and test locally
3. Configure environment variables in production environment
4. Deploy and validate with the test suite
5. Monitor the outbox table for errors during the first 24 hours
6. Once stable, enable monitoring/alerting on DEAD message count

---

**Last updated:** 2026-09-05
**Version:** 1.0
