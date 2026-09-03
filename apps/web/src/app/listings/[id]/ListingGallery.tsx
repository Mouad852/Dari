'use client';

import { ArrowLeft, Heart, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiFetch, apiOrigin } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import type { ListingPhoto } from '@/types/api';

/**
 * The photo header, and the only interactive part of it.
 *
 * Split out so the page around it can be a Server Component: the description,
 * price and attributes are what a crawler needs, and they should not ship as an
 * empty shell just because a carousel and a favourite button live on top of the
 * image.
 *
 * The first photo is rendered by the server as part of the page, so the image a
 * visitor sees first is in the initial HTML rather than painted after hydration.
 */
export function ListingGallery({
  listingId,
  title,
  photos,
}: {
  listingId: string;
  title: string;
  photos: ListingPhoto[];
}) {
  const router = useRouter();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);

  useEffect(() => {
    let current = true;
    void getIdToken()
      .then(async (token) => {
        if (!token || !current) return;
        const ids = await apiFetch<string[]>('/favorites/ids', { token });
        if (current) setSaved(ids.includes(listingId));
      })
      .catch(() => {
        // A failed membership read must not stop the listing from rendering.
      });
    return () => {
      current = false;
    };
  }, [listingId]);

  const toggleSaved = async () => {
    const token = await getIdToken();
    if (!token) {
      router.push('/sign-in');
      return;
    }
    const next = !saved;
    setSaved(next);
    setSavePending(true);
    try {
      await apiFetch(`/favorites/${listingId}`, { method: next ? 'POST' : 'DELETE', token });
    } catch {
      setSaved(!next);
    } finally {
      setSavePending(false);
    }
  };

  const activePhoto = photos[photoIndex];

  return (
    <div style={{ position: 'relative', height: 360, background: 'var(--sable-200)' }}>
      {activePhoto ? (
        <img
          src={`${apiOrigin}${activePhoto.url}`}
          alt={title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--sable-500)',
            font: 'var(--type-caption)',
            textTransform: 'uppercase',
          }}
        >
          Aucune photo
        </span>
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim-image)' }} />
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 'var(--gutter-mobile)',
          right: 'var(--gutter-mobile)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <button type="button" aria-label="Retour" onClick={() => router.back()} style={iconButtonStyle}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            aria-label="Partager"
            onClick={() => void navigator.clipboard?.writeText(window.location.href)}
            style={iconButtonStyle}
          >
            <Share2 size={18} />
          </button>
          <button
            type="button"
            aria-label={saved ? 'Retirer des favoris' : 'Enregistrer'}
            onClick={() => void toggleSaved()}
            disabled={savePending}
            style={{
              ...iconButtonStyle,
              background: saved ? 'rgba(255,255,255,0.95)' : 'var(--surface-glass)',
              color: saved ? 'var(--brand)' : '#fff',
            }}
          >
            <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
      {photos.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              aria-label={`Photo ${index + 1}`}
              onClick={() => setPhotoIndex(index)}
              style={{
                width: 8,
                height: 8,
                padding: 0,
                border: 0,
                borderRadius: 'var(--radius-pill)',
                background: index === photoIndex ? '#fff' : 'rgba(255,255,255,0.5)',
              }}
            />
          ))}
        </div>
      )}
    </div>
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
