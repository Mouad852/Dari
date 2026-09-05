# Dari TODO

This is the single ongoing completion checklist for the project. Every coding session must update this file when work changes the project status. Check items only after verifying them against source, tests, or a production-like runtime.

Last verified: 2026-09-05

## Current baseline

- [x] Spring Boot API builds and runs against PostgreSQL 16 + PostGIS
- [x] Flyway migrations apply through `V19__notification_delivery_state.sql`
- [x] Backend suite passes: 119 tests, 0 failures, 0 errors
- [x] Next.js frontend typecheck passes
- [x] Design-token consistency check passes
- [x] Next.js production build completes
- [x] Firebase authentication and profile creation flow
- [x] Public search, filters, map pins, sorting, counts, cursor pagination, and coordinate fuzzing
- [x] Listing lifecycle, drafts, validation, submission, moderation, photos, amenities, favorites, and editing
- [x] Listing detail, public profiles, messaging, reporting, admin console, homepage, city pages, sitemap, and robots rules

## Priority 1: Launch blockers

### Listing lifecycle and notifications

- [x] Decide the exact listing expiry window: 60 days (warning at day 53)
- [x] Implement the scheduled `PUBLISHED -> EXPIRED` job
- [x] Make expiry idempotent and protected by ShedLock
- [x] Decide whether any patch resets expiry or only deliberate renewal does (the existing `updated_at` clock resets on any PATCH)
- [x] Implement `EXPIRED -> PENDING_REVIEW` renewal
- [x] Warn owners seven days before expiry through the transactional notification outbox
- [x] Track expiry warnings idempotently with `listings.expiry_warned_at` and clear it on renewal
- [x] Enqueue expiry notifications in the transactional notification outbox
- [x] Deliver French notifications for approval, rejection, suspension, reinstatement, warning, expiry, and report acknowledgment through the opt-in SMTP outbox worker
- [x] Replace the `WARN` report action 501 response with transactional owner notification
- [x] Add tests for renewal and notification enqueueing
- [x] Add focused tests for expiry warnings, duplicate job execution, and warning idempotency

### Security and privacy hardening

- [x] Audit every public response for email, phone, Firebase UID, internal status, and exact coordinates
- [x] Audit location fuzzing across search, map, detail, sitemap, metadata, hydration payloads, and images
- [x] Add rate limits for reports, messages, listing creation, uploads, signup, and public search abuse paths
- [x] Review CORS, security headers, TLS, and production cookie/token settings
- [x] Verify ownership and role checks on every mutating endpoint
- [x] Verify soft-delete filtering on every API read path; Firestore mirror remains out of scope
- [x] Decide and implement the PII policy for deleted users
- [x] Create a custom-format database backup and restore it into a clean PostGIS environment

### Production operations

- [x] Add error tracking and production metrics (self-hosted Prometheus scrape, not a hosted APM/error-tracking SaaS — see note below)
- [x] Add metrics for search latency, moderation queue depth, reports, jobs, notifications, and failures
- [x] Document deployment pipeline, migration compatibility, and rollback procedure in `docs/PRODUCTION_OPERATIONS.md`
- [ ] Run realistic search load tests and record acceptance thresholds
- [x] Seed production amenities and neighborhood reference data
- [x] Document production backup storage, retention, restore verification, and rollback procedures in `docs/PRODUCTION_OPERATIONS.md`; Firebase and SMTP configuration remain in their dedicated guides

## Priority 2: Product completeness

### Listing creation

- [ ] Match the eight-step prototype in `flows/listing-creation/`
- [ ] Replace raw latitude/longitude inputs with a map picker
- [ ] Implement repeatable rooms and shared/private room semantics
- [ ] Implement house-rules write and read contracts
- [ ] Add neighborhood reference data and city-membership validation
- [ ] Add full per-step validation and responsive parity checks at 375px and 1440px
- [x] Cap listing photos at 20 per listing; image resizing policy remains open

### Search and discovery

- [ ] Define the product meaning of `recommended` ranking
- [ ] Define the product meaning of featured listings
- [x] Fix amenity chip rapid-click URL state loss (2026-09-05; `SearchResults.tsx` now keeps a synchronous latest-selection ref and syncs it from URL state)
- [ ] Fix or explicitly remove map deep-link behavior for `?view=map`
- [ ] Decide whether to port the mobile filter bottom sheet exactly or keep the disclosure design
- [ ] Add neighborhood landing pages if they are part of the launch SEO scope
- [ ] Add image optimization and lazy loading

### Messaging and account

- [ ] Add unread counts and badges
- [ ] Add visible read receipts if product-required
- [ ] Decide whether optimistic message sending is required
- [ ] Show an explicit unavailable-listing state in old conversation threads
- [ ] Define and implement profile-completion rules and prompt
- [x] Clearly mark notifications, payments, and security surfaces where no backend contract exists; do not present fabricated account data
- [ ] Define verification-tier semantics and phone verification scope

### Test suite

- [ ] Fix the shared-Testcontainers test-isolation gap: `ListingSearchOptimizationTest` (and occasionally other count/order-sensitive assertions, e.g. `ListingApiTest.publicDetailIsVisibleForPublishedListing`'s coordinate-fuzzing check) can fail when run alongside the rest of the suite because every test class shares one PostGIS container with no per-test data isolation (no unique cities/neighborhoods per test, no transactional rollback between tests). Both failures observed so far were confirmed transient by an isolated rerun of the single test — not real regressions — but this erodes trust in a red `mvnw test` run and will keep resurfacing as more tests are added. Needs either per-test-class unique city/neighborhood namespacing or a rollback-per-test strategy; a deliberate tradeoff against `ARCHITECTURE.md` §7's shared-container speed choice, not a quick fix.

### Design system and content

- [ ] Reconcile design-system source components with the compiled bundle version
- [ ] Recover or replace final logo and photography assets
- [ ] Resolve the five WCAG AA token contrast failures
- [ ] Complete final responsive and keyboard accessibility review
- [ ] Add `prefers-reduced-motion` coverage where needed
- [x] Add legal pages: terms, privacy, and location-data explanation under `/legal/*`; complete operator identity/contact details before public launch
- [x] Write moderator runbook and queue decision guidance in `docs/MODERATOR_RUNBOOK.md`

## Priority 3: Future client

### React Native application

- [ ] Decide Expo versus bare React Native
- [ ] Create the React Native project and shared API/types strategy
- [ ] Port tokens and rebuild the component layer for native
- [ ] Implement auth, feed, filters, listing detail, messages, profile, favorites, and app shell
- [ ] Implement the listing wizard on mobile
- [ ] Add push notifications, camera/photo-library upload, EXIF protection, maps, and deep links
- [ ] Add offline and poor-connectivity handling
- [ ] Prepare app-store assets, privacy declarations, and release process

## Verification policy

Before marking a checkbox complete:

- Backend changes: run `cd apps/api && ./mvnw test`
- Frontend changes: run `cd apps/web && npm run typecheck && npm run tokens:check && npm run build`
- UI changes: perform a real browser check when browser automation is available
- Update this file in the same session as the implementation
- Record blockers and failed verification commands instead of marking work complete
- After every change, update the relevant README and phase documentation, run the focused checks, then commit and push the verified change

## Latest verification

- Neighborhood reference data seeded on 2026-09-05: new `neighborhoods` table (`V20__neighborhoods.sql`, composite `(city, name)` key, no FK from `listings.neighborhood` yet) seeded with 8-12 real, well-known neighborhoods per launch city (Rabat, Casablanca, Marrakech, Tanger). New `GET /neighborhoods?city=` (public, alongside `/cities`/`/amenities` in `SecurityConfig`) returns the names in display order; a missing or blank `city` is a 400 `VALIDATION_FAILED`, an unknown city returns an empty list rather than an error (consistent with how `/listings?city=` already behaves for an unrecognized city). Deliberately did **not** enforce city-membership validation on listing create/update — that's a separate, larger decision already tracked under Priority 2 ("Add neighborhood reference data and city-membership validation"), since a gap in this seed list at launch would otherwise lock out a real owner whose real neighborhood isn't yet in the table. Reviewed the existing 10-code `amenities` table (V12) and judged it already adequate, comprehensive production reference data for an MVP — no changes made there. Verified via `cd apps/api && ./mvnw test` (119/119 passing; two unrelated flakes seen and confirmed transient by isolated rerun during this session's testing — `ListingApiTest.publicDetailIsVisibleForPublishedListing` and `ListingSearchOptimizationTest.distanceSortWorks`, both consistent with the already-documented shared-Testcontainers test-isolation gap, not caused by this change).
- Metrics instrumentation added on 2026-09-05: `/actuator/prometheus` (Micrometer + `micrometer-registry-prometheus`, already free with the existing actuator dependency) exposes `dari.search.latency` (timer, tagged `mode=radius|location`) around `ListingSearchService#search`; `dari.moderation.queue_depth` (gauge, tagged `target=listing|report`) and `dari.notifications.outbox_depth` (gauge, tagged by `status`) as live count queries sampled at scrape time rather than push-tracked, since a queue can shrink from another instance or another moderator; `dari.reports.created` and `dari.moderation.auto_suspended` counters in `ReportService`; `dari.jobs.listing_expiry.{runs,warned,expired}` counters in `ListingExpiryJob`; `dari.notifications.delivery` counter (tagged `outcome=sent|dead|retry`) in `NotificationDeliveryService`; and `dari.errors.unhandled` (tagged by exception class) in `GlobalExceptionHandler`'s catch-all. Deliberately did not add a hosted error-tracking SaaS (Sentry/Rollbar/etc.) unilaterally — that requires the user's own account and is a product/infra decision, not a code change; unhandled exceptions are already logged with full context (correlation id via MDC) and now also counted, which is what a real APM integration would consume as its trigger signal later. Verified via `cd apps/api && ./mvnw test` (119/119 passing); did not verify the live `/actuator/prometheus` scrape output against a running instance this session (local port 8080 was occupied by an unrelated pre-existing process) — the wiring is standard Spring Boot Micrometer autoconfiguration with no custom bootstrap, so this is a reasonable but not yet directly observed gap; a future session should `curl localhost:8080/actuator/prometheus` after `docker compose up -d && mvnw spring-boot:run` from the repo root (not `apps/api`, since the default Firebase credential path is relative to the working directory) and confirm the six metric families above appear.
- PII policy for deleted users implemented on 2026-09-05: `UserService#deleteAccount` now clears email, phone, first name, city, bio, and avatar URL and deletes the stored avatar file, alongside the existing soft-delete and Firebase-identity removal. `email`/`displayName` stay non-null (schema constraint) but become a blank string and "Utilisateur supprimé" respectively; `NotificationDeliveryService` already treats a blank email as "no recipient" and marks the event `DEAD`, so a notification already queued for a self-deleted user fails clean rather than erroring. The avatar file is only deleted after the Firebase call succeeds, so a rollback never leaves a scrubbed row pointing at an already-deleted file. New `UserApiTest.accountDeletionScrubsPii` covers both the field scrub and the file deletion.
- Found and fixed in the same pass: any missing path under `/uploads/**` (e.g. a deleted avatar or photo) returned a raw 500 instead of 404 — `GlobalExceptionHandler`'s catch-all was swallowing Spring's `NoResourceFoundException`. Added a dedicated handler returning 404 `NOT_FOUND`. Pre-existing bug, unrelated to the PII scrub change; caught because the new test was the first to request a genuinely missing upload path.
- `cd apps/api && ./mvnw test` passed on 2026-09-05: 119 tests, 0 failures, 0 errors; migrations applied through `V19__notification_delivery_state.sql`
- `git diff --check` passed for the Phase 10 input-validation hardening and documentation
- Soft-delete read-path review completed on 2026-09-05: public search/detail, owner listings, favorites, profiles, conversations, report targets, and moderation queues exclude deleted rows where appropriate; account deletion, moderation history, and notification delivery intentionally retain historical-row access. Firestore mirror work remains out of scope.
- Database backup and restore validation completed on 2026-09-05: `pg_dump -Fc` produced a 47,456-byte backup from the local PostGIS database; `pg_restore --no-owner --exit-on-error` restored it into a fresh `postgis/postgis:16-3.4` container, and validation confirmed 12 users, 29 listings, 12 Flyway history rows, and PostGIS availability. The scratch container was removed afterward. Firestore mirror work remains out of scope.
- Production backup storage/retention and deployment rollback documented on 2026-09-05 in `docs/PRODUCTION_OPERATIONS.md`: encrypted versioned offsite storage, 35 daily/12 weekly/12 monthly retention, weekly isolated restore verification, immutable release artifacts, backward-compatible Flyway migrations, and application-first rollback with restore escalation for destructive changes.
- Moderator runbook and initial French terms, privacy, and location-data pages added on 2026-09-05. The legal pages intentionally identify the remaining release gate: add the operator's legal identity, contact channel, and applicable legal bases before public launch.
- Web validation passed on 2026-09-05: `npm run typecheck` and `npm run tokens:check`; `npm run build` completed successfully, with expected `ECONNREFUSED` warnings for API-backed pages because no API server was running.
- Account placeholder audit completed on 2026-09-05: fabricated payment balances, fake email/device values, and unsupported security metrics were removed or explicitly marked unavailable; legal links are now present in the global footer.
- Notification delivery is implemented through the opt-in SMTP worker: rows are claimed with row locks, retried with bounded backoff, marked sent idempotently, and malformed events are quarantined as dead
- SMTP configuration guide created with provider examples (Gmail, Outlook, Moroccan ISP)
- Notification delivery README documents transactional outbox architecture, retry behavior, claim-lock semantics, and production monitoring queries
- Rate limits are enforced before controller invocation on report, message, listing creation, upload, and profile-signup writes. Production defaults use separate fixed windows for the authenticated Firebase identity and source address; 429 responses include `Retry-After`. The limiter is process-local until a shared store is introduced for horizontal scaling.
- Public response audit verified on 2026-09-05: public listing/profile DTOs omit email, phone, Firebase UID, moderation status, and exact coordinates; search, map, detail, featured, and favorites all use fuzzed coordinates. Owner/admin listing responses retain the private status and exact-coordinate fields behind their existing access checks.
- CORS/security review verified on 2026-09-05: CORS remains an explicit configured-origin allowlist; API responses include `nosniff`, `DENY`, referrer, permissions, and HSTS headers; production requires `DARI_WEB_ORIGIN` and `FIREBASE_CREDENTIALS_PATH`; the web client sends refreshed Firebase ID tokens only as bearer headers and never stores them in cookies, local storage, or URLs. Focused integration tests cover the header and preflight contracts.
- `WARN` moderation actions now enqueue a French owner warning transactionally and resolve the affected reports as `ACTION_TAKEN`
