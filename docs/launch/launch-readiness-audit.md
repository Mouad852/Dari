# Application Launch-Readiness Audit — Dari

## Context

This is a read-only, repository-wide audit of the application: API, web, mobile, database, UX, security and tests. DevOps is out of scope. It follows the earlier `PRODUCTION_READINESS_AUDIT.md` (2026-09-21), which was infrastructure-heavy and whose P0s were closed in Phases 1–7. This pass traces user journeys end-to-end through the current code on `master` (`63f859f`, Spring Boot 4). No code was modified. The one uncommitted change (`apps/api/src/test/java/ma/dari/api/user/UserApiTest.java`) is the owner's and was not touched.

Method: every finding below was read in source. Most of them come from tracing the exact request path: the UI handler, then `apiFetch`, the controller, the service, the repository/SQL and back. Where behaviour depends on a device, a third-party console or a runtime I could not run, it says **"Not verifiable from the current repository."**

---

# 1. Executive Summary

**Maturity:** the **API is strong**. Ownership is scoped by token everywhere, DTOs are whitelisted, the error envelope is consistent, location fuzzing and EXIF stripping are in place, moderation has an audit trail, pagination is keyset-based, and there are about 300 integration tests. The **web app works for the main seeker journey** (search → detail → contact → chat). The weak spots are the *second half* of each journey: what happens after the first message, after publication, after expiry, after a moderation decision. The **mobile app is not launch-ready**: it cannot submit a listing, and in production it will show no images.

**Biggest risks, in order:**

1. **Owners are never told they have a message.** There is no email, push or other signal for new messages. Only an in-app badge, and only if the owner opens the site. The core marketplace conversion silently depends on owners checking by chance. (P0-1)
2. **Two common search filters return zero web-created listings.** The web publish wizard never collects `roomFurnishing` or `availableFrom`, and search SQL excludes NULLs for both filters. "Meublé" or "Disponible à partir du" empties the results. (P0-2)
3. **Listing renewal doesn't exist in any client**, and the web wizard shows a false "Annonce envoyée pour validation" for expired or suspended listings. Every listing expires at day 60, and the expiry email tells owners to renew with a button that doesn't exist. (P0-3)
4. **The mobile app can't publish, and will show no images in production.** It never sends `propertyType`/`roomType`, which submit requires, and it builds image URLs as `${apiOrigin}${url}` while production media URLs are absolute CDN URLs. (P0-4, P0-5)
5. **Moderation and trust gaps:** photo changes on an approved listing skip re-review, and on web there's no path to report a user from a conversation. The public profile is unreachable, and a manually suspended listing can never come back. (P1)
6. **Per-IP rate limits apply to authenticated writes.** Signup is 5/hour per IP, listing creation 5/hour, uploads 20/hour. Behind Moroccan mobile CGNAT or campus Wi-Fi (the student audience), these trip for real users. (P1-6)
7. **Forms hide the server's field-level validation messages everywhere**, profile fields can't be cleared, and several account pages make untrue claims (payments, notifications, security). (P1)

**Verdict:** the web app can launch after the five P0s are fixed. P0-4 and P0-5 can be deferred instead by not shipping mobile publishing or the mobile app at launch. The P1 list should mostly land before launch too; it's what separates "works" from "feels finished". None of the P0 fixes needs a redesign. Each is a contained change on top of code that is otherwise sound.

---

# 2. Application Architecture

| Layer | Technology | Notes |
|---|---|---|
| API | Spring Boot 4 (`apps/api`), Java, Jackson 3, Spring Security (stateless bearer), JPA/Hibernate, Flyway V1–V28, PostgreSQL + PostGIS | Package-by-feature: `user`, `listing`, `messaging`, `moderation`, `media`, `notification`, `common` |
| Auth | Firebase Authentication (client-side sign-up/in). API verifies ID token in `common/auth/FirebaseAuthFilter.java`; profile row created by `POST /api/v1/users` only after email verification | Roles `USER`/`ADMIN` (+ `ROLE_PROFILELESS`); statuses `ACTIVE`/`SUSPENDED` (read-only)/`BANNED`; soft delete |
| Web | Next.js App Router (`apps/web`), React, inline styles on CSS tokens, own design-system components (`components/ds/*`) | Public pages SSR/ISR (home, listings, detail, flatshare/[city], profile); account/publish/messages/admin are client components |
| Mobile | Expo / React Native + expo-router (`apps/mobile`) | Tabs: Explorer, Favoris, Messages, Profil; plus listing detail, thread, publish, report, auth |
| Media | `ImageStore` → `LocalImageStore` (dev) / `S3ImageStore` (prod, absolute CDN base URL); re-encode to JPEG (EXIF stripped); revocation via `media_cleanup` outbox | `/uploads/**` served by API in dev only |
| Notifications | Transactional outbox (`notification_outbox`) → scheduled SMTP sender | Only moderation/expiry/report events exist; **no message events** |
| Jobs | ShedLock-guarded: listing expiry (nightly), notification delivery (30 s), media cleanup (60 s), rate-limit eviction | |

**Main entities:** `User` 1–N `Listing` 1–N `ListingPhoto`/`ListingRoom`/`ListingAmenity`, 1–1 `HouseRules`. `Conversation` (listing optional, canonical participant pair, unique indexes) 1–N `Message`. `Favorite` (user, listing). `Report`/`AdminAction`/`BannedIdentity`. `NotificationOutbox`, `MediaCleanup`, `Neighborhood` (reference).

**Listing lifecycle:** `DRAFT → (submit) PENDING_REVIEW → (approve) PUBLISHED [AVAILABLE ⇄ ROOM_FOUND] → (expiry job) EXPIRED → (renew) PENDING_REVIEW`. There's also `→ REJECTED` (editable, resubmittable) and `→ SUSPENDED` (auto after 3 reporters in 7 days, or by a moderator). Owner edits to a PUBLISHED listing move it back to `PENDING_REVIEW`. Public reads go through the `published_listings` view.

**User journeys identified:** (1) sign up → verify email → create profile; (2) sign in / reset password / sign out; (3) search → filter → map → detail; (4) favorite; (5) contact owner → chat; (6) publish listing (wizard) → moderation → published; (7) manage own listings (edit, room found, reopen, delete, renew); (8) profile edit/avatar/delete account; (9) report listing/user; (10) moderator: review queue, report queue, user management.

---

# 3. Feature Completeness

| Feature | Web | Mobile | API | Status |
|---|---|---|---|---|
| Sign-up + email verification + profile creation | ✔ | ✔ | ✔ | **Complete** (no consent capture, P1-15) |
| Sign-in / sign-out / session refresh | ✔ | ✔ | ✔ | **Complete** |
| Password reset | ✔ (sign-in page) | ✔ | Firebase | **Complete** |
| Password change while signed in / email change | ✘ ("Géré dans Firebase") | ✘ | — | **Missing** (P2-1) |
| Search (city, filters, sort, pagination, count) | ✔ | ✔ | ✔ | **Partially complete**: furnishing/date filters broken for web-created data (P0-2); neighborhood exact-match (P1-11) |
| Map view | ✔ | ✔ | ✔ (capped 1000) | **Complete** (mobile images P0-5) |
| Listing detail | ✔ | ✔ | ✔ | **Partial**: no host/owner info (P1-8) |
| Favorites | ✔ | ✔ | ✔ | **Complete** (suspended favorites look available, P2) |
| Contact owner / messaging / read receipts / polling | ✔ | ✔ | ✔ | **Partial**: no new-message notification (P0-1), inbox order (P1-7) |
| Publish wizard | ✔ (6 steps) | ✘ can't submit | ✔ | Web **partial** (missing fields P0-2, edit takes listing offline P1-3); mobile **broken** (P0-4) |
| Owner listing management | ✔ (edit, submit, room found, reopen, delete) | ✘ none | ✔ | **Partial**: no renew anywhere (P0-3); mobile missing |
| Renew expired listing | ✘ | ✘ | ✔ `POST /listings/{id}/renew` | **Broken journey** (P0-3) |
| Photo upload / reorder / cover | ✔ | ✔ (no reorder) | ✔ | **Partial**: orientation, >5 MB, WebP (P1-5); re-review bypass (P1-2) |
| Profile edit / avatar | ✔ | ✔ | ✔ | **Partial**: fields can't be cleared (P1-9) |
| Public profile | ✔ page exists | ✘ | ✔ | **Unreachable**: nothing links to it (P1-8) |
| Account deletion | ✔ | ✔ | ✔ | **Complete** (blocked while suspended, P2) |
| Report listing | ✔ | ✔ | ✔ | **Complete** |
| Report user | ✔ only from orphaned profile page | ✔ from thread | ✔ | **Partial on web** (P1-8) |
| "My reports" | ✘ | ✘ | ✔ `GET /reports/me` | Backend without UI (P2) |
| Email notifications (moderation, expiry) | — | — | ✔ outbox + SMTP | **Partial**: content lacks context (P1-10) |
| Notification preferences / SMS | placeholder page | ✘ | ✘ | **Missing**; page overclaims (P1-12) |
| Payments | placeholder page | ✘ | ✘ | **Placeholder**; should be removed (P1-12) |
| Phone verification | ✘ | ✘ | 501 stub | **Missing** (intentionally post-MVP) |
| Admin: listing review | ✔ | — | ✔ | **Complete** |
| Admin: report queue (dismiss/suspend/ban) | ✔ | — | ✔ (+WARN) | **Complete**; WARN has no UI (P2) |
| Admin: users (search, suspend, unsuspend, ban) | ✔ | — | ✔ | **Complete**; can ban self/admins (P2) |
| Admin: reinstate manually suspended listing | ✘ | — | ✘ | **Missing** (P1-13) |
| Legal pages | ✔ | ✔ links | — | Content sufficiency **Not verifiable from the current repository** (owner/counsel item) |

---

# 4. What Is Already Good (do not rewrite)

- **Authentication/authorization model.** `FirebaseAuthFilter` rejects banned, deleted and suspended-write requests before controllers run. Every owner-scoped query uses `findByIdAndOwnerIdAndDeletedAtIsNull(id, owner.getId())` with the owner taken from the token (`ListingService`, `ListingSearchService.requireOwnedListing`). Conversations check participation before any read (`ConversationService.findVisibleConversation`). Admin routes are gated both by URL rule and `@PreAuthorize`. **No IDOR was found.**
- **Mass assignment is structurally prevented.** Request records carry no `status`, and `rejectionReason` is `@Null`. Identity fields come only from the token (`CreateUserRequest`). Lifecycle only moves through named actions.
- **Privacy engineering:** HMAC-seeded location fuzzing on every public DTO, the owner-only true-coordinate route (`/listings/mine/{id}`), JPEG re-encoding that strips EXIF/GPS, media revocation on delete (`MediaAccessInterceptor`), a PII scrub on account deletion, and JSON-LD `<` escaping.
- **Error envelope and client error model.** A consistent `{code,message,fields}`, and `apiFetch` with timeout, offline, network and unexpected-response classes plus single-flight 401 refresh-and-replay (`apps/web/src/lib/api.ts`).
- **Data layer:** keyset pagination everywhere, idempotent conversation creation (`ON CONFLICT DO NOTHING` + unique indexes V10/V23), partial unique indexes (one active cover, one pending report per reporter/target), DB CHECK constraints mirroring DTO limits, the transactional outbox, and ShedLock jobs.
- **Accessibility work in the web app:** focus restoration after disabled buttons, live regions for new messages and unread counts, `aria-current`, keyboard-reachable map alternative, dialog focus traps, AA-checked tokens.
- **Tests:** about 300 API integration tests on Testcontainers, covering auth, suspension, deletion rollback, public-profile leak checks, fuzzing, search index usage, rate limiting and media cleanup. Plus 20+ Playwright specs in dev and production modes, and mobile unit tests for API, deep links, messages and profile.

---

# 5. P0 — Must Fix Before Launch

### P0-1 · New messages trigger no notification of any kind
- **Evidence:** `NotificationService` (`apps/api/src/main/java/ma/dari/api/notification/NotificationService.java`) defines only moderation, expiry and report events. `ConversationService.sendMessageInternal` (`messaging/ConversationService.java:234-237`) just saves. `NotificationDeliveryService.EVENT_TYPES` has no message type. There's no push-token field anywhere, and the mobile app registers no push notifications.
- **Location:** `messaging/ConversationService.java`, `notification/*`.
- **Impact:** a seeker's message waits until the owner happens to open Dari. Owner response is the conversion event of the product. Meanwhile the web notifications page tells users they *do* get emails for new messages (P1-12).
- **Recommended fix (smallest):** add `newMessage(User recipient, Conversation c)` to `NotificationService`. Enqueue it in `sendMessageInternal` for the *other* participant, throttled so a recipient gets at most one email per conversation per N minutes while messages stay unread. For example, skip the enqueue if an unsent or recently sent `NEW_MESSAGE` row exists for (recipient, conversation) within 30 minutes. Payload: sender display name, listing title, link to `/messages/{id}`. **Never the message body**: bodies can carry phone numbers or scams, and email is outside moderation. Add the type to `EVENT_TYPES`. Mobile push can follow post-launch.
- **How to verify:** integration test where A messages B → one `NEW_MESSAGE` outbox row for B; a second message within 30 min → none; after B reads → the next message enqueues again. Then manually send a message with SMTP pointed at a local catcher (MailHog/Mailpit) and confirm one email with the link.

### P0-2 · Web-created listings can never match the "Aménagement" or "Disponible à partir du" filters
- **Evidence:**
  - Search SQL: `AND (CAST(:furnishings AS room_furnishing[]) IS NULL OR l.room_furnishing = ANY(...))` and `AND (CAST(:availableBy AS date) IS NULL OR l.available_from <= :availableBy)` (`listing/ListingSearchRepository.java:74-75`, repeated at `:134-135`, `:174-175`, `:226-227`, `:291-292`). NULL columns fail both.
  - The map query alone already treats a NULL date as available: `(:availableBy IS NULL OR l.available_from IS NULL OR l.available_from <= :availableBy)` (`:342`). With a date filter set, **map pins and the result list disagree**.
  - The web wizard's `draftPayload()` (`apps/web/src/app/publish/page.tsx:352-377`) never sends `roomFurnishing`, `availableFrom`, `minStayMonths`, `priceDeposit`, `wifi/electricity/waterIncluded`, `numBedrooms`, `numBathrooms`, `currentRoommatesCount` or `maxRoommates`.
  - Both filters are offered in the UI (`apps/web/src/app/listings/SearchResults.tsx:958-1037`; mobile `app/(tabs)/index.tsx` filter sheet).
- **Impact:** a seeker who picks "Meublé" or a move-in date sees zero listings created on web. The detail page also shows "Wi-Fi / Électricité / Eau : Non précisé" for every web listing, and the homepage metadata claims "loyers annoncés charges comprises".
- **Recommended fix:** add the missing fields to the wizard's "Chambre" step:
  - furnishing select
  - available-from date input (min today)
  - min stay
  - deposit
  - three charge selects
  - bedrooms/bathrooms
  - current/max roommates

  Make furnishing and available-from **required at submit**: add them to `missingForSubmit` and to `ListingSearchService.submit`. Load them back in `loadDraft`.

  Decide how the date filter treats NULL for listings that already exist. The recommended option is `(l.available_from IS NULL OR l.available_from <= :availableBy)`, the rule the map query already uses. Apply it to the four live copies (`searchByLocationSorted`, `searchByRadiusPaginated`, `searchByRadiusWithCursor`, `mapPinsByLocationAndRadius`): no date means "available now". Backfill existing rows with `available_from = created_at::date` if you prefer strictness.
- **How to verify:** create a listing through the wizard with "Meublé" and a date, approve it, then search `?furnishing=FULLY_FURNISHED&availableFrom=<date>` → it appears. Add an API test covering a NULL `available_from` listing under the chosen rule, and a Playwright wizard test asserting the payload includes the new fields.

### P0-3 · Listing renewal has no UI, and the wizard reports false success for expired or suspended listings
- **Evidence:**
  - `POST /api/v1/listings/{id}/renew` exists (`listing/ListingController.java:257-261`, `ListingSearchService.renew`), but `grep -ri renew apps/**/*.tsx` finds nothing.
  - `account/listings/page.tsx:343-345` offers only submit, room-found and reopen.
  - The expiry email says "Votre annonce a expiré et doit être renouvelée" (`OutboxNotificationService.listingExpired`).
  - If the owner instead opens "Modifier" on an EXPIRED or SUSPENDED listing, `publish()` PATCHes it (status unchanged, since `ListingService.update` only moves PUBLISHED) and computes `needsExplicitSubmit=false`. It then shows **"Annonce envoyée pour validation."** (`publish/page.tsx:579-590`, `1239`) although nothing was submitted.
- **Impact:** from day 60 after launch, every listing drops out of search and owners can't bring it back. The only screen they try tells them it worked. The expiry job guarantees this will happen.
- **Recommended fix:**
  1. Add "Renouveler" to `account/listings/page.tsx` for `status === 'EXPIRED'`, using `runAction(..., '/renew', 'POST', { status: 'PENDING_REVIEW' })`.
  2. In `publish()`, call `/renew` when `draft.status === 'EXPIRED'`.
  3. For `SUSPENDED`, show "Cette annonce est suspendue par la modération" and disable publish instead of claiming success.
  4. Include the listing title and a link to `/account/listings` in the expiry emails (P1-10).
- **How to verify:** in the API test set a listing to EXPIRED, click Renouveler → status becomes PENDING_REVIEW and it appears in `/admin/listings`. Playwright: edit an EXPIRED listing, save → a renew call is made and the success copy matches the resulting status. Edit a SUSPENDED listing → no success message.

### P0-4 · Mobile publishing can't submit a listing (and is not usable for a real owner)
- **Evidence:** `apps/mobile/app/publish.tsx:56` builds the body without `propertyType`/`roomType`. `ListingSearchService.submit` rejects with "Type de logement requis" / "Type de chambre requis" (`listing/ListingSearchService.java:461-466`). Also:
  - owners must type raw latitude/longitude (`publish.tsx:87`)
  - `numeric('')` returns `0`, so empty coordinates or rent are accepted as `0` (`publish.tsx:49`)
  - city is free text but the API validates an exact-case match (`ListingService.validateCity` → `NeighborhoodRepository.existsByCity`), so "rabat" fails
  - no amenities, rooms or house rules
  - no screen lists the owner's listings (no `/listings/mine` call exists in `apps/mobile`), so a draft saved on mobile can't be found again, renewed, marked found or deleted there
  - a later PATCH re-sends a past `availableFrom`, which `@FutureOrPresent` rejects
- **Impact:** every mobile publish attempt ends at "Votre annonce ne peut pas encore être envoyée."
- **Recommended fix (launch-scope decision):** either
  - **(a) Recommended for launch:** hide "Publier une annonce" on mobile (`app/(tabs)/profile.tsx`) and link out to the web wizard; or
  - **(b)** bring mobile publish to parity: city picker from the 4 cities, property/room type pickers, map pin (react-native-maps is already a dependency), required-field validation (no empty→0), date picker, and a "Mes annonces" screen with the same actions as web.
- **How to verify:** (a) the button is gone and a deep link opens web. (b) A jest test on the request body (propertyType/roomType present, no zero coordinates), and a manual create → photo → submit on a device returning 200.

### P0-5 · Mobile images break in production (S3/CDN absolute URLs)
- **Evidence:** `S3ImageStore.publicUrl` returns `publicBaseUrl + "/" + key` (`media/S3ImageStore.java:122-124`). Production sets `DARI_MEDIA_PROVIDER=s3` and `DARI_MEDIA_PUBLIC_BASE_URL` to the CDN origin (`application-production.yml`, `docs/operations/production-operations.md:675`). Mobile concatenates the API origin in front: `${apiOrigin}${listing.coverPhotoUrl}` (`apps/mobile/src/components/ListingCard.tsx:21`, `app/listing/[id].tsx:178`, `app/publish.tsx:93`, `app/(tabs)/profile.tsx` avatar). The web equivalent `resolveMediaUrl` already passes absolute URLs through (`apps/web/src/lib/config.ts:100-106`). The mobile type comments still say URLs are root-relative (`apps/mobile/src/types/api.ts:86-90,137-143`).
- **Impact:** production URLs would look like `https://api.dari.ma` followed directly by `https://cdn…/listings/…`. Every photo and avatar in the mobile app would be broken.
- **Recommended fix:** add `mediaUrl(value)` to `apps/mobile/src/lib/api.ts` mirroring web: return absolute `http(s)` values unchanged, otherwise prefix `apiOrigin`. Replace the four concatenations and fix the type comments.
- **How to verify:** a jest unit test for `mediaUrl` with relative, absolute and protocol-relative inputs. Point a dev build at the MinIO/S3 profile and confirm images render.

---

# 6. P1 — Should Fix Before Launch

### P1-1 · Unhandled framework exceptions become 500s, are reported to Sentry and feed the unhandled-error alarm
- **Evidence:** `GlobalExceptionHandler` (`common/error/GlobalExceptionHandler.java:162-175`) has a catch-all `@ExceptionHandler(Exception.class)` and specific handlers only for the listed types. `HttpRequestMethodNotSupportedException` (wrong verb), `HttpMediaTypeNotSupportedException` (wrong Content-Type), `MissingServletRequestPartException` (upload without `file`), `MissingServletRequestParameterException`, `DataIntegrityViolationException` (for example two concurrent first uploads racing the `idx_listing_photos_active_cover` partial unique index) and `NoHandlerFound` all fall into it. It returns 500, increments `dari.errors.unhandled` and calls Sentry. `NoResourceFoundException` already needed this treatment (the handler at 148-151). No test covers 405/415.
- **Impact:** anyone can generate 500s and error-tracking noise at will, possibly tripping the alarm. Real clients get the wrong status.
- **Fix:** add handlers:
  - 405 with an `Allow` header
  - 415
  - 400 for missing parts or parameters
  - 409 `CONFLICT` for `DataIntegrityViolationException` (log at warn, don't report)

  Alternatively extend `ResponseEntityExceptionHandler` and override `handleExceptionInternal` to emit the envelope.
- **Verify:** `curl -X PUT http://localhost:8055/api/v1/listings` → 405 with the envelope. `curl -X POST -H 'Content-Type: text/plain' …/conversations` → 415. Multipart POST without `file` → 400. Check `dari.errors.unhandled` doesn't increment. Add these to `GlobalExceptionHandlerTest`.

### P1-2 · Photo changes on an approved listing bypass re-moderation
- **Evidence:** `ListingService.update` sends PUBLISHED back to `PENDING_REVIEW` "at the product owner's explicit direction" (`listing/ListingService.java:166-180`). `addPhoto`, `updatePhoto` and `deletePhoto` (`:342-434`) never touch status.
- **Impact:** a scam or explicit photo can be added to a live listing right after approval and stays public until reported. It also allows deleting every photo of a live listing.
- **Fix:** in `addPhoto`, and in `updatePhoto` when the cover changes, apply the same `if PUBLISHED → PENDING_REVIEW` rule. Extract a `ListingService.returnToReviewIfLive(listing)` helper and call it from all four paths. In `deletePhoto`, refuse to delete the last photo of a PUBLISHED or PENDING_REVIEW listing (400 "Une annonce publiée doit garder au moins une photo").
- **Verify:** API test: approve → add photo → `GET /listings/{id}` anonymously returns 404 and the listing is in `/admin/listings`. Deleting the last photo of a published listing → 400.

### P1-3 · Editing a published listing takes it offline at the first "Suivant", even if the owner abandons the edit or changes nothing
- **Evidence:** `saveAndContinue` PATCHes whenever required fields are present (`publish/page.tsx:557-559`), which is always true when editing. `ListingService.update` then moves PUBLISHED → PENDING_REVIEW. The on-screen warning says this happens "Après modification" (`publish/page.tsx:1245-1249`).
- **Impact:** an owner who opens "Modifier" just to look, then clicks Suivant twice, removes their live listing from search until a moderator re-approves it.
- **Fix:** when `editingStatus === 'PUBLISHED'`, keep edits client-side across steps and PATCH once on the final "Enregistrer les modifications". Photos are the exception: they're immediate, and they now re-review per P1-2, so warn on the Photos step. Also skip the PATCH if nothing changed (compare against the loaded snapshot).
- **Verify:** Playwright: open edit for a PUBLISHED listing, click Suivant through all steps, then leave → the mock API receives no PATCH. The final save sends exactly one PATCH.

### P1-4 · Server validation messages per field are never shown
- **Evidence:** the API returns `fields` (`GlobalExceptionHandler.validationResponse`), and `ApiError.fields` is populated (`apps/web/src/lib/api.ts:42,261`). Nothing in `apps/web/src` or `apps/mobile` reads `.fields`: every catch shows `cause.message` ("Données invalides"). Inputs lack `maxLength` matching the DTOs. The wizard title (120), description (2000), other rules and room descriptions all lack it, as does the message composer (4000).
- **Impact:** a 2,500-character description, a malformed rent ("3,5"), or a past date on mobile yields an unexplained "Données invalides", and the user can't tell which field is wrong.
- **Fix:** in the web `ErrorNotice`/form catch paths, render `fields` next to their inputs. The minimum is a list under the error: "Titre : 120 caractères maximum". The `Input`/`Textarea` components already accept `helper`; add an `error` prop. Add `maxLength` equal to the DTO limit to every text input, and do the same on mobile `TextField`.
- **Verify:** Playwright: type 2,001 chars → the field is capped. Force a 400 with `fields` from the mock → the per-field message renders.

### P1-5 · Photo uploads: orientation lost, common phone photos rejected, WebP advertised but refused
- **Evidence:**
  - `ImageProcessor.process` (`media/ImageProcessor.java`) decodes with `ImageIO`, which ignores EXIF Orientation, and re-encodes without it. No orientation code exists (`grep -ri orientation apps` → only `app.json`).
  - The limit is 5 MB with no client-side resize (`publish/page.tsx:439-471`, `account/profile/page.tsx:119-135`).
  - Web `accept="image/jpeg,image/png,image/webp"` and the copy "Formats JPG, PNG ou WebP" (`publish/page.tsx:1039,1047`; `account/profile/page.tsx:296`) contradict the server allow-list `image/jpeg,image/png`.
  - PNG alpha is drawn onto `TYPE_INT_RGB` (black background).
- **Impact:** portrait phone photos uploaded from a browser appear sideways. Photos from modern phones (often 5–12 MB) are refused. WebP picks fail after upload.
- **Fix (client-side, cheap):**
  - before upload, draw each image to a `<canvas>` and export JPEG ≤ 2560 px long edge at quality 0.85. Browsers apply EXIF orientation when drawing, since `image-orientation: from-image` is the default. This fixes orientation and size in one step, and converts WebP to JPEG
  - fill white before drawing PNGs server-side
  - correct the copy

  Server-side orientation handling is the fallback for API clients: read the Orientation tag via a small EXIF parser, or use `metadata-extractor`, and rotate before re-encoding.
- **Verify:** upload an iPhone portrait JPEG (orientation 6), a 9 MB photo and a WebP from the web wizard → all three upright, accepted, and ≤ 2560 px wide. Add an `ImageProcessorTest` with an orientation-6 fixture if the server fallback is added. Mobile: expo-image-picker with `quality: 0.85` re-encodes; confirm orientation on a device (**Not verifiable from the current repository**).

### P1-6 · Per-IP rate limits on authenticated writes will block real users behind shared IPs
- **Evidence:** `RateLimitInterceptor.preHandle` always checks the IP bucket in addition to the user bucket (`common/ratelimit/RateLimitInterceptor.java:73-78`). Limits in `application.yml` `dari.rate-limits`:
  - `signup` 5/h
  - `listing` 5/h
  - `upload` 20/h
  - `message` 30/min
  - `report` 5/h
  - `search` 120/min
- **Impact:** Moroccan mobile carriers and university/residence Wi-Fi put many users behind one IP. The 6th student creating a profile on campus in an hour is refused, and two owners on the same NAT share 20 photo uploads per hour. Anonymous search shares 120 requests per minute across everyone on a CGNAT address, and P1-14 multiplies the request count. This will surface on launch day.
- **Fix:** for *authenticated* mutation types (SIGNUP, LISTING, UPLOAD, MESSAGE, REPORT), rate-limit by user identity only, or keep an IP bucket at 10–20× the per-user limit. Keep IP-only limiting for anonymous reads and raise `search` to ~600/min per IP. Keep the per-user limits as they are.
- **Verify:** `RateLimitInterceptorTest`: 10 different users from one IP each create a profile → all 201. One user making 6 creations → the 6th gets 429.

### P1-7 · Inbox is ordered by conversation creation, not last activity
- **Evidence:** `ConversationRepository.findVisibleByUser` / `findVisibleByUserAfter` use `order by c.createdAt desc, c.id desc` (`messaging/ConversationRepository.java:31-49`). Neither client re-sorts (`apps/web/src/app/messages/page.tsx:194`, mobile `(tabs)/messages.tsx`).
- **Impact:** an active negotiation started last week sinks below every newer thread, including empty ones. With more than 20 conversations, a thread with a new reply can be on page 2.
- **Fix:** add `last_message_at timestamptz` to `conversations`. Update it in `sendMessageInternal` in the same transaction, backfill from `max(messages.sent_at)` in a migration, index `(participant_a_id, last_message_at desc, id)` and the same for `b`, and order and page by `coalesce(last_message_at, created_at)`. Update the cursor payload to carry `lastActivityAt`.
- **Verify:** `MessagingApiTest`: A↔B thread created first, A↔C second; B replies → B's thread is first. Cursor pagination stays stable across pages.

### P1-8 · Trust & safety surfaces are disconnected: no host on the listing, public profile unreachable, no "report user" in the web thread
- **Evidence:**
  - `PublicListingDetailResponse` carries no owner fields (`listing/PublicListingDetailResponse.java`), and `ListingDetailContent.tsx` shows no host.
  - `grep '/profile/'` finds no link to `/profile/[id]` anywhere. That page holds the verification badge, the "membre depuis" date and the only web "Signaler ce profil" (`app/profile/[id]/page.tsx:163`).
  - The web thread header (`app/messages/[id]/page.tsx:616-640`) has no profile link and no report action. Mobile does have one (`apps/mobile/app/messages/[id].tsx:267`).
- **Impact:** seekers can't judge who they're contacting on a platform whose own design treats verification as anti-scam, and web users harassed in chat have no reporting path.
- **Fix:** add `owner: { id, displayName, avatarUrl, verification, memberSince }` to `PublicListingDetailResponse`, from data `PublicProfileResponse` already exposes. Render a "Proposé par" card linking to `/profile/{id}` on web and mobile detail. In the web thread header, link the name to `/profile/{otherUserId}` and add a `ReportDialog targetType="USER"`. Render `avatarUrl` on the public profile (currently initial only, `profile/[id]/page.tsx:75-89`).
- **Verify:** `JsonWireContractApiTest` asserts the detail has `owner` with no email, phone or uid. Playwright: detail → host card → profile → report dialog opens. Thread header → report dialog opens.

### P1-9 · Profile fields can't be cleared (bio, city, first name)
- **Evidence:** the web sends `city: city.trim() || null`, `bio: bio.trim() || null`, `firstName: … || null` (`app/account/profile/page.tsx:176-181`), and mobile does the same (`app/(tabs)/profile.tsx` `save()`). `UserService.update` treats `null` as "unchanged" (`user/UserService.java:224-230`). The UI shows "Profil enregistré." anyway.
- **Impact:** a user who deletes their bio or city (personal data shown on the public profile) is told it was saved while it stays public.
- **Fix:** send `""` for cleared fields. In `UserService.update`, map a blank string to `null` (`if (request.bio() != null) user.setBio(request.bio().isBlank() ? null : request.bio().trim())`). Keep `displayName` required. Mirror this on mobile.
- **Verify:** `UserApiTest`: PATCH `{bio:""}` → `GET /users/me` has `bio: null` and the public profile has no bio.

### P1-10 · Notification emails lack the context a recipient needs
- **Evidence:**
  - `OutboxNotificationService` stores only a short phrase as the payload: "Votre annonce a été approuvée", and for rejection *only the moderator's reason* (`listingRejected → enqueue(..., reason)`).
  - `SmtpNotificationSender.subject` is "Notification Dari" for every event except report acknowledgement.
  - There's no listing title, no link, no greeting or footer, and no "why you're receiving this".
- **Impact:** an owner gets an email titled "Notification Dari" whose whole body is "Photos floues" and can't tell which listing it concerns. These emails will read as phishing and will be ignored.
- **Fix:** build the payload at enqueue time (the listing is available there) from a small template per event: subject (for example "Votre annonce « {title} » a été refusée"), body (greeting, what happened, reason if any, what to do next, link to `/account/listings` or the thread), and a footer (who sends it, link to the terms). Keep it plain text. Put the site origin in config (`dari.web-origins` already has it; add `dari.public-site-url`).
- **Verify:** `NotificationDeliveryServiceTest` asserts subject and body contain the title and link for each event type. Send one of each to Mailpit.

### P1-11 · Neighborhood search is an exact, case-sensitive match on free text
- **Evidence:** SQL `(:neighborhood IS NULL OR l.neighborhood = :neighborhood)` (`listing/ListingSearchRepository.java:69`). The wizard stores free text (`publish/page.tsx:793-798`). The nav search sends a free-typed `neighborhood` (`components/SiteNav.tsx:373-387`). The seeded `GET /neighborhoods` exists but no client uses it.
- **Impact:** "agdal", "Agdal " and "Hay Riad" vs "Hay Ryad" return nothing. The header's search box, the most visible search entry, often yields empty results.
- **Fix:**
  - store a normalized `neighborhood_key` (lowercase, unaccented, trimmed) and match on it; or at minimum use `lower(unaccent(l.neighborhood)) = lower(unaccent(:neighborhood))` with an expression index
  - offer `GET /neighborhoods?city=` as a `<datalist>` in the wizard and the filters, so values converge
  - make the header search city-aware (it currently has no city)
- **Verify:** API test: a listing stored as "Agdal" is found by `neighborhood=agdal` and `neighborhood= Agdal`. Wizard shows suggestions for Rabat.

### P1-12 · Account pages make claims the product doesn't back
- **Evidence:**
  - `/account/payments` is a placeholder for a non-existent feature, with a "Sécurisé" badge and disabled buttons, linked from `/account` ("Moyens de paiement et factures", `app/account/page.tsx:22-27`).
  - `/account/notifications` says "Vous recevez un e-mail … pour chacun de ces événements", lists "Nouveaux messages … Activé" (false, P0-1) and "Un signalement que vous avez envoyé est traité" (false: only receipt is acknowledged, by design) (`app/account/notifications/page.tsx:28-44,106-109`).
  - `/account/security` shows a hard-coded "Niveau élevé" and tells users password and devices are "Géré directement dans Firebase", which end users can't access (`app/account/security/page.tsx:168-182`).
  - `/account` profile completion counts "Téléphone", which no UI or endpoint can set, so it never reaches 100% (`app/account/page.tsx:38-44`).
- **Impact:** false claims on an "anti-scam" product erode trust, and the completion card nags users forever.
- **Fix:**
  1. Remove the Payments section and route, or redirect it to `/account`.
  2. Make the notification list match the real events: messages after P0-1; report "reçu", not "traité".
  3. On Security, replace the Firebase copy with "Changer mon mot de passe", which sends a reset email to `me.email` via the existing `sendPasswordReset`, and drop "Niveau élevé".
  4. Drop "Téléphone" from `PROFILE_COMPLETION_CHECKS` until phone exists.
- **Verify:** visual QA of the four pages. Clicking "Changer mon mot de passe" calls `sendPasswordResetEmail` (e2e seam).

### P1-13 · A manually suspended listing can never be restored, and its owner isn't told why
- **Evidence:**
  - `AdminService.suspendListing` sets `autoFlagged=false` (`moderation/AdminService.java:342-355`), and `ReportService.resolvePendingReports` restores only `autoFlagged` listings (`moderation/ReportService.java:107-120`).
  - There's no admin "reinstate listing" endpoint, and `/admin/listings` shows only PENDING_REVIEW (`AdminController.listings` filters `pendingListings()`, `:65-72`).
  - The owner can't submit a SUSPENDED listing (`ListingSearchService.submit` only allows DRAFT/REJECTED), and `/account/listings` shows the moderator reason only when REJECTED (`app/account/listings/page.tsx:416`).
- **Impact:** a mistaken suspension is permanent, with no appeal path and no explanation.
- **Fix:**
  - add `POST /admin/listings/{id}/reinstate` (SUSPENDED → `priorStatus` or PUBLISHED, with notification and `AdminAction`)
  - let `/admin/listings?status=SUSPENDED` query the repository by status instead of filtering the pending list
  - add a "Suspendues" tab
  - show `rejectionReason` for SUSPENDED on the owner dashboard, with a "Contacter la modération" mailto
- **Verify:** `AdminApiTest`: suspend via report → reinstate → public detail 200 and an audit row exists.

### P1-14 · Search refetches on every keystroke (list + count + map)
- **Evidence:** the neighborhood and radius inputs call `updateUrl` in `onChange` (`app/listings/SearchResults.tsx:907-911,919-923`) → `router.replace` → the list effect (keyed on `searchParams` *and* `neighborhood`) fetches `/listings` and `/listings/count`, and in map view `/listings/map` too (`:542-664`).
- **Impact:** typing "Hay Riad" makes up to about 24 requests. Combined with P1-6 per-IP limits, this produces 429s and flicker.
- **Fix:** debounce URL updates from text inputs (400 ms), or apply them on submit/blur. Abort in-flight requests with an `AbortController` when params change. Key the effect only on `searchParams`.
- **Verify:** Playwright: type 8 characters in Quartier → at most 1 `/listings` request after the debounce (network log).

### P1-15 · No terms/privacy acceptance at sign-up
- **Evidence:** `app/sign-up/page.tsx:105-132` has no link or consent to `/legal/terms` or `/legal/privacy`. The mobile sign-up shows `LegalLinks` but no acceptance. The account records no consent timestamp or version.
- **Impact:** under Moroccan Law 09-08, a privacy notice at collection and recorded acceptance of the terms are normally expected. Confirm with counsel per `docs/legal/legal-prep.md`; this is not legal advice. Whether the legal text is sufficient is **Not verifiable from the current repository.**
- **Fix:** add the sentence "En créant un compte, vous acceptez les Conditions d'utilisation et la Politique de confidentialité" with links, or a required checkbox, on web and mobile sign-up. Store `terms_accepted_at` and `terms_version` on `POST /users`, with a V29 migration and a `CreateUserRequest.acceptedTermsVersion` field validated server-side.
- **Verify:** `UserApiTest`: create without an accepted version → 400. Playwright: sign-up shows the links.

---

# 7. P2 — Post-Launch Improvements

| # | Issue | Evidence | Fix |
|---|---|---|---|
| P2-1 | No in-app password or email change | `account/security/page.tsx` | Reset-email button (P1-12); `updatePassword` with re-auth later |
| P2-2 | Optimistic locking absent; owner action vs moderator can lose updates (for example mark-room-found saving PUBLISHED over a concurrent SUSPENDED) | no `@Version` anywhere; `ListingSearchService.submit/renew/markRoomFound/reopen` not `@Transactional` (`:449-508`) | Add `@Version` to `Listing` and `User` (migration + 409 handler), and `@Transactional` on lifecycle methods |
| P2-3 | Favorites double-tap race → 500 | `FavoriteService.add` catches `DataIntegrityViolationException` inside the transaction (`:108-121`); PostgreSQL aborts the tx | `insert … on conflict do nothing` native query |
| P2-4 | Concurrent first uploads → 500 via the cover unique index; 20-photo cap is racy | `ListingService.addPhoto` `:346-364` | Lock the listing row (`SELECT … FOR UPDATE`) in addPhoto |
| P2-5 | Conversation can be opened against a non-public listing by UUID; messages can be sent to deleted or banned users | `ConversationService.create` `:91-92`, `resolveOtherUser` `:239-252` | Require PUBLISHED listing for *new* conversations; refuse sends when the other party is deleted or banned (409 + UI state "Ce compte n'existe plus") |
| P2-6 | Ban soft-deletes listings but leaves their photos publicly served | `AdminService.banUser` `:417-421` (no `mediaCleanup.enqueue`) | Reuse the deletion loop from `UserService.deleteAccount` |
| P2-7 | Admins can suspend or ban themselves or other admins | `AdminService.suspendUser/banUser` | Refuse when target is self or ADMIN (409) |
| P2-8 | Moderator WARN action and `GET /reports/me` have no UI; `POST /users/me/phone-verification` is a 501 stub | `AdminController`, `ReportController.mine`, `UserController:107-111`; `admin/reports/page.tsx:15` | Add WARN to the queue UI; remove the stub route until built |
| P2-9 | N+1 queries: owner dashboard (3 queries per listing) and admin queue; dashboard counts by loading full lists; report queue unbounded | `ListingService.listMine:80-83`, `AdminService.pendingListings:81-90`, `AdminController.dashboard:50-56` | Batch amenities/rules/rooms by `listingId IN`; `countByStatus` for the dashboard; page the queues |
| P2-10 | Token revocation not checked | `FirebaseAuthFilter:74` `verifyIdToken(token)` | `verifyIdToken(token, true)` or a short cache; disabled Firebase accounts stay usable up to 1 h |
| P2-11 | Banned or deleted users see "Connexion impossible. Réessayez" on sign-in; suspended users get no banner, and can't delete their account (DELETE blocked by the filter) | `sign-in/page.tsx:111-116`, `FirebaseAuthFilter:87-97` | Map `ACCOUNT_BANNED`/`UNAUTHENTICATED` to specific copy; add a global suspended banner; allow `DELETE /users/me` while suspended |
| P2-12 | CORS doesn't expose `X-Correlation-Id`/`Retry-After`, so the web error report's correlation id is always undefined | `SecurityConfig.corsConfigurationSource:128-141` | `config.setExposedHeaders(List.of("X-Correlation-Id","Retry-After"))` |
| P2-13 | Descriptions, rules and bios collapse newlines | `ListingDetailContent.tsx:119`, profile bio | `whiteSpace: 'pre-line'` |
| P2-14 | Message composer is single-line with no length cap | `messages/[id]/page.tsx:736-754` | Auto-growing `<textarea>`, Enter to send, Shift+Enter newline, `maxLength=4000` |
| P2-15 | Thread page uses `height: 100vh`; on iOS Safari the composer can sit under the toolbar (**verify on device**) | `messages/[id]/page.tsx:589` | `height: 100dvh` with `100vh` fallback |
| P2-16 | Favorites of suspended, expired or in-review listings look available, and the link then 404s | `favorites/page.tsx:21-23`; `PublicListingResponse` has no status | Add a boolean `publiclyVisible` to the favorites response |
| P2-17 | Rent parsing accepts `0` and "3.200" (= 3.20 MAD) | `publish/page.tsx:358`; `CreateListingRequest` `@DecimalMin("0.00")` | Minimum 100 MAD server-side; client formats and previews the parsed value |
| P2-18 | Unauthenticated `/publish` lets you type, then says "Connectez-vous…" with no link; auth-required pages link to `/sign-in` without `?next=` | `publish/page.tsx:549-553`; `account/*`, `messages`, `favorites` | Gate `/publish` up front with a sign-in CTA carrying `next`; add `next` to all "Se connecter" links |
| P2-19 | `/account` with a missing profile links to sign-in instead of `/profile-recovery`; profile-recovery buttons are unstyled native buttons | `account/page.tsx:121-135`; `profile-recovery/page.tsx:45` | Link to recovery; use `Button` |
| P2-20 | Web sign-up keeps the "Créer mon compte" button active after the account exists → "adresse déjà utilisée" on a second click; Firebase `weak-password`/`too-many-requests` map to generic copy | `sign-up/page.tsx:47-66,130` | Hide the form once `verificationPending`; map the codes |
| P2-21 | Only one draft can be resumed; "Publier" always resumes the latest draft; abandoned drafts accumulate | `publish/page.tsx:242-246`; `ListingService.getDraft` | "Reprendre le brouillon / Nouvelle annonce" choice; purge drafts older than 90 days |
| P2-22 | Marketing copy overstates: "loyers annoncés charges comprises", "profils contrôlés", "Échangez avec … les colocataires" | `app/layout.tsx` metadata, `app/page.tsx:28,74-75` | Align copy with actual behaviour |
| P2-23 | Admin console has no navigation entry | `SiteNav.tsx`, `account/page.tsx` | "Administration" link when `me.role === 'ADMIN'` |
| P2-24 | Owner dashboard card uses fixed `160px 1fr` columns (cramped at 360 px); account stat grids are fixed at 3 columns | `account/listings/page.tsx:352`, `account/page.tsx:252`, `account/security/page.tsx:188` | Stack below 480 px (`auto-fit, minmax()`) |
| P2-25 | Mobile search city/neighborhood/date are free text (exact-case city); no date picker | `apps/mobile/app/(tabs)/index.tsx:130-136` | City chips from `CITIES`; neighborhood suggestions; native date picker |
| P2-26 | Dead code, including two of the six copies of the search filter SQL that only tests call (so every filter fix must be made in more places) | `ListingSearchService.parseEnumList:520`, `encodeCursor:607`, `getPublicOrOwnerListing:393`; `ListingSearchRepository.searchByLocationPaginated:144`, `searchByLocationWithCursor:305` (used only by `ListingSearchOptimizationTest`) | Delete, and move that test onto `searchByLocationSorted` |
| P2-27 | Auto-suspend after 3 reporters in 7 days is a griefing vector (acknowledged in `ReportController` Javadoc) | `ReportService.create:53-62` | Weight by reporter account age and history post-launch; watch the metric |
| P2-28 | Generic 404 copy "L'annonce a peut-être été louée" for every unknown URL | `app/not-found.tsx` | Neutral copy for non-listing routes |

---

# 8. UI/UX Audit (page by page)

| Page / component | Findings | Priority |
|---|---|---|
| **Home** `app/page.tsx` | Real counts (good). Server GET form works without JS (good). Copy overclaims (P2-22). | P2 |
| **Search** `listings/SearchResults.tsx` | Per-keystroke fetching (P1-14); broken furnishing and date filters for web data (P0-2); exact neighborhood (P1-11). Loading, empty and error states with retry exist. | P0/P1 |
| **Listing detail** `listings/[id]/*` | No host card (P1-8); newlines collapse (P2-13); owner viewing own listing sees "Contacter" (→ 403 message) and "Signaler". Owner/admin preview via `AuthenticatedPreview` works. | P1 |
| **Favorites** | Unavailable states partly wrong (P2-16). Good optimistic rollback. | P2 |
| **Messages inbox** | Ordering (P1-7); no avatars; no pagination total (by design). | P1 |
| **Thread** | No report or profile link (P1-8); single-line composer (P2-14); `100vh` (P2-15). Optimistic send, restore on failure, live region and read receipts are good. | P1 |
| **Publish wizard** | Missing fields (P0-2); offline-on-edit (P1-3); false success (P0-3); field errors hidden and no maxLength (P1-4); WebP copy and orientation (P1-5); success is a dead end ("Annonce envoyée pour validation" with no link to "Mes annonces"). | P0/P1 |
| **Mes annonces** | No renew (P0-3); no suspension reason (P1-13); delete confirmation dialog is good; cramped on mobile (P2-24). | P0/P1 |
| **Account hub / profile / security / notifications / payments** | Placeholder and false content (P1-12); fields can't be cleared (P1-9); avatar not shown on hub (initial only); WebP accepted but refused. Deletion flow with typed SUPPRIMER is good. | P1 |
| **Sign-up / sign-in / recovery** | Consent (P1-15); double-submit after creation (P2-20); banned or deleted copy (P2-11); recovery styling (P2-19). Enumeration-safe reset is good. | P1/P2 |
| **Public profile** | Unreachable (P1-8); avatar not rendered. `noindex` is good. | P1 |
| **Admin** | No nav entry (P2-23); no WARN (P2-8); no suspended-listing view (P1-13). Dialogs with reasons for reject, suspend and ban are good. | P1/P2 |
| **Mobile app** | Publish broken (P0-4); images in production (P0-5); no owner dashboard; free-text filters (P2-25). An error boundary and offline cache for search exist (good). | P0 |

**States:** loading, empty and API-error with retry are present on almost every data page (`ErrorNotice`, "Chargement…", empty cards). Gaps: field-level validation (P1-4); 429 shows the server message but no Retry-After countdown (P2); suspended-account state is not surfaced globally (P2-11).

**Accessibility:** above average (see §4). Remaining: color contrast on mobile tokens is tracked in `apps/mobile/src/theme/tokens.ts:8` ("five WCAG AA token contrast failures"); confirm on device. Real screen-reader passes on iOS and Android are **Not verifiable from the current repository.**

**Responsive:** web layouts use `minmax(0,1fr)`, wrapping flex and container widths. Issues are limited to P2-24 and P2-15. There's no horizontal overflow risk in the components read.

---

# 9. User Journey Audit

| Journey | Result | Blocking issues |
|---|---|---|
| Create account (web) | Works: Firebase account → verification email → "J'ai confirmé" → `POST /users` → `/account` | P1-15 consent, P2-20 |
| Create account (mobile) | Works via profile-recovery | P1-15 |
| Recover password | Works (both) | — |
| Sign in with unverified email | Routed to recovery, works | — |
| Session expiry | Web: single forced refresh + replay, then sign-out with `?next=` (good). Mobile: Firebase refresh | — |
| Search → detail → contact | Works | P0-2, P1-11, P1-14, P1-8 |
| Owner learns of inquiry | **Fails** unless owner visits | **P0-1** |
| Ongoing conversation | Works; ordering wrong | P1-7 |
| Publish (web) | Works end-to-end (draft persists, photos, submit) | P0-2 fields, P1-4, P1-5 |
| Publish (mobile) | **Fails at submit** | **P0-4**, P0-5 |
| Moderation approve/reject → owner informed | Works, email lacks context | P1-10 |
| Edit live listing | Works, but goes offline at first step | P1-3, P1-2 |
| Listing expires → renew | **Fails**, with false success | **P0-3** |
| Manual suspension → recovery | **Impossible** | P1-13 |
| Delete listing / account | Works with confirmation | — |
| Clear personal data from profile | **Silently fails** | P1-9 |
| Report user from a chat (web) | **No path** | P1-8 |
| Refresh / direct URL | Works: all client pages load the token via `authStateReady()`; server pages SSR | — |
| Double submit | Buttons disable during requests throughout; conversation, favorites and profile creation are idempotent server-side | P2-3, P2-4 races |

---

# 10. Backend/API Audit (consolidated)

- **Status codes:** correct for domain errors. Framework exceptions become 500 (P1-1). `POST /users` returns 201 or 200 (good). `PATCH /conversations/{id}/read` returns 204 (good).
- **Validation:** DTOs are thorough (sizes, ranges, `@Null` guards, cross-field validators). Gaps: rent minimum (P2-17); the `available_from` NULL semantics (P0-2); no maximum on the `sitemap` offset (bounded by the rate limit).
- **Transactions:** services are `@Transactional`, except the lifecycle methods in `ListingSearchService` (P2-2). Account deletion deliberately rolls back on a Firebase failure (good).
- **Pagination:** keyset everywhere; admin queues unbounded (P2-9).
- **Contract mismatches:** web wizard vs listing model (P0-2); mobile publish vs submit rules (P0-4); mobile media URL vs S3 (P0-5); WebP (P1-5); `fields` unused (P1-4). Unused endpoints: `/neighborhoods`, `/cities`, `/reports/me`, admin WARN, `/admin/users/{id}`, `/listings/{id}/renew` (P0-3).

# 11. Security Audit (consolidated)

| Area | Finding |
|---|---|
| Hardcoded secrets | None in source. The dev fuzz secret default is overridden and required in production (`application-production.yml`). |
| AuthN | Firebase ID tokens verified per request; no revocation check (P2-10). |
| AuthZ / IDOR | No IDOR found. Owner, participant and admin checks are server-side and token-derived. |
| Mass assignment | Prevented by explicit DTOs. |
| Injection | Native queries use bound parameters; enum arrays are cast server-side. |
| XSS | React escaping; JSON-LD `<` escaped; no `dangerouslySetInnerHTML` besides JSON-LD. |
| CSRF | Not applicable (bearer header, no cookies). |
| Uploads | MIME allow-list, 5 MB, dimension/pixel caps before decode, re-encode, UUID keys, traversal guard. Good. |
| Moderation bypass | Photo edits skip re-review (P1-2). |
| Abuse | Per-IP limits too strict for shared IPs (P1-6); auto-suspend griefing (P2-27); no block-user feature (P2). |
| Error leakage | Stack traces never returned; route pattern (not the path) is reported to Sentry. Good. |
| Admin | Double-gated. Self-ban and admin-ban possible (P2-7). |

# 12. Database & Data Integrity Audit (consolidated)

- **Constraints:** strong. FKs, CHECKs matching DTOs, partial unique indexes (active cover, pending report, conversation pairs, `lower(email)` among live users).
- **Soft delete:** consistent `deleted_at` filters; the ban path doesn't revoke photos (P2-6).
- **Lost updates:** no `@Version` (P2-2).
- **Orphans:** photos, rooms, amenities and house rules cascade on listing delete (hard delete never happens; soft delete revokes photos). Conversations keep deleted participants by design, and sending to them should be refused (P2-5).
- **Inconsistent states possible today:** a PUBLISHED listing with zero photos (P1-2), a SUSPENDED listing that can never leave that state (P1-13), NULL furnishing/date on every web listing (P0-2), `neighborhood` spelling variants (P1-11).
- **Missing column for a needed feature:** `conversations.last_message_at` (P1-7); `users.terms_accepted_at` (P1-15).

# 13. Frontend Audit (consolidated)

- **Architecture:** a single `apiFetch` door; `authStateReady()` avoids refresh-time signed-out flashes; `isCurrent` guards prevent stale state in every effect read. Good.
- **Risks:** duplicate and per-keystroke requests (P1-14); `publish/page.tsx` (1,337 lines) and `SearchResults.tsx` (1,056 lines) are large but coherent. Only split them when touching them for P0-2 and P1-14.
- **Type safety:** web and mobile `types/api.ts` mirror the DTOs; the mobile media URL comment is wrong (P0-5).
- **Hardcoded values:** `localhost` fallbacks only in dev config (the production build gate requires env vars). The city list is hard-coded, which is acceptable for 4 launch cities.
- **Mobile:** no owner flows; `numeric('')===0` (P0-4); free-text filters (P2-25).

# 14. Testing Gaps (meaningful only)

| Missing test | Protects | Where |
|---|---|---|
| New-message notification enqueue + throttle | P0-1 | `MessagingApiTest` / new `MessageNotificationTest` |
| Search with furnishing/date filters against listings created without those fields; wizard payload contains them | P0-2 | `ListingApiTest`, Playwright `keyboard-publish.spec.ts` |
| Renew from UI; wizard success copy per status | P0-3 | Playwright `account-journeys.spec.ts` |
| Mobile publish body; `mediaUrl` absolute/relative | P0-4, P0-5 | `apps/mobile/src/lib/__tests__/` |
| 405/415/missing-part/constraint-violation envelope + no Sentry report | P1-1 | `GlobalExceptionHandlerTest` |
| Photo add/delete on a PUBLISHED listing returns it to review / keeps ≥1 photo | P1-2 | `ListingApiTest` |
| Edit PUBLISHED without saving sends no PATCH | P1-3 | Playwright |
| Field errors rendered | P1-4 | Playwright with mock 400 |
| Orientation-6 JPEG upright after upload (if server fallback) | P1-5 | `ImageProcessorTest` |
| Many users, one IP, not throttled on SIGNUP/UPLOAD | P1-6 | `RateLimitInterceptorTest` |
| Inbox order by last activity + cursor stability | P1-7 | `MessagingApiTest` |
| Detail `owner` block leaks no PII | P1-8 | `JsonWireContractApiTest` |
| Clearing bio/city | P1-9 | `UserApiTest` |
| Reinstate suspended listing | P1-13 | `AdminApiTest` |
| **Structural gap:** web e2e runs against `e2e/mock-api.mjs` only; no test drives web ↔ real API. Add one smoke journey (sign up via emulator → publish → approve → search → message) against Testcontainers or the local stack. | Contract drift (the class of P0-2/P0-4/P0-5) | new `e2e/tests/full-stack.spec.ts` |

# 15. Production Cleanup

- No real TODO, FIXME or HACK comments, no `console.log` or `debugger`, and no lorem ipsum in app source. The only hits are dev scripts and `.env.*.example` placeholders, which are fine.
- **Remove or fix before launch:** `/account/payments` (P1-12); the false copy on `/account/notifications` and `/account/security` (P1-12); the marketing overclaims (P2-22); the WebP copy (P1-5); the 501 `phone-verification` route (P2-8); dead methods in `ListingSearchService` (P2-26).
- E2E auth seam (`window.__DARI_E2E_AUTH__`) is correctly disabled when `NODE_ENV === 'production'` (`lib/firebase.ts:51-55`). Keep it.
- The mobile "PHOTO" text placeholder for listings without photos is acceptable. It only appears if all photos were deleted, which P1-2 prevents.

# 16. Missing Features / Edge Cases

- Owner notification for messages (P0-1). Mobile push is post-launch.
- Listing renewal UI (P0-3). Suspension appeal and reinstate (P1-13).
- Host identity on listings (P1-8); **block user** in chat (P2; report exists).
- Password change entry point (P1-12/P2-1); terms acceptance (P1-15).
- "Mes signalements" (P2-8); admin nav (P2-23).
- Choice between resuming a draft and starting a new listing (P2-21).
- Messaging a deleted or banned user should be refused with a clear state (P2-5).
- Suspended users can't delete their account (P2-11), which is an erasure-rights question for counsel.

---

# 17. Implementation Plan

Each task is one coherent unit (one commit). Stay within the 45 commits/day cap.

### Phase 1 — Security and data-integrity blockers
| Task | Objective | Files | Deps | Pri | Verify |
|---|---|---|---|---|---|
| 1.1 | Return photo edits on live listings to review; keep ≥1 photo | `listing/ListingService.java` (+ `ListingApiTest`) | — | P1-2 | API tests |
| 1.2 | Framework exception handlers (405/415/400/409), no Sentry for them | `common/error/GlobalExceptionHandler.java`, test | — | P1-1 | curl + `GlobalExceptionHandlerTest` |
| 1.3 | Profile fields clearable (blank→null) | `user/UserService.java`, web `account/profile/page.tsx`, mobile `(tabs)/profile.tsx` | — | P1-9 | `UserApiTest` |
| 1.4 | Rate limits keyed by user for authenticated writes; IP ceiling raised | `common/ratelimit/RateLimitInterceptor.java`, `application.yml` | — | P1-6 | `RateLimitInterceptorTest` |

### Phase 2 — Broken/incomplete functionality
| Task | Objective | Files | Deps | Pri | Verify |
|---|---|---|---|---|---|
| 2.1 | New-message email notification with throttle | `notification/NotificationService.java`, `OutboxNotificationService.java`, `NotificationDeliveryService.java` (EVENT_TYPES), `messaging/ConversationService.java`, repository query | — | P0-1 | integration test + Mailpit |
| 2.2 | Wizard collects furnishing, date, stay, deposit, charges, rooms/baths, roommates; submit requires furnishing + date; one date-filter NULL rule across list, count and map | `app/publish/page.tsx`, `listing/ListingSearchService.submit`, `ListingSearchRepository` (4 live filter copies) | — | P0-2 | API + Playwright |
| 2.3 | Renew button + wizard status-aware submit/renew/suspended copy | `app/account/listings/page.tsx`, `app/publish/page.tsx` | — | P0-3 | Playwright |
| 2.4 | Mobile: hide publish (launch) **or** parity rewrite | `apps/mobile/app/(tabs)/profile.tsx` (or `publish.tsx` + new `my-listings.tsx`) | decision | P0-4 | jest + device |
| 2.5 | Mobile `mediaUrl()` | `apps/mobile/src/lib/api.ts`, `ListingCard.tsx`, `listing/[id].tsx`, `publish.tsx`, `(tabs)/profile.tsx`, `types/api.ts` | — | P0-5 | jest |
| 2.6 | Reinstate suspended listing + suspended view + owner sees reason | `moderation/AdminService.java`, `AdminController.java`, `app/admin/listings/page.tsx`, `app/account/listings/page.tsx` | — | P1-13 | `AdminApiTest` |

### Phase 3 — Frontend/backend integration fixes
| Task | Objective | Files | Deps | Pri | Verify |
|---|---|---|---|---|---|
| 3.1 | Inbox ordered by last activity (V29 `last_message_at` + backfill + index + cursor) | migration, `Conversation.java`, `ConversationService`, `ConversationRepository`, `TypedCursors` | — | P1-7 | `MessagingApiTest` |
| 3.2 | Host block on detail + profile/report links in thread + avatar on profile | `PublicListingDetailResponse`, `ListingSearchService`, web `ListingDetailContent.tsx`, `messages/[id]/page.tsx`, `profile/[id]/page.tsx`, mobile `listing/[id].tsx` | — | P1-8 | contract test + Playwright |
| 3.3 | Normalized neighborhood match + suggestions from `/neighborhoods` | migration (expression index or key column), `ListingSearchRepository`, wizard/search/mobile inputs | — | P1-11 | API test |
| 3.4 | Edit of PUBLISHED listing saves once at the end | `app/publish/page.tsx` | 2.2 | P1-3 | Playwright |

### Phase 4 — UI/UX and responsiveness
| Task | Objective | Files | Pri | Verify |
|---|---|---|---|---|
| 4.1 | Honest account pages (remove Payments, fix Notifications/Security copy, password-reset button, completion checks) | `app/account/*` | P1-12 | visual QA |
| 4.2 | Client-side image resize/orientation + correct formats copy (+ optional server orientation) | `app/publish/page.tsx`, `app/account/profile/page.tsx`, new `lib/image.ts`, `media/ImageProcessor.java` | P1-5 | upload matrix |
| 4.3 | Notification email templates with title + link | `OutboxNotificationService`, `SmtpNotificationSender` | P1-10 | tests + Mailpit |
| 4.4 | Responsive/text polish: P2-13, P2-14, P2-15, P2-24 | listed files | P2 | 360/768/1280 screenshots |

### Phase 5 — Error handling and edge cases
| Task | Objective | Files | Pri | Verify |
|---|---|---|---|---|
| 5.1 | Render `fields`; maxLength everywhere | `components/ErrorNotice.tsx`, `ds/Input.tsx`, `ds/Textarea.tsx`, forms, mobile `TextField` | P1-4 | Playwright |
| 5.2 | Debounced/abortable search | `app/listings/SearchResults.tsx` | P1-14 | network log |
| 5.3 | Terms acceptance (V29/V30 + DTO + UI) | `user/*`, `app/sign-up/page.tsx`, mobile `sign-up.tsx`/`profile-recovery.tsx` | P1-15 | `UserApiTest` |
| 5.4 | P2-5, P2-11, P2-17, P2-18, P2-19, P2-20 edge cases | listed files | P2 | per item |

### Phase 6 — Testing
Add every row of §14, above all the **full-stack smoke journey** against the real API. Run `./mvnw test`, `npm run typecheck && npm run build && npx playwright test` and mobile `npm test`.

### Phase 7 — Final cleanup
P2-8 (WARN UI, remove the 501 stub), P2-22 (copy), P2-26 (dead code), P2-23 (admin nav), P2-9 (N+1 and queue paging), P2-2/3/4 (locking and races), P2-6/7 (moderation hygiene), P2-10/12.

---

# 18. Final Pre-Launch Checklist

**Blockers**
- [ ] P0-1: a message from A to B produces one email to B (Mailpit), with a link to the thread and no message body
- [ ] P0-2: a new web listing appears under "Meublé" and a move-in date filter
- [ ] P0-3: an EXPIRED listing can be renewed from `/account/listings`; editing an expired or suspended listing never claims "envoyée pour validation"
- [ ] P0-4: mobile publish either hidden or submits successfully on a device
- [ ] P0-5: a mobile build pointed at S3/MinIO shows listing photos and the avatar

**Journeys (manual, on production-like stack, desktop + 360 px mobile web + one iOS + one Android device)**
- [ ] Sign up → verify email → profile → sign out → sign in → reset password
- [ ] Search by city, neighborhood (lowercase), price, furnishing, date; map view; pagination
- [ ] Publish with 3 phone photos (portrait, >5 MB, WebP) → approve → visible in search with correct orientation
- [ ] Edit a live listing without saving → still live; save → re-review
- [ ] Add a photo to a live listing → re-review
- [ ] Contact the owner → the owner gets the email → reply → inbox order updates on both sides
- [ ] Report a user from a web thread; moderator suspends, then reinstates, a listing
- [ ] Clear bio/city → public profile no longer shows them
- [ ] Delete a listing; delete the account → can't sign in; email re-registers

**API hygiene**
- [ ] `PUT /api/v1/listings` → 405 envelope; no Sentry event
- [ ] 10 sign-ups from one IP within an hour all succeed
- [ ] `./mvnw test` green; Playwright (dev + production) green; mobile jest green; new full-stack smoke green

**Content & legal**
- [ ] No Payments page; the Notifications and Security pages state only true facts
- [ ] Terms/privacy acceptance at sign-up, stored with a version
- [ ] Legal texts reviewed by counsel (**Not verifiable from the current repository**)
- [ ] Marketing copy matches behaviour (charges, "profils contrôlés")

**Not verifiable from the current repository (confirm by hand):** Firebase console settings (password policy, email enumeration protection, authorized domains, verification and reset email templates and sender), SMTP deliverability (SPF/DKIM/DMARC), CDN/S3 CORS and caching for media, real-device a11y and keyboard/viewport behaviour, store listing content.

---

## Verification of this report

Every P0/P1 cites the exact file (and lines where applicable) read during the audit. Two items should be reproduced before fixing: P1-1 (run `curl -X PUT` against a local API) and P1-5 orientation (upload an orientation-6 JPEG through the web wizard). The rest are direct code paths with no runtime ambiguity.

*Graph: graphify was not used, because its CLI isn't on PATH in this shell, and the graph was not updated.*
