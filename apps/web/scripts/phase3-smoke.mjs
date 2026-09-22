import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const baseUrl = process.env.DARI_WEB_SMOKE_URL ?? 'http://localhost:3000';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

const signUp = await fetch(`${baseUrl}/sign-up`);
assert.equal(signUp.status, 200, 'sign-up should render');
const csp = signUp.headers.get('content-security-policy') ?? '';
assert.match(csp, /default-src 'self'/);
// Static policy: a nonce cannot reach cached (prerendered) HTML.
assert.match(csp, /script-src 'self' 'unsafe-inline'(;| 'unsafe-eval';)/);
assert.doesNotMatch(csp, /nonce-|strict-dynamic/);
assert.match(csp, /style-src-attr 'unsafe-inline'/);
assert.match(csp, /frame-ancestors 'none'/);
assert.match(csp, /tile\.openstreetmap\.org/);
assert.equal(signUp.headers.get('permissions-policy'), 'geolocation=(self), camera=(), microphone=(), payment=()');
assert.equal(signUp.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
assert.equal(signUp.headers.get('x-frame-options'), 'DENY');

const robots = await fetch(`${baseUrl}/robots.txt`);
assert.equal(robots.status, 200, 'robots.txt should render');
assert.match(await robots.text(), /sitemap\/0\.xml/);

const api = await source('src/lib/api.ts');
assert.match(api, /new AbortController\(\)/);
assert.match(api, /timeoutMs/);
assert.match(api, /ApiOfflineError/);
assert.match(api, /ApiUnexpectedResponseError/);
const profile = await source('src/lib/profile.ts');
assert.match(profile, /localStorage/);
assert.doesNotMatch(profile, /localStorage.*token/i);
assert.match(profile, /apiFetch\('\/users'/);
const sitemap = await source('src/app/sitemap.ts');
assert.match(sitemap, /BATCH_SIZE = 50_000/);
assert.match(sitemap, /lastModified/);
assert.match(sitemap, /listings\/sitemap/);

console.log(`Phase 3 smoke passed at ${baseUrl}`);
