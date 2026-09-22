import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

/*
 * The API returns root-relative /uploads paths from local storage and absolute
 * URLs from S3/CloudFront. The first must be resolved against the first public
 * media origin, the second passed through untouched, and neither may ever be
 * built from API_BASE_URL (which can name an internal host).
 */
const RELATIVE_COVER = '/uploads/listings/e2e-owner/e2e-relative-cover.png';
const ABSOLUTE_COVER_PATH = '/cdn/listings/e2e-owner/e2e-absolute-cover.png';

/** A ListingCard is a div whose title link is the only anchor; find it by that link. */
function cardImage(page: Page, title: string) {
  return page
    .locator('div')
    .filter({ has: page.getByRole('link', { name: title, exact: true }) })
    .filter({ has: page.locator('img') })
    .last()
    .locator('img');
}

function origins() {
  const metadata = test.info().project.metadata as { mediaOrigin: string; cdnOrigin: string };
  return { media: metadata.mediaOrigin, cdn: metadata.cdnOrigin };
}

test('listing cards resolve relative photos on the media origin and keep absolute ones', async ({ page }) => {
  const { media, cdn } = origins();
  await page.goto('/');

  await expect(cardImage(page, 'Chambre lumineuse à Agdal')).toHaveAttribute('src', `${media}${RELATIVE_COVER}`);
  await expect(cardImage(page, 'Studio calme près du tramway')).toHaveAttribute('src', `${cdn}${ABSOLUTE_COVER_PATH}`);
});

test('listing detail gallery and social metadata use the public media origin', async ({ page }) => {
  const { media } = origins();
  await page.goto('/listings/listing-1');

  await expect(page.getByRole('img', { name: 'Chambre lumineuse à Agdal' })).toHaveAttribute('src', `${media}${RELATIVE_COVER}`);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${media}${RELATIVE_COVER}`);
});

test('the account avatar resolves on the media origin', async ({ authenticatedPage: page }) => {
  const { media } = origins();
  await page.goto('/account/profile');

  await expect(page.locator(`img[src="${media}/uploads/avatars/e2e-user-1.png"]`)).toBeVisible();
});
