'use client';

import { useRef, type CSSProperties, type KeyboardEvent } from 'react';

/**
 * Section switcher — underline at page level, segmented inside cards and sheets.
 *
 * Ported from `design-system/components/navigation/Tabs.jsx`, tokens untouched.
 *
 * The source announces `role="tablist"` and `role="tab"` but implements none of
 * the keyboard behaviour those roles promise: a screen reader tells the user
 * arrow keys move between tabs, and nothing happens. Two fixes:
 *
 * - Arrow keys move between tabs, Home and End jump to the ends, and only the
 *   active tab is in the tab order (the roving tabindex the pattern expects).
 * - `type="button"`, so a tab bar inside a form does not submit it.
 *
 * `panelId` is optional and wires `aria-controls`. Pass it when the tabs drive a
 * panel in the same document; the count badge is announced as part of the tab.
 */
export interface TabItem {
  value: string;
  label: string;
  /** Trailing count, e.g. unread messages. */
  count?: number;
}

export interface TabsProps {
  /** Strings, or `{ value, label, count }`. */
  tabs?: Array<string | TabItem>;
  value?: string;
  onChange?: (value: string) => void;
  variant?: 'underline' | 'segmented';
  /** id of the panel these tabs control, for `aria-controls`. */
  panelId?: string;
  /** Accessible name for the tab bar itself, e.g. "Sections du profil". */
  label?: string;
  style?: CSSProperties;
}

export function Tabs({
  tabs = [],
  value,
  onChange,
  variant = 'underline',
  panelId,
  label,
  style,
}: TabsProps) {
  const items: TabItem[] = tabs.map((tab) => (typeof tab === 'string' ? { value: tab, label: tab } : tab));
  const active = value ?? items[0]?.value;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = items.findIndex((item) => item.value === active);
    if (current < 0) return;

    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;

    const target = items[next];
    if (!target) return;

    event.preventDefault();
    onChange?.(target.value);
    refs.current[next]?.focus();
  };

  const shared = (item: TabItem, index: number) => ({
    ref: (node: HTMLButtonElement | null) => {
      refs.current[index] = node;
    },
    type: 'button' as const,
    role: 'tab',
    'aria-selected': item.value === active,
    'aria-controls': panelId,
    tabIndex: item.value === active ? 0 : -1,
    onClick: () => onChange?.(item.value),
  });

  if (variant === 'segmented') {
    return (
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        style={{
          display: 'inline-flex',
          gap: 4,
          padding: 4,
          background: 'var(--bg-inset)',
          borderRadius: 'var(--radius-pill)',
          ...style,
        }}
      >
        {items.map((item, index) => {
          const on = item.value === active;
          return (
            <button
              key={item.value}
              {...shared(item, index)}
              style={{
                height: 36,
                padding: '0 16px',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                background: on ? 'var(--surface-card)' : 'transparent',
                boxShadow: on ? 'var(--shadow-xs)' : 'none',
                color: on ? 'var(--text-heading)' : 'var(--text-muted)',
                font: 'var(--weight-semibold) var(--text-body-sm)/1 var(--font-ui)',
                cursor: 'pointer',
                // The pill is a fixed 36px tall, so a label that wraps overflows
                // it. Labels stay on one line and the row scrolls instead.
                whiteSpace: 'nowrap',
                transition: 'var(--transition-control)',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{
        display: 'flex',
        gap: 'var(--space-7)',
        borderBottom: '1px solid var(--border-hairline)',
        ...style,
      }}
    >
      {items.map((item, index) => {
        const on = item.value === active;
        return (
          <button
            key={item.value}
            {...shared(item, index)}
            style={{
              position: 'relative',
              padding: '0 0 12px',
              border: 'none',
              background: 'transparent',
              color: on ? 'var(--text-heading)' : 'var(--text-muted)',
              font: 'var(--weight-semibold) var(--text-body-md)/1.2 var(--font-ui)',
              cursor: 'pointer',
              boxShadow: on ? 'inset 0 -2px 0 var(--brand)' : 'none',
              transition: 'var(--transition-control)',
            }}
          >
            {item.label}
            {item.count != null && (
              <span style={{ marginLeft: 6, font: 'var(--type-caption)', color: 'var(--text-subtle)' }}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
