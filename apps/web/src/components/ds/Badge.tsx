import type { CSSProperties, ReactNode } from 'react';

import { Icon } from './Icon';

/**
 * Small status marker — "Vérifié", "Nouveau", "Dernière chambre".
 *
 * Ported from `design-system/components/core/Badge.jsx`, tokens untouched.
 * No client directive: it holds no state, so it renders on the server.
 */

const TONES = {
  brand: { bg: 'var(--brand-subtle)', fg: 'var(--clay-700)', bd: 'var(--brand-border)' },
  neutral: { bg: 'var(--sable-100)', fg: 'var(--text-muted)', bd: 'var(--border-hairline)' },
  success: { bg: 'var(--success-subtle)', fg: 'var(--atlas-700)', bd: 'var(--success-border)' },
  warning: { bg: 'var(--warning-subtle)', fg: 'var(--saffron-700)', bd: 'var(--warning-border)' },
  danger: { bg: 'var(--danger-subtle)', fg: 'var(--rose-700)', bd: 'var(--danger-border)' },
  inverse: { bg: 'var(--surface-inverse)', fg: 'var(--text-on-inverse)', bd: 'transparent' },
} as const;

export interface BadgeProps {
  children?: ReactNode;
  tone?: keyof typeof TONES;
  /** Lucide slug shown before the label. */
  icon?: string;
  size?: 'sm' | 'md';
  style?: CSSProperties;
  title?: string;
}

export function Badge({ children, tone = 'brand', icon, size = 'md', style, ...rest }: BadgeProps) {
  const t = TONES[tone] ?? TONES.brand;
  const sm = size === 'sm';

  return (
    <span
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: sm ? '2px 8px' : '4px 10px',
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        borderRadius: 'var(--radius-pill)',
        font: `var(--weight-semibold) ${sm ? 'var(--text-micro)' : 'var(--text-caption)'}/1.3 var(--font-ui)`,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={sm ? 11 : 13} />}
      {children}
    </span>
  );
}
