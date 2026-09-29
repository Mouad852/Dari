import { expect, expectAccessible, test } from './fixtures';

test('the header search sends a city with the neighborhood', async ({ page }) => {
  await page.goto('/legal/privacy');
  const header = page.getByRole('search').filter({ has: page.getByRole('searchbox', { name: 'Rechercher un quartier' }) });
  await expect(header.getByRole('combobox', { name: 'Ville' })).toHaveValue('Rabat');

  await header.getByRole('combobox', { name: 'Ville' }).selectOption('Casablanca');
  await header.getByRole('searchbox', { name: 'Rechercher un quartier' }).fill('maarif');
  await header.getByRole('searchbox', { name: 'Rechercher un quartier' }).press('Enter');

  await expect(page).toHaveURL(/\/listings\?city=Casablanca&neighborhood=maarif$/);
});

test('search filters, paginates, and switches to the map', async ({ page }) => {
  await page.goto('/listings?city=Rabat');
  await expect(page.getByRole('heading', { name: /annonces.*rabat/i })).toBeVisible();
  await expect(page.getByText('Chambre lumineuse à Agdal')).toBeVisible();

  await page.getByRole('combobox', { name: 'Quartier', exact: true }).fill('Agdal');
  await expect(page).toHaveURL(/neighborhood=Agdal/);
  await page.getByRole('button', { name: /voir .*annonce/i }).click();
  await expect(page.getByText('Chambre lumineuse à Agdal')).toBeVisible();

  await page.getByRole('tab', { name: 'Carte' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('tab', { name: 'Résultats' }).click();
  await page.getByRole('button', { name: /afficher plus d.annonces/i }).click();
  await expect(page.getByText('Studio calme près du tramway')).toBeVisible();
});
