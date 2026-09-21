# Dari mobile Phase 5

## Current vertical-slice status

| Slice | Status | Evidence / boundary |
| --- | --- | --- |
| Favorites | Implemented | Auth-gated list, cursor pagination, refresh, offline/error retry, safe rollback after failed removal, and listing-detail synchronization through `/favorites` and `/favorites/ids`. |
| Messaging | Implemented | Inbox pagination, unread badge polling, thread history, mark-read, read-receipt polling, guarded send button, draft-preserving send errors, and deep links for conversations. |
| Search, filters, sort, map | Implemented | Typed native filter sheet, validation, cursor recovery on `INVALID_CURSOR`, cancellation, refresh/empty/offline states, and `react-native-maps` pins sourced only from `/listings/map` fuzzed coordinates. |
| Owner listing/photos | Implemented with API constraints | Native draft/edit form, server validation, unsaved-change guard, camera/library permissions, multipart upload progress, photo cover/delete actions, and submit-to-review. Location is entered by the owner; exact coordinates never enter public DTOs. |
| Profile/account/reporting | Implemented | Profile update/avatar, sign-out, irreversible account deletion confirmation, listing reporting with duplicate-submit protection, and French recovery/error states. |
| Push/deep links/offline | Partial by contract | Permission UX, safe presentation handling, cold/background URL routing, and offline detection exist. Device-token registration and server notification routing are deferred because the API does not expose those contracts. |
| Release readiness | Prepared | EAS development/preview/production profiles, startup config validation, permission rationale strings, and operator checklist exist. No store submission or production credential use was performed. |

## Backend gaps intentionally not invented

- There is no saved-search endpoint or saved-search DTO. The mobile client does not pretend local saved searches are server-synchronized; implement `POST/GET/DELETE /saved-searches` with an owner-scoped contract before adding that UI.
- There is no device-token endpoint, token revocation contract, or push payload/deep-link schema. Add an authenticated idempotent endpoint such as `PUT /users/me/devices/{installationId}` with platform/token metadata, a delete/revoke route, and a documented payload field such as `data.url` before enabling token registration.
- The notification API currently documents transactional email/outbox delivery, not an in-app notification feed. A `/notifications` route should not be added until read/unread and retention semantics are defined.
- Reporting supports `LISTING` and `USER`; it does not support `MESSAGE`. The mobile UI follows the actual contract and reports a listing or participant instead of sending an unsupported message target.

## Release/operator checklist

Before a release operator builds:

1. Copy `.env.example` to `.env`, set the API URL reachable from the selected simulator/device, and set the Firebase web-app configuration. Never commit `.env` or service credentials.
2. Verify Firebase authorized domains / mobile scheme behavior for `dari`, and verify the API accepts the Firebase project’s bearer tokens.
3. Run `npx expo start --clear` and test both the iOS simulator and Android emulator. Test a LAN API URL on a physical device; `localhost` is not the host machine there.
4. Run the accessibility pass: VoiceOver/TalkBack labels and focus order, dynamic text clipping, filter controls, map markers/callouts, photo permissions, form errors, and destructive account deletion.
5. On physical devices, test camera and photo-library denial/recovery, background/foreground notification taps, cold-start listing/conversation links, offline refresh/send behavior, keyboard avoidance, and Android back handling.
6. Run `eas build --profile development`, `eas build --profile preview`, and (after human approval) `eas build --profile production`. Store credentials and signing files remain in EAS/account configuration, not this repository.
7. Prepare store screenshots for Explorer list/filter/map, listing detail, favorites, messages, publish/photos, profile, and the sign-in flow. Confirm privacy declarations for Firebase Auth, API account data, camera/photo library, and notifications.

No physical device, Apple/Google store account, EAS project, or production credential was available to this implementation session; those checks remain operator-owned.
