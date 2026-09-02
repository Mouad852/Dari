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
- search filters for neighborhood, property type, room type, and rent bounds persist in the URL
- publish, favorites, messaging, and profile flows
- favorites is implemented end to end: backend (`GET/POST/DELETE /api/v1/favorites` plus `GET /api/v1/favorites/ids` for membership checks, idempotent, integration-tested) and frontend (the `/favorites` list, the listing detail page's save toggle, and the search-results feed cards all call the real API and reflect real favorited state on load)
- messaging is implemented end to end: `/messages` and `/messages/[id]` consume the real `/api/v1/conversations` API (including a new `GET /api/v1/conversations/{id}` for the thread header), and the listing detail page's "Contacter" button actually starts a conversation instead of doing nothing
- owner listing management (`/account/listings`) consumes a new `GET /api/v1/listings/mine` endpoint (every status, paginated) and supports submit/mark-room-found/reopen/delete for real; editing is intentionally not offered since the publish wizard has no edit mode yet
- the admin console (`/admin/*`, all 4 pages) is wired to the real, already-built `AdminController` API, with a role-gated layout that redirects non-admins before they see anything (the real enforcement is server-side and predates this work)
- public profiles (`/profile/[id]`) and profile editing (`/account/profile`) are wired to the real, already-built `GET /users/{id}`/`PATCH /users/me` endpoints
- the publish wizard's property/room type selection is now real (previously every listing silently published as a hardcoded type regardless of what the owner picked)
- amenities can now be attached to a listing: `POST/PATCH /api/v1/listings` accept `amenityCodes`, validated against the real `amenities` table and round-tripped through `ListingResponse`; the publish wizard's "Équipements" step now sends real codes instead of a fictional French-string list
- listing search optimization integration tests isolate only public-searchable rows in the shared PostGIS container, preserving drafts while keeping city/radius assertions deterministic
- listing search date and amenity filters enforce composed conditions, including excluding undated listings for a requested move-in date and de-duplicating repeated query values

### What remains open

The important remaining work is still phase-oriented and should be driven from the phase docs:

- Phase 03 frontend validation: public routes, auth screens, account loading, publishing, and live search contracts are wired and production-build validated
- Phase 07 search filters and map: URL-driven search filters are started; map view, map rendering, and complete filter coverage remain
- account sub-pages (notifications, payments, security) are still frontend-only mocks with no API calls — notifications and payments have no backend to wire to yet (phase 10); profile is now wired (see above)
- account deletion (`DELETE /users/me`) and avatar upload (`POST /users/me/avatar`) are still phase-09 backend stubs
- messaging has no unread badges or read receipts, and sending isn't optimistic — the core flow works, these are the remaining gaps
- listing edit has no separate dashboard UI path — the publish wizard resumes and edits active drafts; owners can submit/pause/reopen/delete from `/account/listings`
- the admin report queue can't resolve a `USER` target's name (no single-user lookup endpoint exists) and only supports dismissing a report, not warning/suspending/rejecting from the queue itself
- the listing detail page (`/listings/[id]`) now uses a dedicated rich public DTO for the real description, listing attributes, charge inclusions, availability, amenities, and stored photos; fabricated roommates, rules, owner ratings, verification badges, and photo counters were removed. House rules remain intentionally absent until their real read contract is exposed
- `POST /listings/{id}/submit` requires a non-blank description and at least one active photo before moving a `DRAFT` or `REJECTED` listing to `PENDING_REVIEW`
- the publish wizard uploads real photos: multi-file select, cover selection, delete, and reorder (move buttons rather than drag-and-drop, so reordering works with a keyboard and on touch), backed by `POST/PATCH/DELETE /listings/{id}/photos` and a new owner-scoped `GET /listings/{id}/photos`. Until this landed the Photos step was a button with no handler, so no listing could satisfy the submit precondition and publishing was impossible end to end
- multipart limits are configured (6 MB per file) above `LocalImageStore`'s own 5 MB rule; Spring's 1 MB default previously rejected any ordinary phone photo as a bare 500 rather than the French error envelope
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
| `docs/AI_SESSION_HANDOFF_PROMPT.md` | A ready-to-paste handoff prompt for another AI session. |

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
