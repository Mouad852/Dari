import { expect, expectAccessible, test } from './fixtures';

test('signup provisions the profile through the API-owned boundary', async ({ authenticatedPage: page }) => {
  let profileCreated = false;
  await page.route('**/api/v1/users', async (route) => {
    if (route.request().method() === 'POST') profileCreated = true;
    await route.continue();
  });

  await page.goto('/sign-up');
  await page.getByLabel('Prénom').fill('Nadia');
  await page.getByRole('textbox', { name: 'Nom', exact: true }).fill('Test');
  await page.getByLabel('Ville (facultatif)').fill('Rabat');
  await page.getByLabel('E-mail').fill('nadia@example.invalid');
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: /créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/account$/);
  expect(profileCreated).toBeTruthy();
  await expectAccessible(page);
});

test('listing publication covers the wizard, photo upload, and moderation handoff', async ({ authenticatedPage: page }) => {
  await page.goto('/publish');
  await page.getByLabel("Titre de l’annonce").fill('Chambre test E2E');
  await page.getByRole('textbox', { name: 'Quartier', exact: true }).fill('Agdal');
  await page.getByRole('button', { name: /saisir les coordonnées/i }).click();
  await page.getByLabel('Latitude').fill('33.9716');
  await page.getByLabel('Longitude').fill('-6.8498');
  await page.getByLabel('Description').fill('Une chambre calme pour une colocation respectueuse.');

  for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByLabel('Loyer mensuel').fill('3200');
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: 'Suivant' }).click();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: 'cover.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('e2e-image') });
  await expect(page.getByAltText('Photo 1 de l’annonce')).toBeVisible();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: /publier l’annonce/i }).click();
  await expect(page.getByRole('status')).toContainText('envoyée pour validation');
  await expectAccessible(page);
});

test('favorites, messaging, reporting, moderation, and account deletion remain application-owned', async ({ authenticatedPage: page }) => {
  // Six routes, each compiled on first visit under `next dev`: a cold run
  // measured 29-33s against the default 30s budget, while warm runs take ~16s.
  test.slow();
  await page.goto('/listings?city=Rabat');
  await page.getByRole('button', { name: 'Enregistrer' }).first().click();
  await page.goto('/favorites');
  await expect(page.getByText('Chambre lumineuse à Agdal')).toBeVisible();

  await page.goto('/messages');
  await page.getByRole('link', { name: /amina/i }).click();
  await page.getByLabel('Écrire un message').fill('Bonjour, je suis intéressé.');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Bonjour, je suis intéressé.')).toBeVisible();

  await page.goto('/listings/listing-1');
  await page.getByRole('button', { name: /signaler/i }).click();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: /envoyer le signalement/i }).click();
  await expect(page.getByRole('heading', { name: /signalement reçu/i })).toBeVisible();

  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Réactiver' }).click();
  await expect(page.getByText('Actif')).toBeVisible();
  await expectAccessible(page);

  await page.goto('/account/profile');
  let deletionRequested = false;
  await page.route('**/api/v1/users/me', async (route) => {
    if (route.request().method() === 'DELETE') deletionRequested = true;
    await route.continue();
  });
  // The confirmation is the app's own Dialog now, so this is a real click and
  // real typing -- dispatchEvent('click') existed only to get past confirm().
  await page.getByRole('button', { name: /supprimer définitivement mon compte/i }).click();
  const confirmation = page.getByRole('dialog');
  await expect(confirmation).toBeVisible();
  await expectAccessible(page);

  // Escape cancels, and focus goes back to the button that opened it.
  await page.keyboard.press('Escape');
  await expect(confirmation).toBeHidden();
  await expect(page.getByRole('button', { name: /supprimer définitivement mon compte/i })).toBeFocused();
  expect(deletionRequested, 'cancelling deletes nothing').toBe(false);

  await page.getByRole('button', { name: /supprimer définitivement mon compte/i }).click();
  // Not armed until the word is typed exactly.
  await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toBeDisabled();
  await page.getByLabel('Tapez SUPPRIMER pour confirmer').fill('SUPPRIMER');
  await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
  await expect.poll(() => deletionRequested).toBe(true);
});
