# SMTP Configuration Guide for Dari Notification Delivery

This guide covers production SMTP setup for the Dari notification delivery system.

## Overview

Notification delivery is an asynchronous SMTP worker that:

- **Enqueues** notifications transactionally with listing/user events through the `notification_outbox` table
- **Claims** pending notifications with pessimistic locks, preventing duplicate delivery across instances
- **Sends** through Spring's `JavaMailSender`, retrying failures with a linearly increasing delay
- **Tracks** state with idempotent sent/dead state handling
- **Preserves** existing French notification copy unchanged

Delivery is **off by default in development** and **on by default in production**. Under the
`production` profile the API refuses to start if notifications are disabled or SMTP is not
configured (`ProductionConfigValidator`), so a deploy cannot silently queue emails forever.

## Configuration

### What is already wired

`apps/api/src/main/resources/application-production.yml` maps the variables below onto Spring's
mail settings. Operators set environment variables only; there is no YAML to edit.

```yaml
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
            required: true      # never fall back to plaintext credentials
          connectiontimeout: 10000   # ms
          timeout: 10000             # ms, read
          writetimeout: 10000        # ms

dari:
  notifications:
    enabled: ${DARI_NOTIFICATIONS_ENABLED:true}
    from: ${DARI_NOTIFICATIONS_FROM}        # no default in production
```

The outbox tuning values (`batch-size`, `max-attempts`, and so on) keep the defaults from
`application.yml`.

### Required environment variables (production)

- `SMTP_HOST` — SMTP server hostname
- `SMTP_USERNAME` — SMTP authentication user
- `SMTP_PASSWORD` — SMTP authentication password (secret store only, never a file in the repo)
- `DARI_NOTIFICATIONS_FROM` — sender address, verified with the provider for the sending domain

Optional:

- `SMTP_PORT` — defaults to `587`. The profile requires STARTTLS, so use the provider's STARTTLS
  submission port. Port 465 (implicit TLS) is **not** supported by this configuration.
- `DARI_NOTIFICATIONS_ENABLED` — defaults to `true` in production. Setting it to `false` there
  makes startup fail on purpose. It is an off switch for development only.

`infra/scripts/validate-production-config.sh` (Linux) and `.ps1` (Windows) check exactly these
names with the same rules as the application, before a release starts.

### Behavior configuration

These have sensible defaults and rarely need adjustment:

- `DARI_NOTIFICATIONS_BATCH_SIZE=50` — Notifications to claim per delivery cycle
- `DARI_NOTIFICATIONS_MAX_ATTEMPTS=5` — Attempts before a row is marked DEAD
- `DARI_NOTIFICATIONS_RETRY_DELAY_SECONDS=60` — Linear backoff step: after attempt *n* fails, the
  next try is `n × 60 s` later. With the defaults a row goes DEAD about 10 minutes after its first
  failure.
- `DARI_NOTIFICATIONS_STALE_AFTER_MINUTES=15` — Duration after which SENDING becomes reclaimable
- `DARI_NOTIFICATIONS_DELIVERY_INTERVAL_MS=30000` — Scheduled delivery interval (milliseconds)

## Provider Examples

Each provider below is configured with the same four variables. Values shown are shapes, not
credentials.

### Gmail / Google Workspace

Gmail SMTP requires App Passwords (not the account password).

1. Enable 2-Step Verification on the Google account
2. Generate an [App Password](https://support.google.com/accounts/answer/185833)
3. Use the 16-character password (without spaces) as `SMTP_PASSWORD`

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=notifications@example.com
SMTP_PASSWORD=<16-character app password, from the secret store>
```

### Microsoft Outlook / Office 365

```
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USERNAME=notifications@example.onmicrosoft.com
SMTP_PASSWORD=<from the secret store>
```

### Transactional email provider

Most transactional providers (the recommended choice for production, see
`PRODUCTION_READINESS_AUDIT.md` §K) expose STARTTLS on port 587 with an API key as the password:

```
SMTP_HOST=<provider SMTP host>
SMTP_PORT=587
SMTP_USERNAME=<provider-specific user, often a fixed string such as "apikey">
SMTP_PASSWORD=<API key, from the secret store>
```

Align SPF, DKIM and DMARC for the `DARI_NOTIFICATIONS_FROM` domain before launch.

## Security Best Practices

1. **Never commit credentials** — Supply them through the deployment's secret store as environment
   variables.

2. **Do not put credentials in `application-local.yml`** — it is tracked in git, not ignored. Local
   experiments belong in environment variables or an untracked `.env` file.

3. **TLS is enforced** — `starttls.required: true` is set by the production profile; a server that
   does not offer STARTTLS fails the connection rather than receiving credentials in plaintext.

4. **Isolate the service account** — Create a dedicated SMTP account with permission to send email
   only.

5. **Rotate credentials regularly** — Treat SMTP passwords like any other secret.

6. **Monitor delivery** — Alert on DEAD rows and on the `dari.notifications.delivery` counter's
   `dead` outcome. Delivery failures are recorded in `notification_outbox.last_error`, not logged.

## Testing Delivery

### Production-like, locally

The production smoke stack (`infra/prod-smoke/`, see `docs/PRODUCTION_OPERATIONS.md`) runs the real
image under the `production` profile against Mailpit with STARTTLS required, so it exercises the
exact configuration above. Read captured mail at http://localhost:18025.

### Development

The development profile has no mail settings. To try delivery against a local SMTP sink, run
[Mailpit](https://mailpit.axllent.org/) and supply the settings as environment variables when
starting the API:

```bash
docker run --rm -p 1025:1025 -p 8025:8025 axllent/mailpit
```

```
DARI_NOTIFICATIONS_ENABLED=true
SPRING_MAIL_HOST=localhost
SPRING_MAIL_PORT=1025
```

Visit http://localhost:8025 to see sent emails.

### Production Validation

Before launch:

1. **Verify sender address** — Confirm the From address is registered and authorized with the SMTP provider

2. **Test with a real recipient** — Trigger a notification (for example, approve a test listing) and confirm delivery

3. **Check bounce handling** — Invalid recipient emails should land in the DEAD queue; verify `notification_outbox.status = 'DEAD'`

4. **Monitor the outbox** — Query for stuck SENDING messages:

```sql
select id, event_type, status, last_error, attempts, next_attempt_at
from notification_outbox
where status = 'SENDING' and locked_at < now() - interval '30 minutes'
order by locked_at desc;
```

5. **Test failover** — Restart the API while messages are pending to verify stale-claim recovery

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

### The API refuses to start

The startup check lists every missing or invalid variable by name, for example
`SMTP_HOST is not set (spring.mail.host)`. Values are never printed. Run
`infra/scripts/validate-production-config.sh` on the host to get the same list without starting
the API.

### Notifications not sending

1. **Verify SMTP credentials** — Test with a mail client using the same host, port and credentials
2. **Check STARTTLS** — The provider must offer STARTTLS on `SMTP_PORT`; implicit-TLS port 465 fails
3. **Check firewall** — Ensure outbound SMTP (typically port 587) is allowed from the API host
4. **Review outbox status** — Query notifications with status = 'DEAD' to see the exact error

```sql
select id, event_type, recipient_id, last_error, attempts, created_at
from notification_outbox
where status = 'DEAD'
order by created_at desc
limit 10;
```

### Stuck SENDING messages

If messages remain SENDING for > 15 minutes, they are reclaimed automatically on the next cycle.
To force it:

```sql
update notification_outbox
set status = 'PENDING', locked_at = null, next_attempt_at = now()
where status = 'SENDING' and locked_at < now() - interval '15 minutes';
```

### Re-sending DEAD messages after an outage

Once SMTP is fixed, DEAD rows are not retried on their own. Re-queue them deliberately:

```sql
update notification_outbox
set status = 'PENDING', attempts = 0, next_attempt_at = now(), last_error = null
where status = 'DEAD' and created_at > now() - interval '1 day';
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

1. Select an SMTP provider and align SPF/DKIM/DMARC for the sender domain
2. Store the credentials in the deployment secret store
3. Run `infra/scripts/validate-production-config.sh` in the deployment environment
4. Deploy and validate with a real recipient
5. Monitor the outbox table for errors during the first 24 hours
6. Enable alerting on DEAD message count

---

**Last updated:** 2026-09-21
**Version:** 1.1
