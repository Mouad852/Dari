'use client';

import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { apiFetch, resolveMediaUrl } from '@/lib/api';
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
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);

  /** Same `disabled={<async state>}` focus-loss fix as ContactButton/ContactOwnerButton: `disabled={savePending}` blurs this button to `<body>` on every toggle. */
  const shouldRefocusSaveRef = useRef(false);
  useEffect(() => {
    if (!savePending && shouldRefocusSaveRef.current) {
      shouldRefocusSaveRef.current = false;
      saveButtonRef.current?.focus();
    }
  }, [savePending]);

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
    shouldRefocusSaveRef.current = true;
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
  const multiple = photos.length > 1;
  const step = (delta: number) => setPhotoIndex((current) => (current + delta + photos.length) % photos.length);

  return (
    /*
      A focusable group, so Left/Right reach the photos at all: the dots were
      the only control, and a keyboard user had to tab through one 8x8 button
      per photo to move between them.
    */
    <div
      role={multiple ? 'group' : undefined}
      aria-label={multiple ? `Photos de l’annonce : ${title}` : undefined}
      tabIndex={multiple ? 0 : undefined}
      onKeyDown={(event) => {
        if (!multiple) return;
        if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
        else if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
      }}
      style={{ position: 'relative', height: 360, background: 'var(--sable-200)' }}
    >
      {activePhoto ? (
        <img
          src={resolveMediaUrl(activePhoto.url)}
          alt={multiple ? `${title} — photo ${photoIndex + 1} sur ${photos.length}` : title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--text-muted)',
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
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            aria-label="Partager"
            onClick={() => void navigator.clipboard?.writeText(window.location.href)}
            style={iconButtonStyle}
          >
            <Share2 size={18} aria-hidden="true" />
          </button>
          <button
            ref={saveButtonRef}
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
            <Heart size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        </div>
      </div>
      {multiple && (
        <>
          {/* Visible, 40px targets: the dots were the only way to change photo. */}
          <button
            type="button"
            aria-label="Photo précédente"
            onClick={() => step(-1)}
            style={{ ...iconButtonStyle, position: 'absolute', top: '50%', left: 'var(--gutter-mobile)', transform: 'translateY(-50%)' }}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Photo suivante"
            onClick={() => step(1)}
            style={{ ...iconButtonStyle, position: 'absolute', top: '50%', right: 'var(--gutter-mobile)', transform: 'translateY(-50%)' }}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>

          <div
            style={{
              position: 'absolute',
              bottom: 4,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            {photos.map((photo, index) => {
              const current = index === photoIndex;
              return (
                /*
                  24x24 of target around an 8px dot (WCAG 2.5.8): the button
                  itself used to be the 8px dot. The active one is a wider
                  pill, not just a brighter colour, and carries aria-current.
                */
                <button
                  key={photo.id}
                  type="button"
                  aria-label={`Photo ${index + 1} sur ${photos.length}`}
                  aria-current={current ? 'true' : undefined}
                  onClick={() => setPhotoIndex(index)}
                  style={{
                    width: 24,
                    height: 24,
                    padding: 0,
                    border: 0,
                    background: 'transparent',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'block',
                      width: current ? 20 : 8,
                      height: 8,
                      borderRadius: 'var(--radius-pill)',
                      background: current ? '#fff' : 'rgba(255,255,255,0.5)',
                      transition: 'var(--transition-control)',
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Which photo is showing, for anyone who cannot see it change. */}
          <span aria-live="polite" aria-atomic="true" className="visually-hidden">
            {`Photo ${photoIndex + 1} sur ${photos.length}`}
          </span>
        </>
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
