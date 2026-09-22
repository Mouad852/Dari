# Web CSP: reproduction and fix evidence (audit P0-10)

Recorded 2026-09-22 on Windows 11, Chromium from `@playwright/test` 1.63,
Next.js 15.5.25. Local evidence only: it says nothing about a deployed host,
a real CDN, or HSTS over real HTTPS (see "Cannot verify" below).

## Setup

`next build` then `next start` (`NODE_ENV=production`,
`NEXT_PUBLIC_E2E_TEST_MODE` unset), against the HTTPS mock API
(`E2E_MOCK_HTTPS=true node e2e/mock-api.mjs`), with deliberately distinct
hosts: `API_BASE_URL=https://api.internal.example.invalid:4443/api/v1`,
`NEXT_PUBLIC_API_BASE_URL=https://api.public.example.invalid:4443/api/v1`,
`NEXT_PUBLIC_MEDIA_ORIGINS=https://media.example.invalid:4443,https://cdn.example.invalid:4443`.
The test-only name resolution and certificate handling are described in
`apps/web/e2e/playwright.config.ts`. Probe: `node e2e/csp-reproduction.mjs`.

## Before: per-request nonce with `'strict-dynamic'` (middleware.ts)

The audit's diagnosis, previously derived only from build artifacts, is
reproduced. Prerendered routes (`x-nextjs-cache: HIT`) never hydrate; the
dynamically rendered listing page does, because its HTML is rendered per
request and receives the nonce.

```
=== /  status=200  x-nextjs-cache=HIT
hydrated (React fibers attached): false
securitypolicyviolation events:   30 (script-src-elem=30)
  - script-src-elem blocked http://127.0.0.1:3111/_next/static/chunks/webpack-ae034a83854ca5b8.js
  - script-src-elem blocked http://127.0.0.1:3111/_next/static/chunks/4bd1b696-f785427dddbba9fb.js
console errors:                   30
  - Loading the script '.../webpack-ae034a83854ca5b8.js' violates the following Content Security
    Policy directive: "script-src 'self' 'nonce-…' 'strict-dynamic'" ...

=== /sign-in  status=200  x-nextjs-cache=HIT
hydrated (React fibers attached): false
client control responds:          false      (password visibility toggle did nothing)
securitypolicyviolation events:   23 (script-src-elem=23)
console errors:                   23

=== /listings/listing-1  status=200  x-nextjs-cache=-
hydrated (React fibers attached): true
securitypolicyviolation events:   0
console errors:                   0
```

## What the audit got wrong

The audit recommended `script-src 'self'` on the grounds that the app has "no
inline scripts other than the JSON-LD block". That is not true of any Next.js
App Router page: the flight data needed for hydration is emitted as inline
`<script>self.__next_f.push(...)</script>` elements (8 on `/sign-in`). With
`script-src 'self'` every route, prerendered and dynamic, failed to hydrate with
`script-src-elem blocked inline` violations (first run of the `production`
Playwright project). Those scripts differ per page and per ISR revalidation, so
a static hash cannot allow them, and a nonce cannot reach cached HTML. The
shipped policy is therefore `script-src 'self' 'unsafe-inline'`: scripts stay
restricted to the site's own origin, the only raw-HTML sink (listing JSON-LD)
escapes `<`, and `object-src`, `base-uri`, `form-action` and `frame-ancestors`
stay locked. A stricter `script-src` requires rendering every route per request
with a nonce, i.e. giving up ISR.

The same browser pass found that every page still fetched
`https://fonts.googleapis.com/css2` and a `fonts.gstatic.com` font through the
design system's `tokens/fonts.css` `@import`, although `next/font` already
self-hosts those faces. `app.css` now imports the token files without it, and
the policy allows no font host.

## After: static policy from next.config.mjs

```
=== /  status=200  x-nextjs-cache=HIT
hydrated (React fibers attached): true
securitypolicyviolation events:   0
console errors:                   0

=== /sign-in  status=200  x-nextjs-cache=HIT
hydrated (React fibers attached): true
client control responds:          true
securitypolicyviolation events:   0
console errors:                   0

=== /listings/listing-1  status=200  x-nextjs-cache=-
hydrated (React fibers attached): true
securitypolicyviolation events:   0
console errors:                   0
```

Response headers on the prerendered `/sign-in`:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob: https://media.example.invalid:4443 https://cdn.example.invalid:4443 https://*.tile.openstreetmap.org; font-src 'self'; connect-src 'self' https://api.public.example.invalid:4443 https://e2e.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com; frame-src 'self' https://e2e.firebaseapp.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

Third-party requests from a page load: none.

## Regression gate

The `production` project in `apps/web/e2e/playwright.config.ts` runs
`next build && next start` in CI (same `npx playwright test` command as the
`dev` project) and fails on any console error or `securitypolicyviolation`.
It covers `/`, `/sign-in`, `/publish` (signed out) and `/listings/listing-1`,
checks hydration, decoded images from both media origins, identical security
headers on prerendered, dynamic and prefetch responses, that the CSP allows
exactly the origins the media resolver renders, that no served response or
built static/prerendered file contains the internal API host or the SSR key,
and that server renders carry the SSR key (once per listing render) while
browser calls do not.

## Cannot verify locally

Real browsers against a deployed host, HSTS behaviour over real HTTPS (browsers
ignore the header on `http://127.0.0.1`), CloudFront or S3 serving the absolute
media URLs, and ALB behaviour in front of the web service.
