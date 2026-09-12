import { MapPin } from 'lucide-react';

import { FocusOnMount } from '@/components/FocusOnMount';
import { ReportDialog } from '@/components/ReportDialog';
import { amount } from '@/lib/format';
import { AMENITY_LABELS, PROPERTY_TYPE_LABELS, ROOM_TYPE_LABELS } from '@/lib/labels';
import { apiOrigin } from '@/lib/api';
import type { PublicListingDetail } from '@/types/api';

import { ContactOwnerButton } from './ContactOwnerButton';
import { ListingGallery } from './ListingGallery';

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

const sectionHeadingStyle = { margin: '0 0 var(--space-3)', font: 'var(--type-h3)' };

/**
 * The actual detail view, pulled out of `page.tsx` so it can be rendered from
 * two different places: the fast, unauthenticated server path (the common
 * case -- every real visitor), and `AuthenticatedPreview`'s client-side
 * fetch, which is the only path that can ever satisfy `getPublicOrOwner
 * ListingDetail`'s owner/admin bypass -- see that file for why the split
 * exists at all.
 */
export function ListingDetailContent({ listing }: { listing: PublicListingDetail }) {
  const propertyLabel = listing.propertyType ? PROPERTY_TYPE_LABELS[listing.propertyType] : null;
  const roomLabel = listing.roomType ? ROOM_TYPE_LABELS[listing.roomType] : null;
  const cover = listing.photos[0];

  const rules = listing.houseRules;
  const smokingLabel = rules?.smokingAllowed == null ? null : rules.smokingAllowed ? 'Fumeurs autorisés' : 'Non-fumeurs';
  const petsLabel = rules?.petsAllowed == null ? null : rules.petsAllowed ? 'Animaux acceptés' : 'Animaux non acceptés';
  const guestsLabel = rules?.guestsAllowed == null ? null : rules.guestsAllowed ? 'Invités autorisés' : 'Invités non autorisés';
  const quietHours = rules?.quietHoursStart && rules?.quietHoursEnd
    ? `Heures de silence : ${rules.quietHoursStart.slice(0, 5)} – ${rules.quietHoursEnd.slice(0, 5)}`
    : null;
  const hasRules = Boolean(smokingLabel || petsLabel || guestsLabel || quietHours || rules?.otherRules);

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
      <FocusOnMount targetId="listing-heading" />

      <div style={{ padding: 'var(--space-6) var(--gutter-mobile)', display: 'grid', gap: 'var(--space-6)', maxWidth: 900, margin: '0 auto' }}>
        <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <h1 id="listing-heading" tabIndex={-1} style={{ margin: 0, font: 'var(--type-h1)' }}>{listing.title}</h1>
          <p style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center', font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
            <MapPin size={14} />
            {listing.neighborhood}, {listing.city}
          </p>
          <strong style={{ font: 'var(--weight-bold) 26px/1.2 var(--font-ui)', color: 'var(--text-price)' }}>
            {amount(listing.priceRent)}{' '}
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

        {/*
          `!= null`, loose on purpose, at all four sites below.

          These fields are declared `number | null` in src/types/api.ts, but the
          API was configured to omit null properties, so an unset one arrived as
          `undefined` — and `undefined !== null` is true. The guards passed, the
          spans rendered, and the page showed a bare "chambre", "salle de bain"
          and "Séjour minimum : mois" with the numbers missing. Found on the
          first listing ever published through the wizard, which had none of
          them filled in.

          The server now sends nulls (spring.jackson.default-property-inclusion),
          so the declared type is true again. These stay loose anyway: a page
          should not print a unit with no quantity because a payload changed
          shape.
        */}
        {(listing.amenityCodes.length > 0 || listing.numBedrooms != null || listing.numBathrooms != null) && (
          <section>
            <h2 style={sectionHeadingStyle}>Le logement</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {listing.numBedrooms != null && <span>{listing.numBedrooms} chambre{listing.numBedrooms > 1 ? 's' : ''}</span>}
              {listing.numBathrooms != null && <span>{listing.numBathrooms} salle{listing.numBathrooms > 1 ? 's' : ''} de bain</span>}
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
            {listing.minStayMonths != null && <span>Séjour minimum : {listing.minStayMonths} mois</span>}
          </div>
        </section>

        {hasRules && (
          <section>
            <h2 style={sectionHeadingStyle}>Règles de la maison</h2>
            <div style={{ display: 'grid', gap: 8, color: 'var(--text-muted)' }}>
              {smokingLabel && <span>{smokingLabel}</span>}
              {petsLabel && <span>{petsLabel}</span>}
              {guestsLabel && <span>{guestsLabel}</span>}
              {quietHours && <span>{quietHours}</span>}
              {rules?.otherRules && <span>{rules.otherRules}</span>}
            </div>
          </section>
        )}

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
