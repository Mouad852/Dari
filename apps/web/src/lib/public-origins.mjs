/**
 * The public origins the browser talks to, derived in ONE place.
 *
 * lib/config.ts resolves media URLs from `media` and next.config.mjs builds the
 * Content-Security-Policy (`img-src`, `connect-src`) from the same call, so an
 * image URL the app renders and the hosts the CSP allows cannot drift apart.
 * Plain JavaScript because next.config.mjs cannot import TypeScript.
 *
 * Every variable is read as a literal `process.env.NEXT_PUBLIC_…` expression:
 * that is the only form Next inlines into browser bundles.
 */

const DEVELOPMENT_API_BASE_URL = 'http://localhost:8080/api/v1';

function parse(name, value, production) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Configuration web invalide : ${name}`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`Configuration web invalide : ${name}`);
  }
  if (production && url.protocol !== 'https:') {
    throw new Error(`Configuration web ${name} doit utiliser HTTPS en production`);
  }
  return url;
}

/** @returns {{ api: string, media: string[] }} */
export function publicOrigins() {
  const production = process.env.NODE_ENV === 'production';

  const rawApi = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!rawApi && production) throw new Error('Configuration web manquante : NEXT_PUBLIC_API_BASE_URL');
  const api = parse('NEXT_PUBLIC_API_BASE_URL', rawApi || DEVELOPMENT_API_BASE_URL, production).origin;

  const rawMedia = process.env.NEXT_PUBLIC_MEDIA_ORIGINS;
  if (!rawMedia?.trim()) {
    if (production) throw new Error('Configuration web manquante : NEXT_PUBLIC_MEDIA_ORIGINS');
    // Local storage serves /uploads from the API itself.
    return { api, media: [api] };
  }
  const media = rawMedia.split(',').map((value) => {
    const url = parse('NEXT_PUBLIC_MEDIA_ORIGINS', value.trim(), production);
    if (url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Configuration web invalide : NEXT_PUBLIC_MEDIA_ORIGINS');
    }
    return url.origin;
  });
  return { api, media };
}
