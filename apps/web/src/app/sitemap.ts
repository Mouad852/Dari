import type { MetadataRoute } from 'next';

import { apiFetch } from '@/lib/api';
import { CITIES, citySlug } from '@/lib/cities';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const BATCH_SIZE = 50_000;

type SitemapCount = { count: number };
type SitemapEntry = { id: string; updatedAt: string };

/** Next.js 15.5 generates /sitemap/[id].xml from these stable batch ids. */
export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  try {
    const { count } = await apiFetch<SitemapCount>('/listings/sitemap/count');
    const batches = Math.max(1, Math.ceil(count / BATCH_SIZE));
    return Array.from({ length: batches }, (_, id) => ({ id }));
  } catch {
    return [{ id: 0 }];
  }
}

/**
 * The API batch is sourced from published_listings and carries only id and
 * updatedAt. There is no fixed crawl ceiling; the number of files grows with
 * the public catalogue and each file remains under Google's 50,000 URL limit.
 */
export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = id === 0 ? [
    { url: SITE, changeFrequency: 'daily', priority: 1.0 },
    ...CITIES.map((city) => ({ url: `${SITE}/flatshare/${citySlug(city)}`, changeFrequency: 'daily' as const, priority: 0.8 })),
  ] : [];

  let listings: SitemapEntry[] = [];
  try {
    listings = await apiFetch<SitemapEntry[]>(`/listings/sitemap?limit=${BATCH_SIZE}&offset=${id * BATCH_SIZE}`);
  } catch {
    // Static entries still keep the sitemap valid during a temporary API outage.
  }

  return [
    ...staticEntries,
    ...listings.flatMap((listing) => {
      const lastModified = new Date(listing.updatedAt);
      return Number.isNaN(lastModified.getTime()) ? [] : [{
        url: `${SITE}/listings/${listing.id}`,
        lastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }];
    }),
  ];
}
