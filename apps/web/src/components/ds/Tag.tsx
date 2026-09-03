'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';

import { Icon } from './Icon';

/**
 * Selectable filter chip / amenity tag.
 *
 * Ported from `design-system/components/core/Tag.jsx`, tokens untouched. Note
 * that the selected state is charcoal `--sable-900`, not terracotta — the design
 * system reserves the brand colour for the primary action so a selected chip
 * never competes with the button beneath it. That rule was re-derived by hand in
 * the search filter panel before this port existed.
 *
 * `removable` renders the dismiss affordance as a span rather than a nested
 * button, because a button inside a button is invalid markup. It is therefore
 * pointer-only; a keyboard user removes the tag by activating the chip itself.
 * Worth revisiting if a design ever needs the two actions to differ.
 */
export interface TagProps {
  children?: ReactNode;
  /** Lucide slug shown before the label. */
  icon?: string;
  selected?: boolean;
  removable?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  'aria-pressed'?: boolean;
}

export function Tag({
  children,
  icon,
  selected = false,
  removable = false,
  onClick,
  onRemove,
  disabled = false,
  style,
  ...rest
}: TagProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={rest['aria-pressed'] ?? selected}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 36,
        padding: '0 14px',
        background: selected ? 'var(--sable-900)' : hovered ? 'var(--sable-100)' : 'var(--surface-card)',
        color: selected ? 'var(--text-on-inverse)' : 'var(--text-body)',
        border: `1px solid ${selected ? 'var(--sable-900)' : 'var(--border-hairline)'}`,
        borderRadius: 'var(--radius-chip)',
        font: 'var(--weight-medium) var(--text-body-sm)/1 var(--font-ui)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'var(--transition-control)',
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
      {removable && (
        <span
          role="presentation"
          onClick={(event) => {
            event.stopPropagation();
            onRemove?.();
          }}
          style={{ display: 'inline-flex', opacity: 0.6, marginLeft: 2 }}
        >
          <Icon name="x" size={14} />
        </span>
      )}
    </button>
  );
}
