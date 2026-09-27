# 01 — Backend foundation

## What this covers, and why it's first

The unglamorous floor everything else stands on: a running Spring Boot app, a Postgres+PostGIS container, migrations, Firebase token verification, the `users` table, and a test harness that can spin up a real database.

It comes first because **phase 02 is a risk spike, and a risk spike is worthless if you can't tell whether a failure is the risk or the scaffolding.** The goal here is to make phase 02's results trustworthy. Nothing in this phase is product-visible, and that is fine — it should be short.

The one non-obvious inclusion is Testcontainers. PostGIS behavior cannot be validated against H2 or an in-memory substitute, and phase 02 is entirely about PostGIS behavior. Getting a real Postgres into the test path now is what makes the next phase measurable.

## Tasks

- [ ] Spring Boot project: web, validation, JPA, Flyway, actuator
- [ ] `docker-compose.yml` — `postgis/postgis` image, named volume, healthcheck
- [ ] Flyway baseline migration: `CREATE EXTENSION postgis`, then the `users` table
- [ ] Config profiles: `local`, `test`, `prod`; no secrets in the repo
- [ ] Firebase Admin SDK wired in; service account loaded from env, not committed
- [ ] `OncePerRequestFilter` that verifies the bearer token, resolves Firebase UID → `users` row, populates the security context
- [ ] Decide and implement the behavior for *valid token, no internal user row* — this is the state every user is in between Firebase signup and `POST /users`
- [ ] Consistent error envelope (`code` + `message`) via `@RestControllerAdvice`, applied to auth failures too
- [ ] `POST /users`, `GET /users/me`, `PATCH /users/me`
- [ ] Role gate for `ADMIN`, unused for now but in place
- [ ] Testcontainers harness with the PostGIS image; one integration test that proves migrations run and a user round-trips
- [ ] Request logging with a correlation id; `/actuator/health` reachable

## Depends on

- Design doc §2 (stack, auth flow), §3 `users`, §7 conventions and the Users endpoints, §8 architecture
- Nothing from the design system — no UI in this phase

## Done looks like

- `docker compose up` then a single run command gives a working API on a fresh machine
- A real Firebase ID token from a test project authenticates; a forged or expired one returns a clean 401 in the standard error envelope
- `POST /users` → `GET /users/me` round-trips the internal profile
- Integration tests run green against a throwaway PostGIS container, in CI as well as locally
- A short `README` section that a new machine can follow start to finish

## Risks and open decisions

- **Token verification latency.** The Admin SDK caches Google's public keys, but the first call per instance fetches them. Confirm this is warmed at startup rather than paid by an unlucky user request.
- **The gap between Firebase signup and `POST /users`.** If a client crashes between the two, the account exists in Firebase with no internal profile and no way to create one on a later login unless the client retries. Decide now: does the filter lazily create the row, or does the client own the retry? This is a real correctness question, not a detail — pick one and write it down.
- **Test Firebase project.** Needed before this phase can be verified. Cheap, but a blocker if left to the last minute.
- **UUID generation strategy** — database-side vs application-side. Trivial to choose now, annoying to change once four tables reference each other.
