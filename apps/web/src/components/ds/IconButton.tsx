'use client';

import { useState, type CSSProperties, type MouseEvent } from 'react';

import { Icon } from './Icon';

/**
 * Circular icon-only control — favourites, close, back, share.
 *
 * Ported from `design-system/components/core/IconButton.jsx`, tokens untouched.
 * Two accessibility departures from the source:
 *
 * - `label` is required rather than optional: the source falls back to the icon
 *   slug for `aria-label`, which would announce "heart" or "share-2" to a screen
 *   reader instead of what the control does.
 * - `active` defaults to undefined, not false, so `aria-pressed` is emitted only
 *   by controls that are genuinely toggles. With a `false` default, every plain
 *   action button — close a dialog, delete a photo, reorder one — announced
 *   itself as an unpressed toggle button, which tells the user to expect a state
 *   that the control does not have.
 */

const SIZES = { sm: 36, md: 44, lg: 52 } as const;

const VARIANTS = {
  secondary: {
    bg: 'var(--surface-card)',
    fg: 'var(--text-heading)',
    // Not --border-hairline: this is the resting-state boundary of a real
    // control, the same role Input/Select/Textarea's border plays (see
    // colors.css's note on --border-default vs --border-hairline).
    bd: 'var(--border-default)',
    sh: 'var(--shadow-sm)',
  },
  glass: {
    bg: 'var(--surface-glass)',
    fg: 'var(--sable-900)',
    bd: 'rgba(255,255,255,.6)',
    sh: 'var(--shadow-sm)',
  },
  ghost: { bg: 'transparent', fg: 'var(--text-body)', bd: 'transparent', sh: 'none' },
  brand: { bg: 'var(--brand)', fg: '#fff', bd: 'transparent', sh: 'var(--shadow-brand)' },
} as const;

export interface IconButtonProps {
  icon?: string;
  size?: keyof typeof SIZES;
  variant?: keyof typeof VARIANTS;
  /**
   * Toggle state. Renders the glyph in the brand colour and sets `aria-pressed`.
   * Leave it unset on a control that is not a toggle.
   */
  active?: boolean;
  /** What the control does, for screen readers. Not the icon name. */
  label: string;
  /** Fills the glyph — the saved heart, a filled star. */
  fill?: string;
  disabled?: boolean;
  /** Receives the event, so a button layered over a card link can stop it. */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
}

export function IconButton({
  icon = 'heart',
  size = 'md',
  variant = 'secondary',
  active,
  label,
  fill,
  disabled = false,
  onClick,
  style,
}: IconButtonProps) {
  const d = SIZES[size] ?? SIZES.md;
  const looks = VARIANTS[variant] ?? VARIANTS.secondary;
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: d,
        height: d,
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${looks.bd}`,
        background: looks.bg,
        color: active ? 'var(--brand)' : looks.fg,
        boxShadow: looks.sh,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        backdropFilter: variant === 'glass' ? 'var(--blur-glass)' : undefined,
        transform: pressed ? 'scale(var(--press-scale))' : hovered ? 'scale(1.03)' : 'none',
        transition: 'var(--transition-control)',
        ...style,
      }}
    >
      <Icon name={icon} size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} fill={fill} />
    </button>
  );
}
