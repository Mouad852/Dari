import type { Page } from '@playwright/test';

import { expect, expectAccessible, test } from './fixtures';

/** An owned listing as GET /listings/mine/{id} returns it, complete enough to publish. */
function ownedListing(status: string) {
  return {
    id: 'listing-edit', title: 'Studio à renouveler', city: 'Rabat', neighborhood: 'Agdal',
    latitude: 33.9716, longitude: -6.8498, priceRent: 3000, description: 'Une chambre calme proche du tramway.',
    propertyType: 'STUDIO', roomType: 'PRIVATE', roomFurnishing: 'FULLY_FURNISHED',
    // In the past, as on any listing old enough to expire.
    availableFrom: '2026-01-15',
    minStayMonths: null, priceDeposit: null, wifiIncluded: 'NA', electricityIncluded: 'NA', waterIncluded: 'NA',
    numBedrooms: null, numBathrooms: null, currentRoommatesCount: null, maxRoommates: null,
    amenityCodes: [], houseRules: null, rooms: [], status,
  };
}

/** Serves one owned listing to the wizard and records what the wizard sends back. */
async function serveOwnedListing(page: Page, status: string) {
  const calls: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
  await page.route('**/api/v1/listings/mine/listing-edit', (route) => route.fulfill({ json: ownedListing(status) }));
  await page.route('**/api/v1/listings/listing-edit/photos', (route) => route.fulfill({
    json: [{ id: 'photo-edit', url: '/uploads/e2e-photo.jpg', mimeType: 'image/jpeg', width: 1200, height: 900, sortOrder: 0, isCover: true, createdAt: '2026-01-15T10:00:00Z' }],
  }));
  await page.route('**/api/v1/listings/listing-edit{,/submit,/renew}', async (route) => {
    const request = route.request();
    calls.push({ method: request.method(), path: new URL(request.url()).pathname, body: request.postDataJSON() });
    // As the API: renew and a PATCH of a PUBLISHED listing send it to review;
    // a PATCH leaves an expired or suspended listing's status as it was.
    const toReview = request.url().endsWith('/renew') || (request.method() === 'PATCH' && status === 'PUBLISHED');
    await route.fulfill({ json: { ...ownedListing(status), status: toReview ? 'PENDING_REVIEW' : status } });
  });
  return calls;
}

async function walkToValidation(page: Page) {
  await expect(page.getByLabel('Titre de l’annonce')).toHaveValue('Studio à renouveler');
  await walkToValidationFromAnyTitle(page);
}

async function walkToValidationFromAnyTitle(page: Page) {
  for (let step = 0; step < 5; step += 1) await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.getByText('Vérification avant publication')).toBeVisible();
}

test('saving an expired listing in the wizard renews it', async ({ authenticatedPage: page }) => {
  const calls = await serveOwnedListing(page, 'EXPIRED');

  await page.goto('/publish?listing=listing-edit');
  await walkToValidation(page);
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();

  await expect(page.getByRole('status')).toHaveText('Annonce envoyée pour validation.');
  expect(calls.map(({ method, path }) => `${method} ${path}`)).toContain('POST /api/v1/listings/listing-edit/renew');
  expect(calls.some(({ path }) => path.endsWith('/submit'))).toBe(false);
  // The API refuses a past availableFrom; an unchanged one must not be sent back.
  expect(calls.filter(({ method }) => method === 'PATCH').every(({ body }) => body?.availableFrom === null)).toBe(true);
});

test('opening a live listing in the wizard and clicking through saves nothing', async ({ authenticatedPage: page }) => {
  const calls = await serveOwnedListing(page, 'PUBLISHED');

  await page.goto('/publish?listing=listing-edit');
  await walkToValidation(page);
  expect(calls.filter(({ method }) => method === 'PATCH'), 'Suivant on a live listing').toHaveLength(0);

  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(page.getByRole('status')).toHaveText('Aucune modification : l’annonce reste en ligne.');
  expect(calls, 'an unchanged live listing is never sent back to review').toHaveLength(0);
});

test('a changed live listing is saved exactly once, at the end', async ({ authenticatedPage: page }) => {
  const calls = await serveOwnedListing(page, 'PUBLISHED');

  await page.goto('/publish?listing=listing-edit');
  await expect(page.getByLabel('Titre de l’annonce')).toHaveValue('Studio à renouveler');
  await page.getByLabel('Titre de l’annonce').fill('Studio rénové');
  await walkToValidationFromAnyTitle(page);
  expect(calls.filter(({ method }) => method === 'PATCH')).toHaveLength(0);

  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(page.getByRole('status')).toHaveText('Annonce envoyée pour validation.');
  const patches = calls.filter(({ method }) => method === 'PATCH');
  expect(patches).toHaveLength(1);
  expect(patches[0]?.body).toMatchObject({ title: 'Studio rénové' });
  expect(calls.some(({ path }) => path.endsWith('/submit') || path.endsWith('/renew'))).toBe(false);
});

test('a suspended listing cannot be republished from the wizard and claims nothing', async ({ authenticatedPage: page }) => {
  const calls = await serveOwnedListing(page, 'SUSPENDED');

  await page.goto('/publish?listing=listing-edit');
  await walkToValidation(page);

  // Filtered: Next's route announcer is an (empty) alert too.
  await expect(page.getByRole('alert').filter({ hasText: 'suspendue par la modération' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer les modifications' })).toBeDisabled();
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(calls.some(({ path }) => path.endsWith('/submit') || path.endsWith('/renew'))).toBe(false);
  await expectAccessible(page);
});

/*
 * The owner dashboard's lifecycle actions for statuses the shared mock does
 * not seed. Each test swaps the listing's status in the mock's own
 * /listings/mine response, so the rest of the row stays the real shape.
 */

test('a suspended listing tells its owner why and offers no action that cannot work', async ({ authenticatedPage: page }) => {
  await page.route('**/api/v1/listings/mine', async (route) => {
    const mine = await (await route.fetch()).json();
    mine.items = mine.items.map((listing: Record<string, unknown>) => ({
      ...listing, status: 'SUSPENDED', rejectionReason: 'Photos ne correspondant pas au logement',
    }));
    await route.fulfill({ json: mine });
  });

  await page.goto('/account/listings');
  await expect(page.getByText('Suspendue par la modération : Photos ne correspondant pas au logement.')).toBeVisible();
  await expect(page.getByText('seule la modération peut la rétablir')).toBeVisible();
  for (const action of ['Soumettre', 'Renouveler', 'Chambre trouvée']) {
    await expect(page.getByRole('button', { name: action })).toHaveCount(0);
  }
  await expectAccessible(page);
});

test('an expired listing can be renewed from the dashboard', async ({ authenticatedPage: page }) => {
  await page.route('**/api/v1/listings/mine', async (route) => {
    const mine = await (await route.fetch()).json();
    mine.items = mine.items.map((listing: Record<string, unknown>) => ({ ...listing, status: 'EXPIRED' }));
    await route.fulfill({ json: mine });
  });
  let renewed: string | null = null;
  await page.route('**/api/v1/listings/*/renew', async (route) => {
    renewed = new URL(route.request().url()).pathname;
    await route.fulfill({ json: {} });
  });

  await page.goto('/account/listings');
  await expect(page.getByText('Expirée')).toBeVisible();
  await page.getByRole('button', { name: 'Renouveler' }).click();

  await expect.poll(() => renewed).toBe('/api/v1/listings/listing-own/renew');
  // Back in the moderation queue, so the action is gone and the status says so.
  await expect(page.getByText('En cours de vérification')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Renouveler' })).toHaveCount(0);
  await expectAccessible(page);
});
