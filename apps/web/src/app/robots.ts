import type { MetadataRoute } from 'next';
import { apiFetch } from '@/lib/api';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * robots.txt is advisory — it stops well-behaved crawlers, not attackers. The
 * admin, account and messaging routes are protected server-side; this only
 * keeps them out of the index.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  let sitemapUrls = [`${SITE}/sitemap/0.xml`];
  try {
    const result = await apiFetch<{ count: number }>('/listings/sitemap/count');
    const batchCount = Math.max(1, Math.ceil(result.count / 50_000));
    sitemapUrls = Array.from({ length: batchCount }, (_, id) => `${SITE}/sitemap/${id}.xml`);
  } catch {
    // Keep the known first batch discoverable during an API outage.
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/messages', '/favorites', '/publish', '/api'],
    },
    sitemap: sitemapUrls,
  };
}
