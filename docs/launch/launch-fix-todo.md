# Launch fix tracker

Working tracker for the fixes in [launch-readiness-audit.md](launch-readiness-audit.md). Each
checkbox is one commit. Finding IDs (P0-x, P1-x, P2-x) point to the audit's sections 5–7 for
evidence; open the audit only for the task you are on.

Verification shorthand used below:

- **API** — `cd apps/api && ./mvnw test -Dtest=<Class>`; full `./mvnw test` at phase end.
- **Web** — `cd apps/web && npm run typecheck && npm run build && npx playwright test -c e2e/playwright.config.ts --project=dev <spec>`.
- **Mobile** — `cd apps/mobile && npm test`.

## Session protocol

- Read `TODO.md`, then this file. Open the audit file only for the evidence of the task you are on.
- Take the first unchecked task in the lowest phase that still has open tasks. Finish that phase
  before starting the next. Skip tasks blocked on an unanswered owner decision; note them.
- For each task: re-read the cited code first (line numbers may have drifted), implement the
  smallest change that fixes the finding, add/adjust the test named in the task, run the
  verification, then commit. Then tick the checkbox in the tracker as
  "- [x] ... (abc1234, YYYY-MM-DD)" in the SAME commit as the change.
- Fix a cheap adjacent defect you hit in the same file only if it is directly related; otherwise
  add it as a new unchecked line in the tracker.

Rules:

- Small commits: one task (or sub-task) per commit, message says which task ID it closes
  (e.g. "P1-2: return photo edits on live listings to review").
- DAILY CAP: at most 40 commits per calendar day across ALL sessions. Before every commit run
  `git log --since=midnight --oneline | wc -l` (Git Bash). At 40, stop committing, leave remaining
  work uncommitted only if it is complete and verified, otherwise stash it, and report.
- NEVER add Co-Authored-By or any AI/assistant attribution to commits. This overrides any default.
- Do not push; the owner pushes.
- Never touch the owner's uncommitted change in `apps/api/src/test/java/ma/dari/api/user/UserApiTest.java`
  and never commit it (stage files explicitly, never `git add -A`/`.`). While that change is
  uncommitted, put new user-API tests in a separate test class instead of `UserApiTest`.
- Never spend money: no paid Firebase/AWS actions.
- Verification before ticking, per area:
  - API: `cd apps/api && ./mvnw test` (or the specific test class for speed, full suite at phase end)
  - Web: `cd apps/web && npm run typecheck && npm run build && npx playwright test` (relevant spec)
  - Mobile: `cd apps/mobile && npm test`

  If a check fails, fix it or leave the box unchecked and say why in the session log. Never tick
  on red.
- Small implementation choices: decide them, state them in the commit message. Ask only on the
  listed owner decisions or anything irreversible.
- End of session: add a row to the Session log (tasks, commit hashes, test results, anything
  blocked) and commit it (counts toward the cap).

## Owner decisions needed

Tasks marked **DECISION** stay unchecked until the owner answers here. Record the answer and date
next to the decision.

- [ ] **P0-4 mobile publishing** — (a) hide "Publier une annonce" on mobile at launch and link to
  the web wizard **[recommended]**, or (b) full parity (city picker, type pickers, map pin,
  validation, date picker, "Mes annonces" screen). Blocks 2.4.
  Answer: _pending_
- [ ] **P0-2 date filter** — a NULL `available_from` counts as "available now" (the rule the map
  query already uses) **[recommended]**, or backfill `available_from = created_at::date` and keep
  the strict rule. Blocks 2.2d.
  Answer: _pending_
- [ ] **P0-1 new-message email throttle window** — at most one email per (recipient,
  conversation) per 30 minutes while unread **[recommended]**. Blocks 2.1a/2.1b.
  Answer: _pending_
- [ ] **P1-15 consent** — a sentence with links ("En créant un compte, vous acceptez les
  Conditions d'utilisation et la Politique de confidentialité") plus a stored `terms_version`
  **[recommended]**, or a required checkbox. Exact wording and the version string come from the
  owner. Blocks 5.3a–5.3d.
  Answer: _pending_
- [ ] **P1-13 moderation contact** (added 2026-09-29) — the address owners write to about a
  suspension (for example a `moderation@` mailbox), shown as "Contacter la modération" on a
  suspended listing. Blocks 2.6e.
  Answer: _pending_

## Phase 1 — Security and data-integrity blockers

- [x] **1.1a** P1-2 — photo add and cover change on a PUBLISHED listing return it to
  PENDING_REVIEW via `returnToReviewIfLive(listing)`, shared with `update`. Reorder and delete do
  not (they show nothing unreviewed; 1.1b stops a live listing losing its last photo). Files:
  `apps/api/.../listing/ListingService.java`, `ListingApiTest`. Verify: API
  `-Dtest=ListingApiTest` — published → add photo → anonymous `GET /listings/{id}` 404, status
  PENDING_REVIEW. (2026-09-29)
- [x] **1.1b** P1-2 — `deletePhoto` refuses the last photo of a PUBLISHED or PENDING_REVIEW listing
  (400 "Une annonce publiée doit garder au moins une photo"). Files: `ListingService.java`,
  `ListingApiTest`. Verify: API `-Dtest=ListingApiTest` — deleting the only photo of a published
  listing → 400, photo still present. (2026-09-29)
- [x] **1.2a** P1-1 — handlers for `HttpRequestMethodNotSupportedException` (405 + `Allow`),
  `HttpMediaTypeNotSupportedException` (415), `MissingServletRequestPartException` and
  `MissingServletRequestParameterException` (400), all in the standard envelope, no Sentry report,
  no `dari.errors.unhandled` increment. New codes `METHOD_NOT_ALLOWED`, `UNSUPPORTED_MEDIA_TYPE`.
  Files: `apps/api/.../common/error/GlobalExceptionHandler.java`, `ErrorCode.java`,
  `GlobalExceptionHandlerTest`, `ErrorReportingApiTest` (real PUT `/listings`, text/plain POST
  `/conversations`, multipart without `file`). Verify: API
  `-Dtest=GlobalExceptionHandlerTest,ErrorReportingApiTest`. (2026-09-29)
- [x] **1.2b** P1-1 — `DataIntegrityViolationException` → 409 `CONFLICT`, logged at warn (constraint
  name only), not reported. Files: `GlobalExceptionHandler.java`, `GlobalExceptionHandlerTest`.
  Verify: API `-Dtest=GlobalExceptionHandlerTest,ArchitectureTest`. (2026-09-29)
- [x] **1.3a** P1-9 — `UserService.update` maps a blank `bio`/`city`/`firstName` to `null`
  (cleared), trims values; a blank `displayName` → 400. Files: `apps/api/.../user/UserService.java`,
  new `UserProfileClearingApiTest` (not `UserApiTest`, see rules). Verify: API
  `-Dtest=UserProfileClearingApiTest,UserApiTest` — PATCH `{bio:""}` → `GET /users/me` `bio: null`
  and the public profile has no bio. (2026-09-29)
- [x] **1.3b** P1-9 — web profile form sends `""` for cleared fields instead of `null`. Files:
  `apps/web/src/app/account/profile/page.tsx`, `account-journeys.spec.ts` (asserts the PATCH
  payload). Verify: Web typecheck + `account-journeys` spec (its web servers include the
  production `next build`). (2026-09-29)
- [x] **1.3c** P1-9 — mobile profile `save()` sends `""` for cleared fields via a new tested
  `profileUpdateBody`. Files: `apps/mobile/app/(tabs)/profile.tsx`, `src/lib/profile.ts`,
  `src/lib/__tests__/profile.test.ts`. Verify: Mobile `npm test` + `npm run typecheck`.
  (2026-09-29)
- [x] **1.4a** P1-6 — authenticated mutation types (SIGNUP, LISTING, UPLOAD, MESSAGE, REPORT) are
  limited per user; the IP bucket for them becomes a ceiling at a multiple (15×,
  `DARI_RATE_LIMIT_SHARED_ADDRESS_MULTIPLIER`) of the per-user limit. Reads and anonymous calls
  stay IP-limited. Files: `apps/api/.../common/ratelimit/RateLimitInterceptor.java`,
  `RateLimitService.java`, `application.yml`, `.env.example`, `production-operations.md`,
  `RateLimitInterceptorTest`. Verify: API `-Dtest=RateLimitInterceptorTest,RateLimitServiceTest,
  SsrSharedSecretRateLimitIntegrationTest,TomcatForwardedRateLimitIntegrationTest` — 10 users
  from one IP each sign up; one user's 6th → 429; the address ceiling still binds. (2026-09-29)
- [x] **1.4b** P1-6 — raise `search` to 600/min per IP in `dari.rate-limits`. Files:
  `application.yml`, `RateLimitService.java` default, `.env.example`, `production-operations.md`,
  `infra/scripts/load-test-search.js` comment. Verify: API `-Dtest=RateLimitServiceTest,
  RateLimitInterceptorTest,SsrSharedSecretRateLimitIntegrationTest,TomcatForwardedRateLimitIntegrationTest,
  ProductionConfigValidatorTest`. (2026-09-29)
- [x] **1.5** Phase 1 gate — full API suite green. Verify: `cd apps/api && ./mvnw test` → 317/317,
  BUILD SUCCESS. (2026-09-29)

## Phase 2 — Broken/incomplete functionality (P0 first)

- [ ] **2.1a** P0-1 **DECISION (throttle window)** — `NotificationService.newMessage(recipient,
  conversation)`; enqueue from `ConversationService.sendMessageInternal` for the other participant,
  skipped when an unsent or recently sent `NEW_MESSAGE` row exists for (recipient, conversation)
  inside the window; add the type to `NotificationDeliveryService.EVENT_TYPES`. Payload: sender
  display name, listing title, link to `/messages/{id}`; never the message body. Files:
  `notification/NotificationService.java`, `OutboxNotificationService.java`,
  `NotificationDeliveryService.java`, outbox repository query, `messaging/ConversationService.java`,
  new `MessageNotificationTest`. Verify: API — A→B gives one row for B; second message inside the
  window gives none; after B reads, the next message enqueues again.
- [ ] **2.1b** P0-1 — email subject/body for `NEW_MESSAGE` in `SmtpNotificationSender` (subject
  names the sender/listing, body links to the thread, no message text). Files:
  `SmtpNotificationSender.java`, `NotificationDeliveryServiceTest`. Verify: API
  `-Dtest=NotificationDeliveryServiceTest`; manual Mailpit check of one email.
- [x] **2.2a** P0-2 — wizard "Chambre" step collects `roomFurnishing` (select) and `availableFrom`
  (date, min today); both added to `missingForSubmit`, `draftPayload()`, `loadDraft` and the
  Validation summary; an unchanged loaded date is not re-sent (the API refuses past dates).
  Files: `apps/web/src/app/publish/page.tsx`, `types/api.ts`, `lib/labels.ts`, `ds/Input.tsx`
  (date `min`), `e2e/mock-api.mjs` (PATCH null = unchanged), `keyboard-publish.spec.ts`,
  `account-journeys.spec.ts`. Verify: Web typecheck + `keyboard-publish account-journeys` specs —
  payload contains both fields. (2026-09-29)
- [x] **2.2b** P0-2 — wizard collects the optional fields: `minStayMonths`, `priceDeposit`,
  `wifiIncluded`/`electricityIncluded`/`waterIncluded`, `numBedrooms`, `numBathrooms`,
  `currentRoommatesCount`, `maxRoommates`; round-trips through `loadDraft`. Files:
  `publish/page.tsx`, `types/api.ts` (`ChargeInclusion`), `lib/labels.ts`,
  `account-journeys.spec.ts`. Verify: Web typecheck + `keyboard-publish account-journeys` specs
  (payload assertion). Known limit: a PATCH cannot clear an optional number once set (null =
  unchanged), same as every other optional listing field. (2026-09-29)
- [x] **2.2c** P0-2 — `ListingSearchService.submit` requires `roomFurnishing` and `availableFrom`
  (400 "Aménagement de la chambre requis" / "Date de disponibilité requise"; a past date is
  accepted). Files: `listing/ListingSearchService.java`, `ListingApiTest`. Verify: API
  `-Dtest=ListingApiTest` (57/57); full suite at the Phase 2 gate. Mobile publish (already unable
  to submit, P0-4) now also needs these fields if option (b) is chosen. (2026-09-29)
- [ ] **2.2d** P0-2 **DECISION (NULL date rule)** — one date-filter rule across
  `searchByLocationSorted`, `searchByRadiusPaginated`, `searchByRadiusWithCursor`, the count query
  and `mapPinsByLocationAndRadius`. Files: `listing/ListingSearchRepository.java`,
  `ListingApiTest`. Verify: API — a listing with NULL `available_from` behaves per the chosen rule
  in list, count and map.
- [x] **2.3a** P0-3 — "Renouveler" action on `/account/listings` for `status === 'EXPIRED'`
  (`POST /listings/{id}/renew`, card moves to PENDING_REVIEW). Files:
  `apps/web/src/app/account/listings/page.tsx`, new `owner-listings.spec.ts` (stubs the status
  in-spec, so the shared mock is unchanged). Verify: Web typecheck + `owner-listings` spec —
  renew call made, status label updates, action gone. (2026-09-29)
- [x] **2.3b** P0-3 — wizard `publish()`: EXPIRED → calls `/renew`; SUSPENDED → shows "Cette
  annonce est suspendue par la modération" and disables publish; success copy follows the resulting
  status ("envoyée pour validation" / "toujours en attente de validation" / "Modifications
  enregistrées"). Files: `publish/page.tsx`, `owner-listings.spec.ts`. Verify: Web typecheck +
  `owner-listings keyboard-publish account-journeys` specs — edit EXPIRED → renew call, past date
  not re-sent; edit SUSPENDED → publish disabled, no success message. (2026-09-29)
- [ ] **2.4** P0-4 **DECISION** — (a) hide "Publier une annonce" in `apps/mobile/app/(tabs)/profile.tsx`
  and link to the web wizard, or (b) parity rewrite (split into sub-tasks once chosen). Verify:
  Mobile `npm test` (+ for (b) a jest test on the request body and a device check).
- [x] **2.5** P0-5 — `mediaUrl(value)` in `apps/mobile/src/lib/api.ts` (absolute http(s) unchanged,
  else prefix `apiOrigin`); replace the concatenations in `src/components/ListingCard.tsx`,
  `app/listing/[id].tsx`, `app/publish.tsx`, `app/(tabs)/profile.tsx`; fix comments in
  `src/types/api.ts`. Test in `src/lib/__tests__/api.test.ts` (relative, absolute,
  protocol-relative). Verify: Mobile `npm test` (78/78) + `npm run typecheck`. A device build
  against S3/MinIO is still an owner check (audit §18). (2026-09-29)
- [x] **2.6a** P1-13 — `POST /admin/listings/{id}/reinstate`: SUSPENDED → prior status (or
  PUBLISHED), clears the moderator reason, writes a `REINSTATE_LISTING` `AdminAction`, notifies the
  owner (existing `LISTING_REINSTATED`); 409 when not suspended, 404 when deleted. Files:
  `moderation/AdminService.java`, `AdminController.java`, `AdminApiTest`. Verify: API
  `-Dtest=AdminApiTest` (19/19) — suspend → reinstate → public detail 200, audit row, outbox row.
  (2026-09-29)
- [x] **2.6b** P1-13 — `/admin/listings?status=SUSPENDED` queries the repository by status instead
  of filtering the pending list; only PENDING_REVIEW (default) and SUSPENDED are queues, anything
  else is a 400. Files: `AdminController.java`, `AdminService.java` (`moderationQueue`),
  `AdminApiTest`. Verify: API `-Dtest=AdminApiTest` (20/20). (2026-09-29)
- [x] **2.6c** P1-13 — web admin "Suspendues" queue (toggle next to "En attente de validation")
  showing the suspension reason and a "Réintégrer" action. Files:
  `apps/web/src/app/admin/listings/page.tsx`, new `admin-moderation.spec.ts` (stubs the suspended
  queue in-spec). Verify: Web typecheck + `admin-moderation account-journeys` specs, axe clean.
  (2026-09-29)
- [x] **2.6d** P1-13 — owner dashboard shows `rejectionReason` for SUSPENDED listings (or "après
  plusieurs signalements" when automatic) and that only moderation can lift it. Files:
  `apps/web/src/app/account/listings/page.tsx`, `owner-listings.spec.ts`. Verify: Web typecheck +
  `owner-listings` spec, axe clean. The "Contacter la modération" link is split out as 2.6e.
  (2026-09-29)
- [ ] **2.6e** P1-13 **OWNER INPUT (moderation contact)** — "Contacter la modération" link on a
  suspended listing. No public contact address exists in the app (`DARI_LEGAL_CONTACT` is
  server-only free text, rendered nowhere). Needs the address that handles appeals, then a
  `NEXT_PUBLIC_*` value or a server-rendered contact page. Files: `account/listings/page.tsx`.
- [ ] **2.7** Phase 2 gate — API full suite, web typecheck/build/full Playwright (dev +
  production), mobile jest all green.

## Phase 3 — Frontend/backend integration fixes

Migration numbers: the next free Flyway version at the time of writing is V29. Take the next free
number when the task lands (3.1 and 5.3 both add one).

- [ ] **3.1a** P1-7 — migration adding `conversations.last_message_at`, backfilled from
  `max(messages.sent_at)`, indexes on `(participant_a_id, last_message_at desc, id)` and the `b`
  equivalent; `Conversation.java` field; set in `sendMessageInternal` in the same transaction.
  Files: new `V29__...sql`, `messaging/Conversation.java`, `ConversationService.java`. Verify: API
  `-Dtest=MessagingApiTest,FlywayMigrationSmokeTest`.
- [ ] **3.1b** P1-7 — inbox ordered and paged by `coalesce(last_message_at, created_at)`; cursor
  carries `lastActivityAt`. Files: `ConversationRepository.java`, `TypedCursors`,
  `MessagingApiTest`, `TypedCursorsTest`. Verify: API — A↔B then A↔C, B replies → B's thread first;
  pagination stable across pages.
- [ ] **3.2a** P1-8 — `owner: { id, displayName, avatarUrl, verification, memberSince }` on
  `PublicListingDetailResponse`. Files: `listing/PublicListingDetailResponse.java`,
  `ListingSearchService.java`, `JsonWireContractApiTest`. Verify: API — detail has `owner` and no
  email/phone/uid.
- [ ] **3.2b** P1-8 — web "Proposé par" card on the listing detail linking to `/profile/{id}`.
  Files: `ListingDetailContent.tsx`, web `types/api.ts`, `e2e/mock-api.mjs`, a spec. Verify: Web +
  spec (detail → host card → profile).
- [ ] **3.2c** P1-8 — web thread header links the name to `/profile/{otherUserId}` and offers
  `ReportDialog targetType="USER"`. Files: `apps/web/src/app/messages/[id]/page.tsx`,
  `message-thread.spec.ts`. Verify: Web + spec (report dialog opens).
- [ ] **3.2d** P1-8 — public profile renders `avatarUrl` (initial as fallback). Files:
  `apps/web/src/app/profile/[id]/page.tsx`. Verify: Web typecheck/build + a spec assertion.
- [ ] **3.2e** P1-8 — mobile detail host card linking to the profile/report path. Files:
  `apps/mobile/app/listing/[id].tsx`, mobile `types/api.ts`. Verify: Mobile `npm test`.
- [ ] **3.3a** P1-11 — case/accent/whitespace-insensitive neighborhood match with an expression
  index (immutable `unaccent` wrapper or a stored `neighborhood_key`) across the live search
  copies. Files: new migration, `ListingSearchRepository.java`, `ListingApiTest`,
  `ListingSearchIndexUsageTest`. Verify: API — "Agdal" found by `neighborhood=agdal` and
  `neighborhood= Agdal`; index used.
- [ ] **3.3b** P1-11 — wizard and search filter offer `GET /neighborhoods?city=` suggestions
  (`<datalist>`). Files: `publish/page.tsx`, `listings/SearchResults.tsx`, `e2e/mock-api.mjs`.
  Verify: Web + spec (suggestions for Rabat).
- [ ] **3.3c** P1-11 — header search is city-aware. Files: `components/SiteNav.tsx`,
  `public-search.spec.ts`. Verify: Web + spec.
- [ ] **3.4** P1-3 — editing a PUBLISHED listing keeps edits client-side and PATCHes once on the
  final save; no PATCH when nothing changed; Photos step warns that photo changes re-review.
  Files: `publish/page.tsx`, `keyboard-publish.spec.ts`. Verify: Web + spec — Suivant through all
  steps and leave → no PATCH; final save → exactly one PATCH.
- [ ] **3.5** Phase 3 gate — API full suite, web full Playwright, mobile jest green.

## Phase 4 — UI/UX and responsiveness

- [ ] **4.1a** P1-12 — remove `/account/payments` (redirect to `/account`) and its hub link.
  Files: `apps/web/src/app/account/payments/*`, `account/page.tsx`. Verify: Web + visual QA.
- [ ] **4.1b** P1-12 — `/account/notifications` lists only real events (messages once 2.1 lands;
  report "reçu", not "traité"). Files: `account/notifications/page.tsx`. Verify: Web + visual QA.
- [ ] **4.1c** P1-12 — `/account/security`: "Changer mon mot de passe" sends a reset email via
  `sendPasswordReset(me.email)`; drop "Niveau élevé" and the Firebase copy. Files:
  `account/security/page.tsx`, a spec using the e2e auth seam. Verify: Web + spec.
- [ ] **4.1d** P1-12 — drop "Téléphone" from `PROFILE_COMPLETION_CHECKS`. Files:
  `account/page.tsx`. Verify: Web typecheck/build.
- [ ] **4.2a** P1-5 — `lib/image.ts`: draw to canvas, export JPEG ≤ 2560 px long edge at 0.85
  (fixes orientation, size, WebP); used by the wizard and profile avatar upload; formats copy
  corrected. Files: new `apps/web/src/lib/image.ts`, `publish/page.tsx`, `account/profile/page.tsx`.
  Verify: Web + manual upload matrix (portrait JPEG, >5 MB, WebP).
- [ ] **4.2b** P1-5 — server fills white before drawing PNG alpha onto RGB. Files:
  `media/ImageProcessor.java`, `ImageProcessorTest`. Verify: API `-Dtest=ImageProcessorTest`.
- [ ] **4.2c** P1-5 — server-side EXIF orientation fallback for API clients. Files:
  `ImageProcessor.java`, `ImageProcessorTest` (orientation-6 fixture). Verify: API
  `-Dtest=ImageProcessorTest`.
- [ ] **4.3a** P1-10 — `dari.public-site-url` config; per-event subject/body templates (greeting,
  what happened, reason, next step, link, footer) for moderation events. Files:
  `OutboxNotificationService.java`, `SmtpNotificationSender.java`, `application*.yml`,
  `NotificationDeliveryServiceTest`, `ProductionConfigValidatorTest` if the property is required
  in production. Verify: API `-Dtest=NotificationDeliveryServiceTest`.
- [ ] **4.3b** P1-10 / P0-3 — templates for expiry (title + link to `/account/listings`), report
  acknowledgement and new-message events. Files: same. Verify: API
  `-Dtest=NotificationDeliveryServiceTest`; one of each to Mailpit.
- [ ] **4.4a** P2-13 — `whiteSpace: 'pre-line'` on description, rules and bio. Files:
  `ListingDetailContent.tsx`, `profile/[id]/page.tsx`. Verify: Web + screenshot.
- [ ] **4.4b** P2-14 — auto-growing `<textarea>` composer, Enter sends, Shift+Enter newline,
  `maxLength=4000`. Files: `messages/[id]/page.tsx`, `message-thread.spec.ts`. Verify: Web + spec.
- [ ] **4.4c** P2-15 — thread page `height: 100dvh` with `100vh` fallback. Files:
  `messages/[id]/page.tsx`. Verify: Web + screenshot at 360 px.
- [ ] **4.4d** P2-24 — owner dashboard card and account stat grids stack below 480 px. Files:
  `account/listings/page.tsx`, `account/page.tsx`, `account/security/page.tsx`. Verify: Web +
  360/768/1280 screenshots.

## Phase 5 — Error handling and edge cases

- [ ] **5.1a** P1-4 — `error` prop on `ds/Input` and `ds/Textarea`; `ErrorNotice` lists
  `ApiError.fields`. Files: `components/ErrorNotice.tsx`, `components/ds/Input.tsx`,
  `components/ds/Textarea.tsx`. Verify: Web typecheck/build.
- [ ] **5.1b** P1-4 — forms render `fields` next to inputs (wizard, profile, report dialog). Files:
  `publish/page.tsx`, `account/profile/page.tsx`, report dialog, `e2e/mock-api.mjs`. Verify: Web +
  spec forcing a 400 with `fields`.
- [ ] **5.1c** P1-4 — `maxLength` equal to the DTO limit on every web text input (title 120,
  description 2000, rules, room descriptions, bio, composer 4000). Files: forms above. Verify: Web
  + spec (2,001 chars capped).
- [ ] **5.1d** P1-4 — mobile `TextField` accepts `maxLength` and shows field errors from the API.
  Files: mobile `TextField`, forms. Verify: Mobile `npm test`.
- [ ] **5.2** P1-14 — text inputs update the URL debounced (400 ms); in-flight requests aborted on
  param change; effect keyed on `searchParams` only. Files: `listings/SearchResults.tsx`,
  `public-search.spec.ts`. Verify: Web + spec — 8 characters in Quartier → at most 1 `/listings`
  request.
- [ ] **5.3a** P1-15 **DECISION (wording/version)** — migration adding `users.terms_accepted_at`
  and `users.terms_version`; optional `CreateUserRequest.acceptedTermsVersion` stored on create.
  Files: new migration, `user/*`, new user test class. Verify: API.
- [ ] **5.3b** P1-15 **DECISION** — web sign-up consent sentence with links; sends the version.
  Files: `apps/web/src/app/sign-up/page.tsx`, profile-creation call. Verify: Web + spec (links
  shown).
- [ ] **5.3c** P1-15 **DECISION** — mobile sign-up/profile-recovery consent and version. Files:
  `apps/mobile/app/sign-up.tsx`, `profile-recovery.tsx`. Verify: Mobile `npm test`.
- [ ] **5.3d** P1-15 **DECISION** — API makes the accepted version required (400 without it).
  Files: `CreateUserRequest`, user test class. Verify: API full suite.
- [ ] **5.4a** P2-5 — new conversations require a PUBLISHED listing; sends to a deleted or banned
  participant → 409. Files: `messaging/ConversationService.java`, `MessagingApiTest`. Verify: API
  `-Dtest=MessagingApiTest`.
- [ ] **5.4b** P2-5 — web thread shows "Ce compte n'existe plus" and disables the composer on that
  409. Files: `messages/[id]/page.tsx`, `message-thread.spec.ts`. Verify: Web + spec.
- [ ] **5.4c** P2-11 — sign-in maps `ACCOUNT_BANNED`/`UNAUTHENTICATED` to specific copy; global
  suspended banner. Files: `sign-in/page.tsx`, layout/nav. Verify: Web + `session-recovery` spec.
- [ ] **5.4d** P2-11 — allow `DELETE /users/me` while suspended. Files:
  `common/auth/FirebaseAuthFilter.java`, user test class. Verify: API.
- [ ] **5.4e** P2-17 — rent minimum 100 MAD server-side; client previews the parsed value. Files:
  `CreateListingRequest`/update DTO, `publish/page.tsx`, `ListingApiTest`. Verify: API + Web.
- [ ] **5.4f** P2-18 — `/publish` gated up front with a sign-in CTA carrying `next`; `next` on all
  "Se connecter" links. Files: `publish/page.tsx`, `account/*`, `messages`, `favorites`. Verify:
  Web + spec.
- [ ] **5.4g** P2-19 — `/account` without a profile links to `/profile-recovery`; recovery uses
  `Button`. Files: `account/page.tsx`, `profile-recovery/page.tsx`. Verify: Web.
- [ ] **5.4h** P2-20 — hide the sign-up form once `verificationPending`; map `weak-password` and
  `too-many-requests`. Files: `sign-up/page.tsx`. Verify: Web + spec.

## Phase 6 — Testing

- [ ] **6.1** Confirm every row of audit §14 has its test (most land with their task above); add
  any missing one, one commit per test. Verify: listed test classes/specs green.
- [ ] **6.2a** Full-stack smoke harness: web against the real API (local stack or Testcontainers)
  with the Firebase Auth emulator (free, no project calls). Files: new e2e config/script. Verify:
  harness boots and a trivial request passes.
- [ ] **6.2b** Full-stack smoke journey: sign up → publish → approve → search → message. Files:
  new `apps/web/e2e/tests/full-stack.spec.ts`. Verify: spec green.
- [ ] **6.3** Full run: `./mvnw test`; `npm run typecheck && npm run build && npx playwright test`
  (dev + production); mobile `npm test`.

## Phase 7 — Final cleanup

- [ ] **7.1** P2-8 — WARN action in the admin report queue UI. Files: `admin/reports/page.tsx`.
  Verify: Web + spec.
- [ ] **7.2** P2-8 — remove the 501 `POST /users/me/phone-verification` stub. Files:
  `user/UserController.java`, tests. Verify: API.
- [ ] **7.3** P2-22 — marketing copy matches behaviour (charges, "profils contrôlés",
  colocataires). Files: `app/layout.tsx`, `app/page.tsx`. Verify: Web.
- [ ] **7.4** P2-26 — delete dead `ListingSearchService`/`ListingSearchRepository` methods and move
  `ListingSearchOptimizationTest` onto `searchByLocationSorted`. Verify: API full suite.
- [ ] **7.5** P2-23 — "Administration" link for `me.role === 'ADMIN'`. Files: `SiteNav.tsx`,
  `account/page.tsx`. Verify: Web.
- [ ] **7.6a** P2-9 — batch amenities/rules/rooms by `listingId IN` in `listMine` and the admin
  queue. Verify: API full suite.
- [ ] **7.6b** P2-9 — `countByStatus` for the admin dashboard; page the queues. Verify: API
  `-Dtest=AdminApiTest`.
- [ ] **7.7a** P2-2 — `@Version` on `Listing` and `User` (migration) + 409 handler. Verify: API
  full suite.
- [ ] **7.7b** P2-2 — `@Transactional` on `ListingSearchService` lifecycle methods. Verify: API
  full suite.
- [ ] **7.8** P2-3 — favorites add via `insert … on conflict do nothing`. Files:
  `FavoriteService`, repository, `FavoriteApiTest`. Verify: API `-Dtest=FavoriteApiTest`.
- [ ] **7.9** P2-4 — lock the listing row in `addPhoto`. Files: `ListingService`, repository.
  Verify: API `-Dtest=ListingApiTest`.
- [ ] **7.10** P2-6 — ban revokes the banned user's listing photos (reuse the deletion loop).
  Files: `AdminService.banUser`, `AdminApiTest`. Verify: API.
- [ ] **7.11** P2-7 — refuse suspend/ban when the target is self or an ADMIN (409). Files:
  `AdminService`, `AdminApiTest`. Verify: API.
- [ ] **7.12** P2-10 — token revocation check (`verifyIdToken(token, true)` or short cache); confirm
  no billing impact first. Files: `FirebaseAuthFilter.java`. Verify: API full suite.
- [ ] **7.13** P2-12 — CORS exposes `X-Correlation-Id` and `Retry-After`. Files:
  `SecurityConfig.java`, `SecurityHeadersApiTest`. Verify: API.

Post-launch backlog (not scheduled in §17): P2-1, P2-16, P2-21, P2-25, P2-27, P2-28 — see audit §7.

## Session log

| Date | Tasks done | Commits | Test results | Notes |
|---|---|---|---|---|
