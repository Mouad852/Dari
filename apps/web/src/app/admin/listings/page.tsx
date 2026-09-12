'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Card } from '@/components/ds/Card';
import { Dialog } from '@/components/ds/Dialog';
import { Icon } from '@/components/ds/Icon';
import { Textarea } from '@/components/ds/Textarea';
import { ListingThumb } from '@/components/ListingThumb';
import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { rentPerMonth } from '@/lib/format';
import { LISTING_STATUS_LABELS } from '@/lib/labels';
import type { ListingDetail } from '@/types/api';

export default function AdminListingsQueuePage() {
  const [queue, setQueue] = useState<ListingDetail[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The listing being rejected, while the reason dialog is open. */
  const [rejecting, setRejecting] = useState<ListingDetail | null>(null);
  const [reason, setReason] = useState('');
  const pageHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const rowTitleRefs = useRef(new Map<string, HTMLHeadingElement>());

  // No route-change announcement exists anywhere in this app for a
  // client-side transition -- see the same fix on account/listings/page.tsx.
  // The heading is part of the always-rendered header, so focusing it on
  // mount announces arrival immediately, before the queue itself has loaded.
  useEffect(() => {
    pageHeadingRef.current?.focus();
  }, []);

  /**
   * Same `disabled={<async state>}` focus loss as everywhere else in the
   * app: "Valider" (`loading={isPending}`) and "Rejeter" (`disabled={isPending}`)
   * both blur to `<body>` the instant a review action starts. Both outcomes
   * remove the item from `queue` on success, unmounting the whole `<li>` --
   * including the row's own `<h2>`, hence the page-heading fallback -- but
   * "Rejeter" has an extra wrinkle: the actual API call fires from
   * `confirmReject`, inside the reason dialog, whose "Rejeter l'annonce"
   * button is what's really focused at the moment `setPendingId` runs. That
   * dialog closes immediately (`setRejecting(null)` right after), so the
   * captured element is always already gone from the DOM by the time this
   * effect runs -- correctly falling through to the row's own `<h2>` (still
   * there on a failure) without any special-casing needed.
   */
  const lastFocusedBeforeActionRef = useRef<HTMLElement | null>(null);
  const lastActionListingIdRef = useRef<string | null>(null);
  const armActionRefocus = (listingId: string) => {
    const active = document.activeElement;
    lastFocusedBeforeActionRef.current = active instanceof HTMLElement ? active : null;
    lastActionListingIdRef.current = listingId;
  };
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
        const rowTitle = listingId ? rowTitleRefs.current.get(listingId) : undefined;
        (rowTitle ?? pageHeadingRef.current)?.focus();
      }
    }
  }, [pendingId]);

  useEffect(() => {
    let isCurrent = true;

    void (async () => {
      // Inside the try: getIdToken rejects rather than resolving null when the
      // Firebase session has not been restored yet, and outside it that was an
      // unhandled rejection and a queue stuck on "Chargement…".
      try {
        const idToken = await getIdToken();
        if (!idToken) {
          if (isCurrent) setError('Connectez-vous avec un compte administrateur.');
          return;
        }
        const result = await apiFetch<ListingDetail[]>('/admin/listings', { token: idToken });
        if (isCurrent) {
          setToken(idToken);
          setQueue(result);
        }
      } catch (cause) {
        if (isCurrent) setError(cause instanceof ApiError ? cause.message : 'Impossible de charger la file de modération.');
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleApprove = (id: string) => {
    if (pendingId || !token) return;
    armActionRefocus(id);
    setPendingId(id);
    setError(null);
    void (async () => {
      try {
        await apiFetch(`/admin/listings/${encodeURIComponent(id)}/approve`, { method: 'POST', token });
        setQueue((prev) => (prev ?? []).filter((item) => item.id !== id));
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Impossible d’approuver cette annonce.');
      } finally {
        setPendingId(null);
      }
    })();
  };

  /**
   * The rejection reason is copy the owner reads, and it was collected with
   * `window.prompt`.
   *
   * A native prompt gives no label, no character guidance, no styling, no way to
   * write more than a line comfortably, and browsers are free to suppress it
   * entirely — at which point rejecting a listing silently does nothing. It is
   * the only piece of the moderation flow the owner actually sees, so it gets a
   * real dialog and a real textarea.
   */
  const confirmReject = () => {
    const value = reason.trim();
    if (!value || !rejecting || !token) return;
    const id = rejecting.id;

    armActionRefocus(id);
    setPendingId(id);
    setError(null);
    setRejecting(null);
    void (async () => {
      try {
        await apiFetch(`/admin/listings/${encodeURIComponent(id)}/reject`, {
          method: 'POST',
          token,
          body: { reason: value },
        });
        setQueue((prev) => (prev ?? []).filter((item) => item.id !== id));
        setReason('');
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Impossible de rejeter cette annonce.');
      } finally {
        setPendingId(null);
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
      <div
        style={{
          maxWidth: 'var(--container-max)',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 'var(--space-5)',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Modération
            </div>
            <h1 ref={pageHeadingRef} tabIndex={-1} style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>File de modération</h1>
          </div>

          {/*
            This count is honest, unlike the inbox's was: /admin/listings returns
            the whole queue in one response, with no cursor, so `length` is the
            total rather than the number loaded so far.
          */}
          {queue ? (
            <Badge tone={queue.length > 0 ? 'brand' : 'neutral'}>
              {queue.length} en attente
            </Badge>
          ) : null}
        </header>

        {error ? <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>{error}</p> : null}

        {!queue ? (
          <p style={{ color: 'var(--text-body)', font: 'var(--type-body-sm)' }}>Chargement…</p>
        ) : queue.length === 0 ? (
          <Card padding="var(--space-7)" style={{ display: 'grid', gap: 'var(--space-3)', justifyItems: 'center', textAlign: 'center' }}>
            <Icon name="check-circle-2" size={28} color="var(--success)" />
            <p style={{ margin: 0, font: 'var(--type-h3)', color: 'var(--text-heading)' }}>File vide</p>
            <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-body)' }}>
              Aucune annonce n’attend de validation.
            </p>
          </Card>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-4)' }}>
            {queue.map((item) => {
              const isPending = pendingId === item.id;
              return (
                <li key={item.id} style={{ minWidth: 0 }}>
                  {/*
                    The photograph gets a landscape column, not the 160px portrait
                    slot it had. Listing photos are shot landscape, so a narrow
                    tall crop showed a moderator a vertical sliver of the one
                    thing this screen exists to judge.
                  */}
                  <article className="moderation-row">
                    <ListingThumb coverPhotoUrl={item.coverPhotoUrl} alt={item.title} minHeight={200} />

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-3)', padding: 'var(--card-pad-lg)', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ font: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
                            {item.neighborhood}
                          </div>
                          <h2
                            ref={(el) => {
                              if (el) rowTitleRefs.current.set(item.id, el);
                              else rowTitleRefs.current.delete(item.id);
                            }}
                            tabIndex={-1}
                            style={{ margin: '0.3rem 0 0', font: 'var(--type-h3)', color: 'var(--text-heading)' }}
                          >
                            {item.title}
                          </h2>
                        </div>
                        <Badge tone="neutral">{LISTING_STATUS_LABELS[item.status]}</Badge>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', font: 'var(--type-body-sm)', color: 'var(--text-body)' }}>
                          <Icon name="map-pin" size={14} />
                          {item.city}
                        </span>
                        <span style={{ font: 'var(--weight-bold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>
                          {rentPerMonth(item.priceRent)}
                        </span>
                      </div>

                      {/*
                        The description, in the queue rather than one click away.
                        A scam, a phone number, or discriminatory wording lives
                        here and nowhere else, and a moderator was being asked to
                        decide without reading it.
                      */}
                      {item.description ? (
                        <p
                          // Longhand, not the `font` shorthand -- see ReportDialog.tsx for why.
                          style={{
                            margin: 0,
                            fontWeight: 'var(--weight-regular)',
                            fontSize: 'var(--text-body-sm)',
                            fontFamily: 'var(--font-ui)',
                            color: 'var(--text-body)',
                            lineHeight: 1.6,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {item.description}
                        </p>
                      ) : (
                        <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
                          Aucune description.
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <Link href={`/listings/${item.id}`} style={{ textDecoration: 'none' }}>
                          <Button variant="ghost" size="sm" iconLeft="eye">Voir l’annonce</Button>
                        </Link>

                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <Button
                            variant="primary"
                            size="sm"
                            iconLeft="check"
                            loading={isPending}
                            onClick={() => handleApprove(item.id)}
                          >
                            Valider
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            iconLeft="x"
                            disabled={isPending}
                            onClick={() => {
                              setReason('');
                              setRejecting(item);
                            }}
                          >
                            Rejeter
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {rejecting && (
        <Dialog
          open
          title="Rejeter cette annonce"
          onClose={() => setRejecting(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setRejecting(null)}>Annuler</Button>
              <Button variant="danger" disabled={!reason.trim()} onClick={confirmReject}>
                Rejeter l’annonce
              </Button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-body)' }}>
              <strong style={{ color: 'var(--text-heading)' }}>{rejecting.title}</strong>
            </p>
            <Textarea
              label="Raison du rejet"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Expliquez ce qui doit être corrigé pour que l’annonce puisse être publiée."
              helper="Ce texte est envoyé au propriétaire. Écrivez ce qu’il doit changer, pas seulement ce qui ne va pas."
            />
          </div>
        </Dialog>
      )}
    </main>
  );
}
