import { expect, expectAccessible, test } from './fixtures';

test('a listing says who offers it and leads to their profile and its report action', async ({ page }) => {
  await page.goto('/listings/listing-1');

  const host = page.getByRole('region', { name: 'Proposé par' });
  await expect(host).toBeVisible();
  await expect(host.getByText('Amina')).toBeVisible();
  await expect(host.getByText('Email vérifié')).toBeVisible();
  await expect(host.getByText(/^Membre depuis /)).toBeVisible();
  await expectAccessible(page);

  await host.getByRole('link', { name: 'Voir le profil' }).click();
  await expect(page).toHaveURL(/\/profile\/other-user$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Amina' })).toBeVisible();

  await page.getByRole('button', { name: 'Signaler ce profil' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
