/*
 * Loads routes of an already running `next start` in real Chromium and reports,
 * per route: CSP console errors, securitypolicyviolation events, whether React
 * hydrated, and whether a client-side control actually responds.
 *
 * Written to reproduce audit P0-10 before changing the CSP. The regression gate
 * is the `production` Playwright project; this script is the one-off probe
 * whose output is recorded in docs/PHASE1_CSP_REPRODUCTION.md.
 *
 *   node e2e/csp-reproduction.mjs [baseUrl] [comma-separated routes]
 *
 * Test-only: accepts the mock API's self-signed certificate and maps
 * *.example.invalid to loopback, exactly like the production e2e project.
 */
import { chromium } from '@playwright/test';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:3111';
const routes = (process.argv[3] ?? '/,/sign-in,/listings/listing-1').split(',');

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP *.example.invalid 127.0.0.1'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
let failed = false;

for (const route of routes) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push(`${event.effectiveDirective} blocked ${event.blockedURI || '(inline)'}`);
    });
  });

  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  const hydrated = await page.evaluate(() =>
    [...document.querySelectorAll('body *')].some((element) => Object.keys(element).some((key) => key.startsWith('__reactFiber'))));

  let interactive = 'n/a';
  if (route === '/sign-in') {
    const toggle = page.getByRole('button', { name: 'Afficher le mot de passe' });
    await toggle.click();
    interactive = String(await page.getByRole('button', { name: 'Masquer le mot de passe' }).isVisible());
  }

  const violations = await page.evaluate(() => window.__cspViolations);
  console.log(`\n=== ${route}  status=${response?.status()}  x-nextjs-cache=${response?.headers()['x-nextjs-cache'] ?? '-'}`);
  console.log(`hydrated (React fibers attached): ${hydrated}`);
  console.log(`client control responds:          ${interactive}`);
  const byDirective = Object.entries(violations.reduce((counts, violation) => {
    const directive = violation.split(' ')[0];
    return { ...counts, [directive]: (counts[directive] ?? 0) + 1 };
  }, {})).map(([directive, count]) => `${directive}=${count}`).join(', ');
  console.log(`securitypolicyviolation events:   ${violations.length}${byDirective ? ` (${byDirective})` : ''}`);
  for (const violation of violations.slice(0, 3)) console.log(`  - ${violation}`);
  console.log(`console errors:                   ${consoleErrors.length}`);
  for (const error of consoleErrors.slice(0, 2)) console.log(`  - ${error.slice(0, 220)}`);
  if (!hydrated || violations.length || consoleErrors.length || interactive === 'false') failed = true;
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
