'use client';

import { AlertTriangle, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { relativeTime } from '@/lib/format';
import { REPORT_REASON_LABELS, REPORT_TARGET_LABELS } from '@/lib/labels';
import type { AdminReportQueueItem, PublicListing } from '@/types/api';

/** Best-effort only: the listing may 404 (soft-deleted) — the row still works without a title. */
function useListingTitles(items: AdminReportQueueItem[] | null, token: string | null) {
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!items || !token) return;
    let isCurrent = true;

    const listingIds = items.filter((item) => item.targetType === 'LISTING').map((item) => item.targetId);
    void Promise.all(
      listingIds.map(async (id) => {
        try {
          const listing = await apiFetch<PublicListing>(`/listings/${encodeURIComponent(id)}`, { token });
          return [id, listing.title] as const;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (!isCurrent) return;
      const resolved: Record<string, string> = {};
      for (const entry of results) {
        if (entry) resolved[entry[0]] = entry[1];
      }
      setTitles(resolved);
    });

    return () => {
      isCurrent = false;
    };
  }, [items, token]);

  return titles;
}

export default function AdminReportsPage() {
  const [queue, setQueue] = useState<AdminReportQueueItem[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void (async () => {
      const idToken = await getIdToken();
      if (!idToken) return;
      try {
        const result = await apiFetch<AdminReportQueueItem[]>('/admin/reports', { token: idToken });
        if (isCurrent) {
          setToken(idToken);
          setQueue(result);
        }
      } catch (cause) {
        if (isCurrent) setError(cause instanceof ApiError ? cause.message : 'Impossible de charger les signalements.');
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, []);

  const listingTitles = useListingTitles(queue, token);

  const handleDismiss = (item: AdminReportQueueItem) => {
    const key = `${item.targetType}:${item.targetId}`;
    if (pendingKey || !token) return;
    const reason = window.prompt('Raison du classement sans suite (facultatif) :') ?? undefined;

    setPendingKey(key);
    setError(null);
    void (async () => {
      try {
        await apiFetch(`/admin/reports/${item.targetType}/${encodeURIComponent(item.targetId)}/action`, {
          method: 'POST',
          token,
          body: { action: 'DISMISS', reason },
        });
        setQueue((prev) => (prev ?? []).filter((row) => `${row.targetType}:${row.targetId}` !== key));
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Impossible de classer ce signalement.');
      } finally {
        setPendingKey(null);
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
            <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Signalements</h1>
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
              <AlertTriangle size={14} />
              {queue.length} dossier{queue.length > 1 ? 's' : ''}
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
            Aucun signalement en attente.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            {queue.map((item) => {
              const key = `${item.targetType}:${item.targetId}`;
              const isPending = pendingKey === key;
              const title = item.targetType === 'LISTING' ? listingTitles[item.targetId] : undefined;

              return (
                <article
                  key={key}
                  style={{
                    background: 'var(--surface-card)',
                    border: item.autoFlagged ? '1px solid var(--error-light)' : '1px solid var(--border-hairline)',
                    borderRadius: 'var(--radius-card)',
                    boxShadow: 'var(--shadow-xs)',
                    padding: 'var(--space-4)',
                    display: 'grid',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ font: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
                        {REPORT_TARGET_LABELS[item.targetType]}
                      </div>
                      <h3 style={{ margin: '0.3rem 0 0', font: 'var(--type-h3)', color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {title ?? `#${item.targetId.slice(0, 8)}`}
                        {item.targetType === 'LISTING' ? (
                          <Link href={`/listings/${item.targetId}`} aria-label="Voir l’annonce" style={{ color: 'var(--text-subtle)', display: 'inline-flex' }}>
                            <ExternalLink size={14} />
                          </Link>
                        ) : null}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {item.autoFlagged ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            borderRadius: 'var(--radius-pill)',
                            background: 'var(--error-subtle)',
                            color: 'var(--error)',
                            padding: '0.35rem 0.6rem',
                            font: 'var(--type-label)',
                          }}
                        >
                          <AlertTriangle size={12} />
                          Suspendue automatiquement
                        </span>
                      ) : null}
                      <span style={{ borderRadius: 'var(--radius-pill)', background: 'var(--sable-50)', color: 'var(--text-muted)', padding: '0.35rem 0.6rem', font: 'var(--type-label)' }}>
                        {item.reportCount} signalement{item.reportCount > 1 ? 's' : ''} · {item.reporterCount} personne{item.reporterCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {item.reasons.map((reason) => (
                      <span
                        key={reason}
                        style={{
                          borderRadius: 'var(--radius-pill)',
                          background: 'var(--sable-50)',
                          border: '1px solid var(--border-hairline)',
                          color: 'var(--text-muted)',
                          padding: '0.3rem 0.6rem',
                          font: 'var(--type-caption)',
                        }}
                      >
                        {REPORT_REASON_LABELS[reason]}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                      Premier signalement {relativeTime(new Date(item.firstReportedAt))}
                    </span>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDismiss(item)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-pill)',
                        background: 'var(--surface-card)',
                        color: 'var(--text-primary)',
                        padding: '0.6rem 0.9rem',
                        font: 'var(--type-body-sm)',
                        cursor: isPending ? 'default' : 'pointer',
                      }}
                    >
                      <Check size={14} />
                      Classer sans suite
                    </button>
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
