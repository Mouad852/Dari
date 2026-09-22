import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/*
 * The publish wizard, start to finish, with no mouse event of any kind: every
 * control is reached with Tab and operated with Enter, Space or typing. The
 * other journeys all use click()/fill(), which say nothing about whether the
 * flow can be completed from a keyboard at all.
 */

/**
 * What the focused element would be announced as. Only real controls: reading
 * textContent off a focused container returns the whole page, which matches
 * every regex here.
 */
async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return '';
    const tag = element.tagName;
    if (!['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(tag)) return `<${tag}>`;
    const label = (element as HTMLInputElement).labels?.[0]?.textContent ?? '';
    const text = tag === 'BUTTON' || tag === 'A' ? element.textContent ?? '' : '';
    return [element.getAttribute('aria-label'), label, text]
      .filter(Boolean)
      .join(' | ')
      .replace(/\s+/g, ' ')
      .trim();
  });
}

/**
 * Tab forward until the named control has focus. Never clicks. The order wraps
 * through the footer and the nav on the way back to the form, which is exactly
 * what a keyboard user walks.
 */
async function tabTo(page: Page, name: RegExp, limit = 120): Promise<void> {
  const seen: string[] = [];
  for (let step = 0; step < limit; step += 1) {
    const current = await focusedName(page);
    if (name.test(current)) return;
    seen.push(current);
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab never reached ${name}. Focus order seen: ${seen.join(' -> ')}`);
}

async function typeInto(page: Page, name: RegExp, value: string): Promise<void> {
  await tabTo(page, name);
  await page.keyboard.type(value);
}

test('the publish wizard can be completed without a mouse', async ({ authenticatedPage: page }) => {
  test.slow();
  await page.goto('/publish');
  await expect(page.getByLabel('Titre de l’annonce')).toBeVisible();

  await typeInto(page, /Titre de l’annonce/, 'Chambre clavier E2E');
  await typeInto(page, /Quartier/, 'Agdal');

  // The map has a keyboard alternative: this button reveals lat/lng fields.
  await tabTo(page, /Saisir les coordonnées/);
  await page.keyboard.press('Enter');
  await typeInto(page, /Latitude/, '33.9716');
  await typeInto(page, /Longitude/, '-6.8498');
  await typeInto(page, /Description/, 'Une chambre calme pour une colocation respectueuse.');

  const next = async () => {
    await tabTo(page, /^Suivant$/);
    await page.keyboard.press('Enter');
  };

  await next(); // Annonce -> Pièces
  await next(); // Pièces -> Chambre
  await typeInto(page, /Loyer mensuel/, '3200');
  await next(); // Chambre -> Règles
  await next(); // Règles -> Photos

  // Enter on the button opens the file chooser the hidden input drives.
  await tabTo(page, /Sélectionner des fichiers/);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.keyboard.press('Enter'),
  ]);
  await chooser.setFiles({ name: 'cover.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('e2e-image') });
  await expect(page.getByAltText('Photo 1 de l’annonce')).toBeVisible();

  await next(); // Photos -> Validation
  await tabTo(page, /Publier l’annonce/);
  await page.keyboard.press('Enter');

  await expect(page.getByRole('status')).toContainText('envoyée pour validation');
});
