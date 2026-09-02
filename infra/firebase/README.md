# Firebase

Dari does not implement signup or login. The client authenticates against
Firebase Authentication directly; the backend only *verifies* the resulting ID
token. There are deliberately no `/auth/login` or `/auth/signup` endpoints.

## Service account (backend)

1. Firebase console -> Project settings -> Service accounts -> Generate new private key.
2. Save it as `infra/firebase/service-account.json`.
3. Set `FIREBASE_CREDENTIALS_PATH` in `.env`.

`.gitignore` ignores this whole directory (`infra/firebase/*`) and allows only
this README back in. That is deliberate: the previous version of this file told
you to save the key as `service-account.json` while claiming the
`*serviceAccount*.json` pattern protected it -- which it does not, because the
hyphenated name never matched. Any JSON in this folder is now treated as a key
regardless of what it is called.

**Rotate the key if it has ever been committed, shared, or copied out of this
folder.** Purging a leaked key from git history is miserable; rotating it in the
console takes a minute.

## Web client config

Public config only (API key, auth domain, project id) — these are not secrets,
they identify the project. See `apps/web/.env.local.example`.

## Firestore

Undecided. Phase 04 recommends REST-only messaging first, with the transactional
outbox built now so the mirror stays cheap to add later. If the mirror is
adopted, security rules belong here as `firestore.rules` — read-only for
participants, no client writes, Postgres stays authoritative.
