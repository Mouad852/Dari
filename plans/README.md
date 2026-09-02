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

**Still outstanding on T0.1, and it is not something I can do:** the key itself must be rotated in
the Firebase console. It sat unprotected on disk, so it should be treated as exposed even though it
never reached git.

Next in the plan: **T0.2 photo upload end to end** — the product blocker. `submit` requires at least
one active photo and the frontend has no upload at all, so no listing can currently be published.
