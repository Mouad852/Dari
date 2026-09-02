# Firebase

Dari does not implement signup or login. The client authenticates against
Firebase Authentication directly; the backend only *verifies* the resulting ID
token. There are deliberately no `/auth/login` or `/auth/signup` endpoints.

## Service account (backend)

1. Firebase console -> Project settings -> Service accounts -> Generate new private key.
2. Save it as `infra/firebase/service-account.json`.
3. Set `FIREBASE_CREDENTIALS_PATH` in `.env`.

`.gitignore` already excludes `*serviceAccount*.json` and `firebase-admin*.json`.
**Do not rename the file into something that slips past those patterns.**

## Web client config

Public config only (API key, auth domain, project id) — these are not secrets,
they identify the project. See `apps/web/.env.local.example`.

## Firestore

Undecided. Phase 04 recommends REST-only messaging first, with the transactional
outbox built now so the mirror stays cheap to add later. If the mirror is
adopted, security rules belong here as `firestore.rules` — read-only for
participants, no client writes, Postgres stays authoritative.
