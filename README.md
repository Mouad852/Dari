# Dari

Dari is a Moroccan colocation platform for Rabat, Casablanca, Marrakech, and Tanger.

The repo currently contains a working backend foundation and a substantial Next.js product UI surface. The architecture is intentionally conservative: one Java monolith API, one Next.js frontend, one Postgres+PostGIS database, and a Firebase identity boundary.

## Current project state

### Runtime and app shape

- Backend: `apps/api` — Spring Boot monolith, Java 21
- Frontend: `apps/web` — Next.js App Router
- Database: PostgreSQL 16 + PostGIS
- Identity: Firebase Auth token verification only
- Product scope: public listings, account flow, publishing, moderation, admin console, messaging

### What is already built

- Live search results page reads from the backend /api/v1/listings route and keeps the current sort in the URL.

The project has already crossed the foundational backend and product UI milestones:

- Firebase token auth chain
- shared API error envelope
- cursor pagination primitives
- UUIDv7 generation
- users feature end to end
- Testcontainers against real PostGIS
- ArchUnit boundary checks
- MDC + correlation-id request logging
- public and account UI slices in Next.js
- sign-in / sign-up product screens
- admin and moderation views
- listing discovery, city landing, and detail pages
- live listings search page wired to `/api/v1/listings` with URL-driven sort state and production build validation
- city landing pages load live city-filtered listings and link to detail routes
- listing detail pages load `/api/v1/listings/{id}` and handle unavailable listings
- Firebase email authentication is wired to sign-in/sign-up; signup creates the Dari profile through authenticated `POST /users`
- account overview loads `/api/v1/users/me` with the refreshed Firebase ID token
- publish wizard persists a server-side draft across steps, resumes the owner's latest draft, and submits it through the listing lifecycle API
- scheduled listing expiry warns owners seven days ahead with idempotent tracking, changes stale published listings to `EXPIRED`, enqueues warning and expiry notifications transactionally, and lets owners renew only into `PENDING_REVIEW`
- notification delivery is implemented as an opt-in SMTP worker with durable claiming, bounded retries, sent/dead states, and the existing French outbox copy preserved
- search filters for neighborhood, property type, room type, and rent bounds persist in the URL
- publish, favorites, messaging, and profile flows
- favorites is implemented end to end: backend (`GET/POST/DELETE /api/v1/favorites` plus `GET /api/v1/favorites/ids` for membership checks, idempotent, integration-tested) and frontend (the `/favorites` list, the listing detail page's save toggle, and the search-results feed cards all call the real API and reflect real favorited state on load)
- messaging is implemented end to end: `/messages` and `/messages/[id]` consume the real `/api/v1/conversations` API (including a new `GET /api/v1/conversations/{id}` for the thread header), and the listing detail page's "Contacter" button actually starts a conversation instead of doing nothing
- owner listing management (`/account/listings`) consumes `GET /api/v1/listings/mine` and supports submit/mark-room-found/reopen/delete for real; it also links to the publish wizard's listing edit mode through owner-scoped `GET /api/v1/listings/mine/{id}`
- the admin console (`/admin/*`, all 4 pages) is wired to the real, already-built `AdminController` API, with a role-gated layout that redirects non-admins before they see anything (the real enforcement is server-side and predates this work)
- public profiles (`/profile/[id]`) and profile editing (`/account/profile`) are wired to the real, already-built `GET /users/{id}`/`PATCH /users/me` endpoints
- the publish wizard's property/room type selection is now real (previously every listing silently published as a hardcoded type regardless of what the owner picked)
- amenities can now be attached to a listing: `POST/PATCH /api/v1/listings` accept `amenityCodes`, validated against the real `amenities` table and round-tripped through `ListingResponse`; the publish wizard's "Équipements" step now sends real codes instead of a fictional French-string list
- listing search optimization integration tests isolate only public-searchable rows in the shared PostGIS container, preserving drafts while keeping city/radius assertions deterministic
- listing search date and amenity filters enforce composed conditions, including excluding undated listings for a requested move-in date and de-duplicating repeated query values
- the hero search bar works: a plain GET form posting to `/listings`, so it ships no JavaScript and functions before hydration. Every control on it was previously inert, including a submit button with no handler
- `/listings` filter permutations canonicalise to `/flatshare/{city}` so they consolidate rather than each becoming an indexable page
- **known, needs a decision**: the design system does not meet WCAG AA on five token pairs — `--text-subtle` on white is 3.84:1 and white text on `--brand` is 4.24:1, against a 4.5:1 requirement. Lighthouse scores SEO 100, best practices 100, accessibility 96 on a production build. The neutral greys can move to the existing `--sable-600`; the brand ones need a call on shifting `--clay-500` along its own ramp
- the homepage is wired to real data: featured listings from `GET /listings/featured` with cover photos and links, and per-city counts on the city tiles. It previously shipped four invented listings with fabricated star ratings (there is no reviews system), invented per-city counts, and a "Bail signé en ligne, caution protégée" claim for features that do not exist
- city landing pages are prerendered per city with their own metadata and canonical, and now state only measured figures: a real active-listing count, a real price range, and neighbourhood chips derived from actual listings. They previously published invented statistics ("420 annonces actives", "6 jours temps moyen de réponse") and showed Rabat's neighbourhoods on all four city pages; an unknown city slug now 404s instead of silently rendering Rabat
- listing detail pages are server-rendered with per-listing metadata, canonical URLs, Open Graph tags and schema.org `Accommodation` markup; unavailable listings return a real 404 so they leave the index, and `sitemap.xml` carries listing URLs from the published view and revalidates hourly
- stored photos and avatars are publicly readable at `/uploads/**`. They previously returned 401 for everyone — the path fell through to `anyRequest().authenticated()`, and a browser sends no bearer token for an `<img src>`, so no listing photo could ever display
- search results carry a real count: `GET /listings/count` returns an exact figure below 200 and "plus de 200" above it, fetched once per filter set rather than per page. The heading previously reported the number of rows *loaded*, so 12,500 matching listings in Rabat displayed as "20 annonces"
- search is index-backed for every sort: `V15` adds a partial `(city, updated_at, id)` index and extends the price index with `id`; recently-updated went from 21.6 ms to 0.38 ms per page against 50k seeded listings. The amenity AND-filter was rewritten from a global `IN (... GROUP BY ... HAVING)` to a correlated count (88 ms to 35.7 ms on the worst realistic query), so it scales with candidates in the city rather than with the whole join table

### What remains open

The important remaining work is still phase-oriented and should be driven from the phase docs:

- Phase 03 frontend validation: public routes, auth screens, account loading, publishing, and live search contracts are wired and production-build validated
- search results, favorites and city landing cards show the listing's cover photo. `PublicListingResponse` carries `coverPhotoUrl`, resolved for a whole page in one query rather than per listing, and the placeholder is kept only for listings that genuinely have no photo
- the search page is responsive: the filter rail is a sticky column on desktop and a disclosure panel with an active-filter count below 900px, selected chips invert to charcoal per the design system, and the apply button carries the live result count. `src/styles/app.css` holds the app's first media queries — inline style objects cannot express a breakpoint, which is why nothing was responsive before
- **known, pre-existing**: deep-linking to `/listings?view=map` rewrites itself to the list view (clicking "Carte" works). Rapid amenity-chip selection was fixed on 2026-09-05 by keeping the latest selection synchronously while URL updates are in flight.
- Phase 07 search filters and map: filters, map view and URL state are built. Sorting is now real — price ascending/descending, recency and recently-updated all order correctly with sort-aware keyset cursors; previously `sort` was parsed and discarded on non-radius searches, so three of the four options in the UI returned identical results. A genuine "recommended" ranking is still open, and the default is labelled "Plus récentes" rather than implying one exists
- account sub-pages (notifications, payments, security) are still frontend-only mocks with no API calls — notification delivery exists for email, but no in-app notification screen or contract is planned for launch; profile is now wired (see above)
- account deletion and avatar upload are built: `POST /users/me/avatar` reuses the listing photo pipeline (so profile photos are EXIF-stripped too), and `DELETE /users/me` removes the Firebase identity, soft-deletes the row and the person's listings, and retains messages. Both are wired on `/account/profile`
- messaging has no unread badges or read receipts, and sending isn't optimistic — the core flow works, these are the remaining gaps
- owners can edit any of their listings: `/account/listings` has a "Modifier" link that opens the wizard on that listing, backed by a new owner-scoped `GET /listings/mine/{id}` which returns **true** coordinates (the public `GET /listings/{id}` fuzzes them even for the owner, so an edit form fed by it would drift the listing's location on every save)
- **editing a `PUBLISHED` listing returns it to `PENDING_REVIEW`** and removes it from public search until re-approved. This reverses the original design-doc §4 rule, at the product owner's direction; the doc was updated to match
- the admin console has HTTP-level test coverage (`AdminApiTest`): role gating, approve/reject with audit-log assertions, ban cascades, and the DISMISS-only report-action limitation. Both halves of the doubled role check are now independently effective — `@PreAuthorize` previously denied correctly but surfaced the denial as a 500 rather than a 403
- users can file reports: a reason picker dialog on `/listings/[id]` and `/profile/[id]` posts to the already-built `POST /reports`, with a generic acknowledgment that reveals no moderation outcome. Until this landed the moderation queue had no way to be populated by real users. Self-reports are rejected server-side
- the admin report queue names its target, shows the reporters' prior-dismissal history, and supports dismiss, suspend (listing or account) and ban (accounts only) as real actions that close the reports with the correct outcome. **Warn is still refused on purpose** — its moderation action remains a separate follow-up despite email delivery now existing
- the listing detail page (`/listings/[id]`) now uses a dedicated rich public DTO for the real description, listing attributes, charge inclusions, availability, amenities, and stored photos; fabricated roommates, rules, owner ratings, verification badges, and photo counters were removed. House rules remain intentionally absent until their real read contract is exposed
- `POST /listings/{id}/submit` requires a non-blank description and at least one active photo before moving a `DRAFT` or `REJECTED` listing to `PENDING_REVIEW`
- the publish wizard uploads real photos: multi-file select, cover selection, delete, and reorder (move buttons rather than drag-and-drop, so reordering works with a keyboard and on touch), backed by `POST/PATCH/DELETE /listings/{id}/photos` and a new owner-scoped `GET /listings/{id}/photos`. Until this landed the Photos step was a button with no handler, so no listing could satisfy the submit precondition and publishing was impossible end to end
- multipart limits are configured (6 MB per file) above `LocalImageStore`'s own 5 MB rule; Spring's 1 MB default previously rejected any ordinary phone photo as a bare 500 rather than the French error envelope
- owner-scoped GET routes (`/listings/mine`, `/listings/draft`, `/listings/{id}/photos`, `/users/me`) are gated by the security chain as well as by `@CurrentUser`; they previously sat under wildcard `permitAll` rules and were defended by one layer instead of the two this project requires
- chain-level auth failures return the standard error envelope: 401 `UNAUTHENTICATED` with `WWW-Authenticate: Bearer` for anonymous callers, 403 `FORBIDDEN` for an authenticated caller without the role. Spring's default for both is a bodyless 403
- Listing create and patch validate availability fields: minimum stay is 1–36 months and availability cannot be in the past
- Listing create and patch validate that current roommates do not exceed the maximum, including when a partial patch is merged with existing values
- Listing create and patch validate roommate count bounds: current count 0–20 and maximum 1–20
- Listing create and patch validate bedroom and bathroom count bounds: 0–20 each
- Listing create and patch validate rent and deposit precision: up to 8 integer digits and 2 decimal places, matching `NUMERIC(10,2)`
- Listing submission requires property and room types while preserving their nullable draft fields
- the publish wizard has 4 condensed steps, not the 8-step prototype it's meant to match; it persists/resumes server-side drafts through `/listings/draft` and `/listings/{id}` and now uploads real photos, but has no map picker (raw lat/long inputs), per-room list (`listing_rooms` is untouched), house-rules step, or neighborhood membership validation

## Repository layout

| Path | What it is |
| --- | --- |
| `apps/api/` | Spring Boot API monolith. Owns business logic and the database boundary. |
| `apps/web/` | Next.js App Router frontend. Renders products and product flows. |
| `design-system/` | The visual source of truth: tokens, guidelines, UI kits, and brand language. |
| `flows/` | Product flow prototypes and design exports. |
| `infra/` | Compose services, DB bootstrap, Firebase notes, local dev scripts. |
| `plans/` | The phase plan and implementation guides. |
| `docs/` | Design specification, naming rules, and project handoff docs. |
| `ARCHITECTURE.md` | How the system fits together and why. |
| `docs/NAMING.md` | English vs French boundary, naming conventions, and glossary. |
| `TODO.md` | The source-verified completion checklist; update it every coding session. |

## Core principles

- English for code, schema, URLs, packages, and API identifiers
- French for user-facing copy
- Flyway owns the database schema
- DTOs only at the API boundary
- keyset pagination only
- Firebase handles identity; the API verifies tokens
- design-system tokens define the product’s design language

## Getting started

Requirements: Docker, JDK 21, Node 20+.

The backend also needs a Firebase service-account key at `infra/firebase/service-account.json`.
It is not in the repo and never should be — `infra/firebase/*` is gitignored wholesale, with this
README's sibling as the only exception. See `infra/firebase/README.md` for how to generate one.

```powershell
# from repo root
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local

./infra/scripts/dev.ps1 up
./infra/scripts/dev.ps1 api
./infra/scripts/dev.ps1 web
```

Or run without the task wrapper:

```bash
docker compose up -d
cd apps/api && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
cd apps/web && npm install && npm run dev
```

Useful checks:

```bash
cd apps/web && npm run typecheck
cd apps/api && ./mvnw test
```

## Validation notes

- The frontend is sensitive to stale local dev servers. If a route looks wrong or styles are missing, stop stale Next processes and verify against a clean port.
- Port 8080 may be occupied by unrelated services; do not assume the app on that port is Dari.
- Confirm the actual page and asset payload are serving correctly before calling UI work complete.

## Design-system brand summary

Dari is warm, trustworthy, and modern. The product uses a terracotta/sand/cream palette with charcoal text, soft card surfaces, pill buttons, and generous spacing. Copy remains French and user-facing; code and technical identifiers stay English.

See `design-system/readme.md` and `docs/NAMING.md` for the non-negotiable rules.
