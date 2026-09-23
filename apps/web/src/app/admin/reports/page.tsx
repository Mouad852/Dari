'use client';

import { AlertTriangle, Ban, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ds/Button';
import { Dialog } from '@/components/ds/Dialog';
import { Textarea } from '@/components/ds/Textarea';
import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { relativeTime } from '@/lib/format';
import { REPORT_REASON_LABELS, REPORT_TARGET_LABELS } from '@/lib/labels';

type QueueAction = 'DISMISS' | 'SUSPEND' | 'BAN';

const ACTION_REASON_LABEL: Record<QueueAction, string> = {
  DISMISS: 'Raison du classement sans suite (facultatif)',
  SUSPEND: 'Raison de la suspension (facultatif)',
  BAN: 'Raison du bannissement (facultatif)',
};

// Where the text goes (AdminService): a ban reason is the body of the email
// the banned person receives; a listing suspension stores it on the listing
// (rejectionReason, returned to its owner by the API) but its email is fixed
// text; dismissing, or suspending an account, only reaches the moderation log.
const actionReasonHelper = (action: QueueAction, targetType: AdminReportQueueItem['targetType']) => {
  if (action === 'BAN') return 'Envoyée par e-mail à la personne bannie. Sans raison, elle reçoit un message générique.';
  if (action === 'SUSPEND' && targetType === 'LISTING') {
    return 'Enregistrée sur l’annonce et dans le journal de modération. Elle n’est pas envoyée par e-mail.';
  }
  return 'Conservée dans le journal de modération, jamais envoyée.';
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


  /*
   * Each action used to go through window.confirm (suspend, ban) and then
   * window.prompt for the reason -- and cancelling that prompt still ran the
   * action, with no reason. One Dialog now carries the question and a
   * labelled reason field, and "Annuler" or Escape cancels the whole action.
   *
   * The opener is refocused before the action starts for the same reason as
   * on account/listings/page.tsx: armActionRefocus captures whatever has
   * focus, and at confirm time that is the dialog's button, about to unmount.
   */
  const [confirming, setConfirming] = useState<{ item: AdminReportQueueItem; action: QueueAction } | null>(null);
  const [reason, setReason] = useState('');
  const confirmOpenerRef = useRef<HTMLElement | null>(null);

  const handleAction = (item: AdminReportQueueItem, action: QueueAction) => {
    if (pendingKey || !token) return;
    const active = document.activeElement;
    confirmOpenerRef.current = active instanceof HTMLElement ? active : null;
    setReason('');
    setConfirming({ item, action });
  };

  const confirmAction = () => {
    if (!confirming || pendingKey || !token) return;
    const { item, action } = confirming;
    const key = `${item.targetType}:${item.targetId}`;
    const trimmedReason = reason.trim() || undefined;
    confirmOpenerRef.current?.focus();
    setConfirming(null);

    armActionRefocus(key);
    setPendingKey(key);
    setError(null);
    void (async () => {
      try {
        await apiFetch(`/admin/reports/${item.targetType}/${encodeURIComponent(item.targetId)}/action`, {
          method: 'POST',
          token,
          body: { action, reason: trimmedReason },
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

      {confirming && (
        <Dialog
          open
          title={
            confirming.action === 'DISMISS'
              ? 'Classer sans suite ?'
              : confirming.action === 'BAN'
                ? 'Bannir définitivement ce compte ?'
                : confirming.item.targetType === 'LISTING' ? 'Suspendre l’annonce ?' : 'Suspendre le compte ?'
          }
          onClose={() => setConfirming(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(null)}>Annuler</Button>
              <Button variant={confirming.action === 'DISMISS' ? 'primary' : 'danger'} onClick={confirmAction}>
                {confirming.action === 'DISMISS' ? 'Classer sans suite' : confirming.action === 'BAN' ? 'Bannir' : 'Suspendre'}
              </Button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-body)' }}>
              <strong style={{ color: 'var(--text-heading)' }}>
                {confirming.item.targetLabel ?? `#${confirming.item.targetId.slice(0, 8)}`}
              </strong>
              {confirming.action === 'DISMISS' ? ' : les signalements en attente seront clos sans action.' : null}
              {confirming.action === 'BAN' ? ' : ses annonces seront retirées et son adresse ne pourra plus se réinscrire.' : null}
            </p>
            <Textarea
              label={ACTION_REASON_LABEL[confirming.action]}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={1000}
              helper={actionReasonHelper(confirming.action, confirming.item.targetType)}
            />
          </div>
        </Dialog>
      )}
    </main>
  );
}
