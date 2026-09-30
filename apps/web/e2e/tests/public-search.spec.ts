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

test('typing a neighbourhood searches once, when the typing pauses, and keeps every character', async ({ page }) => {
  await page.goto('/listings?city=Rabat');
  await expect(page.getByText('Chambre lumineuse à Agdal')).toBeVisible();
  const searches: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/api/v1/listings')) searches.push(url.search);
  });

  const quartier = page.getByRole('combobox', { name: 'Quartier', exact: true });
  await quartier.pressSequentially('Hay Riad', { delay: 60 });
  await expect(page).toHaveURL(/neighborhood=Hay\+Riad/);
  await expect(quartier).toHaveValue('Hay Riad');
  // Longer than the debounce, so a second search would have started by now.
  await page.waitForTimeout(1_000);
  expect(searches, 'one /listings request for eight characters').toHaveLength(1);
  expect(searches[0]).toContain('neighborhood=Hay+Riad');
});

test('a radius search asks around the city centre instead of by city', async ({ page }) => {
  await page.goto('/listings?city=Rabat&neighborhood=Agdal');
  await expect(page.getByText('Chambre lumineuse à Agdal')).toBeVisible();
  const radiusSearch = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === 'GET' && url.pathname.endsWith('/api/v1/listings') && url.searchParams.has('radiusM');
  });
  // The radio input is visually hidden behind its styled label, which is what a person clicks.
  await page.getByRole('group', { name: 'Mode de recherche' }).getByText('Rayon', { exact: true }).click();

  const query = new URL((await radiusSearch).url()).searchParams;
  expect(query.get('radiusM')).toBe('2500');
  expect(query.get('lat')).not.toBeNull();
  expect(query.get('lng')).not.toBeNull();
  expect(query.has('city')).toBe(false);
  expect(query.has('neighborhood')).toBe(false);
  expect(query.get('sort')).toBe('closest');
});
