'use client';

import { CheckCircle2, Eye, MapPin, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    let isCurrent = true;

    void (async () => {
      const idToken = await getIdToken();
      if (!idToken) return;
      try {
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

  const handleReject = (id: string) => {
    if (pendingId || !token) return;
    const reason = window.prompt('Raison du rejet (visible par le propriétaire) :');
    if (!reason || !reason.trim()) return;

    setPendingId(id);
    setError(null);
    void (async () => {
      try {
        await apiFetch(`/admin/listings/${encodeURIComponent(id)}/reject`, {
          method: 'POST',
          token,
          body: { reason: reason.trim() },
        });
        setQueue((prev) => (prev ?? []).filter((item) => item.id !== id));
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
        color: 'var(--text-primary)',
        padding: 'var(--space-6) var(--gutter-mobile) var(--space-8)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-5)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Modération
            </div>
            <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>File de modération</h1>
          </div>

          {queue ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--brand-subtle)',
                border: '1px solid var(--brand-border)',
                color: 'var(--brand)',
                padding: '0.5rem 0.8rem',
                font: 'var(--type-label)',
              }}
            >
              {queue.length} en attente
            </div>
          ) : null}
        </header>

        {error ? <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>{error}</p> : null}

        {!queue ? (
          <p style={{ color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>Chargement…</p>
        ) : queue.length === 0 ? (
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
            Aucune annonce en attente de validation.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            {queue.map((item) => {
              const isPending = pendingId === item.id;
              return (
                <article
                  key={item.id}
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
                  <div
                    style={{
                      minHeight: 160,
                      background: 'linear-gradient(135deg, var(--sand-100), var(--sable-100))',
                      color: 'var(--sable-500)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      font: 'var(--type-caption)',
                      letterSpacing: 'var(--ls-caps)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Photo
                  </div>

                  <div style={{ display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ font: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
                          {item.neighborhood}
                        </div>
                        <h3 style={{ margin: '0.3rem 0 0', font: 'var(--type-h3)', color: 'var(--text-heading)' }}>{item.title}</h3>
                      </div>
                      <span style={{ font: 'var(--type-label)', color: 'var(--text-muted)' }}>{LISTING_STATUS_LABELS[item.status]}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
                        <MapPin size={14} />
                        {item.city}
                      </span>
                      <span style={{ font: 'var(--weight-bold) var(--type-body-md) var(--font-ui)', color: 'var(--text-heading)' }}>
                        {rentPerMonth(item.priceRent)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                      <Link
                        href={`/listings/${item.id}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand)', font: 'var(--type-body-sm)', textDecoration: 'none' }}
                      >
                        <Eye size={14} />
                        Voir l’annonce
                      </Link>

                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleApprove(item.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            border: '1px solid var(--brand-border)',
                            borderRadius: 'var(--radius-pill)',
                            background: 'var(--brand-subtle)',
                            color: 'var(--brand)',
                            padding: '0.6rem 0.9rem',
                            font: 'var(--type-body-sm)',
                            cursor: isPending ? 'default' : 'pointer',
                          }}
                        >
                          <CheckCircle2 size={14} />
                          Valider
                        </button>

                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleReject(item.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            border: '1px solid var(--error-light)',
                            borderRadius: 'var(--radius-pill)',
                            background: 'var(--error-subtle)',
                            color: 'var(--error)',
                            padding: '0.6rem 0.9rem',
                            font: 'var(--type-body-sm)',
                            cursor: isPending ? 'default' : 'pointer',
                          }}
                        >
                          <XCircle size={14} />
                          Rejeter
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
