'use client';

import type { ChangeEvent, CSSProperties, ReactNode } from 'react';

import { Icon } from './Icon';

/**
 * Native select styled to match Input.
 *
 * Ported from `design-system/components/forms/Select.jsx`, tokens untouched.
 * Native rather than a custom listbox on purpose: the platform control is
 * keyboard-accessible, screen-reader correct and renders as the OS picker on a
 * phone, which is the right affordance for a mobile-first product.
 *
 * Works controlled or uncontrolled — see the note on Input.
 */

export type SelectOption = string | { value: string; label: string };

export interface SelectProps {
  label?: ReactNode;
  options?: SelectOption[];
  value?: string;
  defaultValue?: string;
  /** Submitted field name. Required for uncontrolled use inside a form. */
  name?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  /** Rendered as the empty-value first option. */
  placeholder?: string;
  helper?: string;
  disabled?: boolean;
  required?: boolean;
  style?: CSSProperties;
}

export function Select({
  label,
  options = [],
  value,
  defaultValue,
  name,
  onChange,
  placeholder = 'Choisir…',
  helper,
  disabled = false,
  required,
  style,
}: SelectProps) {
  return (
    <label style={{ display: 'block', ...style }}>
      {label && (
        <span
          style={{
            display: 'block',
            font: 'var(--type-label)',
            color: 'var(--text-heading)',
            marginBottom: 'var(--space-2)',
          }}
        >
          {label}
        </span>
      )}
      <span style={{ position: 'relative', display: 'block' }}>
        <select
          name={name}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          disabled={disabled}
          required={required}
          style={{
            appearance: 'none',
            width: '100%',
            height: 'var(--control-h-md)',
            padding: '0 40px 0 14px',
            background: disabled ? 'var(--sable-100)' : 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-control)',
            boxShadow: 'var(--shadow-xs)',
            font: 'var(--type-body)',
            // The source greys the control whenever `value` is falsy, to dim the
            // placeholder. Uncontrolled selects have no `value`, so that would
            // grey a real selection too -- and it grey it with --text-subtle,
            // one of the tokens that fails WCAG AA. Always the heading colour.
            color: 'var(--text-heading)',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => {
            const v = typeof option === 'string' ? option : option.value;
            const l = typeof option === 'string' ? option : option.label;
            return (
              <option key={v} value={v}>
                {l}
              </option>
            );
          })}
        </select>
        <Icon
          name="chevron-down"
          size={18}
          color="var(--text-muted)"
          style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        />
      </span>
      {helper && (
        <span
          style={{
            display: 'block',
            marginTop: 'var(--space-2)',
            font: 'var(--type-caption)',
            color: 'var(--text-muted)',
          }}
        >
          {helper}
        </span>
      )}
    </label>
  );
}
