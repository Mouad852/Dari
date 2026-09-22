import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test as base, type Page, type Response } from '@playwright/test';

import { PRODUCTION_SSR_KEY } from '../../playwright.config';

/*
 * Regression gate for audit P0-10 (the nonce CSP silently blocked every script
 * on prerendered routes) and P0-11 (internal API host in public HTML). Runs
 * only against `next build && next start`; see playwright.config.ts.
 *
 * Every test fails on ANY console error and on ANY securitypolicyviolation.
 */
type Metadata = { mediaOrigin: string; cdnOrigin: string; mockUrl: string; publicApiOrigin: string };

const test = base.extend<{ guardedPage: Page }>({
  guardedPage: async ({ page }, use) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
    await page.addInitScript(() => {
      const violations: string[] = [];
      (window as unknown as { __cspViolations: string[] }).__cspViolations = violations;
      document.addEventListener('securitypolicyviolation', (event) => {
        violations.push(`${event.effectiveDirective} blocked ${event.blockedURI || '(inline)'}`);
      });
    });

    await use(page);

    const violations = await page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);
    expect(violations, 'CSP violations').toEqual([]);
    expect(consoleErrors, 'console errors').toEqual([]);
  },
});

function metadata(): Metadata {
  return test.info().project.metadata as Metadata;
}

async function expectHydrated(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    [...document.querySelectorAll('body *')].some((element) => Object.keys(element).some((key) => key.startsWith('__reactFiber'))),
  ), { message: 'React attached to the server HTML' }).toBe(true);
}

async function expectImageLoaded(page: Page, src: string) {
  const image = page.locator(`img[src="${src}"]`).first();
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth), {
    message: `${src} decoded`,
  }).toBeGreaterThan(0);
}

function expectSecurityHeaders(response: Pick<Response, 'headers'> | null) {
  const headers = response?.headers() ?? {};
  const csp = headers['content-security-policy'] ?? '';
  // Static: inline flight scripts on cached HTML cannot carry a nonce.
  expect(directive(csp, 'script-src')).toEqual(["'self'", "'unsafe-inline'"]);
  expect(csp).not.toMatch(/nonce-|strict-dynamic|unsafe-eval/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['permissions-policy']).toBe('geolocation=(self), camera=(), microphone=(), payment=()');
  return csp;
}

function directive(csp: string, name: string): string[] {
  const entry = csp.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `));
  return entry ? entry.split(/\s+/).slice(1) : [];
}

const RELATIVE_COVER = '/uploads/listings/e2e-owner/e2e-relative-cover.png';
const ABSOLUTE_COVER = '/cdn/listings/e2e-owner/e2e-absolute-cover.png';

test('the prerendered home page hydrates and loads photos from both media origins', async ({ guardedPage: page }) => {
  const { mediaOrigin, cdnOrigin } = metadata();
  const response = await page.goto('/');
  expect(response?.headers()['x-nextjs-cache'], 'served from the prerender cache').toBeDefined();
  expectSecurityHeaders(response);

  await expectHydrated(page);
  await expectImageLoaded(page, `${mediaOrigin}${RELATIVE_COVER}`);
  await expectImageLoaded(page, `${cdnOrigin}${ABSOLUTE_COVER}`);
});

test('the prerendered sign-in page hydrates and its controls respond', async ({ guardedPage: page }) => {
  const response = await page.goto('/sign-in');
  expect(response?.headers()['x-nextjs-cache']).toBeDefined();
  expectSecurityHeaders(response);

  await expectHydrated(page);
  await page.getByRole('button', { name: 'Afficher le mot de passe' }).click();
  await expect(page.getByRole('button', { name: 'Masquer le mot de passe' })).toBeVisible();
});

test('the prerendered publish shell hydrates for a signed-out visitor', async ({ guardedPage: page }) => {
  const response = await page.goto('/publish');
  expectSecurityHeaders(response);

  await expectHydrated(page);
  await expect(page.getByLabel("Titre de l’annonce")).toBeVisible();
});

test('a dynamic listing page renders relative and absolute photos and hydrates', async ({ guardedPage: page }) => {
  const { mediaOrigin, cdnOrigin } = metadata();
  const response = await page.goto('/listings/listing-1');
  expect(response?.headers()['x-nextjs-cache']).toBeUndefined();
  expectSecurityHeaders(response);

  await expectHydrated(page);
  await expectImageLoaded(page, `${mediaOrigin}${RELATIVE_COVER}`);
  // Switching photos is client state: it only works once React is running.
  await page.getByRole('button', { name: 'Photo 2' }).click();
  await expectImageLoaded(page, `${cdnOrigin}${ABSOLUTE_COVER}`);
});

test('security headers are identical on prerendered, dynamic and prefetch responses', async ({ request }) => {
  const prerendered = await request.get('/');
  const dynamic = await request.get('/listings/listing-1');
  // A router prefetch (the middleware used to skip these entirely).
  const prefetch = await request.get('/sign-in', { headers: { RSC: '1', 'Next-Router-Prefetch': '1' } });

  for (const response of [prerendered, dynamic, prefetch]) {
    expect(response.status()).toBe(200);
  }
  const policies = [prerendered, dynamic, prefetch].map((response) => expectSecurityHeaders(response));
  expect(new Set(policies).size, 'one static policy').toBe(1);
});

test('the CSP allows exactly the origins the media resolver renders, and never the internal API', async ({ guardedPage: page }) => {
  const { publicApiOrigin } = metadata();
  const response = await page.goto('/');
  const csp = response?.headers()['content-security-policy'] ?? '';
  const imgSrc = directive(csp, 'img-src');
  const connectSrc = directive(csp, 'connect-src');

  const rendered = new Set<string>();
  for (const path of ['/', '/listings/listing-1']) {
    await page.goto(path);
    for (const src of await page.locator('img').evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src))) {
      const origin = new URL(src).origin;
      if (origin !== new URL(page.url()).origin) rendered.add(origin);
    }
  }
  expect(rendered.size).toBeGreaterThanOrEqual(2);
  for (const origin of rendered) expect(imgSrc, `img-src allows ${origin}`).toContain(origin);
  expect(connectSrc).toContain(publicApiOrigin);
  expect(csp).not.toContain('api.internal');
});

test('no served output names the internal API host or the SSR key', async ({ request }) => {
  const forbidden = ['api.internal', PRODUCTION_SSR_KEY];
  for (const path of ['/', '/sign-in', '/flatshare/rabat', '/listings/listing-1', '/profile/other-user', '/sitemap/0.xml', '/robots.txt']) {
    for (const headers of [{}, { RSC: '1' }] as Record<string, string>[]) {
      const body = await (await request.get(path, { headers })).text();
      for (const needle of forbidden) expect(body, `${path} ${JSON.stringify(headers)}`).not.toContain(needle);
    }
  }

  // Everything a browser can download, plus the prerendered pages as built.
  const distDir = path.join(__dirname, '..', '..', '..', '.next-production-e2e');
  const files = [
    ...listFiles(path.join(distDir, 'static')),
    ...listFiles(path.join(distDir, 'server', 'app')).filter((file) => /\.(html|rsc|body)$/.test(file)),
  ];
  expect(files.length).toBeGreaterThan(20);
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const needle of forbidden) expect(content.includes(needle), `${file} contains ${needle}`).toBe(false);
  }
});

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}

test('server renders carry the SSR key once per request and browser calls never do', async ({ guardedPage: page, request }) => {
  const { mockUrl } = metadata();
  const audit = async () => (await request.get(`${mockUrl}/__ssr-audit`)).json() as Promise<{ keyed: string[]; unkeyed: string[]; wrongKey: string[] }>;

  const before = await audit();
  await page.goto('/listings/listing-1');
  await expectHydrated(page);
  await page.goto('/listings?city=Rabat');
  await expect(page.getByText('Chambre lumineuse à Agdal')).toBeVisible();
  const after = await audit();

  const keyed = after.keyed.slice(before.keyed.length);
  const unkeyed = after.unkeyed.slice(before.unkeyed.length);
  expect(after.wrongKey).toEqual([]);
  // generateMetadata and the page share one detail lookup (React cache()).
  expect(keyed.filter((call) => call === 'GET /listings/listing-1')).toHaveLength(1);
  // The search page fetches from the browser: no key, ever.
  expect(unkeyed.some((call) => call.startsWith('GET /listings?city=Rabat'))).toBe(true);
  expect(keyed.some((call) => call.startsWith('GET /listings?city=Rabat'))).toBe(false);
});
