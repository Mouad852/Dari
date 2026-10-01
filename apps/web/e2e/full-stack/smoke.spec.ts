import { expect, test } from '@playwright/test';

import { verifiedAccount } from './emulator';
import { URLS } from './stack.mjs';

/*
 * The harness itself (task 6.2a): the real API answers, trusts an emulator
 * token and nothing else, and the web app renders from it.
 */

test('the real API answers, accepts an emulator account and refuses a forged token', async ({ request }) => {
  const cities = await request.get(`${URLS.api}/api/v1/cities`);
  expect(cities.status()).toBe(200);
  // Cities with listings: none yet in the harness's fresh database.
  expect(Array.isArray(await cities.json())).toBe(true);

  const { idToken } = await verifiedAccount(`smoke-${Date.now()}@example.invalid`);
  const created = await request.post(`${URLS.api}/api/v1/users`, {
    headers: { Authorization: `Bearer ${idToken}` },
    data: { displayName: 'Smoke S.', firstName: 'Smoke', city: 'Rabat' },
  });
  expect(created.status()).toBe(201);
  const me = await request.get(`${URLS.api}/api/v1/users/me`, { headers: { Authorization: `Bearer ${idToken}` } });
  expect(await me.json()).toMatchObject({ displayName: 'Smoke S.', status: 'ACTIVE' });

  const forged = await request.get(`${URLS.api}/api/v1/users/me`, { headers: { Authorization: 'Bearer forged' } });
  expect(forged.status()).toBe(401);
});

test('the web app renders pages from the real API', async ({ page }) => {
  await page.goto('/listings?city=Rabat');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/erreur|impossible/i)).toHaveCount(0);
});
