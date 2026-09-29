import { expect, expectAccessible, test } from './fixtures';

test('a moderator can reinstate a suspended listing from its own queue', async ({ authenticatedPage: page }) => {
  // The shared mock serves one queue whatever the status; the suspended one is
  // its listing, suspended, with the moderator's reason.
  await page.route(
    (url) => url.pathname === '/api/v1/admin/listings' && url.searchParams.get('status') === 'SUSPENDED',
    async (route) => {
      const pending = await (await route.fetch()).json();
      await route.fulfill({
        json: pending.map((listing: Record<string, unknown>) => ({
          ...listing, id: 'listing-suspended', status: 'SUSPENDED', rejectionReason: 'Photos trompeuses',
        })),
      });
    },
  );
  let reinstated: string | null = null;
  await page.route('**/api/v1/admin/listings/*/reinstate', async (route) => {
    reinstated = new URL(route.request().url()).pathname;
    await route.fulfill({ json: {} });
  });

  await page.goto('/admin/listings');
  await expect(page.getByRole('button', { name: 'Valider' })).toBeVisible();

  await page.getByRole('button', { name: 'Suspendues' }).click();
  await expect(page.getByRole('button', { name: 'Suspendues' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Motif de la suspension : Photos trompeuses')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Valider' })).toHaveCount(0);
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Réintégrer' }).click();
  await expect.poll(() => reinstated).toBe('/api/v1/admin/listings/listing-suspended/reinstate');
  await expect(page.getByText('Aucune annonce n’est suspendue.')).toBeVisible();
});
