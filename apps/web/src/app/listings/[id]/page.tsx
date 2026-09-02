'use client';

import { ArrowLeft, Heart, MapPin, MessageCircle, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { apiFetch, ApiError, apiOrigin } from '@/lib/api';
import { ReportDialog } from '@/components/ReportDialog';
import { getIdToken } from '@/lib/firebase';
import { AMENITY_LABELS, PROPERTY_TYPE_LABELS, ROOM_TYPE_LABELS } from '@/lib/labels';
import type { PublicListingDetail } from '@/types/api';

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

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<PublicListingDetail | null>(null);
  const [saved, setSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    let current = true;
    apiFetch<PublicListingDetail>(`/listings/${encodeURIComponent(params.id)}`)
      .then((result) => {
        if (current) setListing(result);
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setError(cause instanceof ApiError && cause.status === 404
          ? 'Cette annonce n’est plus disponible.'
          : cause instanceof ApiError ? cause.message : 'Une erreur est survenue');
      });
    return () => { current = false; };
  }, [params.id]);

  useEffect(() => {
    let current = true;
    void getIdToken().then(async (token) => {
      if (!token || !current) return;
      const ids = await apiFetch<string[]>('/favorites/ids', { token });
      if (current) setSaved(ids.includes(params.id));
    }).catch(() => {
      // A failed membership read must not prevent the public listing from rendering.
    });
    return () => { current = false; };
  }, [params.id]);

  const toggleSaved = async () => {
    if (savePending) return;
    const token = await getIdToken();
    if (!token) {
      router.push('/sign-in');
      return;
    }
    const next = !saved;
    setSaved(next);
    setSavePending(true);
    try {
      await apiFetch(`/favorites/${encodeURIComponent(params.id)}`, {
        method: next ? 'POST' : 'DELETE',
        token,
      });
    } catch {
      setSaved(!next);
    } finally {
      setSavePending(false);
    }
  };

  const contactOwner = async () => {
    if (!listing || contacting) return;
    const token = await getIdToken();
    if (!token) {
      router.push('/sign-in');
      return;
    }
    setContacting(true);
    try {
      const conversation = await apiFetch<{ id: string }>('/conversations', {
        method: 'POST',
        token,
        body: { listingId: listing.id },
      });
      router.push(`/messages/${conversation.id}`);
    } catch (cause) {
      setContactError(cause instanceof ApiError ? cause.message : 'Impossible de démarrer la conversation.');
      setContacting(false);
    }
  };

  if (error) {
    return (
      <main style={{ padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-muted)' }}>
        <h1 style={{ font: 'var(--type-h2)', color: 'var(--text-heading)' }}>{error}</h1>
        <a href="/listings" style={{ color: 'var(--brand)' }}>Voir les annonces disponibles</a>
      </main>
    );
  }
  if (!listing) {
    return <main style={{ padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-muted)' }}>Chargement de l’annonce…</main>;
  }

  const photos = listing.photos;
  const activePhoto = photos[photoIndex];
  const propertyLabel = listing.propertyType ? PROPERTY_TYPE_LABELS[listing.propertyType] : null;
  const roomLabel = listing.roomType ? ROOM_TYPE_LABELS[listing.roomType] : null;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      <div style={{ position: 'relative', height: 360, background: 'var(--sable-200)' }}>
        {activePhoto ? (
          <img
            src={`${apiOrigin}${activePhoto.url}`}
            alt={listing.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--sable-500)', font: 'var(--type-caption)', textTransform: 'uppercase' }}>
            Aucune photo
          </span>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim-image)' }} />
        <div style={{ position: 'absolute', top: 12, left: 'var(--gutter-mobile)', right: 'var(--gutter-mobile)', display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" aria-label="Retour" onClick={() => router.back()} style={iconButtonStyle}><ArrowLeft size={18} /></button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" aria-label="Partager" onClick={() => void navigator.clipboard?.writeText(window.location.href)} style={iconButtonStyle}><Share2 size={18} /></button>
            <button type="button" aria-label={saved ? 'Retirer des favoris' : 'Enregistrer'} onClick={() => void toggleSaved()} disabled={savePending} style={{ ...iconButtonStyle, background: saved ? 'rgba(255,255,255,0.95)' : 'var(--surface-glass)', color: saved ? 'var(--brand)' : '#fff' }}>
              <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
        {photos.length > 1 && (
          <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
            {photos.map((photo, index) => (
              <button key={photo.id} type="button" aria-label={`Photo ${index + 1}`} onClick={() => setPhotoIndex(index)} style={{ width: 8, height: 8, padding: 0, border: 0, borderRadius: 'var(--radius-pill)', background: index === photoIndex ? '#fff' : 'rgba(255,255,255,0.5)' }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: 'var(--space-6) var(--gutter-mobile)', display: 'grid', gap: 'var(--space-6)', maxWidth: 900, margin: '0 auto' }}>
        <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <h1 style={{ margin: 0, font: 'var(--type-h1)' }}>{listing.title}</h1>
          <p style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center', font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}><MapPin size={14} />{listing.neighborhood}, {listing.city}</p>
          <strong style={{ font: 'var(--weight-bold) 26px/1.2 var(--font-ui)', color: 'var(--text-price)' }}>
            {new Intl.NumberFormat('fr-MA').format(listing.priceRent)} <small style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>MAD/mois</small>
          </strong>
          {(propertyLabel || roomLabel || listing.roomFurnishing) && (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              {[propertyLabel, roomLabel, listing.roomFurnishing ? furnishingLabels[listing.roomFurnishing] : null].filter(Boolean).join(' · ')}
            </p>
          )}
        </section>

        {listing.description && <section><h2 style={sectionHeadingStyle}>À propos du logement</h2><p style={{ margin: 0, lineHeight: 1.7 }}>{listing.description}</p></section>}

        {(listing.amenityCodes.length > 0 || listing.numBedrooms !== null || listing.numBathrooms !== null) && (
          <section>
            <h2 style={sectionHeadingStyle}>Le logement</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {listing.numBedrooms !== null && <span>{listing.numBedrooms} chambre{listing.numBedrooms > 1 ? 's' : ''}</span>}
              {listing.numBathrooms !== null && <span>{listing.numBathrooms} salle{listing.numBathrooms > 1 ? 's' : ''} de bain</span>}
              {listing.amenityCodes.map((code) => <span key={code}>{AMENITY_LABELS[code] ?? code}</span>)}
            </div>
          </section>
        )}

        <section>
          <h2 style={sectionHeadingStyle}>Charges et disponibilité</h2>
          <div style={{ display: 'grid', gap: 8, color: 'var(--text-muted)' }}>
            <span>Wi-Fi : {chargeLabel(listing.wifiIncluded)}</span>
            <span>Électricité : {chargeLabel(listing.electricityIncluded)}</span>
            <span>Eau : {chargeLabel(listing.waterIncluded)}</span>
            {listing.availableFrom && <span>Disponible à partir du {new Intl.DateTimeFormat('fr-MA').format(new Date(`${listing.availableFrom}T00:00:00`))}</span>}
            {listing.minStayMonths !== null && <span>Séjour minimum : {listing.minStayMonths} mois</span>}
          </div>
        </section>

        {contactError && <p role="alert" style={{ color: 'var(--text-danger)' }}>{contactError}</p>}
        <button type="button" onClick={() => void contactOwner()} disabled={contacting} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0.85rem 1.2rem', border: 0, borderRadius: 'var(--radius-md)', background: 'var(--brand)', color: '#fff', font: 'var(--type-label)', cursor: 'pointer' }}>
          <MessageCircle size={17} /> {contacting ? 'Ouverture…' : 'Contacter'}
        </button>

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

const iconButtonStyle = {
  width: 40,
  height: 40,
  borderRadius: 'var(--radius-pill)',
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'var(--surface-glass)',
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'var(--blur-glass)',
  cursor: 'pointer',
} as const;

const sectionHeadingStyle = { margin: '0 0 var(--space-3)', font: 'var(--type-h3)' };
