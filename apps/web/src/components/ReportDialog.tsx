'use client';

import { Flag, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

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
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    // Without this the page behind the overlay scrolls under the dialog.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    // Returning focus to the trigger is what makes this usable by keyboard;
    // otherwise focus falls back to the top of the document on close.
    triggerRef.current?.focus();
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
        ref={triggerRef}
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
        <Flag size={14} aria-hidden="true" />
        {label}
      </button>

      {open && (
        <div
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(28, 25, 23, 0.55)',
            display: 'grid',
            placeItems: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={{
              width: '100%',
              maxWidth: 460,
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'var(--surface-card)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-sheet)',
              padding: 'var(--space-5)',
              display: 'grid',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <h2 id={titleId} style={{ margin: 0, font: 'var(--type-h3)', color: 'var(--text-heading)' }}>
                {done ? 'Signalement reçu' : 'Signaler ce contenu'}
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Fermer"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  lineHeight: 0,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {done ? (
              <>
                <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  Merci, votre signalement a bien été enregistré. Notre équipe l’examinera.
                </p>
                <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Pour préserver la confidentialité des personnes concernées, nous ne communiquons pas
                  la suite donnée à un signalement.
                </p>
                <button type="button" onClick={close} style={primaryButtonStyle(false)}>
                  Fermer
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Choisissez le motif qui correspond le mieux. Les signalements sont examinés par
                  notre équipe de modération.
                </p>

                <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 'var(--space-2)' }}>
                  <legend
                    style={{
                      padding: 0,
                      marginBottom: 'var(--space-2)',
                      font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)',
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
                        borderRadius: 'var(--radius-md)',
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
                  <span style={{ font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)', color: 'var(--text-heading)' }}>
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
                      resize: 'vertical',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.7rem 0.8rem',
                      font: 'var(--type-body-sm)',
                      color: 'var(--text-primary)',
                      background: 'var(--surface-card)',
                    }}
                  />
                  <span style={{ font: 'var(--type-label)', color: 'var(--text-muted)', justifySelf: 'end' }}>
                    {details.length} / {DETAILS_MAX}
                  </span>
                </label>

                {error && (
                  <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>
                    {error}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={close}
                    style={{
                      border: '1px solid var(--border-default)',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '0.8rem 1.1rem',
                      font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)',
                      cursor: 'pointer',
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={!canSubmit || pending}
                    style={primaryButtonStyle(!canSubmit || pending)}
                  >
                    {pending ? 'Envoi…' : 'Envoyer le signalement'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  border: 'none',
  background: 'var(--brand)',
  color: '#fff',
  borderRadius: 'var(--radius-pill)',
  padding: '0.8rem 1.1rem',
  font: 'var(--weight-semibold) var(--type-body-sm) var(--font-ui)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.55 : 1,
});
