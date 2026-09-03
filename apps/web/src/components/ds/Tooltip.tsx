'use client';

import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

/**
 * Hover and focus hint for desktop. On mobile, prefer helper text — a tooltip
 * that only opens on hover is unreachable on a touch screen, so it must never
 * carry information the user needs to complete a task.
 *
 * Ported from `design-system/components/feedback/Tooltip.jsx`, tokens untouched.
 *
 * Two behavioural fixes:
 *
 * - The hint is linked to the trigger with `aria-describedby`, so it is
 *   announced. The source renders text a screen reader never reaches, which
 *   makes it decoration for anyone not using a mouse.
 * - Escape dismisses it (WCAG 1.4.13). The tooltip already stays open while the
 *   pointer is over it, since it is a DOM descendant of the hover target.
 */
export interface TooltipProps {
  label?: ReactNode;
  children?: ReactNode;
  placement?: 'top' | 'bottom';
  style?: CSSProperties;
}

export function Tooltip({ label, children, placement = 'top', style }: TooltipProps) {
  const [on, setOn] = useState(false);
  const tipId = useId();
  const pos = placement === 'bottom' ? { top: 'calc(100% + 8px)' } : { bottom: 'calc(100% + 8px)' };

  // A single element child can carry the description itself, which is where a
  // screen reader looks for it. Anything else falls back to the wrapper.
  const described =
    isValidElement(children) && on
      ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
          'aria-describedby': tipId,
        })
      : children;

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}
      onFocus={() => setOn(true)}
      onBlur={() => setOn(false)}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Escape') setOn(false);
      }}
    >
      {described}
      {on && (
        <span
          id={tipId}
          role="tooltip"
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            ...pos,
            whiteSpace: 'nowrap',
            padding: '6px 10px',
            background: 'var(--surface-inverse)',
            color: 'var(--text-on-inverse)',
            borderRadius: 'var(--radius-xs)',
            font: 'var(--type-caption)',
            boxShadow: 'var(--shadow-md)',
            animation: 'dari-pop-in var(--dur-fast) var(--ease-out)',
            zIndex: 20,
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
