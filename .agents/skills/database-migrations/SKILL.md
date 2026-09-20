---
name: database-migrations
description: Change Dari PostgreSQL/PostGIS schema, indexes, views, or persistence mappings with Flyway-safe rollout and verification.
---

Use this skill when a change affects tables, enums, views, indexes, generated spatial columns, or JPA mappings.

- Add a new numbered migration under `apps/api/src/main/resources/db/migration/`; never edit an applied migration or use Hibernate schema generation.
- Keep migrations forward-only and backward-compatible for at least one release: expand, deploy compatible code, backfill/switch, then contract later. Use `TIMESTAMPTZ`, UUID application IDs, and PostGIS types consistently with existing migrations.
- Preserve partial searchable indexes and the `PUBLISHED + AVAILABLE + deleted_at IS NULL` public-search invariant. Check query plans when changing listing search indexes or native SQL.
- Update the matching entity/repository/DTO only when the schema contract requires it; do not invent persistence for unfinished product phases.
- Verify with `cd apps/api; .\mvnw.cmd test`; Flyway runs against real `postgis/postgis:16-3.4` in the integration suite. Prefer the relevant API test class for iteration.

Use `ARCHITECTURE.md`, the existing migration sequence, and `docs/PRODUCTION_OPERATIONS.md` for rollout/rollback constraints.
