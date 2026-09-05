# Architecture

How Dari is put together, and why. This file is the companion to the design doc and the phase plan.

## Current state

The repo is no longer a clean scaffold. It contains a working Spring Boot API foundation and a substantial Next.js product surface.

- Backend: `apps/api` — Java 21, Spring Boot monolith
- Frontend: `apps/web` — Next.js App Router
- Database: PostgreSQL + PostGIS
- Identity: Firebase Auth token verification only
- Product shape: public listing discovery, account flow, publishing, moderation, messages, and admin views

The system is still intentionally split into the same two deployables and one shared database, but the implementation has moved from “scaffold” to “working product shell.”

---

## 1. Shape

Two deployables and one database.

```
                    ┌──────────────────┐
  browser ─────────▶│  dari-web        │  Next.js (App Router)
                    │  product UI      │  renders the product surfaces
                    └────────┬─────────┘
                             │  REST, bearer token
                    ┌────────▼─────────┐
  mobile ──────────▶│  dari-api        │  Spring Boot monolith, Java 21
  (phase 11)        │  business rules  │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐        ┌──────────────────┐
                    │  PostgreSQL 16   │        │  Firebase Auth   │
                    │  + PostGIS 3.4   │        │  identity only   │
                    └──────────────────┘        └──────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  Object storage  │  S3-compatible; MinIO locally
                    └──────────────────┘
```

The monolith is still the correct tradeoff for this stage. The project is intentionally small enough that service boundaries are a cost, not a win, until traffic or product complexity argue for extraction.

The frontend remains a second runtime, not because the business logic lives there, but because discovery and the public listing surface rely on crawler-visible pages and route-level SEO. The app is not a pure SPA; it is a product app with real route pages and a design system shaped to the product.

URLs stay English. User-facing copy stays French. See `docs/NAMING.md` for the exact boundary and examples.

---

## 2. Repository layout

```
apps/
  api/            Spring Boot API. Owns business logic and the database boundary.
  web/            Next.js App Router frontend.

design-system/    Visual source of truth: tokens, guidelines, and UI kits.
docs/             Design docs, naming rules, handoff documents.
flows/            UI and flow prototypes.
infra/            Compose services, database bootstrap, Firebase notes, local runners.
plans/            Phased build plan and implementation guides.
```

Not a build-tooled monorepo. The API and web app each own their own toolchain, while `infra/scripts/dev.ps1` remains a thin wrapper for running the local stack consistently.

---

## 3. Backend

The backend foundation is in place and is now a real working base instead of an empty scaffold.

### Packages by feature, not by layer

```
ma.dari.api
├── config/          security, Firebase, MVC, Jackson
├── common/
│   ├── error/       ErrorCode, ApiException, the shared envelope
│   ├── auth/        FirebaseAuthFilter, AuthenticatedUser, @CurrentUser
│   ├── pagination/  Cursor, CursorPage
│   └── jpa/         UUIDv7 support
├── user/            entity, repository, service, controller, dto/
├── listing/         geospatial search, status lifecycle, search indexing
├── messaging/       conversations, messages, outbox
├── moderation/      reports, queue, admin actions
├── media/           upload, re-encode, EXIF strip
├── notification/    notification contract; delivery is a phase-10 gap
└── ...
```

The code remains organized around feature domains rather than a generic controller mega-package.

### Layering inside a feature

Controller → service → repository, with DTOs at the boundary.

- Controllers do no business logic.
- Entities are not serialized to clients.
- Transactions live in services.
- Public responses remain explicit and intentional.

---

## 4. Product decisions that shape everything else

### Identity is Firebase's; authorization is ours

The API has no login or signup endpoint and must not add one. Clients authenticate to Firebase, receive an ID token, and the API verifies it against Firebase. The app maps the Firebase uid to a Dari user row.

A valid token does not imply a profile exists. `POST /users` remains a separate flow and the client must handle the profile-not-found state explicitly.

### Postgres is authoritative

The database is the system of record. Any read-optimized or event-driven mirror remains a projection, never a second write source.

### Flyway owns the schema

`ddl-auto: validate` stays in place. The schema must move by migration and migration only.

### Keyset pagination everywhere

The codebase uses keyset pagination and never relies on `OFFSET`.

### Exact coordinates remain private

Exact coordinates are stored for searching and enforcement, but they are never exposed publicly outside admin-gated paths.

---

## 5. Current working status

At this point, the repo has moved beyond a clean scaffold and into a real implementation state:

- backend foundation is complete enough to support the user feature set
- frontend is product-shaped and already filled in for many public and account flows
- the remaining work is the next phase-driven feature or missing backend contract gap, not a blank repository

This is why the docs must describe the repo as it is now, not as a future-state plan with nothing built yet.

The phase plan still governs ordering, but the current state is not “no work done.” The work already exists in both the API and the web app.
r-request makes map pins visibly jitter,
*and* lets an attacker average many requests back to the true point. Displayed
distances are rounded coarsely for the same reason.

The enforcement is structural — the public DTO has no field that could hold an
exact coordinate. The phase-10 privacy audit must still inspect every path,
including Next.js hydration payloads, where a leak would otherwise be easy to miss.

### Listing state is two independent axes

`status` (moderation) crossed with `availability_state` (the owner's intent).
Collapsing them into one enum was tempting and would be wrong: an owner marking
a room found must not undo a moderation decision, and a moderator suspending a
listing must not silently republish it when the owner reopens.

Every search reads through a database view that hard-codes
`status = 'PUBLISHED' AND availability_state = 'AVAILABLE' AND deleted_at IS NULL`,
so a new feature cannot forget the invariant.

### PostGIS search and cursor pagination (Phase 02)

Public listing search uses native PostGIS queries with spatial indexes instead of in-memory filtering. This is non-negotiable for scale and is verified at startup via Testcontainers against real Postgres+PostGIS.

- **Radius search** uses `ST_DWithin()` at the database level, not application-level haversine.
- **Distance sorting** requires keyset pagination because the sort order depends on a query-specific reference point. The cursor payload includes a mode flag to distinguish distance mode from recency mode.
- **Query plans** are verified during development to ensure the GiST spatial index is actually used.
- **Coordinates are never exposed** in public responses; fuzzing happens at the DTO layer.

The implementation lives in [ListingSearchRepository.java](/apps/api/src/main/java/ma/dari/api/listing/ListingSearchRepository.java) with 6 native SQL methods, and is orchestrated by [ListingSearchService.java](/apps/api/src/main/java/ma/dari/api/listing/ListingSearchService.java). Schema and indexes are in [V3__listings_slice.sql](/apps/api/src/main/resources/db/migration/V3__listings_slice.sql).

### Soft delete, not hard delete

Moderation requires an audit trail (design doc §6), and a conversation is two
people's data — one party cannot unilaterally erase the other's history. The
cost is that **every read path must filter `deleted_at IS NULL`**, and forgetting
one is silent. The view above absorbs most of that risk for listings.

---

## 5. Frontend

Next.js App Router. Server Components fetch and render; client components handle
interaction. The API client is the only door to the backend, so the error
envelope, the bearer token and the base URL — which differs between browser and
server — live in one file.

**Tokens are copied, not imported across the tree.** `src/styles/tokens/` is a
byte-identical copy of `design-system/tokens/`, verified by
`npm run tokens:sync -- --check`. Overrides live in `src/styles/app.css` so
syncing upstream stays a copy and never becomes a merge.

**No Tailwind.** The design system is already a CSS custom-property token system
with a documented component inventory. Tailwind would mean either fighting it or
re-encoding the tokens as theme values, and the second is worse: two sources of
truth for one design system.

**Formatting is centralized** in `lib/format.ts`. Thin-space thousands, decimal
comma, currency after the amount, period stated. These rules get violated one
component at a time when each screen formats its own strings.

---

## 6. Deployment

| | |
| --- | --- |
| Database | Managed Postgres 16 with the PostGIS extension. Pinned minor version — the generated column must behave identically in dev, CI and production. |
| API | One container. Flyway runs on startup. |
| Web | Node server. Static and ISR pages cached at the edge. |
| Photos | S3-compatible bucket, CDN in front. MinIO locally so the production switch is config, not code. |
| Secrets | Environment. The Firebase service-account key is never committed and never baked into an image. |

Horizontal scaling works today with one caveat: scheduled jobs must hold a lock
(ShedLock) or two instances will both expire the same listings and send duplicate
emails. The dependency is present from the start so the expiry job is never
written single-instance-only and retrofitted later.

---

## 7. Testing

Integration tests run against real Postgres with real PostGIS via Testcontainers.
Not H2, not a mock: a generated geography column, a GiST index, keyset pagination
over row-value comparison, partial unique indexes — these either do not exist or
behave differently in memory, so a green suite there would prove nothing about
production.

One container is shared across the suite. Startup dominates runtime, and
per-class containers make the suite slow enough that people stop running it.

Firebase is stubbed. Tests never reach Google, so the suite is offline and
deterministic.

---

## 8. What is real and what is scaffolding

The skeleton commits to the *surface* — every endpoint from design doc §7, every
route the UI kits imply — because that surface is a decision worth reviewing
before anyone builds against it. It does not fake the behavior behind it.

Two conventions make the difference visible rather than something you discover
by clicking:

| | |
| --- | --- |
| `NotImplementedYetException` | The route exists and is mapped; the body arrives in the named phase. Returns **501**, not `200 []` — a stub returning an empty list is a lie the frontend can build against. |
| `<Placeholder phase=… />` | The page exists at its real URL and states which phase fills it in. |

Each use names its phase. When there are none left, the app is complete against
the design doc.

**Fully built:** the auth chain, the error envelope, cursor primitives, UUIDv7,
the `user` feature end to end, PostGIS search with cursor pagination (Phase 02),
the listing lifecycle state machine, and the Testcontainers harness.

**Deliberately absent: entities and repositories for unbuilt features.** An
entity is a claim about the schema, and there is no migration behind it yet.
Writing `Listing.java` now would either constrain phase 02's design decisions or
be quietly wrong about them. Enums are the exception — `ListingStatus`,
`AvailabilityState`, `ReportReason`, `ModerationAction` — because those are
contract, not schema, and the lifecycle rules they encode are already settled.

**Also deliberately absent: the design-system components.** `components/ds/`
holds the porting rules, not fifteen non-working stubs. Those components are
ported from existing sources in phase 03; a placeholder `Button` that renders
nothing would be something to delete, not something to build on.

## 9. What this architecture is not built for

Stated plainly, so nobody discovers it by surprise:

- **Multi-region.** One database, one region. Fine for Morocco.
- **Sub-second search at millions of listings.** PostGIS handles the expected
  scale comfortably. A dedicated search index would be the next step, not a
  rewrite.
- **Realtime anything, today.** Messaging is REST with polling until the
  Firestore decision is settled. The outbox is built now because it is cheap now
  and requires a full backfill to retrofit.
- **Multi-language.** French only. The URL and routing structure chosen in phase
  08 is what makes adding Arabic cheap or expensive later — a real ceiling, since
  a meaningful share of Moroccan search traffic is Arabic.
