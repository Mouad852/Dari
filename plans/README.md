# Dari — build plans

This project has moved beyond a blank scaffold. The current repository already contains the backend foundation and a substantial frontend product surface. The phase plan still governs sequencing, but it should be read as the roadmap for the next work item, not as a statement that nothing exists yet.

## Current reality

The project is currently in a mixed state:

- phase 01 backend foundation is in place
- the Next.js app already has product UI slices across public, account, admin, messaging, and publishing flows
- important backend gaps remain in the phase-01 list, especially the Firebase startup warmup, idempotent `POST /users`, and the remaining API tests
- the roadmap still matters, but the order is now: close the remaining foundation gaps, then continue into the next real feature phase

## Index

| Doc | One line |
| --- | --- |
| [00-overview.md](00-overview.md) | Product, stack, scope, the real risks, and the strategic constraints |
| [01-backend-foundation.md](01-backend-foundation.md) | Spring Boot, PostGIS, migrations, Firebase verification, `users`, Testcontainers |
| [02-vertical-slice-search-and-lifecycle.md](02-vertical-slice-search-and-lifecycle.md) | Risk spike: geospatial search, cursor pagination, lifecycle status modeling |
| [03-frontend-foundation-and-search.md](03-frontend-foundation-and-search.md) | Frontend shell, design-system integration, live API consumption |
| [04-vertical-slice-messaging.md](04-vertical-slice-messaging.md) | Conversation and messaging slice, REST-only MVP path |
| [05-listing-creation.md](05-listing-creation.md) | Listing creation model, rooms, amenities, rules, and wizard flow |
| [06-moderation-and-admin.md](06-moderation-and-admin.md) | Reports, queue, approvals, and admin operations |
| [07-search-filters-and-map.md](07-search-filters-and-map.md) | Remaining filters, map and listing-detail behaviors |
| [08-public-marketing-and-seo.md](08-public-marketing-and-seo.md) | Marketing pages, SEO strategy, and discovery optimization |
| [09-profiles-favorites-account.md](09-profiles-favorites-account.md) | Public profiles, favorites, and account settings |
| [10-jobs-hardening-and-launch.md](10-jobs-hardening-and-launch.md) | Expiry jobs, notifications, security hardening, observability |
| [11-mobile-react-native.md](11-mobile-react-native.md) | Mobile app work after the web product stabilizes |

## How the order was chosen

- Risk and correctness come first. The backend foundation and the geospatial/lifecycle risk slices matter before broad feature churn.
- The frontend starts early and is already materially implemented. The product UI is meant to surface mismatches in the API contract quickly.
- Moderation sits in the middle because the app cannot be meaningfully public until approvals are in place.
- Mobile comes last, after the web product and API stabilize.

## Implementation guidance

The phase docs remain the authoritative source for the *what* and *why*. The implementation guides remain the *how*.

The current project status means the next session should begin from the current repository state, not from a blank slate. The right behavior is:

1. read the project docs and the relevant phase guide
2. close the current missing foundation gap
3. continue with the next product milestone in the chosen phase order

## Actual current priorities

Phase 02 (PostGIS search optimization) is now complete:
- Native PostGIS queries replace in-memory filtering
- Spatial indexes (GiST) and cursor pagination are working
- Search invariant enforced at the database view level
- Listing lifecycle state machine is implemented and tested

### Current status (2026-08-31)

- Phase 03 frontend validation is substantially complete for public listings, city landing, listing detail, Firebase sign-in/sign-up, account profile loading, publishing, and URL-driven search filters.
- `apps/web` production build and typecheck pass after each validated slice.
- Phase 07 is now the active feature phase. The next implementation step is map view integration using `/api/v1/listings/map`, while preserving fuzzed coordinates and URL filter state.
- Do not add frontend-only mocks for owner listings, favorites, or messaging until the corresponding backend read/write contracts are available.

### Current status (2026-09-02)

- Listing search filter composition was tightened: availability-date filtering now excludes
  undated listings when a move-in date is requested, and repeated/comma-separated filter values
  are de-duplicated before SQL amenity AND matching. Focused listing tests and the full API suite
  pass (62 tests). Draft persistence and public-search test isolation are unchanged.
- **Listing detail is now real**: `GET /api/v1/listings/{id}` returns a dedicated rich detail response with the full public listing fields, amenity codes, and ordered photo URLs. `/listings/[id]` consumes it and no longer renders fabricated description, amenities, roommates, rules, owner rating, verification badges, or photo counts. House rules remain intentionally out of the response until a read contract is implemented.

- **Phase 09 favorites backend is done**: `V13__favorites.sql` migration, `Favorite` entity (composite key on user+listing), `FavoriteRepository`, `FavoriteService`, and `FavoriteController` now serve `GET/POST/DELETE /api/v1/favorites` for real, replacing the three `NotImplementedYetException` 501 stubs. Both writes are idempotent. 5 new Testcontainers tests in `FavoriteApiTest` pass, including the "stays visible but marked unavailable" and "drops out when soft-deleted" rules from this doc's own task list.
- **The `/favorites` frontend route is still a hardcoded mock** (per the audit that produced this note) — wiring it to the now-real endpoints is the obvious next step, not a backend gap anymore.
- **Critical bug found 2026-09-02, now fixed and verified**: `GET /api/v1/listings` was returning **500** on every call, including with no filters at all. Two stacked root causes in `ListingSearchRepository`'s native queries, both now fixed:
  1. The `propertyTypes`, `roomTypes` and `furnishings` array filters were cast as `:param::pg_enum_type[]` (no space before the Postgres `::` operator). Hibernate's native-query parameter parser misread `:furnishings::room_furnishing` as one combined, unbound parameter name, failing query parsing before any SQL ran. Fixed by switching every such cast to `CAST(:param AS pg_enum_type[])`.
  2. Once parsing succeeded, Postgres itself then failed with `could not determine data type of parameter $9`: the bare `:param IS NULL` occurrence of each array filter (`propertyTypes`, `roomTypes`, `furnishings`, `amenityCodes`) had no type hint, so when the filter value is `null` (the normal "no filter applied" case), Postgres couldn't resolve its type. Fixed by casting every occurrence of these four parameters explicitly, including the `IS NULL` checks.
  - Verified: the full suite (`ListingApiTest`, `FavoriteApiTest`, `MessagingApiTest`, `ReportApiTest`, `UserApiTest`, `ArchitectureTest` — 35 tests) passes cleanly against real Testcontainers PostGIS.
  - One assertion in `ListingApiTest.publicSearchReturnsPublishedListings` was also tightened: it asserted the search result had exactly 1 item, which only ever worked by accident of test-execution order, since the Testcontainers database is shared across the whole suite (§7 of `ARCHITECTURE.md`) and several other test classes publish listings in the same city/neighborhood. It now asserts the created listing is present and correct instead of assuming it's the only result.
  - **Listing search optimization test isolation fixed (2026-09-02)**: `ListingSearchOptimizationTest` now clears only public-searchable listings before each test. This preserves drafts and other lifecycle states while preventing the shared Testcontainers database from contaminating city/radius result-count assertions. The focused class (5 tests) and complete API suite (61 tests) pass.
- **`/favorites` frontend is now wired to the real backend**, closing the loop on the favorites work above: the list page fetches/paginates/removes for real, and the listing detail page's heart button (previously decorative) now calls the real endpoints with optimistic update. `npm run typecheck` and `npm run build` both pass.
- **Both gaps from that step closed the same day**: added `GET /api/v1/favorites/ids` (unpaginated listing-id set, for cheap membership checks) on the backend; the `/listings` search-results feed cards now have the same favorite toggle as the detail page, and the detail page itself now checks real favorited state on load instead of always starting unfilled.
- **Also fixed in passing, found while touching the same file**: search-result cards on `/listings` had no link to the listing detail page at all — clicking one did nothing. Every card now links to `/listings/{id}`, and the map popup got a "Voir l'annonce" link too. See `plans/07-search-filters-and-map.md`'s 2026-09-02 status note.
- **Messaging (phase 04) frontend is now wired to the real backend**, closing the last major mock-vs-real gap the docs flagged earlier this session: `/messages` and `/messages/[id]` fetch real conversations and messages, sending works, and the "Contacter" button on the listing detail page — previously a dead button with no `onClick` — now actually starts a conversation and navigates to it. Added `GET /api/v1/conversations/{id}` on the backend to support the thread header (37 backend tests passing; `npm run typecheck`/`npm run build` clean on the frontend). Real gaps, not silently glossed over: no unread badges (no backend data to back them honestly), no read receipts in the UI, sending isn't optimistic, and a suspended/expired listing's context card just disappears rather than showing an explicit "unavailable" state. See `plans/04-vertical-slice-messaging.md`'s 2026-09-02 entry for the exact list.
- **Also removed while in the messaging code**: `ConversationResponse.from(Conversation, User)` was dead code — never called anywhere — and buggy (hardcoded `lastMessage`/`lastMessageAt` to null). Deleted rather than fixed, since nothing used it and the real construction path (`ConversationService#toConversationResponse`) already does this correctly.
- **Owner listing management (`/account/listings`) is now wired to the real backend**, closing another mock-vs-real gap. Added `GET /api/v1/listings/mine` (paginated, every status, since public search only ever shows PUBLISHED+AVAILABLE). The dashboard shows real status/rejection reasons and supports submit/mark-room-found/reopen/delete. **Editing is explicitly not built** — the publish wizard has no edit mode, so there is no "Modifier" button pointing nowhere; see `plans/05-listing-creation.md`'s 2026-09-02 note. 38 backend tests passing; frontend `typecheck`/`build` clean.
- **Listing submission preconditions are now enforced**: `POST /api/v1/listings/{id}/submit` rejects blank descriptions and listings with no active photos using the normal `VALIDATION_FAILED` French error envelope, while preserving `DRAFT`/`REJECTED` -> `PENDING_REVIEW`.
- **The admin console (phase 06) is now wired end to end**, and it turned out most of its backend was already done by an earlier session and simply never checked off in `plans/06-moderation-and-admin.md` — verified by reading `AdminController`/`AdminService` directly rather than assumed. What was actually new this session: a role-gated `/admin` layout (client-side redirect, on top of the `ADMIN`-only server-side gate that already existed on every `/api/v1/admin/**` route), all 4 admin pages (dashboard, listings review, reports, users) wired to real data, and a real bug fix — `GET /listings/{id}` 404'd for an admin viewing any non-owned, non-published listing, which is every listing the review queue exists to review; `ListingSearchService.getPublicOrOwnerListing` now also allows an `ADMIN` viewer through. Real gaps disclosed, not hidden: only the `DISMISS` report action is implemented server-side (no warn/suspend-listing/reject-listing-as-a-report-action); there is no reporter dismissal-history; report-queue target names for `USER` targets can't be resolved at all (no single-user lookup endpoint) and for `LISTING` targets are best-effort (a soft-deleted listing falls back to a truncated id). 39 backend tests passing; frontend `typecheck`/`build` clean. See `plans/06-moderation-and-admin.md`'s 2026-09-02 entries for the full accounting.
- **Public profile (`/profile/[id]`) and profile editing (`/account/profile`) are now wired**, and — same pattern as the admin console — the backend for both (`GET /users/{id}`, `PATCH /users/me`) turned out to already exist since phase 01, just never checked off in `plans/09-profiles-favorites-account.md`. No backend changes needed. Dropped every fabricated field the mocks invented (search preferences, review counts, a fake second profile card, a settings-visibility toggle, an avatar-upload icon that isn't built) rather than keep them for visual completeness. `npm run typecheck`/`npm run build` clean. See that plan doc's 2026-09-02 entry for the full accounting, including what's still genuinely open (profile-completion prompt, delete account, sign out).
- **Small follow-on fixes to `/account` itself, same day**: its "Se déconnecter" button had no `onClick` at all — added a `signOut()` export to `lib/firebase.ts` and wired it up to redirect home. Its verification badge always read "Vérifié" regardless of the real `VerificationTier`. Its three stat tiles ("3 actives", "12 en cours", "8 sauvegardés") were fully fabricated — now computed from real `GET /listings/mine`/`GET /conversations`/`GET /favorites/ids` calls, best-effort (a failure there doesn't block the page). No backend changes needed.
- **Scoped "listing edit mode" and found it was bigger than expected.** Before building it, checked the create wizard (`/publish`) it would be built on top of, and found: (1) a silent data-corruption bug — the "Type" dropdown was never wired to state, so every listing was published as hardcoded `PRIVATE`/`APARTMENT` regardless of the owner's actual selection; (2) amenities are collected in the wizard UI but never sent, because **there is no backend endpoint anywhere that writes to `listing_amenities`** — search can filter by amenity, but nothing can ever assign one. Asked the user how to scope this rather than silently expanding the step; they chose "fix the create-flow bug now, defer amenities-backend and edit-mode as separate future steps." Fixed the type-selection bug (two real selects — property type and room type — replacing the fictional single dropdown); left amenities-write and edit-mode explicitly open. See `plans/05-listing-creation.md`'s 2026-09-02 entry.
- **Amenities backend write support, built the same day as a follow-on.** Added `Amenity`/`ListingAmenity` entities (the join-row pattern mirrors `Favorite`'s composite key), wired `POST`/`PATCH /listings` to accept and validate `amenityCodes` (full replace on update, 400 on an unknown code), and exposed the set on `ListingResponse`. `GET /amenities` now reads the real `amenities` table instead of a hardcoded duplicate list. The publish wizard fetches real codes and sends them; the fictional French-string amenity list is gone, and its duplicate label map (previously inlined in both `publish/page.tsx` and `listings/page.tsx`) is now one shared `AMENITY_LABELS` in `lib/labels.ts`. New test: `ListingApiTest.amenitiesRoundTripOnCreateAndUpdate`. 45 backend tests, 43 passing (the 2 failures are the pre-existing `ListingSearchOptimizationTest` isolation flakiness, unchanged by this work); frontend `typecheck`/`build` clean. Deliberately not touched: `PublicListingResponse` (the public search/detail DTO) — amenities are round-tripped for the owner/write side only.
- **New finding while doing that work, not yet fixed**: the listing detail page (`/listings/[id]`) turned out to still be mostly fabricated content, despite an earlier session's summary describing it as "wired" — only the favorite toggle and "Contacter" button actually touch the backend. The description, the amenities row, an entire "Colocataires" tab (two invented people with fake verified badges), an entire "Règles" tab, the owner card (fabricated name and 4.8 rating), the "Annonce vérifiée" and availability-date badges, and the photo counter are all hardcoded placeholder content left over from the original mock. Fixing it properly needs a backend change first — `PublicListingResponse` doesn't even return `description` today, let alone photos/amenities/house rules — so it wasn't folded into this step; see `plans/05-listing-creation.md`'s 2026-09-02 note for the full list and suggested shape of the fix.
- Everything else in the 2026-08-31 status entry above still holds.

### Track 0 — unblock and secure (2026-09-02)

Working from the completion plan agreed this session (six ordered tracks; Track 0 first because the
product cannot publish a listing and the Firebase key was unprotected).

**T0.1 secrets and version control — done.**

- **The repo is now under git.** It had never been initialised; weeks of work existed with no history
  and no rollback. Initial commit `dd69102`, 452 files.
- **A live Firebase private key was one `git add .` away from being committed.** `.gitignore` carried
  `*serviceAccount*.json` and `firebase-admin*.json`, and the real key on disk is
  `infra/firebase/service-account.json` — the hyphenated name matches neither pattern. Worse,
  `infra/firebase/README.md` instructed exactly that filename in step 2 and then claimed those
  patterns protected it, so the doc created the hole it warned about. Fixed by ignoring the whole
  directory (`infra/firebase/*`) with an explicit `!infra/firebase/README.md` exception, so anything
  landing there is a key until proven otherwise rather than relying on someone guessing a filename.
  The name-based patterns were kept as a first line and `service-account*.json` added. Both the
  ignore rules and the README now say the same thing.
- **`plans/` was in `.gitignore`** and would have been excluded from the first commit — the
  authoritative status log, untracked. Removed; 25 plan files are in the initial commit.
- Verified before committing rather than after: `git ls-files` shows no key, no `node_modules`, no
  `target/`, no `uploads/`, and a grep across every staged file finds no `BEGIN PRIVATE KEY`.

**Key rotated by the user, verified 2026-09-02.** The replacement service account is structurally
valid and was proven live by minting an access token against Google's OAuth token endpoint — the
same exchange the Admin SDK performs internally. New key id `3e1b63c4...`, replacing `75639e2a...`;
same project and client email. Still ignored by git and untracked.

**One step of the rotation remains, and it is not something I can verify:** generating a new key in
the Firebase console does **not** revoke the old one. Key `75639e2adb59ede9c2684b224872d58c70dc5e72`
is presumed still active until explicitly deleted under GCP IAM -> Service Accounts ->
`firebase-adminsdk-fbsvc@dari-colocation.iam.gserviceaccount.com` -> Keys. The old private key
material is not in this repo or in any session transcript, so its status cannot be tested from here.

Next in the plan: **T0.2 photo upload end to end** — the product blocker. `submit` requires at least
one active photo and the frontend has no upload at all, so no listing can currently be published.

**T0.2 photo upload end to end + T0.3 wizard fabrications — done (2026-09-02).**

Folded T0.3 into this step because both live in `apps/web/src/app/publish/page.tsx` and doing them
separately would have meant rewriting the same file twice.

The blocker: `ListingSearchService.submit` requires at least one active photo, and there was **no
file input anywhere in the web app** — the wizard's "Sélectionner des fichiers" button had no
`onClick` at all. Every owner who completed the wizard hit `400 "Au moins une photo est requise"`,
so no listing could ever be published through the product.

Backend:

- `application.yml` now sets `spring.servlet.multipart.max-file-size: 6MB` / `max-request-size: 8MB`.
  Spring's defaults are **1 MB per file and 10 MB per request**, which silently contradicted
  `LocalImageStore`'s own 5 MB rule: an ordinary phone photo was rejected by the container before the
  domain check ran. The limit is set deliberately *above* 5 MB, not equal to it, so
  `LocalImageStore`'s specific message stays the one an owner sees and the container guard is only an
  outer backstop.
- `GlobalExceptionHandler` gained a `MaxUploadSizeExceededException` handler. Without it that
  rejection fell through to the catch-all and surfaced as a bare `500 INTERNAL_ERROR` for the
  entirely ordinary act of picking a large photo; it now returns the French `VALIDATION_FAILED`
  envelope with the same message as the domain check.
- New `GET /api/v1/listings/{id}/photos` (owner-scoped, display order) plus
  `ListingService#listPhotos`. Only `POST`/`PATCH`/`DELETE` existed, so nothing could read photos
  back for a DRAFT — and a draft has no public detail response to read them out of.

Frontend:

- `lib/api.ts`: `apiFetch` now passes a `FormData` body through untouched and omits `Content-Type`
  so the browser can set the multipart boundary. One branch in the existing client rather than a
  second upload client.
- `apiOrigin` promoted from a local constant in `listings/[id]/page.tsx` into `lib/api.ts`, and the
  inline `photos` shape in `PublicListingDetail` extracted into a shared `ListingPhoto` type. Both
  were about to be duplicated a third time.
- The Photos step is real: multi-file input, thumbnail grid served from `apiOrigin`, cover badge and
  cover selection, delete, and reorder. Uploads run sequentially, not in parallel, so `sort_order`
  and the first-photo-is-cover rule stay deterministic. A resumed draft now loads its existing
  photos.
- **Reordering is move buttons, not drag-and-drop.** Disclosed rather than quietly counted as done:
  hand-rolled drag works with neither a keyboard nor touch, and the ordering outcome is the same.

T0.3 in the same pass:

- The wizard initialised its state with a **complete pre-written listing** — title "Chambre
  lumineuse", rent "3 200", and a full French description. An owner who clicked through without
  editing published someone else's words as their own. Those defaults are now empty; `city` and the
  two type selects keep a default only because they are closed selects that must hold a valid value.
- The header badge was fixed text making the same claim about draft safety before anything had been
  sent as after. It now reads "Brouillon enregistré" / "Brouillon non enregistré" off real
  `draftId` state.

Verified: backend suite **64 tests, 0 failures** (was 62; +2 covering the new read endpoint and an
oversized upload returning the French envelope rather than a 500). Frontend `npm run typecheck` and
`npm run build` clean. `npm run lint` is not a usable gate in this repo — no ESLint config exists and
`next lint` drops into an interactive setup prompt.

**Not verified: the browser click-through.** No browser automation is connected in this session, and
a real upload needs a genuine Firebase ID token that cannot be fabricated outside the test harness.
The upload path is proven at the API level by `ListingApiTest`, not through the actual file picker.
This is the step where that gap matters most so far — it is the first one whose whole point is a
browser-only interaction.

**Known gap this step widens, closed next by T0.4:** `GET /listings/{id}/photos` is owner-scoped via
`@CurrentUser`, but `SecurityConfig` permits `GET /api/v1/listings/**` wholesale, so like
`/listings/mine` and `/listings/draft` it is matched by the public rule and defended by only one
layer instead of the project's stated two. Not exploitable — the argument resolver throws its own
401 — but T0.4 is specifically this fix.

**T0.4 security matcher precedence — done (2026-09-02).**

`SecurityConfig` permitted `GET /api/v1/listings/**` and `GET /api/v1/users/*` wholesale. Matchers
are evaluated in order, so those wildcards swallowed every owner-scoped GET living underneath them:
`/listings/mine`, `/listings/draft`, the `/listings/{id}/photos` route added in T0.2, and
`/users/me`. Each was defended by a single layer — the `@CurrentUser` argument resolver — while this
project's stated invariant is that role checks are doubled, a URL matcher *and* a controller check.

Nothing leaked: the resolver does throw 401. The real exposure was prospective. Any future GET added
under `/listings/**` that reads a path variable instead of the current user would have been fully
public with nothing left to catch it, and the matcher layer that was supposed to be the backstop was
silently inert on exactly the routes that needed it.

- Explicit `.authenticated()` matchers now precede the public block, listing the four owner-scoped
  GET routes.
- Added `RestAuthenticationEntryPoint` (401 + the French envelope + `WWW-Authenticate: Bearer`) and
  `RestAccessDeniedHandler` (403 + envelope). This was **required**, not incidental: with no entry
  point configured, Spring's default for a chain-level rejection is a *bodyless 403*, so moving these
  routes behind the chain would have silently changed their contract from `401 UNAUTHENTICATED` to an
  unparseable 403. The access-denied handler fixes the same missing-body problem for a non-admin
  hitting `/api/v1/admin/**`, which previously returned a 403 the web client could only render as a
  generic failure.

**On the tests, because this is worth recording:** the first version asserted status 401 and
`code: UNAUTHENTICATED`, and it **passed with the fix reverted** — confirmed by actually removing the
matcher block and re-running, not assumed. Both layers produce a byte-identical body, so the
assertion proved nothing about which one fired. The fix was to have the entry point send
`WWW-Authenticate: Bearer`, which RFC 7235 requires on a 401 anyway and which the resolver path does
not set. Re-ran the ablation: the tests now fail with the matcher block removed, and pass with it.
A test that cannot fail is worse than no test, because it reads like coverage.

Suite: **67 tests, 0 failures** (was 64; +3 — owner-scoped routes reject anonymous callers, the
public read surface stays anonymous, and public profile reads stay anonymous). The
"public surface stays anonymous" test guards the regression that would have mattered more than the
bug: breaking crawlability of search and listing detail.

## Track 1 — close the product loop

**T1.1 report flow UI — done (2026-09-02).**

The moderation queue could only ever be empty in production. `POST /reports`, `GET /reports/me` and
the auto-suspension rule (three *distinct* reporters in a rolling seven days) have existed since
phase 06 and are covered by tests, but no surface in the product could reach them — there was no
"Signaler" affordance anywhere in the web app.

- New `src/components/ReportDialog.tsx`, the app's first modal. Reason picker built from the existing
  `REPORT_REASON_LABELS`, a details field required only for `OTHER` (the one reason where the note
  carries the whole report) and capped at the DTO's own 2000 characters, and a **generic
  acknowledgment**: design doc §6 is explicit that a reporter learns their report was received and
  nothing else. Confirming an outcome would turn the queue into an oracle for whether a rival's
  listing had been touched.
- Entry points on `/listings/[id]` (LISTING) and `/profile/[id]` (USER). On the profile — a Server
  Component — it goes in as a second client island beside `ContactButton`, so the page stays
  crawlable and only the interactive part ships JavaScript.
- Accessibility, since this is the first dialog and it sets the pattern: `role="dialog"`,
  `aria-modal`, `aria-labelledby`, focus moved in on open and **returned to the trigger on close**,
  Escape to dismiss, backdrop click to dismiss, and body scroll locked while open.
- Reporting is placed below the primary action rather than beside it. It is a rare, deliberate act
  and should not compete with "Contacter".

**Backend gap found and closed in the same pass:** nothing stopped a user reporting their own listing
or their own profile. `ReportService` now rejects it with a 400. Done server-side rather than by
hiding the button, because the reporter's identity comes from the token and the UI cannot be what
decides it — and the rows were unactionable anyway, since a self-report can never trip a threshold
that counts distinct reporters.

**Two invented design tokens caught before commit:** the first draft used `--shadow-raised` and
`--radius-input`, neither of which exists. Grepped every token against `design-system/tokens/`
instead of assuming, and corrected them to `--shadow-sheet` and `--radius-md` (the latter is what
every other form control in the app already uses). An invented custom property fails silently — it
renders as no shadow and square corners, with nothing in the console.

**Plan-doc corrections:** `plans/06-moderation-and-admin.md` listed the reports migration,
`POST /reports`, the one-pending-report rule, and the 3-reporter auto-suspension as unchecked. All
four were built and tested well before this session. Ticked with a note, rather than left implying
work that does not exist.

Suite: **68 tests, 0 failures** (was 67; +1 for self-reports). Frontend `typecheck` and `build`
clean. Not verified in a real browser — no automation connected, and filing a report needs a genuine
Firebase token.

**T1.2 admin and moderation HTTP test coverage — done (2026-09-02).**

A correction to how this gap was described earlier: admin was not *untested*. `ReportApiTest` covers
user search, report-queue grouping and the ban cascade — but it calls `AdminService` **directly**.
The layer that was genuinely unexercised is HTTP: the `hasRole('ADMIN')` URL matcher in
`SecurityConfig` and the `@PreAuthorize` on `AdminController`, the two halves of the doubled role
check guarding every destructive action in the product. A service-level test cannot fail when either
is removed.

New `AdminApiTest`, 10 cases over the real HTTP surface: anonymous rejection on every admin route
including a destructive one, a non-admin refused with the error envelope, a non-admin failing to
approve a listing *and the listing not moving*, approve/reject with audit-log assertions, illegal
transition on a non-pending listing, the DISMISS-only report-action limitation, ban cascading to
listings, suspend plus a 404 for a missing user, and the dashboard shape.

**Ablation, since T0.4 taught me not to trust a green test:** removing both role checks fails the
suite (a non-admin approves a listing, 200 instead of 403), so the tests are load-bearing.

**That ablation then found a real latent bug.** Testing each layer *alone* showed the doubling was
not real: with the URL matcher removed, `@PreAuthorize` denied the request correctly but returned
**500**, not 403. The `AccessDeniedException` is thrown inside the handler invocation, so it fell
through `GlobalExceptionHandler`'s catch-all instead of reaching `RestAccessDeniedHandler`, which
only sees chain-level denials. Access was never granted, so nothing was exposed — but the second
layer, the one that exists precisely for when the first is missing or a new admin route lands
outside `/api/v1/admin/**`, would have reported a genuine authorization event as a server fault.
Fixed with an explicit `AccessDeniedException` handler; re-ran the ablation and the second layer now
answers 403 on its own. **The "role checks are doubled" invariant is now true rather than nominal.**

**Test-isolation collision surfaced and fixed:** `ReportApiTest.adminUserSearchWorks` asserted
exactly one SUSPENDED user existed. `AdminApiTest` suspends and bans users, and the Testcontainers
database is shared across the suite, so the new class broke it by existing. Rewritten to assert that
*this* user's row is present and correct rather than that it is the only one — the same fix already
applied to `ListingApiTest.publicSearchReturnsPublishedListings` earlier in the project. Worth noting
this is the second instance of the same latent pattern; other count-based assertions in the suite
carry the same risk.

Suite: **78 tests, 0 failures** (was 68).

**T1.3 listing edit mode — done (2026-09-02).**

`/account/listings` now has a "Modifier" link that opens the wizard on that listing
(`/publish?listing={id}`). It was previously withheld on purpose: the wizard could only create, so a
button that opened a blank wizard would have silently produced a duplicate draft.

**Product rule reversed, at the product owner's explicit direction.** Editing a `PUBLISHED` listing
now returns it to `PENDING_REVIEW`. The design doc §4 said the opposite — that an edit leaves the
listing published, with reporting covering the gap — so `docs/colocation-platform-design.md` was
updated rather than left contradicting the code. The accepted trade-off, stated so it is a decision
and not a surprise: **an owner correcting a typo takes their own listing out of public search until a
moderator approves it again**, and every edit adds moderation queue volume. A refinement worth
considering later is re-reviewing only material changes (price, location, photos, description) and
letting cosmetic edits through. Only `PUBLISHED` moves — a `DRAFT` stays a draft, because the create
wizard PATCHes on every step and would otherwise submit listings the owner never published.

**A silent data-corruption trap found and avoided, not fixed after the fact.** The obvious way to
build this is to load the edit form from `GET /listings/{id}`. That response runs through
`LocationFuzzer` **even for the owner**, so the form would have PATCHed a fuzzed position straight
back — moving the listing up to the fuzz radius further from its real location on *every save*,
cumulatively, with nothing visible until someone tried to find the place. New owner-scoped
`GET /listings/mine/{id}` returns true coordinates;
`ListingApiTest.ownerEditReadReturnsTrueCoordinates` asserts the exact contrast between the two
endpoints so the trap cannot be reintroduced.

Also: the new route was added to the `SecurityConfig` authenticated matchers
(`/api/v1/listings/mine/**`) in the same change. That is the T0.4 lesson applied rather than
relearned — any new owner-scoped GET under `/listings/**` is public-by-default until it is listed
there.

Frontend detail: the wizard branches its final action. A `DRAFT` or `REJECTED` listing still needs an
explicit `POST /submit`; a live one does not, because the PATCH is itself the submission — calling
`/submit` on it would be an illegal transition and 409. Edit mode also relabels the header and the
primary button, and states the going-offline consequence *before* the owner saves rather than after.
`useSearchParams` required a `Suspense` boundary; `/publish` stays statically rendered.

Suite: **81 tests, 0 failures** (was 78; +3 covering true coordinates, owner scoping plus anonymous
rejection, and the re-review rule in both directions). Frontend `typecheck` and `build` clean. Not
verified in a browser.

**T1.4 remaining moderation actions — done (2026-09-02).**

A moderator could only dismiss. Warn, suspend and reject-as-a-report-action all returned 400
`NOT_IMPLEMENTED`, which mattered more once T1.1 made the queue reachable by real users.

- `POST /admin/reports/{type}/{id}/action` now parses a real `ModerationAction` and dispatches:
  **DISMISS** (unchanged), **SUSPEND** (a listing comes down, or an account is suspended), **BAN**
  (accounts only — refused with a 400 on a listing target, because banning a listing is not a thing).
  An unknown action is a 400 rather than a 500.
- Reports are now closed with the *right* outcome. `ReportStatus.ACTION_TAKEN` and `REVIEWED` existed
  in the enum but were never written — everything resolved as `DISMISSED`. Collapsing "unfounded"
  into "acted on" would make the queue's own history useless for judging whether the three-reporter
  auto-suspend threshold is calibrated, which is the one number this system most needs to tune.
- **A moderator's suspension leaves `auto_flagged` false.** That flag exists so a DISMISS knows
  whether it is undoing the *system's* decision; setting it on a human decision would let a later
  dismissal silently republish a listing a moderator deliberately took down.
  `AdminApiTest.dismissDoesNotUndoDeliberateSuspension` pins this.
- `AdminReportQueueItem` gained `targetLabel` and `priorDismissedReports`. The label closes the
  "queue cannot name a USER target" gap — resolved server-side, which also removes an N+1 fetch the
  console was doing per listing row, and works for soft-deleted targets that a public read would 404
  on. `GET /admin/users/{id}` was added too, for anywhere a single lookup is genuinely needed.
- Console: real Suspendre / Bannir buttons alongside Classer sans suite, both behind a confirm since
  they change an account or take content down; the reporter-history badge; and the per-row title
  fetch deleted in favour of the server label.

**WARN is deliberately still refused, and this is a judgement worth recording.** Its entire effect is
notifying the owner, and `NotificationService` has no implementation (phase 10 / T4.2). Offering it
would write an audit row saying an owner was warned when nothing reached them — a moderator would
believe the matter was handled. That is the same fabrication class this project has been removing all
session, so the action returns `NOT_IMPLEMENTED` with a message naming what it waits on. It becomes a
one-line change once T4.2 lands.

**Third occurrence of the shared-container isolation pattern.**
`ReportApiTest.adminReportsAreGroupedByTarget` asserted the pending queue held exactly one item and
broke as soon as `AdminApiTest` left a pending report. Fixed the same way as the previous two. This is
no longer an incident, it is a trend: count-based assertions against a suite-wide database keep
failing whenever a new test class is added, which taxes every future change. Worth a dedicated
isolation pass.

Suite: **86 tests, 0 failures** (was 81; +5). Frontend `typecheck` and `build` clean. Not verified in
a browser.

**T1.5 account stubs (avatar upload, account deletion) — done (2026-09-02).**

Both were `NotImplementedYetException`. `plans/09` warned that deletion "is not specified anywhere in
the design doc" and said not to let it be decided by whatever the delete button happens to do — but
the policy *was* written down, on `UserController#deleteMe`'s own javadoc, with a rationale. Read it
and implemented it rather than re-deciding: Firebase identity removed, row and listings
soft-deleted, messages retained, because a conversation is two people's data and one party cannot
unilaterally erase the other's history. Second time this session that checking what was already
written avoided inventing an answer.

- **Avatar upload** reuses the listing photo pipeline. `ImageStore.store` now takes a folder
  (`listings` / `avatars`) instead of hard-coding the listing prefix — one parameter rather than two
  near-identical methods, because the re-encode *is* the point: a selfie taken at home carries the
  same GPS problem a listing photo does, and a separate avatar path would have drifted from it.
  Replacing an avatar deletes the previous file best-effort; a cleanup failure does not fail the
  upload.
- **Account deletion** soft-deletes the row and every listing, then removes the Firebase identity
  **last and inside the transaction**. Ordering matters: a failure rolls the soft-delete back and the
  person can retry, whereas deleting the identity first would leave a live Dari row nobody can
  authenticate against — locked out, still listed, unable to retry.

**Two real gaps found while implementing, neither in the stated policy:**

1. **Deleting an account permanently burned the email address.** V2's unique index on `lower(email)`
   covered every row including soft-deleted ones, so someone could delete their account, sign up
   again with a fresh Firebase identity, and then fail `POST /users` on a constraint violation they
   could do nothing about. `V14__soft_deleted_users_release_email.sql` scopes the index to live rows.
   Banned identities are unaffected — they are blocked earlier by their own table, which keeps its own
   copy of the address precisely so it survives this.
2. **A deleted account kept working until its token expired.** Deleting a Firebase identity does not
   invalidate already-issued ID tokens, so without a check someone could keep using the app for up to
   an hour after asking to be removed. `FirebaseAuthFilter` now refuses a soft-deleted row directly,
   right where the banned-account check already lives.

Frontend: both live on `/account/profile`, deliberately **not** on `/account/security` — that page is
still entirely fabricated content, and wiring a real destructive action into it would lend the mock
credibility it has not earned. Deletion sits in a separated danger zone outside the form, behind a
confirm *and* a typed SUPPRIMER, since it is irreversible and cascades.

**Still open, and it is a GDPR question rather than a functional one:** a soft-deleted row keeps the
person's email, display name and bio. Defensible as an audit trail, indefensible as erasure —
recorded in `plans/09` for a deliberate answer before launch rather than settled quietly here.

Suite: **89 tests, 0 failures** (was 86; +3 — avatar upload and its rejection of a non-image, the
deletion cascade including Firebase identity removal and immediate token refusal, and re-registration
with a deleted email). Frontend `typecheck` and `build` clean. Not verified in a browser.

## Track 2 — search, filters, map

**T2.2 sorting made real — done (2026-09-02).**

Audited the search surface before starting, because the phase docs have understated what exists more
than once. Most of what `plans/07` lists as open is already built: property/room/furnishing
multi-select, amenity AND-matching, availability dates, and city/neighborhood-versus-radius as
mutually exclusive modes with a clear 400 all work, and the Leaflet map has been live for a while.

**What was actually broken was the sort.** `ListingSearchService.search` parsed the `sort` parameter
and then used it only to *validate* radius queries. On every non-radius search — which is the normal
case — it went to `searchByLocationPaginated`, whose ORDER BY is a hard-coded
`created_at DESC, id DESC`. The frontend offered four sorts ("Pertinence", "Prix", "Nouveautés",
"Plus proches") and three of them returned byte-identical recency-ordered results. Choosing "Prix"
did nothing at all.

- New `searchByLocationSorted` handles `priceasc`, `pricedesc`, `updated` and the recency default,
  with the keyset predicate varying alongside the ORDER BY. **One query, not four.** The filter block
  is already repeated across this interface; four more copies would mean a future filter fix has to
  land in eleven places or silently diverge between "sorted by price" and "sorted by date", which is
  a difference nobody would think to test for.
- **The sort now travels in the cursor.** A cursor built for a price ordering is meaningless against
  a date ordering — resuming one with the other skips or repeats rows with nothing to indicate it.
  A mismatch now restarts from the first page instead of returning a quietly wrong one, and there is
  a test for exactly that.
- Every nullable parameter is explicitly cast, per the "could not determine data type" trap that took
  this same search down once before.
- A `closest` sort without a radius is now a 400 rather than being silently downgraded to recency.

**Frontend labels now say what the sorts do.** "Pertinence" promised a relevance ranking that does not
exist, so the default is named "Plus récentes" until one does. "Prix" was ambiguous about direction
and is now two options, since the API supports both.

**Deliberately not built: a real "recommended" ranking.** `plans/07` asks for one and the design doc
§5 says "recency plus basic quality signals", which is not a specification. Inventing a scoring
formula here would be a product decision made by whoever was writing SQL that afternoon, and a
keyset-paginated ranking over a computed score is materially harder than the four orderings above.
Recorded as open rather than approximated.

Suite: **92 tests, 0 failures** (was 89; +3 — price ordering in both directions, cursor/sort mismatch
handling, and distance-sort-without-radius). The price test discriminates by construction: the rows
are inserted in an order that matches neither ascending, descending, nor recency, so it could not
have passed before this change. Frontend `typecheck` and `build` clean. Not verified in a browser.

**T2.5 EXPLAIN ANALYZE and index review — done (2026-09-02).**

Measured rather than reasoned about: a throwaway PostGIS container, all migrations applied, **50,000
listings** across the four real cities with varied prices and 200,000 `listing_amenities` rows. The
project's own dev database turned out to be stuck at V2 and was left untouched.

**First question answered: does the new CASE-based ORDER BY defeat the indexes?** It does not.
Postgres constant-folds the sort branches, and it keeps doing so under a prepared statement executed
repeatedly — it prefers a custom plan here precisely because the parameter changes the plan. The
default sort still runs as a plain index scan (0.24 ms). This was worth checking before anything
else, since a single-query design that silently forced a full sort would have been worse than the
four-query duplication it avoided.

**Two index gaps, both created by making the sorts real:**

| query | before | after |
| --- | --- | --- |
| recency (default) | 0.48 ms | unchanged, already indexed |
| price ascending | 0.56 ms, incremental sort on top | 0.36 ms, pure index scan |
| price, resumed from a keyset cursor | — | 0.36 ms, pure index scan |
| **recently updated** | **21.6 ms** | **0.38 ms** |

`V15__search_sort_indexes.sql` adds a partial `(city, updated_at DESC, id DESC)` index — recently-updated
previously had none at all and bitmap-scanned every listing in the city (12,500 rows for Rabat) before
a top-N heapsort, growing linearly with the city. It also extends the price index to `(city,
price_rent, id)` so a price page resumes straight off the index in both directions instead of needing
an incremental sort for the `(price_rent, id)` tiebreaker.

**The real find: the amenity filter, exactly where `plans/07` predicted it.** The worst realistic
query — city + price range + property type + availability date + two amenities AND-matched + price
sort — ran at **88 ms**. The `l.id IN (SELECT ... GROUP BY ... HAVING COUNT(*) = n)` form is evaluated
**globally**: it scanned 40,054 amenity rows across the entire table, sorted 3.2 MB of them and
aggregated to 6,699 ids, *before* the city filter had any say. It scaled with total amenity rows
rather than with the city being searched.

Rewritten as a correlated `(SELECT COUNT(DISTINCT ...) WHERE la.listing_id = l.id) = :count`, which
runs as an index-only scan on the join table's primary key per candidate row: **88 ms → 35.7 ms**,
and far more importantly it now scales with candidates in the city rather than with the whole table.
Applied to all six queries carrying the clause, not just the sorted one — leaving some on the old
form is precisely the divergence this interface's duplication invites.

**Disclosed rather than papered over:** with `enable_bitmapscan = off` the same correlated query runs
at **8.8 ms**, walking the price index in order and stopping after 21 matches. The planner does not
choose that on its own because it cannot estimate a correlated subquery's selectivity, so it bitmaps
8,399 rows instead of streaming 181. Not forced — planner hints are not something to bake into a
migration — but the ceiling is recorded here so nobody re-derives it.

Semantics verified, not assumed: `availabilityAndAmenityFiltersAreComposed` already asserts that a
wifi+parking listing matches, a wifi-only listing does not, an undated listing is excluded, and a
repeated code is de-duplicated. It passes unchanged against the correlated form.

Suite: **92 tests, 0 failures**. No frontend change in this step.

**T2.4 result counts — settled and built (2026-09-02).**

This was flagged as a conflict between `plans/07` asking for "Voir 32 annonces" and a no-total-counts
rule. **The conflict was not real.** "No total counts" appears only in
`docs/AI_SESSION_HANDOFF_PROMPT.md` and `docs/SESSION-PROMPT.md` — instructions written for AI
sessions. The authoritative documents say something narrower: `ARCHITECTURE.md` says the codebase
"uses keyset pagination and never relies on `OFFSET`", and the design doc gives the reason as
pagination stability as listings are added and removed. A separate count query affects neither. An
over-broad restatement in a prompt had hardened into a perceived architectural rule.

**Measured before choosing** (50k seeded listings, 12,500 in Rabat):

| query | time |
| --- | --- |
| the page itself, worst case | ~35 ms |
| exact count, city only | 14.9 ms |
| exact count, worst case with amenities | 84.9 ms |
| capped count at 200, worst case | 36.8 ms |

The count costs more than the page it labels, because a page stops at twenty-one rows and a count
cannot stop at all. Product owner chose the capped option: exact below 200, "plus de 200" above.

- `GET /api/v1/listings/count` returns `{count, capped}`. **No new SQL** — it reuses the existing
  search queries with `LIMIT CAP + 1`. A seventh copy of the filter predicate would be one more place
  for a future filter fix to miss, and a count that silently disagreed with the results it labels is
  worse than no count at all.
- Fetched once per filter set, never while paginating, and deliberately not awaited alongside the
  results: a slow count must not delay the list, and a failed one degrades the heading to a neutral
  "Annonces à Rabat" rather than taking the page down.

**A fabrication fixed along the way.** The results heading read
`${listings.length} annonce${...} à ${city}` — the number of rows *loaded*, not matched. A search of
12,500 listings in Rabat announced "20 annonces à Rabat", and the number grew as the user pressed
"Voir plus". It now reports the real total.

Suite: **93 tests, 0 failures** (was 92). Frontend `typecheck` and `build` clean.
