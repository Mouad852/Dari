'use client';

import type { CSSProperties, ReactNode } from 'react';

import { Icon } from './Icon';

/**
 * Transient confirmation — short, bottom-anchored, gone in about three seconds.
 * Never for an error that needs a decision; that is a `Dialog`.
 *
 * Ported from `design-system/components/feedback/Toast.jsx`, tokens untouched.
 *
 * Presentational on purpose: the lifetime and the stacking belong to whatever
 * renders it, because a toast that dismisses itself cannot be paused when the
 * user is still reading it.
 *
 * One deviation — a `danger` toast is `role="alert"`, not `role="status"`.
 * `status` is polite: a screen reader finishes what it is saying first, which is
 * right for "Annonce enregistrée" and wrong for a failure.
 */
const TONES = {
  neutral: { bg: 'var(--surface-inverse)', fg: 'var(--text-on-inverse)', icon: 'info' },
  success: { bg: 'var(--atlas-500)', fg: '#fff', icon: 'check' },
  danger: { bg: 'var(--rose-500)', fg: '#fff', icon: 'triangle-alert' },
} as const;

export interface ToastProps {
  children?: ReactNode;
  tone?: keyof typeof TONES;
  /** Lucide slug override. */
  icon?: string;
  /** Inline action label, e.g. "Annuler". */
  action?: string;
  onAction?: () => void;
  style?: CSSProperties;
}

export function Toast({ children, tone = 'neutral', icon, action, onAction, style }: ToastProps) {
  const t = TONES[tone] ?? TONES.neutral;

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: '12px 16px',
        background: t.bg,
        color: t.fg,
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        font: 'var(--weight-medium) var(--text-body-sm)/1.4 var(--font-ui)',
        animation: 'dari-toast-in var(--dur-med) var(--ease-out)',
        ...style,
      }}
    >
      <Icon name={icon || t.icon} size={18} />
      <span style={{ flex: 1 }}>{children}</span>
      {action && (
        <button
          type="button"
          onClick={onAction}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            font: 'var(--weight-bold) var(--text-body-sm)/1 var(--font-ui)',
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
