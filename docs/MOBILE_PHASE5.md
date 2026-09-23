# Dari mobile Phase 5

## Current vertical-slice status

| Slice | Status | Evidence / boundary |
| --- | --- | --- |
| Favorites | Implemented | Auth-gated list, cursor pagination, refresh, offline/error retry, safe rollback after failed removal, and listing-detail synchronization through `/favorites` and `/favorites/ids`. |
| Messaging | Implemented | Inbox pagination, unread badge polling, thread history opening on the newest page with older pages above, a 5 s foreground poll for new replies (`after=`) and read receipts, mark-read, guarded send button, draft-preserving send errors, and deep links for conversations. |
| Search, filters, sort, map | Implemented | Typed native filter sheet, validation, cursor recovery on `INVALID_CURSOR`, cancellation, refresh/empty/offline states, and `react-native-maps` pins sourced only from `/listings/map` fuzzed coordinates. |
| Owner listing/photos | Implemented with API constraints | Native draft/edit form, server validation, unsaved-change guard, camera/library permissions, multipart upload progress, photo cover/delete actions, and submit-to-review. Location is entered by the owner; exact coordinates never enter public DTOs. |
| Profile/account/reporting | Implemented | Profile update/avatar, sign-out, irreversible account deletion confirmation, listing reporting with duplicate-submit protection, and French recovery/error states. |
| Deep links/offline | Implemented | `dari://listings/{id}` and `dari://messages/{id}` routing, offline detection, and typed timeout/offline/network errors. Push notifications do not exist: the permission prompt and `expo-notifications` were removed in Phase 6 because the API has no device-token contract. |
| Release readiness | Not built yet | The repository side is in place (production build gate, EAS environments, versioning, splash, crash reporting, legal links); no binary has been built and nothing has run on a device. See [MOBILE_RELEASE.md](MOBILE_RELEASE.md) for the owner steps. |

## Backend gaps intentionally not invented

- There is no saved-search endpoint or saved-search DTO. The mobile client does not pretend local saved searches are server-synchronized; implement `POST/GET/DELETE /saved-searches` with an owner-scoped contract before adding that UI.
- There is no device-token endpoint, token revocation contract, or push payload/deep-link schema. Add an authenticated idempotent endpoint such as `PUT /users/me/devices/{installationId}` with platform/token metadata, a delete/revoke route, and a documented payload field such as `data.url` before enabling token registration.
- The notification API currently documents transactional email/outbox delivery, not an in-app notification feed. A `/notifications` route should not be added until read/unread and retention semantics are defined.
- Reporting supports `LISTING` and `USER`; it does not support `MESSAGE`. The mobile UI follows the actual contract and reports a listing or participant instead of sending an unsupported message target.

## Release/operator checklist

Superseded by [MOBILE_RELEASE.md](MOBILE_RELEASE.md): the account-bound steps in order, the real-device matrix, and draft store declarations. The earlier list here said "Prepared" and told the operator to run `eas build`, which could not work before `eas init`, the EAS environment variables and the Maps key existed.
