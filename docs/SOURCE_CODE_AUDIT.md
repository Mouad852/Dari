# Dari — Source Code Audit

Independent audit of the Dari codebase as it actually runs, not as documentation describes it.
Conducted against `apps/api`, `apps/web`, `apps/mobile`, the live local PostgreSQL/PostGIS
database, Flyway migration history, and the existing test suites. TODO.md, README.md,
ARCHITECTURE.md and the `plans/` guides were used only to understand intent and terminology —
every claim below is backed by a file path, method, route, SQL query, or a command actually run
during this audit, not by what those documents assert.

Audit date: 2026-09-15/16. HEAD at time of audit: `44b2fa8` (backend/frontend findings), with a
few trivial TODO.md-only commits landing during the session (`2586be1`…`ae292b0`) that don't
affect any finding below.

---

## A. Executive summary

Dari is materially further along than a typical early-stage marketplace codebase, and the
engineering quality is genuinely high: ownership checks are structurally enforced at the
repository-query level rather than by scattered `if` statements, the image-upload pipeline
re-encodes every photo (defeating MIME-spoofing and stripping EXIF), the notification-outbox
claim path uses real `SELECT ... FOR UPDATE SKIP LOCKED` semantics, authorization annotations are
consistently applied, and the commit/TODO history shows a team that debugs from live reproduction
and writes down *why*, not just *what*. Both independently-run verification commands during this
audit — `apps/api`'s full test suite (`./mvnw test`) and `apps/web`'s production build
(`npm run build`) — passed cleanly (exit 0).

Against that baseline, this audit found one **critical, confirmed** defect: suspending a user
(whether by a moderator or the system's own auto-flagging on repeated reports) sets a database
column that is never checked anywhere in the request path. A "suspended" user is functionally
identical to an active one — they can keep signing in, publishing, and messaging — and there is no
code path in the entire backend that ever reverses a suspension, so even fixing the enforcement
gap would still leave suspended-then-cleared users stuck. This directly breaks one of the seven
core user journeys this audit was scoped to verify (moderator review and action).

Beyond that, the remaining findings are a normal, bounded set for a project at this stage: two
N+1 query patterns, one unpaginated admin endpoint, one race condition on a narrow edge case
(non-listing-scoped conversations), one SEO metadata correctness bug, and a documented
single-instance assumption in two subsystems (rate limiting, and implicitly notification
delivery) that is fine today and worth revisiting before any horizontal scaling. Mobile
(`apps/mobile`) is a real, API-integrated client — not a stub — but is explicitly and honestly
incomplete per the project's own tracking: no listing-creation flow, no filters/sort, no push
notifications, never run on a physical device.

Nothing found in this audit involved data loss, SQL injection, secret exposure, or a stack-trace
leak — the places one would expect those in a fast-moving marketplace app were specifically
checked and were solid.

---

## B. Architecture map

```
Browser (apps/web, Next.js App Router)
  │  Server Components: /, /listings, /listings/[id], /flatshare/[city]  → SSR, real generateMetadata
  │  Client Components: /account/*, /admin/*, /messages/*, /publish, SiteNav
  │
  ├─ Firebase Auth (client SDK) ── ID token (refreshed transparently, never cached by the app)
  │
  ▼
apps/web/src/lib/api.ts  ──single chokepoint──▶  Spring Boot API (apps/api)
                                                      │
                                    FirebaseAuthFilter (verifies ID token via firebase-admin,
                                    checks BANNED + soft-delete, loads/creates User, sets
                                    Spring SecurityContext with ROLE_USER/ROLE_ADMIN/ROLE_PROFILELESS)
                                                      │
                                    SecurityConfig (stateless, CORS allowlist, HSTS/frame-deny,
                                    @PreAuthorize on every mutating endpoint, /admin/** → ROLE_ADMIN)
                                                      │
                          ┌───────────────┬───────────┴───────────┬────────────────┐
                          ▼               ▼                       ▼                ▼
                   listing/*        messaging/*             moderation/*      user/*, notification/*
                   (search, CRUD,   (conversations,          (reports, admin  (profile, favorites via
                   photos, rooms,   messages, read           actions, ban/    listing/FavoriteService,
                   amenities,       receipts, unread         suspend,        outbox-based SMTP
                   house rules)     count)                   auto-flag)      delivery, ShedLock jobs)
                          │               │                       │                │
                          └───────────────┴───────────┬───────────┴────────────────┘
                                                        ▼
                                        PostgreSQL 16 + PostGIS (Flyway-owned schema,
                                        partial indexes matching the search invariant,
                                        geography(Point,4326) + generated column for search)
                                                        │
                                        Local filesystem (LocalImageStore) — S3-compatible
                                        interface, MinIO in dev, swappable in prod

apps/mobile (Expo/React Native) talks to the same API via its own hand-ported api.ts —
independent client, same contract, same auth model (Firebase ID token).
```

Key architectural decisions, verified against code (not just the design docs that state them):

- **No sessions, no cookies, no CSRF surface** — bearer-token-only, stateless (`SecurityConfig.java`). Correct given there's no server-rendered login form.
- **Public search never touches raw coordinates** — `LocationFuzzer` is applied at every response boundary (search, map, detail); real coordinates are only ever returned to the listing's own owner via `ListingService.getOwned()`, which is deliberately a separate code path from the public detail endpoint specifically to avoid fuzzed coordinates round-tripping through an edit form (documented and correctly implemented).
- **Editing a published listing forces re-moderation** (`ListingService.update()`) — a deliberate product decision (traded against "editing shouldn't reset review status") that is correctly and exclusively scoped to `PUBLISHED → PENDING_REVIEW`; drafts are unaffected.
- **Notifications are opt-in and outbox-based**, not fire-and-forget SMTP calls inline in request handlers — correct for reliability, and the claim/lock mechanism is concurrency-safe (see Finding evidence below).

---

## C. Feature verification matrix

| Feature | Status | Evidence |
|---|---|---|
| Anonymous search (city/filters/sort/map/cursor pagination) | Implemented & verified | `ListingController.search()` / `ListingSearchService`; partial indexes (`idx_listings_searchable*`) exactly match the query predicates; SSR pages fetch server-side |
| Listing detail + photos + availability | Implemented & verified | `getPublicOrOwnerListingDetail`, real `generateMetadata`, `AuthenticatedPreview` client-side retry for the owner/moderator 404 edge case |
| Firebase sign-up/sign-in + profile creation | Implemented & verified | `FirebaseAuthFilter` → `UserController.create()`; a real, live-reproduced auth-state race (`authStateReady()`) was found and fixed per `firebase.ts`'s own comments |
| Listing publishing (draft → photos → submit → moderation) | Implemented & verified | Full 6-step wizard, `ListingService` draft/photo/submit endpoints, consistent ownership checks |
| Photo upload pipeline | Implemented & verified, well-hardened | `LocalImageStore`: MIME allowlist, 5MB/10,000px/40-megapixel caps, full decode-and-re-encode (strips EXIF, defeats polyglot/MIME-spoofed files) |
| Favorites | Implemented & verified | `FavoriteService`: idempotent add/remove, race-safe via composite PK + caught `DataIntegrityViolationException`, N+1-avoided batch cover fetch |
| Messaging (contact owner, threads, read receipts, optimistic send) | Implemented & verified, two defects | `ConversationService`/`ConversationPage`; see **F1** (race on non-listing conversations) and **F2** (N+1 on inbox) |
| Reporting (listings & users) | Implemented & verified | `ReportService`: self-report rejection, per-target dedup, auto-flag at 3 distinct reporters within 7 days |
| Moderation queue (approve/reject listings) | Implemented & verified | `AdminService.approveListing/rejectListing`, illegal-transition guards, N+1-avoided cover batching |
| Moderation: dismiss/warn reports | Implemented & verified | `AdminService.actOnReports()` DISMISS/WARN branches, real notification dispatch on WARN |
| **Moderation: suspend user** | **Broken** | `UserStatus.SUSPENDED` is written by `AdminService.suspendUser()` / `ReportService.autoSuspendTarget()` but never read by `FirebaseAuthFilter` or any authorization check anywhere in the backend; `ErrorCode.ACCOUNT_SUSPENDED` exists but is never thrown. No code path ever restores `ACTIVE`. See Finding **CRIT-1**. |
| Moderation: ban user | Implemented & verified | `FirebaseAuthFilter.java:80` actually checks `BANNED`; cascades to suspending+soft-deleting owned listings and recording a `BannedIdentity` to block re-signup |
| Account edit/delete | Implemented & verified | `UserController.deleteMe()` → soft-deletes user + listings, retains messages (documented, deliberate: a conversation is two people's data) |
| Phone verification | Missing, intentionally | `NotImplementedYetException("post-MVP")`, explicitly deferred and documented — not a silent gap |
| Notification delivery (SMTP outbox) | Implemented & verified | `NotificationOutboxClaimService` uses genuine `PESSIMISTIC_WRITE` + `SKIP LOCKED`; delivery service handles retry/dead-letter with backoff; opt-in via `dari.notifications.enabled` |
| Sitemap / robots / SEO metadata | Implemented, one defect | See **F7**: `lastModified` always equals `createdAt`, a full-stack gap (`PublicListingResponse` never carries `updatedAt`) |
| Rate limiting (report/message/listing/upload/signup/search) | Implemented & verified | `RateLimitService`, correctly synchronized fixed-window; see **F4** (unbounded map growth) and the documented single-instance limitation |
| Admin user search | Implemented, not paginated | See **F3**: `AdminService.searchUsers()` loads the entire `users` table into memory |
| Web app (Next.js) | Implemented & verified | Clean `tsc --noEmit`, clean `tokens:check` (192/192 tokens resolve), clean `npm run build` (29 routes, correct SSR/SSG/static split) — all re-run independently during this audit |
| Mobile app (Expo/React Native) | Partially implemented | Real screens hitting the real API (sign-in/up, feed, listing detail, messages, profile, favorites) — not mocked. Per the project's own tracking: no filter/sort UI, no listing-creation wizard, minimal profile/settings, no push notifications, no camera/EXIF-stripped upload, no offline handling, never verified on a real device/simulator (only `expo start --web`) |
| Design-system bundle reconciliation | Not applicable to the running app | Confirmed `apps/web/src/components/ds/*` are hand-ported TSX, independent of the compiled `_ds_bundle.js` — the discrepancy the team flagged doesn't affect any live feature |
| Brand assets (logo/favicon/OG image/marketing photography) | Partially implemented | Logo wired into `SiteNav`; no favicon/`apple-touch-icon`/OG image; marketing photography scope still undecided |

---

## D. Findings

### CRIT-1 — Suspending a user has no enforced effect, and no reactivation path exists at all

- **Severity:** Critical
- **Category:** Authorization / broken moderation control
- **Description:** `UserStatus.SUSPENDED` is set by two code paths — a moderator's explicit action (`AdminService.suspendUser()`, `POST /admin/users/{id}/suspend`) and the system's own automatic flagging (`ReportService.autoSuspendTarget()`, triggered at 3+ distinct reporters within 7 days) — but is never read anywhere that governs access. `FirebaseAuthFilter.doFilterInternal()` (the single chokepoint that authenticates every request) checks only `UserStatus.BANNED` (line 80) and `deletedAt` (line 89). A full repo-wide grep for every reference to `UserStatus.SUSPENDED` outside those two write sites turns up only two idempotency guards ("already suspended, no-op") inside `AdminService`/`ReportService` themselves — nothing else in the codebase inspects it. `ErrorCode.ACCOUNT_SUSPENDED` is declared (`ErrorCode.java:14`) but never thrown by anything. Separately, `ReportService.resolvePendingReports()`'s "restore on dismissal" branch only handles `ReportTarget.LISTING` (`ReportService.java:102-111`); there is no code anywhere — automatic or via an admin endpoint — that ever sets a user's status back to `ACTIVE`. `AdminController` has `suspend` and `ban` mappings only; no `unsuspend`/`reactivate`.
- **Evidence:**
  - `apps/api/src/main/java/ma/dari/api/common/auth/FirebaseAuthFilter.java:80,89` (only BANNED/deleted checked)
  - `apps/api/src/main/java/ma/dari/api/moderation/AdminService.java:317-331` (`suspendUser`)
  - `apps/api/src/main/java/ma/dari/api/moderation/ReportService.java:149-170` (`autoSuspendTarget`)
  - `apps/api/src/main/java/ma/dari/api/common/error/ErrorCode.java:14` (declared, unused)
  - `apps/api/src/main/java/ma/dari/api/moderation/AdminController.java` (only `/suspend` and `/ban` POST mappings exist — grepped for every `@*Mapping` in the file)
  - `apps/web/src/app/admin/users/page.tsx:98-106,285-304` (UI presents "Suspendre" as a real, persistent action)
- **Impact:** A moderator (or the system itself, automatically) can believe they have restricted a problem account and have done nothing. Conversely, a user auto-suspended by three coordinated bad-faith reports has no way back to normal status even after a moderator reviews and dismisses those reports as unfounded — an unrecoverable false positive. This breaks user journey #6 (moderator reviews and acts on a report) exactly as the audit brief asked to verify.
- **Recommended solution:** (1) Add a `SUSPENDED` check to `FirebaseAuthFilter`, returning `403 ACCOUNT_SUSPENDED` the same way `BANNED` does today — decide first whether suspension should be a hard block (matches ban) or a partial restriction (e.g., read-only: can browse/message but not publish/report) since that's a product decision, not just a code fix. (2) Add a `ReportTarget.USER` branch to `resolvePendingReports()`'s restore logic, mirroring the existing `LISTING` branch, so dismissing the reports that caused an auto-suspension actually reverses it. (3) Add an explicit `POST /admin/users/{id}/reactivate` endpoint for the manual-suspension case, since not every suspension originates from reports that later get dismissed.
- **Dependencies/risks:** Requires a product decision on exactly what "suspended" should restrict (see Open Questions). Touches `FirebaseAuthFilter`, a security-critical, well-tested file — any change needs the existing `SecurityHeadersApiTest`/`AdminApiTest` suites re-run plus a new test for the suspended-user request path.
- **Verification steps:** (1) Suspend a test user via the admin console or `POST /admin/users/{id}/suspend`. (2) Confirm that user's subsequent authenticated requests are now rejected (or restricted, per the product decision) rather than succeeding. (3) Have 3 distinct accounts report a different test user, confirm auto-suspension fires, then dismiss all three reports from the admin console and confirm the user's status returns to `ACTIVE`.

### F1 — Race condition: duplicate direct-message conversations
- **Severity:** Medium | **Category:** Data integrity / concurrency
- **Description:** `ConversationService.create()` does check-then-insert without a DB-level guard for conversations that have no associated listing. `V10__messaging.sql:17-19` only creates a unique index `(listing_id, participant_a_id, participant_b_id) WHERE listing_id IS NOT NULL`. Two concurrent "message this user directly" requests for the same pair can both pass the existence check and both insert, producing two separate threads for one relationship. (The listing-scoped case is safe: `Conversation.java:98-104` canonicalizes participant order before insert, and the partial unique index covers it.)
- **Evidence:** `apps/api/src/main/java/ma/dari/api/messaging/ConversationService.java:90-94`; `apps/api/src/main/resources/db/migration/V10__messaging.sql:17-19`
- **Impact:** Confusing split conversation history for users; low security impact.
- **Recommended solution:** Add a second partial unique index for `listing_id IS NULL`, and handle the resulting constraint-violation the same way `FavoriteService.add()` already does (`catch (DataIntegrityViolationException)` — an existing, proven pattern in this same codebase).
- **Verification:** Fire two concurrent `POST /conversations` (no `listingId`) for the same user pair; confirm exactly one row exists afterward.

### F2 — N+1 query pattern in conversation inbox
- **Severity:** Medium | **Category:** Performance
- **Description:** `ConversationService.list()` → `toConversationResponse()` issues 2 extra queries per row (latest message, unread count) for up to 20 conversations per page — ~41 queries per inbox load. Inconsistent with the rest of the codebase, which explicitly avoids this (e.g. `ListingService.listMine()`'s `covers.forEach(pageRows)` batch fetch, `ListingService.java:76`).
- **Evidence:** `apps/api/src/main/java/ma/dari/api/messaging/ConversationService.java:58-59,190-208`
- **Recommended solution:** Batch-fetch latest message + unread count per conversation ID in one or two queries, same shape as `ListingCovers`.
- **Verification:** Enable SQL logging, load `/messages` with 20+ conversations, count queries before/after.

### F3 — Unbounded, unpaginated admin user search
- **Severity:** Medium | **Category:** Scalability
- **Description:** `AdminService.searchUsers()` calls `users.findAll()` and filters/sorts entirely in Java, returning the full result set — the only place in the backend that doesn't follow the `CursorPage` pattern used everywhere else.
- **Evidence:** `apps/api/src/main/java/ma/dari/api/moderation/AdminService.java:98-109`
- **Recommended solution:** Push the filter (email/name/city, case-insensitive) and status filter into a JPA query with `Pageable`.
- **Verification:** Seed >10,000 users locally, compare `/admin/users` response time before/after.

### F7 — Sitemap `lastModified` always equals listing creation date
- **Severity:** Low–Medium | **Category:** SEO correctness
- **Description:** `apps/web/src/app/sitemap.ts:51` maps `updatedAt: item.createdAt` — not a stray typo but a structural gap: the public search DTO it consumes (`PublicListing`, `apps/web/src/types/api.ts:79-96`) has no `updatedAt` field, confirmed on the backend side too (`PublicListingResponse.java:7-22` only ever carries `createdAt`). The sitemap correctly requests `sort: 'updated'` from the search endpoint but then reports a `lastModified` that never reflects real edits. This compounds with the fact that editing a published listing sends it back to `PENDING_REVIEW` (`ListingService.java:174-176`) — when it's re-approved and reappears, the sitemap still shows its original creation date, giving crawlers no signal to re-index the changed content.
- **Evidence:** `apps/web/src/app/sitemap.ts:39-58`; `apps/web/src/types/api.ts:79-96,170,188`; `apps/api/src/main/java/ma/dari/api/listing/PublicListingResponse.java`
- **Recommended solution:** Add `updatedAt` to `PublicListingResponse`/`PublicListing` (already tracked on the entity and exposed on the owner-only `ListingDetail`) and wire it through to the sitemap.
- **Verification:** Edit and re-publish a listing, regenerate the sitemap, confirm `lastModified` changes.

### F9 — ArchitectureTest's documented core safety rule isn't implemented
- **Severity:** Medium | **Category:** Test/architecture gap
- **Description:** The class Javadoc claims: *"Phase 02 adds the one that matters most: no query outside the listing package may read the `listings` table directly, so the `status = PUBLISHED AND availability_state = AVAILABLE` invariant cannot be forgotten in a new feature."* No such `@ArchTest` rule exists in the file — only two unrelated, narrower rules are present. This safety property currently holds only by convention.
- **Evidence:** `apps/api/src/test/java/ma/dari/api/support/ArchitectureTest.java:10-39`
- **Recommended solution:** Add the ArchUnit rule the comment already promises, restricting direct access to the listings entity/repository to the `listing` package.
- **Verification:** Add the rule, then add a throwaway query outside `..listing..` that reads `listings` directly and confirm the build now fails.

### F4 — Unbounded in-memory rate-limit map
- **Severity:** Low | **Category:** Resource growth
- **Description:** `RateLimitService.windows` (a `ConcurrentHashMap` keyed by `(type, dimension)`, where dimension includes client IP) never evicts entries; grows for the life of the process. The synchronization/window logic itself is correct.
- **Evidence:** `apps/api/src/main/java/ma/dari/api/common/ratelimit/RateLimitService.java:20-23`
- **Recommended solution:** Add a TTL-based eviction sweep, or move to a distributed store (Redis) — the latter is already flagged in the class's own Javadoc as the eventual path for horizontal scaling anyway.

### F5 — Minor N+1 in moderation report queue
- **Severity:** Low | **Category:** Performance
- **Description:** `AdminService.pendingReportQueue()`'s `targetLabel()`/`isAutoFlagged()` issue one query per distinct flagged target. Bounded by distinct targets, not report volume, so real-world impact is small.
- **Evidence:** `apps/api/src/main/java/ma/dari/api/moderation/AdminService.java:160-172`

### F8 — No automated image optimization for user photos
- **Severity:** Low | **Category:** Performance
- **Description:** Listing/avatar photos render via raw `<img src=...>` throughout, not `next/image`; manual `loading="lazy"`/`decoding="async"` cover the basics but there's no automatic responsive `srcset` or format negotiation (WebP/AVIF) for the heaviest asset type on the site.
- **Evidence:** e.g. `apps/web/src/app/messages/[id]/page.tsx:646-654`, consistent pattern repo-wide.

### F10 — Actuator metrics/prometheus endpoints require Firebase auth
- **Severity:** Needs product/infra input | **Category:** Observability
- **Description:** `application.yml:64-71` exposes `health,info,metrics,prometheus`, but `SecurityConfig.java:69` only `permitAll()`s `/actuator/health` and `/actuator/info`. `/actuator/prometheus` therefore requires a valid Firebase bearer token under `.anyRequest().authenticated()` — not something a standard Prometheus scraper has. Not marked as a confirmed defect since the deployment topology (internal network scrape, a separate auth proxy, etc.) isn't visible from source. See Open Questions.
- **Evidence:** `apps/api/src/main/resources/application.yml:64-71`; `apps/api/src/main/java/ma/dari/api/config/SecurityConfig.java:69`

### F6 — Phone verification endpoint not implemented (informational)
- **Severity:** Informational | **Category:** Scope
- **Description:** `POST /users/me/phone-verification` throws `NotImplementedYetException("post-MVP")` — explicitly and deliberately deferred, documented as such, not a silent gap.
- **Evidence:** `apps/api/src/main/java/ma/dari/api/user/UserController.java:105-110`

---

## E. Prioritized roadmap

### 1. Must fix before launch
- **CRIT-1**: Enforce `UserStatus.SUSPENDED` in `FirebaseAuthFilter` (or wherever the product decision lands), and add the missing USER-restore path in `ReportService.resolvePendingReports()` plus an admin reactivate endpoint. *Affected: `FirebaseAuthFilter.java`, `ReportService.java`, `AdminController.java`/`AdminService.java`, `admin/users/page.tsx`. Depends on: a product decision on what "suspended" should actually restrict. Done when: a suspended user's requests are handled per that decision, and dismissing the reports that triggered an auto-suspension restores `ACTIVE`.*
- **F1**: Close the duplicate-conversation race with a partial unique index + `DataIntegrityViolationException` handling (pattern already proven in `FavoriteService`). *Done when: two concurrent direct-message requests between the same pair never produce more than one conversation row.*

### 2. Important product and engineering improvements
- **F2**: Batch-fetch conversation list metadata to remove the N+1. *Done when: `/conversations` issues a small, fixed number of queries regardless of page size.*
- **F3**: Paginate and push filtering into the DB for `AdminService.searchUsers()`. *Done when: the endpoint accepts a cursor/page and never loads the full `users` table.*
- **F9**: Implement the ArchUnit rule the codebase's own test file already documents as necessary. *Done when: a deliberately-introduced violation fails the build.*
- **F7**: Expose real `updatedAt` on the public listing response and wire it into the sitemap. *Done when: editing and re-publishing a listing changes its sitemap `lastModified`.*

### 3. Performance, reliability, and security hardening
- **F4**: TTL-evict `RateLimitService.windows`, or migrate to a distributed store ahead of any horizontal scaling.
- **F5**: Batch `AdminService.pendingReportQueue()`'s per-target lookups if the moderation queue's target count grows materially.
- **F10**: Resolve the actuator-auth question with whoever owns the deployment topology; adjust `SecurityConfig` or the scrape mechanism accordingly.
- **F8**: Evaluate `next/image` (or an equivalent manual `srcset`) for listing/avatar photos once there's a measured page-weight concern.

### 4. Future features and optional enhancements
- Mobile app completion: filters/sort UI, listing-creation wizard, push notifications, camera upload with EXIF stripping, offline handling, real-device verification (all already tracked in the project's own TODO.md — independently confirmed accurate against the actual mobile source during this audit).
- Design-system bundle reconciliation (confirmed non-blocking for the running app; purely a tooling-ownership question).
- Brand assets: favicon/`apple-touch-icon`/OG image, marketing photography — scope still open per the user.
- F6 (phone verification) whenever the product prioritizes it.

---

## F. Test and validation gaps

- **No test exercises suspension enforcement**, which is exactly why CRIT-1 shipped unnoticed. Recommended: an integration test asserting a request from a `SUSPENDED` user's token is rejected/restricted per whatever the product decision becomes, plus a test asserting `resolvePendingReports(..., DISMISSED, ...)` on a `ReportTarget.USER` restores `ACTIVE`.
- **No test covers the non-listing conversation race** (F1). Recommended: a concurrency test firing two simultaneous `POST /conversations` for the same pair (the existing `AbstractIntegrationTest` harness already supports this style of test, per `ListingSearchOptimizationTest`'s own `@BeforeEach` patterns).
- **No architecture test enforces the search-visibility invariant** (F9) despite it being explicitly called out as the most important one — see F9 above.
- **Sitemap correctness has no test at all** — `sitemap.ts` isn't covered by any test I found; a test asserting `lastModified` tracks real update time would have caught F7.
- **Admin search has no load/pagination test** — worth a test that seeds >1 page of users and asserts the endpoint doesn't silently degrade or that pagination params are honored (once F3 is fixed).
- Backend test suite (127 tests per TODO.md, independently re-confirmed passing via `./mvnw test`, exit 0) already covers the harder, previously-flaky areas well: `LocationFuzzerTest`, `ListingSearchOptimizationTest`'s PostGIS-vs-Java-distance discrepancy, rate limiting, notification delivery/idempotency. No further gap identified there beyond the two items above.

---

## G. Open questions

1. **What should "suspended" actually restrict?** A hard block (same as ban, but reversible) or a partial restriction (e.g., read-only — can browse/message existing threads but not publish or send reports)? This determines the exact fix for CRIT-1 and isn't something source code alone can answer.
2. **How is `/actuator/prometheus` scraped in production today**, given it currently requires a Firebase bearer token under `SecurityConfig`? (F10)
3. **Is horizontal scaling of the API planned pre- or post-launch?** `RateLimitService` is explicitly single-instance-only by design; worth knowing the timeline before it becomes load-bearing.
4. **Design-system bundle reconciliation** — who owns the build tooling for `design-system/`'s compiled bundle, and does it need reconciling with its `.jsx` sources at all, given the running app doesn't consume it? (Team's own open question, confirmed non-blocking for runtime behavior during this audit.)
5. **Brand/marketing photography scope** — is a favicon/OG image the only remaining need, or is real marketing photography also required before launch? (Open per the user as of the last session.)
