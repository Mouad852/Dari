# Guide — Phase 08: Public marketing surface and SEO

Implementation guide for [`08-public-marketing-and-seo.md`](../08-public-marketing-and-seo.md).

This phase assumes phase 03 chose a rendering strategy that can serve HTML to a crawler. If it chose a plain client-rendered SPA, stop and revisit that first — everything below depends on it, and no amount of metadata rescues a page whose content arrives via JavaScript.

The guide is written for **Next.js App Router**, the phase 03 recommendation.

---

## 1. The homepage

Port from `design-system/ui_kits/website/HomePage.jsx`. Sections, in order: hero with elevated search bar, featured-listing grid, four-step *"Comment ça marche"*, city tiles with scrims, terracotta CTA band.

### Server-render the data

```tsx
// app/page.tsx — a Server Component; no client JS needed for the content
export const revalidate = 300;   // ISR: regenerate at most every 5 minutes

export default async function HomePage() {
  const [featured, cityCounts] = await Promise.all([
    getFeaturedListings(),
    getCityCounts(),
  ]);
  return (
    <>
      <Hero />
      <FeaturedListings listings={featured} />
      <HowItWorks />
      <CityTiles counts={cityCounts} />
      <CtaBand />
    </>
  );
}
```

ISR rather than fully static: city counts and featured listings change, but not per-request. Five minutes is a reasonable balance; the page stays fast and is never more than slightly stale.

### "Featured" needs a definition

§9 defers monetized featuring, so the MVP needs a non-commercial rule or the grid has no logic behind it. Reuse the `RECOMMENDED` scoring from phase 07 and take the top 6 — recency, photo count, description completeness. One formula, two consumers, and improving it improves both.

```java
GET /api/v1/listings/featured?limit=6
```

Rate-limit and cache it server-side; it is the most-hit endpoint on the site.

### Hero

The design system permits exactly one gradient here: `--clay-50 → --bg-page`, vertical. No mesh gradients, no floating orbs.

The hero image slot renders the PHOTO placeholder until the photography gap closes. **This is the surface where that hurts most** — a marketing homepage is mostly photography, and it is the one page that cannot ship on placeholders.

### City tiles

Live counts, formatted through `format.ts`. Link to city landing pages, not to a filtered search URL — the landing page is what ranks.

---

## 2. City landing pages

The pages most likely to earn organic traffic. `/flatshare/rabat`, `/flatshare/casablanca`, and so on.

```tsx
// app/flatshare/[city]/page.tsx
export async function generateStaticParams() {
  return CITIES.map(city => ({ city: slugify(city) }));
}

export const revalidate = 3600;

export async function generateMetadata({ params }): Promise<Metadata> {
  const city = cityFromSlug(params.city);
  const count = await getCityCount(city);
  return {
    title: `Colocation à ${city} — ${count} chambres disponibles | Dari`,
    description: `Trouvez une colocation à ${city}. ${count} chambres vérifiées, `
               + `loyers annoncés charges comprises, profils vérifiés.`,
    alternates: { canonical: `https://dari.ma/flatshare/${params.city}` },
  };
}
```

Each page carries real content, not just a listing grid: neighborhood links, a typical price range, a short paragraph about the city's rental market. A page that is only a grid has nothing to rank on.

If the rendering strategy makes it cheap, add neighborhood pages — `/flatshare/rabat/agdal` — which match search intent even more closely. Do not generate hundreds of thin pages; a page per neighborhood in four cities is roughly eighteen, all substantive.

---

## 3. Listing pages

The long tail, and the reason the rendering decision mattered.

```tsx
// app/listings/[id]/page.tsx
export const revalidate = 600;

export async function generateMetadata({ params }): Promise<Metadata> {
  const listing = await getListing(params.id);
  if (!listing) return { title: 'Annonce introuvable' };

  return {
    title: `${listing.title} — ${listing.neighborhood}, ${listing.city} | Dari`,
    description: truncate(listing.description, 155),
    openGraph: {
      title: listing.title,
      images: listing.coverUrl ? [listing.coverUrl] : [],
      type: 'website',
    },
    alternates: { canonical: `https://dari.ma/listings/${params.id}` },
  };
}
```

### Delisted listings must stop being live pages

A listing that is suspended, expired or marked `ROOM_FOUND` must not keep serving a 200. Google will otherwise index and keep serving a room that was let months ago — bad for users and bad for the domain.

```tsx
export default async function ListingPage({ params }) {
  const listing = await getListing(params.id);
  if (!listing) notFound();        // 404 — the API already returns 404 for non-public listings
  return <ListingDetail listing={listing} />;
}
```

Phase 05's `GET /listings/{id}` already 404s for anything not `PUBLISHED` + `AVAILABLE` to a non-owner, so this falls out of the existing contract rather than needing new logic. Verify it, because it is load-bearing here in a way it was not before.

Use **410 Gone** rather than 404 for listings that existed and were deliberately closed, if you want faster de-indexing. Optional refinement.

### Structured data

`JobPosting` obviously does not apply. Use `Accommodation` / `Offer`:

```tsx
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Accommodation',
  name: listing.title,
  address: {
    '@type': 'PostalAddress',
    addressLocality: listing.neighborhood,
    addressRegion: listing.city,
    addressCountry: 'MA',
  },
  // Neighborhood granularity only — never the fuzzed coordinates, and never exact ones.
  numberOfRooms: listing.numBedrooms,
  offers: {
    '@type': 'Offer',
    price: listing.priceRent,
    priceCurrency: 'MAD',
    availability: 'https://schema.org/InStock',
  },
};
```

**Do not put coordinates in structured data at all.** Even fuzzed, publishing machine-readable geo on an indexed page is the widest possible distribution of location data, and the fuzzing exists precisely to avoid that. Neighborhood and city are enough.

---

## 4. Sitemap and robots

```tsx
// app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = await getPublishedListingIdsAndDates();   // published + available only

  return [
    { url: 'https://dari.ma',            changeFrequency: 'daily',  priority: 1.0 },
    ...CITIES.map(c => ({
        url: `https://dari.ma/flatshare/${slugify(c)}`,
        changeFrequency: 'daily' as const, priority: 0.8 })),
    ...listings.map(l => ({
        url: `https://dari.ma/listings/${l.id}`,
        lastModified: l.updatedAt,
        changeFrequency: 'weekly' as const, priority: 0.6 })),
  ];
}
```

The listing query must use the `published_listings` view from phase 02. A sitemap built off the `listings` table would advertise drafts and suspended listings to Google — a leak with a very long tail.

```tsx
// app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/messages', '/publish', '/api'],
    },
    sitemap: 'https://dari.ma/sitemap.xml',
  };
}
```

Verify the disallow list against your actual routes rather than trusting this one. `robots.txt` is advisory — it stops well-behaved crawlers, not attackers, so the admin routes must still be role-gated server-side (phase 06 handles that).

### Canonicals

Filtered search URLs generate near-infinite permutations. Point them all at the clean city page:

```tsx
// on /listings?city=Rabat&priceMax=4000&amenities=wifi
alternates: { canonical: 'https://dari.ma/flatshare/rabat' }
```

Otherwise ranking fragments across thousands of variants, none of which rank.

---

## 5. Performance

Core Web Vitals affect both ranking and, more importantly here, whether the site is usable on a Moroccan mobile connection.

- **LCP** is the hero image. Set `priority` on it, size it explicitly, serve WebP/AVIF via `next/image`.
- **CLS** — reserve space for every image and the sticky header. The design system's quality floor already requires no layout shift on load.
- **Lazy-load** everything below the fold; the featured grid and city tiles do not need to block.
- Test on a throttled connection, not on your laptop's fibre. Slow 4G is the realistic case.

`next/image` needs the storage host allowlisted in `next.config.js`, which is where phase 05's `PhotoStorage` decision resurfaces.

---

## 6. Tests

| Test | Asserts |
| --- | --- |
| `curl` a listing page with JS disabled | Content present in the HTML |
| Suspended listing page | 404 or 410, not 200 |
| `ROOM_FOUND` listing page | Not served |
| `sitemap.xml` | Only published + available listings |
| `robots.txt` | Admin, account, messages disallowed |
| Listing page source | No coordinates, exact or fuzzed |
| Filtered search page | Canonical points at the city page |
| Homepage at 360px | No horizontal scroll |
| Lighthouse, throttled mobile | LCP and CLS within budget |

The "JS disabled" curl is the one that actually proves the rendering strategy works. Run it before believing anything else in this phase.

---

## 7. Done checklist

- [ ] Homepage matches the mockup at 1280px, holds at 360px
- [ ] Hero search leads into real results
- [ ] City tiles show true counts and link to landing pages
- [ ] A crawler receives full listing content in the initial HTML
- [ ] Sitemap lists only published, available listings and updates as they change
- [ ] Admin, account and messaging routes excluded from crawling — verified
- [ ] Delisted listings return 404/410
- [ ] No coordinates anywhere in rendered public HTML or structured data
- [ ] Core Web Vitals pass on throttled mobile

## Two things to know

**Photography is a hard blocker here**, unlike every other phase. Placeholders are survivable on a search results page and not on a marketing homepage. If the client photos are not recovered by this point, this phase either slips or ships looking unfinished.

**French-only limits reach.** A meaningful share of Moroccan search traffic is Arabic, some is English. Out of MVP scope, but this is the phase where the ceiling becomes visible — and if Arabic is ever coming, the URL and routing structure chosen here is what makes it cheap or expensive.
