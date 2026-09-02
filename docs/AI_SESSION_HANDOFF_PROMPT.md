# Dari AI Session Handoff Prompt

Use this prompt in a fresh AI coding session for Dari. It is kept current after every hands-on
work session — if you are the one who just finished a step, update this file (and
`plans/README.md`, and the specific `plans/NN-*.md` file you touched) before you stop, so the next
session starts from truth, not from a stale summary.

```
You are continuing the Dari project, a Moroccan colocation platform.

Project context
- Repo root: C:\Users\user\Desktop\Dari
- Stack:
  - Backend: Java 21 + Spring Boot 3.5.6 in apps/api (feature-packaged: ma.dari.api.listing,
    .messaging, .moderation, .user, etc. — not layered by generic horizontal tiers)
  - Frontend: Next.js 15.5.4 / React 19 App Router in apps/web, no Tailwind — raw inline
    style={{...}} objects referencing design-system CSS custom properties
  - Database: PostgreSQL 16 + PostGIS, Flyway-owned schema (ddl-auto: validate), currently at V13
  - Identity: Firebase Auth token verification only — the API never exposes login/signup endpoints
  - Tests: Testcontainers against real Postgres+PostGIS (a single container shared across the
    whole suite — see the test-isolation gap below), plus ArchUnit boundary tests
- Product: Moroccan flatshare / co-living platform (Rabat, Casablanca, Marrakech, Tanger)
- User-facing language: French. Code / schema / URLs / enums: English (docs/NAMING.md is the
  non-negotiable boundary reference).
- Design system: design-system/ is the visual source of truth; treat as vendored, don't edit
  casually.

Read these documents in this order
1. README.md
2. ARCHITECTURE.md
3. docs/NAMING.md
4. docs/colocation-platform-design.md
5. plans/README.md (the running status log — read the most recent dated entries first)
6. The specific plans/NN-*.md file for whatever you're about to touch
7. If any UI work is touched: design-system/readme.md

Working mode (current, as of 2026-09-02 — this superseded an earlier read-only mode)
- You edit files directly. Pick the next step, implement it (code + tests), verify for real, update
  docs, then stop and report to the user — one coherent unit per turn, not the whole backlog at
  once.
- "Verify for real" means: backend changes get `cd apps/api && ./mvnw test` (Testcontainers, not a
  read-through); frontend changes get `cd apps/web && npm run typecheck && npm run build`. Never
  claim something works from reading the code alone if a command can prove it.
- Before declaring a `ListingResponse.from(...)`-style call site fully migrated after a DTO
  signature change, grep the whole repo for every call site — Java will happily compile a stale
  overload if one still exists; only a repo-wide search catches every caller, not just the ones a
  local build touches.
- No live browser click-through is available in this environment unless a browser automation tool
  is explicitly connected. Say so explicitly rather than claiming full verification when you
  haven't clicked through a real page — this has been true and disclosed every frontend step so
  far.
- **Never fabricate data or working-looking UI.** This project's biggest recurring defect class,
  found repeatedly this session, is mock UI presented as real: hardcoded review counts, fake
  "verified" badges not backed by a real field, buttons with no onClick, unconditional "saved"
  labels, invented people in a "roommates" list. If a screen has no backend data for something,
  either wire it to real data or remove it and say so in the docs — do not leave a plausible-looking
  fake. See "Known fabricated content still in the frontend" below for exactly where this is still
  true.
- **When investigating one thing surfaces a second, larger, structurally different problem** — not
  a cheap adjacent fix, but a different unit of work (e.g. "this needs a new backend capability
  first") — stop and ask the user how to scope it rather than silently expanding what "continue"
  meant. Cheap-and-certain fixes found along the way get fixed immediately without asking; a whole
  new backend feature does not.
- One label map per enum, in `apps/web/src/lib/labels.ts`, typed as an exhaustive `Record<Enum,
  string>` for closed enums (adding a value breaks the build until it's translated) or a plain
  `Record<string, string>` with an `?? code` fallback for open, DB-driven vocabularies like amenity
  codes. Never inline a translation at a call site — that's how one concept gets three slightly
  different French strings across three screens (this happened once already this session with
  amenity labels, now fixed).

Non-negotiable rules
- Flyway owns the schema; keep ddl-auto = validate. New schema changes are the next V number
  (currently V13 is the latest — the next migration is V14).
- No login/signup API endpoints — Firebase owns identity, the API only verifies tokens.
- Entities are never serialized directly to clients; DTOs only.
- Keyset/cursor pagination only (Cursor/CursorPage classes) — never OFFSET, no total counts.
- Exact coordinates must never leave the API except through vetted admin-gated paths
  (LocationFuzzer fuzzes everything else, deterministically per listing ID).
- `status` (DRAFT/PENDING_REVIEW/PUBLISHED/REJECTED/SUSPENDED/EXPIRED) and `availabilityState`
  (AVAILABLE/ROOM_FOUND/CLOSED) are independent axes on a listing — never collapse them, never let
  one imply the other.
- Role checks are doubled: a URL matcher in SecurityConfig AND @PreAuthorize on the controller.
  Don't remove either layer even if it looks redundant.
- English for code, schema, identifiers, URLs, enum values. French for user-facing copy — see
  docs/NAMING.md.
- Sentence case, no emoji, no exclamation marks in UI copy. Buttons are verb-first.

Current status snapshot (accurate as of 2026-09-02 — verify against the code if much time has
passed or this reads as inconsistent with what you find)

Backend: migrations run V1–V13 (extensions, users, listings slice, published-listings view, full
listing model, reports/admin, messaging, listing photos, amenities/house rules, favorites). Every
major feature area has a real implementation, not a stub: users, listings (full CRUD + lifecycle +
photos + amenities), search/filters/map, messaging, moderation/admin, favorites. The full backend
test suite is 62 tests and passes cleanly.

- **Search filter composition tightened (2026-09-02)**: requested move-in dates now exclude listings
  without an availability date, and repeated/comma-separated query values are de-duplicated before
  amenity AND matching. Draft persistence and public-search test isolation cleanup remain intact.

Frontend: as of 2026-08-30 large parts of the frontend were pure mock UI with zero API calls. As of
this session, that gap has been closed for the pages that had a real backend to wire to:
`/favorites`, `/messages` + `/messages/[id]`, `/account/listings`, `/profile/[id]` +
`/account/profile`, `/account` (stats/verification/sign-out), all of `/admin/*`, and the publish
wizard's type/amenity selection. **What is genuinely still mock or incomplete** — check this list
before assuming a page is done:

- **`/listings/[id]` (the public listing detail page) is still substantially fabricated.** Only the
  favorite-toggle and "Contacter" button are real. A hardcoded description paragraph, a static
  amenities icon row unrelated to the listing's actual amenities, an entire fake "Colocataires" tab
  (two invented people, "Salma"/"Youssef", with fake verified badges), an entire fake "Règles" tab
  (not backed by the real `house_rules` table), a fake owner card ("Nadia · propriétaire", a
  fabricated 4.8 rating), fake "Annonce vérifiée"/availability badges, and a fake "1 / 8" photo
  counter over a placeholder box (no real photos are ever fetched) are all still there. **This is
  the single highest-value next step** — see "Suggested next step" below for what it needs.
- `PublicListingResponse` (the DTO backing public search results AND `GET /listings/{id}`) is
  thinner than the full listing model: no `description`, no `propertyType`/`roomType`, no
  amenities, no photos, no house rules, no charge inclusions, no `availableFrom`/`minStayMonths`.
  This is the backend blocker for the item above.
- There is no `GET` endpoint to list a listing's photos — only `POST`/`PATCH`/`DELETE` exist.
  Nothing currently reads photos back for display anywhere.
- `POST /listings/{id}/submit` does not enforce any preconditions (at least one photo, required
  fields present) — it only checks the status transition is legal. An owner can currently submit,
  and an admin can approve, a listing with zero photos and a blank description.
- The publish wizard (`/publish`) has 4 condensed steps (Annonce/Chambre/Photos/Validation), not
  the prototype's 8 (`flows/listing-creation/Listing Wizard.dc.html`). It has raw lat/long text
  inputs, not a map picker. There is no per-room list (`listing_rooms` is untouched end to end —
  no UI, no endpoint). House rules (`house_rules` table) are also untouched end to end.
- The wizard's "Brouillon enregistré" (draft saved) badge in the header is hardcoded, unconditional
  text — nothing is actually saved until the final "Validation" step's submit click does one
  `POST /listings` immediately followed by `POST /listings/{id}/submit`. A user who closes the tab
  mid-wizard loses everything, while the UI claims otherwise the whole time.
- Listing edit has no UI path at all. The wizard only creates. `/account/listings` deliberately has
  no "Modifier" button rather than one that does nothing.
- Amenities can now be attached to a listing (`amenityCodes` on `POST`/`PATCH /listings`, validated,
  round-tripped through `ListingResponse` and the publish wizard) — this was the gap fixed most
  recently; see `plans/05-listing-creation.md`'s 2026-09-02 entries for the full detail.
- Account sub-pages `/account/notifications`, `/account/payments`, `/account/security` are still
  frontend-only mocks with genuinely no backend to wire to yet (phase 10) — leaving them as
  clearly-labeled mocks is correct here, not a gap to silently "fix."
- Account deletion (`DELETE /users/me`) and avatar upload (`POST /users/me/avatar`) are still
  phase-09 `NotImplementedYetException` backend stubs.
- Messaging has no unread badges (no backend aggregate to back them honestly), no read receipts in
  the UI, sending isn't optimistic, and a suspended/expired listing's context card in a thread just
  disappears (404s silently) rather than showing an explicit "unavailable" state.
- The admin report queue can't resolve a `USER` target's display name (no single-user lookup
  endpoint) and only supports `DISMISS`, not warn/suspend/reject-as-a-report-action.
- **Known, disclosed, unfixed test flakiness**: `ListingSearchOptimizationTest` (3 assertions across
  `locationSearchReturnsByCity`, `distanceSortWorks`, `radiusSearchReturnsWithinDistance`) fails
  intermittently — 2 or 3 of the 3, depending on run order — because the Testcontainers database is
  shared across the entire suite with no per-test data isolation, so other test classes' seeded
  Rabat/Agdal listings leak into count- and radius-based assertions. This is a systemic gap (no
  unique cities per test, no transactional rollback), not a production bug, and is very likely not
  the only test carrying this latent risk. Worth a dedicated isolation pass at some point.
- `src/components/ds/` (the design-system component port) is still just a README — every page uses
  raw inline styles against CSS custom properties instead of shared components.

Suggested next step (highest-value, already scoped)

Fix the listing detail page. This needs, in order:
1. Expand `PublicListingResponse` (or add a new, richer detail-only DTO used just by
   `GET /listings/{id}`, keeping the thin one for search-result cards) to include `description`,
   `propertyType`, `roomType`, `numBedrooms`/`numBathrooms`, charge inclusions,
   `availableFrom`/`minStayMonths`, and the amenity codes (reuse the `ListingAmenityRepository`
   pattern already built for the owner-facing `ListingResponse`).
2. Add a `GET /listings/{id}/photos` (or embed an ordered photo list directly in the detail
   response) so real photos can render instead of the placeholder box.
3. Decide what to do about `house_rules` — either expose it (it has real columns:
   smoking/pets/guests allowed, quiet hours, free text) or explicitly leave it out and say so in
   the docs; do not fabricate a "Règles" tab from nothing.
4. Rewrite `apps/web/src/app/listings/[id]/page.tsx`: real description, real amenities row (reuse
   `AMENITY_LABELS` from `lib/labels.ts`), a real photo carousel/gallery, and **remove** the fake
   "Colocataires" tab, the fake owner rating, and the fake "Annonce vérifiée"/availability badges
   entirely rather than leave them as decoration — there is no roommates-as-people data model and
   no reviews/ratings system, so don't invent placeholders for either.
5. Verify with `./mvnw test` and `npm run typecheck && npm run build`; there is still no browser
   automation available, so say so explicitly rather than claiming a full click-through.

Other open candidates, roughly in descending value, if the above isn't what the user wants next:
- `POST /listings/{id}/submit` precondition enforcement (photo required, fields present) — cheap,
  well-scoped, closes a real moderation-quality gap.
- `ListingSearchOptimizationTest` isolation fix (unique test data per test, or transactional
  rollback) — improves trust in the whole suite's count-based assertions.
- Listing edit mode (load a DRAFT/REJECTED listing into the wizard, PATCH instead of POST) — now
  that amenities have a real write path, this is more tractable than it was mid-session.
- `src/components/ds/` component port — larger, cross-cutting, not urgent since inline styles
  currently work correctly against the design tokens.

Architecture principles
- Feature packages by domain (ma.dari.api.listing, .messaging, ...), not generic horizontal layers.
- Controllers delegate to services; DTOs at the edge, entities never leave the service layer.
- Business logic lives in services, not controllers.
- Postgres + PostGIS is the system of record; search and listing lifecycle are the core of the
  product, not incidental features.
- Moderation and status rules are real product rules enforced server-side, never UI-only decisions.

Output expectations
- State exactly what changed, in which files, and why — not a narrated diff.
- Verify with the real command (`mvnw test`, `npm run typecheck`/`build`) before claiming something
  works; state plainly what was NOT verified (almost always: real browser click-through).
- Update `plans/README.md`, the specific `plans/NN-*.md` file(s) touched, `README.md` if the
  "already built" / "remains open" lists changed, and this file if the status snapshot above is now
  stale — before stopping.
- One coherent unit per turn. Stop and report; don't silently chain into the next unrelated step.

Your job now
- Read the docs in the order above, then re-verify anything in this snapshot that seems load-bearing
  for what you're about to do (a quick `mvnw test` or a targeted file read costs little and this
  snapshot decays fast).
- Pick the highest-value next step — the listing detail page fix above is the recommended default,
  but defer to the user if they name something else.
- Implement it as one coherent unit, verify for real, update the docs, then stop and report back.
```
