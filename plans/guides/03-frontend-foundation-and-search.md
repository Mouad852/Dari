# Guide — Phase 03: Frontend foundation + search

Implementation guide for [`03-frontend-foundation-and-search.md`](../03-frontend-foundation-and-search.md).

## Current implementation status

The Next.js shell, design-system tokens, live public listings search, city landing and detail
routes, Firebase email authentication, account profile loading, publish draft submission, and
URL-driven search filters are implemented. Validation has included successful production builds
and TypeScript checks. The remaining frontend work belongs to Phase 07: map rendering and the
remaining filter interaction details.

The first phase that produces something you can click. It also contains the one frontend decision that cannot be cheaply reversed.

---

## 0. Decision: rendering strategy — Next.js (App Router)

The plan flags this as blocking. Here is the recommendation and the reasoning; overrule it if you weigh the trade-off differently.

**Recommendation: Next.js with the App Router**, deployed as a Node server alongside Spring Boot.

Dari's job is to replace Facebook groups for people who google *"colocation rabat agdal"*. Organic search is the primary acquisition channel and the only free one. A client-rendered SPA makes the long-tail content — individual listing pages — the least reliably indexed part of the site, which is exactly backwards.

The honest cost: a second runtime to deploy, monitor and keep patched, for a solo developer. That is a real, permanent operational burden and the strongest argument for the alternative.

| Option | When it is right |
| --- | --- |
| **Next.js SSR/SSG** *(recommended)* | Organic search matters; you accept operating a Node process |
| Vite SPA + prerendered marketing pages | You want one deployable; homepage ranks, listings do not |
| Plain Vite SPA | Search acquisition genuinely does not matter — unlikely here |
| Spring Boot server-rendered listing pages | You refuse a second runtime; you accept templating in Java and duplicated presentation logic |

If you choose Vite instead, everything below still applies except routing and data fetching. Nothing else in this guide depends on the choice.

```bash
npx create-next-app@latest dari-web \
  --typescript --app --eslint --no-tailwind --src-dir --import-alias "@/*"
```

**No Tailwind.** The design system is a CSS custom-property token system with a documented component inventory. Tailwind would mean either fighting it or re-encoding the tokens as Tailwind theme values, and the second is worse: two sources of truth for one design system.

---

## 1. Bringing the design system in

### Tokens: copy, do not import across the tree

```bash
mkdir -p src/styles/tokens
cp ../design-system/tokens/*.css src/styles/tokens/
cp ../design-system/styles.css   src/styles/design-system.css
```

Import once in `app/layout.tsx`. Fonts come from Google Fonts via `next/font` rather than the CDN link in `tokens/fonts.css`, so they are self-hosted and not a third-party request on every page:

```tsx
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'], weight: ['400','500','600','700','800'],
  variable: '--font-ui-loaded', display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'], weight: ['400','500'],
  variable: '--font-mono-loaded', display: 'swap',
});
```

Then override the two family tokens to point at the loaded faces, leaving every other token untouched. Keep `tokens/*.css` byte-identical to `design-system/` so upstream changes remain a straight copy — put overrides in a separate file.

### Components: port them, do not consume the bundle

`design-system/components/**/*.jsx` are the sources. `_ds_bundle.js` is a prototype runtime that resolves components off a global — never ship that.

This is also where the v1-sources / v2-bundle inconsistency from `docs/ANALYSIS.md` gets settled. **Port from the `.jsx` sources**, since they are the only sources that exist, and take one deliberate improvement from the v2 bundle: its `Icon` inlines SVG children instead of using a CSS mask.

```
src/components/ds/
├── Button.tsx  IconButton.tsx  Badge.tsx  Tag.tsx  Card.tsx  Icon.tsx
├── Input.tsx  Select.tsx  Checkbox.tsx  Radio.tsx  Switch.tsx
├── Tabs.tsx
├── Dialog.tsx  Toast.tsx  Tooltip.tsx
└── ListingCard.tsx
```

Porting rules: add TypeScript prop types from the existing `.d.ts` files; keep every `var(--token)` reference exactly as written; do not "improve" spacing or color while porting — the design decisions are already made and a drifting port is worse than no port.

**`Icon` needs rework for SSR.** The v1 source fetches each glyph from a CDN at runtime, which means a network request per icon and nothing rendered server-side. Bundle the ~30 glyphs listed in `design-system/readme.md` instead:

```bash
npm install lucide-react
```

```tsx
import { MapPin, Heart, Star, ShieldCheck, /* ... */ } from 'lucide-react';

const REGISTRY = { 'map-pin': MapPin, heart: Heart, star: Star, /* ... */ } as const;

export function Icon({ name, size = 20, ...rest }: IconProps) {
  const Glyph = REGISTRY[name];
  if (!Glyph) return null;          // words, never a broken glyph — per the icon rules
  return <Glyph size={size} strokeWidth={2} aria-hidden {...rest} />;
}
```

Keep the same `name` strings as the design system so markup ported from the kits works unchanged.

---

## 2. Formatting — build this before any screen

The copy rules are specific and easy to violate one component at a time. Centralize them on day one.

```ts
// src/lib/format.ts
const THIN_SPACE = ' ';

/** 3200 -> "3 200 MAD/mois" — thin-space thousands, currency after, period stated. */
export function rentPerMonth(amount: number): string {
  return `${groupThousands(amount)}${THIN_SPACE}MAD/mois`;
}

/** 3200 -> "3 200 MAD" — no period, for deposits. */
export function mad(amount: number): string {
  return `${groupThousands(amount)}${THIN_SPACE}MAD`;
}

function groupThousands(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
}

/** 4.8 -> "4,8" — decimal comma. */
export function rating(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** French long form: "1er septembre" / "3 septembre". */
export function longDate(d: Date): string { /* ... */ }

/** Listing reference, mono: "DARI-RB-4821". */
export function listingRef(city: string, seq: number): string { /* ... */ }
```

Add a lint rule or a test that fails on a bare `MAD` string in JSX. It sounds fussy; it is the difference between a product that reads as local and one that reads as translated.

Copy rules worth pinning to the wall while building: sentence case everywhere, headings ≤ 7 words, **no emoji anywhere**, **no exclamation marks anywhere**, errors plain and non-blaming (*"Email incomplet"*, never *"Oups !"*), buttons verb-first and specific (*Contacter*, *Voir 32 annonces*, never *Soumettre*).

---

## 3. Auth

```bash
npm install firebase
```

```ts
// src/lib/firebase.ts — client only
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const app = getApps().length ? getApps()[0] : initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
});

export const auth = getAuth(app);
```

These keys are public by design — Firebase web config is not a secret. The service account key from phase 01 is, and must never reach the frontend.

### Honouring phase 01's contract

Phase 01 decided the backend does not auto-create profiles: a valid token with no internal row returns **404 `PROFILE_NOT_FOUND`**. The client owns that retry, and it must be robust, because a user stuck in this state cannot use the product at all.

```ts
export async function ensureProfile(user: FirebaseUser): Promise<UserProfile> {
  try {
    return await api.get<UserProfile>('/users/me');
  } catch (e) {
    if (e instanceof ApiError && e.code === 'PROFILE_NOT_FOUND') {
      // POST /users is idempotent server-side, so a racing double-call is safe.
      return await api.post<UserProfile>('/users', {
        displayName: user.displayName ?? defaultNameFrom(user.email),
      });
    }
    throw e;
  }
}
```

Call this after **every** sign-in and on app boot with a live session — not only immediately after signup. That is what closes the crash-between-steps gap phase 01 identified.

---

## 4. API client

One place that attaches the token, refreshes on 401 exactly once, and parses the error envelope.

```ts
// src/lib/api.ts
export class ApiError extends Error {
  constructor(public status: number, public code: string,
              message: string, public fields?: Record<string,string>) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await auth.currentUser?.getIdToken();

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && retry && auth.currentUser) {
    await auth.currentUser.getIdToken(true);        // force refresh, once
    return request<T>(path, init, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.code ?? 'UNKNOWN',
                       body?.message ?? 'Une erreur est survenue', body?.fields);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
```

`retry = false` on the second attempt is what prevents an infinite refresh loop when the token is genuinely invalid.

### Keep types honest

The plan warns about drift between client types and the backend contract. Generate them:

```bash
# Spring: springdoc-openapi exposes /v3/api-docs
npx openapi-typescript http://localhost:8080/v3/api-docs -o src/lib/api-types.ts
```

Wire it into the build so a backend change that breaks the client fails CI rather than production. Hand-maintained types survive about three phases before quietly lying.

---

## 5. Screens

### Auth — no mockups exist

Signup, login, email verification, password reset. Build from `Input`, `Button`, `Card`. Expect to revisit; this is the first thing every user sees and the least designed.

Error copy in French, plain and non-blaming. Map Firebase error codes explicitly rather than surfacing `auth/invalid-credential` to a human:

```ts
const AUTH_ERRORS: Record<string,string> = {
  'auth/invalid-email':        'Email incomplet',
  'auth/invalid-credential':   'Email ou mot de passe incorrect',
  'auth/email-already-in-use': 'Cet email a déjà un compte',
  'auth/weak-password':        'Mot de passe trop court',
  'auth/network-request-failed':'Connexion perdue',
};
```

### Site chrome

Port from `design-system/ui_kits/website/SiteChrome.jsx`: glass sticky header (72px, `--surface-glass` + `--blur-glass`), type-set wordmark, nav, auth and publish CTAs, charcoal footer.

The wordmark stays plain type — the logo binaries are missing (`design-system/assets/README.md`). Leave a single `<Wordmark />` component so dropping in a real mark later is a one-file change.

### Search results

Port from `SearchResultsPage.jsx`. Breadcrumb, result count, segmented sort, sticky 300px filter rail, 3-up grid, load-more.

Only wire the filters phase 02 actually supports — **city, neighborhood, price**. The rest arrive in phase 07; stubbing them now produces controls that lie.

**Filter state lives in the URL.** With the App Router, `searchParams` makes this natural and gives shareable, refresh-surviving, server-rendered searches for free:

```tsx
// app/listings/page.tsx
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const results = await searchListings(parseFilters(searchParams));   // server-side
  return <SearchResults initial={results} />;
}
```

Cursor pagination maps to load-more, not numbered pages — which is what the mockup already shows.

---

## 6. Quality floor

Non-negotiable, from the global design rules and the design system's own standard:

- Responsive to **360px**; the layout must genuinely reflow, not just avoid breaking
- Visible keyboard focus everywhere — `--focus-ring`, the 3px terracotta ring, never `outline: none` without a replacement
- Text contrast at WCAG AA; verify `--text-muted` and `--text-subtle` on `--bg-page` specifically, since those are the pairs most likely to fail
- `prefers-reduced-motion` respected — the design system's motion is already restrained (no bounce, no parallax), so this is mostly about honouring the query
- No layout shift on load: reserve space for images, use `next/font` (already handled above)
- Semantic HTML: real `<button>`, real `<nav>`, real headings in order

Every image renders the `--sable-200` PHOTO placeholder until the photography gap is closed. **Do not judge visual quality against these screens** — they will look unfinished for reasons that are not your layout's fault.

---

## 7. Done checklist

- [ ] Signup → `POST /users` → session survives a refresh
- [ ] A user who signs up, then has their profile row deleted, self-heals on next boot via `ensureProfile`
- [ ] Search page lists real listings from Postgres, filters and paginates
- [ ] A search URL copied to another browser reproduces the same results
- [ ] Only `PUBLISHED` + `AVAILABLE` listings appear — the phase 02 invariant, verified from outside
- [ ] Expired token refreshes without the user noticing; an invalid one signs them out cleanly
- [ ] Matches the mockup at 1280px, holds at 360px
- [ ] Keyboard-only pass through signup and search
- [ ] **Written down:** the rendering strategy chosen, and why

## Carry into later phases

- `format.ts` — every subsequent screen depends on it
- The API client and generated types
- The ported `ds/` components — phases 05 through 09 assume they exist
- `ensureProfile`, called on every sign-in
- The rendering decision, which phase 08 is entirely built on
