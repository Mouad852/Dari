import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * robots.txt is advisory — it stops well-behaved crawlers, not attackers. The
 * admin, account and messaging routes are protected server-side; this only
 * keeps them out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/messages', '/favorites', '/publish', '/api'],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
