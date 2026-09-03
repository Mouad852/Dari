import { MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ReportDialog } from '@/components/ReportDialog';
import { apiFetch, ApiError, apiOrigin } from '@/lib/api';
import { AMENITY_LABELS, PROPERTY_TYPE_LABELS, ROOM_TYPE_LABELS } from '@/lib/labels';
import type { PublicListingDetail } from '@/types/api';

import { ContactOwnerButton } from './ContactOwnerButton';
import { ListingGallery } from './ListingGallery';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function chargeLabel(value: PublicListingDetail['wifiIncluded']): string {
  if (value === 'INCLUDED') return 'Compris';
  if (value === 'NOT_INCLUDED') return 'En supplément';
  return 'Non précisé';
}

const furnishingLabels: Record<NonNullable<PublicListingDetail['roomFurnishing']>, string> = {
  FULLY_FURNISHED: 'Chambre meublée',
  PARTIALLY_FURNISHED: 'Chambre partiellement meublée',
  UNFURNISHED: 'Chambre non meublée',
};

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
    // indexed under its old description.
    return { title: 'Annonce introuvable', robots: { index: false, follow: false } };
  }

  const price = new Intl.NumberFormat('fr-MA').format(listing.priceRent);
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

  // A suspended, expired or room-found listing 404s at the API, and this turns
  // that into a real 404 status rather than a 200 page saying "unavailable" --
  // which is what keeps it from staying in the index.
  if (!listing) notFound();

  const propertyLabel = listing.propertyType ? PROPERTY_TYPE_LABELS[listing.propertyType] : null;
  const roomLabel = listing.roomType ? ROOM_TYPE_LABELS[listing.roomType] : null;
  const cover = listing.photos[0];

  /**
   * schema.org Accommodation. The design doc rules out JobPosting-style markup;
   * this is the accommodation equivalent, with the offer carrying the monthly
   * rent so a result can show a price.
   *
   * Coordinates are deliberately absent: the ones in this response are fuzzed,
   * and publishing a fuzzed point as structured geo data would state a precision
   * the product intentionally does not have.
   */
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Accommodation',
    name: listing.title,
    description: listing.description ?? undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: listing.city,
      addressRegion: listing.neighborhood,
      addressCountry: 'MA',
    },
    numberOfBedrooms: listing.numBedrooms ?? undefined,
    numberOfBathroomsTotal: listing.numBathrooms ?? undefined,
    amenityFeature: listing.amenityCodes.map((code) => ({
      '@type': 'LocationFeatureSpecification',
      name: AMENITY_LABELS[code] ?? code,
      value: true,
    })),
    image: cover ? `${apiOrigin}${cover.url}` : undefined,
    offers: {
      '@type': 'Offer',
      price: listing.priceRent,
      priceCurrency: 'MAD',
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-heading)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <ListingGallery listingId={listing.id} title={listing.title} photos={listing.photos} />

      <div style={{ padding: 'var(--space-6) var(--gutter-mobile)', display: 'grid', gap: 'var(--space-6)', maxWidth: 900, margin: '0 auto' }}>
        <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <h1 style={{ margin: 0, font: 'var(--type-h1)' }}>{listing.title}</h1>
          <p style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center', font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
            <MapPin size={14} />
            {listing.neighborhood}, {listing.city}
          </p>
          <strong style={{ font: 'var(--weight-bold) 26px/1.2 var(--font-ui)', color: 'var(--text-price)' }}>
            {new Intl.NumberFormat('fr-MA').format(listing.priceRent)}{' '}
            <small style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>MAD/mois</small>
          </strong>
          {(propertyLabel || roomLabel || listing.roomFurnishing) && (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              {[propertyLabel, roomLabel, listing.roomFurnishing ? furnishingLabels[listing.roomFurnishing] : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </section>

        {listing.description && (
          <section>
            <h2 style={sectionHeadingStyle}>À propos du logement</h2>
            <p style={{ margin: 0, lineHeight: 1.7 }}>{listing.description}</p>
          </section>
        )}

        {(listing.amenityCodes.length > 0 || listing.numBedrooms !== null || listing.numBathrooms !== null) && (
          <section>
            <h2 style={sectionHeadingStyle}>Le logement</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {listing.numBedrooms !== null && <span>{listing.numBedrooms} chambre{listing.numBedrooms > 1 ? 's' : ''}</span>}
              {listing.numBathrooms !== null && <span>{listing.numBathrooms} salle{listing.numBathrooms > 1 ? 's' : ''} de bain</span>}
              {listing.amenityCodes.map((code) => (
                <span key={code}>{AMENITY_LABELS[code] ?? code}</span>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 style={sectionHeadingStyle}>Charges et disponibilité</h2>
          <div style={{ display: 'grid', gap: 8, color: 'var(--text-muted)' }}>
            <span>Wi-Fi : {chargeLabel(listing.wifiIncluded)}</span>
            <span>Électricité : {chargeLabel(listing.electricityIncluded)}</span>
            <span>Eau : {chargeLabel(listing.waterIncluded)}</span>
            {listing.availableFrom && (
              <span>
                Disponible à partir du{' '}
                {new Intl.DateTimeFormat('fr-MA').format(new Date(`${listing.availableFrom}T00:00:00`))}
              </span>
            )}
            {listing.minStayMonths !== null && <span>Séjour minimum : {listing.minStayMonths} mois</span>}
          </div>
        </section>

        <ContactOwnerButton listingId={listing.id} />

        {/*
          Sits after the primary action, not beside it: reporting is a rare,
          deliberate act and should not compete with contacting the owner.
        */}
        <div style={{ paddingTop: 'var(--space-2)' }}>
          <ReportDialog targetType="LISTING" targetId={listing.id} label="Signaler cette annonce" />
        </div>
      </div>
    </main>
  );
}

const sectionHeadingStyle = { margin: '0 0 var(--space-3)', font: 'var(--type-h3)' };
