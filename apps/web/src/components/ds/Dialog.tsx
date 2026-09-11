'use client';

import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';

import { IconButton } from './IconButton';

/**
 * Modal dialog — centred card on desktop, bottom sheet on mobile.
 *
 * Ported from `design-system/components/feedback/Dialog.jsx`. The **visual**
 * port is faithful: tokens, radii, the sheet grabber, the warm shadows and both
 * entry animations are exactly as specified.
 *
 * The **behaviour** is deliberately not a copy, and each difference is a defect
 * in the source rather than a preference:
 *
 * - `position: fixed`, not `absolute`. The source's own prompt file warns you
 *   must "give the parent position:relative (or use at page root)" — a modal
 *   that depends on where it is mounted will eventually be mounted somewhere it
 *   breaks.
 * - Escape closes it. The source has no key handling at all.
 * - Focus moves in on open and returns to whatever opened it on close. Without
 *   that, a keyboard user is dropped at the top of the document.
 * - Body scroll is locked while open, or the page slides underneath the sheet.
 * - The heading is wired to the dialog with `aria-labelledby`, so a screen
 *   reader announces what the dialog is for rather than just "dialog".
 *
 * The porting rules forbid improving spacing or colour, because visual drift is
 * invisible until two screens sit side by side. They do not ask a port to carry
 * accessibility bugs forward.
 */
export interface DialogProps {
  open?: boolean;
  title?: ReactNode;
  children?: ReactNode;
  /** Actions. Use `<Button fullWidth>` inside a sheet, per the source spec. */
  footer?: ReactNode;
  onClose?: () => void;
  /** Bottom sheet instead of a centred card. The mobile presentation. */
  sheet?: boolean;
  width?: number;
  style?: CSSProperties;
}

export function Dialog({
  open = true,
  title,
  children,
  footer,
  onClose,
  sheet = false,
  width = 440,
  style,
}: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Callers pass onClose as an inline arrow function, so its reference
  // changes on every render of the caller -- including a render triggered by
  // typing into a field inside this dialog. With onClose in the effect's own
  // dependency array, that re-ran the effect on every keystroke and
  // panelRef.current.focus() yanked focus off the input back onto the dialog
  // panel: the first character of anything typed landed, the rest didn't.
  // Found 2026-09-09 typing a rejection reason in the admin queue. A ref
  // keeps the latest onClose available to the Escape handler without making
  // the focus-management effect below depend on it.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }

      // Without this, Tab walks off the end of the panel's focusable elements
      // and onto whatever the dialog happens to sit before/after in the DOM --
      // page content that's still visually behind the scrim and, per
      // aria-modal="true", supposed to be unreachable while the dialog is
      // open. Found live: opening a report dialog and tabbing six times
      // landed focus on a footer link the user couldn't see.
      if (event.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const current = document.activeElement as HTMLElement;

        if (event.shiftKey) {
          if (current === first || current === panel) {
            event.preventDefault();
            last.focus();
          }
        } else if (current === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: sheet ? 'flex-end' : 'center',
        justifyContent: 'center',
        background: 'var(--surface-scrim)',
        backdropFilter: 'blur(2px)',
        padding: sheet ? 0 : 'var(--space-5)',
        zIndex: 50,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={{
          width: sheet ? '100%' : width,
          maxWidth: '100%',
          maxHeight: sheet ? '85vh' : 'calc(100vh - var(--space-5) * 2)',
          overflowY: 'auto',
          background: 'var(--surface-card)',
          borderRadius: sheet ? 'var(--radius-sheet) var(--radius-sheet) 0 0' : 'var(--radius-xl)',
          boxShadow: sheet ? 'var(--shadow-sheet)' : 'var(--shadow-lg)',
          animation: sheet
            ? 'dari-sheet-in var(--dur-sheet) var(--ease-out)'
            : 'dari-pop-in var(--dur-med) var(--ease-out)',
          outline: 'none',
          ...style,
        }}
      >
        {sheet && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
            <span
              style={{ width: 40, height: 4, borderRadius: 'var(--radius-pill)', background: 'var(--sable-300)' }}
            />
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-4)',
            padding: 'var(--space-6) var(--space-6) var(--space-4)',
          }}
        >
          <h2 id={titleId} style={{ flex: 1, margin: 0, font: 'var(--type-h2)' }}>
            {title}
          </h2>
          {onClose && <IconButton icon="x" size="sm" variant="ghost" label="Fermer" onClick={onClose} />}
        </div>
        <div style={{ padding: '0 var(--space-6)', font: 'var(--type-body)', color: 'var(--text-body)' }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-4)',
              justifyContent: 'flex-end',
              padding: 'var(--space-6)',
              marginTop: 'var(--space-5)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
