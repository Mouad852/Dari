# Dari — legal and privacy preparation packet

**For review by counsel. This is not legal advice and draws no legal conclusions.** It
describes what the Dari code does today, so that counsel (Law 09-08, CNDP) can decide what the
privacy notice, the terms, the CNDP filing and the retention policy must say. Every statement
cites the file it comes from. Where a fact depends on infrastructure or accounts that do not
exist yet, it says **Cannot verify**.

Written from the repository at the Phase 7 commits (API code as of `ab60f30`). Paths are relative
to the repository root; `api/…` means `apps/api/src/main/java/ma/dari/api/…`, and `db/Vn` means
`apps/api/src/main/resources/db/migration/Vn__*.sql`.

Product terms kept in French: *annonce* (listing), *colocation* (flat share), *propriétaire*
(the member who publishes an annonce), *signalement* (report), *modération*.

---

## 1. Data inventory

Dari has two roles: `USER` and `ADMIN` (`db/V2`, line 3). There is no separate moderator role;
"moderators" below means admins. All tables live in one PostgreSQL 16 + PostGIS database
(planned: AWS RDS, `docs/PRODUCTION_OPERATIONS.md`, "Target architecture").

### 1.1 Tables and columns holding personal data

| Table.column | What it is | Why | Who can see it | Created by |
|---|---|---|---|---|
| `users.id` | Account UUID | Identifies the account | Public (profile URL, conversations) | `db/V2` |
| `users.firebase_uid` | Link to the Firebase Authentication identity | Sign-in | Nobody through the API (not in any DTO) | `db/V2`; `api/user/User.java:35-36` |
| `users.email`, `email_verified` | Email address from the Firebase token, copied once at profile creation | Account, notification emails, ban enforcement | The person (`GET /users/me`, `api/user/dto/UserResponse.java`); admins (`api/moderation/dto/AdminUserResponse.java`) | `db/V2`; `api/user/UserService.java:199-215` |
| `users.phone`, `phone_verified` | Phone number | Reserved; **nothing writes it** (`POST /users/me/phone-verification` is unimplemented, `api/user/UserController.java:105-110`) | The person | `db/V2` |
| `users.first_name` | Private first name | Profile | The person; admins | `db/V2` |
| `users.display_name` | Public name | Profile, conversations | Public | `db/V2` |
| `users.city`, `users.bio` | Self-declared city, free text (≤ 600 chars) | Public profile | Public | `db/V2` |
| `users.avatar_storage_key` (and legacy `avatar_url`) | Key of the profile photo in object storage (`avatars/<userId>/<uuid>.jpg`) | Public profile | Public (the image URL) | `db/V26` |
| `users.role`, `status`, `auto_suspended` | USER/ADMIN; ACTIVE/SUSPENDED/BANNED; suspended by the automatic rule | Moderation | The person sees effects; admins | `db/V2`, `db/V22` |
| `users.created_at` | Sign-up date | Shown publicly as "membre depuis" | Public | `db/V2`; `api/user/dto/PublicProfileResponse.java` |
| `listings.owner_id` | The propriétaire | Ownership | Not in any public DTO; owner and admins | `db/V3` |
| `listings.latitude`, `longitude`, `location` | **Exact position of the home** (`location` is a generated PostGIS point) | Search by distance, owner management, moderation | Owner and admins only; the public sees a fuzzed point (§6.2) | `db/V3` lines 25-32 |
| `listings.title`, `description`, `city`, `neighborhood`, prices, household details, `available_from` | Annonce content, free text | The service | Public while published | `db/V3`, `db/V8` |
| `listings.rejection_reason` | Moderator's free text | Tell the owner why | Owner; admins | `db/V8` |
| `house_rules.other_rules`, `listing_rooms.description` | Free text about the household and rooms | Annonce | Public while published | `db/V12`, `db/V21` |
| `listing_photos.storage_key` | Photo of the home (may show interiors or people); EXIF is stripped by re-encoding | Annonce | Public (image URL) | `db/V11`; `api/media/ImageProcessor.java` |
| `favorites` (`user_id`, `listing_id`) | Which annonces a person saved | Favorites | The person | `db/V13` |
| `conversations` (participants, listing) | Who talks to whom about which annonce | Messaging | The two participants | `db/V10` |
| `messages.body`, `sender_id`, `sent_at`, `read_at` | Message text (≤ 4000 chars) and read receipt | Messaging | The two participants; **not** exposed to admins by any endpoint | `db/V10` |
| `reports.reporter_id`, `target_id`, `reason`, `details` | Who reported what or whom, with free text (≤ 2000 chars) | Moderation | The reporter (`GET /reports/me`); admins see the details and reporter **counts**, not reporter ids (`api/moderation/dto/AdminReportQueueItem.java`) | `db/V9` |
| `banned_identities.email_lower`, `phone`, `user_id` | Email of a banned person | Block re-registration | Nobody through the API | `db/V9`; `api/user/UserService.java:209-210` |
| `admin_actions.admin_id`, `target_id`, `reason` | Moderation log with the admin's free text. `metadata JSONB` exists but is never written (`api/moderation/AdminAction.java`) | Accountability | Nobody through the API | `db/V9` |
| `notification_outbox.recipient_id`, `payload`, `last_error` | Pending and sent emails; the payload is the email body, which may be a moderator's free text. The email address is looked up at send time, not stored | Email delivery | Nobody through the API | `db/V17`, `db/V19` |
| `media_cleanup.storage_key` | Keys of deleted photos and avatars (avatar keys contain the user id) | Guarantee deletion from storage | Nobody through the API | `db/V24`, `db/V27` |

No table stores an IP address or a user agent (searched the migrations and entities; the API never
reads `User-Agent`).

### 1.2 Data outside the database

| Where | What | How long today |
|---|---|---|
| Object storage (S3 behind CloudFront in production) | Listing photos and avatars, re-encoded JPEG | Until deleted (§1.3); CDN and browsers may keep a copy up to `max-age=3600` s after deletion (`apps/api/src/main/resources/application.yml:169`; `docs/PRODUCTION_OPERATIONS.md`, "Storage keys, erasure and cache lifetime") |
| API process memory (rate limiter) | Client IP (IPv6 cut to /64) and Firebase uid as counter keys | Minutes to one hour, swept every 5 minutes; never written to disk or logs (`api/common/ratelimit/RateLimitService.java`, `RateLimitEvictionJob.java`; limits in `application.yml:210-239`) |
| API logs (stdout → CloudWatch Logs in production) | Only the catch-all error handler logs, with the request path (may contain a user or listing UUID) and the full exception, whose message **can contain personal data** (`api/common/error/GlobalExceptionHandler.java:164`). No request bodies, IPs or emails are logged deliberately | CloudWatch log group retention is **not configured anywhere in the repository**: **Cannot verify** |
| Load balancer and CDN logs | IPs, URLs, user agents, if access logging is enabled | Not configured in the repository: **Cannot verify** |
| Sentry (error tracking) | See §2 and §9 | Per the Sentry plan: **Cannot verify** |
| Firebase Authentication | Email, password hash, sign-in metadata | Managed by Google: **Cannot verify** |

### 1.3 How long data is kept today

Nothing ages out automatically. The only four scheduled jobs are:

1. **Listing expiry**, nightly at 02:00 UTC: a published annonce becomes `EXPIRED` 60 days after
   publication, with a warning email 7 days before. It changes a status and **deletes nothing**
   (`api/listing/ListingExpiryJob.java`; `application.yml:191-195`).
2. **Media cleanup**, every 60 s: deletes queued photo and avatar objects from storage; the
   `media_cleanup` rows themselves are kept (`api/media/MediaCleanupService.java`).
3. **Email delivery**, every 30 s; outbox rows are kept after sending
   (`api/notification/NotificationDeliveryService.java`).
4. **Rate-limit sweep**, every 5 minutes, memory only.

**Account deletion** (`DELETE /api/v1/users/me`, `api/user/UserService.java:112-153`), in one
transaction:

- scrubs email, phone, first name, city, bio and avatar, and sets the display name to
  "Utilisateur supprimé" (`UserService.java:169-182`);
- soft-deletes every annonce of the person and queues every photo and the avatar for deletion
  from storage (`UserService.java:115-136`);
- deletes the Firebase identity last; if that fails, everything rolls back and the person can
  retry (`UserService.java:141-151`).

It **keeps**, by design or by omission: `users.firebase_uid` (not updatable,
`api/user/User.java:35`), the user row itself (soft-deleted), the annonces' text and **exact
coordinates** (soft-deleted, not scrubbed), messages and conversations (by design:
`api/user/UserController.java:94-98`, "a conversation is two people's data"), favorites, reports
filed by or about the person, admin actions, outbox rows, `media_cleanup` rows, and any
`banned_identities` row.

**Annonce deletion** (`api/listing/ListingService.java:310-323`): soft delete; photos queued for
deletion; text and exact coordinates kept.

**Ban** (`api/moderation/AdminService.java:402-431`): status BANNED, annonces suspended and
soft-deleted, the email written to `banned_identities`, a ban email sent. **Photos and the avatar
are not queued for deletion**, so in S3 mode they stay reachable at their URLs, and the person's
profile data is not scrubbed.

**Backups** (planned, not provisioned; `docs/PRODUCTION_OPERATIONS.md`, "Database backups"): RDS
automated backups and point-in-time recovery for **35 days**; weekly snapshots kept 12 weeks and
monthly snapshots kept 12 months, copied to a separate AWS account under Vault Lock; logical dumps
before each deploy, retention by lifecycle rule. A deleted or scrubbed record therefore survives
in backups for up to **12 months**. The media bucket is planned to be versioned and replicated
(same section), so a deleted photo may also survive as an old object version: the retention of
those versions is **not decided**.

---

## 2. Processors and international transfers

The AWS region is **not decided**. `docs/PRODUCTION_OPERATIONS.md` ("Production deployment")
suggests `eu-west-3` (Paris) or `eu-south-2` (Spain) "with the business's data-residency
obligations in mind". This is a decision for the owner and counsel.

| Processor | Service | Data it receives | Country |
|---|---|---|---|
| Google (Firebase Authentication) | Sign-in, email verification emails | Email, password (hashed by Firebase), uid, sign-in metadata, the IP of each sign-in request | Google's documentation places Firebase Authentication processing in the United States; not configurable in this project and **not verifiable** from the repository |
| AWS — RDS | Database | Everything in §1.1 | Region undecided |
| AWS — ECS Fargate | Runs the API and the web server | All request data in transit, application logs | Region undecided |
| AWS — S3 | Photo and avatar storage | Images | Region undecided |
| AWS — CloudFront | Serves photos publicly | Images; viewer IPs in its edge logs if enabled | Global edge network (copies cached near viewers worldwide) |
| AWS — SES (SMTP) | Transactional email | Recipient email address and the email body (moderation outcomes, which may quote a moderator's free text) (`api/notification/OutboxNotificationService.java`) | Region undecided (SES endpoint `email-smtp.<region>.amazonaws.com`) |
| AWS — CloudWatch, SSM, AWS Backup | Logs and metrics, secrets, backups | Logs as in §1.2; metrics carry no personal data (five allow-listed meters, `api/config/CloudWatchMetricsConfig.java`); full database backups | Region undecided; backup copies in a second AWS account, same or other region: **not decided** |
| Sentry (Functional Software, Inc.) | Error tracking for API, web and mobile | Scrubbed error events (API: `api/common/error/SentryErrorReporter.java`; web: `apps/web/src/lib/sentry-reporter.ts`; mobile: §9). Optional: only when a DSN is configured | Depends on the data region chosen when the Sentry organisation is created (US or EU): **Cannot verify** |
| OpenStreetMap Foundation (tile servers) | Map tiles on the web search map and the publish location picker | The visitor's IP, user agent, the origin as referrer, and which tiles are viewed. On the publish picker, tiles at zoom 16 around the owner's exact pin reveal the approximate area of the home (`apps/web/src/components/LocationPicker.tsx:114-116`; `apps/web/src/app/listings/SearchResults.tsx:84-86`) | United Kingdom / OSMF infrastructure: **not verified** |
| Google (Maps SDK for Android) | Map on the Android app | Device IP, device and app identifiers used by the SDK, the map viewport (`apps/mobile/app/(tabs)/index.tsx`; key injected in `apps/mobile/app.config.ts`) | Google: **Cannot verify** |
| Apple (MapKit) | Map on the iOS app (no `provider` set, so Apple Maps) | Device IP and map viewport | Apple: **Cannot verify** |
| Expo / EAS (650 Industries) | Builds the mobile binaries | Source code and signing credentials, **no user data**: the app uses neither `expo-updates` nor push notifications (`apps/mobile/package.json`; `docs/MOBILE_RELEASE.md`) | **Cannot verify** |
| GitHub | Source hosting and CI | Source code and synthetic test data only | Not a processor of user data |
| Domain registrar, DNS | Not chosen | — | **Not decided** |

---

## 3. What the legal pages promise vs what the code does

The pages are `apps/web/src/app/legal/privacy/page.tsx`, `terms/page.tsx` and
`location-data/page.tsx`, linked from the web footer (`apps/web/src/components/SiteFooter.tsx`).
The mobile app links the terms and the privacy notice but **not** the location page
(`apps/mobile/src/components/LegalLinks.tsx`).

### 3.1 The eleven `DARI_LEGAL_*` values

Defined in `apps/web/src/lib/legal.ts:19-29`; a production build refuses to start unless each is
non-empty (`apps/web/next.config.mjs:19-32`). There is no format check. **Only three are
displayed on any page**: the entity name, the version and the effective date. The other eight are
required at build time and then never shown.

| Variable | Meaning | Shown on a page? |
|---|---|---|
| `DARI_LEGAL_ENTITY_NAME` | Operator's legal name | Yes, all three pages |
| `DARI_LEGAL_ADDRESS` | Registered address | **No** |
| `DARI_LEGAL_REGISTRATION` | Register / tax ID / ICE | **No** |
| `DARI_LEGAL_CONTACT` | Privacy and support contact | **No** |
| `DARI_LEGAL_JURISDICTION` | Governing law, courts | **No** |
| `DARI_LEGAL_COMPLAINT_AUTHORITY` | Supervisory authority (CNDP) | **No** |
| `DARI_LEGAL_RETENTION` | Retention periods | **No** |
| `DARI_LEGAL_PROCESSORS` | Sub-processors | **No** |
| `DARI_LEGAL_LAWFUL_BASES` | Lawful basis per purpose | **No** |
| `DARI_LEGAL_EFFECTIVE_DATE` | Effective date | Yes (privacy, terms) |
| `DARI_LEGAL_VERSION` | Version | Yes (privacy, terms) |

The pages show « Brouillon de lancement — revue juridique requise avant publication » until all
eleven are set (`legal.ts:30`; privacy page line 11).

### 3.2 Promise by promise

| Promise (French, verbatim) | Where | What the code does | Kept? |
|---|---|---|---|
| « Dari utilise les informations de compte, de profil, d’annonce, de conversation et de signalement nécessaires au fonctionnement du service. » | privacy:15 | Matches §1.1, except that it names no purposes, and the page does not mention error tracking, map tiles or email delivery | Partly: no list of purposes or recipients |
| « Firebase vérifie l’identité de connexion et l’API Dari conserve l’identifiant technique associé. » | privacy:15 | `users.firebase_uid` (§1.1); it is also kept after account deletion (§1.3) | Yes; retention after deletion is not stated |
| « Les surfaces publiques reçoivent une position approximative, jamais la coordonnée stockée. » | privacy:17 | Every public DTO carries a keyed, deterministic offset within 200 m (§6.2). **But** radius search filters and sorts on the exact point and puts an exact distance into the next-page cursor (§6.2) | **Not fully**: the stored coordinate is never returned, but it can be inferred |
| « Cette position précise n’est pas renvoyée dans la recherche publique, les cartes publiques, les pages de détail ou les favoris. » | location-data:13 | True of the returned coordinates (`api/listing/ListingSearchService.java`, `FavoriteService.java:74`) | Yes, for returned values; see the inference gap above |
| « Les visiteurs voient une position volontairement décalée autour du logement. » (no distance given) | location-data:14 | 200 m radius (`application.yml:180`) | Yes; the distance is not disclosed |
| « Les administrateurs autorisés peuvent voir la position nécessaire à la modération. » | location-data:14 | Admins see exact coordinates of annonces **pending review** (`api/moderation/AdminService.java:81-90`) | Yes |
| « conservées aussi longtemps que nécessaire au service, à la sécurité et au traitement des litiges. » | privacy:19 | Everything is kept indefinitely (§1.3) | No period exists to compare against |
| « Certaines traces historiques restent nécessaires après une suppression de compte pour la modération, les notifications et la sécurité. » | privacy:19 | See the "keeps" list in §1.3, which is broader than moderation, notifications and security: exact coordinates and annonce text, favorites, `firebase_uid` | Partly |
| « Pour demander l’accès, la correction ou la suppression de données, utilisez le canal de contact communiqué par l’exploitant. » | privacy:21 | No contact channel is displayed (`DARI_LEGAL_CONTACT` is never rendered); no export endpoint exists | **No channel shown** |
| (Rights to object, restriction, portability; complaint to the CNDP; cookies; minimum age) | — | Not mentioned on any page | Not promised |
| « Un signalement peut être examiné par la modération. Les décisions peuvent retirer une annonce, limiter un compte ou le suspendre… » | terms:22 | Admin actions exist; **and** an automatic suspension happens with no human (§6.1), which the terms do not describe | Partly |
| « Il est interdit … de contourner une suspension. » | terms:20 | Suspended accounts are read-only (`api/common/auth/FirebaseAuthFilter.java:87-97`); banned emails cannot re-register (`UserService.java:209-210`) | Yes |

---

## 4. Data subject rights: how a person exercises each today

| Right | In the product | Gap |
|---|---|---|
| Information | The three legal pages | Eight of eleven legal values not displayed (§3.1) |
| Access | The person can see, in the UI, their profile (`GET /users/me`), annonces, conversations, favorites and own reports (`GET /reports/me`) | **No export** of the whole record; `firebase_uid`, admin actions, outbox emails and reports about them are not visible to them; no contact channel for a manual request |
| Rectification | Profile edit (`PATCH /users/me`, `api/user/UserController.java:70`), annonce edit, avatar replace | The email is copied from Firebase once at profile creation and never updated, so an email changed in Firebase stays stale in `users.email` (`api/user/UserService.java:199-215`; no other writer of `setEmail`) |
| Erasure | Account deletion on web (`apps/web/src/app/account/profile/page.tsx:146-152`) and mobile (`apps/mobile/src/components/DeleteAccountModal.tsx`) | Scope limits in §1.3; backups up to 12 months |
| Objection / restriction | None | No marketing processing exists; all emails are transactional moderation or listing notices (`api/notification/OutboxNotificationService.java`) and cannot be turned off |
| Portability | None | No machine-readable export |
| Human review of an automatic decision | An admin can dismiss the reports, which lifts the automatic suspension (`api/moderation/ReportService.java:102-130`) | No appeal path in the product; an auto-suspended **user** is not flagged in the admin queue (`api/moderation/AdminService.java:221-226`) |
| Complaint to the authority | — | `DARI_LEGAL_COMPLAINT_AUTHORITY` not displayed |

---

## 5. Retention proposal (options, not implemented)

For counsel and the owner to choose. Each option notes what it would take in code.

| Category | Options | What it would take |
|---|---|---|
| Deleted accounts (`users` row, `firebase_uid`) | (a) keep the scrubbed row indefinitely (today); (b) null `firebase_uid` at deletion; (c) hard-delete N days after deletion | (b) a migration dropping `updatable=false` and one line in `scrubPii`; (c) a nightly ShedLock job like `ListingExpiryJob`, plus foreign-key decisions for messages, reports and admin actions that reference the user |
| Annonces after deletion or expiry | (a) keep (today); (b) scrub text and round or null coordinates at deletion; (c) hard-delete N days after deletion or expiry | (b) a few lines in `UserService.deleteAccount` and `ListingService` plus a backfill migration; (c) a nightly job; conversations reference annonces, so decide cascade vs null |
| Messages | (a) keep indefinitely (today, documented reasoning in `UserController.java:94-98`); (b) delete conversations N months after the last message; (c) delete N months after both parties deleted their accounts | A nightly job on `messages.sent_at` / `conversations`; no schema change for (b) |
| Reports and reporter identity | (a) keep (today); (b) anonymise `reporter_id` and `details` N months after resolution | A nightly job; `reviewed_at` already exists (`db/V9`) |
| Admin actions | (a) keep (today); (b) keep N years as an accountability log | A nightly job on `created_at` |
| Banned identities | (a) keep indefinitely (today); (b) N years | A nightly job; shortening it lets a banned person re-register sooner |
| Notification outbox | (a) keep (today); (b) delete `SENT` rows after N days, `DEAD` rows after investigation | A nightly job; the alert on DEAD rows (`docs/PRODUCTION_OPERATIONS.md`, alert 4) must still see them first |
| Media cleanup rows | (a) keep (today); (b) delete `DELETED` rows after N days | A nightly job; `DEAD` rows are an alert signal and must stay until handled |
| Banned users' photos | (a) stay reachable (today); (b) queue them for deletion at ban time like account deletion does | A few lines in `AdminService.banUser` |
| Backups | 35 days RDS, 12 weeks weekly, 12 months monthly (planned policy) | AWS configuration only; shortening is a policy decision with a recovery trade-off |
| Logs | Not set | A CloudWatch log group retention setting (AWS console or CLI) |

---

## 6. Automated decisions and safety features

### 6.1 Automatic suspension after three reporters

`api/moderation/ReportService.java:53-62`: on every new signalement, the service counts the
**distinct reporters** with pending reports on the same target in the last **7 days**
(`api/moderation/ReportRepository.java:66-71`). At **3 or more**:

- an annonce is suspended and flagged (`auto_flagged`), its prior status saved; **the owner is
  not notified** (`ReportService.java:169-179`);
- a user is suspended (`auto_suspended`), becomes read-only (all writes refused,
  `api/common/auth/FirebaseAuthFilter.java:87-97`), and receives an email « Votre compte a été
  suspendu à la suite de plusieurs signalements » (`ReportService.java:182-190`). Their public
  profile stays visible.

No human is involved before the suspension. **No `admin_actions` row is written** for it. Admins
see the reports in the queue, where auto-flagged annonces sort first, but an auto-suspended
**user** is never marked as flagged (`AdminService.java:197-198, 221-226`). Dismissing the reports
lifts the suspension; the annonce owner is then emailed, the user is not
(`ReportService.java:102-130`). Reports are limited to 5 per hour per account and per IP
(`application.yml:215-217`).

### 6.2 Location fuzzing

`api/listing/LocationFuzzer.java:30-41`: HMAC-SHA256 of the annonce id under a secret
(`DARI_LOCATION_FUZZ_SECRET`, at least 32 characters in production,
`api/config/ProductionConfigValidator.java:70-72`) gives an angle and a distance uniform over a
**200 m** disc (`application.yml:180`). The offset is the same on every request, so averaging
repeated requests does not help. Public search, map, detail, featured and favorites all return
the fuzzed point; only the owner's own views and the admin review queue return the exact one
(`api/listing/dto/ListingResponse.java`). The unkeyed version (audit P0-1) was replaced on 2026-09-21 (commit `2037102`);
`infra/prod-smoke/rehearsal-check.sh` replays that old attack against production.

**Inference gap, found while preparing this packet:** radius search filters and sorts on the
**exact** point (`api/listing/ListingSearchRepository.java:163-191`), accepts any radius above
0 m (`api/listing/ListingSearchValidation.java:33`), and when a page is full the next-page cursor
carries `lastDistance`, the exact distance in metres from the searcher's chosen point to the 20th
annonce (`api/listing/ListingSearchService.java:184-191`); the cursor is readable Base64 JSON.
`/listings/count` and `/listings/map` apply the same exact-point radius filter. An anonymous
caller can therefore test "is this annonce within R metres of point P" repeatedly and narrow down
the exact position, which the fuzzing is meant to prevent. This is an engineering defect to fix
before launch, reported to the owner; it is listed here because the privacy notice promises
approximate positions.

### 6.3 Moderation

Admins approve or reject annonces, dismiss reports, warn, suspend, unsuspend and ban users
(`api/moderation/AdminService.java`, `AdminController.java`). Every admin action writes an
`admin_actions` row with the admin's id and free-text reason. Rejection and warning reasons are
emailed verbatim to the person (`api/notification/OutboxNotificationService.java`). The moderator
runbook is `docs/MODERATOR_RUNBOOK.md`.

---

## 7. Client-side storage (web and mobile)

| Client | Storage | What | Essential? (for counsel) |
|---|---|---|---|
| Web | Cookies | **None set by Dari's code** (no `document.cookie`, no `Set-Cookie`, no middleware). API authentication is a bearer token header (`apps/web/src/lib/api.ts:219-222`) | — |
| Web | IndexedDB `firebaseLocalStorageDb` | Firebase session (default persistence, `apps/web/src/lib/firebase.ts:84-100`) | Needed to stay signed in |
| Web | localStorage `dari.pending-profile.v1` | Display name, first name, city typed during sign-up, until the profile is created; left behind if creation fails (`apps/web/src/lib/profile.ts:15-34, 69`) | Needed to finish sign-up |
| Web | Sentry (optional) | Loaded lazily in production only when a DSN is set; no cookies, no replay, no tracing, no breadcrumbs, `sendDefaultPii: false`, events rebuilt from an allow-list (`apps/web/src/lib/reporting.ts:27-45`, `sentry-reporter.ts:28-93`) | Question for counsel |
| Web | Map tiles | Requests to `*.tile.openstreetmap.org` (see §2) | Question for counsel |
| Web | Fonts, analytics | Fonts are self-hosted at build (`apps/web/src/app/layout.tsx`); **no analytics** of any kind | — |
| Mobile | AsyncStorage (Firebase key) | Firebase session (`apps/mobile/src/lib/firebase.ts:58-66`) | Needed to stay signed in |
| Mobile | AsyncStorage `dari:public-search:<params>` | Cached first page of public search results, public data only; never cleared on sign-out (`apps/mobile/app/(tabs)/index.tsx:44-62`) | Offline convenience |
| Mobile | Sentry native SDK files | An installation id generated by the SDK and stored in the app's files (§9) | Question for counsel |

---

## 8. Open questions for counsel and the CNDP

One per line; each with the code fact that raises it.

1. Does Dari's processing require a CNDP declaration or authorisation, and under which lawful basis per purpose? — `DARI_LEGAL_LAWFUL_BASES` is free text and is not displayed (§3.1).
2. What does Law 09-08 require for transfers to Google (Firebase Authentication, likely US), AWS (region undecided), Sentry (region undecided) and the OpenStreetMap tile servers? — §2.
3. Should the AWS region be in a particular jurisdiction? — `docs/PRODUCTION_OPERATIONS.md` leaves it open (§2).
4. Must the eight legal values that are required but not displayed (contact, address, registration, jurisdiction, authority, retention, processors, lawful bases) appear on the pages? — `apps/web/src/lib/legal.ts` vs the page files (§3.1).
5. Is keeping message bodies after one party deletes their account defensible, and for how long? — `api/user/UserController.java:94-98`.
6. Is keeping reporter identity and report text indefinitely defensible, and for how long? — `reports` has no expiry (§1.3).
7. Must a data export (right of access, portability) exist at launch? — no export endpoint (§4).
8. What retention periods apply to each category in §5, and to the 12-month monthly backups? — nothing ages out today (§1.3).
9. Must the fuzzing and its 200 m radius be disclosed, and is 200 m adequate? — `application.yml:180`; the location page gives no distance.
10. Is the three-reporter automatic suspension an automated decision requiring notice, an explanation and a human-review path? — `ReportService.java:53-62`; no admin action row, no notice to annonce owners (§6.1).
11. Must the terms describe the automatic suspension? — terms:22 mentions only human moderation.
12. Is keeping `firebase_uid`, exact coordinates and annonce text after account deletion acceptable? — `UserService.java:112-182` (§1.3).
13. After a ban, the person's photos stay reachable and their data is not scrubbed: acceptable, and for how long? — `AdminService.java:402-431`.
14. Does the SDK-generated installation id and device data in native mobile crash reports need disclosure or consent? — §9.
15. Do map tiles from OpenStreetMap (web) and Google/Apple (mobile), and the optional error tracking, need consent or only disclosure? — §7; no cookie banner exists and Dari sets no cookies.
16. Is a minimum age required, and must it be checked? — no age field or check anywhere in the schema (§1.1).
17. Must the location page be linked from the mobile app too? — `apps/mobile/src/components/LegalLinks.tsx` links only terms and privacy.
18. Do application logs that may contain exception messages with personal data need a retention period? — `GlobalExceptionHandler.java:164`; no log retention configured (§1.2).

---

## 9. Disclosure item: native crash reports on mobile

The mobile app initialises Sentry React Native 7.11 only when `EXPO_PUBLIC_SENTRY_DSN` is set
(`apps/mobile/src/lib/reporting.ts:19-39`). Options set: `sendDefaultPii: false`,
`maxBreadcrumbs: 0`, `beforeBreadcrumb` drops every breadcrumb, `enableAutoSessionTracking:
false`, `beforeSend: scrub`. Dari never calls `setUser`. Native crash capture stays on (the SDK
default), because a native crash is otherwise invisible.

**JavaScript events** pass through `scrub()` (`apps/mobile/src/lib/reportScrub.ts:20-57`), which
rebuilds them from an allow-list: event id, timestamp, platform, level, release, dist,
environment, SDK name, the tags `kind`, `route`, `correlation_id`, the OS name and version, and
exception types with stack frames. No user, no device, no messages.

**Native crash, ANR and app-hang events** are built by the native SDKs (sentry-android 8.31.0,
pinned in `node_modules/@sentry/react-native/android/build.gradle`; sentry-cocoa 8.58.0, pinned in
`RNSentry.podspec`) and **do not pass through `scrub()`**. The React Native SDK's native
`beforeSend` only adds an origin tag and the SDK package list
(`@sentry/react-native/android/src/main/java/io/sentry/react/RNSentryModuleImpl.java:362-367`).
From the upstream sources at those versions:

- **User id = an installation id.** When no user is set, which is always the case in Dari, both
  SDKs set `user.id` to a random id generated on first launch and stored in the app's files
  (sentry-android `DefaultAndroidEventProcessor.mergeUser`; sentry-cocoa
  `SentryClient setUserIdIfNoUserSet`). It identifies the installation, not the person, and is
  reset by reinstalling. Android also uses it as `device.id` (`DeviceInfoUtil.getDeviceId`).
- **No IP address is set by the SDK**, because `sendDefaultPii` is false (sentry-android
  `mergeUser` sets it only when true). Whether Sentry's servers store the sender's IP depends on
  the Sentry project's "Prevent storing of IP addresses" setting: **Cannot verify** until the
  account exists.
- **Device and OS context**: manufacturer, brand, model, architecture, memory and storage
  figures, screen size and density, battery level and charging state, orientation, locale,
  timezone, whether the device is rooted or an emulator, boot time, connection type; OS name,
  version, build and kernel version (sentry-android `DeviceInfoUtil`).
- **App context**: app identifier, version, build, start time, in-foreground flag.
- **The crash itself**: exception type and message and native stack frames. A native exception
  message can contain whatever the crashing code put in it.
- **No screenshots and no view hierarchy** (`attachScreenshot` and `attachViewHierarchy` are off
  by default and Dari does not enable them); **no breadcrumbs** (`maxBreadcrumbs: 0` is passed to
  the native SDK, `RNSentryModuleImpl.java:263-264`).

None of this has been observed on a real device: the mobile app has not yet been built or run on
hardware (`docs/MOBILE_RELEASE.md`, "Not verified").
