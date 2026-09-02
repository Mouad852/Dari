# 10 — React Native mobile app

## What this covers, and why it's last

The iOS and Android app, built on the API the web client has already proven.

This ordering is the design doc's own instruction (§2): *"Build web first, then wrap the stabilized API with React Native."* The word doing the work is **stabilized**. Every API mistake found by the web client in phases 03–08 is a mistake not paid for twice, and every endpoint reshaped after mobile ships costs a review cycle in two app stores.

There is a second reason to keep it here. The mobile UI kit is the **most complete design material in the project** — six fully specified screens, more than the web has. That makes starting mobile early tempting. Resist it: the kit will still be there, and it will be built against an API that no longer changes underneath it.

## Tasks

**Foundation**
- [ ] React Native project; decide Expo versus bare React Native early, since it affects native module access later
- [ ] Port the design tokens — the CSS custom properties in `design-system/tokens/` need a React Native equivalent, as RN has no CSS variables
- [ ] Rebuild the 16 components against RN primitives. **These cannot be reused directly**; they are DOM components. The tokens and the visual rules transfer; the implementations do not.
- [ ] Firebase Auth via the React Native SDK
- [ ] Share the API client and types with web where the language allows
- [ ] Navigation matching the kit's tab bar: Explorer / Favoris / Messages / Profil

**Screens, all specified in `ui_kits/mobile_app/`**
- [ ] `AppShell` — top bar, 64px tab bar with unread badge
- [ ] `FeedScreen` — search header, filter chip row, profile-completion prompt, listing feed
- [ ] `FiltersSheet` — native bottom sheet
- [ ] `ListingScreen` — photo header, price block, tabs, sticky contact bar
- [ ] `MessagesScreen` — thread list and conversation
- [ ] `ProfileScreen` — avatar header, settings, account rows
- [ ] Listing creation wizard, from the responsive prototype's 375px specification
- [ ] Auth screens

**Native concerns the web never had**
- [ ] Push notifications — the natural home for the §6 notification set, and a genuine advantage over web
- [ ] Camera and photo library for listing photos, **with the same EXIF stripping as phase 05**
- [ ] Map view with a native map library
- [ ] Offline and poor-connectivity handling, which matters more on mobile in this market than it does on desktop
- [ ] Deep links into listings and conversations
- [ ] App store assets, review submissions, and the privacy declarations both stores require

## Depends on

- **A stable API** — phases 01–09 substantially complete
- Mockups: all six screens in `ui_kits/mobile_app/`, plus the wizard's 375px mode in `flows/listing-creation/Listing Wizard Responsive.dc.html`
- Design system tokens and the component visual specifications
- Design doc §2 mobile rationale

## Done looks like

- Both apps run on device, not just simulator
- Every mockup screen is implemented and matches
- Auth, search, listing creation, messaging and favorites all work against the production API
- Push notifications deliver
- Photos upload from camera and library, stripped of GPS metadata
- Both apps pass store review

## Risks and open decisions

- **Components do not port; only the design does.** The 16 existing components are DOM-based. Budget for a genuine rebuild of the component layer, not a copy.
- **Expo versus bare RN** is the first decision and the hardest to reverse. Expo is faster for a solo developer and constrains native module access; bare is the opposite.
- **Realtime messaging differs on mobile.** If phase 04 chose Firestore, the RN SDK path is well-trodden. If it chose polling, mobile will want push notifications instead — meaning phase 04's decision reaches all the way here.
- **App store review adds latency to every fix**, which is precisely why the API needs to be stable first.
- **Missing photography and logo hurt more here.** Store listings need screenshots, and screenshots full of PHOTO placeholders are not shippable. The asset gap in `design-system/assets/README.md` becomes a launch blocker at this phase, not just an inconvenience.
- **Scope check:** this is a second full client. It is comfortably the largest phase in the plan and could reasonably be its own project.
