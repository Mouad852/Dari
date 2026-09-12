'use client';

import { AlertTriangle, Ban, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { relativeTime } from '@/lib/format';
import { REPORT_REASON_LABELS, REPORT_TARGET_LABELS } from '@/lib/labels';

const ACTION_REASON_PROMPT: Record<'DISMISS' | 'SUSPEND' | 'BAN', string> = {
  DISMISS: 'Raison du classement sans suite (facultatif) :',
  SUSPEND: 'Raison de la suspension (facultatif) :',
  BAN: 'Raison du bannissement (facultatif) :',
};

const queueActionStyle = (pending: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--surface-card)',
  color: 'var(--text-heading)',
  padding: '0.6rem 0.9rem',
  font: 'var(--type-body-sm)',
  cursor: pending ? 'default' : 'pointer',
  opacity: pending ? 0.6 : 1,
});
import type { AdminReportQueueItem } from '@/types/api';

export default function AdminReportsPage() {
  const [queue, setQueue] = useState<AdminReportQueueItem[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
   * Same `disabled={<async state>}` focus loss as the other moderation
   * queue: every action button shares `isPending`, and a successful action
   * always removes the row (`setQueue` filters it out), unmounting the
   * button -- and its row's own `<h3>` -- that had focus. Falls back to
   * the row title on a failure (row stays, button re-enables but the
   * capture may already be stale) and the page heading once the row itself
   * is gone.
   */
  const lastFocusedBeforeActionRef = useRef<HTMLElement | null>(null);
  const lastActionKeyRef = useRef<string | null>(null);
  const armActionRefocus = (key: string) => {
    const active = document.activeElement;
    lastFocusedBeforeActionRef.current = active instanceof HTMLElement ? active : null;
    lastActionKeyRef.current = key;
  };
  useEffect(() => {
    if (pendingKey === null && lastFocusedBeforeActionRef.current) {
      const el = lastFocusedBeforeActionRef.current;
      const key = lastActionKeyRef.current;
      lastFocusedBeforeActionRef.current = null;
      lastActionKeyRef.current = null;
      const usable = el.isConnected && !(el instanceof HTMLButtonElement && el.disabled);
      if (usable) {
        el.focus();
      } else {
        const rowTitle = key ? rowTitleRefs.current.get(key) : undefined;
        (rowTitle ?? pageHeadingRef.current)?.focus();
      }
    }
  }, [pendingKey]);

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


  const handleAction = (item: AdminReportQueueItem, action: 'DISMISS' | 'SUSPEND' | 'BAN') => {
    const key = `${item.targetType}:${item.targetId}`;
    if (pendingKey || !token) return;

    // Suspend and ban change someone's account or take a listing down, so they
    // ask twice. Dismiss is reversible in effect -- the reports simply close.
    if (action !== 'DISMISS') {
      const target = item.targetLabel ?? `#${item.targetId.slice(0, 8)}`;
      const question = action === 'BAN'
        ? `Bannir définitivement ${target} ? Ses annonces seront retirées et son adresse ne pourra plus se réinscrire.`
        : `Suspendre ${target} ?`;
      if (!window.confirm(question)) return;
    }

    const reason = window.prompt(ACTION_REASON_PROMPT[action]) ?? undefined;

    armActionRefocus(key);
    setPendingKey(key);
    setError(null);
    void (async () => {
      try {
        await apiFetch(`/admin/reports/${item.targetType}/${encodeURIComponent(item.targetId)}/action`, {
          method: 'POST',
          token,
          body: { action, reason },
        });
        setQueue((prev) => (prev ?? []).filter((row) => `${row.targetType}:${row.targetId}` !== key));
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Action impossible sur ce signalement.');
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
        color: 'var(--text-heading)',
        padding: 'var(--space-6) var(--gutter-mobile) var(--space-8)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-5)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Modération
            </div>
            <h1 ref={pageHeadingRef} tabIndex={-1} style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Signalements</h1>
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
                color: 'var(--clay-700)',
                padding: '0.5rem 0.8rem',
                font: 'var(--type-label)',
              }}
            >
              <AlertTriangle size={14} aria-hidden="true" />
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
              const title = item.targetLabel;

              return (
                <article
                  key={key}
                  style={{
                    background: 'var(--surface-card)',
                    border: item.autoFlagged ? '1px solid var(--danger-border)' : '1px solid var(--border-hairline)',
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
                      <h2
                        ref={(el) => {
                          if (el) rowTitleRefs.current.set(key, el);
                          else rowTitleRefs.current.delete(key);
                        }}
                        tabIndex={-1}
                        style={{ margin: '0.3rem 0 0', font: 'var(--type-h3)', color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        {title ?? `#${item.targetId.slice(0, 8)}`}
                        {item.targetType === 'LISTING' ? (
                          <Link href={`/listings/${item.targetId}`} aria-label="Voir l’annonce" style={{ color: 'var(--text-subtle)', display: 'inline-flex' }}>
                            <ExternalLink size={14} aria-hidden="true" />
                          </Link>
                        ) : null}
                      </h2>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {item.autoFlagged ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            borderRadius: 'var(--radius-pill)',
                            background: 'var(--danger-subtle)',
                            color: 'var(--danger)',
                            padding: '0.35rem 0.6rem',
                            font: 'var(--type-label)',
                          }}
                        >
                          <AlertTriangle size={12} aria-hidden="true" />
                          Suspendue automatiquement
                        </span>
                      ) : null}
                      <span style={{ borderRadius: 'var(--radius-pill)', background: 'var(--sable-50)', color: 'var(--text-muted)', padding: '0.35rem 0.6rem', font: 'var(--type-label)' }}>
                        {item.reportCount} signalement{item.reportCount > 1 ? 's' : ''} · {item.reporterCount} personne{item.reporterCount > 1 ? 's' : ''}
                      </span>
                      {/*
                        Context for weighing the item: reports from people whose
                        past reports were all dismissed read differently from the
                        same count from first-time reporters.
                      */}
                      {item.priorDismissedReports > 0 ? (
                        <span
                          title="Signalements précédemment classés sans suite, de ces mêmes personnes"
                          style={{ borderRadius: 'var(--radius-pill)', background: 'var(--sable-50)', color: 'var(--text-muted)', padding: '0.35rem 0.6rem', font: 'var(--type-label)' }}
                        >
                          {item.priorDismissedReports} déjà classé{item.priorDismissedReports > 1 ? 's' : ''} sans suite
                        </span>
                      ) : null}
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

                  {/*
                    The reason chips are a category; this is what the reporter
                    actually wrote. The backend always sent it (ReportResponse
                    has had `details` from the start) but the grouped admin
                    queue silently dropped it, so a moderator judging e.g. a
                    scam report never saw the one thing most likely to say
                    what happened. Found 2026-09-09.
                  */}
                  {item.details.length > 0 ? (
                    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                      {item.details.map((text, index) => (
                        <p
                          key={index}
                          style={{
                            margin: 0,
                            fontStyle: 'italic',
                            fontWeight: 'var(--weight-regular)',
                            fontSize: 'var(--text-body-sm)',
                            fontFamily: 'var(--font-ui)',
                            lineHeight: 1.5,
                            color: 'var(--text-body)',
                            paddingLeft: 'var(--space-3)',
                            borderLeft: '2px solid var(--border-default)',
                          }}
                        >
                          « {text} »
                        </p>
                      ))}
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                      Premier signalement {relativeTime(new Date(item.firstReportedAt))}
                    </span>

                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleAction(item, 'DISMISS')}
                        style={queueActionStyle(isPending)}
                      >
                        <Check size={14} aria-hidden="true" />
                        Classer sans suite
                      </button>

                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleAction(item, 'SUSPEND')}
                        style={{ ...queueActionStyle(isPending), color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                      >
                        <AlertTriangle size={14} aria-hidden="true" />
                        {item.targetType === 'LISTING' ? 'Suspendre l’annonce' : 'Suspendre le compte'}
                      </button>

                      {/* Banning is an account action; there is no such thing as banning a listing. */}
                      {item.targetType === 'USER' ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleAction(item, 'BAN')}
                          style={{ ...queueActionStyle(isPending), color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                        >
                          <Ban size={14} aria-hidden="true" />
                          Bannir
                        </button>
                      ) : null}
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
