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
- [x] Rate limits on the abuse-prone routes: report creation, message sending, listing creation, uploads, signup
- [x] **A dedicated review of location fuzzing across every endpoint**, including map, search, detail and any admin route that might be reachable publicly. One leak makes the whole scheme decorative.
- [x] Audit every response DTO for private-field leakage — email, phone, exact coordinates, internal status, `firebase_uid`
- [ ] Confirm soft-delete is honoured everywhere, including the Firestore mirror if it exists
- [ ] Input validation and size limits across all write paths
- [ ] CORS, security headers, TLS
- [ ] Verify ownership and role checks on every mutating route, systematically rather than by memory

**Operations**
- [ ] Structured logging with correlation ids; error tracking
- [ ] Metrics on the things that indicate trouble: search latency, moderation queue depth, report volume, mirror drift
- [ ] Database backups, and **a restore actually tested** rather than assumed
- [ ] Deployment pipeline, migration strategy, rollback plan
- [ ] Load test on the search path, which is the busiest and most complex query in the system
- [ ] Seed the production amenity lookup and neighborhood lists as real reference data

**Launch readiness**
- [ ] End-to-end pass over the whole journey, twice: as a seeker and as an owner
- [ ] Moderator runbook — what to do with each queue item type
- [ ] Legal pages: terms, privacy, an accurate statement of what is done with location data
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

Rate limits are enforced by a Spring MVC interceptor before controller invocation. Report creation,
conversation/message writes, listing creation, listing photo uploads, avatar uploads, and profile
signup are annotated explicitly. Each policy has independent fixed-window buckets for the Firebase
identity and source address, and a rejected request returns the normal error envelope with HTTP 429
and `Retry-After`. Defaults are configurable through `DARI_RATE_LIMIT_*` environment variables:
reports 5/hour, messages 30/minute, listings 5/hour, uploads 20/hour, and signup 5/hour.
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

The next session must update the docs after each change, then commit and push the verified change before moving on.

- **Compression risk.** This is the phase most likely to be cut short, and its contents are the ones that matter most when things go wrong. Consider pulling the fuzzing review and rate limits forward if the schedule tightens.
- **The expiry window is a range, not a decision.** 60 versus 90 days is a product judgement about listing freshness.
- **Notification infrastructure may need to be earlier.** Phase 06 needs owner notifications to be genuinely usable; if that phase ships without them, moderation decisions land silently on owners. Stubbing there and completing here is fine — forgetting is not.
- **SMTP provider still needs production selection and deliverability testing.** Use `SMTP_CONFIGURATION.md` to configure `spring.mail.*`, `DARI_NOTIFICATIONS_FROM`, and `DARI_NOTIFICATIONS_ENABLED=true`; test Gmail, Outlook, and at least one Moroccan ISP before launch.
- **Restoring backups is the classic untested assumption.** Test it.
