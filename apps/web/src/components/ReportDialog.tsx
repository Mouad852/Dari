'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ds/Button';
import { Dialog } from '@/components/ds/Dialog';
import { Icon } from '@/components/ds/Icon';
import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { REPORT_REASON_LABELS } from '@/lib/labels';
import type { ReportReason, ReportTargetType } from '@/types/api';

const REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

const DETAILS_MAX = 2000;

/**
 * Files a report against a listing or a user.
 *
 * The backend for this has existed since phase 06 — `POST /reports`, plus the
 * rule that three distinct reporters inside a rolling seven days auto-suspend
 * the target — but nothing in the product could reach it, so the moderation
 * queue could only ever be empty in production.
 *
 * The acknowledgment is deliberately generic. Design doc §6 is explicit that a
 * reporter learns their report was received and nothing further: not the
 * outcome, not the target's state, not whether anyone acted. Confirming an
 * outcome here would turn the queue into an oracle for whether a rival's
 * listing had been touched.
 *
 * The modal chrome — overlay, sheet-on-mobile, focus handling, Escape, scroll
 * lock — now comes from the design-system `Dialog`. It was hand-rolled here
 * first, before the component was ported; the two had independently arrived at
 * the same behaviour.
 */
export function ReportDialog({
  targetType,
  targetId,
  label = 'Signaler',
}: {
  targetType: ReportTargetType;
  targetId: string;
  /** Trigger copy. Verb-first, per the copy rules. */
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const close = () => {
    setOpen(false);
    if (done) {
      setDone(false);
      setReason(null);
      setDetails('');
    }
    setError(null);
  };

  // OTHER exists precisely because the closed list cannot cover everything, so
  // it is the one reason where the note carries the whole report.
  const detailsRequired = reason === 'OTHER';
  const canSubmit = reason !== null && (!detailsRequired || details.trim().length > 0);

  const submit = async () => {
    if (!reason || pending) return;
    setPending(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        router.push('/sign-in');
        return;
      }
      await apiFetch('/reports', {
        method: 'POST',
        token,
        body: {
          targetType,
          targetId,
          reason,
          details: details.trim() ? details.trim() : null,
        },
      });
      setDone(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Envoi du signalement impossible. Réessayez dans un instant.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
          padding: 0,
          font: 'var(--type-body-sm)',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        <Icon name="flag" size={14} />
        {label}
      </button>

      <Dialog
        open={open}
        onClose={close}
        title={done ? 'Signalement reçu' : 'Signaler ce contenu'}
        footer={
          done ? (
            <Button onClick={close}>Fermer</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>
                Annuler
              </Button>
              <Button onClick={() => void submit()} disabled={!canSubmit} loading={pending}>
                Envoyer le signalement
              </Button>
            </>
          )
        }
      >
        {done ? (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              Merci, votre signalement a bien été enregistré. Notre équipe l’examinera.
            </p>
            <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Pour préserver la confidentialité des personnes concernées, nous ne communiquons pas la
              suite donnée à un signalement.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Choisissez le motif qui correspond le mieux. Les signalements sont examinés par notre
              équipe de modération.
            </p>

            <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 'var(--space-2)' }}>
              <legend
                style={{
                  padding: 0,
                  marginBottom: 'var(--space-2)',
                  font: 'var(--type-label)',
                  color: 'var(--text-heading)',
                }}
              >
                Motif
              </legend>
              {REASONS.map((value) => (
                <label
                  key={value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: '0.6rem 0.75rem',
                    border: `1px solid ${reason === value ? 'var(--brand)' : 'var(--border-hairline)'}`,
                    borderRadius: 'var(--radius-control)',
                    background: reason === value ? 'var(--brand-subtle)' : 'var(--surface-card)',
                    cursor: 'pointer',
                    font: 'var(--type-body-sm)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    style={{ accentColor: 'var(--brand)' }}
                  />
                  {REPORT_REASON_LABELS[value]}
                </label>
              ))}
            </fieldset>

            <label style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <span style={{ font: 'var(--type-label)', color: 'var(--text-heading)' }}>
                Détails {detailsRequired ? '(requis)' : '(facultatif)'}
              </span>
              <textarea
                value={details}
                maxLength={DETAILS_MAX}
                onChange={(event) => setDetails(event.target.value)}
                rows={4}
                placeholder={
                  detailsRequired
                    ? 'Décrivez ce qui pose problème.'
                    : 'Ajoutez un contexte utile à la modération.'
                }
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-control)',
                  padding: '0.7rem 0.8rem',
                  font: 'var(--type-body-sm)',
                  color: 'var(--text-heading)',
                  background: 'var(--surface-card)',
                }}
              />
              <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', justifySelf: 'end' }}>
                {details.length} / {DETAILS_MAX}
              </span>
            </label>

            {error && (
              <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>
                {error}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
