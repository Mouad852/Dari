# Guide — Phase 11: React Native mobile app

Implementation guide for [`11-mobile-react-native.md`](../11-mobile-react-native.md).

**This is the least durable guide in the set.** It describes work against an API that does not exist yet, using library versions that will have moved. Treat the structure and the Dari-specific decisions as the lasting content, and re-check every version and API surface before starting.

Do not start this phase early. The mobile UI kit is the most complete design material in the project — six fully specified screens, more than the web has — which makes starting tempting. The point of waiting is that every API mistake found by the web client in phases 03–09 is one not paid for twice, and once mobile ships, an API change costs a review cycle in two app stores.

---

## 0. Decisions to settle first

**Expo vs bare React Native → Expo, with development builds.** For a solo developer this is not close. Expo handles the iOS and Android build toolchains, over-the-air updates for JS-only fixes (which matters enormously given store review latency), and EAS Build removes the need for a Mac to ship iOS.

The historical objection — no native modules — no longer applies with development builds and config plugins. The remaining real constraint is that a library with no Expo config plugin needs one written, which is occasionally a day's work.

Use **development builds**, not Expo Go. Firebase Auth's native SDK does not run in Expo Go, and you will hit that on day one.

**Realtime strategy → depends on phase 04.** If Firestore was chosen, use `@react-native-firebase/firestore` and the listener path is well-trodden. If messaging is REST-only, **mobile needs push notifications instead** — a background poll is not viable on iOS, and a messaging app without push is not competitive. Note that phase 04's decision reaches all the way here, which is one more argument for making it deliberately.

**Navigation → Expo Router.** File-based, matches the web app's mental model, handles deep links with far less configuration than React Navigation alone.

---

## 1. Setup

```bash
npx create-expo-app@latest dari-mobile --template
cd dari-mobile
npx expo install expo-router expo-image expo-image-picker expo-location \
                 @react-native-firebase/app @react-native-firebase/auth \
                 react-native-maps @shopify/flash-list
```

Monorepo or two repos? **Two repos, one shared package**, published privately or via a workspace. What genuinely shares is the API client, the types, and `format.ts` — not components. Trying to share UI across React and React Native produces a lowest-common-denominator abstraction that serves neither.

```
packages/
  dari-api-client/     API client, generated types, format.ts, domain enums
apps/
  dari-web/
  dari-mobile/
```

`format.ts` from phase 03 ports unchanged — it is pure string manipulation, and the thin-space and decimal-comma rules must be identical across clients or the product reads inconsistently.

---

## 2. Porting the design system

**Tokens transfer. Components do not.** The 16 components in `design-system/components/` are DOM components using CSS custom properties. React Native has neither. Budget a genuine rebuild of the component layer — this is the single most underestimated item in the phase.

### Tokens → a typed theme object

```ts
// theme/tokens.ts — transcribed from design-system/tokens/*.css
export const color = {
  clay500: '#B55535',  clay600: '#A94E2E',  clay50: '#FDF1EC',
  sand400: '#DDA046',
  sable0: '#FFFFFF',   sable50: '#FBF7F2',  sable100: '#F5EFE7',
  sable200: '#E9E1D6',  sable500: '#8C8075', sable600: '#6E635C',
  sable900: '#241F1C',
  atlas500: '#35786A', saffron500: '#C98A16', rose500: '#B33A2B',

  brand: '#B55535',
  bgPage: '#FBF7F2',
  surfaceCard: '#FFFFFF',
  textHeading: '#241F1C',
  textBody: '#332D29',
  textMuted: '#6E635C',
  borderHairline: '#E9E1D6',
} as const;

export const radius = {
  control: 12, image: 14, card: 18, sheet: 24, hero: 32, pill: 999,
} as const;

export const space = { 1:4, 2:6, 3:8, 4:12, 5:16, 6:20, 7:24, 8:32, 9:40, 10:56 } as const;
```

Transcribe from the CSS rather than retyping from memory, and **keep the token names identical to the CSS ones**. When someone changes `--clay-500` on the web, finding its mobile counterpart should be mechanical.

### Shadows do not port

The design system's warm brown-tinted shadows are central to its feel, and React Native has no `box-shadow`. iOS takes `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius`; Android only has `elevation`, which is gray and cannot be tinted.

```ts
export const shadow = {
  sm: Platform.select({
    ios: { shadowColor: '#3A2A20', shadowOffset: {width:0,height:1},
           shadowOpacity: 0.07, shadowRadius: 3 },
    android: { elevation: 2 },
  }),
  md: Platform.select({
    ios: { shadowColor: '#3A2A20', shadowOffset: {width:0,height:4},
           shadowOpacity: 0.08, shadowRadius: 12 },
    android: { elevation: 4 },
  }),
};
```

Accept that Android shadows will be greyer than the brand intends. Fighting it with fake shadow views costs more than it returns.

### Fonts

```ts
useFonts({
  'PlusJakartaSans-Regular':  require('../assets/fonts/PlusJakartaSans-Regular.ttf'),
  'PlusJakartaSans-SemiBold': require('../assets/fonts/PlusJakartaSans-SemiBold.ttf'),
  'PlusJakartaSans-Bold':     require('../assets/fonts/PlusJakartaSans-Bold.ttf'),
  'PlusJakartaSans-ExtraBold':require('../assets/fonts/PlusJakartaSans-ExtraBold.ttf'),
});
```

React Native has no synthetic weights — every weight is a separate file and a separate `fontFamily` string. `fontWeight: '600'` on a font that has no semibold file silently renders regular, which is exactly the kind of bug that ships.

### Components

Rebuild the same 16, with the same names and props, against RN primitives:

```
components/ds/
├── Button.tsx  IconButton.tsx  Badge.tsx  Tag.tsx  Card.tsx  Icon.tsx
├── Input.tsx  Select.tsx  Checkbox.tsx  Radio.tsx  Switch.tsx
├── Tabs.tsx  Dialog.tsx  Toast.tsx  Tooltip.tsx  ListingCard.tsx
```

Keeping the prop contracts identical to the web ports means markup from the kits translates mechanically.

`Icon` uses `lucide-react-native`, with the same registry and the same `name` strings as web.

Press state: the design system specifies `scale(.975)` for 80ms. `Pressable` with a transform, or Reanimated:

```tsx
<Pressable style={({pressed}) => [styles.button, pressed && {transform:[{scale:0.975}]}]}>
```

Honour `prefers-reduced-motion` via `AccessibilityInfo.isReduceMotionEnabled()`.

---

## 3. Screens

All six are specified in `design-system/ui_kits/mobile_app/`. Read each `.jsx` as the source of truth for layout and copy.

| Screen | Source | Notes |
| --- | --- | --- |
| App shell | `AppShell.jsx` | Top bar, 64px tab bar, unread badge |
| Feed | `FeedScreen.jsx` | Search header, filter chips, completion prompt, listing feed |
| Filters | `FiltersSheet.jsx` | Native bottom sheet |
| Listing | `ListingScreen.jsx` | Photo header with glass controls, price block, tabs, sticky contact bar |
| Messages | `MessagesScreen.jsx` | Thread list + conversation |
| Profile | `ProfileScreen.jsx` | Avatar header, settings switches, account rows |
| Wizard | `Listing Wizard Responsive.dc.html`, 375px mode | Eight steps; see below |
| Auth | — | No mockup |

### Tab bar

Explorer / Favoris / Messages / Profil, 64px, unread badge on Messages. Expo Router:

```
app/(tabs)/_layout.tsx
app/(tabs)/index.tsx        Explorer
app/(tabs)/favorites.tsx
app/(tabs)/messages.tsx
app/(tabs)/profil.tsx
app/annonce/[id].tsx        Listing detail (outside tabs)
app/publish/[step].tsx      Wizard
```

### Feed

`FlashList`, not `FlatList` — listing cards with images are exactly the case where the difference is felt on mid-range Android, which is a large share of the Moroccan market.

Cursor pagination maps to `onEndReached`. Reuse the phase 02 cursor contract unchanged.

### Filters sheet

`@gorhom/bottom-sheet`. The design system specifies 420ms rise with `--ease-standard`, radius 24 on the top corners, and `--shadow-sheet` — an upward shadow, which on Android means a top border instead.

### Listing detail

Glass controls over the photo header: `expo-blur` with `intensity` approximating the 12px CSS blur. The rule from the design system holds — **blur only over photography, never over flat cream.**

Sticky contact bar above the safe-area inset. Use `useSafeAreaInsets()`; a contact button under the home indicator is unusable and will pass review anyway.

### The wizard

Eight steps at 375px. The responsive prototype specifies transformations that are not just a narrower grid:

- **Step 3 (rooms):** compact rows, one expanded at a time — not full cards
- **Step 7 (photos):** full-width cover, then a thumbnail strip; tap to promote to cover — not a drag grid

Draft autosave works exactly as on web, against the same endpoint. Server-side drafts (phase 05's decision) pay off here: a listing started on the phone continues on the desktop.

Keyboard handling is the real work. `KeyboardAvoidingView` behaves differently per platform, and the wizard is form-dense. Budget time for it.

---

## 4. Native concerns

### Photos

```tsx
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  quality: 0.85,
  exif: false,          // do not read it — but do not rely on this either
});
```

**Server-side EXIF stripping from phase 05 remains the guarantee.** `exif: false` is a convenience, not a control; the backend re-encodes regardless. Mobile photos are the most likely to carry GPS, and they are taken at the address the fuzzing exists to hide.

### Push notifications

If phase 04 chose REST-only, this is how messaging stays viable. `expo-notifications` plus FCM/APNs; register the token against the user server-side and extend phase 10's `NotificationService` with a push channel.

Push is also the natural home for the §6 moderation notifications, and a genuine advantage over web.

### Maps

`react-native-maps`. **Fuzzed coordinates only**, from the same phase 02 chokepoint — the API already guarantees this, and mobile must not acquire a second path to the data.

`expo-location` for "near me" search. Request permission at the moment of use with a clear explanation, not on launch; both stores penalise the latter and users deny it.

### Offline

Matters more here than on desktop in this market. Cache the feed and thread list, queue outbound messages, show connection state honestly. The copy rule applies: *"Connexion perdue"*, not *"Oups !"*.

### Deep links

`dari.ma/listings/{id}` → the listing screen; conversation links → the thread. Universal Links and App Links need the `apple-app-site-association` and `assetlinks.json` files served from the phase 08 web app, which is a small cross-phase dependency worth remembering.

---

## 5. Store submission

Start this earlier than feels necessary — it is latency, not work.

- Apple Developer and Google Play accounts (Apple's review of a new account can take days)
- Privacy nutrition labels: declare location, photos, contact info, messages. **Match what the code actually does**, including that exact coordinates are stored server-side.
- Screenshots per device class — **and this is where the missing photography becomes a hard blocker.** Store screenshots full of PHOTO placeholders are not shippable. If the client assets are still missing at this point, mobile cannot launch.
- Data deletion route, required by Google Play: phase 09's account deletion satisfies it, but it must be reachable and documented.
- A test account for reviewers, with listings and conversations already populated.

---

## 6. Tests

| Test | Asserts |
| --- | --- |
| Auth flow on device | Signup, login, token refresh, `ensureProfile` |
| Feed scroll, 500 items | No dropped frames on mid-range Android |
| Photo from camera | Uploads; stored file has no GPS |
| Deep link, cold start | Opens the right screen |
| Offline send | Queues, sends on reconnect |
| Push received, app backgrounded | Opens the correct thread |
| Wizard, all 8 steps on device | Draft resumes; keyboard does not obscure inputs |
| Safe areas | Notch and home indicator on iPhone; gesture bar on Android |
| Reduce Motion enabled | Animations suppressed |

Test on a **real mid-range Android device**, not just a simulator. It is the device most of the market actually holds, and it is where performance problems appear.

---

## 7. Done checklist

- [ ] Both apps run on physical devices
- [ ] All six kit screens implemented and matching
- [ ] Wizard works at 375px with the specified mobile transformations
- [ ] Auth, search, listing creation, messaging, favorites work against production
- [ ] Push delivers on both platforms
- [ ] Photos upload from camera and library, stripped of metadata
- [ ] Deep links work from cold start
- [ ] Both apps pass store review

## Scope check

This is a second full client — comfortably the largest phase in the plan, and reasonably its own project. If it needs splitting, ship a read-only app first (search, listing detail, favorites, messages) and add listing creation in a second release. Owners create listings far less often than seekers browse, and they are more willing to use a desktop.
