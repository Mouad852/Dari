# Phase 4 release readiness

This document separates work proven in the repository and local test harnesses from checks that require access to production-owned services. No production credentials or infrastructure are used by these checks.

## Implemented and locally verifiable

- GitHub Actions runs Java compile, the full PostGIS/Testcontainers Maven suite, a standalone empty-database Flyway smoke test, web typecheck/token drift/lint/build, mobile typecheck, npm audit gates, OWASP Java dependency scanning, and CodeQL. The OWASP job requires the `NVD_API_KEY` repository secret; CodeQL and dependency-review execute on GitHub-hosted runners.
- Playwright starts an isolated mock API and Next.js dev server with a test-only Firebase seam. The tests cover profile provisioning, listing publication through the moderation handoff, public filtering/pagination/map behavior, favorites, messaging, reporting, admin reactivation, account deletion, and Axe checks.
- The production web configuration gate remains active. CI uses transient HTTPS-shaped placeholder values only; these values are not valid production configuration and are never written to `.env` files.
- API health is available at `/actuator/health`; `/actuator/info` and Prometheus metrics are exposed only through the configured management surface. Notification outbox depth and media-cleanup pending/failure gauges are registered under `dari.notifications.*` and `dari.media.*`.
- SMTP delivery is opt-in, transactional, retryable, and covered by API unit/integration tests. Media deletion is durable, retryable, and now exposes pending and previously-failed cleanup gauges.
- `infra/scripts/restore-drill.ps1` restores an explicitly supplied archive into a disposable PostGIS 16 container. It cannot target the application database by configuration. A local disposable archive restore was exercised; it is not evidence of a production restore.
- `infra/scripts/validate-production-config.ps1` validates required production configuration shape without printing secret values.

The Java OWASP Dependency-Check command was attempted locally but could not complete because this environment has no NVD API key; it is therefore not claimed as locally passing. The web npm audit gate passed with no advisories at or above high severity. The mobile gate passed at the high/critical threshold but reports 14 moderate Expo-chain advisories that require a separately planned Expo upgrade.

## Production operator prerequisites

### Firebase

1. Add the exact public web origins to Firebase Authentication → Settings → Authorized domains, including the production web host and any approved preview host. Do not authorize wildcard domains.
2. Enable only the sign-in providers the product supports, confirm the email-verification policy, and verify the production Firebase project ID/API key/auth domain in the deployment secret/config store.
3. Install the Firebase Admin service-account file through the secret store or workload identity. Set `FIREBASE_CREDENTIALS_PATH` to the mounted file and rotate any key that was ever exposed.
4. After deployment, verify sign-in, profile provisioning, token refresh, admin authorization, and account deletion with a non-production test account.

### CI security credentials

Create the repository `NVD_API_KEY` secret before relying on the Java Dependency-Check required status. Do not place the key in workflow files, logs, artifacts, or application configuration.

### SMTP

Set `DARI_NOTIFICATIONS_ENABLED=true`, `DARI_NOTIFICATIONS_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, and `SMTP_PASSWORD` through the deployment secret store. Require STARTTLS on port 587 unless the approved provider requires another TLS mode. Send a real test notification, verify delivery and sender alignment, then force a safe SMTP failure and confirm rows move through retry state without secrets in logs. Alert on `DEAD` rows, stale `SENDING` rows, and delivery latency; queries are in `SMTP_CONFIGURATION.md`.

### PostgreSQL backups and restore

Run the encrypted custom-format daily dump and offsite upload policy in `docs/PRODUCTION_OPERATIONS.md`. At least weekly, run `infra/scripts/restore-drill.ps1 -BackupFile <archive>` on an isolated operator host, record duration, row-count checks, PostGIS version, and operator, then page on-call if the drill fails. This repository does not have production access, so backup scheduling, retention, object-lock, and the first production restore remain operator actions.

### Outbox and cleanup monitoring

Scrape `/actuator/prometheus` only through the authenticated/private monitoring path. Alert on notification `DEAD` growth, stale `SENDING`, high retry volume, and `dari.media.cleanup_failures > 0` or an increasing pending backlog. Investigate `last_error` with the SQL in `apps/api/src/main/java/ma/dari/api/notification/README.md`; do not print payloads, SMTP passwords, Firebase keys, or object-store secrets into logs or alerts.

### Deployment health and rollback

Before rollout, record immutable API/web artifact IDs, migration range, backup object, and operator. Confirm `/actuator/health`, a public listing read, one authenticated read, and one approved write smoke check. Keep the previous artifacts available. Roll back application artifacts first; do not edit Flyway history or run `flyway clean`. Leave a backward-compatible migration in place or use the separately approved restore procedure for destructive corruption. The detailed sequence is in `docs/PRODUCTION_OPERATIONS.md`.

## Incident runbooks

- API outage: stop rollout, check `/actuator/health`, ingress and dependency saturation, route to the previous immutable API artifact, then run read-only and auth smoke checks before restoring traffic.
- Database outage: stop writes, preserve logs and the latest verified backup, check connection saturation and storage, restore only into an isolated environment first, and make the data-loss/RTO decision explicitly with the incident lead.
- Authentication outage: verify Firebase status/config and authorized domains, preserve API authorization behavior, test token verification with a known test account, and do not add an API login bypass.
- Email outage: disable delivery only if it prevents harmful load, keep the outbox, inspect retry/DEAD/stale-SENDING rows, validate SMTP TLS and credentials, then replay through the worker after a safe test delivery.
- Storage outage: keep listing metadata durable, inspect media cleanup failures and object-store health, stop destructive cleanup retries if the provider is returning ambiguous results, and replay only after idempotent deletion is confirmed.
- Moderation abuse incident: preserve report/admin-action audit rows, rate-limit or suspend the abusive identity through existing controls, restrict moderator access if compromised, and do not disclose report outcomes to reporters.
