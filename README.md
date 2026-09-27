# Dari

Dari is a Moroccan colocation marketplace. It provides public listing discovery,
account and publishing flows, messaging, moderation, and an in-progress mobile
client.

## Stack

- Spring Boot 3 on Java 21, PostgreSQL 16, and PostGIS
- Next.js App Router for the web product
- Expo and React Native for the mobile client
- Terraform for AWS infrastructure

## Repository layout

```text
apps/
  api/            Spring Boot API and Flyway migrations
  web/            Next.js application
  mobile/         Standalone Expo application
design-system/    Tokens, component references, and prototypes
docs/             Active documentation and historical archive
infra/            Local services, operational scripts, and Terraform
```

## Local development

Prerequisites: Git, Docker Desktop with its Linux engine, JDK 21, Node.js, and
npm. The API also needs a Firebase service-account file; see
[the Firebase setup note](infra/firebase/README.md).

```powershell
Copy-Item .env.example .env
Copy-Item apps/web/.env.local.example apps/web/.env.local
./infra/scripts/dev.ps1 up
./infra/scripts/dev.ps1 api
./infra/scripts/dev.ps1 web
```

The Compose stack starts PostGIS and MinIO only. Run the API and web commands in
separate terminals; they run on the host for hot reload.

## Validation

```powershell
# API compilation and repository-focused checks
cd apps/api
./mvnw -B -ntp -DskipTests compile

# Full API suite; Docker is required for Testcontainers
./mvnw test

# Web checks
cd ../web
npm run typecheck
npm run lint
npm run tokens:check
npm run build

# Mobile checks
cd ../mobile
npm run typecheck
npm test
```

From the repository root, `./infra/scripts/dev.ps1 check` runs API
test-compilation, web typechecking, and token-drift verification. The commands
above are documented from the checked-in scripts; validation results for this
cleanup are reported with its change set.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture](ARCHITECTURE.md)
- [Production operations](docs/operations/production-operations.md)
- [Product design](docs/product/colocation-platform-design.md)
- [Mobile release guide](docs/mobile/mobile-release.md)

## Status

The API and web marketplace are implemented; device validation and store release
work remain for the standalone mobile client. See [TODO.md](TODO.md) for the
current checklist.
