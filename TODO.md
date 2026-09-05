# Dari TODO

This is the single ongoing completion checklist for the project. Every coding session must update this file when work changes the project status. Check items only after verifying them against source, tests, or a production-like runtime.

Last verified: 2026-09-05

## Current baseline

- [x] Spring Boot API builds and runs against PostgreSQL 16 + PostGIS
- [x] Flyway migrations apply through `V18__listing_expiry_warning.sql`
- [x] Backend suite passes: 102 tests, 0 failures, 0 errors
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
- [ ] Deliver French notifications for approval, rejection, suspension, reinstatement, warning, expiry, and report acknowledgment
- [ ] Replace the `WARN` report action 501 response once notification delivery exists
- [x] Add tests for renewal and notification enqueueing
- [x] Add focused tests for expiry warnings, duplicate job execution, and warning idempotency

### Security and privacy hardening

- [ ] Audit every public response for email, phone, Firebase UID, internal status, and exact coordinates
- [ ] Audit location fuzzing across search, map, detail, sitemap, metadata, hydration payloads, and images
- [ ] Add rate limits for reports, messages, listing creation, uploads, and signup abuse paths
- [ ] Review CORS, security headers, TLS, and production cookie/token settings
- [ ] Verify ownership and role checks on every mutating endpoint
- [ ] Verify soft-delete filtering on every read path
- [ ] Decide and implement the PII policy for deleted users
- [ ] Test backup creation and restore into a clean environment

### Production operations

- [ ] Add error tracking and production metrics
- [ ] Add metrics for search latency, moderation queue depth, reports, jobs, notifications, and failures
- [ ] Create deployment pipeline and migration rollback procedure
- [ ] Run realistic search load tests and record acceptance thresholds
- [ ] Seed production amenities and neighborhood reference data
- [ ] Document production secrets, storage, Firebase, database, and rollback procedures

## Priority 2: Product completeness

### Listing creation

- [ ] Match the eight-step prototype in `flows/listing-creation/`
- [ ] Replace raw latitude/longitude inputs with a map picker
- [ ] Implement repeatable rooms and shared/private room semantics
- [ ] Implement house-rules write and read contracts
- [ ] Add neighborhood reference data and city-membership validation
- [ ] Add full per-step validation and responsive parity checks at 375px and 1440px
- [ ] Decide maximum photo count and image resizing policy

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
- [ ] Replace static notifications page with a real contract or clearly mark it unavailable
- [ ] Replace static payments page with a real contract or clearly mark it unavailable
- [ ] Replace static security page with a real contract or clearly mark it unavailable
- [ ] Define verification-tier semantics and phone verification scope

### Design system and content

- [ ] Reconcile design-system source components with the compiled bundle version
- [ ] Recover or replace final logo and photography assets
- [ ] Resolve the five WCAG AA token contrast failures
- [ ] Complete final responsive and keyboard accessibility review
- [ ] Add `prefers-reduced-motion` coverage where needed
- [ ] Add legal pages: terms, privacy, and location-data explanation
- [ ] Write moderator runbook and queue decision guidance

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

## Latest verification

- `cd apps/api && ./mvnw test` passed on 2026-09-05: 102 tests, 0 failures, 0 errors
- `git diff --check` passed for the expiry-warning implementation and documentation
- Notification delivery remains open: warning and expiry events are persisted in the outbox, but no email or in-app transport consumes it yet
