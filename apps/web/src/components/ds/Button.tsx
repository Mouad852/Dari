'use client';

import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

import { Icon } from './Icon';

/**
 * The one action control — pill radius, 44px default height, terracotta primary.
 *
 * Ported from `design-system/components/core/Button.jsx`. Every `var(--token)`
 * is kept exactly as written: the porting rules are explicit that a port which
 * "improves" spacing or colour is worse than no port, because the drift only
 * becomes visible when two screens sit side by side.
 *
 * Rules from the source spec: one primary per view; use `fullWidth` inside
 * mobile sheets; never square the corners.
 */

const SIZES = {
  sm: { h: 'var(--control-h-sm)', px: 14, fs: 'var(--text-body-sm)', gap: 6, icon: 16 },
  md: { h: 'var(--control-h-md)', px: 20, fs: 'var(--text-body-md)', gap: 8, icon: 18 },
  lg: { h: 'var(--control-h-lg)', px: 24, fs: 'var(--text-body-lg)', gap: 10, icon: 20 },
} as const;

const VARIANTS = {
  primary: {
    bg: 'var(--brand)',
    fg: 'var(--text-on-brand)',
    bd: 'transparent',
    hover: 'var(--brand-hover)',
    press: 'var(--brand-press)',
    shadow: 'var(--shadow-brand)',
  },
  secondary: {
    bg: 'var(--surface-card)',
    fg: 'var(--text-heading)',
    bd: 'var(--border-default)',
    hover: 'var(--sable-50)',
    press: 'var(--sable-100)',
    shadow: 'var(--shadow-xs)',
  },
  subtle: {
    bg: 'var(--brand-subtle)',
    fg: 'var(--clay-700)',
    bd: 'transparent',
    hover: 'var(--brand-subtle-hover)',
    press: 'var(--clay-200)',
    shadow: 'none',
  },
  ghost: {
    bg: 'transparent',
    fg: 'var(--text-body)',
    bd: 'transparent',
    hover: 'var(--sable-100)',
    press: 'var(--sable-200)',
    shadow: 'none',
  },
  danger: {
    bg: 'var(--danger)',
    fg: '#fff',
    bd: 'transparent',
    hover: 'var(--rose-700)',
    press: 'var(--rose-700)',
    shadow: 'none',
  },
} as const;

export interface ButtonProps {
  children?: ReactNode;
  /** primary = terracotta fill; secondary = white + hairline; subtle = clay tint; ghost = text only; danger = destructive. */
  variant?: keyof typeof VARIANTS;
  /** sm 36px / md 44px / lg 52px. md is the mobile default and meets the 44px tap target. */
  size?: keyof typeof SIZES;
  /** Lucide slug rendered before the label. */
  iconLeft?: string;
  /** Lucide slug rendered after the label. */
  iconRight?: string;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Defaults to "button": a bare <button> inside a form submits it. */
  type?: 'button' | 'submit';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
  /**
   * The app's only way to express a media query. Inline styles cannot, so a
   * control that appears at one breakpoint and not another needs a class the
   * stylesheet can reach -- the filters disclosure on /listings, for one.
   */
  className?: string;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
  'aria-expanded'?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  fullWidth = false,
  loading = false,
  disabled = false,
  type = 'button',
  onClick,
  style,
  ...rest
}: ButtonProps) {
  const s = SIZES[size] ?? SIZES.md;
  const v = VARIANTS[variant] ?? VARIANTS.primary;
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const off = disabled || loading;

  return (
    <button
      type={type}
      disabled={off}
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
        gap: s.gap,
        height: s.h,
        padding: `0 ${s.px}px`,
        width: fullWidth ? '100%' : 'auto',
        font: `var(--weight-semibold) ${s.fs}/1 var(--font-ui)`,
        letterSpacing: '0em',
        color: v.fg,
        background: off ? 'var(--sable-200)' : pressed ? v.press : hovered ? v.hover : v.bg,
        border: `1px solid ${off ? 'transparent' : v.bd}`,
        borderRadius: 'var(--radius-pill)',
        boxShadow: off ? 'none' : hovered && variant === 'primary' ? 'var(--shadow-brand)' : v.shadow,
        transform: pressed && !off ? 'scale(var(--press-scale))' : 'none',
        cursor: off ? 'not-allowed' : 'pointer',
        transition: 'var(--transition-control)',
        opacity: off ? 0.75 : 1,
        ...style,
      }}
      {...rest}
    >
      {loading && (
        <Icon name="loader-circle" size={s.icon} style={{ animation: 'dari-spin 900ms linear infinite' }} />
      )}
      {!loading && iconLeft && <Icon name={iconLeft} size={s.icon} />}
      {children}
      {!loading && iconRight && <Icon name={iconRight} size={s.icon} />}
    </button>
  );
}
