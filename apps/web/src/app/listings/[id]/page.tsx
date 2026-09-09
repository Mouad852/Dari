import type { Metadata } from 'next';

import { apiFetch, ApiError, apiOrigin } from '@/lib/api';
import { amount } from '@/lib/format';
import type { PublicListingDetail } from '@/types/api';

import { AuthenticatedPreview } from './AuthenticatedPreview';
import { ListingDetailContent } from './ListingDetailContent';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Fetched once per request and reused by both generateMetadata and the page.
 *
 * Next dedupes identical fetches within a request, but ApiError has to be
 * swallowed into null here: an uncaught throw inside generateMetadata fails the
 * whole route rather than producing the 404 a missing listing should give.
 */
async function getListing(id: string): Promise<PublicListingDetail | null> {
  try {
    return await apiFetch<PublicListingDetail>(`/listings/${encodeURIComponent(id)}`);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    // A listing that is gone, suspended or no longer available must not stay
    // indexed under its old description. This stays unconditional even
    // though the page body below can now recover an owner/admin preview
    // client-side: search engines never carry a Firebase token, so the
    // metadata a crawler sees should always say "not found" for anything
    // that isn't genuinely public, regardless of who's actually looking.
    return { title: 'Annonce introuvable', robots: { index: false, follow: false } };
  }

  const price = amount(listing.priceRent);
  const title = `${listing.title} — ${listing.neighborhood}, ${listing.city}`;
  const description =
    listing.description?.slice(0, 155) ??
    `Chambre en colocation à ${listing.neighborhood}, ${listing.city}. ${price} MAD par mois.`;
  const cover = listing.photos[0];

  return {
    title,
    description,
    alternates: { canonical: `${SITE}/listings/${listing.id}` },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE}/listings/${listing.id}`,
      locale: 'fr_MA',
      images: cover ? [{ url: `${apiOrigin}${cover.url}` }] : undefined,
    },
  };
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListing(id);

  /**
   * An anonymous 404 here does not mean "gone" -- it means "not public",
   * which is also true of the owner's own draft and every listing a
   * moderator needs to review. AuthenticatedPreview retries client-side with
   * the real Firebase token before settling on genuinely not found. See its
   * own comment for the bug this fixes.
   */
  if (!listing) return <AuthenticatedPreview id={id} />;

  return <ListingDetailContent listing={listing} />;
}
