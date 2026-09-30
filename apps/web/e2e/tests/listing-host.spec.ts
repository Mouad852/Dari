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
  // The App Router changes the URL only once the new route has loaded, and under
  // `next dev` the first visit compiles /profile/[id] first: past 5 s when the
  // full suite loads the machine (failed twice on 2026-09-30, never alone).
  await expect(page).toHaveURL(/\/profile\/other-user$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Amina' })).toBeVisible();
  // The uploaded photo, not just the initial, and it actually loads from the media origin.
  const avatar = page.locator('main img[src*="/uploads/avatars/other-user.png"]');
  await expect(avatar).toBeVisible();
  await expect.poll(() => avatar.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Signaler ce profil' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('description, house rules and bio keep the line breaks their author typed', async ({ page }) => {
  // innerText reflects rendering: a newline survives only where it is drawn as a line break.
  await page.goto('/listings/listing-1');
  const description = page.getByRole('main').getByText(/^Une chambre calme/);
  await expect.poll(() => description.evaluate((element: HTMLElement) => element.innerText)).toMatch(/^Une chambre calme\.\nCharges comprises\./);
  await expect(page.getByText(/^Ménage le samedi/)).toHaveJSProperty('innerText', 'Ménage le samedi.\nPas de fête.');

  await page.goto('/profile/other-user');
  await expect(page.getByText(/^Étudiante à Rabat/)).toHaveJSProperty('innerText', 'Étudiante à Rabat.\nNon-fumeuse.');
});
