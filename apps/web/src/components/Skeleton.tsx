import type { CSSProperties, ReactNode } from 'react';

/**
 * The building blocks for a route's loading.tsx.
 *
 * Deliberately plain elements rather than the design system's Card: a skeleton
 * must not ship client JavaScript to draw a grey box, and it must be able to
 * copy a page's exact padding and heights, which is what keeps the content
 * from jumping when it arrives.
 */
export function Skeleton({
  width = '100%',
  height,
  radius = 'var(--radius-sm)',
  shade,
  style,
}: {
  width?: number | string;
  height: number | string;
  radius?: string;
  /** The darker tone, for a block that stands for an image. */
  shade?: 'strong';
  style?: CSSProperties;
}) {
  return (
    <span
      className="skeleton"
      data-shade={shade}
      aria-hidden="true"
      style={{ display: 'block', width, height, borderRadius: radius, ...style }}
    />
  );
}

/** A skeleton in the shape of one of the app's cards. */
export function SkeletonCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--card-pad)',
        display: 'grid',
        gap: 'var(--space-3)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The region wrapper. One role="status" per route, announced once as
 * "Chargement…", rather than a live region per grey box.
 */
export function SkeletonRegion({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" style={style}>
      <span className="visually-hidden">{label}</span>
      {children}
    </div>
  );
}
