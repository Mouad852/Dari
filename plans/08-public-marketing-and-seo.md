# 08 — The public marketing surface and SEO

## What this covers, and why it exists

The marketing homepage, public city landing pages, and the rendering strategy that lets any of it be found by Google.

**This phase was missing from my first pass.** `ui_kits/website/HomePage.jsx` is a complete mockup — hero, elevated search bar, featured-listing grid, a four-step "Comment ça marche", city tiles with scrims, and a terracotta CTA band — and I assigned every other mockup to a phase except this one. It is the front door of the product.

It sits here because the homepage needs real content to show. Featured listings require published listings, which do not exist until phase 06, and city tiles need per-city counts that only mean something once search is complete in 07.

## The architectural problem underneath it

Dari's job is to replace Facebook groups and WhatsApp for people looking for a room in Rabat. A large share of those people will start by typing *"colocation rabat agdal"* into Google. **Organic search is a primary acquisition channel for a marketplace like this**, not a nice-to-have — and it is the cheapest one available to a solo developer with no ad budget.

Phase 03 proposes React + Vite, which is a client-rendered SPA. A client-rendered SPA is the worst available option for this. Google can execute JavaScript, but indexing is slower and less reliable than server-rendered HTML, and listing pages — the long-tail content that would actually rank — are exactly what suffers.

This is why **the decision belongs in phase 03, not here.** Choosing Vite in 03 and discovering the SEO requirement in 08 means either rebuilding the frontend or shipping something that cannot be found. Phase 03 has been updated to make the rendering strategy an explicit decision before the framework is picked.

The realistic options:

| Option | Trade-off |
| --- | --- |
| Next.js, SSR or SSG | Best SEO, adds a Node runtime alongside Spring Boot — a second thing to deploy and operate |
| Vite SPA + prerendered marketing pages | Simplest; the homepage and city pages rank, individual listings do not |
| Vite SPA only | Fastest to build, effectively invisible to organic search |
| SPA + server-rendered listing pages from Spring Boot | Keeps one backend; means templating in Java and duplicating presentation logic |

There is no obviously correct answer — it depends on how much you expect organic search to matter versus how much operational surface you want as a solo developer. It does need answering before phase 03.

## Tasks

**Homepage**, from `ui_kits/website/HomePage.jsx`
- [ ] Hero with the elevated search bar, wired to the real search endpoint
- [ ] Featured listings grid — define what "featured" means, since the doc defers monetized featuring to post-MVP. Recency plus photo quality is a reasonable first answer.
- [ ] Four-step "Comment ça marche"
- [ ] City tiles with scrims and live per-city listing counts
- [ ] Terracotta CTA band
- [ ] The one permitted hero gradient, `--clay-50 → --bg-page`, per the design system

**Public content and SEO**
- [ ] City landing pages — `/flatshare/rabat`, `/flatshare/casablanca`, and so on. These are the pages most likely to rank.
- [ ] Neighborhood pages if the rendering strategy makes them cheap
- [x] Server-rendered listing detail pages with real metadata (2026-09-03). Interactivity moved into two client islands; route client JS dropped from 5.22 kB to 2.09 kB. Verified by reading the served HTML, not by inspecting the code.
- [~] Title, meta description, canonical and Open Graph tags per page, in French — done for listing detail (2026-09-03); city landing pages and the homepage still have only the root layout's metadata.
- [x] schema.org `Accommodation` with an `Offer` carrying the monthly rent (2026-09-03). Coordinates are deliberately omitted: the values in the public response are fuzzed, and publishing them as structured geo data would assert a precision the product does not have.
- [x] `sitemap.xml` includes listing URLs, sourced from the public search endpoint so it reads `published_listings` and cannot advertise drafts or suspended listings (2026-09-03). Revalidates hourly — without that Next prerenders it at build time and every listing published afterwards stays invisible until the next deploy.
- [ ] `robots.txt` — and confirm it **excludes** admin, account and messaging routes
- [ ] Canonical URLs, so filtered search permutations do not fragment ranking
- [x] `SUSPENDED`, `EXPIRED` and `ROOM_FOUND` listings return a real 404 (2026-09-03) rather than a 200 page saying "unavailable". Verified by flipping a listing to ROOM_FOUND and re-requesting it.
- [ ] Static pages: about, contact, and the legal pages phase 10 requires

**Performance**, since it affects both ranking and the market
- [ ] Core Web Vitals on the homepage and listing pages
- [ ] Image optimisation and lazy loading — significant on Moroccan mobile connections
- [ ] No layout shift on load, per the design system's own quality floor

## Depends on

- Phase 03's rendering decision — **this phase is blocked on it being made correctly**
- Phases 06 and 07, for published listings and working search
- Mockups: `ui_kits/website/HomePage.jsx` in full, `SiteChrome.jsx` for header and footer
- Design system: the imagery, glass and scrim guidelines especially

## Done looks like

- The homepage matches the mockup at 1280px and holds together at 360px
- Hero search leads into real results
- City tiles show true counts and link to city landing pages
- A listing page served to a crawler contains its actual content in the initial HTML
- `sitemap.xml` lists published listings and updates as they change
- Admin, account and messaging routes are excluded from crawling — verified, not assumed
- Delisted listings stop being served as live pages
- Core Web Vitals pass on a throttled mobile connection

## Risks and open decisions

- **The rendering strategy is the real decision here, and it is made in phase 03.** If it is deferred, this phase becomes a rewrite rather than a build.
- **"Featured" is undefined.** Monetised featuring is explicitly post-MVP, so the MVP needs a non-commercial definition or the homepage grid has no rule behind it.
- **Indexed listings and location fuzzing interact.** A public, indexed, crawlable listing page is the widest possible distribution of whatever location data it exposes. The fuzzing review in phase 10 must cover the rendered public page, not just the JSON API.
- **Indexed listings outlive their availability.** Google will keep serving a cached room that was let months ago. Correct status codes on delisted pages matter more here than they look.
- **Missing photography bites hardest on this surface.** A marketing homepage is almost entirely photography, and every image slot currently renders the PHOTO placeholder. Of all the phases, this is the one that cannot ship on placeholders.
- **French-only content limits reach.** A meaningful share of Moroccan search traffic is in Arabic, and some in English. Out of scope for MVP, but it is a ceiling worth knowing about.
