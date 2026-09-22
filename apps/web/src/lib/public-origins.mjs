/**
 * The public origins the browser talks to, derived in ONE place.
 *
 * lib/config.ts resolves media URLs from `media` and next.config.mjs builds the
 * Content-Security-Policy (`img-src`, `connect-src`) from the same call, so an
 * image URL the app renders and the hosts the CSP allows cannot drift apart.
 * The same holds for `errorReporting`: lib/reporting.ts sends to that DSN and
 * the CSP allows exactly its origin.
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

/**
 * The optional error-tracking endpoint. A Sentry DSN is public by design (it
 * ships in browser JavaScript and only allows sending events), but it still
 * comes from configuration, and its origin must be in the CSP's connect-src
 * for the browser to deliver anything. A DSN carrying a secret key (the legacy
 * `key:secret@` form) is refused: nothing secret may be inlined.
 *
 * @returns {{ dsn: string, origin: string } | null}
 */
function errorReportingEndpoint(production) {
  const raw = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Configuration web invalide : NEXT_PUBLIC_SENTRY_DSN');
  }
  // The browser SDK accepts only a word-character public key; anything else it
  // rejects at runtime, silently, so refuse it here at build time instead.
  if (!['http:', 'https:'].includes(url.protocol) || !/^\w+$/.test(url.username) || url.password
      || !/^\/(?:[^/]+\/)*\d+$/.test(url.pathname) || url.search || url.hash) {
    throw new Error('Configuration web invalide : NEXT_PUBLIC_SENTRY_DSN');
  }
  if (production && url.protocol !== 'https:') {
    throw new Error('Configuration web NEXT_PUBLIC_SENTRY_DSN doit utiliser HTTPS en production');
  }
  return { dsn: raw, origin: url.origin };
}

/** @returns {{ api: string, media: string[], errorReporting: { dsn: string, origin: string } | null }} */
export function publicOrigins() {
  const production = process.env.NODE_ENV === 'production';

  const rawApi = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!rawApi && production) throw new Error('Configuration web manquante : NEXT_PUBLIC_API_BASE_URL');
  const api = parse('NEXT_PUBLIC_API_BASE_URL', rawApi || DEVELOPMENT_API_BASE_URL, production).origin;
  const errorReporting = errorReportingEndpoint(production);

  const rawMedia = process.env.NEXT_PUBLIC_MEDIA_ORIGINS;
  if (!rawMedia?.trim()) {
    if (production) throw new Error('Configuration web manquante : NEXT_PUBLIC_MEDIA_ORIGINS');
    // Local storage serves /uploads from the API itself.
    return { api, media: [api], errorReporting };
  }
  const media = rawMedia.split(',').map((value) => {
    const url = parse('NEXT_PUBLIC_MEDIA_ORIGINS', value.trim(), production);
    if (url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Configuration web invalide : NEXT_PUBLIC_MEDIA_ORIGINS');
    }
    return url.origin;
  });
  return { api, media, errorReporting };
}
