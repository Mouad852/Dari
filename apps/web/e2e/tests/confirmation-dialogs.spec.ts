import type { Page } from '@playwright/test';

import { expect, expectAccessible, test } from './fixtures';

/*
 * Confirmations that used to ask through window.confirm / window.prompt and
 * use the app's Dialog now. These prove the parts a native dialog could not:
 * it is scanned by axe while open, focus stays inside it and comes back to the
 * button that opened it, Escape or "Annuler" cancels without a request, and an
 * optional reason is a labelled field whose text reaches the API.
 */

const MOCK = 'http://127.0.0.1:4110';

/** Any native dialog is a regression: record it, dismiss it, assert none at the end. */
function refuseNativeDialogs(page: Page) {
  const seen: string[] = [];
  page.on('dialog', (dialog) => {
    seen.push(`${dialog.type()}: ${dialog.message()}`);
    void dialog.dismiss();
  });
  return seen;
}

async function mockCalls(page: Page) {
  return (await (await page.request.get(`${MOCK}/__calls`)).json()) as { method: string; path: string }[];
}

/** Tab through twice as many stops as the dialog has; focus must never leave it. */
async function expectFocusTrapped(page: Page) {
  const dialog = page.getByRole('dialog');
  const stops = await dialog.locator('button, textarea, input, a[href]').count();
  for (let i = 0; i < stops * 2; i += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
}

test('deleting a listing asks in a dialog that cancels cleanly and deletes on confirm', async ({ authenticatedPage: page }) => {
  const nativeDialogs = refuseNativeDialogs(page);
  await page.goto('/account/listings');
  await expect(page.getByRole('heading', { name: 'Studio calme à Hassan' })).toBeVisible();

  const opener = page.getByRole('button', { name: 'Supprimer', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Supprimer cette annonce ?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Studio calme à Hassan');
  await expectAccessible(page);
  await expectFocusTrapped(page);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  expect((await mockCalls(page)).filter((call) => call.method === 'DELETE'), 'Escape deletes nothing').toEqual([]);

  await opener.click();
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Studio calme à Hassan' })).toHaveCount(0);
  expect((await mockCalls(page)).filter((call) => call.method === 'DELETE').map((call) => call.path))
    .toEqual(['/listings/listing-own']);
  // The card and its button are gone; focus falls back to the page heading.
  await expect(page.getByRole('heading', { name: 'Mes annonces' })).toBeFocused();
  expect(nativeDialogs).toEqual([]);
});
