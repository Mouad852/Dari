import type { MetadataRoute } from 'next';

import { apiFetch, type CursorPage } from '@/lib/api';
import { CITIES, citySlug } from '@/lib/cities';
import type { PublicListing } from '@/types/api';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Pages walked when collecting listings.
 *
 * A sitemap may hold 50,000 URLs, and the search endpoint pages twenty at a
 * time, so this is a deliberate ceiling rather than a hard limit of the format:
 * it bounds how long generating the sitemap can take and how many requests it
 * makes. Raise it when the catalogue justifies it, or split into a sitemap index.
 */
const MAX_PAGES = 25;

/**
 * Regenerate hourly.
 *
 * Without this Next prerenders the sitemap at build time, which would freeze the
 * listing set at whatever existed when the bundle was built — every listing
 * published afterwards would be invisible to a crawler until the next deploy.
 * Rebuilding per request is the other extreme: it would walk the search endpoint
 * on every crawler hit.
 */
export const revalidate = 3600;

/**
 * Listing URLs come from the public search endpoint, which reads the
 * `published_listings` view.
 *
 * That matters more than it looks: a sitemap built from the `listings` table
 * would advertise drafts, listings in review and suspended listings to Google,
 * and removing a URL from an index is far slower than adding one. The endpoint
 * enforces the published-and-available invariant for us.
 */
async function publishedListings(): Promise<Array<{ id: string; updatedAt: string }>> {
  const rows: Array<{ id: string; updatedAt: string }> = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ sort: 'updated' });
    if (cursor) query.set('cursor', cursor);

    const result: CursorPage<PublicListing> = await apiFetch<CursorPage<PublicListing>>(
      `/listings?${query.toString()}`,
    );
    for (const item of result.items) {
      rows.push({ id: item.id, updatedAt: item.createdAt });
    }
    if (!result.hasMore || !result.nextCursor) break;
    cursor = result.nextCursor;
  }

  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE, changeFrequency: 'daily', priority: 1.0 },
    ...CITIES.map((city) => ({
      url: `${SITE}/flatshare/${citySlug(city)}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];

  let listings: Array<{ id: string; updatedAt: string }> = [];
  try {
    listings = await publishedListings();
  } catch {
    // A sitemap missing its listings is a degraded sitemap; a sitemap that
    // fails to build is no sitemap at all. The static entries still ship.
  }

  return [
    ...staticEntries,
    ...listings.map((listing) => ({
      url: `${SITE}/listings/${listing.id}`,
      lastModified: new Date(listing.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
