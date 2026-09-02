import type { MetadataRoute } from 'next';
import { CITIES, citySlug } from '@/lib/cities';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Static entries only, for now.
 *
 * Listing URLs are added in phase 08, and when they are, the query behind them
 * must read the published_listings view. A sitemap built off the listings table
 * would advertise drafts and suspended listings to Google — a leak with a very
 * long tail, since removing a URL from the index is far slower than adding one.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: 'daily', priority: 1.0 },
    ...CITIES.map((city) => ({
      url: `${SITE}/flatshare/${citySlug(city)}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
