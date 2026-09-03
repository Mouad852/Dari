'use client';

import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

/**
 * Base surface: white, 18px radius, warm hairline and a soft brown-tinted shadow.
 *
 * Ported from `design-system/components/core/Card.jsx`, tokens untouched.
 */

const ELEVATIONS = {
  none: 'none',
  xs: 'var(--shadow-xs)',
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
} as const;

export interface CardProps {
  children?: ReactNode;
  padding?: string;
  /** Lifts and deepens its shadow on hover. Use for cards that are themselves links. */
  interactive?: boolean;
  elevation?: keyof typeof ELEVATIONS;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  style?: CSSProperties;
}

export function Card({
  children,
  padding = 'var(--card-pad)',
  interactive = false,
  elevation = 'sm',
  onClick,
  style,
}: CardProps) {
  const [hovered, setHovered] = useState(false);
  const shadow = ELEVATIONS[elevation] ?? ELEVATIONS.sm;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-card)',
        padding,
        boxShadow: interactive && hovered ? 'var(--shadow-md)' : shadow,
        transform: interactive && hovered ? 'translateY(-2px)' : 'none',
        transition:
          'box-shadow var(--dur-med) var(--ease-standard), transform var(--dur-med) var(--ease-standard)',
        cursor: interactive ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
