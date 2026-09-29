import { expect, expectAccessible, test } from './fixtures';

/*
 * The owner dashboard's lifecycle actions for statuses the shared mock does
 * not seed. Each test swaps the listing's status in the mock's own
 * /listings/mine response, so the rest of the row stays the real shape.
 */

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
