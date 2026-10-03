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
- A commit cannot contain its own hash: tick with the date in the task's commit, and fill in the
  hashes in the end-of-session log commit (as done on 2026-09-29).

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

- [x] **P0-4 mobile publishing** — (a) hide "Publier une annonce" on mobile at launch and link to
  the web wizard **[recommended]**, or (b) full parity (city picker, type pickers, map pin,
  validation, date picker, "Mes annonces" screen). Blocks 2.4.
  Answer: (a), the recommendation (owner, 2026-10-03).
- [x] **P0-2 date filter** — a NULL `available_from` counts as "available now" (the rule the map
  query already uses) **[recommended]**, or backfill `available_from = created_at::date` and keep
  the strict rule. Blocks 2.2d.
  Answer: NULL counts as "available now", the recommendation (owner, 2026-10-03).
- [x] **P0-1 new-message email throttle window** — at most one email per (recipient,
  conversation) per 30 minutes while unread **[recommended]**. Blocks 2.1a/2.1b.
  Answer: 30 minutes while unread, the recommendation (owner, 2026-10-03).
- [x] **P1-15 consent** — a sentence with links ("En créant un compte, vous acceptez les
  Conditions d'utilisation et la Politique de confidentialité") plus a stored `terms_version`
  **[recommended]**, or a required checkbox. Exact wording and the version string come from the
  owner. Blocks 5.3a–5.3d.
  Answer: the sentence with links, the recommendation (owner, 2026-10-03). The version is the
  legal pages' own `DARI_LEGAL_VERSION` (already required for a production web build), so the
  owner keeps one value; mobile gets it as `EXPO_PUBLIC_LEGAL_VERSION` (required for a
  production build). Wording as above.
- [x] **P1-13 moderation contact** (added 2026-09-29) — the address owners write to about a
  suspension (for example a `moderation@` mailbox), shown as "Contacter la modération" on a
  suspended listing. Blocks 2.6e.
  Answer: the recommendation (owner, 2026-10-03), using the support contact the owner already
  supplies as `DARI_LEGAL_CONTACT` (required for a production build), shown on a new `/contact`
  page. A dedicated `moderation@` mailbox later is only a change of that value.

## Phase 1 — Security and data-integrity blockers

- [x] **1.1a** P1-2 — photo add and cover change on a PUBLISHED listing return it to
  PENDING_REVIEW via `returnToReviewIfLive(listing)`, shared with `update`. Reorder and delete do
  not (they show nothing unreviewed; 1.1b stops a live listing losing its last photo). Files:
  `apps/api/.../listing/ListingService.java`, `ListingApiTest`. Verify: API
  `-Dtest=ListingApiTest` — published → add photo → anonymous `GET /listings/{id}` 404, status
  PENDING_REVIEW. (1e8ea78, 2026-09-29)
- [x] **1.1b** P1-2 — `deletePhoto` refuses the last photo of a PUBLISHED or PENDING_REVIEW listing
  (400 "Une annonce publiée doit garder au moins une photo"). Files: `ListingService.java`,
  `ListingApiTest`. Verify: API `-Dtest=ListingApiTest` — deleting the only photo of a published
  listing → 400, photo still present. (96be84a, 2026-09-29)
- [x] **1.2a** P1-1 — handlers for `HttpRequestMethodNotSupportedException` (405 + `Allow`),
  `HttpMediaTypeNotSupportedException` (415), `MissingServletRequestPartException` and
  `MissingServletRequestParameterException` (400), all in the standard envelope, no Sentry report,
  no `dari.errors.unhandled` increment. New codes `METHOD_NOT_ALLOWED`, `UNSUPPORTED_MEDIA_TYPE`.
  Files: `apps/api/.../common/error/GlobalExceptionHandler.java`, `ErrorCode.java`,
  `GlobalExceptionHandlerTest`, `ErrorReportingApiTest` (real PUT `/listings`, text/plain POST
  `/conversations`, multipart without `file`). Verify: API
  `-Dtest=GlobalExceptionHandlerTest,ErrorReportingApiTest`. (bd94c5c, 2026-09-29)
- [x] **1.2b** P1-1 — `DataIntegrityViolationException` → 409 `CONFLICT`, logged at warn (constraint
  name only), not reported. Files: `GlobalExceptionHandler.java`, `GlobalExceptionHandlerTest`.
  Verify: API `-Dtest=GlobalExceptionHandlerTest,ArchitectureTest`. (f9d75fc, 2026-09-29)
- [x] **1.3a** P1-9 — `UserService.update` maps a blank `bio`/`city`/`firstName` to `null`
  (cleared), trims values; a blank `displayName` → 400. Files: `apps/api/.../user/UserService.java`,
  new `UserProfileClearingApiTest` (not `UserApiTest`, see rules). Verify: API
  `-Dtest=UserProfileClearingApiTest,UserApiTest` — PATCH `{bio:""}` → `GET /users/me` `bio: null`
  and the public profile has no bio. (becedd0, 2026-09-29)
- [x] **1.3b** P1-9 — web profile form sends `""` for cleared fields instead of `null`. Files:
  `apps/web/src/app/account/profile/page.tsx`, `account-journeys.spec.ts` (asserts the PATCH
  payload). Verify: Web typecheck + `account-journeys` spec (its web servers include the
  production `next build`). (8cbec11, 2026-09-29)
- [x] **1.3c** P1-9 — mobile profile `save()` sends `""` for cleared fields via a new tested
  `profileUpdateBody`. Files: `apps/mobile/app/(tabs)/profile.tsx`, `src/lib/profile.ts`,
  `src/lib/__tests__/profile.test.ts`. Verify: Mobile `npm test` + `npm run typecheck`.
  (ccd0589, 2026-09-29)
- [x] **1.4a** P1-6 — authenticated mutation types (SIGNUP, LISTING, UPLOAD, MESSAGE, REPORT) are
  limited per user; the IP bucket for them becomes a ceiling at a multiple (15×,
  `DARI_RATE_LIMIT_SHARED_ADDRESS_MULTIPLIER`) of the per-user limit. Reads and anonymous calls
  stay IP-limited. Files: `apps/api/.../common/ratelimit/RateLimitInterceptor.java`,
  `RateLimitService.java`, `application.yml`, `.env.example`, `production-operations.md`,
  `RateLimitInterceptorTest`. Verify: API `-Dtest=RateLimitInterceptorTest,RateLimitServiceTest,
  SsrSharedSecretRateLimitIntegrationTest,TomcatForwardedRateLimitIntegrationTest` — 10 users
  from one IP each sign up; one user's 6th → 429; the address ceiling still binds. (f9fc443, 2026-09-29)
- [x] **1.4b** P1-6 — raise `search` to 600/min per IP in `dari.rate-limits`. Files:
  `application.yml`, `RateLimitService.java` default, `.env.example`, `production-operations.md`,
  `infra/scripts/load-test-search.js` comment. Verify: API `-Dtest=RateLimitServiceTest,
  RateLimitInterceptorTest,SsrSharedSecretRateLimitIntegrationTest,TomcatForwardedRateLimitIntegrationTest,
  ProductionConfigValidatorTest`. (508963c, 2026-09-29)
- [x] **1.5** Phase 1 gate — full API suite green. Verify: `cd apps/api && ./mvnw test` → 317/317,
  BUILD SUCCESS. (0d36a81, 2026-09-29)

## Phase 2 — Broken/incomplete functionality (P0 first)

- [x] **2.1a** P0-1 **DECISION (throttle window)** — `NotificationService.newMessage(recipient,
  conversation)`; enqueue from `ConversationService.sendMessageInternal` for the other participant,
  skipped when an unsent or recently sent `NEW_MESSAGE` row exists for (recipient, conversation)
  inside the window; add the type to `NotificationDeliveryService.EVENT_TYPES`. Payload: sender
  display name, listing title, link to `/messages/{id}`; never the message body. Files:
  `notification/NotificationService.java`, `OutboxNotificationService.java`,
  `NotificationDeliveryService.java`, outbox repository query, `messaging/ConversationService.java`,
  new `MessageNotificationTest`. Verify: API — A→B gives one row for B; second message inside the
  window gives none; after B reads, the next message enqueues again.
  Done (with 4.3c): `ConversationService.sendMessageInternal` counts the recipient's unread
  messages before saving; none → this message starts a new unread run and is emailed; otherwise
  only if no `NEW_MESSAGE` row for (recipient, conversation) is younger than 30 min (JVM clock on
  both sides). Same transaction as the message. V34 indexes the outbox lookup. MessageNotificationTest
  3/3 (first message, no text in the email; unread inside the window → none, read → again, reply →
  the other side; still unread after 31 min → again), MessagingApiTest 20/20, NotificationTemplatesTest
  9/9, NotificationDeliveryServiceTest 3/3, FlywayMigrationSmokeTest 1/1. (2026-10-03)
- [ ] **2.1b** P0-1 — email subject/body for `NEW_MESSAGE` in `SmtpNotificationSender` (subject
  names the sender/listing, body links to the thread, no message text). Files:
  `SmtpNotificationSender.java`, `NotificationDeliveryServiceTest`, and
  `apps/web/src/app/account/notifications/page.tsx` (add "Nouveaux messages", drop the "pas encore
  envoyés" line, update `account-pages.spec.ts`). Verify: API
  `-Dtest=NotificationDeliveryServiceTest`; manual Mailpit check of one email.
- [x] **2.2a** P0-2 — wizard "Chambre" step collects `roomFurnishing` (select) and `availableFrom`
  (date, min today); both added to `missingForSubmit`, `draftPayload()`, `loadDraft` and the
  Validation summary; an unchanged loaded date is not re-sent (the API refuses past dates).
  Files: `apps/web/src/app/publish/page.tsx`, `types/api.ts`, `lib/labels.ts`, `ds/Input.tsx`
  (date `min`), `e2e/mock-api.mjs` (PATCH null = unchanged), `keyboard-publish.spec.ts`,
  `account-journeys.spec.ts`. Verify: Web typecheck + `keyboard-publish account-journeys` specs —
  payload contains both fields. (2712136, 2026-09-29)
- [x] **2.2b** P0-2 — wizard collects the optional fields: `minStayMonths`, `priceDeposit`,
  `wifiIncluded`/`electricityIncluded`/`waterIncluded`, `numBedrooms`, `numBathrooms`,
  `currentRoommatesCount`, `maxRoommates`; round-trips through `loadDraft`. Files:
  `publish/page.tsx`, `types/api.ts` (`ChargeInclusion`), `lib/labels.ts`,
  `account-journeys.spec.ts`. Verify: Web typecheck + `keyboard-publish account-journeys` specs
  (payload assertion). Known limit: a PATCH cannot clear an optional number once set (null =
  unchanged), same as every other optional listing field. (b8b7121, 2026-09-29)
- [x] **2.2c** P0-2 — `ListingSearchService.submit` requires `roomFurnishing` and `availableFrom`
  (400 "Aménagement de la chambre requis" / "Date de disponibilité requise"; a past date is
  accepted). Files: `listing/ListingSearchService.java`, `ListingApiTest`. Verify: API
  `-Dtest=ListingApiTest` (57/57); full suite at the Phase 2 gate. Mobile publish (already unable
  to submit, P0-4) now also needs these fields if option (b) is chosen. (9f6db1e, 2026-09-29)
- [ ] **2.2d** P0-2 **DECISION (NULL date rule)** — one date-filter rule across
  `searchByLocationSorted`, `searchByRadiusPaginated`, `searchByRadiusWithCursor`, the count query
  and `mapPinsByLocationAndRadius`. Files: `listing/ListingSearchRepository.java`,
  `ListingApiTest`. Verify: API — a listing with NULL `available_from` behaves per the chosen rule
  in list, count and map.
- [x] **2.3a** P0-3 — "Renouveler" action on `/account/listings` for `status === 'EXPIRED'`
  (`POST /listings/{id}/renew`, card moves to PENDING_REVIEW). Files:
  `apps/web/src/app/account/listings/page.tsx`, new `owner-listings.spec.ts` (stubs the status
  in-spec, so the shared mock is unchanged). Verify: Web typecheck + `owner-listings` spec —
  renew call made, status label updates, action gone. (614f1f4, 2026-09-29)
- [x] **2.3b** P0-3 — wizard `publish()`: EXPIRED → calls `/renew`; SUSPENDED → shows "Cette
  annonce est suspendue par la modération" and disables publish; success copy follows the resulting
  status ("envoyée pour validation" / "toujours en attente de validation" / "Modifications
  enregistrées"). Files: `publish/page.tsx`, `owner-listings.spec.ts`. Verify: Web typecheck +
  `owner-listings keyboard-publish account-journeys` specs — edit EXPIRED → renew call, past date
  not re-sent; edit SUSPENDED → publish disabled, no success message. (b4ca744, 2026-09-29)
- [ ] **2.4** P0-4 **DECISION** — (a) hide "Publier une annonce" in `apps/mobile/app/(tabs)/profile.tsx`
  and link to the web wizard, or (b) parity rewrite (split into sub-tasks once chosen). Verify:
  Mobile `npm test` (+ for (b) a jest test on the request body and a device check).
- [x] **2.5** P0-5 — `mediaUrl(value)` in `apps/mobile/src/lib/api.ts` (absolute http(s) unchanged,
  else prefix `apiOrigin`); replace the concatenations in `src/components/ListingCard.tsx`,
  `app/listing/[id].tsx`, `app/publish.tsx`, `app/(tabs)/profile.tsx`; fix comments in
  `src/types/api.ts`. Test in `src/lib/__tests__/api.test.ts` (relative, absolute,
  protocol-relative). Verify: Mobile `npm test` (78/78) + `npm run typecheck`. A device build
  against S3/MinIO is still an owner check (audit §18). (ed2c2a9, 2026-09-29)
- [x] **2.6a** P1-13 — `POST /admin/listings/{id}/reinstate`: SUSPENDED → prior status (or
  PUBLISHED), clears the moderator reason, writes a `REINSTATE_LISTING` `AdminAction`, notifies the
  owner (existing `LISTING_REINSTATED`); 409 when not suspended, 404 when deleted. Files:
  `moderation/AdminService.java`, `AdminController.java`, `AdminApiTest`. Verify: API
  `-Dtest=AdminApiTest` (19/19) — suspend → reinstate → public detail 200, audit row, outbox row.
  (f3978a3, 2026-09-29)
- [x] **2.6b** P1-13 — `/admin/listings?status=SUSPENDED` queries the repository by status instead
  of filtering the pending list; only PENDING_REVIEW (default) and SUSPENDED are queues, anything
  else is a 400. Files: `AdminController.java`, `AdminService.java` (`moderationQueue`),
  `AdminApiTest`. Verify: API `-Dtest=AdminApiTest` (20/20). (1805e88, 2026-09-29)
- [x] **2.6c** P1-13 — web admin "Suspendues" queue (toggle next to "En attente de validation")
  showing the suspension reason and a "Réintégrer" action. Files:
  `apps/web/src/app/admin/listings/page.tsx`, new `admin-moderation.spec.ts` (stubs the suspended
  queue in-spec). Verify: Web typecheck + `admin-moderation account-journeys` specs, axe clean.
  (0dadfd4, 2026-09-29)
- [x] **2.6d** P1-13 — owner dashboard shows `rejectionReason` for SUSPENDED listings (or "après
  plusieurs signalements" when automatic) and that only moderation can lift it. Files:
  `apps/web/src/app/account/listings/page.tsx`, `owner-listings.spec.ts`. Verify: Web typecheck +
  `owner-listings` spec, axe clean. The "Contacter la modération" link is split out as 2.6e.
  (89ba966, 2026-09-29)
- [ ] **2.6e** P1-13 **OWNER INPUT (moderation contact)** — "Contacter la modération" link on a
  suspended listing. No public contact address exists in the app (`DARI_LEGAL_CONTACT` is
  server-only free text, rendered nowhere). Needs the address that handles appeals, then a
  `NEXT_PUBLIC_*` value or a server-rendered contact page. Files: `account/listings/page.tsx`.
- [ ] **2.7** Phase 2 gate — API full suite, web typecheck/build/full Playwright (dev +
  production), mobile jest all green.

## Phase 3 — Frontend/backend integration fixes

Migration numbers: the next free Flyway version at the time of writing is V29. Take the next free
number when the task lands (3.1 and 5.3 both add one).

- [x] **3.1a** P1-7 — V29 adds `conversations.last_activity_at` (NOT NULL, default `now()`),
  backfilled from `max(messages.sent_at)` or `created_at`, with `(participant_x_id,
  last_activity_at desc, id desc)` indexes; read-only on the entity; `touchActivity` (DB `now()`,
  one clock) in `sendMessageInternal`'s transaction. Chosen over a nullable `last_message_at` +
  `coalesce()` so the keyset stays a plain index. Files: `V29__conversations_last_activity.sql`,
  `Conversation.java`, `ConversationRepository.java`, `ConversationService.java`,
  `MessagingApiTest`, new `ConversationActivityMigrationTest`, `FlywayMigrationSmokeTest` (29),
  `Phase2MigrationsFromV25Test` (pinned to 28). Verify: API `-Dtest=MessagingApiTest,
  ConversationActivityMigrationTest,FlywayMigrationSmokeTest,Phase2MigrationsFromV25Test`.
  (09383ba, 2026-09-29)
- [x] **3.1b** P1-7 — inbox ordered and paged by `last_activity_at desc, id desc`; cursor mode
  `inbox-activity` carries `lastActivityAt` (an old "conversations" cursor is INVALID_CURSOR).
  Files: `ConversationRepository.java`, `TypedCursors.java`, `ConversationService.java`,
  `MessagingApiTest`. Verify: API `-Dtest=MessagingApiTest,TypedCursorsTest` (18/18, 2/2) — A↔B
  then A↔C, B replies → B's thread first; 21 threads page 20 + 1 with none lost or repeated.
  (68b7805, 2026-09-29)
- [x] **3.2a** P1-8 — `owner: { id, displayName, avatarUrl, verification, memberSince }` on
  `PublicListingDetailResponse` (new `ListingHostResponse`; the detail read is now
  `@Transactional(readOnly = true)` because it reads the lazy owner). Files:
  `listing/ListingHostResponse.java`, `PublicListingDetailResponse.java`,
  `ListingSearchService.java`, `JsonWireContractApiTest`. Verify: API
  `-Dtest=JsonWireContractApiTest,ArchitectureTest,ListingApiTest` — exact host fields, no
  email/uid/status. (b791b79, 2026-09-29)
- [x] **3.2b** P1-8 — web "Proposé par" card (avatar, name, verification, member since, "Voir le
  profil") above the contact button. New shared `components/UserAvatar.tsx` and
  `components/VerificationBadge.tsx`. Files: `ListingDetailContent.tsx`, web `types/api.ts`
  (`ListingHost`), `e2e/mock-api.mjs` (owner = other-user), new `listing-host.spec.ts`. Verify:
  Web typecheck + `listing-host listing-gallery json-ld media-origin hydration` (dev + production,
  15/15) — detail → host card → profile → report dialog. (14e2e75, 2026-09-29)
- [x] **3.2c** P1-8 — web thread header links the name to `/profile/{otherUserId}` and offers
  `ReportDialog targetType="USER"` ("Signaler"). Files: `apps/web/src/app/messages/[id]/page.tsx`,
  `message-thread.spec.ts`. Verify: Web typecheck + `message-thread account-journeys` specs — link
  target, report posts `{targetType: USER, targetId: other-user}`. (764d325, 2026-09-29)
- [x] **3.2d** P1-8 — public profile renders `avatarUrl` (initial as fallback) through the shared
  `UserAvatar` and `VerificationBadge`. Files: `apps/web/src/app/profile/[id]/page.tsx`,
  `e2e/mock-api.mjs` (other-user has a photo), `listing-host.spec.ts`. Verify: Web typecheck +
  `listing-host account-journeys` specs — the photo loads (naturalWidth > 0), axe clean.
  (eab2324, 2026-09-29)
- [x] **3.2e** P1-8 — mobile detail "Proposé par" card (photo or initial, name, verification,
  member since) with "Signaler ce profil" through the existing report screen (mobile has no
  public-profile screen). Labels in a tested `src/lib/host.ts`. Files:
  `apps/mobile/app/listing/[id].tsx`, mobile `types/api.ts`, `src/lib/host.ts`,
  `src/lib/__tests__/host.test.ts`. Verify: Mobile `npm test` (80/80) + typecheck. On-device look
  not checked. (cd3a9e4, 2026-09-29)
- [x] **3.3a** P1-11 — case/accent/whitespace-insensitive neighborhood match: V30 adds the
  `unaccent` extension and an IMMUTABLE `dari_fold(text)`; all six search SQL copies compare
  `dari_fold(l.neighborhood) = dari_fold(:neighborhood)`. No expression index: the filter always
  rides a city-scoped, sort-indexed scan (LIMIT 21), and `ListingSearchIndexUsageTest` confirms
  those plans are unchanged; `dari_fold` is indexable if a measurement ever says otherwise.
  `unaccent` also added to the RDS bootstrap, local init and bootstrap proof (whose init wait
  and volume cleanup were fixed so it runs here). Files: `V30__neighborhood_fold.sql`,
  `ListingSearchRepository.java`, `ListingApiTest`, `FlywayMigrationSmokeTest` (30),
  `infra/terraform/production/sql/bootstrap.sql`, `infra/db/init/00-extensions.sql`,
  `infra/prod-smoke/bootstrap-check.sh`. Verify: API `-Dtest=ListingApiTest,
  FlywayMigrationSmokeTest,ListingSearchIndexUsageTest,ListingSearchOptimizationTest`;
  `bash infra/prod-smoke/bootstrap-check.sh`. (8bd3a7a, 2026-09-29)
- [x] **3.3b** P1-11 — wizard and search filter offer `GET /neighborhoods?city=` suggestions through
  a new `components/NeighborhoodDatalist.tsx` (`<datalist>`; the field stays free text, now exposed
  as a combobox). `ds/Input` gains a `list` prop. Files: `publish/page.tsx`,
  `listings/SearchResults.tsx`, `ds/Input.tsx`, new `neighborhood-suggestions.spec.ts`,
  `public-search.spec.ts` / `account-journeys.spec.ts` (combobox role). Verify: Web typecheck +
  `neighborhood-suggestions public-search account-journeys keyboard-publish` (8/8). (2a2171a, 2026-09-29)
- [x] **3.3c** P1-11 — header search is city-aware: a compact `city` select (default Rabat, as
  the homepage hero) inside the GET form. Files: `components/SiteNav.tsx`,
  `public-search.spec.ts`. Verify: Web typecheck + `public-search hydration
  production/accessibility` (14/14) — header sends `city=Casablanca&neighborhood=maarif`.
  (9431f5c, 2026-09-29)
- [x] **3.4** P1-3 — editing a PUBLISHED listing keeps edits client-side and PATCHes once on the
  final save; no PATCH when nothing changed (compared with the loaded payload; "Aucune
  modification : l’annonce reste en ligne."); Photos step warns that photo changes re-review.
  Files: `publish/page.tsx`, `owner-listings.spec.ts`. Verify: Web typecheck + full Playwright
  (dev + production, 64 passed + 1 intentional skip) — Suivant through all steps → no PATCH;
  unchanged save → no request; changed save → exactly one PATCH. Same commit repairs two
  `getByLabel('Ville')` selectors made ambiguous by 3.3c's header select (scoped to `main`).
  (99907c7, 2026-09-29)
- [x] **3.5** Phase 3 gate — API full suite 325/325; web full Playwright (dev + production) 64
  passed + 1 intentional skip; mobile jest 80/80 + typecheck. (c0a44b5, 2026-09-29)

## Phase 4 — UI/UX and responsiveness

- [x] **4.1a** P1-12 — remove `/account/payments` (now a server redirect to `/account`) and its
  hub link. Files: `apps/web/src/app/account/payments/page.tsx`, `account/page.tsx`, new
  `account-pages.spec.ts`. Verify: Web typecheck + `account-pages hydration` (7/7). (fd50a5d, 2026-09-29)
- [x] **4.1b** P1-12 — `/account/notifications` lists only real events (listing updates, account
  moderation, report "reçu" not "traité") and says new messages are not emailed yet. Files:
  `account/notifications/page.tsx`, `account-pages.spec.ts`. Verify: Web typecheck +
  `account-pages` (2/2). When 2.1 lands, add "Nouveaux messages" back (see 2.1b). (cbb9c64, 2026-09-29)
- [x] **4.1c** P1-12 — `/account/security`: "Changer mon mot de passe" sends a reset email via
  `sendPasswordReset(me.email)`; drop "Niveau élevé" and the Firebase copy. Files:
  `account/security/page.tsx`, a spec using the e2e auth seam. Verify: Web typecheck +
  `account-pages` (4/4, incl. axe); 360/768/1280 screenshots, no overflow. (1a47b50, 2026-09-30)
- [x] **4.1d** P1-12 — drop "Téléphone" from `PROFILE_COMPLETION_CHECKS` (four checks, a quarter
  each). Files: `account/page.tsx`, `account-pages.spec.ts`. Verify: Web typecheck +
  `account-pages` (3/3) — a complete profile without a phone hides the completion card.
  (5a2fd7f, 2026-09-29)
- [x] **4.1e** P1-12 (added 2026-09-30, found in 4.4d screenshots) — the `/account` hub's
  Notifications card promised "Nouvelles réponses, visites et rappels"; now "E-mails sur vos
  annonces et votre compte". Files: `account/page.tsx`, `account-pages.spec.ts`. Verify: Web
  typecheck + `account-pages` (5/5). When 2.1 lands, mention replies again. (ffc753a, 2026-09-30)
- [x] **4.2a** P1-5 — `lib/image.ts`: draw to canvas, export JPEG ≤ 2560 px long edge at 0.85
  (fixes orientation, size, WebP); used by the wizard and profile avatar upload; formats copy
  corrected. Files: new `apps/web/src/lib/image.ts`, `publish/page.tsx`, `account/profile/page.tsx`.
  Verify: Web + manual upload matrix (portrait JPEG, >5 MB, WebP) — automated as
  `photo-upload.spec.ts` (3/3: EXIF-6 JPEG arrives 20×40, 3000×2000 PNG > 5 MB arrives
  2560×1707 JPEG, WebP arrives JPEG); with journeys/owner/media/account specs 20/20. (83096d8, 2026-09-30)
- [x] **4.2b** P1-5 — server fills white before drawing PNG alpha onto RGB. Files:
  `media/ImageProcessor.java`, `ImageProcessorTest`. Verify: API `-Dtest=ImageProcessorTest`
  (7/7; the new transparent-PNG test was red — black pixels — before the fix). (2f1d436, 2026-09-30)
- [x] **4.2c** P1-5 — server-side EXIF orientation fallback for API clients. Files:
  `ImageProcessor.java`, new `ExifOrientation.java`, `ImageProcessorTest` (orientation 6 in both
  byte orders, 8, 3, 1, and a malformed IFD offset). Verify: API `-Dtest=ImageProcessorTest`
  (13/13). (5ff4925, 2026-09-30)
- [x] **4.3a** P1-10 — `dari.public-site-url` config; per-event subject/body templates (greeting,
  what happened, reason, next step, link, footer) for moderation events. Files:
  `OutboxNotificationService.java`, `SmtpNotificationSender.java`, `application*.yml`,
  `NotificationDeliveryServiceTest`, `ProductionConfigValidatorTest` if the property is required
  in production. Verify: API `-Dtest=NotificationDeliveryServiceTest`. Done with new
  `NotificationTemplates` + V31 `notification_outbox.subject`; the site URL is optional (defaults
  to the first web origin, validated when set). NotificationTemplatesTest 6, SmtpNotificationSenderTest 2,
  NotificationDeliveryServiceTest 3, ProductionConfigValidatorTest 56, AdminApiTest 20,
  ReportApiTest 9, ListingExpiryIntegrationTest 8, FlywayMigrationSmokeTest 1 — all green. (ce4398b, 2026-09-30)
- [x] **4.3b** P1-10 / P0-3 — templates for expiry (title + link to `/account/listings`), report
  acknowledgement and new-message events. Files: same. Verify: API
  `-Dtest=NotificationDeliveryServiceTest`; one of each to Mailpit. Expiry, expiry warning and
  report receipt done; every event now has a template. The new-message event does not exist yet
  (2.1, blocked on P0-1), so its template moved to 4.3c. NotificationTemplatesTest 8,
  SmtpNotificationSenderTest 2, NotificationDeliveryServiceTest 3, ReportApiTest 9,
  ListingExpiryIntegrationTest 8, AdminApiTest 20; all 10 events sent through
  `SmtpNotificationSender` to a local Mailpit: subjects and UTF-8 bodies intact. (93fa117, 2026-09-30)
- [x] **4.3c** P1-10 / P0-1 (from 4.3b) — new-message email template (sender's first name, listing
  title, link to the thread). Lands with 2.1b; blocked on the P0-1 throttle decision. Files: `NotificationTemplates`, `NotificationTemplatesTest`.
  Done with 2.1a: subject "Nouveau message de {prénom} à propos de « {titre} »" (no listing → just
  the name); body links to `/messages/{id}`, says message text is never emailed and states the
  30-minute rule. Names and titles are folded to one line. New NotificationTemplatesTest case.
  (2026-10-03)
- [x] **4.4a** P2-13 — `whiteSpace: 'pre-line'` on description, rules and bio. Files:
  `ListingDetailContent.tsx`, `profile/[id]/page.tsx`. Verify: Web + screenshot. New
  `listing-host` test reads `innerText` (a newline survives only if rendered); mock data now
  carries line breaks. Full suite (dev + production): 69 passed, 1 skip, 3 failed: the new test
  (listing-1's description is the JSON-LD one; fixed) and `account-journeys` signup +
  `public-search`, which fail under full-suite load only. Rerun: those four specs 9/9 on dev,
  production project 21 + 1 skip. 360 px screenshots of description, rules and bio. (06a18f1, 2026-09-30)
- [x] **4.4b** P2-14 — auto-growing `<textarea>` composer, Enter sends, Shift+Enter newline,
  `maxLength=4000`. Files: `messages/[id]/page.tsx`, `message-thread.spec.ts`. Verify: Web + spec.
  Bubbles also keep line breaks (`pre-line`). message-thread + account-journeys 10/10 (dev),
  production project 21 + 1 skip; 360 px screenshot with a four-line draft. (ed36fc8, 2026-09-30)
- [x] **4.4c** P2-15 — thread page `height: 100dvh` with `100vh` fallback. Files:
  `messages/[id]/page.tsx`. Verify: Web + screenshot at 360 px. Done as `.thread-page` in
  `styles/app.css` (inline styles hold one value). message-thread 7/7 incl. a new 360×640 check
  (main is 640 px, composer inside the screen); production project 21 + 1 skip; screenshot.
  Real-device toolbar behaviour not checked (no device). (cba9dc8, 2026-09-30)
- [x] **4.4d** P2-24 — owner dashboard card and account stat grids stack below 480 px. Files:
  `account/listings/page.tsx`, `account/page.tsx`, `account/security/page.tsx`. Verify: Web +
  360/768/1280 screenshots. Done as `.stat-grid` / `.owner-listing-card` in `styles/app.css`.
  New `account-pages` test counts computed columns at 360 and 768 px; account-pages +
  owner-listings 11/11; full suite 74 passed + 1 skip + 1 load flake (`listing-host` profile
  navigation, 4/4 alone); screenshots at three widths, no horizontal overflow. (43447aa, 2026-09-30)

## Phase 5 — Error handling and edge cases

- [x] **5.1a** P1-4 — `error` prop on `ds/Input` and `ds/Textarea`; `ErrorNotice` lists
  `ApiError.fields`. Files: `components/ErrorNotice.tsx`, `components/ds/Input.tsx`,
  `components/ds/Textarea.tsx`. Verify: Web typecheck/build. Both ds fields already had `error`
  (red border, `aria-invalid`, message row); added `ErrorNotice`'s labelled list, a
  `fieldErrors()` helper and `FIELD_LABELS`/`fieldLabel()` in `lib/labels.ts`. Typecheck; full
  suite dev + production 75 passed + 1 skip. (9637fdf, 2026-09-30)
- [x] **5.1b** P1-4 — forms render `fields` next to inputs (wizard, profile, report dialog). Files:
  `publish/page.tsx`, `account/profile/page.tsx`, report dialog, `e2e/mock-api.mjs`. Verify: Web +
  spec forcing a 400 with `fields`. Stubbed with `page.route` (client-side fetches), so the mock
  API is unchanged. New `field-errors.spec.ts` 3/3; full suite 77 passed + 1 skip + the recurring
  `listing-host` load flake (fixed separately, 5.1e). (d1ed7ca, 2026-09-30)
- [x] **5.1c** P1-4 — `maxLength` equal to the DTO limit on every web text input (title 120,
  description 2000, rules, room descriptions, bio, composer 4000). Files: forms above. Verify: Web
  + spec (2,001 chars capped). Wizard title 120, quartier 80, description 2000, room 500, other
  rules 2000 (`ds/Input` gains `maxLength`); sign-up first/last name 30/29 (display name "Prénom
  Nom" ≤ 60) and city 60; profile-recovery 60. Profile (60/600), report (2000) and composer
  (4000, 4.4b) already matched. Admin reject reason stays 500 (API allows 1000). `field-errors`
  5/5; full suite 80 passed + 1 skip. (75aadd9, 2026-09-30)
- [x] **5.1d** P1-4 — mobile `TextField` accepts `maxLength` and shows field errors from the API.
  Files: mobile `TextField`, forms. Verify: Mobile `npm test`. `TextField` gains `error` (danger
  border, text below, read as the field's hint) and now applies the caller's `style` (the
  profile's taller bio box was dropped). New `lib/fields.ts` (`MAX_LENGTH`, `fieldErrors`) used by
  profile, publish, sign-up, profile-recovery and the composer; profile and publish show the
  API's field messages. Jest 83/83 (new `fields.test.ts`), typecheck clean. Not checked on a
  device. (4b995aa, 2026-09-30)
- [x] **5.1e** (test, added 2026-09-30) — `listing-host`'s "Voir le profil" navigation timed out
  under full-suite load twice: the App Router changes the URL only after `next dev` compiles
  `/profile/[id]`. That one assertion now waits 15 s. Files: `listing-host.spec.ts`. Verify: full
  suite 80 passed + 1 skip. (b73844c, 2026-09-30)
- [x] **5.2** P1-14 — text inputs update the URL debounced (400 ms); in-flight requests aborted on
  param change; effect keyed on `searchParams` only. Files: `listings/SearchResults.tsx`,
  `public-search.spec.ts`. Verify: Web + spec — 8 characters in Quartier → at most 1 `/listings`
  request. Every request (list, count, map, "load more") now builds its query from the URL alone
  (`apiSearchParams`); Quartier, Rayon and the price fields debounce; the URL-to-inputs sync skips
  URLs the page wrote itself so a late write cannot eat typed characters. `public-search` 4/4 (new:
  "Hay Riad" → 1 request, field keeps every character; radius mode sends lat/lng/radiusM, no city).
  Full suite 81 passed + 1 skip + 1 production a11y flake (5.2b); production rerun 21 + 1 skip.
  (cedc9f3, 2026-09-30)
- [x] **5.2b** (test, added 2026-09-30) — `production/accessibility.spec.ts` `/listings/listing-1`
  failed once under full-suite load with `page-has-heading-one`, although the spec waits for an
  `<h1>` first; passes on rerun. Find what replaces the heading after it attaches (streamed
  loading state?) rather than raising timeouts. Same `page-has-heading-one` seen twice on dev in
  `account-journeys` "signup provisions the profile…" under full-suite load (4.4a, 5.4c runs). Cause: the production helper waited for an `<h1>` to be
  *attached*, but streamed content arrives in `<div hidden id="S:0">` before it is swapped in;
  now it waits for a visible one. The signup journey scanned right after the URL changed, before
  `/account` rendered; it now waits for the page's `<h1>`. Both specs ×3 on both projects:
  30/30. (86818f5, 2026-09-30)
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
- [x] **5.4a** P2-5 — new conversations require a PUBLISHED listing; sends to a deleted or banned
  participant → 409. Files: `messaging/ConversationService.java`, `MessagingApiTest`. Verify: API
  `-Dtest=MessagingApiTest`. New error code `RECIPIENT_UNAVAILABLE` ("Ce compte n'existe
  plus"); an unpublished listing answers 404 like a missing one; an existing thread is still
  returned and readable. MessagingApiTest 20/20 (2 new); full API suite 347/347. (70c0c91, 2026-09-30)
- [x] **5.4b** P2-5 — web thread shows "Ce compte n'existe plus" and disables the composer on that
  409. Files: `messages/[id]/page.tsx`, `message-thread.spec.ts`. Verify: Web + spec. `RECIPIENT_UNAVAILABLE` added to `lib/errors.ts`;
  message-thread 8/8 (new: stubbed 409 → notice, composer and Envoyer disabled, history intact,
  unsent bubble removed). (c7fc193, 2026-09-30)
- [x] **5.4c** P2-11 — sign-in maps `ACCOUNT_BANNED`/`UNAUTHENTICATED` to specific copy; global
  suspended banner. Files: `sign-in/page.tsx`, layout/nav. Verify: Web + `session-recovery` spec. Sign-in (141015f): the API's sentence
  and a Firebase sign-out. Banner: `/users/me` now returns `status` (API, `UserStatusApiTest`);
  new `AccountStatusBanner` in the root layout, skipped on sign-in/up/recovery (it raced sign-in).
  session-recovery 9/9, account-pages 6/6 (+ axe on the banner), both ×2 with account-journeys
  38/38; UserStatusApiTest, UserApiTest, AdminApiTest, SecurityHeadersApiTest 40/40. (eed4703, 2026-09-30)
- [x] **5.4d** P2-11 — allow `DELETE /users/me` while suspended. Files:
  `common/auth/FirebaseAuthFilter.java`, user test class. Verify: API. `UserStatusApiTest` 2/2 (a suspended
  account's PATCH is 403 ACCOUNT_SUSPENDED, its DELETE 204 and soft-deletes); with UserApiTest,
  AdminApiTest, SecurityHeadersApiTest 40/40. (f46e659, 2026-09-30)
- [x] **5.4e** P2-17 — rent minimum 100 MAD server-side; client previews the parsed value. Files:
  `CreateListingRequest`/update DTO, `publish/page.tsx`, `ListingApiTest`. Verify: API + Web. New `parseMad` (`lib/format.ts`):
  "3.200"/"3,200"/"3 200" → 3200, "3200,50" → 3200.5, else unreadable (blocked with a message);
  rent helper previews "Loyer enregistré : 3 200 MAD/mois"; deposit parsed the same way.
  ListingApiTest 59/59 (new: 99.99 and 3.20 refused, 100 accepted); field-errors +
  account-journeys + keyboard-publish 11/11. (6849811, 2026-09-30)
- [x] **5.4f** P2-18 — `/publish` gated up front with a sign-in CTA carrying `next`; `next` on all
  "Se connecter" links. Files: `publish/page.tsx`, `account/*`, `messages`, `favorites`. Verify:
  Web + spec. New `lib/signInHref.ts`; used by
  account hub/listings/profile, favorites, messages, thread, search/listing/profile contact and
  favourite redirects, report dialog, admin layout. New `sign-in-return.spec.ts` 3/3; the production
  "publish shell hydrates" test now expects the gate. Full suite 89 passed + 1 skip + that test
  (fixed; production rerun 21 + 1 skip). (3473cfb, 2026-09-30)
- [x] **5.4g** P2-19 — `/account` without a profile links to `/profile-recovery`; recovery uses
  `Button`. Files: `account/page.tsx`, `profile-recovery/page.tsx`. Verify: Web. The sign-in link now shows only
  when signed out; the recovery button reads "Créer mon profil". account-pages (new: 404
  PROFILE_NOT_FOUND → "Créer mon profil" → recovery, axe) + account-journeys + session-recovery
  20/20. (9c26c08, 2026-09-30)
- [x] **5.4h** P2-20 — hide the sign-up form once `verificationPending`; map `weak-password` and
  `too-many-requests`. Files: `sign-up/page.tsx`. Verify: Web + spec. Also `invalid-email`. e2e seam gains
  `authError` and `accountUnverified`. New `sign-up.spec.ts` 4/4; with account-journeys and
  session-recovery 17/17 (one earlier run lost a worker to a Chromium crash, 0xC0000409; clean on
  rerun). (ee2f646, 2026-09-30)

## Phase 6 — Testing

- [x] **6.1** Confirm every row of audit §14 has its test (most land with their task above); add
  any missing one, one commit per test. Verify: listed test classes/specs green. Checked
  2026-09-30, row by row: P0-3 `owner-listings` (Renouveler, wizard renew/copy); P0-5 mobile
  `api.test.ts` (mediaUrl); P1-1 `GlobalExceptionHandlerTest` (405/415/missing part/constraint);
  P1-2 `ListingApiTest` (published photo → review; keeps ≥ 1 photo); P1-3 `owner-listings` (no
  PATCH for an unchanged live listing); P1-4 `field-errors.spec.ts`; P1-5 `ImageProcessorTest`
  (orientation 3/6/8); P1-6 `RateLimitInterceptorTest` (users behind one address keep their own
  quota); P1-7 `MessagingApiTest` (inbox order + paging); P1-8 `JsonWireContractApiTest` (owner
  block); P1-9 `UserProfileClearingApiTest`; P1-13 `AdminApiTest` (reinstate); P0-2 wizard
  payload in `keyboard-publish`/`account-journeys`. Still open with their blocked tasks: P0-1
  (2.1), P0-2 search over NULL fields (2.2d), P0-4 mobile publish body (2.4); the web↔API
  journey is 6.2. No test was missing, so no new test commit. (c56080f, 2026-09-30)
- [x] **6.2a** Full-stack smoke harness: web against the real API (local stack or Testcontainers)
  with the Firebase Auth emulator (free, no project calls). Files: new e2e config/script. Verify:
  harness boots and a trivial request passes. `npm run e2e:full-stack` (`e2e/full-stack/run.mjs`):
  throwaway PostGIS on 55432, Auth emulator (`demo-dari`) on 9099, API from source on 18080 in
  emulator mode (1a63cb2), `next dev` on 3120 with `connectAuthEmulator`; runs
  `e2e/full-stack.config.ts`, tears everything down. Specs live in `e2e/full-stack/` so the normal
  suite never needs the stack. `smoke.spec.ts` 2/2 (emulator account → profile created and read
  back, forged token 401; web renders /listings from the API). (24fa989, 2026-10-01)
- [x] **6.2b** Full-stack smoke journey: sign up → publish → approve → search → message. Files:
  new `apps/web/e2e/tests/full-stack.spec.ts`. Verify: spec green. Lives at `e2e/full-stack/journey.spec.ts` (outside
  the mock suite's testDir). Owner signs up in the UI (emulator holds the confirmation), publishes
  with a real photo; an admin (promoted in the DB) approves via the API; a seeker signs in, finds it
  in search, contacts and messages; the message is read back from the API. `next.config.mjs`: with
  the emulator variable (dev only) the CSP allows `next dev`'s eval and the emulator origin.
  `npm run e2e:full-stack` from cold: 3/3, teardown clean. `--serve` keeps the stack up. (c87a5e7, 2026-10-01)
- [x] **6.2c** (added 2026-10-01, found in 6.2b) — a plain `npm run dev` gets the strict CSP
  (no `'unsafe-eval'`), which blocked hydration in the harness until it was exempted. Confirm
  whether local `npm run dev` hydrates; if not, allow eval for every non-production `next dev`
  (owner's choice: the comment says only the e2e server gets it). Files: `next.config.mjs`. Confirmed: a plain `npm run dev` did not hydrate
  (CSP blocked eval; buttons dead). Every non-production server now allows eval; the production CSP
  is unchanged and asserted (`production-build.spec.ts`: script-src 'self' 'unsafe-inline', no
  unsafe-eval). Plain dev checked: sign-in hydrates, no page errors. Full suite dev + production
  95 passed + 1 skip. (6de0a4e, 2026-10-01)
- [x] **6.3** Full run: `./mvnw test`; `npm run typecheck && npm run build && npx playwright test`
  (dev + production); mobile `npm test`. 2026-10-01 at 6de0a4e: API 351/351; web typecheck +
  Playwright dev + production 95 passed + 1 intentional skip (the production project builds the
  app); mobile jest 83/83 + typecheck; full-stack harness 3/3. Phase 6 done; the blocked tests stay
  with their tasks (see 6.1). (d391b82, 2026-10-01)

## Phase 7 — Final cleanup

- [x] **7.1** P2-8 — WARN action in the admin report queue UI. Files: `admin/reports/page.tsx`.
  Verify: Web + spec. "Avertir le propriétaire" (listing) / "Avertir" (account), its
  own dialog and reason field (sent as the email's "Motif"). confirmation-dialogs 4/4 (new: POST
  {action: WARN, reason}, axe). (fcd5177, 2026-10-01)
- [x] **7.2** P2-8 — remove the 501 `POST /users/me/phone-verification` stub. Files:
  `user/UserController.java`, tests. Verify: API. Now an ordinary 404 (new
  `UserRemovedRoutesApiTest`); `NotImplementedYetException`/`NOT_IMPLEMENTED` stay, unused, as
  part of the error contract. With UserApiTest and ArchitectureTest 25/25. (7a5cb76, 2026-10-01)
- [x] **7.3** P2-22 — marketing copy matches behaviour (charges, "profils contrôlés",
  colocataires). Files: `app/layout.tsx`, `app/page.tsx`. Verify: Web. Also the city landing pages
  (`flatshare/[city]`), the home's "encaissez le loyer en ligne" (no payments) and the search
  header's "Mises à jour aujourd'hui · loyers charges comprises". New `marketing-claims.spec.ts`
  3/3 (page text and meta description); production project 21 + 1 skip. (d97b96d, 2026-10-01)
- [x] **7.4** P2-26 — delete dead `ListingSearchService`/`ListingSearchRepository` methods and move
  `ListingSearchOptimizationTest` onto `searchByLocationSorted`. Verify: API full suite. Removed
  `searchByLocationPaginated`, `searchByLocationWithCursor`, `getPublicOrOwnerListing`,
  `parseEnumList`, `encodeCursor`; the test pages with the service's own `recommended` cursor.
  Full API suite 352/352 (a first run hit the IDE-builder `NoClassDefFound` trap; clean rerun).
  (3d70827, 2026-10-01)
- [x] **7.5** P2-23 — "Administration" link for `me.role === 'ADMIN'`. Files: `SiteNav.tsx`,
  `account/page.tsx`. Verify: Web. In the account hub's "Paramètres" only: the nav does not
  know the role and would need `/users/me` on every page. account-pages 8/8 (new: shown for ADMIN,
  absent for USER). (256a98d, 2026-10-01)
- [x] **7.6a** P2-9 — batch amenities/rules/rooms by `listingId IN` in `listMine` and the admin
  queue. Verify: API full suite. New `ListingExtras` (three `IN` queries per
  page); new `ListingExtrasApiTest` (each listing keeps its own extras, empty where none). Full API
  suite 353/353. (d1e7b4b, 2026-10-01)
- [x] **7.6b** P2-9 — `countByStatus` for the admin dashboard; page the queues. Verify: API
  `-Dtest=AdminApiTest`. Dashboard counts in the database
  (`AdminService.dashboard`). Queues bounded rather than cursor-paged, so the admin pages' array
  contract is unchanged: listings oldest-first, reports in priority order, at most 100 each
  (`QUEUE_LIMIT`); the dashboard shows the full counts. AdminApiTest 21/21 (new: 101 pending →
  queue 100, sorted, dashboard counts all) + ReportApiTest 9/9. (36b137a, 2026-10-01)
- [x] **7.7a** P2-2 — `@Version` on `Listing` and `User` (migration) + 409 handler. Verify: API
  full suite. Done: V32 adds `version` to both tables and appends it to the `published_listings`
  view; `ObjectOptimisticLockingFailureException` → 409 `CONFLICT` "modifiées entre-temps".
  New OptimisticLockingIntegrationTest (stale listing/user save refused, newer write survives) +
  handler unit test; ListingApiTest now reassigns merged copies instead of re-saving a stale one.
  Full API suite green. (108683e, 2026-10-02)
- [x] **7.7b** P2-2 — `@Transactional` on `ListingSearchService` lifecycle methods. Verify: API
  full suite. Done: `submit`, `renew`, `markRoomFound`, `reopen` now read, check and write in one
  transaction, so the `@Version` check covers the whole transition. Full API suite green. (4c2c5d5, 2026-10-02)
- [x] **7.8** P2-3 — favorites add via `insert … on conflict do nothing`. Files:
  `FavoriteService`, repository, `FavoriteApiTest`. Verify: API `-Dtest=FavoriteApiTest`.
  Done: `FavoriteRepository.insertIfAbsent` (native, JVM clock for `created_at`); the check +
  catch is gone. New `racingAddsAllSucceed` (8 simultaneous adds → all succeed, one row) fails on
  the old code with `favorites_pkey` duplicate key. FavoriteApiTest 9/9. (bfea680, 2026-10-02)
- [x] **7.9** P2-4 — lock the listing row in `addPhoto`. Files: `ListingService`, repository.
  Verify: API `-Dtest=ListingApiTest`. Done: `ListingRepository.findOwnedForUpdate`
  (`PESSIMISTIC_WRITE`); uploads to one listing now take turns, so the cap, cover and sort order
  see the previous upload. New `concurrentPhotoUploadsTakeTurns` (6 simultaneous first uploads →
  all 201, one cover, sort 0–5) fails without the lock (5 × cover-index 409). ListingApiTest
  60/60. (d05ee5f, 2026-10-02)
- [x] **7.10** P2-6 — ban revokes the banned user's listing photos (reuse the deletion loop).
  Files: `AdminService.banUser`, `AdminApiTest`. Verify: API. Done: the loop moved from
  `UserService.deleteAccount` into `listing/OwnerListingsRemoval`, which both deletion and ban call
  (listings SUSPENDED + soft-deleted, photos soft-deleted + queued in `media_cleanup`, so the
  media interceptor refuses them). New AdminApiTest `banRevokesListingPhotos`. Full API suite
  360/360. (3d0bfb7, 2026-10-02)
- [x] **7.11** P2-7 — refuse suspend/ban when the target is self or an ADMIN (409). Files:
  `AdminService`, `AdminApiTest`. Verify: API. Done: `refuseProtectedTarget` in `suspendUser` and
  `banUser` → 409 `ILLEGAL_TRANSITION` with a self / admin message; demoting an admin stays the
  owner's call. New AdminApiTest `adminsAreNotSuspendableOrBannable` (both actions × self and
  another admin; both stay ACTIVE, no banned identity). Full API suite 361/361. (41d652b, 2026-10-02)
- [x] **7.12** P2-10 — token revocation check (`verifyIdToken(token, true)` or short cache); confirm
  no billing impact first. Files: `FirebaseAuthFilter.java`. Verify: API full suite. Billing: none —
  the check is an Admin GetAccountInfo lookup, no-cost on Spark ("Other Authentication services")
  and only quota-bound (1000 req/s, 10M/day per project). Done: short cache — local verify on every
  request, `verifyIdToken(token, true)` at most once per uid per 5 min; revoked / disabled /
  deleted → 401 `INVALID_TOKEN`; Firebase unreachable → accept the locally verified token and ask
  again next request. AbstractIntegrationTest routes the 2-arg mock to each test's 1-arg stub. New
  FirebaseAuthFilterRevocationTest 5/5 (caught a `Set.of().contains(null)` NPE on the outage path).
  Full API suite 366/366. (02fb132, 2026-10-02)
- [x] **7.13** P2-12 — CORS exposes `X-Correlation-Id` and `Retry-After`. Files:
  `SecurityConfig.java`, `SecurityHeadersApiTest`. Verify: API. Done: `setExposedHeaders`; the CORS
  test now also checks a cross-origin GET carries `Access-Control-Expose-Headers` with both (the
  web already reads `X-Correlation-Id` in `api.ts`). Full API suite 366/366 on rerun (first run:
  one Docker-clock flake, logged under 7.15). (6e33b13, 2026-10-02)
- [x] **7.14** (from 3.1b) contract step — drop V10's `idx_conversations_participant_a/b`
  (`created_at` ordering) once no deployed release orders the inbox by `created_at`. Files: new
  migration, `FlywayMigrationSmokeTest`. Verify: API full suite. Done: V33 drops both; condition
  met because no release has been deployed yet (AWS deploy is still an owner step). The smoke test
  asserts only the `*_activity` inbox indexes remain. Full API suite 366/366. (089298d, 2026-10-02)
- [x] **7.15** (found 2026-10-02) test flake — `AvatarCleanupLocalIntegrationTest:76`: the second
  `mediaCleanup.processDue()` left the account-deletion row PENDING once in a full run, right after
  a Docker Desktop restart; passes alone and in other full runs. Enqueue and `findDue` share the JVM
  clock, so suspect the ShedLock lock from the first call or a wall-clock step. Files: the test,
  `MediaCleanupService`. Verify: API `-Dtest=AvatarCleanupLocalIntegrationTest` x10 + full suite.
  Second flake, same session: `MessagingApiTest.inboxIsOrderedByLastActivity` once listed the
  silent newer thread above the one that just got a reply. Both stamps are the DB's `now()`, so
  only a backward step of the Docker VM clock explains it; the test could also assert on the
  stored `last_activity_at` order instead of assuming a strictly increasing clock.
  Done: cause of the first is ShedLock `usingDbTime()` — the previous run's release stamps
  `lock_until = now()` on the DB clock, so after a backward step a direct `processDue()` finds the
  lock still held and silently skips. `AbstractJobIntegrationTest.runMediaCleanup()` releases the
  lock row first (the `ListingExpiryIntegrationTest.runJob` pattern) and replaces every sequential
  direct call; the single-flight test releases it before its concurrent runs. The inbox test pins
  well-separated starting `last_activity_at` values. Production is unaffected beyond a skipped
  minute. `AvatarCleanupLocalIntegrationTest` x10: 10/10; full API suite 367/367. (b3f906a, 2026-10-02)

- [x] **7.16** (found 2026-10-02 in the 7.15 full run) choosing an older photo as the cover
  answered 409. Updates flush in primary-key order (`order_updates: true`) and photo ids are
  UUIDv7, so the older photo's `is_cover = true` was written before the current cover was unset
  and tripped `idx_listing_photos_active_cover`; same when unsetting a cover hands it to an older
  photo. `ListingService.updatePhoto` flushes the unset first in both branches. New ListingApiTest
  `anOlderPhotoCanBecomeTheCover` (409 before the fix); ListingApiTest 61/61; full API suite
  367/367. (9c8e325, 2026-10-02)

Post-launch backlog (not scheduled in §17): P2-1, P2-16, P2-21, P2-25, P2-27, P2-28 — see audit §7.

## Session log

| Date | Tasks done | Commits | Test results | Notes |
|---|---|---|---|---|
| 2026-09-29 | STEP 0 (audit + tracker); Phase 1 complete (1.1a–1.5); Phase 2: 2.2a, 2.2b, 2.2c, 2.3a, 2.3b, 2.5, 2.6a–2.6d; Phase 3 complete (3.1a–3.5); Phase 4: 4.1a, 4.1b, 4.1d | `8504507`…`5a2fd7f` (36) + this log = 37/40 | API full suite 317/317 (Phase 1), 320/320 (Phase 2 checkpoint), 325/325 (Phase 3). Playwright dev + production 57 passed + 1 intentional skip (Phase 2 checkpoint), 64 + 1 (Phase 3). Mobile jest 75 → 80/80, typecheck clean. | **Blocked on owner:** 2.1a/2.1b (P0-1 throttle window), 2.2d (P0-2 NULL date rule), 2.4 (P0-4 mobile publishing), 5.3a–d (P1-15 consent), and new 2.6e (P1-13 moderation contact address). Gate 2.7 stays open until those land; its checkpoint was green (API 320, web 57+1, mobile 78). 3.3c's header city select broke two specs' `getByLabel('Ville')`, repaired in `99907c7`. `bootstrap-check.sh` now waits for the PostGIS image's real start (it failed every time locally). Not done: 360 px screenshots (chrome-devtools MCP did not connect; layouts use wrapping flex and axe passed), on-device mobile checks, Mailpit. Next: 4.1c. |
| 2026-09-30 | Phase 4 complete except 4.3c (blocked with 2.1): 4.1c, 4.1e (new), 4.2a–c, 4.3a, 4.3b, 4.4a–d. Phase 5 complete except 5.3a–d (blocked): 5.1a–d, 5.1e (new, test), 5.2, 5.2b (new, test), 5.4a–h. Phase 6: 6.1; 6.2a in progress | `1a47b50`…`1a63cb2` (29/40); this log is the first commit of 2026-10-01 | API full suite 347/347 (after 5.4a; P2-11 user/admin/security classes 40/40 after). Web full suite (dev + production) after each shared-UI change: 75–89 passed + 1 intentional skip; every red run explained and fixed or tracked (listing-host compile wait 5.1e; axe on hidden streamed `<h1>` 5.2b; banner racing sign-in, fixed in 5.4c; publish-shell test updated in 5.4f). Mobile jest 83/83 + typecheck. Mailpit: all 10 notification templates delivered with intact UTF-8. | **Blocked on owner (unchanged):** 2.1a/2.1b + new 4.3c (P0-1), 2.2d (P0-2), 2.4 (P0-4), 2.6e (P1-13), 5.3a–d (P1-15). **6.2a in progress:** API emulator mode committed (`1a63cb2`); web `connectAuthEmulator` switch and the harness (`e2e/full-stack/`, `npm run e2e:full-stack`) are written but not yet run end to end, so uncommitted. Environment this session: TMP pointed at C:\Windows\TEMP (JUnit @TempDir errors; run Maven with the user temp dir), Docker Desktop stopped twice. Not done: real-device checks (dvh toolbar, mobile TextField). |
| 2026-10-01 | Phase 6 complete: 6.2a, 6.2b, 6.2c (new), 6.3. Phase 7: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6a, 7.6b; 7.7a written, verified the next day | `73522b5` (the 2026-09-30 log)…`36b137a` (12/40); this session ran out of context before its log, so this row was written on 2026-10-02 | 6.3 full run: API 351/351, web dev + production 95 passed + 1 intentional skip, mobile jest 83/83 + typecheck, full-stack 3/3. Then API full suite 352/352 (7.4), 353/353 (7.6a); confirmation-dialogs 4/4, marketing-claims 3/3 + production 21 + 1 skip, account-pages 8/8, AdminApiTest 21/21 + ReportApiTest 9/9. | **Blocked on owner (unchanged):** 2.1a/2.1b + 4.3c (P0-1), 2.2d (P0-2), 2.4 (P0-4), 2.6e (P1-13), 5.3a–d (P1-15). 6.2c: the full-stack work found that a plain `npm run dev` never hydrated (the CSP blocked eval in dev); fixed. Red runs explained: the IDE builder's NoClassDefFound (clean rerun), a missing import in AdminApiTest. |
| 2026-10-02 | Phase 7 complete: 7.7a, 7.7b, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15 (new, test flakes), 7.16 (new, cover bug found by the 7.15 run) | `108683e`…`9c8e325` (11) + this log = 12/40 | API full suite after each API task: 357 → 360 → 361 → 366 → 367/367. Targeted: FavoriteApiTest 9/9, ListingApiTest 60/60 → 61/61, AdminApiTest 23/23, FirebaseAuthFilterRevocationTest 5/5, SecurityHeadersApiTest 2/2, MessagingApiTest 20/20 + FlywayMigrationSmokeTest; AvatarCleanupLocalIntegrationTest x10 10/10. Race tests (7.8, 7.9) and the cover test (7.16) were each shown to fail on the old code. Full-stack harness 3/3 against the Auth emulator after 7.12. Web and mobile not rerun: no web or mobile code changed today. | **Blocked on owner (unchanged):** 2.1a/2.1b + 4.3c (P0-1), 2.2d (P0-2), 2.4 (P0-4), 2.6e (P1-13), 5.3a–d (P1-15); gate 2.7 waits on them. 7.12 billing checked first: no-cost on Spark, quota-bound only. 7.14's condition was taken as met because nothing is deployed yet. Red runs explained: Docker Desktop stopped twice (Testcontainers could not start), the IDE builder's ClassNotFound (clean rerun), one shell `./mvnw` not found (rerun), and the two Docker-clock flakes fixed in 7.15. Next: nothing unblocked; every open item needs an owner decision. |
