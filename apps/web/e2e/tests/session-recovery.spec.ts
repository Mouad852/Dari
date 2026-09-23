import { expect, test as base, type Page } from '@playwright/test';

/*
 * What happens to a signed-in visitor when the API stops accepting their
 * token. Before Phase 5 apiFetch never looked at the status: an hour-old tab
 * showed "Impossible de charger vos conversations." and stayed there, and the
 * three network error classes were thrown but matched by no one, so their
 * French ("Aucune connexion réseau détectée") could not appear on screen.
 */
const MOCK = 'http://127.0.0.1:4110';
const EXPIRED = 'e2e-expired-token';
const FRESH = 'e2e-firebase-token';

type AuthState = { uid: string; email: string; displayName: string; emailVerified: boolean; token: string; refreshedToken?: string; refreshCount?: number; refreshFails?: boolean };

const test = base.extend<{ signedInWith: (token: string, refreshedToken?: string, refreshFails?: boolean) => Promise<Page> }>({
  signedInWith: async ({ page, request }, use) => {
    await request.post(`${MOCK}/__reset`);
    await use(async (token, refreshedToken, refreshFails) => {
      await page.addInitScript((auth) => {
        window.__DARI_E2E_AUTH__ = auth as AuthState;
      }, { uid: 'e2e-user-1', email: 'e2e.user@example.invalid', displayName: 'Utilisateur E2E', emailVerified: true, token, refreshedToken, refreshFails });
      return page;
    });
    await request.post(`${MOCK}/__auth`, { data: {} });
  },
});

const refreshCount = (page: Page) => page.evaluate(() => window.__DARI_E2E_AUTH__?.refreshCount ?? 0);
/** Scoped to <main>: the Next dev overlay carries role="alert" too. */
const alert = (page: Page) => page.locator('main').getByRole('alert');
const calls = async (page: Page) =>
  (await (await page.request.get(`${MOCK}/__calls`)).json()) as { method: string; path: string; token: string | null; status: number }[];

test('an expired token is refreshed once and the page loads, for every request in flight', async ({ signedInWith, request }) => {
  await request.post(`${MOCK}/__auth`, { data: { rejectTokens: [EXPIRED] } });
  const page = await signedInWith(EXPIRED, FRESH);

  // /messages loads conversations while the nav polls its unread badge, so
  // several requests are rejected at once.
  await page.goto('/messages');
  await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible();
  await expect(page.getByText('Amina')).toBeVisible();
  expect(page.url()).toContain('/messages');

  expect(await refreshCount(page), 'concurrent 401s share one forced refresh').toBe(1);
  const seen = await calls(page);
  expect(seen.filter((call) => call.path === '/conversations' && call.status === 401)).toHaveLength(1);
  expect(seen.filter((call) => call.path === '/conversations' && call.status === 200)).toHaveLength(1);
});

test('a replayed write is executed exactly once', async ({ signedInWith, request }) => {
  await request.post(`${MOCK}/__auth`, { data: { rejectTokens: [EXPIRED] } });
  const page = await signedInWith(EXPIRED, FRESH);

  await page.goto('/messages/conversation-1');
  await page.getByLabel('Écrire un message').fill('Bonjour, je suis intéressé.');
  await page.getByRole('button', { name: 'Envoyer' }).click();

  await expect(page.getByText('Bonjour, je suis intéressé.')).toBeVisible();
  const posts = (await calls(page)).filter((call) => call.method === 'POST' && call.path.endsWith('/messages'));
  // A 401 is raised before the handler runs, so the replay is the only one
  // that reached it: rejected once, executed once.
  expect(posts.map((call) => call.status)).toEqual([401, 200]);
});

test('a second rejection signs the visitor out and keeps the page they were on', async ({ signedInWith, request }) => {
  await request.post(`${MOCK}/__auth`, { data: { rejectTokens: [EXPIRED, FRESH] } });
  const page = await signedInWith(EXPIRED, FRESH);

  await page.goto('/messages');
  await page.waitForURL(/\/sign-in\?next=/);
  expect(new URL(page.url()).searchParams.get('next')).toBe('/messages');
  expect(await page.evaluate(() => window.__DARI_E2E_AUTH__ ?? null), 'signed out').toBeNull();
  // Rejected once with the stale token, replayed exactly once with the
  // refreshed one, then it gives up: never a loop.
  expect((await calls(page)).filter((call) => call.path === '/conversations').map((call) => call.token))
    .toEqual([EXPIRED, FRESH]);
});

test('a 403 is shown, not treated as a dead session', async ({ signedInWith, request }) => {
  await request.post(`${MOCK}/__auth`, { data: { forbidTokens: [FRESH] } });
  const page = await signedInWith(FRESH);

  await page.goto('/messages');
  await expect(alert(page)).toContainText('Accès refusé');
  expect(page.url()).toContain('/messages');
  expect(await refreshCount(page), 'no token refresh on a 403').toBe(0);
  expect(await page.evaluate(() => Boolean(window.__DARI_E2E_AUTH__)), 'still signed in').toBe(true);
});

test('a refresh that cannot reach Firebase keeps the session', async ({ signedInWith, request }) => {
  await request.post(`${MOCK}/__auth`, { data: { rejectTokens: [EXPIRED] } });
  const page = await signedInWith(EXPIRED, FRESH, true);

  await page.goto('/messages');
  // The 401 is shown with a retry, and nobody is signed out over a network blip.
  await expect(alert(page)).toContainText('Session expirée');
  expect(page.url()).toContain('/messages');
  expect(await page.evaluate(() => Boolean(window.__DARI_E2E_AUTH__)), 'still signed in').toBe(true);
});

test('an offline failure says so, and retrying recovers', async ({ signedInWith, page }) => {
  // The two halves of being offline, applied separately: the API call fails,
  // and navigator.onLine reads false (which is what apiFetch branches on).
  // A genuinely offline context cannot fetch the document either, so the page
  // under test would never load at all.
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }));
  let offline = true;
  await page.route('**/api/v1/conversations*', async (route) => {
    if (offline) await route.abort('internetdisconnected');
    else await route.continue();
  });
  await signedInWith(FRESH);

  await page.goto('/messages');
  await expect(alert(page)).toContainText('Aucune connexion réseau détectée');

  offline = false;
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByText('Amina')).toBeVisible();
});

test('a request that never answers says its deadline passed', async ({ signedInWith }) => {
  const page = await signedInWith(FRESH);
  // Hold the inbox request open; apiFetch aborts it at its own 15 s deadline.
  await page.route('**/api/v1/conversations**', () => {});
  await page.clock.install();
  await page.goto('/messages');
  await page.clock.fastForward('00:20');

  await expect(alert(page)).toContainText('La requête a dépassé son délai');
});
