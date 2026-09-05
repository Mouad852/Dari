# 10 — Scheduled jobs, notifications, hardening and launch readiness

## What this covers, and why it's here

The scheduled expiry job, notification delivery, security hardening, observability, and everything that has to be true before real users arrive.

It is last among the web phases because most of it can only be done once the system it hardens exists. But **do not read "last" as "optional".** This phase contains the listing expiry job, without which §4's lifecycle is incomplete, and the notification delivery that phases 06 and 08 assume exists. Those are not polish.

There is a real risk that this phase gets compressed under launch pressure. The items most likely to be dropped — rate limiting, the security review of location fuzzing, the abuse paths — are precisely the ones an anti-scam platform cannot afford to drop.

## Tasks

**Scheduled jobs**
- [x] `PUBLISHED → EXPIRED` after 60 days without update (§4). The existing `updated_at` clock is used, so any PATCH resets freshness.
- [x] Owner notification seven days ahead of expiry, using idempotent listing tracking
- [x] `EXPIRED → PENDING_REVIEW` on renewal, back through review rather than straight to published (§4)
- [x] Make the job idempotent and safe to run twice — the conditional update only matches `PUBLISHED` rows, and ShedLock protects multi-instance execution.
- [ ] Decide what "update" means for the expiry clock: any `PATCH`, or a deliberate renewal? A listing kept alive by trivial edits defeats the purpose.

**Notifications**
- [x] Delivery mechanism — opt-in SMTP email; in-app is out of scope for launch
- [x] The §6 set: suspension, rejection with reason, reinstatement, warnings
- [x] Reporter acknowledgment that is **generic and reveals no outcome**
- [x] Expiry warning and confirmation are enqueued through the notification outbox
- [ ] Templates in French, following the copy rules — no exclamation marks, no emoji, no *"Oups !"*

**Hardening**
- [x] Rate limits on the abuse-prone routes: report creation, message sending, listing creation, uploads, signup, and public search/count/map/featured reads
- [x] **A dedicated review of location fuzzing across every endpoint**, including map, search, detail and any admin route that might be reachable publicly. One leak makes the whole scheme decorative.
- [x] Audit every response DTO for private-field leakage — email, phone, exact coordinates, internal status, `firebase_uid`
- [x] Confirm soft-delete is honoured across API read paths; Firestore mirror work remains out of scope
- [x] Decide and implement the PII policy for deleted users: email, phone, first name, city, bio, and the stored avatar file are cleared on self-deletion (see "Verified implementation" below)
- [x] Input validation and size limits across all write paths
- [x] CORS, security headers, and production token-setting review: CORS is an explicit
  origin allowlist with `Authorization`/`Content-Type` headers; API responses send
  `nosniff`, `DENY`, referrer, permissions, and HSTS headers; production requires
  `DARI_WEB_ORIGIN` and `FIREBASE_CREDENTIALS_PATH`, with TLS terminated at the
  ingress and forwarded headers enabled. The web client uses the public HTTPS API
  URL in `NEXT_PUBLIC_API_BASE_URL`, while server components may use `API_BASE_URL`;
  Firebase ID tokens are refreshed by the SDK and sent only as bearer headers.
- [x] Verify ownership and role checks on every mutating route, systematically rather than by memory

**Operations**
- [x] Structured logging with correlation ids (pre-existing); error tracking via counted+logged unhandled exceptions (see below — a hosted APM/error-tracking service remains the user's own account decision)
- [x] Metrics on the things that indicate trouble: search latency, moderation queue depth, report volume, notification delivery outcomes, job outcomes
- [x] Database backup creation and restore validation in a clean PostGIS environment
- [x] Deployment pipeline, migration strategy, rollback plan documented in `docs/PRODUCTION_OPERATIONS.md`
- [ ] Load test on the search path, which is the busiest and most complex query in the system
- [ ] Seed the production amenity lookup and neighborhood lists as real reference data

**Launch readiness**
- [ ] End-to-end pass over the whole journey, twice: as a seeker and as an owner
- [x] Moderator runbook — documented in `docs/MODERATOR_RUNBOOK.md`
- [x] Legal pages: terms, privacy, and location-data explanation are available under `/legal/*`; legal identity and contact details remain a pre-publication release gate
- [ ] Accessibility pass to the standard already set: 360px, visible focus, WCAG AA contrast, `prefers-reduced-motion`

## Depends on

- Every prior phase
- Design doc §4 expiry and renewal, §6 notifications and retention, §8 architecture

## Done looks like

- Listings expire on schedule, owners are warned first, and renewal re-enters review
- Every §6 notification is delivered, in French, following the copy rules
- Rate limits hold under a deliberate abuse attempt
- **No endpoint returns an exact coordinate or a private field** — verified by review, not assumption
- A backup has been restored into a scratch environment successfully
- Search holds up under a realistic load test
- Both end-to-end journeys pass on a production-like environment

## Risks and open decisions

### Verified implementation (2026-09-05)

All profile-backed mutating controllers now carry explicit method-security guards for
`USER` or `ADMIN` roles, while profileless `POST /users` remains the only write allowed
before profile creation. Listing, favorite, messaging, report, profile, and admin writes
also enforce ownership or target authorization in their services. HTTP regressions cover
non-owner listing/photo mutation, user-scoped favorite removal, non-participant message
sending, profileless listing mutation, and the existing doubled admin-role checks. Backup
creation and restore were validated separately; Firestore mirror work remains out of scope.

Rate limits are enforced by a Spring MVC interceptor before controller invocation. Report creation,
conversation/message writes, listing creation, listing photo uploads, avatar uploads, profile signup,
and the public search/count/map/featured reads are annotated explicitly. Authenticated policies have
independent fixed-window buckets for the Firebase identity and source address; anonymous search uses
the source address only. A rejected request returns the normal error envelope with HTTP 429 and
`Retry-After`. Defaults are configurable through `DARI_RATE_LIMIT_*` environment variables: reports
5/hour, messages 30/minute, listings 5/hour, uploads 20/hour, signup 5/hour, and search 120/minute.
The implementation is intentionally process-local; a shared Redis/database bucket is required before
running multiple API instances.

The public-response audit is complete. `PublicListingResponse` and
`PublicListingDetailResponse` expose availability but not moderation status, and
they receive coordinates only through `LocationFuzzer`. Search, map, detail,
featured, and favorites use those DTOs. Lifecycle confirmations now use the
owner-scoped `ListingResponse`, so status and exact coordinates remain available
only to the authenticated owner or moderator paths. `PublicProfileResponse`
structurally excludes email, phone, Firebase UID, and account status.

Regression tests exercise the public JSON for private-field absence and verify
that exact stored coordinates are not serialized across the public listing
surfaces. The web `PublicListing` type and favorites page follow the same
boundary.

`ListingExpiryJob` runs daily at 02:00 UTC, warns owners seven days before expiry, and uses the atomic `ListingRepository.expirePublishedBefore` update. `expiry_warned_at` prevents duplicate warnings and is cleared on renewal. ShedLock uses the JDBC provider and the `shedlock` table from `V16__shedlock.sql`. Warning and expiry events enqueue through the transactional `notification_outbox` table, and owners can renew only `EXPIRED` listings into `PENDING_REVIEW`.
Moderator `WARN` actions now enqueue `USER_WARNED` for the listing owner or user target and close pending reports as `ACTION_TAKEN`.

Notification delivery is an opt-in SMTP worker. `V19__notification_delivery_state.sql` adds `PENDING`, `SENDING`, `SENT`, and `DEAD` state, attempt tracking, stale-claim recovery, and retry timestamps. The worker claims rows with pessimistic locks and skips locked rows, sends outside the claim transaction, retries transport failures up to five attempts with increasing delays, and quarantines unsupported event types, empty payloads, or missing recipient email addresses. Existing French payloads are sent unchanged, and report acknowledgments remain generic. The `WARN` report action now enqueues a `USER_WARNED` message for the reported listing owner or user and resolves the pending reports as acted on.

The soft-delete read-path review is complete for the current API. Public listing
search/detail and cursor lookups, owner dashboards, favorites and favorite-id
membership checks, public profiles, conversation listing/creation context, report
targets, and the moderation pending-listings queue all apply the live-row boundary.
Account-deletion cascades, moderation history, notification delivery, and
authentication-token rejection intentionally retain historical-row access. No
Firestore mirror exists; backup creation and restore validation are complete and remain
independent of any future mirror work.

Production SMTP configuration is documented in `SMTP_CONFIGURATION.md` with:
- Safe configuration examples for Gmail, Outlook, and Moroccan ISP providers
- Environment variable reference and security best practices
- Local testing with MailHog or other fake SMTP servers
- Troubleshooting guide for common delivery failures
- Production validation steps and monitoring queries

The notification delivery architecture is documented in `apps/api/src/main/java/ma/dari/api/notification/README.md` with:
- Transactional outbox design and durability guarantees
- Pessimistic lock semantics and stale-claim recovery
- Retry behavior with exponential backoff (60s base delay, up to 5 attempts)
- State machine (`PENDING` → `SENDING` → `SENT` or `DEAD`)
- Configuration reference and provider examples
- Unit and integration test coverage
- Monitoring queries for outbox health, failure patterns, and stuck messages

The focused notification suite and full API suite pass with 106 tests (0 failures). Both unit tests and full integration tests validate:
- Transactional enqueueing alongside listing/user changes
- Claim semantics with non-blocking row locks (SKIP LOCKED)
- Retry scheduling with exponential backoff on transient failures
- Immediate DEAD state for validation errors
- Idempotent sent-state handling

The Phase 10 CORS/security regression suite verifies the configured-origin
preflight contract and rejects an untrusted origin. It also verifies the
browser security headers on API responses. `application-production.yml` makes
the production origin and Firebase credential path explicit instead of falling
back to local development values.

The account notification, payment, and security pages no longer present
fabricated balances, email addresses, device counts, or security scores. They
now identify unsupported contracts as unavailable, and the global footer links
to the legal pages. The remaining accessibility gate requires a real 360px and
keyboard pass before public launch.

`UserService#deleteAccount` (self-deletion, `DELETE /users/me`) now scrubs PII beyond
setting `deleted_at`: email becomes an empty string, phone/first name/city/bio/avatar URL
become null, `displayName` becomes the fixed placeholder "Utilisateur supprimé", and the
stored avatar file is deleted from disk — not merely unlinked. The row, its id, and any
messages or moderation history are kept, since those belong to counterparties and
moderators rather than solely to the deleted person, matching the existing "messages are
retained" decision. `email`/`displayName` stay non-null because the schema requires it and
other code assumes a value is present; `NotificationDeliveryService` already treats a blank
email exactly like a missing one and marks the event `DEAD`, so a notification already
queued for the person before deletion fails clean instead of erroring. The avatar file is
deleted only after the Firebase identity call succeeds, so a failure there rolls back the
whole transaction — including the in-memory scrub — without leaving a row pointing at an
already-deleted file. This scrub applies only to self-initiated deletion; a banned or
suspended account's row is untouched, since that PII remains legitimate audit-trail
material for moderators (see §6 "Data retention on ban" in the design doc). Covered by
`UserApiTest.accountDeletionScrubsPii`.

Found and fixed in the same pass, unrelated to the PII scrub itself: any missing path
under `/uploads/**` returned a raw 500 rather than 404, because `GlobalExceptionHandler`'s
catch-all `Exception` handler was swallowing Spring's `NoResourceFoundException`. Added a
dedicated handler mapping it to 404 `NOT_FOUND`. This is a general bug that would have hit
any deleted or never-existed upload path, not something the PII scrub introduced — the new
test was simply the first to exercise a genuinely missing upload.

Metrics are exposed at `/actuator/prometheus` via `micrometer-registry-prometheus` (free,
self-hosted, no external account — already riding on the existing actuator dependency).
Six meter families cover the operations checklist: `dari.search.latency` (timer, tagged
`mode=radius|location`) around `ListingSearchService#search`; `dari.moderation.queue_depth`
(gauge, tagged `target=listing|report`, registered in the new `MetricsConfig` and backed by
`countByStatusAndDeletedAtIsNull`/`countByStatus` queries added to the relevant
repositories) and `dari.notifications.outbox_depth` (gauge, tagged by outbox status) — both
sampled fresh at scrape time rather than pushed on every write, since a queue's size can
change from another instance or another moderator acting concurrently; `dari.reports.created`
and `dari.moderation.auto_suspended` counters in `ReportService`; `dari.jobs.listing_expiry.
{runs,warned,expired}` counters in `ListingExpiryJob`; `dari.notifications.delivery` (tagged
`outcome=sent|dead|retry`) in `NotificationDeliveryService`; and `dari.errors.unhandled`
(tagged by exception class) in `GlobalExceptionHandler`'s catch-all.

Deliberately did not wire a hosted error-tracking/APM service (Sentry, Rollbar, Datadog, etc.)
in this pass — that needs the user's own account and credentials, which is a product/infra
decision this project's own "never spend money without asking" posture (see the equivalent
Firebase-spend rule) extends to by analogy, not something to default into unilaterally.
Unhandled exceptions were already logged with full context (correlation id via MDC) before
this change; they are now also counted, which is exactly the signal a real APM agent would
hook into later without any further code change.

The next session must update the docs after each change, then commit and push the verified change before moving on.

Input validation and write-size hardening now covers every request DTO: opening messages are
capped at the same 4,000-character limit as stored messages, conversation targets are required,
admin action names cannot be blank, and listing amenity collections are capped at 20 entries with
bounded code lengths. Listing uploads remain capped at 5 MB, are limited to 20 active photos per
listing, and reject images over 10,000 pixels on either axis or 40 megapixels overall before
re-encoding. The servlet's 6 MB file and 8 MB request backstops continue to return the standard
validation envelope. Soft-delete filtering and backup/restore validation are complete; Firestore
mirror work remains explicitly out of scope.

Database backup validation completed on 2026-09-05. A custom-format `pg_dump` was created from
the local PostGIS database and restored with `pg_restore --no-owner --exit-on-error` into a fresh
`postgis/postgis:16-3.4` scratch container. The restored database contained 12 users, 29 listings,
and 12 Flyway history rows, and `postgis_full_version()` succeeded. The scratch container was
removed after validation. The restore procedure waits for the image's init process to complete
before checking readiness; `pg_isready` alone can succeed while PostGIS initialization is still
running.

Production backup storage and retention, restore verification, immutable release
handling, migration compatibility, and the fast rollback procedure are now
documented in `docs/PRODUCTION_OPERATIONS.md`. The policy uses encrypted,
versioned offsite object storage with 35 daily, 12 weekly, and 12 monthly
retention, plus a weekly isolated restore drill. Firestore mirror work remains
out of scope.

- **Compression risk.** This is the phase most likely to be cut short, and its contents are the ones that matter most when things go wrong. Consider pulling the fuzzing review and rate limits forward if the schedule tightens.
- **The expiry window is a range, not a decision.** 60 versus 90 days is a product judgement about listing freshness.
- **Notification infrastructure may need to be earlier.** Phase 06 needs owner notifications to be genuinely usable; if that phase ships without them, moderation decisions land silently on owners. Stubbing there and completing here is fine — forgetting is not.
- **SMTP provider still needs production selection and deliverability testing.** Use `SMTP_CONFIGURATION.md` to configure `spring.mail.*`, `DARI_NOTIFICATIONS_FROM`, and `DARI_NOTIFICATIONS_ENABLED=true`; test Gmail, Outlook, and at least one Moroccan ISP before launch.
- **Restoring backups is the classic untested assumption.** Test it.
