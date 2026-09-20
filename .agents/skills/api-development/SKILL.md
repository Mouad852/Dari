---
name: api-development
description: Develop and test the Dari Spring Boot API when changing endpoints, domain rules, authentication, search, media, jobs, or feature services.
---

Use this skill for work under `apps/api/`.

- Keep code inside the relevant feature package. Follow `controller → service → repository`; use explicit request/response DTOs and keep entities out of JSON responses.
- Preserve Firebase bearer-token identity, method security, the shared French error envelope, soft-delete filters, and the independent listing `status` / `availabilityState` axes.
- Public listing reads must use the searchable published/available invariant, keyset cursors, and fuzzed coordinates. Treat `ListingSearchRepository` and `ListingSearchService` as a coupled query path.
- Put business transactions in services. Keep controllers thin and add regression coverage beside the affected feature.
- Run a focused test first: `cd apps/api; .\mvnw.cmd -Dtest=ClassName#methodName test`. Run `.\mvnw.cmd test` for cross-feature or security changes; Docker must be running because tests use real PostGIS Testcontainers.
- For search performance or index changes, follow `docs/PRODUCTION_OPERATIONS.md` and use `infra/scripts/load-test-search.js` only when the query path warrants it.

Read `ARCHITECTURE.md` for system decisions and `apps/api/src/test/java/ma/dari/api/support/AbstractIntegrationTest.java` before changing the test harness.
