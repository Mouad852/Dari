# 03 — Frontend foundation + the first real screen

## What this covers, and why it's here

React app scaffolding, the design system wired in as the styling foundation, Firebase auth on the client, a typed API client, and the search results page rendering **live data from phase 02's endpoint.**

It comes third, immediately after the risk spike and before any more backend breadth, for two reasons. First, you asked to see working software early — this is the first phase that produces something you can click. Second, and more usefully, consuming the search API from a real client is the fastest way to find out that the API is wrong. Filter state in a URL, loading and empty states, and pagination all apply pressure that integration tests do not.

The search results page is the right first screen because it is the one surface that already has a **full desktop mockup** and is backed by an endpoint that already exists.

## Tasks

**Foundation**
- [ ] **Decide the rendering strategy before choosing the framework** — see the risk below. This is the one decision in this phase that cannot be cheaply reversed.
- [ ] React + TypeScript; routing; a data-fetching layer with caching
- [ ] Import the design system: link `design-system/styles.css`, or port the token files into the build
- [ ] Decide how the 16 existing components enter the app — the kits are `.jsx` consuming a compiled bundle, and that is a prototype arrangement, not a production one. Port them into the app's component tree properly.
- [ ] Establish the French copy rules in code: `3 200 MAD/mois` with a thin space, `4,8` with a decimal comma, sentence case, no emoji, no exclamation marks. A shared formatter, not per-component string building.
- [ ] Firebase client SDK: signup, login, token refresh, and attaching the bearer token to every API call
- [ ] Token refresh on 401, with a single retry — get this right once, centrally
- [ ] Typed API client and shared types; keep them close to the backend contract

**First screens**
- [ ] Auth screens: signup, login, email verification. **No mockups exist** — build these from design-system primitives and expect to revisit.
- [ ] Site chrome: header and footer, ported from `ui_kits/website/SiteChrome.jsx`
- [ ] Search results page against the live endpoint: result count, sort control, listing grid, load-more
- [ ] Wire the filters the backend actually supports today — city, neighborhood, price. Nothing more; the rest arrive in phase 06.
- [ ] Filter state in the URL, so a search is shareable and survives a refresh
- [ ] Loading, empty and error states, using the copy rules (*"Touchez le cœur sur une annonce pour la retrouver ici."* is the tone)
- [ ] Responsive down to 360px; visible keyboard focus; WCAG AA contrast

## Depends on

- Phases 01 and 02 — this consumes their endpoints
- Design system: all tokens, `core/`, `forms/`, `feedback/`, `listings/ListingCard`, `navigation/Tabs`
- Mockups: `ui_kits/website/SiteChrome.jsx` and `SearchResultsPage.jsx`
- Design doc §2 auth flow, §5 filters and sorting, §7 conventions

## Done looks like

- Signup through Firebase, then `POST /users`, then a logged-in session that survives a refresh
- The search page lists real listings from Postgres, filters and sorts against the live API, and paginates
- A search URL can be copied to another browser and reproduces the same result set
- Only `PUBLISHED` + `AVAILABLE` listings appear — the invariant verified from the outside, through the client
- It looks like the mockup at 1280px and holds together at 360px
- Expired tokens refresh without the user noticing

## Risks and open decisions

- **Rendering strategy is an SEO decision disguised as a framework choice, and it has to be made here.** Dari's job is to replace Facebook groups for people googling *"colocation rabat agdal"* — organic search is a primary acquisition channel, and the cheapest one available without an ad budget. A client-rendered Vite SPA is the worst option for that: listing pages, the long-tail content that would actually rank, are exactly what a crawler handles least reliably. The options are Next.js with SSR/SSG (best for search, adds a Node runtime to operate alongside Spring Boot), a Vite SPA with prerendered marketing pages (simplest; homepage ranks, listings do not), or a plain SPA (fastest to build, effectively invisible to Google). Phase 08 depends on this being answered correctly here — deferring it turns that phase into a rewrite.
- **The design system's production story is unresolved.** `design-system/` currently pairs v1 `.jsx` sources with a v2 compiled bundle (see `docs/ANALYSIS.md`). Rebuilding the bundle from current sources would silently roll components back. This phase is where that gets settled, because it is where the components become real application code.
- **Missing logo and photography.** Every image renders the PHOTO placeholder. Structure is unaffected, but nothing will look finished, and judging visual quality against these screens will mislead you.
- **Auth screens have no design reference** and are the first thing every user sees. Budget a revisit.
- **Do not let the API client drift from the backend.** Consider generating types from an OpenAPI spec rather than maintaining them by hand — the decision is cheap now and expensive at phase 08.
- **French-only.** Arabic/RTL is undesigned. If it is ever coming, the layout decisions made here are the ones that will hurt; at minimum avoid hard-coding directional assumptions.
