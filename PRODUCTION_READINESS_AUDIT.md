# Dari — Production Readiness Audit & Implementation Plan

**Audit date:** 2026-09-21 · **Commit:** `35a8dac` · **Branch:** `master`
**Mode:** read-only. No source, config, migration, dependency or document was modified.

## Context

Dari is a Moroccan colocation (flat-share) marketplace: a Spring Boot 3.5.6 / Java 21 API on
PostgreSQL 16 + PostGIS, a Next.js App Router web app, an Expo React Native app, and a shared
design system. It is feature-complete enough to look launchable, and the engineering quality of the
core domain is genuinely high. It has never been deployed.

This audit answers one question: **what is the smallest set of changes required for Dari to safely
serve real users?** Everything below is tied to a file and line in this repository. Where I could
not confirm something, it says "cannot verify" rather than guessing.

### Pre-existing uncommitted work (preserved, untouched)

| Path | State | Note |
|---|---|---|
| `apps/api/src/test/java/ma/dari/api/user/UserApiTest.java` | modified | Left alone. The local surefire run below may reflect this modified version. |
| `docs/AUDIT_FIX_PLAN.md` | untracked | An earlier fix plan of yours. Read for context only; **not** overwritten. See "Relationship to the previous audit". |

### Relationship to the previous audit

`docs/SOURCE_CODE_AUDIT.md` (2026-09-16) and `docs/AUDIT_FIX_PLAN.md` cover overlapping ground. I
re-verified each of their findings rather than restating them:

| Prior finding | Status now | Evidence |
|---|---|---|
| CRIT-1 SUSPENDED not enforced, no reactivation | **Fixed** | `FirebaseAuthFilter.java:82-106` blocks every mutating verb for SUSPENDED; `AdminService.java:392` unsuspend + audit row |
| F1 Duplicate DM conversation race | **Fixed** | `V23__conversations_unlisted_pair_unique.sql`; normalized pair `ConversationService.java:264-270`; `insertIfAbsent` ON CONFLICT `ConversationRepository.java:21-25`; race caught at `ConversationService.java:119-124` |
| F3 Unbounded admin user search | **Fixed** | paginated at 20, `AdminService.java:111,119-120` |
| F7 Sitemap `lastModified` = createdAt | **Fixed** | `ListingSearchRepository.java:24` selects `updated_at`; `ListingSearchService.java:386` |
| F9 Missing ArchUnit rule | **STILL OPEN** | see P1-8 |
| F4 Unbounded in-memory rate-limit map | **STILL OPEN, and worse than described** | see P0-7 |
| F10 Actuator metrics behind Firebase auth (deferred) | **STILL OPEN** | see P1-1; the profileless-token angle is new |
| F2 / F5 N+1 (inbox, report queue) | **STILL OPEN**, bounded | see P2 |

---

# A. Executive Summary

**What is genuinely strong.** The domain core is better than most pre-launch codebases. Public
search cannot see a non-published listing because it queries a view, not the table
(`V25__refresh_published_listings_view.sql`). Exact coordinates cannot reach a public DTO by
accident, because every public response *constructor* demands a pre-fuzzed `double[]`
(`PublicListingResponse.java:33`, `MapPinResponse.java:13`, `PublicListingDetailResponse.java:45`).
Photo uploads are decoded and re-encoded to JPEG, which strips EVERY EXIF GPS tag as a side effect of
the pipeline rather than as a step someone could forget (`ImageProcessor.java:41-51`). The
notification outbox claims rows with `FOR UPDATE SKIP LOCKED` and is therefore already
multi-instance safe (`NotificationOutboxRepository.java:17-27`). Account deletion scrubs PII rather
than only setting a flag (`UserService.java:165-175`). Ownership is checked server-side on every
mutating path, with 404-not-403 semantics so there is no existence oracle. There is real CI: four
workflows including Testcontainers-backed PostGIS tests, CodeQL, Dependency-Check and Playwright.
147 API tests passed locally today, 0 failures, 0 skips. **None of this needs rewriting.**

**What prevents launch.** Nothing in the list below is a design flaw; they are all gaps between
"works on the developer's machine" and "runs in production".

1. **The 200 m location fuzz is reversible by anyone.** The offset is seeded from the listing's own
   public UUID through `java.util.Random`, with no secret (`LocationFuzzer.java:18-22`). Four lines
   of code recover every listing's exact address. This is the product's central privacy promise and
   it currently provides no protection against anyone who reads this file.
2. **There is no way to deploy it.** No Dockerfile, no `.dockerignore`, no PaaS/IaC config, no
   deployment section in `README.md`. The backup runbook's own commands target the *development*
   compose container (`docker exec dari-db`, `docs/PRODUCTION_OPERATIONS.md`).
3. **Email notifications will silently not work.** Delivery is `@ConditionalOnProperty(...enabled,
   havingValue="true")` and defaults to `false`; `application-production.yml` never sets it; and no
   `application*.yml` contains a `spring.mail` block at all — that YAML exists only inside
   `SMTP_CONFIGURATION.md`. Enqueueing is unconditional, so the outbox fills up with undelivered
   moderation outcomes and expiry warnings.
4. **Account deletion does not delete the person's avatar in production storage**, and in S3 mode
   the revocation interceptor is bypassed entirely, so the file stays publicly fetchable
   (`UserService.java:126`, `ImageStore.java:27-29`).
5. **Listing expiry cannot fire.** Writing the "expiring soon" marker triggers `@PreUpdate`, which
   rewrites the very `updated_at` the expiry predicate tests (`Listing.java:163-165` vs
   `ListingRepository.java:20`). Every warned listing becomes immortal.
6. **Rate limiting is bypassable in production.** `forward-headers-strategy: framework` makes
   `getRemoteAddr()` return a client-controlled `X-Forwarded-For`, and each forged value allocates a
   new map entry, so the only abuse control is both defeatable and a memory-growth vector.

**Biggest security risks:** the reversible fuzz (privacy compromise of every listing address); the
image decode-before-limit OOM (`ImageProcessor.java:33-38` — a 5 MB PNG can allocate gigabytes
*before* the megapixel check runs); rate-limit bypass; `/actuator/prometheus` readable by any
authenticated token including one with no Dari profile.

**Biggest operational risks:** no deployment artifact; no automated backup (a thorough written
policy, zero automation, and the only scripts are PowerShell); no graceful shutdown, readiness or
liveness configuration; no query or connection timeouts anywhere; no error tracking, deliberately.

**Biggest mobile risks:** the production EAS profile injects no environment, so a production build
either refuses to boot ("Configuration requise") or points at `http://localhost:8080`; there is no
EAS `projectId`, so `eas build` cannot run at all; there is no Google Maps Android API key, so the
Carte tab is blank on Android release builds; and the app asks users for notification permission for
a push system that does not exist on either end.

**Honest position:** the API's domain logic is close to launch-ready. The *operational envelope*
around it — deploy, backup, config validation, storage parity, abuse control — is not started. Web
is close. Mobile is a working prototype that cannot currently produce a shippable binary. A
**web-only launch is a realistic near-term goal**; shipping mobile in the same window is not.

---

# B. Verified Architecture

Verified by reading the sources, not the documentation.

**API** — `apps/api`, Spring Boot 3.5.6, Java 21 (`pom.xml:15-27`). Modular monolith, one package
per domain: `listing`, `messaging`, `moderation`, `notification`, `user`, `media`, plus `common`
(auth, error, pagination, ratelimit, logging, jpa). 7 controllers, 25 Flyway migrations
(`V1`→`V25`; `V5`–`V7` do not exist — a renumbering, harmless for a fresh database and covered by
`FlywayMigrationSmokeTest`). Hibernate is `ddl-auto: validate`; Flyway owns the schema
(`application.yml:16`). PostGIS `geography(Point,4326)` is a **generated** column so it cannot drift
from lat/lng (`V3__listings_slice.sql`), with a GiST index.

**Auth** — no Dari login exists by design. Clients authenticate against Firebase and send the ID
token; `FirebaseAuthFilter` verifies it via the Admin SDK and resolves the local `users` row,
enforcing BANNED → 403, SUSPENDED → read-only, soft-deleted → 401 at the filter, before any
controller runs (`FirebaseAuthFilter.java:66-115`).

**Web** — `apps/web`, Next.js App Router + TypeScript, Firebase JS SDK, Playwright + axe e2e.

**Mobile** — `apps/mobile`, Expo SDK 57 + expo-router, Firebase JS SDK with
`getReactNativePersistence(AsyncStorage)` (`src/lib/firebase.ts:63`), `react-native-maps`.

**Storage** — `ImageStore` interface with two adapters selected by `dari.media.provider`:
`LocalImageStore` (disk, served by Spring at `/uploads/**`) and `S3ImageStore` (hand-rolled SigV4
over `java.net.http.HttpClient`). A durable `media_cleanup` outbox handles deletion with retry.

```
                    ┌──────────── Firebase Auth (Google) ────────────┐
                    │  ID token issued to browser / device            │
                    ▼                                                 ▼
  Browser ──HTTPS──> Next.js (apps/web)  ──Bearer token──> Spring Boot API (apps/api)
                         │ Server Components                   │  :8080
                         └── server-side fetch ────────────────>│
                                                                │
  Expo app ──HTTPS──────── Bearer token ────────────────────────>│
                                                                │
                            ┌───────────────────────────────────┼──────────────────┐
                            ▼                  ▼                ▼                  ▼
                  PostgreSQL 16 +      object storage      SMTP provider     /actuator/*
                     PostGIS           (S3-compatible       (NOT WIRED:      health,info = public
                  (Flyway, views,       or local disk)       no spring.mail)  metrics,prometheus
                   GiST, enums)                                              = any logged-in user
                            │
                   scheduled jobs in-process:
                   listing expiry (ShedLock) · notification outbox (SKIP LOCKED)
                   media cleanup (NO lock) · rate-limit eviction (process-local)

  NOT PRESENT: container image, deployment target, reverse proxy config, CDN config,
               backup automation, error tracking, push notification backend.
```

---

# C. Existing Strengths — do not rewrite these

| Strength | Evidence |
|---|---|
| Public visibility invariant enforced in the **schema**, not in query code | `V4`/`V25__refresh_published_listings_view.sql` — every public search reads `published_listings`, which hard-codes `PUBLISHED + AVAILABLE + deleted_at IS NULL`. V25 also fixes the classic `SELECT *` view-freeze bug deliberately. |
| Coordinate fuzzing is a **chokepoint by type signature** | Public DTO factories require `double[] fuzzed`: `PublicListingResponse.java:33`, `MapPinResponse.java:13`, `PublicListingDetailResponse.java:45`. Owner/moderator DTO is a separate type with unfuzzed values and says so (`ListingResponse.java:19`). All 9 call sites pass `LocationFuzzer.fuzz(...)`. |
| EXIF/GPS stripping is a **side effect of the pipeline** | `ImageProcessor.java:41-51` / `LocalImageStore.java:78-88` redraw into a fresh `TYPE_INT_RGB` buffer and re-encode as JPEG. Avatars use the same path on purpose (`ImageStore.java:15-23`). |
| Outbox claiming is multi-instance safe | `NotificationOutboxRepository.java:17-18` — `@Lock(PESSIMISTIC_WRITE)` + `jakarta.persistence.lock.timeout = -2` = `FOR UPDATE SKIP LOCKED`. Stale `SENDING` rows are reclaimed after `stale-after-minutes`. |
| Notification enqueue is atomic with the business change | `OutboxNotificationService` methods are `@Transactional` and called inside the moderation/expiry transaction (`ListingExpiryJob.java:37-46`). |
| Conversation creation race closed at the database | Normalized participant pair (`ConversationService.java:264-270`), unique partial indexes (`V10`, `V23`), `insert ... on conflict do nothing` (`ConversationRepository.java:21-25`), lost-race re-read (`ConversationService.java:119-124`). |
| No SQL injection, including dynamic sort | Every native query binds parameters; the dynamic `ORDER BY` is `CASE WHEN CAST(:sort AS text) = '…'` rather than interpolation (`ListingSearchRepository.java:78-85`), and `:sort` is allow-listed twice (`ListingSearchValidation.java:47-52`, `ListingSearchService.java:563-576`). |
| Search input validation is thorough | `ListingSearchValidation.java` — radius 1–50 000 m, finite lat/lng in range, price range ordering, enum and amenity allow-lists, mutually-exclusive city/radius. |
| Every page is keyset-paginated and bounded | PAGE_SIZE 20 across search/favorites/conversations/owner listings; map pins capped at 1000; featured clamped to 1–12; count capped at 200. |
| Malformed cursors always 400, never 500 | `Cursor.java:42-49` catches `Exception` (covers the `ClassCastException` for a non-object payload); every field re-validated in `TypedCursors.java`. |
| Error envelope never leaks internals | `GlobalExceptionHandler.java:148-160` catch-all returns a fixed French string and logs the exception; `server.error.include-stacktrace: never`, `management.endpoint.health.show-details: never`, `org.hibernate.SQL: WARN`. |
| Account deletion scrubs PII and is transactionally safe | `UserService.java:108-149` + `:165-175`. Firebase deletion inside the transaction so a failure rolls the scrub back — the reasoning is documented at `:100-105`. |
| Soft-deleted users release their email | `V14__soft_deleted_users_release_email.sql` scopes the unique index to live rows, while `banned_identities` keeps its own copy so bans survive. |
| Correlation IDs in MDC and on the response | `CorrelationIdFilter.java` at `HIGHEST_PRECEDENCE`, log pattern includes `%X{correlationId}` (`application.yml:137`). |
| Operational metrics already exist | `MetricsConfig.java:47-78` — moderation queue depth, outbox depth by status, media-cleanup depth and failure count, as scrape-time gauges. |
| Real CI, including the hard parts | `.github/workflows/api-tests.yml` (full PostGIS Testcontainers suite + a dedicated migration smoke job), `client-quality.yml` (typecheck, tokens, lint, production build with the env gate live), `e2e.yml` (Playwright + axe), `security.yml` (npm audit, OWASP Dependency-Check failing at CVSS 7, dependency-review, CodeQL for both languages). |
| Legal pages cannot ship with placeholders | `docs/LEGAL_RELEASE.md` + `apps/web/src/lib/legal.ts` — the production build fails unless every `DARI_LEGAL_*` value is supplied. |
| Mobile offline behaviour is real, not decorative | AsyncStorage read-through cache keyed on the filter set, live offline banner, pre-flight connectivity checks, draft preservation, cursor recovery, optimistic rollback (`apps/mobile/app/(tabs)/index.tsx:40-69`, `app/messages/[id].tsx:106-116`). |
| Mobile auth persistence is correct | `src/lib/firebase.ts:63` `getReactNativePersistence(AsyncStorage)`, and `getIdToken()` awaits `authStateReady()` first (`:79-81`) — the race most RN Firebase ports ship with. |
| Local test evidence | `apps/api/target/surefire-reports` (run 2026-09-21 12:49): **147 tests, 0 failures, 0 errors, 0 skipped** across 20 classes. |

---

# D. Production Blockers — P0

## P0-1 · Public location fuzzing is trivially reversible

**Priority:** P0 · **Category:** Security / Privacy

**Evidence**
- `apps/api/src/main/java/ma/dari/api/listing/LocationFuzzer.java:17-27`
```java
long seed = listingId.getMostSignificantBits() ^ listingId.getLeastSignificantBits();
Random random = new Random(seed);
double angle = random.nextDouble() * 2 * Math.PI;
double distance = Math.sqrt(random.nextDouble()) * radiusM;
```
- The listing UUID is public: it is the URL segment (`apps/web/src/app/listings/[id]/page.tsx`) and
  the `id` field of every public DTO (`PublicListingResponse.java:8`).
- Radius is a published constant: `application.yml:92` `fuzz-radius-metres: 200`.

**Current behaviour.** The offset is a pure, deterministic function of public inputs only. There is
no server-side secret in the seed. `java.util.Random` is a *specified* linear congruential
generator, reproducible in any language. Given a listing's public id and its fuzzed coordinates,
anyone recomputes `(dLat, dLng)` and subtracts them to recover the **exact** original point.
Determinism is the right choice here — re-randomising per request would let an attacker average
samples to the true centre — but determinism must come from a keyed function, not an unkeyed one.

**Why this matters in real production.** Dari publishes where young people live, for rooms in shared
flats, with the owner's identity attached. The 200 m fuzz is the single technical control standing
between a listing and a stalker, a scammer casing an address, or a landlord discovering a tenant
sublet. Reversing it is a scripting exercise against the public API, at scale, for every listing.
Under Law 09-08 this is a security-of-processing failure on data the product explicitly promises to
protect, not merely a bug.

**Recommended solution.** Keep the interface and the determinism; replace the seed with a keyed PRF.
Derive the seed from `HMAC-SHA256(secret, listingId)` where the secret is a new required production
environment variable (`DARI_LOCATION_FUZZ_SECRET`, ≥32 bytes). Take the first 8 bytes as the seed, or
better, derive `angle` and `distance` directly from the digest bytes and drop `java.util.Random`.
Make `LocationFuzzer` an injected `@Component` rather than a static utility so the secret has
somewhere to live; that is the only structural change. Rotating the secret moves every listing's
apparent pin, which is acceptable and worth documenting.

**Files likely affected**
`listing/LocationFuzzer.java`, `listing/ListingSearchService.java` (9 call sites),
`listing/FavoriteService.java:71`, `application.yml`, `application-production.yml`,
`.env.example`, `infra/scripts/validate-production-config.ps1`,
`src/test/java/ma/dari/api/listing/LocationFuzzerTest.java`.

**How to verify the fix**
1. A test asserting that two different secrets produce different offsets for the same listing id.
2. A test asserting the same secret + same id is stable across calls (the anti-averaging property).
3. A test asserting the offset stays within the configured radius and the distribution is uniform
   over the disc (the existing `Math.sqrt` behaviour).
4. Startup fails when the secret is absent under the `production` profile.

**Dependencies** — none. Do this first; it is small and self-contained.

---

## P0-2 · No deployment artifact and no deployment target exist

**Priority:** P0 · **Category:** Deployment

**Evidence**
- No `Dockerfile`, `.dockerignore`, `fly.toml`, `render.yaml`, `vercel.json`, `Procfile`, `app.yaml`
  or `*.tf` anywhere in the repository (verified by `find`, excluding `node_modules`).
- `README.md` has no deployment section (headings: Current project state, Repository layout, Core
  principles, Getting started, Validation notes, Design-system brand summary).
- `docker-compose.yml:1-2` states it is "Local development dependencies only … the API and the web
  app run on the host".
- `docs/PRODUCTION_OPERATIONS.md`'s backup command is `docker exec dari-db pg_dump …` — `dari-db` is
  the **development** container name from `docker-compose.yml:7`.
- `application-production.yml` is 10 lines and requires only `DARI_WEB_ORIGIN` and
  `FIREBASE_CREDENTIALS_PATH`.

**Current behaviour.** The API can only be started the way a developer starts it. The production
runbook's own examples operate on the dev compose stack, which is the exact
"development-Compose-becomes-production" trap. There is no build output that a host could run.

**Why this matters.** Every other item in this plan is unverifiable until there is somewhere to
verify it. It also means the dev compose stack is the *de facto* production architecture — a
single-node Postgres with a bind-mounted init directory, a MinIO with credentials `dari` /
`dari_local_secret` in a tracked file, and no TLS.

**Recommended solution.** Smallest thing that works, in this order:
1. A multi-stage `Dockerfile` for the API: Maven build stage → `eclipse-temurin:21-jre` runtime,
   non-root user, `ENTRYPOINT exec java -jar`, `-XX:MaxRAMPercentage=75`, and a `.dockerignore` that
   excludes `target/`, `.git`, `node_modules`, `infra/firebase`.
2. Pick one of the two options in section K and write the 20-line deploy procedure into
   `docs/PRODUCTION_OPERATIONS.md` (append; do not rewrite the backup policy, which is good).
3. A `docker-compose.prod.yml` or host-level unit that is *separate* from the dev compose file, with
   the Firebase key mounted as a secret file and no MinIO.

**Files likely affected**
new `apps/api/Dockerfile`, new `apps/api/.dockerignore`, `docs/PRODUCTION_OPERATIONS.md` (append),
`README.md` (append a deployment section), possibly `apps/web/Dockerfile` if not using a managed
frontend host.

**How to verify** — `docker build` then `docker run` with only the production environment variables
set, hit `/actuator/health`, run one search, publish one listing end to end against a non-dev
Postgres.

**Dependencies** — P0-3 (config fail-fast) and P1-3 (graceful shutdown/probes) land in the same
files; sequence them together.

---

## P0-3 · Email notifications will silently not work in production

**Priority:** P0 · **Category:** Deployment / Correctness

**Evidence**
- `application.yml:100-102` — `dari.notifications.enabled: ${DARI_NOTIFICATIONS_ENABLED:false}`.
- `application-production.yml` never sets it (whole file is 10 lines).
- `NotificationDeliveryService.java:15` and `SmtpNotificationSender.java:9` are both
  `@ConditionalOnProperty(name = "dari.notifications.enabled", havingValue = "true")`.
- `OutboxNotificationService` has **no** such condition — enqueueing always happens.
- **No `application*.yml` in the repo contains a `spring.mail` block.** The only occurrences of
  `spring.mail` are in documentation: `SMTP_CONFIGURATION.md:25-30` and
  `apps/api/src/main/java/ma/dari/api/notification/README.md:150-160`.
- `infra/scripts/validate-production-config.ps1:36` requires `SMTP_HOST`, `SMTP_USERNAME`,
  `SMTP_PASSWORD` — **none of which Spring reads.** Spring reads `spring.mail.host`, i.e. the
  environment variable `SPRING_MAIL_HOST`.
- `NotificationDeliveryServiceTest` (3 tests) uses a stub sender, so no test exercises the wiring.

**Current behaviour.** Two failure modes, and the deployment will hit one of them:
- **Flag unset (the default).** No delivery bean, no sender bean, no log line, no warning. The
  outbox accumulates `LISTING_APPROVED`, `LISTING_REJECTED`, `LISTING_EXPIRING_SOON`,
  `USER_SUSPENDED`, `REPORT_ACKNOWLEDGED` rows forever. An owner whose listing is rejected is never
  told. The only signal is the `dari.notifications.outbox_depth{status="PENDING"}` gauge, which
  requires someone to already be scraping and alerting.
- **Flag set following the documentation.** The operator sets `SMTP_HOST` as instructed, Spring
  never sees `spring.mail.host`, Boot's `MailSenderAutoConfiguration` does not create a
  `JavaMailSender`, and `SmtpNotificationSender` fails to construct → **the application does not
  start.** The validation script passes while the app refuses to boot.

**Why this matters.** Moderation outcomes, expiry warnings and report acknowledgements are the only
channel Dari has to its users. Silently dropping them makes the moderation workflow invisible and
the 60-day expiry policy unenforceable from the user's side.

**Recommended solution.**
1. Move the `spring.mail` block from `SMTP_CONFIGURATION.md` into `application-production.yml`,
   reading the documented variable names: `host: ${SMTP_HOST}`, `port: ${SMTP_PORT:587}`,
   `username: ${SMTP_USERNAME}`, `password: ${SMTP_PASSWORD}`, STARTTLS required.
2. Set `dari.notifications.enabled: ${DARI_NOTIFICATIONS_ENABLED:true}` in
   `application-production.yml` — opt-*out* in production, opt-in in development. Defaults should
   fail loudly, not quietly.
3. Add a startup check (see P0-4's shared `ProductionConfigValidator`) that fails fast under the
   `production` profile when notifications are disabled or `spring.mail.host` is blank.
4. Fix the linear-vs-exponential backoff discrepancy while in the file:
   `NotificationDeliveryService.java:89` computes `retryDelay.multipliedBy(attempts)` (linear), while
   `notification/README.md:146` documents "Base delay for exponential backoff". Either make it
   exponential (`retryDelay.multipliedBy(1L << attempts)`, capped) or correct the document.

**Files likely affected**
`application-production.yml`, `application.yml`, `notification/NotificationDeliveryService.java`,
`infra/scripts/validate-production-config.ps1`, `SMTP_CONFIGURATION.md`,
`apps/api/src/main/java/ma/dari/api/notification/README.md`, new startup-validation test.

**How to verify** — start the API with the `production` profile and no `SMTP_HOST`: it must fail with
a named-variable message. Then with a real provider: reject a listing, confirm the email arrives and
the outbox row reaches `SENT`. Then point SMTP at a closed port and confirm rows move
`PENDING → SENDING → PENDING(retry) → DEAD` with no credentials in the logs.

**Dependencies** — P0-2.

---

## P0-4 · Deleted accounts keep their avatar in production object storage

**Priority:** P0 · **Category:** Privacy / Data lifecycle

**Evidence**
- `UserService.java:71` stores a **rendered URL**, not a storage key:
  `user.setAvatarUrl(imageStore.publicUrl(stored.storageKey()))`.
- `ImageStore.java:27-29` default `publicUrl` → `"/uploads/" + storageKey`;
  `S3ImageStore.java:76-78` override → `publicBaseUrl + "/" + storageKey`.
- `UserService.java:126` (deletion) and `UserService.java:77` (replacement) both gate cleanup on
  `previousAvatarUrl.startsWith("/uploads/")`.
- `MediaAccessInterceptor.java` only guards requests served by this application at `/uploads/**`
  (`WebMvcConfig.java:42`).

**Current behaviour.** In local mode the prefix matches and cleanup is enqueued. In **S3 mode** —
the documented production configuration (`docs/PRODUCTION_OPERATIONS.md`: "Set
`DARI_MEDIA_PROVIDER=s3`") — `avatar_url` is `https://media.example.ma/avatars/…jpg`, the
`startsWith("/uploads/")` test is false, and:
- account deletion **never enqueues** the avatar for deletion; the object remains in the bucket
  indefinitely;
- avatar replacement likewise orphans every previous avatar;
- because the object is served from the bucket/CDN rather than through Spring, the revocation
  interceptor never sees the request, so **even a correctly enqueued key stays publicly fetchable**
  until the cleanup worker succeeds and the CDN TTL expires.

`README.md` states deletion removes "the stored avatar file (deleted from disk, not just unlinked)".
That is true only for the storage mode production will not use.

**Why this matters.** A user exercises their right to erasure, the UI confirms it, PII is scrubbed
from the row — and their face stays on a public URL forever. This is the deletion guarantee failing
in exactly the configuration production runs, and it is the kind of gap a CNDP complaint surfaces.

**Recommended solution.**
1. **Store the storage key, not the URL.** Add `avatar_storage_key` in a new migration, backfill by
   stripping the known prefixes, and render the URL at the DTO boundary via
   `imageStore.publicUrl(...)` — exactly as listing photos already do
   (`ListingController.java:268`). Then deletion and replacement enqueue `storageKey` directly with
   no prefix test. This is the root fix; the prefix comparison is a symptom of storing a rendered
   representation in the database.
2. Delete the dead `ListingPhotoResponse.from(photo)` single-argument overload
   (`ListingPhotoResponse.java:18-20`), which hard-codes `/uploads/` and has no callers — it is the
   same trap waiting for the next developer.
3. For the CDN: document and configure a short TTL on media objects, and note in the runbook that
   erasure completeness is bounded by that TTL. (`docs/PRODUCTION_OPERATIONS.md` already raises this
   for listings; extend it to avatars.)

**Files likely affected**
new `V26__user_avatar_storage_key.sql`, `user/User.java`, `user/UserService.java`,
`user/dto/UserResponse.java`, `user/dto/PublicProfileResponse.java`,
`listing/dto/ListingPhotoResponse.java`, `src/test/java/ma/dari/api/user/UserApiTest.java`
(**note: currently modified in your working tree — coordinate before editing**).

**How to verify** — an integration test with `dari.media.provider=s3` and a non-`/uploads` public
base URL: upload an avatar, delete the account, assert a `media_cleanup` row exists for the avatar
key. Repeat for avatar replacement.

**Dependencies** — none, but it touches a file you have uncommitted changes in.

---

## P0-5 · Listing expiry can never fire for a warned listing

**Priority:** P0 · **Category:** Correctness / Core workflow

**Evidence**
- `Listing.java:163-165` — `@PreUpdate` sets `this.updatedAt = Instant.now()` on **every** entity
  update.
- `ListingExpiryJob.java:43-46` — the warning path writes to the entity:
```java
expiringSoon.forEach(listing -> {
    notifications.listingExpiringSoon(listing, warningDays);
    listing.setExpiryWarnedAt(now);
});
```
- `ListingRepository.java:16-23` — the expiry predicate is `l.updatedAt < :cutoff`.
- `ListingRepository.java:28-38` — `findExpiringSoon` additionally requires
  `l.expiryWarnedAt is null`.
- `ListingExpiryJobTest.java` is **pure Mockito** (`mock(ListingRepository.class)`,
  `mock(Listing.class)`), so `@PreUpdate` never runs and the interaction is invisible to the suite.

**Current behaviour.** At day ~53 the job warns the listing and sets `expiry_warned_at`. That write
fires `@PreUpdate`, which resets `updated_at` to now — restarting the 60-day clock. The listing can
therefore never satisfy `updated_at < now - 60d`, and because `expiry_warned_at` is no longer null it
is also permanently excluded from `findExpiringSoon`. **Every published listing that receives a
warning becomes immortal and silent.** The same mechanism means any owner edit or moderation action
also resets the clock.

**Why this matters.** `application.yml:94-97` states the intent plainly: "Sixty days keeps the
marketplace credible; stale listings are the exact failure Dari exists to replace." The feature that
implements that promise does not work, and 147 passing tests do not notice.

**Recommended solution.** Stop using `updated_at` as a lifecycle clock — it is a row-audit column and
every write touches it. Add an explicit `expires_at TIMESTAMPTZ` (or `published_at`) set when a
listing enters `PUBLISHED`, and drive both the warning and the expiry from it. Renewal sets
`expires_at = now + expiryDays` and clears `expiry_warned_at`. Index it partially, matching the
existing style of `idx_listings_searchable`.

**Files likely affected**
new `V27__listing_expires_at.sql` (add column, backfill from `updated_at` for existing PUBLISHED
rows, new partial index), `listing/Listing.java`, `listing/ListingRepository.java`,
`listing/ListingExpiryJob.java`, `listing/ListingService.java` (publish/renew/reopen transitions),
`V25` view projection if `expires_at` should be exposed,
`src/test/java/ma/dari/api/listing/ListingExpiryJobTest.java`.

**How to verify** — a **Testcontainers** test (not Mockito): publish a listing with `expires_at` in
the warning window, run the job, assert a warning was enqueued; advance past `expires_at`, run the
job again, assert the status is `EXPIRED`. That second assertion is precisely what the current mock
test cannot make.

**Dependencies** — none. `V27` should follow `V26` from P0-4 if both land.

---

## P0-6 · Image size limits are enforced after the image is fully decoded

**Priority:** P0 · **Category:** Security / Availability

**Evidence**
- `ImageProcessor.java:32-40` (and the duplicate in `LocalImageStore.java:53-68`):
```java
BufferedImage original = ImageIO.read(in);          // full decode happens HERE
...
if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION
        || (long) width * height > MAX_IMAGE_PIXELS) {   // ... checked only HERE
```
- Limits: `MAX_FILE_SIZE_BYTES = 5 MB`, `MAX_IMAGE_PIXELS = 40_000_000`
  (`ImageProcessor.java:19-21`).

**Current behaviour.** `ImageIO.read` decodes the whole image into heap before any dimension check
runs. PNG's DEFLATE achieves extreme ratios on uniform data, so a **valid 5 MB PNG can declare
30 000 × 30 000 pixels** and allocate roughly 3.6 GB as a `BufferedImage` — the megapixel guard
never gets to run. A second full-size buffer is then allocated at line 41 for the re-encode, so a
legitimate 40 MP upload already costs ~320 MB of heap.

Uploads require authentication and are capped at `UPLOAD` 20/hour per identity, so this is not
anonymous. But 20 requests per account per hour is ample: one crafted upload can `OutOfMemoryError`
the JVM, and recovery is a process restart.

**Why this matters.** A single authenticated user, with no special access, can take the whole API
down repeatedly and cheaply. With one API instance and no orchestrator (P0-2), that is an outage.

**Recommended solution.** Read the header before decoding the pixels:
```java
try (ImageInputStream iis = ImageIO.createImageInputStream(in)) {
    ImageReader reader = ImageIO.getImageReaders(iis).next();
    reader.setInput(iis);
    int w = reader.getWidth(0), h = reader.getHeight(0);   // header only
    // reject here, before reader.read(0)
}
```
Also: (a) collapse the duplicated validation — `LocalImageStore.java:25-31,45-68` re-implements
`ImageProcessor` almost verbatim, so the two limit sets can drift; make `LocalImageStore` call
`ImageProcessor.process` as `S3ImageStore.java:53` already does; (b) consider lowering
`MAX_IMAGE_PIXELS` to ~25 MP, which covers any phone camera; (c) set `-XX:MaxRAMPercentage` and a
container memory limit so an OOM is bounded and restarts cleanly.

**Files likely affected**
`media/ImageProcessor.java`, `media/LocalImageStore.java`,
`src/test/java/ma/dari/api/media/ImageProcessorTest.java`, `apps/api/Dockerfile` (from P0-2).

**How to verify** — a test that feeds a small PNG declaring enormous dimensions and asserts a 400
with the French message *without* a large allocation (assert on rejection before decode, e.g. by
timing or by a reader-level unit test). Confirm both stores share one code path.

**Dependencies** — none.

---

## P0-7 · Rate limiting is bypassable in production, and the limiter map is unbounded

**Priority:** P0 · **Category:** Security / Availability

**Evidence**
- `RateLimitInterceptor.java:37` — `check(annotation.value(), "ip:" + request.getRemoteAddr())`.
- `application-production.yml:5` — `server.forward-headers-strategy: framework`. Spring's
  `ForwardedHeaderFilter` rewrites the request so `getRemoteAddr()` returns the value from
  `X-Forwarded-For`.
- `RateLimitInterceptor.java:33-36` — the user dimension is **skipped entirely** for anonymous
  callers, so all public search traffic is limited by IP alone.
- `RateLimitService.java:26` — `ConcurrentHashMap<BucketKey, Window>`; entries are created on first
  sight (`:70`) and only swept every 300 s (`RateLimitEvictionJob.java:16`).
- `README.md` states "forwarded headers are not trusted by default" — this contradicts
  `application-production.yml:5`. `docs/PRODUCTION_OPERATIONS.md` also asserts "The API does not
  blindly trust `X-Forwarded-For`".

**Current behaviour.** Unless the ingress *overwrites* `X-Forwarded-For` (not appends), an anonymous
client rotates the header per request and receives a fresh bucket every time — defeating SEARCH,
SIGNUP, and the IP half of every other policy. Each forged value also allocates a `BucketKey` +
`Window` that lives until the next sweep, so the same requests grow the heap without bound between
evictions. If instead the proxy does not set the header at all, every user collapses into a single
bucket and legitimate traffic rate-limits itself.

**Why this matters.** This is the *only* abuse control on a public marketplace, and it protects the
PostGIS radius search, the map endpoint and the sitemap. Both failure modes are bad, and which one
you get depends on proxy configuration that does not exist yet. The documentation asserting the
opposite makes it likely to go unnoticed.

**Recommended solution.** Do **not** introduce Redis — one instance does not need it (see section G).
1. Replace `forward-headers-strategy: framework` with an explicit trusted-proxy boundary: register a
   `ForwardedHeaderFilter` only when the peer is the known ingress, or keep `framework` and make the
   ingress *overwrite* `X-Forwarded-For` with the real peer (nginx `proxy_set_header
   X-Forwarded-For $remote_addr;`, Caddy/Traefik equivalent). Document which one you chose — the
   whole control depends on it.
2. Cap the limiter map: reject-or-evict beyond a configured maximum entry count (a bounded LRU, or
   simply drop new IP buckets past the cap and fall back to a global bucket). A `ConcurrentHashMap`
   keyed by attacker-controlled strings must always be bounded.
3. Add the IP dimension to the anonymous path deliberately rather than by omission, and reconcile
   `README.md` / `docs/PRODUCTION_OPERATIONS.md` with what the code does.

**Files likely affected**
`application-production.yml`, `common/ratelimit/RateLimitService.java`,
`common/ratelimit/RateLimitInterceptor.java`, `common/ratelimit/RateLimitEvictionJob.java`,
`README.md`, `docs/PRODUCTION_OPERATIONS.md`, ingress configuration (outside the repo),
`src/test/java/ma/dari/api/common/ratelimit/RateLimitServiceTest.java`.

**How to verify** — with the production profile behind the real ingress, send 200 search requests
with rotating `X-Forwarded-For` values and assert a 429 arrives at the configured threshold.
Separately, a unit test asserting the map stops growing past the cap.

**Dependencies** — P0-2 (the answer depends on the chosen ingress).

---

## P0-8 · No automated backups exist (policy only)

**Priority:** P0 · **Category:** Data safety / Recoverability

**Evidence**
- `docs/PRODUCTION_OPERATIONS.md` contains a genuinely good written policy: daily encrypted
  `pg_dump -Fc`, offsite versioned immutable bucket, 35-day/12-week/12-month retention, weekly
  restore verification, alert conditions, RPO 24 h.
- The implementation is a manual PowerShell snippet in that document plus
  `infra/scripts/restore-drill.ps1`. There is **no scheduler, no cron, no CI job, no service** that
  runs any of it, and no repository evidence of a backup ever having run.
- The `pg_dump` example targets `docker exec dari-db` — the development container.
- All three operational scripts are `.ps1` (`dev.ps1`, `restore-drill.ps1`,
  `validate-production-config.ps1`), unusable on a Linux host without PowerShell installed.

**Current behaviour.** A documented policy that nothing executes. On launch day the database has no
backups.

**Why this matters.** "Inability to recover from failure" is the definition of a P0. Everything else
here is recoverable; losing the only copy of user data is not. A policy that has never run is also
untested: the first execution is during an incident.

**Recommended solution.** Choose based on section K:
- **Managed Postgres** (option A) — enable the provider's automated daily backups + PITR, set
  retention to match the written policy, and reduce the repo's role to a *restore* drill.
- **Self-managed Postgres** (option B) — a shell (not PowerShell) script invoked by systemd timer or
  cron on the DB host: `pg_dump -Fc` → `pg_restore --list` validation → upload to a versioned bucket
  in a different account → delete local. Add a dead-man's-switch (healthchecks.io-style ping) so a
  *missing* backup alerts, which is the failure the written policy correctly calls out.

Then port `restore-drill.ps1` to shell, and record the first real drill's duration as the RTO the
document currently declines to promise.

**Files likely affected**
new `infra/scripts/backup.sh`, new `infra/scripts/restore-drill.sh`, new systemd timer/cron unit,
`docs/PRODUCTION_OPERATIONS.md` (replace the dev-container commands, append the automation
procedure).

**How to verify** — let the timer fire twice on its own, then restore the *second* archive into a
throwaway PostGIS 16 container, run the row-count and `postgis_full_version()` checks the document
already specifies, and record the measured duration. Then delete a backup object and confirm the
missing-backup alert fires.

**Dependencies** — P0-2.

---

## P0-9 · Mobile cannot produce a shippable build

**Priority:** P0 **for a mobile release** (not blocking a web-only launch) · **Category:** Mobile / Deployment

**Evidence**
- `apps/mobile/eas.json:6` — the entire production profile is `{ "autoIncrement": true }`. No `env`
  block.
- `apps/mobile/.env.example:1-2` documents that `EXPO_PUBLIC_*` vars are **inlined at bundle time**,
  so they cannot be injected after the build.
- `apps/mobile/src/lib/config.ts:1-5` hard-gates the app on the three Firebase vars;
  `app/_layout.tsx:62-63` renders a full-screen "Configuration requise" when they are missing.
- `apps/mobile/src/lib/api.ts:20` — fallback `'http://localhost:8080/api/v1'`, cleartext HTTP, baked
  into the binary.
- No `extra.eas.projectId` anywhere in `app.json`; `.expo/devices.json` is `{"devices": []}`.
  `eas build` cannot run until `eas init`.
- No `android.config.googleMaps.apiKey` and no `ios.config.googleMapsApiKey` in `app.json:11-29`,
  while `react-native-maps` is a shipped feature (`package.json:26`,
  `app/(tabs)/index.tsx:117-119`).
- `eas.json:8-10` — `submit.production` is `{}`: no `ascAppId`, `appleTeamId` or
  `serviceAccountKeyPath`.
- No `splash` key in `app.json`, yet `app/_layout.tsx:28,42` calls
  `preventAutoHideAsync()`/`hideAsync()`; `assets/splash-icon.png` is referenced by nothing.
- No `updates` block, no `runtimeVersion`, `expo-updates` not a dependency — no OTA remediation path.
- No `versionCode` / `buildNumber` in `app.json` (delegated to `autoIncrement`, which needs EAS
  initialised).

**Current behaviour.** `eas build --profile production` cannot be invoked (no project id); if it
could, the artifact would either refuse to boot or target `http://localhost:8080`. `docs/MOBILE_PHASE5.md:13`
labels release readiness "Prepared" and `:31` instructs the operator to run `eas build`; neither is
achievable as configured.

**Why this matters.** Mobile is not one fix away from the stores; the release configuration has never
been exercised. Treating it as near-ready is the main scheduling risk in this project.

**Recommended solution.** Sequence: `eas init` → add `env` to every `eas.json` profile (production
pointing at the real HTTPS API) → **remove** the `localhost` fallback in `src/lib/api.ts:20` and fail
loudly instead → add the Google Maps Android API key → add `splash` config → add `versionCode` /
`buildNumber` → fill `submit.production` → then build. Add `expo-updates` only once the rest works.

**Files likely affected**
`apps/mobile/eas.json`, `apps/mobile/app.json`, `apps/mobile/src/lib/api.ts`,
`apps/mobile/src/lib/config.ts`, `docs/MOBILE_PHASE5.md` (correct the "Prepared" claim).

**How to verify** — an internal-distribution build installed on a real Android device and a real iPhone
that reaches the production API, shows the map, and completes the flows in section M. TypeScript
compiling is not verification.

**Dependencies** — P0-2 (the API must have a real HTTPS origin first).

---

## P0-10 · The nonce CSP blocks all JavaScript on every prerendered web route

**Priority:** P0 · **Category:** Web / Availability

**Evidence**
- `apps/web/src/middleware.ts:9` — `const nonce = crypto.randomUUID()` per request.
- `apps/web/src/middleware.ts:20` — `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`.
- `apps/web/src/middleware.ts:38-42` — the nonce plumbing is the *correct* documented Next.js
  pattern: the CSP is set on the **request** headers so Next can read it back and stamp the nonce
  onto the script tags **it renders at request time**.
- `apps/web/.next/prerender-manifest.json` — `/`, `/flatshare/{rabat,casablanca,marrakech,tanger}`
  (ISR 900 s), `/sign-in`, `/sign-up`, `/publish`, `/messages`, `/favorites`, `/account*`,
  `/admin*`, `/profile-recovery`, `/legal/*`, `/_not-found` are all prerendered.
- `apps/web/.next/server/app/index.html`, `sign-in.html`, `publish.html` — the Next bootstrap tags
  are `<script src="/_next/static/chunks/…">` with **no `nonce` attribute**.
- `apps/web/e2e/playwright.config.ts:48` — the e2e suite runs `npm run dev`, not a production build.

**Current behaviour.** `'strict-dynamic'` causes the browser to **ignore host-source expressions**
(`'self'`) in `script-src`; only nonce- or hash-matched scripts execute. On a prerendered route the
HTML comes from cache, so no render happens at request time, so no nonce can be injected — while the
response header carries a *fresh* random nonce that matches nothing in that HTML. Every Next.js
bootstrap script on those routes is therefore blocked.

The consequence is not subtle: `/sign-in`, `/sign-up`, `/publish`, `/messages`, `/favorites`,
`/account/*` and `/admin/*` are all `'use client'` pages, so they would render an inert shell — no
hydration, no React, no interactivity. The homepage and the city landing pages would paint their
ISR HTML and then do nothing. The only routes that still work are the dynamically rendered ones
(`/listings`, `/listings/[id]`, `/profile/[id]`), because those *are* rendered per request and do get
the nonce.

CI cannot catch this: `next build` succeeds, and Playwright runs against `npm run dev` where every
route is dynamic and the nonce is always injected.

*Confidence note:* this is derived from the built artifacts plus CSP semantics, not from a browser
load — no production server was started during this audit. Verify with one `next start` before
treating it as fixed, and equally, do not dismiss it without that check.

**Why this matters in real production.** This is the difference between "a working site" and "a
site where nobody can sign in". It is the highest-impact single defect found in the web app, and it
would be discovered by the first real user rather than by any existing gate.

**Recommended solution.** A per-request nonce is fundamentally incompatible with cached HTML. Pick
one and be deliberate:
1. **Recommended — drop the nonce, keep a strict CSP.** Serve a *static* CSP with
   `script-src 'self'` (no `'strict-dynamic'`, no nonce) from `next.config.mjs:57` headers, so it
   applies identically to cached and dynamic responses. The app loads **no third-party JavaScript**
   and has **no inline scripts** other than the JSON-LD block, so `'self'` is a genuinely strong
   policy here — `'strict-dynamic'` buys little and costs the whole site. Apply the same reasoning
   to `style-src`: replace the nonce with `'self' 'unsafe-inline'` (Next emits inline `<style>` for
   `next/font`, which the nonce also blocks on static routes), keeping the existing
   `style-src-attr 'unsafe-inline'` that the inline-style architecture requires.
2. If `'strict-dynamic'` is considered essential, every route it applies to must be dynamically
   rendered — which means giving up ISR on the homepage and city pages. Not worth it.

While in the file, also fix two smaller header issues:
- **Add HSTS.** No `Strict-Transport-Security` is set anywhere in the web app
  (`next.config.mjs:57-69`, `middleware.ts`). `upgrade-insecure-requests` is not a substitute. Set
  it in `next.config.mjs` headers so it survives independently of middleware.
- Note that `middleware.ts:49`'s `missing:` clause skips CSP and `Permissions-Policy` for prefetch
  responses. Moving the headers to `next.config.mjs` resolves that too.

**Files likely affected**
`apps/web/src/middleware.ts` (delete or reduce to nothing), `apps/web/next.config.mjs` (static
headers incl. HSTS), `apps/web/e2e/playwright.config.ts` (see P1: run e2e against a production
build).

**How to verify the fix**
1. `npm run build && npm run start`, load `/sign-in` and `/`, and assert **zero** CSP violations in
   the browser console and that the pages are interactive.
2. Add a Playwright project that runs against `next start` (not `next dev`) and fails on any console
   CSP error — this is the gate whose absence hid the bug.

**Dependencies** — none, but pair with the e2e change so it cannot regress.

---

## P0-11 · Public image URLs are built from the internal API hostname

**Priority:** P0 · **Category:** Web / Configuration / Information disclosure

**Evidence**
- `apps/web/src/lib/config.ts:62-68` — `apiOrigin` is derived from `API_BASE_URL` on the server and
  `NEXT_PUBLIC_API_BASE_URL` in the browser.
- `apps/web/.env.production.example:2-3` prescribes **two different hosts**:
  `NEXT_PUBLIC_API_BASE_URL=https://api.example.ma/api/v1` vs
  `API_BASE_URL=https://api.internal.example.ma/api/v1`.
- Server-rendered consumers of `apiOrigin`: `src/app/listings/[id]/page.tsx:63,69` (`og:image`,
  `twitter:image`), `src/app/listings/[id]/ListingDetailContent.tsx:76` (JSON-LD `image`),
  `src/app/page.tsx:212` and `src/app/flatshare/[city]/page.tsx:242` (`<img src>` baked into
  ISR-cached HTML), `src/components/ListingThumb.tsx:40`.
- `apps/web/src/middleware.ts:10-11,27` — the CSP `img-src` allow-list is built from
  `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_MEDIA_ORIGINS`, so it does **not** contain the internal
  origin.
- `NEXT_PUBLIC_MEDIA_ORIGINS` is required by the build gate (`next.config.mjs:10,31`) and validated
  (`config.ts:51-58`) but **is never used to construct a single URL** — its only readers are the CSP
  and the validators.

**Current behaviour.** Following the repository's own production example, every server-rendered photo
URL, Open Graph image and JSON-LD image points at `https://api.internal.example.ma/...`. That
(a) publishes an internal hostname in public HTML, OG tags and structured data, (b) produces broken
images for every visitor and every social/WhatsApp preview, and (c) is blocked by the app's own CSP
even if the host were reachable. Meanwhile the media CDN variable that exists precisely for this is
inert.

**Why this matters.** Listing photos are the product. Broken hero images on shared links, plus an
internal hostname disclosed in crawlable markup, is both a functional and an
information-disclosure failure — and it only appears in production, because in development both
variables point at `localhost:8080`.

**Recommended solution.** Introduce a single media-origin resolver and use it everywhere a *public*
media URL is produced: prefer `NEXT_PUBLIC_MEDIA_ORIGINS`' first entry, fall back to
`NEXT_PUBLIC_API_BASE_URL`'s origin, and **never** `API_BASE_URL`. Keep `API_BASE_URL` strictly for
server→API fetches. Then require the resolver's output to be in the CSP `img-src` list by
construction (derive both from the same value).

Also (same file, small): `API_BASE_URL` is **not** in the build gate's required list
(`next.config.mjs:4-22`) despite being load-bearing for every server-side fetch — add it. And
`validateProductionBuildConfig()` in `src/lib/config.ts:95-106` has **no caller**; its legal-variable
check exists only as a duplicate in `next.config.mjs:11-24`. Either call it or delete it so the two
lists cannot drift.

**Files likely affected**
`apps/web/src/lib/config.ts`, `apps/web/src/lib/api.ts` (the `apiOrigin` export),
`src/app/listings/[id]/page.tsx`, `src/app/listings/[id]/ListingDetailContent.tsx`,
`src/app/page.tsx`, `src/app/flatshare/[city]/page.tsx`, `src/components/ListingThumb.tsx`,
`src/middleware.ts` or `next.config.mjs`, `apps/web/.env.production.example`,
`apps/web/.env.local.example` (which lists neither `NEXT_PUBLIC_MEDIA_ORIGINS` nor any
`DARI_LEGAL_*`).

**How to verify** — build with `API_BASE_URL` and `NEXT_PUBLIC_MEDIA_ORIGINS` set to deliberately
*different* hosts, then grep the generated HTML under `.next/server/app/` for the internal hostname:
it must not appear. Load a listing page and confirm images render with no CSP `img-src` violation.

**Dependencies** — P0-10 (same header/config surface).

---

# E. Important Pre-Launch Improvements — P1

Structured more briefly; each is justified by evidence and is cheap relative to its risk.

## P1-1 · `/actuator/metrics` and `/actuator/prometheus` are readable by any authenticated user

**Category:** Security. `application.yml:68` exposes `health,info,metrics,prometheus`;
`SecurityConfig.java:69` only `permitAll`s `health`/`info`, so the rest fall through to
`anyRequest().authenticated()` (`SecurityConfig.java:114`). Any valid Firebase token qualifies —
**including one with no Dari profile**, which is granted `ROLE_PROFILELESS`
(`FirebaseAuthFilter.java:113-115`). That exposes search latency, moderation queue depth, report
volume and `dari.errors.unhandled` keyed by exception class name. `docs/AUDIT_FIX_PLAN.md` deferred
this as F10; the profileless-token angle is new and the fix is one line.
**Fix:** `.requestMatchers("/actuator/**").hasRole("ADMIN")` before the catch-all, or move
management to a separate port bound to localhost and scrape it over the private network. Prefer the
separate port — a scraper should not need a Firebase identity.
**Verify:** extend `SecurityHeadersApiTest` with a 403 assertion for a `USER` token.

## P1-2 · `GET /api/v1/cities` loads every published listing into the JVM, unauthenticated and unlimited

**Category:** Availability. `ReferenceDataController.java:34-45`:
```java
return listings.findByStatusAndAvailabilityStateAndDeletedAtIsNull(PUBLISHED, AVAILABLE)
        .stream().collect(Collectors.groupingBy(Listing::getCity, Collectors.counting()))
```
No `LIMIT`, no DB-side aggregation, and no `@RateLimited` — while `/listings`, `/count`, `/map`,
`/featured` and `/sitemap` all carry `@RateLimited(SEARCH)`. This is the same failure the map
endpoint was hardened against after the 2026-09-05 load test (`ListingSearchRepository.java:307-317`),
left in place on a homepage endpoint anyone can call in a loop. At their own load-test scale (50 000
listings) that is 50 000 hydrated entities per request.
**Fix:** `SELECT city, count(*) FROM published_listings GROUP BY city` as a projection, plus
`@RateLimited(SEARCH)`. Consider a short in-process cache — city counts do not need to be live.
**Verify:** assert one query returning ≤ number-of-cities rows; add the annotation and assert 429.

## P1-3 · No graceful shutdown, no readiness/liveness distinction, no query or connection timeouts

**Category:** Deployment / Availability. Absent from all config (`grep shutdown|liveness|readiness|probes`
over `apps/api/src/main/resources` → nothing): `server.shutdown: graceful`,
`spring.lifecycle.timeout-per-shutdown-phase`,
`management.endpoint.health.probes.enabled`, Hikari `connection-timeout`/`validation-timeout`,
JDBC `socketTimeout`, and any statement or JPA query timeout. `spring.datasource.hikari.maximum-pool-size`
is 10 (`application.yml:10`) with no timeouts around it.
**Why it matters:** a restart kills in-flight requests mid-transaction; a hung Postgres or a slow
PostGIS query holds pool connections until the pool is exhausted and the whole API stops responding
— with no statement timeout, there is nothing to break the deadlock but a restart.
**Fix:** `server.shutdown: graceful`; enable liveness/readiness groups and point the platform's
probes at `/actuator/health/readiness` and `/liveness` (readiness must include the DB, liveness must
not); Hikari `connection-timeout: 10s`; a JDBC `socketTimeout`; and a conservative
`spring.jpa.properties.jakarta.persistence.query.timeout` (or a Postgres `statement_timeout` on the
application role) so a pathological radius query dies instead of pinning a connection.

## P1-4 · Favorites disclose non-public listings

**Category:** Authorization. `FavoriteService.java:105-106` accepts **any** non-deleted listing:
`listings.findByIdAndDeletedAtIsNull(listingId)` with no status check; and
`FavoriteRepository.java:28-33` reads them back with no status filter. So `POST /favorites/{uuid}`
on a stranger's `DRAFT`/`PENDING_REVIEW`/`REJECTED`/`SUSPENDED` listing succeeds, and
`GET /favorites` then returns its title, city, neighborhood, price, coordinates and cover photo URL
(`PublicListingResponse.java:33-45`) — data `GET /listings/{id}` deliberately 404s on
(`ListingSearchService.java:417-423`). The cover photo is then fetchable with no auth at all
(`SecurityConfig.java:79`). Requires knowing the UUID, which an owner of a since-unpublished listing
has.
**Note the deliberate part:** keeping a *previously* favorited listing visible after it leaves public
search is intentional (`FavoriteRepository.java:23-27`). The defect is only that **adding** does not
require public visibility.
**Fix:** in `FavoriteService.add`, require `status = PUBLISHED && availabilityState = AVAILABLE`
(or read through `published_listings`) and 404 otherwise. Leave the read path as is.
**Verify:** an API test asserting 404 when favoriting another user's draft.

## P1-5 · `GET /api/v1/listings/{id}` has no rate limit

**Category:** Abuse. `ListingController.java:163-170` — the most-linked URL in the product, 5 queries
per call (`ListingSearchService.java:414-443`), no `@RateLimited`, while every other public search
endpoint has one. Free enumeration and scraping of the whole catalogue — which, combined with P0-1,
is how an attacker harvests every exact address in one pass.
**Fix:** `@RateLimited(SEARCH)`. Also add it to `/cities`, `/amenities`, `/neighborhoods` and
`/users/{id}`.

## P1-6 · Media cleanup has no terminal failure state, no locking, and no alert

**Category:** Data lifecycle / Operations.
- `V24__media_cleanup_outbox.sql` — `CHECK (status IN ('PENDING','DELETED'))`: there is **no DEAD
  state**, unlike the notification outbox (`V19`). A permanently undeletable key retries every 60 s
  forever (`MediaCleanupService.java:43` caps backoff at 3600 s).
- `MediaCleanupService.java:32-33` — `@Scheduled` with **no `@SchedulerLock`** and no
  `FOR UPDATE SKIP LOCKED`, unlike `ListingExpiryJob.java:36` and
  `NotificationOutboxRepository.java:17`. Two instances would both process the same 100 rows.
  `processDue` is also not `@Transactional`.
- The `dari.media.cleanup_failures` gauge exists (`MetricsConfig.java:74-77`) but nothing alerts on
  it.

**Why it matters:** media cleanup is the mechanism that makes erasure real. A silently stuck queue
means user photos are never actually deleted — and in S3 mode (P0-4) they stay publicly readable.
**Fix:** add a `DEAD` status with a max-attempts cap; add `@SchedulerLock` (single-instance today,
but this is the job most likely to be doubled first); alert on `cleanup_failures > 0` for >1 h.

## P1-7 · Sorted search almost certainly cannot use the indexes built for it

**Category:** Performance. `V15__search_sort_indexes.sql` builds
`idx_listings_searchable_price (city, price_rent, id)` and `…_updated (city, updated_at DESC, id DESC)`
and documents them as fixing measured EXPLAIN regressions. But `searchByLocationSorted`
(`ListingSearchRepository.java:78-85`) orders by **`CASE WHEN CAST(:sort AS text) = … THEN column END`**
expressions, and resumes via a large `OR` block of casts (`:67-77`). Postgres cannot match an
expression `ORDER BY` against a plain-column index, so these queries most likely bitmap-scan the
city's published rows and top-N sort — exactly the behaviour V15 was written to remove.
`ListingSearchOptimizationTest` asserts **correctness only**; there is **no `EXPLAIN` assertion
anywhere in the test suite** (`grep EXPLAIN` over `src/test` → 0 hits), so this is unverified in
either direction.
The `CASE` form is *also* what makes the query injection-proof, so do not simply interpolate the
column name.
**Fix:** first, measure — run `EXPLAIN (ANALYZE, BUFFERS)` against the seeded 50 k dataset
(`infra/scripts/seed-load-test-data.sql` already exists). If the indexes are unused, split into one
query per sort (four small methods sharing a filter fragment) which keeps binding parameterised
while letting each `ORDER BY` name a real column. Then add an `EXPLAIN`-asserting test so the
regression cannot silently return.

## P1-8 · The ArchUnit rule that protects the core invariant does not exist

**Category:** Testing / Architecture. `ArchitectureTest.java:14-17` documents it explicitly —
"Phase 02 adds the one that matters most: no query outside the listing package may read the
`listings` table directly, so the `status = PUBLISHED AND availability_state = AVAILABLE` invariant
cannot be forgotten in a new feature" — and the file then defines only two unrelated rules
(`:26-30` user controllers vs `UserRepository`, `:34-38` `common.pagination` independence). Two
tests, matching the surefire count. So the repository's two most important invariants — the public
visibility filter and the coordinate-fuzzing chokepoint — are guarded by convention and code review
only. This was the prior audit's F9 and is still open.
**Fix:** add the documented rule, plus a second one that is arguably more valuable: no class outside
`ma.dari.api.listing` may access `Listing.getLatitude()` / `getLongitude()`, and no public-facing DTO
may be constructed from them without passing through `LocationFuzzer`. That converts P0-1's
chokepoint from a convention into a build failure.

## P1-9 · `checkRevoked` is not used when verifying ID tokens

**Category:** Security. `FirebaseAuthFilter.java:74` calls the single-argument
`firebaseAuth.verifyIdToken(token)`; `checkRevoked` appears nowhere in the codebase. Dari-side bans
and deletions **are** caught immediately at the filter (`:82-106`), which covers the important cases.
But a Firebase-side revocation — password change, `revokeRefreshTokens`, account disabled in the
console — stays honoured until the token expires (up to 1 h).
**Fix:** use `verifyIdToken(token, true)`. This adds a Firebase network call per request, so measure
it; if the latency is unacceptable, cache the revocation check per uid for ~60 s. Given Dari's ban
path already works locally, this is a defence-in-depth improvement, not an emergency.

## P1-10 · No error tracking, and the release version is hardcoded to `"development"`

**Category:** Observability. `ErrorReporter` is deliberately a no-op (`NoopErrorReporter.java`) —
`README.md` documents the choice, and it is a reasonable one *until launch*. But
`GlobalExceptionHandler.java:156-157` passes the literal string `"development"` as the release
version into every `SafeErrorContext`, so whatever is wired in later will mislabel every event.
Mobile has no crash reporting at all (§L) and swallows several errors silently with zero
`console.*` (`apps/mobile/app/listing/[id].tsx:78-80`, `app/messages/[id].tsx:69,85`).
**Fix:** read the release version from configuration (web already has
`NEXT_PUBLIC_RELEASE_VERSION`); wire a real reporter for API + web + mobile before launch. This is
the single highest-value observability addition, because right now a production failure produces a
log line on one host and nothing else.

## P1-11 · Alerting and monitoring are unconfigured

**Category:** Operations. The *signals* exist and are good (`MetricsConfig.java`, `/actuator/prometheus`),
but nothing scrapes them and nothing alerts. There is no uptime check, no alert destination.
**Fix (minimum viable, section N/O):** an external uptime monitor on `/actuator/health` and on the
web homepage; scrape `/actuator/prometheus` into whatever managed Grafana/hosted Prometheus the host
offers; and exactly six alerts (see §17 in the roadmap): API unreachable, 5xx rate elevated, DB
unreachable, `notifications.outbox_depth{status="PENDING"}` rising for >1 h or any `DEAD` row,
`media.cleanup_failures > 0` for >1 h, missing daily backup. Nothing more.

## P1-12 · Web runtime-state gaps: no `global-error.tsx`, no `loading.tsx` anywhere, no 401 handling

**Category:** Web / Runtime. `apps/web/src/app` contains only a root `error.tsx` and `not-found.tsx`.
There is **no `global-error.tsx`** (so a throw in `layout.tsx:47-57` is uncatchable) and **zero
`loading.tsx` files app-wide** (so no route streams a fallback). `src/lib/api.ts:142-157` never
inspects 401/403 and never force-refreshes and replays; `ErrorCode.UNAUTHENTICATED`/`INVALID_TOKEN`
(`src/lib/errors.ts:9-10`) are referenced by no UI file. The three bespoke network error classes
(`ApiTimeoutError`, `ApiOfflineError`, `ApiNetworkError`, `api.ts:39-58`) are thrown but **never
matched by any consumer**, so their French copy — including "Aucune connexion réseau détectée" — is
dead. The 15 s timeout itself is present and correct (`api.ts:90-96`) and applies everywhere.
**Fix:** add `global-error.tsx`; add `loading.tsx` to the slow segments (`/listings`,
`/listings/[id]`, `/messages`, `/account`); on a 401 from `apiFetch`, force one token refresh and
replay once, then sign out; branch on the three network classes in a shared error component so the
copy that already exists gets shown.

## P1-13 · `robots.txt` and the listing sitemap are frozen at build time

**Category:** SEO. `.next/prerender-manifest.json` gives `/robots.txt` and `/sitemap/0.xml`
`initialRevalidateSeconds: false`, and neither `src/app/sitemap.ts` nor `src/app/robots.ts` exports
`revalidate` or `dynamic`. New listings never enter the sitemap and `batchCount` (`robots.ts:15`)
never grows until a redeploy. `README.md:62` claims the sitemap "revalidates hourly" — it does not.
**Fix:** `export const revalidate = 3600` in both files. One line each; reconcile the README.

## P1-14 · Public profile pages have no metadata and no `noindex`

**Category:** SEO / Privacy. `apps/web/src/app/profile/[id]/page.tsx` has no `generateMetadata`, so
profile pages carrying a display name, city and bio (`:63-107`) inherit only the root title, have no
canonical, and are **indexable**. Every other route handles this deliberately
(`listings/[id]/page.tsx:43` sets `robots: { index: false }` for non-public listings).
**Fix:** decide whether user profiles should be in Google at all. Given the product's privacy
posture, `noindex` is the consistent choice; either way, add `generateMetadata` with a canonical.

## P1-15 · Stored-markup injection vector in the public JSON-LD

**Category:** Web / XSS (defence-in-depth). `ListingDetailContent.tsx:87-90` serialises
owner-supplied `listing.title` and `listing.description` with `JSON.stringify` into
`dangerouslySetInnerHTML` inside a `<script type="application/ld+json">`. `JSON.stringify` does not
escape `<` or `/`, so a description containing `</script>` breaks out of the element. The route is
dynamically rendered so the CSP does apply there and would block an injected `<script>` — but that
is defence-in-depth, not escaping, and the CSP is itself under repair (P0-10).
**Fix:** escape before injection (`.replace(/</g, '\\u003c')`) — the standard one-liner. Cheap;
do it.

## P1-16 · Accessibility issues that are real blockers, not polish

**Category:** Web / A11y. The design system is genuinely strong here — `Dialog.tsx:73-125` has a real
focus trap and restore, `IconButton` makes `label` a required prop, `Tabs` implements roving
tabindex, every form control wraps its input in a `<label>` with `useId` wiring, `SkipLink`
re-targets `<main>` on route change. Against that baseline these stand out:
1. **`role="tab"` with no `tabpanel` and no `aria-controls`, on three controls that are not tabs** —
   the results/map switch, the *sort order* selector and the search-mode selector
   (`SearchResults.tsx:745-754, 762-768, 834-854`). `Tabs.tsx:80` only emits `aria-controls` when
   given `panelId`, and no call site passes one; `role="tabpanel"` appears nowhere in `src`. A
   screen-reader user is told "tab, 2 of 3" for a sort dropdown and sent to a panel that does not
   exist. **Fix:** stop using `Tabs` for non-tab controls (a radio group or a `<select>` for sort),
   or pass `panelId` and mark the results container.
2. **Zero `aria-live` regions in the entire app**, while the message thread polls every 5 s and
   appends (`messages/[id]/page.tsx:159`) and the nav unread badge polls every 30 s
   (`SiteNav.tsx:80`). Incoming messages are silent. **Fix:** `role="log"` on the thread,
   `aria-live="polite"` on the loading states.
3. **Both Leaflet maps are unnamed and excluded from every axe run** (`SearchResults.tsx:60-79`,
   `LocationPicker.tsx:102-127`, excluded at `e2e/tests/fixtures.ts:19`). `LocationPicker` does
   provide a keyboard path via lat/lng inputs and documents why (`:29-35`); the *search* map has no
   equivalent. **Fix:** accessible name + a non-map route to the same results (the list view already
   is one — link them explicitly).
4. **Gallery dots are 8×8 px with no active-state semantics** (`ListingGallery.tsx:157-172`) — under
   the 24×24 WCAG 2.5.8 target, state conveyed by background colour only, no prev/next, no arrow
   keys. **Fix:** larger targets, `aria-current`, prev/next buttons.
5. Native `confirm`/`prompt` for account deletion (`src/app/account/profile/page.tsx`) — unstylable,
   unfocusable, and the e2e test needs `dispatchEvent('click')` to get past it. Use the existing
   accessible `Dialog`.

## P1-17 · E2E runs against `next dev`, and CI has no production-mode browser gate

**Category:** Testing. `e2e/playwright.config.ts:48` starts `npm run dev`. That is why P0-10 —
a defect that only exists in prerendered output — is invisible to a 4-test suite that otherwise
covers the right journeys (public search + map, sign-up → profile, publish wizard end to end,
favourites → messaging → reporting → admin → deletion). Axe runs on 4 pages, always with the map
excluded, and every interaction is `click`/`fill` so no keyboard-only path is tested.
**Fix:** add a second Playwright project against `next build && next start` that fails on any console
error (which catches CSP violations), and one keyboard-only journey through the publish wizard.

## P1-18 · Mobile: no error boundary, no crash reporting, no request timeout, no in-app legal link

**Category:** Mobile. Distinct from P0-9 (which is about producing a build at all):
- **No error boundary anywhere** — zero `ErrorBoundary` exports across `apps/mobile/app` and `src`.
  Any render-phase throw white-screens the app. A reachable path: `app/listing/[id].tsx:224-233`
  indexes `CHARGE_LABEL[listing.wifiIncluded]`, so an unexpected enum value yields `undefined` into
  a `<Text>`.
- **No crash reporting** (no Sentry/Crashlytics in `package.json`) combined with **zero `console.*`**
  and several silent catches → production failures are entirely invisible.
- **No request timeout** — `src/lib/api.ts:66-98` and `:105-132` set no `AbortSignal.timeout`; the
  spinners at `app/listing/[id].tsx:138` and `app/messages/[id].tsx:136` have no escape. (Web has a
  15 s timeout; mobile does not.)
- **No in-app privacy policy or terms link** — zero hits for privacy/legal/`openURL` in the mobile
  tree, while `apps/web/src/app/legal/` exists. Both stores require a reachable policy and Apple
  requires it in-app for account-bearing apps.
- **The app requests notification permission for a capability that does not exist** (see §23):
  `app/(tabs)/profile.tsx:96` shows a real OS dialog; there is no token request, no `/devices`
  endpoint, no device table in any of the 25 migrations, and the only sender is SMTP. Remove the
  control until push exists.
- **Android account deletion has one fewer confirmation than iOS** —
  `app/(tabs)/profile.tsx:76-77`: iOS requires typing `SUPPRIMER` via `Alert.prompt` (iOS-only API),
  Android proceeds on a single tap of an irreversible `DELETE /users/me`. Use a custom modal so both
  platforms match.

## P1-19 · Operational documentation gaps

**Category:** Documentation. `docs/PRODUCTION_OPERATIONS.md` is strong on backup policy and rollback
contract. Missing, and needed by anyone who is not you:
- **Where Dari runs** — no deployment section in `README.md`, no provider, no procedure (P0-2).
- **A production environment-variable reference** — section P below is the first one; it does not
  exist in the repo, and `.env.example` omits `DARI_NOTIFICATIONS_*`, `DARI_RATE_LIMIT_*` and every
  `SMTP_*`.
- **Incident troubleshooting** — `docs/PHASE4_RELEASE_READINESS.md:46` has a runbook heading; the
  first-response steps for "API down", "DB unreachable", "outbox stuck", "storage failing" are not
  written.
- **Doc/code contradictions to reconcile** (each verified above): forwarded headers "not trusted"
  vs `application-production.yml:5`; "exponential backoff" vs the linear
  `NotificationDeliveryService.java:89`; sitemap "revalidates hourly" vs a build-time snapshot;
  avatar "deleted from disk" vs S3 mode; `ArchitectureTest`'s Javadoc vs its rules;
  `docs/MOBILE_PHASE5.md:13` "Prepared" vs an unbuildable EAS profile;
  `validate-production-config.ps1:36`'s `SMTP_*` names vs the `spring.mail.*` names Spring reads.
- **All operational scripts are PowerShell** (`dev.ps1`, `restore-drill.ps1`,
  `validate-production-config.ps1`) and will not run on a Linux host. Port the two production ones
  to shell.

## P1-20 · Test coverage gaps that protect the findings above

See the matrix in §I. The highest-value additions, all small:
1. A **Testcontainers** expiry test (P0-5) — the current one is pure Mockito and cannot see
   `@PreUpdate`.
2. A keyed-fuzz test (P0-1): different secret → different offset; same secret → stable.
3. An S3-mode deletion test (P0-4) asserting a `media_cleanup` row for the avatar key.
4. A decode-bomb test (P0-6) asserting rejection before full decode.
5. An `EXPLAIN`-asserting search test (P1-7) — the first in the suite.
6. A production-build Playwright project (P1-17) failing on console CSP errors.
7. An actuator authorization test (P1-1).
8. A favorite-a-stranger's-draft test (P1-4).

---

# F. Post-Launch Improvements — P2

Verified as genuinely deferrable.

| Item | Evidence it can wait |
|---|---|
| **Realtime messaging (WebSockets/SSE)** | Polling is 5 s per open thread (`apps/web/src/app/messages/[id]/page.tsx:159`) and 30 s for the nav badge (`SiteNav.tsx:80`), both bounded, both keyset-paginated at 20, both indexed (`idx_messages_conversation_sent`, `idx_messages_unread` in `V10`). At launch traffic this is a handful of cheap indexed queries per active user. **Polling is sufficient for launch.** Revisit when concurrent open threads × poll rate becomes a measurable share of DB load. |
| **Push notifications** | Absent end to end, not half-built: no token request, no `/devices` endpoint, no device table in any of 25 migrations, only an SMTP `NotificationSender`. Email covers every current event type. **Explicitly deferrable** — but remove the permission prompt now (P1-18). |
| **Responsive image variants / thumbnails** | `next/image` is unused (`.next/export-marker.json` → `isNextImageImported: false`); all photos are raw `<img>` re-encoded to a single full-size JPEG. This is a bandwidth and LCP cost, not a correctness one. Fix `images.remotePatterns` (currently only `http://localhost:9000`, `next.config.mjs:51-55`) and adopt `next/image` after launch; the ~5 MB-per-photo ceiling makes it worth doing reasonably soon. |
| **Distributed rate limiting (Redis)** | Only once a second API instance exists. See §G. |
| **N+1 in conversation inbox and report queue** | `ConversationRepository.java:31-37` has no `join fetch` and the response builder loads the last message per conversation; bounded by PAGE_SIZE 20. `ReportRepository.java:21` `findByStatus` has **no `Pageable`**, so the admin report queue loads the entire PENDING set — worth paginating before the queue gets large, but it is admin-only. |
| **Map picker in the publish wizard** | `README.md` confirms the wizard has "no map picker (raw lat/long inputs)". Owners typing raw coordinates is a data-quality risk for a location-first marketplace — this is the strongest P2 candidate for promotion, since bad coordinates poison search and the fuzzing. `LocationPicker.tsx` already exists on web. |
| **`listing_rooms` and `house_rules` editing** | Both tables exist (`V21`, `V12`) and both are unreachable from the wizard (`README.md`). Schema ahead of UI; harmless. |
| **Neighborhood membership validation** | `V20__neighborhoods.sql` seeds 8–12 names for 4 cities; `ReferenceDataController.java:53-62` documents deliberately *not* enforcing it so a launch-week gap cannot lock out a real owner. Correct call. |
| **Admin "warn" action** | Refused on purpose (`README.md`); `USER_WARNED` exists in the outbox event types. |
| **Data export (right of access)** | No export endpoint exists. Not currently promised anywhere in the legal pages — but confirm that with counsel (§12), because if the privacy notice promises it, it becomes launch-blocking. |
| **Phone verification** | `POST /users/me/phone-verification` returns 501 (`UserController.java:107-109`); `phone_verified` and `VerificationTier` exist. Honest stub. Note the related gap: **phone-based ban evasion is unenforced** — `BannedIdentityRepository.existsByPhone` has no caller (`UserService.java:202-204` checks only email). Low value while phones are unverified. |
| **In-app notification centre** | `README.md`: account sub-pages (notifications, payments, security) are frontend-only mocks. `/account/payments` ships a deliberately disabled control. Make sure nothing there implies a working feature. |
| **PWA installability** | `public/manifest.webmanifest:9-12` has only 32×32 and 180×180 icons — no 192/512, no maskable. |

---

# G. Not Needed Yet — and why

| Technology | Verdict | Reasoning from this repository |
|---|---|---|
| **Kubernetes** | No | One API process, one database, one bucket. A container on a single host (or a managed container service) covers it. K8s would add more moving parts than the entire application has. |
| **Microservices** | No | The modular monolith is *well* factored — `package-info.java` boundaries, an ArchUnit test (however thin), no cross-package repository access. Splitting it would convert in-process transactions (which is how notification enqueue stays atomic with moderation, `ListingExpiryJob.java:37-46`) into distributed ones. That would be a strict downgrade. |
| **Kafka / message broker** | No | The transactional outbox already gives at-least-once delivery with retries, staleness recovery and a DEAD state, using the database you already operate (`V17`/`V19`, `NotificationOutboxRepository.java:17`). One event type family, tens of events per day. |
| **Redis** | No — not yet | The limiter is explicitly process-local and says so (`RateLimitService.java:13-21`). With one instance it is correct. **Trigger:** the moment a second API replica exists, per-instance limits multiply and the limiter must move to a shared store. Fix the bypass (P0-7) first — a distributed limiter keyed on a spoofable IP is no better. |
| **Service mesh / sidecars** | No | Nothing to mesh. |
| **Event sourcing / CQRS** | No | `published_listings` is already the read model, `prior_status` already handles restore. Adequate. |
| **Distributed tracing (OTel/Jaeger)** | No | Correlation IDs already propagate through MDC and the response header (`CorrelationIdFilter.java`). With one API service there is no cross-service hop to trace. **Trigger:** a second service. |
| **Enterprise observability stack (self-hosted Prometheus + Grafana + Loki + Alertmanager)** | No | Micrometer already emits the right metrics; use the host's managed scraping and 6 alerts (P1-11). Self-hosting a monitoring stack means operating two systems to watch one. |
| **Autoscaling / horizontal replicas** | No | The load test at 50 000 listings and 50 concurrent users held p95 < 250 ms on one instance (`docs/PRODUCTION_OPERATIONS.md`). **Trigger:** sustained CPU or p95 latency growth, at which point P0-7 and Redis become prerequisites, not optional. |
| **WebSockets for messaging** | No | See F. Polling is bounded and indexed. |
| **Firestore mirror** | No | `docs/PRODUCTION_OPERATIONS.md` already rejects it; PostgreSQL is authoritative. Agreed. |
| **CDN for the API** | No | A CDN in front of *media* is worth it (and P0-11's media origin assumes one). In front of the JSON API it would mostly risk caching authenticated responses. |
| **Read replicas / connection proxy (PgBouncer)** | No | Pool of 10 on one instance. **Trigger:** connection exhaustion that timeouts (P1-3) do not resolve. |
| **Separate moderation service / ML content scanning** | No | Human moderation with an audit trail plus user reporting with auto-suspension thresholds is the right scale (`ReportService.java:53-62`). |

---

# H. Security Findings Table

*Severity* = impact if exploited. *Priority* = when to fix. They differ: P0-2 (no deployment
artifact) has no severity at all because it is not a vulnerability, while F-08 below is High
severity but reasonably deferred because Dari's own ban path already covers the realistic cases.

| ID | Severity | Area | Finding | Evidence | Fix before launch? |
|---|---|---|---|---|---|
| S-01 | **Critical** | Privacy / crypto | Location fuzz offset is an unkeyed function of the public listing UUID; exact coordinates are recoverable for every listing | `LocationFuzzer.java:18-22` | **Yes** (P0-1) |
| S-02 | **Critical** | Availability | Image dimension/megapixel guard runs *after* `ImageIO.read` fully decodes; a valid 5 MB PNG can allocate GBs and OOM the JVM | `ImageProcessor.java:32-40`; `LocalImageStore.java:53-68` | **Yes** (P0-6) |
| S-03 | **High** | Abuse control | IP rate-limit dimension trusts `X-Forwarded-For` in production, and each forged value allocates an unevicted map entry | `application-production.yml:5`; `RateLimitInterceptor.java:37`; `RateLimitService.java:26,70` | **Yes** (P0-7) |
| S-04 | **High** | Privacy / erasure | Deleted accounts' avatars are never removed in S3 mode, and S3 public URLs bypass the revocation interceptor | `UserService.java:126`; `ImageStore.java:27-29`; `S3ImageStore.java:76-78`; `MediaAccessInterceptor.java` | **Yes** (P0-4) |
| S-05 | **High** | Availability | Nonce CSP + `strict-dynamic` blocks all JS on every prerendered route | `middleware.ts:20`; `.next/prerender-manifest.json` | **Yes** (P0-10) |
| S-06 | **Medium** | Information disclosure | Internal API hostname published in OG tags, JSON-LD and ISR HTML | `config.ts:62-68`; `.env.production.example:2-3`; `listings/[id]/page.tsx:63,69` | **Yes** (P0-11) |
| S-07 | **Medium** | Authorization | Any non-deleted listing (draft/pending/rejected/suspended) can be favorited by a stranger, then read back with coordinates and cover photo | `FavoriteService.java:105-106`; `FavoriteRepository.java:28-33` | **Yes** (P1-4) |
| S-08 | **Medium** | Information disclosure | `/actuator/metrics` + `/actuator/prometheus` readable by any authenticated token, including `ROLE_PROFILELESS` | `application.yml:68`; `SecurityConfig.java:69,114`; `FirebaseAuthFilter.java:113-115` | **Yes** (P1-1) |
| S-09 | **Medium** | Availability | `GET /cities` materialises every published listing per request; public, unlimited | `ReferenceDataController.java:34-45` | **Yes** (P1-2) |
| S-10 | **Medium** | Availability | Public listing detail has no rate limit; 5 queries per call, enumerable | `ListingController.java:163-170` | **Yes** (P1-5) |
| S-11 | **Medium** | Availability | No statement/query/connection timeouts; one pathological query can pin the 10-connection pool | `application.yml:9-11`; no timeout config anywhere | **Yes** (P1-3) |
| S-12 | **Medium** | XSS (mitigated) | Owner-supplied text serialised into JSON-LD via `dangerouslySetInnerHTML` without `<`//` escaping | `ListingDetailContent.tsx:87-90` | **Yes** (P1-15) — one line |
| S-13 | **Medium** | Session | `checkRevoked` unused; Firebase-side revocation honoured only until token expiry (≤1 h) | `FirebaseAuthFilter.java:74` | Strongly recommended (P1-9) |
| S-14 | **Medium** | Transport | No HSTS header on the web app | `next.config.mjs:57-69`; `middleware.ts` | **Yes** (P0-10, same change) |
| S-15 | **Low** | Abuse | No rate limit on any listing mutation except create; each `PATCH` of a PUBLISHED listing re-enters the moderation queue → queue flooding | `ListingController.java:213`; `ListingService.java:178-180` | Recommended |
| S-16 | **Low** | Abuse | `POST /conversations` with only `otherUserId` opens an unsolicited thread with any user id | `CreateConversationRequest.java:16-19`; `ConversationService.java:203-216` | Post-launch |
| S-17 | **Low** | Ban evasion | Phone is recorded in `banned_identities` but never checked at signup; `existsByPhone` has no caller | `UserService.java:202-204`; `BannedIdentityRepository.java:9` | Post-launch |
| S-18 | **Low** | Privacy | A SUSPENDED user's public profile stays fully visible (only BANNED and deleted are hidden) | `UserService.java:231-233` | Post-launch |
| S-19 | **Low** | Log integrity | `X-Correlation-Id` is accepted from the client verbatim, unbounded in length, and written to MDC/logs | `CorrelationIdFilter.java:37-42` | Recommended — cap length, restrict charset |
| S-20 | **Low** | Revocation bypass | `MediaAccessInterceptor` compares the **undecoded** URI against storage keys, so a percent-encoded request can evade the pending-deletion check while the resource handler decodes and serves the file | `MediaAccessInterceptor.java:31-38` | Recommended |
| S-21 | **Low** | Containment | `LocalImageStore.delete` resolves + normalizes but never asserts the result stays under `uploadRoot` | `LocalImageStore.java:101-103` | Recommended (defence in depth; keys are server-generated today) |
| S-22 | **Low** | Reflection | Attacker-supplied strings echoed verbatim into 400 JSON bodies | `ListingService.java:215,243` | Post-launch |
| S-23 | **Low** | Abuse | `sitemapBatch` allows `limit=50000` with unbounded `offset` over `LIMIT/OFFSET` | `ListingSearchService.java:382-384`; `ListingSearchRepository.java:24-25` | Post-launch |
| S-24 | **Informational** | Integrity | Search cursor `queryKey` is a plain SHA-256 of public parameters, not an HMAC, so cursors are forgeable — impact bounded to shifting the keyset predicate with `LIMIT` still 21 | `ListingSearchService.java:585-602` | No |
| S-25 | **Informational** | Operations | An admin can ban themselves; no reflexivity guard | `AdminService.java:396-424` | No |
| S-26 | **Informational** | Enumeration | Conversation 403-vs-404 distinction is an existence oracle for conversation UUIDs | `ConversationService.java:218-225` | No |
| S-27 | **Informational** | Mobile | Cleartext `http://localhost:8080` fallback compiled into the binary | `apps/mobile/src/lib/api.ts:20` | **Yes** for a mobile release (P0-9) |
| S-28 | **Informational** | Web | CSP and `Permissions-Policy` omitted on prefetch responses | `middleware.ts:49` | Resolved by P0-10 |

**Explicitly clean** (searched, nothing found): SQL injection — every native query binds parameters
and the dynamic `ORDER BY` uses `CASE WHEN CAST(:sort AS text)` rather than interpolation, with no
`createNativeQuery` or `EntityManager` usage anywhere. IDOR on listings, photos, conversations,
messages, reports and users — server-side ownership checks on every mutating path with 404-not-403
semantics, and photo sub-resources double-scoped by listing *and* photo id
(`ListingService.java:369-373,412-416`). Admin authorization — enforced twice, at
`SecurityConfig.java:113` and `AdminController.java:39`. Mass assignment — `rejectionReason` carries
`@Null` on both create and update DTOs. Malformed cursors — always 400, never a 500. Stack
traces/SQL in responses — structurally prevented. Secrets in the repository — none committed;
`infra/firebase/service-account.json` exists on disk, is covered by a directory-level `.gitignore`
rule, and `git log --all` shows it was **never** committed. `eval`/`new Function`/`innerHTML` in the
web app — none. Token or credential logging in mobile — zero `console.*` calls at all.

---

# I. Testing Gap Matrix

Existing suite: **147 API tests across 20 classes, 0 failures / 0 errors / 0 skipped** (local run
2026-09-21 12:49, `apps/api/target/surefire-reports`), all integration tests on real PostGIS via
Testcontainers, plus a dedicated `FlywayMigrationSmokeTest` and 4 Playwright journeys.

| Critical behaviour | Existing coverage | Missing coverage | Recommended test | Priority |
|---|---|---|---|---|
| Firebase token verification | `AbstractIntegrationTest` stubs `FirebaseAuth`; `FirebaseConfig` excluded from `test` profile | Revocation (`checkRevoked`) behaviour | Assert a revoked token is rejected once P1-9 lands | P1 |
| Suspended / banned / deleted / profileless gating | Strong — `UserApiTest` (16), `AdminApiTest` (18) | Actuator endpoints under a `USER` token | Extend `SecurityHeadersApiTest` with a 403 assertion | **P1** |
| IDOR / ownership | Strong — every mutating path, 404-not-403, photos double-scoped | Favoriting another user's draft (S-07) | `FavoriteApiTest`: 404 on a stranger's DRAFT | **P1** |
| Listing lifecycle | `ListingApiTest` (53 tests) covers transitions | **Expiry after a warning** — the current test is pure Mockito so `@PreUpdate` never runs | Testcontainers test: warn → advance clock → assert `EXPIRED` | **P0** (P0-5) |
| Coordinate privacy | `LocationFuzzerTest` (3) covers radius/determinism; DTO factories enforce the chokepoint by signature | That the offset is **unpredictable without the secret**; that no public DTO can be built from raw lat/lng | Keyed-fuzz tests + the ArchUnit rule from P1-8 | **P0** (P0-1) |
| Search / PostGIS | `ListingSearchOptimizationTest` (5) asserts correctness; `ListingSearchValidationTest` (2) | **No `EXPLAIN` assertion anywhere** — index usage for the price/updated sorts is unverified | `EXPLAIN (ANALYZE)` test against the seeded 50 k dataset | **P1** (P1-7) |
| Media upload | `ImageProcessorTest` (2) | Decompression bomb; that `LocalImageStore` and `ImageProcessor` share limits | Reject an oversized-dimension PNG before full decode | **P0** (P0-6) |
| Media deletion / erasure | `MediaCleanupServiceTest` (1) | **S3 mode** — avatar cleanup, and the `startsWith("/uploads/")` gate | Deletion test with `provider=s3` asserting a `media_cleanup` row | **P0** (P0-4) |
| Notification outbox | `NotificationDeliveryServiceTest` (3) with a stub sender | The **SMTP wiring itself** (`spring.mail` absent) and the disabled-in-production path | Context test: `production` profile + no `SMTP_HOST` must fail fast | **P0** (P0-3) |
| Scheduled jobs | `ListingExpiryJobTest` (4, mocked) | Concurrency for media cleanup (no lock); idempotency on a real DB | Testcontainers job tests | P1 |
| Messaging | `MessagingApiTest` (11) incl. cursor binding | Unread-count correctness under concurrent send + mark-read | Concurrent-write test | P2 |
| Moderation / reporting | `AdminApiTest` (18), `ReportApiTest` (9), audit-log assertions | Report-queue behaviour when unpaginated and large | Pagination test after P2 fix | P2 |
| Favorites | `FavoriteApiTest` (7) | Non-public listing case (above) | — | P1 |
| Rate limiting | `RateLimitServiceTest` (3), `RateLimitInterceptorTest` (2) | Map growth bound; forged `X-Forwarded-For` | Bounded-map unit test + an integration test with rotating XFF | **P0** (P0-7) |
| Flyway migrations | `FlywayMigrationSmokeTest` — full apply to an empty PostGIS DB | Nothing material | — | — |
| Architecture invariants | `ArchitectureTest` — 2 rules, **neither is the one its own Javadoc describes** | The `listings`-table rule and a fuzzing-chokepoint rule | Add both | **P1** (P1-8) |
| Web production build | CI runs `typecheck`, `lint`, `build` with the env gate live | **No browser runs against a production build** — this is why P0-10 is invisible | Playwright project against `next start`, failing on console errors | **P0** (P1-17) |
| Web a11y | axe on 4 pages, map excluded | Maps; keyboard-only journeys; error/offline states | One keyboard journey; name the maps and stop excluding them | P1 |
| Mobile | **`tsc --noEmit` only** — no lint, no test script, no test file in the tree | Everything behavioural | Real-device matrix (§L/§M); a smoke test on the API client | **P0** for a mobile release |

---

# J. Deployment Readiness Checklist

Evidence-based. Nothing is ✅ without a file backing it.

## Infrastructure
- ❌ Container image / build artifact — no `Dockerfile`, no `.dockerignore`
- ❌ Chosen hosting target — no PaaS/IaC config anywhere, no deployment section in `README.md`
- ❌ Reverse proxy / ingress configuration (and P0-7's correctness depends on it)
- ⚠️ Local dev stack — `docker-compose.yml` is good and explicitly dev-only; the risk is it becoming production by default
- ❌ Graceful shutdown (`server.shutdown` unset), ❌ readiness/liveness groups

## Database
- ✅ Schema ownership by Flyway, `ddl-auto: validate` (`application.yml:16`)
- ✅ 25 migrations apply cleanly to an empty PostGIS DB (`FlywayMigrationSmokeTest`)
- ✅ Constraints, partial indexes, GiST spatial index, enums, TIMESTAMPTZ throughout
- ✅ Public visibility invariant enforced by a view (`V25`)
- ⚠️ Connection pool — size 10 configured, **no** connection/validation timeouts
- ❌ Statement / query timeout
- ❌ Managed or self-managed production instance chosen
- ⚠️ Migration deployment procedure documented (`docs/PRODUCTION_OPERATIONS.md`) but the commands target the dev container

## Backend
- ✅ Stateless bearer-token security, CSRF correctly disabled, CORS explicit and never `*`
- ✅ Consistent French error envelope, no stack traces
- ✅ Bean Validation on 100% of request bodies
- ✅ Transactional outbox with SKIP LOCKED claiming
- ⚠️ Rate limiting — present and well-designed, **bypassable as configured** (P0-7)
- ❌ Config fail-fast — `application-production.yml` requires only 2 variables; the validator is a manual PowerShell script that checks variable names Spring does not read
- ❌ Notification delivery wiring (P0-3)
- ❓ Sorted-search index usage — cannot verify without `EXPLAIN` (P1-7)

## Web
- ✅ Production build gate with 18 required vars and HTTPS enforcement (`next.config.mjs:1-38`)
- ✅ `strict: true` + `noUncheckedIndexedAccess`, no `ignoreBuildErrors`
- ✅ 15 s request timeout with typed failure classes (`api.ts:39-96`)
- ✅ No server secret reaches the client bundle (verified against emitted chunks)
- ✅ No authenticated response is ever cached server-side
- ❌ CSP as delivered breaks prerendered routes (P0-10); ❌ HSTS
- ❌ Public media origin wrong in production (P0-11)
- ❌ `global-error.tsx`; ❌ any `loading.tsx`; ⚠️ no 401 handling
- ⚠️ SEO — canonicals, per-route metadata, JSON-LD and `noindex` for unavailable listings are all correct; sitemap/robots are build-frozen and profile pages have no metadata

## Mobile
- ✅ Real bundle/package identifiers (`ma.dari.app`), all icon assets present
- ✅ Auth persistence + `authStateReady()` race handled
- ✅ Offline cache, retry, cursor recovery, optimistic rollback
- ❌ Production EAS `env`; ❌ EAS `projectId`; ❌ Google Maps Android key; ❌ splash config;
  ❌ `versionCode`/`buildNumber`; ❌ usable `submit` profile
- ❌ Crash reporting; ❌ error boundary; ❌ request timeout; ❌ in-app legal link
- ❌ Any real-device verification (`docs/MOBILE_PHASE5.md:34` states no device/store/EAS access existed)

## Firebase
- ✅ Admin SDK verification server-side; ✅ key never committed (`git log --all` clean)
- ✅ Public web/mobile config correctly treated as non-secret
- ⚠️ Credentials supplied only as a **file path** (`FirebaseConfig.java:29-39`) — needs a mounted secret file; no env-var/`GOOGLE_APPLICATION_CREDENTIALS` path
- ⚠️ `FIREBASE_PROJECT_ID` is advertised in `.env.example` but **read by nothing** in the API
- ❌ Production Firebase project, authorized domains, and revocation policy confirmed

## Storage
- ✅ Provider abstraction with two adapters; ✅ durable cleanup outbox; ✅ EXIF-stripping re-encode
- ⚠️ `S3ImageStore` is a hand-rolled SigV4 client on `HttpClient.newHttpClient()` with **no connect
  or request timeout** (`S3ImageStore.java:29`) — a hung endpoint blocks a servlet thread
  indefinitely; no retry; no `Cache-Control` on PUT
- ❌ S3 credentials fail-fast — `application.yml:83-85` defaults them to empty strings, so the app
  boots and every upload fails at runtime with 503 instead of failing at startup
- ❌ Bucket, permissions, CORS, lifecycle and CDN TTL decided
- ❌ `/uploads/**` vs S3 parity — revocation works only in local mode (P0-4)

## SMTP
- ❌ `spring.mail` configuration exists only in documentation (P0-3)
- ❌ Provider chosen, sender domain aligned (SPF/DKIM/DMARC)
- ⚠️ `SMTP_CONFIGURATION.md` is thorough but prescribes variable names Spring does not read

## DNS / HTTPS
- ❌ Production domain, certificates, TLS termination, HSTS preload decision
- ✅ The API assumes TLS is terminated upstream and sets HSTS itself
  (`SecurityConfig.java:57-59`) with `forward-headers-strategy: framework`

## Monitoring
- ✅ Micrometer + Prometheus endpoint; ✅ domain gauges (queue depth, outbox depth, cleanup failures);
  ✅ correlation IDs
- ❌ Anything scraping or alerting; ❌ uptime check; ❌ error tracking (deliberate, but needed now)
- ⚠️ Metrics endpoint authorization (P1-1)

## Backups
- ✅ A genuinely good written policy (retention, offsite, immutability, alert conditions, RPO)
- ✅ A restore *procedure* with row-count and PostGIS version checks
- ❌ Any automation; ❌ any backup ever taken; ❌ any restore drill performed; ❌ measured RTO
- ⚠️ Scripts are PowerShell only

## Security
- ✅ No committed secrets; ✅ CodeQL both languages; ✅ OWASP Dependency-Check failing at CVSS ≥ 7
  with a required NVD key; ✅ `npm audit` at high/critical; ✅ dependency-review on PRs
- ⚠️ `docs/PHASE4_RELEASE_READINESS.md:15` self-reports 14 unresolved *moderate* Expo-chain
  advisories pending an Expo upgrade — ❓ current count not re-verified (no `npm audit` run)
- ❌ The P0 items above

## Legal / Privacy operational review
- ✅ Legal pages cannot ship with placeholders (build gate on 11 `DARI_LEGAL_*` vars)
- ✅ Account deletion implemented with PII scrub
- ❌ Counsel review of the privacy notice and terms (`docs/LEGAL_RELEASE.md` names it as a release
  prerequisite and it is not done)
- ❌ CNDP position confirmed — see §12 questions below
- ❌ Processor inventory and international-transfer assessment (Firebase, SMTP, S3, host — all
  likely outside Morocco)
- ❌ Retention periods implemented (messages, reports, admin audit rows are retained indefinitely by
  design; `DARI_LEGAL_RETENTION` is a string on a page, not an enforced policy)
- ❌ Mobile in-app privacy link (store requirement)
- ❓ Right of access / data export — no endpoint exists; whether it is promised depends on the
  notice counsel approves

### Privacy questions requiring verification (not legal advice)

What Dari actually collects, verified from the schema: names (`users.display_name`,
`first_name`), email, optional phone, avatar and listing photos, city/bio, **exact coordinates**
(`listings.latitude/longitude` and the generated `location` column), message bodies
(`messages.body`, retained after the sender's deletion by design), report contents and reporter
identity, admin audit rows with `metadata JSONB`, Firebase UIDs, and client IP addresses (reaching
the rate limiter and, in practice, the reverse proxy's logs).

Questions for counsel / CNDP:
1. Does this processing require a CNDP declaration or authorisation, and under which lawful basis
   per purpose (`DARI_LEGAL_LAWFUL_BASES` is currently a free-text string)?
2. Firebase Auth, the SMTP provider, object storage and the host are all likely outside Morocco.
   What does Law 09-08 require for those transfers, and does any need to be in Morocco?
3. Is retaining message bodies and reporter identity after account deletion defensible as the
   counterparty's and moderator's legitimate interest? The code documents that reasoning
   (`UserService.java:151-160`) — it needs legal confirmation, and a retention *limit*.
4. Must a data-export (right of access) mechanism exist at launch?
5. Does publishing an approximate location require disclosure of the fuzzing, and is ~200 m
   adequate? (Fix P0-1 regardless — right now the answer is "it is 0 m".)
6. Is the 3-distinct-reporters auto-suspension (`ReportService.java:53-62`) an automated decision
   requiring notice or a human-review path?

---

# K. Proposed Initial Production Architecture

Smallest architecture that serves real users safely. Two options; **A is recommended** unless cost
is the binding constraint.

```
                             ┌──────────────────────────────┐
   Internet ────────HTTPS───>│  Managed frontend host       │   Next.js (apps/web)
                             │  TLS, CDN, HSTS              │   static + ISR + dynamic routes
                             └──────────────┬───────────────┘
                                            │ server-side fetch (API_BASE_URL)
                                            ▼
   Internet ────────HTTPS───> Reverse proxy / ingress ─────> Spring Boot API (one instance)
                              · terminates TLS               · /actuator/health{,/readiness}
                              · OVERWRITES X-Forwarded-For    · Flyway on startup
                                (P0-7 depends on this)        · in-process scheduled jobs
                                            │
                     ┌──────────────────────┼──────────────────────┬────────────────┐
                     ▼                      ▼                      ▼                ▼
        PostgreSQL 16 + PostGIS    S3-compatible bucket      SMTP provider    Firebase Auth
        · daily automated dump     · private bucket          · SPF/DKIM/      · ID token issuance
        · PITR if managed          · public reads via CDN      DMARC on the   · Admin SDK verifies
        · offsite, versioned,        with a short TTL           sender domain   (service-account
          immutable copies         · lifecycle rule for                          file, mounted)
        · restore drill logged       orphans

        Uptime monitor ──> web homepage + /actuator/health          (external, third-party)
        Metrics scrape ──> /actuator/prometheus on a private port   (host's managed Grafana)
        Error tracking ──> API + web + mobile                       (P1-10)
```

**Why each component exists**
- **Managed frontend host** — the web app is static + ISR + a few dynamic routes; a managed host
  gives TLS, CDN and HSTS with no servers to patch. It is also the cheapest way to get the caching
  behaviour P1-13 needs.
- **Reverse proxy in front of the API** — required, not optional: it terminates TLS, and it is the
  only place that can make `X-Forwarded-For` trustworthy. P0-7's fix lives here.
- **One API instance** — justified by the load test (50 k listings, 50 concurrent users, p95 < 250 ms
  on one process). One instance is also what makes the process-local limiter and in-process
  scheduler correct. Do not add a second without reading §G's triggers.
- **PostgreSQL + PostGIS** — non-negotiable; the search path is built on `geography` and GiST.
- **Object storage + CDN** — photos are the product; the CDN TTL bounds erasure completeness (P0-4).
- **SMTP provider** — a real provider with aligned DNS; self-hosting mail at this scale is a
  deliverability trap.
- **Firebase Auth** — already the identity provider; keep it.
- **Uptime + metrics + error tracking** — the minimum to know Dari is broken before users report it.

**Option A — lowest operational complexity (recommended).** Managed Postgres with automated backups
and PITR; managed container/app host for the API; managed frontend host for web; managed object
storage; transactional email provider; external uptime monitor. You operate zero servers. Backups
become a provider setting plus a restore drill (P0-8 shrinks to a checklist item).

**Option B — lower cost, more self-managed.** One VPS running the API container and Postgres+PostGIS
behind Caddy or nginx (automatic TLS), object storage from a cheap S3-compatible provider, same email
and uptime services. You then own: `pg_dump` automation + offsite upload + restore drills, OS
patching, TLS renewal monitoring, and disk-space alerting. Choose B only if you will actually run
the backup drills — an unbacked-up VPS is the single largest risk in this entire document.

---

# L. Mobile Release Checklist

## Shared
- [ ] `eas init` → `extra.eas.projectId` committed
- [ ] `env` block on all three `eas.json` profiles; production points at the real HTTPS API
- [ ] Remove the `http://localhost:8080` fallback in `src/lib/api.ts:20`; fail loudly instead
- [ ] `splash` configured; `assets/splash-icon.png` actually referenced
- [ ] Request timeout in `src/lib/api.ts`
- [ ] Root `ErrorBoundary` export
- [ ] Crash reporting wired and a test crash confirmed in the dashboard
- [ ] In-app privacy policy + terms links (store requirement)
- [ ] Remove the "Activer les notifications" control until push exists (`app/(tabs)/profile.tsx:96`)
- [ ] Android deletion confirmation matched to iOS (custom modal, not `Alert.prompt`)
- [ ] Deep links: decide `dari://` only vs universal/app links; fix the singular/plural mismatch
      (`app/_layout.tsx:87` `listing` vs web's `/listings/[id]`) and the dead `account-recovery`
      branch (`:89`, web route is `profile-recovery`)
- [ ] Remove the unused `expo-device` dependency
- [ ] Correct `docs/MOBILE_PHASE5.md:13`'s "Prepared" claim
- [ ] Resolve or formally accept the 14 moderate Expo-chain advisories

## Android
- [ ] `android.config.googleMaps.apiKey` (the Carte tab is blank without it), key restricted to the
      package + SHA-1
- [ ] `versionCode` strategy confirmed (currently delegated to `autoIncrement`)
- [ ] Review and prune the autolinked permission set — `app.json:20-29` declares **none**, so the
      merged manifest is whatever `expo-image-picker`/`expo-notifications`/`netinfo` add. Run
      `expo prebuild` and read the result before filling the Play data-safety form.
- [ ] Play Console: data-safety declaration, privacy policy URL, content rating, target API level
- [ ] Internal testing track → install on ≥2 real devices (one low-end, one recent)
- [ ] Confirm no cleartext HTTP remains (Android 9+ blocks it by default)

## iOS
- [ ] `buildNumber` strategy confirmed
- [ ] `ascAppId` + `appleTeamId` in `eas.json` `submit.production` (currently `{}`)
- [ ] Signing: distribution certificate + provisioning profile
- [ ] Replace the inert `NSUserNotificationUsageDescription` (`app.json:17`) — iOS has no such key;
      keep the camera and photo-library strings, which are correct and in French
- [ ] App Privacy questionnaire; privacy policy URL; account-deletion path documented for review
      (Apple requires in-app deletion — it exists, confirm it is discoverable)
- [ ] TestFlight internal build → install on a real iPhone

## Real-device verification (both platforms, before submission)
Sign up · verify email gate · create profile · search list · **search map (Android especially)** ·
filter · open listing · favorite · start conversation · send + receive (with the app backgrounded) ·
publish a listing with camera and library photos · reorder + delete photos · submit for moderation ·
report a listing · delete the account · kill and relaunch (session must persist) · airplane mode on
every screen · slow/lossy network · deep link from a cold start.

---

# M. Manual Pre-Launch Test Plan

Run against production configuration, not localhost. Desktop web is the launch gate; mobile web
matters because most Moroccan traffic is mobile.

**1 · Configuration and startup (do first)**
- API starts with only the documented production variables; **fails fast** with a named variable
  when each required one is removed in turn (esp. `SMTP_HOST`, the new fuzz secret, S3 credentials)
- `/actuator/health` returns UP; `/actuator/prometheus` is **not** reachable by a normal user token
- Web production build serves `/sign-in` with **zero CSP violations** and full interactivity (P0-10)
- `curl -I` the web app: HSTS, CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` all present
- Grep the built HTML for the internal API hostname — it must be absent (P0-11)

**2 · Tenant journey** (desktop web, mobile web, Android, iOS)
Search → filter (price, amenities, property type) → map view → open listing → confirm the pin is
*near* but not *at* the address → favorite → contact owner → send a message → receive a reply →
report the listing → confirm a neutral acknowledgement that reveals no moderation outcome

**3 · Owner journey** (desktop web, then Android/iOS)
Sign up → email verification gate → create profile → upload an avatar → create a draft → set
location → property details → room details → photos (upload, set cover, reorder, delete) → submit →
confirm it is **not** in public search → (admin approves) → confirm it appears → receive the approval
**email** → receive a message → mark room found → confirm it leaves search → reopen → edit → confirm
it returns to `PENDING_REVIEW` and leaves search → renew

**4 · Admin journey**
Sign in as admin → pending queue → approve one → reject one with a reason → confirm the owner gets
the rejection email with the reason → report queue → dismiss → suspend a listing → suspend a user →
confirm the suspended user can read but **cannot** write anything → unsuspend → ban a user → confirm
re-registration with the same email is blocked → verify every action produced an `admin_actions` row

**5 · Privacy and deletion**
- Fetch a listing as an anonymous user and confirm: no exact coordinates, no owner email/phone, and
  no coordinates in the JSON-LD, OG tags or sitemap
- Attempt the P0-1 recovery attack against the fixed build and confirm it fails
- Upload a photo with GPS EXIF; download it back and confirm the metadata is gone
- Delete an account: PII scrubbed, listings gone from search, **avatar object gone from the bucket**,
  Firebase identity gone, counterparty's conversation still readable with "Utilisateur supprimé"
- Confirm a deleted user can re-register with the same email

**6 · Failure injection** (the tests that matter most, and the ones usually skipped)
- Stop Postgres mid-session → French error, no stack trace, no hang; restart → recovery without an
  API restart
- Point SMTP at a closed port → outbox rows retry then go DEAD, no credentials in logs
- Make object storage unreachable → upload returns 503 with a French message; deletion queues and
  retries
- Kill the API mid-request → confirm graceful shutdown drains in-flight work (after P1-3)
- Upload a 5 MB PNG declaring 30 000×30 000 → rejected, API still alive (P0-6)
- Send 200 searches with rotating `X-Forwarded-For` → 429 at the threshold (P0-7)
- Airplane mode on every mobile screen, then reconnect
- Expire/revoke a token mid-session on web → sensible re-auth, not a dead page

**7 · Accessibility spot-check**
Keyboard-only: complete the publish wizard; open and close the report dialog (focus returns);
traverse search filters. Screen reader: the sort control must not announce as a tab; a new incoming
message must be announced.

---

# N. Failure / Recovery Plan

| Failure | Expected behaviour | Current protection | Missing protection | Recovery |
|---|---|---|---|---|
| **PostgreSQL unavailable** | French 5xx, no stack trace; recovery without an API restart | Catch-all returns a fixed French message (`GlobalExceptionHandler.java:148-160`); Hikari reconnects | No connection/validation timeout, no statement timeout, no readiness probe → the instance keeps accepting traffic it cannot serve, and a hung query pins the pool of 10 (P1-3) | Restore service; if data is lost, restore the latest dump (P0-8) — **untested today** |
| **PostgreSQL data loss** | Restore to ≤24 h RPO | A written policy and a restore procedure | **No backup has ever been taken**; no automation; no measured RTO | Follow `docs/PRODUCTION_OPERATIONS.md` — first execution would be during the incident |
| **API instance down** | Platform restarts it; users see the web app's error state | Web server components degrade gracefully (`page.tsx:54-62` `.catch(() => [])`); typed client errors | No liveness probe, no graceful shutdown, no uptime monitor, no error tracking — **you would learn from a user** | Restart; Flyway is idempotent, so a restart is safe |
| **Flyway migration fails at startup** | App refuses to start; previous release stays up | Boot fails fast by default; `FlywayMigrationSmokeTest` gates it in CI; expand-then-contract policy documented | No pre-deploy backup automation to roll back *to*; no documented forward-fix procedure | Redeploy the previous artifact (schema is backward-compatible by policy), then fix forward |
| **Next.js web down** | API unaffected; mobile unaffected | Independent processes | No uptime monitor | Redeploy; managed host rollback |
| **Firebase unavailable** | Existing valid tokens keep working until expiry; new sign-ins fail | Token verification is local after key fetch; keys warmed at startup (`FirebaseWarmup.java:26`) | `firebaseAuth.deleteUser` sits **inside** the deletion transaction with no timeout (`UserService.java:138`) — a hung Firebase holds DB locks open | Wait out the outage; deletion correctly rolls back and can be retried |
| **Object storage unavailable** | Uploads fail with a French 503; deletions queue and retry | `S3ImageStore` maps failures to 503; `media_cleanup` retries with backoff | **No timeout on the S3 HTTP client** (`S3ImageStore.java:29`) → servlet threads block indefinitely; no retry on PUT; no DEAD state for cleanup (P1-6) | Storage returns; cleanup drains. Add timeouts first. |
| **SMTP unavailable** | Rows retry, then DEAD; nothing else breaks | Retry with backoff, stale-claim recovery, DEAD state, per-outcome counters | **Not wired at all** (P0-3); no alert on DEAD or on a rising PENDING depth | Fix SMTP, reset DEAD rows to PENDING manually — no tooling exists for that |
| **Image processing fails** | 400/500 with a French message | Invalid images rejected cleanly | A decompression bomb OOMs the JVM before any check (P0-6) | Process restart |
| **Missing env var at deploy** | Startup fails with a named variable | Web: yes, strong gate (18 vars, `next.config.mjs:1-38`). API: only `DARI_WEB_ORIGIN` + `FIREBASE_CREDENTIALS_PATH` | API silently accepts empty S3 credentials, a `dari_local` DB password default, and notifications off | Add an API startup validator (P0-3) |
| **Two API instances run concurrently** | No duplicate side effects | Expiry job ShedLocked; outbox claims with SKIP LOCKED; conversation creation guarded by unique indexes + ON CONFLICT | Media cleanup has **no** lock (P1-6); rate limits multiply per instance (§G) | Run one instance until Redis + a trusted-proxy boundary exist |
| **Disk full (local storage mode)** | Uploads fail cleanly | `IOException` → French 503 | No disk-space alert; production should not use local mode at all | Switch to S3 mode; alert on disk |
| **API restarts mid-work** | In-flight requests complete or fail cleanly; jobs resume | Outbox and cleanup are durable and idempotent-ish; `SENDING` rows reclaimed after 15 min | No graceful shutdown → in-flight requests are cut; a job killed mid-run relies on ShedLock's `lockAtMostFor` | Automatic on restart |

---

# O. Backup / Restore Plan

Keep `docs/PRODUCTION_OPERATIONS.md`'s policy — it is already correct. What is missing is execution.

**What is backed up**
1. **PostgreSQL** — the only irreplaceable state: users, listings, coordinates, messages, reports,
   audit rows, outboxes. `pg_dump -Fc` (custom format, restorable selectively).
2. **Object storage** — listing photos and avatars. Not in the dump. Enable **bucket versioning**
   plus a cross-region or cross-account replication rule; that is the backup. Photos are
   user-reuploadable in the worst case, but a bucket deletion without versioning is unrecoverable.
3. **Firebase Auth** — not backed up by Dari and not Dari's to back up. Note the consequence: a
   Firebase project loss orphans every `users.firebase_uid`. Document it; do not engineer for it.
4. **Not backed up, deliberately** — the built artifacts (rebuildable from a tagged commit) and
   secrets (they live in the secret store, which has its own backup story you should confirm).

**Frequency** — daily dump in the lowest-traffic window, **plus a dump immediately before every
deployment that includes a migration** (already in the release contract). Managed Postgres with PITR
reduces the RPO from 24 h to minutes; take it if option A.

**Retention** — as written: 35 daily, 12 weekly, 12 monthly. Enforce with a bucket lifecycle rule,
not a script.

**Where** — a versioned, server-side-encrypted, object-locked bucket in a **different account or
project** from production, with write access limited to the backup role. A backup in the same
account as the thing it protects is not offsite.

**How restoration works** — the procedure in `docs/PRODUCTION_OPERATIONS.md` is sound: fresh
PostGIS 16 container → `pg_restore --no-owner --exit-on-error` → row counts on `users`, `listings`,
`flyway_schema_history` → `postgis_full_version()`. Two additions: also assert
`SELECT count(*) FROM published_listings` (it exercises the view, which is the public-visibility
invariant) and run one `ST_DWithin` query (it exercises the GiST index and PostGIS itself).

**How restore testing should be performed** — weekly, automated *invocation* with a human reading
the result. Record: archive timestamp, restore duration, row counts, PostGIS version, operator.
**The first drill's duration is the RTO** — the document correctly refuses to promise a number
before measuring one; measure it before launch, not after.

**Alerting** — the policy already names the right conditions; implement them: no backup object in
25 h, upload failure, archive unexpectedly small, last successful restore verification older than
7 days. Use a dead-man's-switch so a *missing* run alerts, since a cron that never fires produces no
error.

---

# P. Environment Variable Inventory

Built from the source, not from the docs. **No values shown.** "Validation present?" means the
application or a gate refuses to start without it.

## API (`apps/api`)

| Variable | Secret? | Required in production? | Purpose | Validation present? |
|---|---|---|---|---|
| `DB_URL` | No | **Yes** | JDBC URL (`application.yml:6`) | ⚠️ Script only (`validate-production-config.ps1:22`); app falls back to `localhost:5432` |
| `POSTGRES_USER` | No | **Yes** | DB user (`application.yml:7`) | ⚠️ Script only; app defaults to `dari` |
| `POSTGRES_PASSWORD` | **Yes** | **Yes** | DB password (`application.yml:8`) | ⚠️ Script only; **app defaults to `dari_local`** |
| `API_PORT` | No | No | Listen port (`application.yml:58`) | Defaults to 8080 |
| `SPRING_PROFILES_ACTIVE` | No | **Yes** (`production`) | Selects `application-production.yml` | ❌ None — omitting it silently uses dev defaults |
| `FIREBASE_CREDENTIALS_PATH` | **Yes** (file) | **Yes** | Service-account JSON path (`FirebaseConfig.java:29`) | ✅ Required in `application-production.yml:10`; script checks the file exists |
| `FIREBASE_PROJECT_ID` | No | No | Advertised in `.env.example` — **read by nothing in the API** | ❌ Dead variable |
| `DARI_WEB_ORIGIN` | No | **Yes** | CORS allow-list, binds to `List<String>` (`SecurityConfig.java:121`) | ✅ Required in `application-production.yml:8`; script enforces HTTPS-only origins |
| `DARI_UPLOAD_DIR` | No | Local mode only | Disk root (`application.yml:75`) | Defaults to `./uploads` |
| `DARI_MEDIA_PROVIDER` | No | **Yes** (`s3`) | Selects the adapter (`application.yml:77`) | ⚠️ Script only; **app defaults to `local`** |
| `DARI_MEDIA_PUBLIC_BASE_URL` | No | **Yes** | Public media URL prefix (`S3ImageStore.java:42`) | ⚠️ Script only; defaults to `/uploads` |
| `DARI_MEDIA_S3_ENDPOINT` | No | S3 mode | Endpoint (`application.yml:81`) | ⚠️ Script only |
| `DARI_MEDIA_S3_REGION` | No | S3 mode | SigV4 region | Defaults to `eu-west-1` |
| `DARI_MEDIA_S3_ACCESS_KEY` | **Yes** | S3 mode | SigV4 key | ❌ **Defaults to empty string** — app boots, uploads 503 at runtime |
| `DARI_MEDIA_S3_SECRET_KEY` | **Yes** | S3 mode | SigV4 secret | ❌ Defaults to empty string |
| `DARI_MEDIA_S3_BUCKET` | No | S3 mode | Bucket name | ❌ Defaults to empty string |
| `DARI_MEDIA_CLEANUP_INTERVAL_MS` | No | No | Cleanup cadence | Defaults to 60 000 |
| `DARI_NOTIFICATIONS_ENABLED` | No | **Yes** (`true`) | Gates the delivery **and** sender beans | ❌ **Defaults to `false`; production profile does not set it** (P0-3) |
| `DARI_NOTIFICATIONS_FROM` | No | **Yes** | Sender address (`SmtpNotificationSender.java:18`) | ✅ `getRequiredProperty` — but only if the bean exists |
| `DARI_NOTIFICATIONS_BATCH_SIZE` / `_MAX_ATTEMPTS` / `_RETRY_DELAY_SECONDS` / `_STALE_AFTER_MINUTES` / `_DELIVERY_INTERVAL_MS` | No | No | Outbox tuning (`application.yml:104-108`) | Defaults present |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` | **Yes** (last two) | **Yes** | Documented in `SMTP_CONFIGURATION.md` and checked by the script — **but no `application*.yml` maps them to `spring.mail.*`, so Spring never reads them** | ❌ Broken contract (P0-3) |
| `SPRING_MAIL_HOST` etc. | **Yes** | Currently the *only* names Spring would read | Boot's mail autoconfiguration | ❌ Undocumented anywhere |
| `DARI_RATE_LIMIT_{REPORT,MESSAGE,LISTING,UPLOAD,SIGNUP,SEARCH}_{MAX,WINDOW}` | No | No | Limiter tuning (`application.yml:112-130`) | Defaults present; **absent from `.env.example`** |
| `DARI_LISTING_EXPIRY_*` / `dari.listing.expiry-cron` | No | No | Expiry policy (`application.yml:96-98`, `ListingExpiryJob.java:35`) | Defaults present |
| `DARI_LOCATION_FUZZ_SECRET` | **Yes** | **Yes** | **Does not exist yet** — required by P0-1 | ❌ To be added, must fail fast |

## Web (`apps/web`)

All 18 below are enforced by `next.config.mjs:4-24` at `next build`/`next start` when
`NODE_ENV=production`, with HTTPS enforced on the URL-shaped ones (`next.config.mjs:29`). That gate
is the strongest configuration control in the repository.

| Variable | Secret? | Required in production? | Purpose | Validation present? |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | No (public) | **Yes** | Browser → API base, must end `/api/v1` (`config.ts:44`) | ✅ Gate + HTTPS + path check |
| `API_BASE_URL` | No | **Yes** | Server → API base (`config.ts:66`) | ❌ **Not in the gate's required list** (P0-11) |
| `NEXT_PUBLIC_SITE_URL` | No | **Yes** | Canonicals, OG, sitemap, robots | ✅ Gate; ⚠️ seven unguarded `?? 'http://localhost:3000'` fallbacks |
| `NEXT_PUBLIC_MEDIA_ORIGINS` | No | **Yes** | CSP `img-src`/`connect-src` — **never used to build a URL** (P0-11) | ✅ Gate; ❌ absent from `.env.local.example` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | No (public by design) | **Yes** | Firebase web config | ✅ Gate |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | No | **Yes** | Firebase + CSP `frame-src`/`connect-src` | ✅ Gate |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | No | **Yes** | Firebase web config | ✅ Gate |
| `NEXT_PUBLIC_RELEASE_VERSION` | No | **Yes** | Error-report tagging (`reporting.ts:21`) | ✅ Gate |
| `NEXT_PUBLIC_E2E_TEST_MODE` | No | **No — must be unset** | Relaxes CSP to allow `unsafe-eval`; guarded by `NODE_ENV !== 'production'` (`middleware.ts:17`) | ⚠️ Double-guarded; keep it out of production anyway |
| `DARI_LEGAL_ENTITY_NAME`, `_ADDRESS`, `_REGISTRATION`, `_CONTACT`, `_JURISDICTION`, `_COMPLAINT_AUTHORITY`, `_RETENTION`, `_PROCESSORS`, `_LAWFUL_BASES`, `_EFFECTIVE_DATE`, `_VERSION` | No | **Yes** (11 vars) | Legal page content, owner/counsel supplied (`legal.ts:19-30`) | ✅ Gate (`next.config.mjs:11-21`); ⚠️ duplicated by the uncalled `validateProductionBuildConfig()` |

## Mobile (`apps/mobile`)

**Inlined at bundle time** — they cannot be changed after the build, which is what makes P0-9 a
blocker rather than a configuration task.

| Variable | Secret? | Required in production? | Purpose | Validation present? |
|---|---|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | No | **Yes** | API base (`src/lib/api.ts:20`) | ❌ Falls back to `http://localhost:8080/api/v1`; **not in `eas.json`** |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | No (public) | **Yes** | Firebase (`src/lib/firebase.ts:50`) | ⚠️ Runtime gate blocks the app (`config.ts:1-5`) but there is no build-time gate |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | No | **Yes** | Firebase (`firebase.ts:51`) | ⚠️ Same |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | No | **Yes** | Firebase (`firebase.ts:52`) | ⚠️ Same |
| Google Maps Android API key | **Yes** | **Yes** | `react-native-maps` on Android | ❌ **Not configured at all** |

## CI (`.github/workflows`)
`NVD_API_KEY` — required secret for OWASP Dependency-Check; the job fails loudly without it
(`security.yml:56-62`). Good. All other CI env values are deliberate `*.example.invalid`
placeholders (`client-quality.yml:19-44`), correctly keeping the production gate live during
`next build`.

---

# Q. Final Implementation Roadmap

Ordered so each phase unblocks the next. Complexity is Small / Medium / Large — no time estimates.

## Phase 1 — Security and privacy blockers

**Task 1.1 — Key the location fuzzer**
Objective: make the public coordinate offset unpredictable without a server secret, while keeping it
deterministic. App: API. Files: `listing/LocationFuzzer.java`, `ListingSearchService.java`,
`FavoriteService.java`, `application*.yml`, `.env.example`, `LocationFuzzerTest.java`.
Dependencies: none. Acceptance: exact coordinates are not recoverable from public data; offset is
stable per listing per secret; startup fails without the secret in production; tests per P0-1.
**Complexity: Small.**

**Task 1.2 — Check image dimensions before decoding**
Objective: remove the OOM path. App: API. Files: `media/ImageProcessor.java`,
`media/LocalImageStore.java` (collapse the duplicate limits into `ImageProcessor`),
`ImageProcessorTest.java`. Dependencies: none. Acceptance: a 5 MB PNG declaring 30 000² is rejected
with the French message and no large allocation; both stores share one validation path.
**Complexity: Small.**

**Task 1.3 — Make rate limiting real in production**
Objective: a trustworthy client identity and a bounded limiter. App: API + ingress. Files:
`application-production.yml`, `common/ratelimit/RateLimitService.java`, `RateLimitInterceptor.java`,
`README.md`, `docs/PRODUCTION_OPERATIONS.md`. Dependencies: Task 3.1 (ingress chosen). Acceptance:
rotating `X-Forwarded-For` does not obtain new buckets; the window map stops growing at a configured
cap; the docs match the code. **Complexity: Medium.**

**Task 1.4 — Fix the web CSP and add HSTS**
Objective: JavaScript runs on every route; strict headers survive caching. App: Web. Files:
`src/middleware.ts`, `next.config.mjs`, `e2e/playwright.config.ts`. Dependencies: none.
Acceptance: `next start` serves `/sign-in` and `/` with zero CSP violations and full interactivity;
HSTS present; a production-build Playwright project fails on console errors. **Complexity: Small.**

**Task 1.5 — Close the smaller authorization and disclosure gaps**
Objective: clear the cheap High/Medium findings in one pass. App: API + Web. Files:
`config/SecurityConfig.java` (actuator → ADMIN or a private port), `listing/FavoriteService.java`
(require public visibility on add), `listing/ListingController.java` +
`listing/ReferenceDataController.java` + `user/UserController.java` (`@RateLimited`),
`listing/ReferenceDataController.java` (DB-side city aggregation),
`ListingDetailContent.tsx` (JSON-LD escaping), `common/logging/CorrelationIdFilter.java` (cap
length/charset), `media/MediaAccessInterceptor.java` (decode the URI before comparing),
`media/LocalImageStore.java` (assert the delete path stays under the root).
Dependencies: none. Acceptance: S-07 through S-12 and S-19 through S-21 closed, each with a test.
**Complexity: Medium.**

## Phase 2 — Data safety, correctness and recovery

**Task 2.1 — Fix listing expiry**
Objective: expiry actually fires. App: API. Files: new `V27__listing_expires_at.sql`,
`listing/Listing.java`, `ListingRepository.java`, `ListingExpiryJob.java`, `ListingService.java`,
`ListingExpiryJobTest.java` (rewrite as Testcontainers). Dependencies: none. Acceptance: a warned
listing still expires; an owner edit does not reset the clock; renewal extends it; a real-DB test
covers warn → expire. **Complexity: Medium.**

**Task 2.2 — Store media keys, not rendered URLs**
Objective: erasure works in S3 mode. App: API. Files: new `V26__user_avatar_storage_key.sql`,
`user/User.java`, `user/UserService.java`, `user/dto/UserResponse.java`,
`user/dto/PublicProfileResponse.java`, delete the dead `ListingPhotoResponse.from(photo)` overload,
`UserApiTest.java` (**coordinate with your uncommitted change**). Dependencies: none. Acceptance:
account deletion and avatar replacement enqueue cleanup in **both** storage modes, proven by an
S3-mode test. **Complexity: Medium.**

**Task 2.3 — Harden the media cleanup worker**
Objective: failures are terminal, visible and single-flighted. App: API. Files: new
`V28__media_cleanup_dead.sql`, `media/MediaCleanupService.java`, `MediaCleanupRepository.java`,
`MetricsConfig.java`, `MediaCleanupServiceTest.java`. Dependencies: 2.2. Acceptance: a permanently
failing key reaches DEAD; `@SchedulerLock` applied; a gauge exposes DEAD count.
**Complexity: Small.**

**Task 2.4 — Add timeouts to the S3 client and the Firebase deletion call**
Objective: no external call can block a thread or hold DB locks indefinitely. App: API. Files:
`media/S3ImageStore.java` (connect + request timeout, one retry, `Cache-Control` on PUT),
`user/UserService.java` (bound the Firebase call). Dependencies: none. Acceptance: an unreachable
endpoint fails within the timeout and returns 503. **Complexity: Small.**

**Task 2.5 — Automate backups and run the first restore drill**
Objective: a recoverable database. App: Infrastructure. Files: new `infra/scripts/backup.sh`, new
`infra/scripts/restore-drill.sh`, scheduler unit, `docs/PRODUCTION_OPERATIONS.md` (replace the
dev-container commands). Dependencies: Phase 3. Acceptance: two unattended backups, a successful
restore of the second into a throwaway PostGIS 16 instance with the row-count, view and `ST_DWithin`
checks, a recorded RTO, and a firing missing-backup alert. **Complexity: Medium.**

## Phase 3 — Deployment

**Task 3.1 — Containerise the API and choose the architecture**
Objective: a runnable production artifact. App: API + Infrastructure. Files: new
`apps/api/Dockerfile` (multi-stage, non-root, `MaxRAMPercentage`), new `apps/api/.dockerignore`,
`README.md` (deployment section), `docs/PRODUCTION_OPERATIONS.md` (append). Dependencies: none, and
it unblocks 1.3, 2.5, 3.2, 3.3. Acceptance: the image builds and serves traffic with only production
variables set; the dev compose file is not part of the production path. **Complexity: Medium.**

**Task 3.2 — Fail fast on production configuration**
Objective: a misconfigured deploy never starts. App: API. Files: new
`config/ProductionConfigValidator.java`, `application-production.yml` (add the `spring.mail` block
and flip notifications to opt-out), `infra/scripts/validate-production-config.ps1` + a shell port,
`SMTP_CONFIGURATION.md`, `notification/README.md` (fix the backoff claim). Dependencies: 3.1.
Acceptance: removing any required variable produces a startup failure naming it; notifications
cannot be silently off in production; S3 credentials cannot be empty; the script and the application
check the **same** names. **Complexity: Medium.**

**Task 3.3 — Health, probes and graceful shutdown**
Objective: safe restarts and rollouts. App: API + Infrastructure. Files: `application.yml`,
`application-production.yml`, platform probe configuration. Dependencies: 3.1. Acceptance:
readiness fails while the DB is unreachable; liveness does not; SIGTERM drains in-flight requests;
a restart during a job run does not duplicate or lose work. **Complexity: Small.**

**Task 3.4 — Fix the web media origin and production env contract**
Objective: correct public image URLs, no internal hostname in public HTML. App: Web. Files:
`src/lib/config.ts`, `src/lib/api.ts`, `src/app/listings/[id]/page.tsx`,
`ListingDetailContent.tsx`, `src/app/page.tsx`, `src/app/flatshare/[city]/page.tsx`,
`src/components/ListingThumb.tsx`, `next.config.mjs`, both `.env*.example`. Dependencies: 3.1.
Acceptance: the internal hostname appears nowhere in built HTML; images load with no CSP violation;
`API_BASE_URL` is in the build gate. **Complexity: Small.**

## Phase 4 — Monitoring

**Task 4.1 — Uptime, metrics scraping and error tracking**
Objective: know Dari is broken before a user tells you. App: all three + Infrastructure. Files:
`common/error/ErrorReporter` implementation (replace `NoopErrorReporter`),
`GlobalExceptionHandler.java:156-157` (real release version), web `src/lib/reporting.ts`, mobile
dependency + init. Dependencies: Phase 3. Acceptance: a deliberate API exception, a web error and a
mobile crash each appear in the dashboard, tagged with the correct release and correlation id.
**Complexity: Medium.**

**Task 4.2 — The six alerts**
Objective: the minimum alert set, no more. App: Infrastructure. Dependencies: 4.1, 2.5.
Acceptance: each of API unreachable, elevated 5xx, DB unreachable, outbox PENDING rising / any DEAD,
`media.cleanup_failures > 0` for >1 h, and missing daily backup has been deliberately triggered once
and reached a human. **Complexity: Small.**

## Phase 5 — Web validation

**Task 5.1 — Runtime and error states**
Objective: no dead ends. App: Web. Files: new `src/app/global-error.tsx`, `loading.tsx` for
`/listings`, `/listings/[id]`, `/messages`, `/account`, `src/lib/api.ts` (401 → one forced refresh +
replay, then sign out), a shared component branching on the three network error classes.
Dependencies: 1.4. Acceptance: an expired token recovers without a dead page; the existing French
network copy is actually shown. **Complexity: Medium.**

**Task 5.2 — SEO corrections**
Objective: the index reflects reality. App: Web. Files: `src/app/sitemap.ts`, `src/app/robots.ts`
(`export const revalidate = 3600`), `src/app/profile/[id]/page.tsx` (`generateMetadata` + the
indexing decision), `README.md:62`. Dependencies: none. Acceptance: a newly published listing appears
in the sitemap within the hour without a redeploy. **Complexity: Small.**

**Task 5.3 — Accessibility blockers**
Objective: no misleading semantics, no silent updates. App: Web. Files:
`src/app/listings/SearchResults.tsx` (stop using `Tabs` for sort/mode, or wire `panelId`),
`src/app/messages/[id]/page.tsx` (`role="log"`), loading states (`aria-live`),
`ListingGallery.tsx` (target size, `aria-current`, prev/next, arrow keys), both maps (accessible
name, stop excluding them from axe), `src/app/account/profile/page.tsx` (use `Dialog` instead of
`confirm`/`prompt`), `e2e/tests/fixtures.ts`. Dependencies: none. Acceptance: axe passes **with the
maps included**; one keyboard-only publish journey passes. **Complexity: Medium.**

**Task 5.4 — Raise the test floor**
Objective: the gaps that hid these bugs are closed. App: API + Web. Files: `ArchitectureTest.java`
(the documented `listings` rule + a fuzzing-chokepoint rule), a new `EXPLAIN`-asserting search test,
`SecurityHeadersApiTest.java` (actuator authorization), `FavoriteApiTest.java`,
`e2e/playwright.config.ts` (production-build project). Dependencies: Phases 1–2.
Acceptance: every P0 has a regression test; the ArchUnit Javadoc and rules agree.
**Complexity: Medium.**

**Task 5.5 — Investigate sorted-search index usage**
Objective: know whether V15's indexes are used. App: API. Files: `ListingSearchRepository.java`
(only if the measurement justifies it), new test. Dependencies: 5.4. Acceptance: `EXPLAIN (ANALYZE)`
against the 50 k seeded dataset shows an index scan for price and updated sorts, asserted by a test.
**Complexity: Medium** (Small if the indexes turn out to be used and only the test is added).

## Phase 6 — Mobile real-device validation

**Task 6.1 — Make a production build possible**
Objective: a shippable artifact. App: Mobile. Files: `eas.json`, `app.json`, `src/lib/api.ts`,
`src/lib/config.ts`. Dependencies: Phase 3. Acceptance: `eas build --profile production` produces a
binary that boots against the production API and renders the map on Android.
**Complexity: Medium.**

**Task 6.2 — Runtime safety and store requirements**
Objective: survivable in the wild and acceptable to review. App: Mobile. Files: root
`ErrorBoundary`, crash-reporting init, `src/lib/api.ts` (timeout), a legal-links screen,
`app/(tabs)/profile.tsx` (remove the notification control, match the Android deletion
confirmation), `app/_layout.tsx` (deep-link route names). Dependencies: 6.1. Acceptance: a forced
render error shows a recovery screen and reports; a stalled request times out with a French message;
privacy and terms are reachable in-app. **Complexity: Medium.**

**Task 6.3 — Real-device matrix and store submission**
Objective: verified on hardware. App: Mobile. Dependencies: 6.1, 6.2. Acceptance: the §L matrix
completed on ≥2 Android devices and ≥1 iPhone; internal-testing and TestFlight builds installed and
exercised; Play data-safety and App Privacy forms submitted; screenshots and metadata prepared.
**Complexity: Large.**

## Phase 7 — Production launch verification

**Task 7.1 — Pre-launch rehearsal on production infrastructure**
Objective: prove it end to end where it will actually run. App: all. Dependencies: Phases 1–5.
Acceptance: §M sections 1–7 executed and recorded, including the failure injections; the coordinate
recovery attack fails; a deleted account's avatar is gone from the bucket; a moderation email
arrives. **Complexity: Medium.**

**Task 7.2 — Legal and privacy sign-off**
Objective: the operational half of compliance. App: none (operational). Dependencies: none — start
it in parallel with Phase 1, because it has the longest lead time. Acceptance: counsel has reviewed
the privacy notice and terms; all 11 `DARI_LEGAL_*` values are real; the CNDP position and the
§12 questions are answered in writing; the processor inventory and transfer basis are documented;
retention periods are decided and, where they imply deletion, implemented. **Complexity: Medium.**

**Task 7.3 — Launch**
Objective: go live with a rollback ready. App: all. Dependencies: everything above.
Acceptance: the §R launch gate is fully satisfied; a verified pre-deploy backup exists; the previous
artifact is retained; alerts are live and have been tested; someone is watching for the first hour.
**Complexity: Small.**

---

# R. Launch Gate

## Dari can be launched when…

**Security and privacy**
- [ ] Location fuzzing uses a keyed function and exact coordinates cannot be recovered from public data (P0-1)
- [ ] Image dimensions are validated before decoding; a crafted PNG cannot OOM the API (P0-6)
- [ ] Rate limiting cannot be bypassed via `X-Forwarded-For`, and the limiter map is bounded (P0-7)
- [ ] `/actuator/metrics` and `/actuator/prometheus` are not reachable by ordinary users (P1-1)
- [ ] Favoriting cannot expose a non-public listing (P1-4)
- [ ] `GET /cities` aggregates in the database and is rate-limited; `GET /listings/{id}` is rate-limited (P1-2, P1-5)
- [ ] JSON-LD escapes user text; HSTS is set (P1-15, P0-10)

**Data safety**
- [ ] Automated backups have run unattended at least twice, offsite and versioned (P0-8)
- [ ] A restore drill has succeeded from a real backup, and the RTO is recorded (P0-8)
- [ ] Account deletion removes the avatar from production object storage (P0-4)
- [ ] Listing expiry fires for a warned listing, proven by a real-database test (P0-5)
- [ ] Media cleanup has a terminal failure state and a gauge someone alerts on (P1-6)

**Deployment**
- [ ] A production artifact exists and has been deployed to the real target (P0-2)
- [ ] Startup fails fast, naming the variable, when any required production value is missing (P0-3, P1-3)
- [ ] Email notifications have been proven to deliver end to end, and cannot be silently disabled (P0-3)
- [ ] Graceful shutdown, readiness and liveness are configured and tested (P1-3)
- [ ] Query, connection and S3 client timeouts are set (P1-3, Task 2.4)
- [ ] Exactly one API instance is running, deliberately (§G)

**Web**
- [ ] A production build serves every route with zero CSP violations and full interactivity (P0-10)
- [ ] No internal hostname appears in public HTML, OG tags or JSON-LD; images load (P0-11)
- [ ] `global-error.tsx` exists and a 401 mid-session recovers rather than dead-ending (P1-12)
- [ ] The sitemap and robots.txt revalidate; profile pages have a deliberate indexing decision (P1-13, P1-14)
- [ ] The a11y blockers in P1-16 are fixed and axe passes with the maps included

**Observability**
- [ ] Error tracking is live for API and web, tagged with a real release version (P1-10)
- [ ] An uptime monitor watches the web app and `/actuator/health` (P1-11)
- [ ] The six alerts have each been triggered once and reached a human (P1-11)

**Legal**
- [ ] Counsel has reviewed the privacy notice and terms; all 11 `DARI_LEGAL_*` values are real
- [ ] The CNDP position and the §12 questions are answered in writing
- [ ] Processors and international transfers are documented; retention periods are decided

**Verification**
- [ ] §M sections 1–7 executed on production infrastructure, including the failure injections
- [ ] Every P0 has a regression test, and CI runs them (Task 5.4)

## Can safely wait until after launch

- **Mobile app release entirely.** Web-only launch is viable and mobile is not close (P0-9, P1-18,
  Phase 6). Shipping mobile later is a scheduling decision, not a compromise.
- **Push notifications.** Absent end to end; email covers every current event. Just remove the
  permission prompt that promises them.
- **Realtime messaging.** Polling at 5 s/30 s is bounded and indexed. Revisit on measured DB load.
- **Redis / distributed rate limiting.** Only when a second API instance exists — and fix P0-7 first.
- **`next/image`, responsive variants, thumbnails.** A bandwidth and LCP cost, not a correctness one.
- **N+1 in the conversation inbox and the report queue.** Bounded at 20; the report queue's missing
  pagination matters only once the queue grows.
- **`checkRevoked` on every token.** Dari-side bans already take effect immediately at the filter;
  this closes a ≤1 h window on Firebase-side revocation. Do it soon, but it need not gate launch.
- **Phone-based ban evasion, admin self-ban guard, conversation existence oracle, reflected input in
  400 bodies, cursor HMAC, sitemap offset bound** (S-16 through S-26).
- **Map picker in the publish wizard.** The strongest candidate for early promotion — raw lat/long
  inputs are a data-quality risk — but not launch-blocking.
- **`listing_rooms` / `house_rules` editing, neighborhood enforcement, admin "warn", phone
  verification, in-app notification centre, data export** (unless counsel says the notice promises
  it), **PWA icons**.
- **Deep-link universal/app links.** `dari://` works once the route names are fixed; shareable
  https links are a mobile concern anyway.
- **Distributed tracing, Kubernetes, microservices, Kafka, read replicas, autoscaling** — see §G for
  the trigger that would justify each.

