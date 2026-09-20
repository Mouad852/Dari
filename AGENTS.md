# Dari

Moroccan colocation marketplace. This is a non-monorepo workspace with three independently managed clients around one API and database:

- `apps/api/` — Java 21 / Spring Boot monolith; owns business rules and persistence.
- `apps/web/` — Next.js App Router product and SEO surface.
- `apps/mobile/` — Expo/React Native client; in progress and intentionally standalone.
- `design-system/` — visual source of truth; `infra/` — Docker, DB bootstrap, Firebase notes, and task runner.

## Architecture constraints

- Backend packages are feature-oriented (`listing`, `user`, `messaging`, `moderation`, `media`, `notification`) with `controller → service → repository`; expose DTOs, never entities.
- Firebase supplies identity; the API verifies bearer tokens and owns authorization. Do not add API login/signup endpoints.
- PostgreSQL 16 + PostGIS is authoritative. Flyway migrations in `apps/api/src/main/resources/db/migration/` own schema; Hibernate stays `ddl-auto: validate`.
- `docker-compose.yml` provides local PostGIS and MinIO only; the API and web dev servers run on the host.
- Public listing search must preserve `PUBLISHED + AVAILABLE + not deleted`, keyset pagination, and fuzzed coordinates. Exact coordinates are owner/admin-only.
- Code, schema, URLs, API identifiers, and enum values are English; user-facing copy is French. Use centralized web formatting/labels.
- Web Server Components fetch/render; client components handle interaction. Route backend calls through `apps/web/src/lib/api.ts`; do not call `fetch` directly from features.
- Web tokens are copied into `apps/web/src/styles/tokens/`; use the token sync/check scripts. Avoid Tailwind.

## Essential commands

Run from the repository root unless noted:

```powershell
Copy-Item .env.example .env
Copy-Item apps/web/.env.local.example apps/web/.env.local
.\infra\scripts\dev.ps1 up       # PostGIS + MinIO
.\infra\scripts\dev.ps1 api      # API on :8080
.\infra\scripts\dev.ps1 web      # Next.js on :3000
.\infra\scripts\dev.ps1 check    # API test-compile + web typecheck + token drift
.\infra\scripts\dev.ps1 test     # full API suite; Docker required
```

Targeted commands:

- API: `cd apps/api; .\mvnw.cmd -Dtest=ClassName#methodName test`; full suite: `.\mvnw.cmd test`.
- Web: `cd apps/web; npm run typecheck`, `npm run lint`, `npm run tokens:check`, `npm run build`.
- Mobile: `cd apps/mobile; npm run typecheck`; start with `npm run start`.

API tests use a shared Testcontainers `postgis/postgis:16-3.4` database, not H2 or the Compose database. Start Docker before the suite. See `.github/workflows/api-tests.yml` for CI and `docs/PRODUCTION_OPERATIONS.md` for deployment/load-test procedures.

Keep exploration targeted, preserve the existing architecture, and run the smallest relevant validation before broader checks. More detailed workflows live in `.agents/skills/`.
