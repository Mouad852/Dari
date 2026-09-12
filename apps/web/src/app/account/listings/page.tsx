'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Eye,
  MapPin,
  MessageSquareText,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { ListingThumb } from '@/components/ListingThumb';
import { apiFetch, ApiError, type CursorPage } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { rentPerMonth } from '@/lib/format';
import { AVAILABILITY_LABELS, LISTING_STATUS_LABELS } from '@/lib/labels';
import type { ListingDetail, ListingStatus } from '@/types/api';

type OwnedListing = ListingDetail;

const STATUS_META: Record<ListingStatus, { chipBg: string; chipColor: string; icon: LucideIcon }> = {
  DRAFT: { chipBg: 'var(--sable-100)', chipColor: 'var(--text-muted)', icon: Clock3 },
  PENDING_REVIEW: { chipBg: 'var(--sand-100)', chipColor: 'var(--sand-700)', icon: Clock3 },
  PUBLISHED: { chipBg: 'var(--brand-subtle)', chipColor: 'var(--brand)', icon: CheckCircle2 },
  REJECTED: { chipBg: 'var(--danger-subtle)', chipColor: 'var(--danger)', icon: ShieldAlert },
  SUSPENDED: { chipBg: 'var(--danger-subtle)', chipColor: 'var(--danger)', icon: ShieldAlert },
  EXPIRED: { chipBg: 'var(--sable-100)', chipColor: 'var(--text-muted)', icon: Clock3 },
};

export default function MyListingsPage() {
  const [listings, setListings] = useState<OwnedListing[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const pageHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);
  const cardTitleRefs = useRef(new Map<string, HTMLHeadingElement>());

  /**
   * Every card action button shares `disabled={isPending}`, so a browser
   * blurs whichever one was clicked to `<body>` -- the same pattern fixed
   * elsewhere in the app. This one has two distinct ways the captured button
   * can come back unusable, both needing a fallback: `handleDelete`'s
   * success removes the whole `<article>` (the button, and its card's own
   * `<h3>`, are both gone), while `handleSubmit`/`handleMarkRoomFound`/
   * `handleReopen`'s success patches the listing in place and can hide the
   * very button just clicked (its own eligibility flag, e.g. `canSubmit`,
   * flips false once the status changes) -- same "unfocusable/gone after a
   * successful action" shape already found in the publish wizard's photo
   * buttons, but for a listing that's still there, so the per-card title
   * (not the page heading) is the more localized, useful fallback.
   */
  const lastFocusedBeforeActionRef = useRef<HTMLElement | null>(null);
  const lastActionListingIdRef = useRef<string | null>(null);
  const armActionRefocus = (listingId: string) => {
    const active = document.activeElement;
    lastFocusedBeforeActionRef.current = active instanceof HTMLElement ? active : null;
    lastActionListingIdRef.current = listingId;
  };

  /** Same `disabled={loadingMore}` fix as favorites/page.tsx, including its conditionally-rendered-button wrinkle -- falls back to the page heading once "Voir plus" itself has unmounted (the last page). */
  const shouldRefocusLoadMoreRef = useRef(false);

  useEffect(() => {
    let isCurrent = true;

    async function load() {
      const idToken = await getIdToken();
      if (!idToken) {
        if (isCurrent) setError('Connectez-vous pour voir vos annonces.');
        return;
      }

      try {
        const page = await apiFetch<CursorPage<OwnedListing>>('/listings/mine', { token: idToken });
        if (isCurrent) {
          setToken(idToken);
          setListings(page.items);
          setNextCursor(page.nextCursor);
        }
      } catch (cause) {
        if (isCurrent) setError(cause instanceof ApiError ? cause.message : 'Impossible de charger vos annonces.');
      }
    }

    void load();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!loadingMore && shouldRefocusLoadMoreRef.current) {
      shouldRefocusLoadMoreRef.current = false;
      (loadMoreRef.current ?? pageHeadingRef.current)?.focus();
    }
  }, [loadingMore]);

  useEffect(() => {
    if (pendingId === null && lastFocusedBeforeActionRef.current) {
      const el = lastFocusedBeforeActionRef.current;
      const listingId = lastActionListingIdRef.current;
      lastFocusedBeforeActionRef.current = null;
      lastActionListingIdRef.current = null;
      const usable = el.isConnected && !(el instanceof HTMLButtonElement && el.disabled);
      if (usable) {
        el.focus();
      } else {
        const cardTitle = listingId ? cardTitleRefs.current.get(listingId) : undefined;
        (cardTitle ?? pageHeadingRef.current)?.focus();
      }
    }
  }, [pendingId]);

  const handleLoadMore = () => {
    if (!nextCursor || !token || loadingMore) return;
    shouldRefocusLoadMoreRef.current = true;
    setLoadingMore(true);
    void (async () => {
      try {
        const page = await apiFetch<CursorPage<OwnedListing>>(
          `/listings/mine?cursor=${encodeURIComponent(nextCursor)}`,
          { token },
        );
        setListings((prev) => [...(prev ?? []), ...page.items]);
        setNextCursor(page.nextCursor);
      } catch (cause) {
        setActionError(cause instanceof ApiError ? cause.message : 'Impossible de charger la suite.');
      } finally {
        setLoadingMore(false);
      }
    })();
  };

  /**
   * The lifecycle-action endpoints return `PublicListingResponse` (fuzzed,
   * fewer fields), not the `ListingResponse` shape this dashboard is built on
   * — so the response body is never trusted here. Each action's resulting
   * state is deterministic (see ListingSearchService's transition guards), so
   * a successful call is patched locally instead of parsed.
   */
  const runAction = (listingId: string, path: string, method: 'POST' | 'DELETE', patch: Partial<OwnedListing> | null) => {
    if (pendingId || !token) return;
    armActionRefocus(listingId);
    setPendingId(listingId);
    setActionError(null);
    void (async () => {
      try {
        await apiFetch(path, { method, token });
        if (patch) {
          setListings((prev) => (prev ?? []).map((l) => (l.id === listingId ? { ...l, ...patch } : l)));
        } else {
          setListings((prev) => (prev ?? []).filter((l) => l.id !== listingId));
        }
      } catch (cause) {
        setActionError(cause instanceof ApiError ? cause.message : 'Action impossible pour le moment.');
      } finally {
        setPendingId(null);
      }
    })();
  };

  const handleSubmit = (listingId: string) =>
    runAction(listingId, `/listings/${encodeURIComponent(listingId)}/submit`, 'POST', { status: 'PENDING_REVIEW' });

  const handleMarkRoomFound = (listingId: string) =>
    runAction(listingId, `/listings/${encodeURIComponent(listingId)}/mark-room-found`, 'POST', { availabilityState: 'ROOM_FOUND' });

  const handleReopen = (listingId: string) =>
    runAction(listingId, `/listings/${encodeURIComponent(listingId)}/reopen`, 'POST', { availabilityState: 'AVAILABLE' });

  const handleDelete = (listingId: string) => {
    if (!window.confirm('Supprimer définitivement cette annonce ?')) return;
    runAction(listingId, `/listings/${encodeURIComponent(listingId)}`, 'DELETE', null);
  };

  const totalListings = listings?.length ?? 0;
  const publishedListings = listings?.filter((l) => l.status === 'PUBLISHED').length ?? 0;
  const draftListings = listings?.filter((l) => l.status === 'DRAFT').length ?? 0;
  // The stat row previously only tracked Publiées/Brouillons, so an owner
  // whose listings were all mid-review saw "2 au total" sitting above two
  // zeros that summed to less than the total beside them. PENDING_REVIEW is
  // the single most common in-between state — every listing passes through
  // it right after submission — so it's the one worth its own tile; rarer
  // states (REJECTED, SUSPENDED, EXPIRED) stay visible on each card's own
  // status badge rather than each claiming a tile of their own.
  const pendingListings = listings?.filter((l) => l.status === 'PENDING_REVIEW').length ?? 0;
  // Accurate only while every page is loaded — true for the common case (few listings), noted to the user otherwise.
  const statsAreComplete = !nextCursor;

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
              Compte
            </div>
            <h1 ref={pageHeadingRef} tabIndex={-1} style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Mes annonces</h1>
          </div>

          <Link
            href="/publish"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              border: '1px solid var(--brand-border)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--brand)',
              color: 'white',
              padding: '0.7rem 1rem',
              font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)',
              textDecoration: 'none',
            }}
          >
            <Plus size={16} />
            Publier
          </Link>
        </header>

        {error ? (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <p role="alert" style={{ margin: 0, color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>{error}</p>
            {!token ? <Link href="/sign-in" style={{ color: 'var(--brand)' }}>Se connecter</Link> : null}
          </div>
        ) : !listings ? (
          <p style={{ color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>Chargement de vos annonces…</p>
        ) : (
          <>
            {listings.length > 0 ? (
              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
                {([
                  ['Annonces', `${totalListings}${statsAreComplete ? ' au total' : '+ chargées'}`],
                  ['Publiées', `${publishedListings}`],
                  ['En vérification', `${pendingListings}`],
                  ['Brouillons', `${draftListings}`],
                ] as const).map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      background: 'var(--surface-card)',
                      border: '1px solid var(--border-hairline)',
                      borderRadius: 'var(--radius-card)',
                      boxShadow: 'var(--shadow-xs)',
                      padding: 'var(--space-4)',
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>{value}</span>
                  </div>
                ))}
              </section>
            ) : null}

            {actionError ? (
              <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>{actionError}</p>
            ) : null}

            {listings.length === 0 ? (
              <div
                style={{
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow-xs)',
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  font: 'var(--type-body-sm)',
                }}
              >
                Aucune annonce pour le moment. Publiez votre première chambre pour commencer.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                {listings.map((listing) => {
                  const status = STATUS_META[listing.status];
                  const StatusIcon = status.icon;
                  const isPending = pendingId === listing.id;
                  const canSubmit = listing.status === 'DRAFT' || listing.status === 'REJECTED';
                  const canMarkRoomFound = listing.status === 'PUBLISHED' && listing.availabilityState === 'AVAILABLE';
                  const canReopen = listing.status === 'PUBLISHED' && listing.availabilityState === 'ROOM_FOUND';

                  return (
                    <article
                      key={listing.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr',
                        gap: 'var(--space-4)',
                        background: 'var(--surface-card)',
                        border: '1px solid var(--border-hairline)',
                        borderRadius: 'var(--radius-card)',
                        boxShadow: 'var(--shadow-xs)',
                        overflow: 'hidden',
                      }}
                    >
                      <ListingThumb coverPhotoUrl={listing.coverPhotoUrl} alt={listing.title} />

                      <div style={{ display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ font: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
                              {listing.neighborhood}
                            </div>
                            <h3
                              ref={(el) => {
                                if (el) cardTitleRefs.current.set(listing.id, el);
                                else cardTitleRefs.current.delete(listing.id);
                              }}
                              tabIndex={-1}
                              style={{ margin: '0.3rem 0 0', font: 'var(--type-h3)', color: 'var(--text-heading)' }}
                            >
                              {listing.title}
                            </h3>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                borderRadius: 'var(--radius-pill)',
                                background: status.chipBg,
                                color: status.chipColor,
                                padding: '0.45rem 0.7rem',
                                font: 'var(--type-label)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <StatusIcon size={12} />
                              {LISTING_STATUS_LABELS[listing.status]}
                            </span>
                            {listing.status === 'PUBLISHED' && listing.availabilityState !== 'AVAILABLE' ? (
                              <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                                {AVAILABILITY_LABELS[listing.availabilityState]}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
                            <MapPin size={14} />
                            {listing.city}
                          </span>
                          <span style={{ font: 'var(--weight-bold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>
                            {rentPerMonth(listing.priceRent)}
                          </span>
                        </div>

                        {listing.status === 'REJECTED' && listing.rejectionReason ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                              borderRadius: 'var(--radius-card-inner)',
                              background: 'var(--danger-subtle)',
                              border: '1px solid var(--danger-border)',
                              color: 'var(--danger)',
                              padding: '0.75rem 0.8rem',
                              font: 'var(--type-body-sm)',
                            }}
                          >
                            <MessageSquareText size={14} style={{ flex: '0 0 auto', marginTop: 2 }} />
                            {listing.rejectionReason}
                          </div>
                        ) : null}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                          <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                            Modifiée le {new Date(listing.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>

                          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            <Link
                              href={`/listings/${listing.id}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                border: '1px solid var(--brand-border)',
                                borderRadius: 'var(--radius-pill)',
                                background: 'var(--brand-subtle)',
                                color: 'var(--clay-700)',
                                padding: '0.6rem 0.9rem',
                                font: 'var(--type-body-sm)',
                                textDecoration: 'none',
                              }}
                            >
                              <Eye size={14} />
                              Voir
                              <ArrowUpRight size={14} />
                            </Link>

                            {/*
                              Edit is offered for every status the owner can
                              still act on. It was previously withheld entirely,
                              because the wizard could only create -- a
                              "Modifier" that opened a blank wizard would have
                              silently produced a duplicate draft.
                            */}
                            <Link
                              href={`/publish?listing=${listing.id}`}
                              style={{ ...actionButtonStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                              <Pencil size={14} />
                              Modifier
                            </Link>

                            {canSubmit ? (
                              <button type="button" disabled={isPending} onClick={() => handleSubmit(listing.id)} style={actionButtonStyle}>
                                Soumettre
                              </button>
                            ) : null}
                            {canMarkRoomFound ? (
                              <button type="button" disabled={isPending} onClick={() => handleMarkRoomFound(listing.id)} style={actionButtonStyle}>
                                Chambre trouvée
                              </button>
                            ) : null}
                            {canReopen ? (
                              <button type="button" disabled={isPending} onClick={() => handleReopen(listing.id)} style={actionButtonStyle}>
                                Remettre disponible
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleDelete(listing.id)}
                              aria-label="Supprimer"
                              style={{ ...actionButtonStyle, color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {nextCursor ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  ref={loadMoreRef}
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
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
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

const actionButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--surface-card)',
  color: 'var(--text-heading)',
  padding: '0.6rem 0.9rem',
  font: 'var(--type-body-sm)',
  cursor: 'pointer',
};
