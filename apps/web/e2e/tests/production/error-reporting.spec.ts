import { expect, test, type APIRequestContext } from '@playwright/test';

import { PRODUCTION_SSR_KEY } from '../../playwright.config';

/*
 * Error tracking in a real production build: a server render fails, the root
 * error boundary reports it, and the browser delivers the event to the
 * error-tracking endpoint named by NEXT_PUBLIC_SENTRY_DSN — here the local
 * mock, never the vendor. Asserts on the envelope exactly as the browser sent it.
 */
type Metadata = { mockUrl: string; errorsOrigin: string };
type Report = { body: string; query: string; cookie: string | null; referer: string | null; authorization: string | null };

// Same id as BROKEN_LISTING_ID in e2e/mock-api.mjs: its API lookup answers 502 with HTML.
const BROKEN_LISTING_ID = '0b5e1a7c-9f3d-4c2a-8e61-5d4f3c2b1a09';
const QUERY_EMAIL = 'amina.bennani@example.invalid';
const QUERY_TOKEN = 'query-token-must-not-leave-7c1e';

function metadata(): Metadata {
  return test.info().project.metadata as Metadata;
}

async function reports(request: APIRequestContext): Promise<Report[]> {
  return (await request.get(`${metadata().mockUrl}/__error-reports`)).json() as Promise<Report[]>;
}

function directive(csp: string, name: string): string[] {
  const entry = csp.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `));
  return entry ? entry.split(/\s+/).slice(1) : [];
}

test('a failed server render is reported to error tracking, scrubbed, with no CSP violation', async ({ page, request }) => {
  const { mockUrl, errorsOrigin } = metadata();
  await request.delete(`${mockUrl}/__error-reports`);

  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = violations;
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.effectiveDirective} blocked ${event.blockedURI || '(inline)'}`);
    });
  });

  const response = await page.goto(
    `/listings/${BROKEN_LISTING_ID}?email=${encodeURIComponent(QUERY_EMAIL)}&token=${QUERY_TOKEN}`);
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(directive(csp, 'connect-src'), 'the DSN origin is allowed').toContain(errorsOrigin);

  await expect(page.getByRole('heading', { name: 'Une erreur est survenue' })).toBeVisible();
  await expect.poll(async () => (await reports(request)).length, { message: 'an envelope reached the endpoint' })
    .toBeGreaterThan(0);

  const [report] = await reports(request);
  if (!report) throw new Error('no envelope recorded');
  const [, itemHeaderLine, eventLine] = report.body.split('\n').filter(Boolean);
  if (!itemHeaderLine || !eventLine) throw new Error('envelope has no event item');
  const itemHeader = JSON.parse(itemHeaderLine) as { type: string };
  expect(itemHeader.type).toBe('event');
  const event = JSON.parse(eventLine) as Record<string, unknown> & {
    tags: Record<string, string>;
    exception: { values: { type: string; value?: string; stacktrace?: { frames: unknown[] } }[] };
  };
  console.log('=== Scrubbed browser error-tracking envelope as received by the mock endpoint ===');
  console.log(report.body);

  expect(event.release).toBe('e2e');
  expect(event.environment).toBe('production');
  expect(event.tags.kind).toBe('render');
  expect(event.tags.route).toBe('/listings/[id]');
  expect(event.tags.digest, 'the server-log handle').toMatch(/\S+/);
  expect(Object.keys(event.tags).sort()).toEqual(['digest', 'kind', 'route']);
  expect(event.exception.values.length).toBeGreaterThan(0);
  for (const exception of event.exception.values) {
    expect(exception.type).toBeTruthy();
    expect(exception.value, 'error messages are dropped').toBeUndefined();
  }
  for (const absent of ['request', 'user', 'breadcrumbs', 'extra', 'contexts', 'message', 'server_name']) {
    expect(event, `event has no ${absent}`).not.toHaveProperty(absent);
  }
  for (const secret of [BROKEN_LISTING_ID, QUERY_EMAIL, 'amina', QUERY_TOKEN, 'email=', PRODUCTION_SSR_KEY,
    'api.internal', '502 Bad Gateway']) {
    expect(report.body, `envelope must not contain ${secret}`).not.toContain(secret);
  }
  expect(report.cookie, 'no cookie sent to error tracking').toBeNull();
  expect(report.authorization, 'no Authorization header').toBeNull();
  if (report.referer) expect(new URL(report.referer).pathname, 'origin-only referrer').toBe('/');
  expect(report.query, 'the query string carries only the public key and SDK id')
    .not.toMatch(new RegExp(`${BROKEN_LISTING_ID}|amina|${QUERY_TOKEN}`));

  const violations = await page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);
  expect(violations, 'CSP violations').toEqual([]);
  // React logs the error its boundary caught; nothing else may appear.
  for (const text of consoleErrors) {
    expect(text).not.toMatch(/Content Security Policy|Refused to connect|CORS/i);
  }
});
