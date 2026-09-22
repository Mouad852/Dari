import { expect, test } from './fixtures';

/*
 * The gallery's controls were an 8x8 dot per photo: under the 24x24 WCAG 2.5.8
 * target, state carried by background colour alone, no prev/next, no arrow
 * keys. Everything here is done from the keyboard.
 */
test('the gallery moves with arrow keys, and its dots are real targets', async ({ page }) => {
  await page.goto('/listings/listing-1');

  const gallery = page.getByRole('group', { name: /Photos de l’annonce/ });
  await expect(gallery).toBeVisible();
  await expect(page.getByRole('button', { name: 'Photo précédente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Photo suivante' })).toBeVisible();

  const dots = page.getByRole('button', { name: /^Photo \d+ sur \d+$/ });
  await expect(dots).toHaveCount(2);
  for (const dot of await dots.all()) {
    const box = await dot.boundingBox();
    expect(box?.width, 'target width').toBeGreaterThanOrEqual(24);
    expect(box?.height, 'target height').toBeGreaterThanOrEqual(24);
  }
  await expect(page.getByRole('button', { name: 'Photo 1 sur 2' })).toHaveAttribute('aria-current', 'true');

  await gallery.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Photo 2 sur 2' })).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('img[alt*="photo 2 sur 2"]')).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: 'Photo 1 sur 2' })).toHaveAttribute('aria-current', 'true');
});
