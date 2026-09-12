'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ListingCard } from '@/components/ds/ListingCard';
import { apiFetch, ApiError, apiOrigin, type CursorPage } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { amount } from '@/lib/format';
import { UNAVAILABLE_REASON_LABELS } from '@/lib/labels';
import type { PublicListing } from '@/types/api';

/**
 * Why a favorited listing is no longer bookable, or null if it still is.
 *
 * Public responses do not reveal moderation status. A favorite is unavailable
 * whenever its public availability axis says so.
 */
function unavailableReason(listing: PublicListing): string | null {
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
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  /**
   * Same `disabled={<async state>}` focus-loss fix used elsewhere in the
   * app: `disabled={loadingMore}` blurs this button to `<body>` on every
   * page fetched. There's a second wrinkle specific to this button, though:
   * it's conditionally rendered on `nextCursor` (`{nextCursor ? <button>…
   * : null}`), so loading the *last* page unmounts it in the very same
   * update that clears `loadingMore` -- the button that needs refocusing is
   * simply gone by the time this effect runs. Falls back to the heading,
   * the same stable target `handleRemove` below already uses, whenever that
   * happens.
   */
  const shouldRefocusLoadMoreRef = useRef(false);
  useEffect(() => {
    if (!loadingMore && shouldRefocusLoadMoreRef.current) {
      shouldRefocusLoadMoreRef.current = false;
      (loadMoreRef.current ?? headingRef.current)?.focus();
    }
  }, [loadingMore]);

  /**
   * The unmount-on-click focus loss already fixed three times in the publish
   * wizard, found here too: `handleRemove` below filters the removed card
   * straight out of `items` in the same tick as the click, which unmounts
   * the card's own heart/remove `IconButton` -- exactly the button that had
   * focus -- and the browser drops focus to `<body>`. Same fix shape: a
   * stable, always-rendered element (the page heading) with a ref and
   * `tabIndex={-1}`, armed by a flag set at the point of removal and
   * consumed once `items` actually changes.
   */
  const shouldRefocusHeadingRef = useRef(false);
  useEffect(() => {
    if (shouldRefocusHeadingRef.current) {
      shouldRefocusHeadingRef.current = false;
      headingRef.current?.focus();
    }
  }, [items]);

  // No route-change announcement exists anywhere in this app for a
  // client-side transition -- see the same fix on account/listings/page.tsx.
  // The heading is part of the always-rendered header, so focusing it on
  // mount announces arrival immediately, before the favourites themselves
  // have loaded.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function load() {
      try {
        // Inside the try: `getIdToken` throws when Firebase is misconfigured,
        // and an unhandled rejection here left the page on "Chargement de vos
        // favoris…" forever — the signed-out message below was unreachable.
        const idToken = await getIdToken();
        if (!idToken) {
          if (isCurrent) setError('Connectez-vous pour voir vos annonces sauvegardées.');
          return;
        }

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
    shouldRefocusLoadMoreRef.current = true;
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
    shouldRefocusHeadingRef.current = true;
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
            <h1 ref={headingRef} tabIndex={-1} style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Mes annonces sauvegardées</h1>
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
              <Heart size={28} aria-hidden="true" />
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
            {/*
              A single always-full-width horizontal row wasted most of the
              row on desktop -- the 116px thumbnail and short price line
              never came close to filling a 1200px container. Search results
              solve the same "collection of listings" problem with
              .results-grid (1/2/3 columns) and vertical cards; reusing it
              here keeps saved listings visually consistent with every other
              listing collection in the app instead of inventing a second
              layout. Found 2026-09-09 by looking at the rendered page at
              1440px, not by reading the component.
            */}
            <div className="results-grid">
              {items.map((listing) => {
                const reason = unavailableReason(listing);
                const available = reason === null;

                return (
                  <ListingCard
                    key={listing.id}
                    title={listing.title}
                    district={listing.neighborhood}
                    city={listing.city}
                    price={amount(listing.priceRent)}
                    image={listing.coverPhotoUrl ? `${apiOrigin}${listing.coverPhotoUrl}` : undefined}
                    /*
                      Why a saved listing is no longer reachable is the whole
                      point of this page -- a room that is gone should say so
                      before you click it, not after.
                    */
                    badge={available ? undefined : reason ?? undefined}
                    badgeTone="neutral"
                    href={`/listings/${listing.id}`}
                    saved
                    onSave={removingId === listing.id ? undefined : () => handleRemove(listing.id)}
                  />
                );
              })}
            </div>

            {nextCursor ? (
              <button
                ref={loadMoreRef}
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
