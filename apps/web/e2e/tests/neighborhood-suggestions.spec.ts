import { expect, test } from './fixtures';

/*
 * "Quartier" stays free text, but both the owner and the seeker are offered
 * the city's seeded names, so the two spell a neighborhood the same way.
 */

test('the publish wizard suggests the chosen city\'s neighborhoods', async ({ authenticatedPage: page }) => {
  const asked: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/v1/neighborhoods') asked.push(url.searchParams.get('city') ?? '');
  });

  await page.goto('/publish');
  await expect(page.getByRole('combobox', { name: 'Quartier', exact: true })).toHaveAttribute('list', 'wizard-neighborhoods');
  await expect(page.locator('#wizard-neighborhoods option')).toHaveCount(2);
  await expect(page.locator('#wizard-neighborhoods option').first()).toHaveAttribute('value', 'Agdal');

  await page.getByRole('main').getByLabel('Ville').selectOption('Casablanca');
  await expect.poll(() => asked).toContain('Casablanca');
  expect(asked[0]).toBe('Rabat');
});

test('the search filter suggests the searched city\'s neighborhoods', async ({ page }) => {
  await page.goto('/listings?city=Rabat');
  await expect(page.getByRole('combobox', { name: 'Quartier', exact: true })).toHaveAttribute('list', 'search-neighborhoods');
  await expect(page.locator('#search-neighborhoods option')).toHaveCount(2);
});
