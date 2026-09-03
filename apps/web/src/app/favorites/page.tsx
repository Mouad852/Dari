'use client';

import Link from 'next/link';
import { Heart, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiFetch, ApiError, apiOrigin, type CursorPage } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { rentPerMonth } from '@/lib/format';
import { UNAVAILABLE_REASON_LABELS } from '@/lib/labels';
import type { PublicListing } from '@/types/api';

/**
 * Why a favorited listing is no longer bookable, or null if it still is.
 *
 * Mirrors the two independent lifecycle axes from the design doc: a listing
 * can stop being available either because moderation acted on `status`, or
 * because the owner changed `availabilityState`. Both must be checked —
 * neither implies the other.
 */
function unavailableReason(listing: PublicListing): string | null {
  if (listing.status === 'SUSPENDED') return UNAVAILABLE_REASON_LABELS.SUSPENDED;
  if (listing.status === 'EXPIRED') return UNAVAILABLE_REASON_LABELS.EXPIRED;
  if (listing.availabilityState === 'ROOM_FOUND') return UNAVAILABLE_REASON_LABELS.ROOM_FOUND;
  if (listing.availabilityState === 'CLOSED') return UNAVAILABLE_REASON_LABELS.CLOSED;
  return null;
}

export default function FavoritesPage() {
  const [items, setItems] = useState<PublicListing[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function load() {
      const idToken = await getIdToken();
      if (!idToken) {
        if (isCurrent) setError('Connectez-vous pour voir vos annonces sauvegardées.');
        return;
      }

      try {
        const page = await apiFetch<CursorPage<PublicListing>>('/favorites', { token: idToken });
        if (isCurrent) {
          setToken(idToken);
          setItems(page.items);
          setNextCursor(page.nextCursor);
        }
      } catch (cause) {
        if (isCurrent) setError(cause instanceof ApiError ? cause.message : 'Impossible de charger vos favoris.');
      }
    }

    void load();
    return () => {
      isCurrent = false;
    };
  }, []);

  const handleLoadMore = () => {
    if (!nextCursor || !token || loadingMore) return;
    setLoadingMore(true);
    void (async () => {
      try {
        const page = await apiFetch<CursorPage<PublicListing>>(
          `/favorites?cursor=${encodeURIComponent(nextCursor)}`,
          { token },
        );
        setItems((prev) => [...(prev ?? []), ...page.items]);
        setNextCursor(page.nextCursor);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Impossible de charger la suite.');
      } finally {
        setLoadingMore(false);
      }
    })();
  };

  const handleRemove = (listingId: string) => {
    if (!token || removingId) return;
    const previous = items;
    setRemovingId(listingId);
    setItems((current) => (current ?? []).filter((item) => item.id !== listingId));

    void (async () => {
      try {
        await apiFetch(`/favorites/${encodeURIComponent(listingId)}`, { method: 'DELETE', token });
      } catch (cause) {
        // Roll back: the card left the list optimistically, but the removal failed server-side.
        setItems(previous);
        setError(cause instanceof ApiError ? cause.message : 'Impossible de retirer cette annonce.');
      } finally {
        setRemovingId(null);
      }
    })();
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--sable-50) 100%)',
        color: 'var(--text-heading)',
        padding: 'var(--space-6) var(--gutter-mobile) var(--space-8)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-5)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Favoris
            </div>
            <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Mes annonces sauvegardées</h1>
          </div>

          {items && items.length > 0 ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 32,
                borderRadius: 'var(--radius-pill)',
                background: 'var(--brand-subtle)',
                color: 'var(--clay-700)',
                padding: '0.45rem 0.8rem',
                font: 'var(--weight-medium) var(--type-label) var(--font-ui)',
              }}
            >
              {items.length} sauvegardée{items.length > 1 ? 's' : ''}
            </span>
          ) : null}
        </header>

        {error ? (
          <section
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-xs)',
              padding: 'var(--space-5)',
              display: 'grid',
              gap: 'var(--space-3)',
            }}
          >
            <p role="alert" style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
              {error}
            </p>
            {!token ? (
              <Link href="/sign-in" style={{ color: 'var(--brand)', font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)' }}>
                Se connecter
              </Link>
            ) : null}
          </section>
        ) : !items ? (
          <p style={{ color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>Chargement de vos favoris…</p>
        ) : items.length === 0 ? (
          <section
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-xs)',
              padding: 'var(--space-6)',
              display: 'grid',
              justifyItems: 'center',
              textAlign: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <span
              style={{
                width: 72,
                height: 72,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'var(--brand-subtle)',
                color: 'var(--clay-700)',
              }}
            >
              <Heart size={28} />
            </span>
            <div>
              <h2 style={{ margin: 0, font: 'var(--type-h3)', color: 'var(--text-heading)' }}>Aucune annonce sauvegardée</h2>
              <p style={{ margin: '0.55rem 0 0', font: 'var(--type-body-sm)', color: 'var(--text-muted)', maxWidth: 360 }}>
                Touchez le cœur sur une annonce pour la retrouver ici.
              </p>
            </div>
          </section>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              {items.map((listing) => {
                const reason = unavailableReason(listing);
                const available = reason === null;

                return (
                  <article
                    key={listing.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '140px 1fr',
                      gap: 'var(--space-4)',
                      background: 'var(--surface-card)',
                      border: '1px solid var(--border-hairline)',
                      borderRadius: 'var(--radius-card)',
                      boxShadow: 'var(--shadow-xs)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        minHeight: 150,
                        background: available
                          ? 'linear-gradient(135deg, var(--sand-100), var(--sable-100))'
                          : 'linear-gradient(135deg, var(--sable-200), var(--sable-100))',
                        color: 'var(--text-body)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        font: 'var(--type-caption)',
                        letterSpacing: 'var(--ls-caps)',
                        textTransform: 'uppercase',
                        position: 'relative',
                      }}
                    >
                      {listing.coverPhotoUrl ? (
                        <img
                          src={`${apiOrigin}${listing.coverPhotoUrl}`}
                          alt=""
                          loading="lazy"
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        'Photo'
                      )}
                      <button
                        type="button"
                        aria-label="Retirer des favoris"
                        onClick={() => handleRemove(listing.id)}
                        disabled={removingId === listing.id}
                        style={{
                          position: 'absolute',
                          top: 'var(--space-3)',
                          right: 'var(--space-3)',
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          border: 'none',
                          background: 'rgba(255, 255, 255, 0.9)',
                          color: 'var(--brand)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: 'var(--shadow-xs)',
                          cursor: removingId === listing.id ? 'default' : 'pointer',
                          opacity: removingId === listing.id ? 0.6 : 1,
                        }}
                      >
                        <Heart size={16} fill="currentColor" />
                      </button>
                    </div>

                    <div style={{ display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 'var(--space-3)' }}>
                        <div>
                          <div style={{ font: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
                            {listing.neighborhood}
                          </div>
                          <h2 style={{ margin: '0.2rem 0 0', font: 'var(--type-h3)', color: 'var(--text-heading)' }}>{listing.title}</h2>
                        </div>

                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            borderRadius: 'var(--radius-pill)',
                            background: available ? 'var(--brand-subtle)' : 'var(--sable-100)',
                            color: available ? 'var(--clay-700)' : 'var(--text-muted)',
                            padding: '0.35rem 0.6rem',
                            font: 'var(--type-label)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {available ? 'Disponible' : reason}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
                        <MapPin size={14} />
                        {listing.city}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 'var(--space-3)',
                          paddingTop: 'var(--space-2)',
                          borderTop: '1px solid var(--border-hairline)',
                        }}
                      >
                        <span style={{ font: 'var(--weight-bold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>
                          {rentPerMonth(listing.priceRent)}
                        </span>
                        <Link
                          href={`/listings/${listing.id}`}
                          style={{ color: 'var(--brand)', font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)', textDecoration: 'none' }}
                        >
                          Voir l’annonce
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {nextCursor ? (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{
                  justifySelf: 'center',
                  border: '1px solid var(--border-default)',
                  background: 'var(--surface-card)',
                  borderRadius: 'var(--radius-pill)',
                  color: 'var(--text-heading)',
                  padding: '0.7rem 1.3rem',
                  font: 'var(--type-body-sm)',
                  cursor: loadingMore ? 'default' : 'pointer',
                }}
              >
                {loadingMore ? 'Chargement…' : 'Voir plus'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
