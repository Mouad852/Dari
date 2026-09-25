# Dari mobile — release preparation

The owner's guide to getting `apps/mobile` from this repository onto the Play
Store and the App Store. It records what the repository already does, what has
not been checked, and the account-bound steps (the **MANUAL** list) in the order
they have to happen. Last updated 2026-09-23 (production-readiness Phase 6).

**No binary has been built from this repository yet.** Nothing below has run on
a phone, on EAS, or against production Firebase. The development machine used so
far has no Android SDK, no emulator, no Xcode and no EAS login.

## What the repository does now

| Area | State | Where |
| --- | --- | --- |
| Build configuration | `app.config.ts` extends `app.json`. A **production** build (`APP_VARIANT=production`, set by the `production` profile in `eas.json`, or `EAS_BUILD_PROFILE=production`) stops at config evaluation and names every missing or invalid variable, never its value. | `apps/mobile/app.config.ts`, `__tests__/app-config.test.ts` |
| EAS profiles | Each profile selects its EAS environment (`development`, `preview`, `production`) and sets `APP_VARIANT`. Versions are managed by EAS (`cli.appVersionSource: "remote"`), and the production profile auto-increments `versionCode`/`buildNumber`. | `apps/mobile/eas.json` |
| API URL | No fallback in a release build. A development build defaults to `http://localhost:8080/api/v1` only when `__DEV__`. Runtime configuration is read with static `process.env.EXPO_PUBLIC_…` reads, the only form Expo inlines. | `src/lib/config.ts` |
| Google Maps (Android) | `GOOGLE_MAPS_ANDROID_API_KEY` (not `EXPO_PUBLIC_`) is written to `android.config.googleMaps.apiKey`, which prebuild turns into the `com.google.android.geo.API_KEY` manifest entry. | `app.config.ts` |
| Splash | `expo-splash-screen` config plugin with `assets/splash-icon.png` on `#FBF7F2` (`color.bgPage`). | `app.json` |
| Permissions | Notification permission, `expo-notifications` and `expo-device` removed (there is no push). The image picker no longer adds the microphone. | `app.json`, `package.json` |
| Crash reporting | `@sentry/react-native` 7.11, started only when `EXPO_PUBLIC_SENTRY_DSN` is set. Every JavaScript event is rebuilt from an allow-list (no user, request, headers, breadcrumbs, messages or extra data); native crash, ANR and app-hang events are not (see below). Source-map upload is off on EAS (`SENTRY_DISABLE_AUTO_UPLOAD=true` in every profile); a local release build (`npx expo run:android --variant release`) needs the same variable set in its shell, or its Sentry step tries to upload. | `src/lib/reporting.ts`, `src/lib/reportScrub.ts` |
| Runtime safety | Root `ErrorBoundary` with a French retry screen. 15 s request deadline (60 s for uploads), typed timeout / offline / network errors with the web's French copy, and one shared token refresh and one replay on a 401, then sign-out. | `app/_layout.tsx`, `src/lib/api.ts` |
| Store requirements | Terms and privacy links (web `/legal/terms`, `/legal/privacy`) on the profile tab and the sign-up screen. Account deletion asks for the typed word `SUPPRIMER` in the same dialog on iOS and Android. | `src/components/LegalLinks.tsx`, `src/components/DeleteAccountModal.tsx` |
| Deep links | `dari://listings/{id}` (and `listing/{id}`), `dari://messages/{id}` (and `conversation/{id}`), `dari://profile-recovery` → the profile-recovery screen, rewritten in `app/+native-intent.tsx` before expo-router matches the URL. | `src/lib/deepLinks.ts`, `app/+native-intent.tsx` |
| Tests | `npm test` (jest-expo): build gate, API client, message merge, deep links, Sentry scrubber. CI runs it next to `npm run typecheck`. | `.github/workflows/client-quality.yml` |

## Not verified

- Any build on EAS, any install, and any behaviour on a real phone: the map, camera, photo library, keyboard handling, the splash screen, the error boundary, the deletion dialog, deep links from a cold start, the 5 s thread poll in the foreground and its pause in the background.
- Sign-in against a real Firebase project from a native build.
- Sentry delivery from a device, including native crashes. Native crash events are sent by the native SDK and do **not** pass through the JavaScript scrubber (see the declarations below).
- Expo Go: the Sentry SDK falls back to JavaScript-only capture when its native module is missing, so the app should still start there. This comes from reading the SDK source, not from a run.
- The final **merged** Android manifest. Only prebuild's app manifest was read, plus each native library's own manifest; the Gradle merge needs the Android SDK.
- The iOS project. Prebuild will not generate `ios/` on Windows; the Info.plist and entitlements below come from `npx expo config --type introspect`.

## MANUAL — owner steps, in order

Values never go into a committed file. Everything account-bound is done by the owner.

1. **Expo account.** `npx eas-cli@latest login`, then in `apps/mobile`: `npx eas-cli@latest init`. It writes `extra.eas.projectId` (and `owner`) into `app.json`; commit that.
2. **EAS environment variables**, one set per environment that builds: `production` (store builds) and `preview` (internal builds); `development` only for dev-client builds. Use `eas env:set --environment <env> --name <NAME> --visibility <v>` and enter the value when prompted.

   | Name | Visibility | Notes |
   | --- | --- | --- |
   | `EXPO_PUBLIC_API_BASE_URL` | plaintext | `https://…/api/v1` (the gate enforces both) |
   | `EXPO_PUBLIC_FIREBASE_API_KEY` | plaintext | Firebase web config, public by design |
   | `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | plaintext | |
   | `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | plaintext | |
   | `EXPO_PUBLIC_SITE_URL` | plaintext | `https://` origin of the web app (legal links) |
   | `EXPO_PUBLIC_RELEASE_VERSION` | plaintext | release tag in error reports; change it per release |
   | `GOOGLE_MAPS_ANDROID_API_KEY` | **sensitive**, not secret | `eas build` evaluates `app.config.ts` on your machine, where secret variables are not readable, so a secret key would fail the gate. The key ends up inside the APK anyway; its protection is the restriction in step 3. |
   | `EXPO_PUBLIC_SENTRY_DSN` | plaintext | optional; without it reporting stays off |

3. **Google Maps key.** In a Google Cloud project of its own (so a leaked key cannot touch anything else): enable *Maps SDK for Android*, create an API key, restrict it to *Android apps* with package `ma.dari.app` and the SHA-1 fingerprints of (a) the EAS keystore (`npx eas-cli@latest credentials -p android`) and (b) Google Play's app-signing key (Play Console → App integrity, once the app exists). Restrict the API list to *Maps SDK for Android*. Store it as `GOOGLE_MAPS_ANDROID_API_KEY` (step 2). The iOS app uses Apple Maps; no key is needed there.
4. **Sentry.** Create project `dari-mobile` (platform React Native) and set its DSN as `EXPO_PUBLIC_SENTRY_DSN`. Readable stack traces need source maps: add `SENTRY_AUTH_TOKEN` (**secret**) and `SENTRY_ORG` (plaintext) to the EAS environment, then remove `SENTRY_DISABLE_AUTO_UPLOAD` from the profiles in `eas.json`. The project slug is already in `app.json`.
5. **Apple.** Apple Developer Program membership; an App Store Connect app record for bundle id `ma.dari.app`. Add to `eas.json` → `submit.production.ios`: `ascAppId` (the numeric Apple ID of the app record) and `appleTeamId`. Let EAS create the distribution certificate and provisioning profile on the first build.
6. **Google Play.** A developer account; an app with package `ma.dari.app`; a Google Cloud service account with release permissions in Play Console. Keep its JSON key out of the repository: either upload it through `npx eas-cli@latest credentials -p android` (preferred) or keep it outside the repo and set `submit.production.android.serviceAccountKeyPath` to that path. `track` defaults to `internal`. The very first upload to Play has to be done by hand in Play Console.
7. **First builds.** `npx eas-cli@latest build --profile production --platform android`, then `npx eas-cli@latest submit --profile production --platform android --latest` (internal testing track). `npx eas-cli@latest build --profile production --platform ios`, then `npx eas-cli@latest submit --profile production --platform ios --latest` (TestFlight). `--profile preview` makes internal-distribution builds for testers outside the stores.
8. **Real-device matrix** (next section) on at least two Android phones (one low-end, one recent) and one iPhone.
9. **Store forms**: Play Data safety, App Store App Privacy, content rating, privacy policy URL (`EXPO_PUBLIC_SITE_URL` + `/legal/privacy`). Draft answers are below; they follow what the code does, and counsel should confirm them with the privacy notice (Phase 7).

## Real-device matrix (audit section L)

Record the device, OS version and build number for each run.

- [ ] Sign up; the email-verification gate
- [ ] Profile: edit, avatar from the photo library
- [ ] Explorer list; filters; sort
- [ ] **Map on Android** (tiles load, pins shown), and on iOS
- [ ] Open a listing; favourite and unfavourite
- [ ] Start a conversation; send; receive a reply while the thread is open (within about 5 s); receive one while the app is in the background, then return
- [ ] Load older messages in a long thread; the view stays put
- [ ] Publish a listing with camera and library photos; set the cover; delete a photo; submit for moderation
- [ ] Report a listing
- [ ] Privacy and terms links open the web pages
- [ ] Delete the account: the dialog needs `SUPPRIMER` on both platforms, then the app is signed out
- [ ] Kill and relaunch: the session persists
- [ ] Airplane mode on every screen, then reconnect (French offline message, retry works)
- [ ] Slow or lossy network (a request gives up after 15 s with "La requête a dépassé son délai")
- [ ] Deep link from a cold start: `dari://listings/<id>`, `dari://messages/<id>`
- [ ] With a DSN set: a forced crash appears in Sentry, tagged with the release, with no email, token or message text in it
- [ ] TalkBack and VoiceOver on sign-in, filters, the thread, and the deletion dialog

## Store declarations (drafts)

Derived from prebuild's app manifest, the native libraries' manifests, the
introspected iOS config and the code. **Not legal advice.**

### Android permissions

From prebuild (production configuration) plus the autolinked libraries' manifests:

| Permission | Source | Why |
| --- | --- | --- |
| `INTERNET` | app, expo-file-system | the API, Firebase, map tiles |
| `CAMERA` | expo-image-picker | listing photos taken in the app |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` (max SDK 32) | expo-image-picker, expo-file-system | photo library on Android 12 and older |
| `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE` | @react-native-community/netinfo | offline detection |
| `VIBRATE`, `SYSTEM_ALERT_WINDOW` | *removed* (`android.blockedPermissions` in `app.json`, which prebuild writes as `tools:node="remove"`) | Expo's app template adds both. Nothing uses them: no autolinked module's Android sources touch the vibrator, and the exported JS bundle's only `vibrate` is React Native's unused `Vibration` module. `SYSTEM_ALERT_WINDOW` serves React Native's dev tooling, and the template's debug-only manifest still declares it, so only release builds lose it. Checked on the prebuild output; the Gradle-merged manifest was not built here |
| `RECORD_AUDIO` | *removed* (`tools:node="remove"`) | no video or audio capture |

Removed in Phase 6 with `expo-notifications`: `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS` (from that library's manifest). No location permission is requested; the manifest has no `usesCleartextTraffic` (only the template's debug manifest allows it).

### iOS

Info.plist usage strings: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` (French). No microphone string (the image picker's English default is gone), no `NSUserNotificationUsageDescription` (not a real iOS key), no entitlements (the `aps-environment` push entitlement came from `expo-notifications`). No tracking, so no App Tracking Transparency prompt.

### What the app collects

| Data | Collected for | Linked to the account | Notes |
| --- | --- | --- | --- |
| Email address | account (Firebase Authentication) | yes | |
| Name, first name, city, bio | profile | yes | typed by the user |
| Photos | listing photos, avatar | yes | the API re-encodes every upload, which strips EXIF, GPS included (per its code; §M still asks for a live check) |
| Messages | messaging between users | yes | on account deletion they stay readable by the other participant, shown as "Utilisateur supprimé" |
| Listing content | publishing | yes | includes the coordinates the owner types for the property; public pages show fuzzed coordinates only |
| User ID | authentication | yes | Firebase uid |
| Crash logs, diagnostics | only with `EXPO_PUBLIC_SENTRY_DSN` set | no | JavaScript events: exception type, stack frames, release, OS name and version. Native crash events come from the native SDK unscrubbed; per the pinned SDK sources they carry device and app details and, as `user.id`, a random installation id the SDK generates (no IP, `sendDefaultPii: false`). The full list is `docs/LEGAL_PREP.md` §9; `src/lib/__tests__/reporting.test.ts` pins the options |
| Device location | not collected | — | no location permission |
| Search queries | sent to the API to answer the search | — | not stored per user (there is no saved search) |

- Data is encrypted in transit: the build gate refuses a non-`https` API URL.
- Users can delete their account in the app (Profil → Supprimer définitivement mon compte); the API scrubs the profile's personal data, takes their listings down and queues their photos and avatar for deletion from storage, and removes the Firebase identity (`UserService.deleteAccount`).
- Service providers rather than third-party sharing: Google (Firebase Authentication; Google Maps SDK on Android), Sentry (only if enabled), and the hosting provider. Counsel should confirm how Play and Apple want these declared.

## Development run on a phone (optional)

With the local API running on the machine's LAN address (not `localhost`), set
`EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:<API_PORT>/api/v1` in `apps/mobile/.env`,
run `npx expo start` in `apps/mobile`, and open it in Expo Go on a phone on the
same network. `http://` only works in development: Expo Go and debug builds
allow cleartext; a release build does not, and the gate refuses it. The map on
Android needs a development build with the Maps key; Expo Go uses its own.
