'use client';

import { useId, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';

import { Icon } from './Icon';
import { useFocusRing } from './useFocusRing';

/**
 * Square 22px checkbox with a terracotta fill when checked.
 *
 * Ported from `design-system/components/forms/Checkbox.jsx`, tokens untouched.
 * The whole row is a `--tap-min` target, which is what makes it usable in the
 * mobile filter sheet.
 *
 * Two behavioural fixes over the source, both defects rather than preferences:
 *
 * - A visible ring on keyboard focus. The source hides the native input, and
 *   the browser's own ring with it. See {@link useFocusRing}.
 * - The hidden input is anchored to the row (`position: relative` on the
 *   label). Absolutely positioned with no positioned ancestor, it escapes to
 *   whatever container happens to be positioned — and browsers scroll to a
 *   focused element wherever it landed.
 */
export interface CheckboxProps {
  label?: ReactNode;
  checked?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Second line under the label. */
  description?: string;
  /** Submitted field name, for uncontrolled use inside a form. */
  name?: string;
  value?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

export function Checkbox({
  label,
  checked = false,
  onChange,
  description,
  name,
  value,
  disabled = false,
  style,
}: CheckboxProps) {
  const { focusVisible, focusProps } = useFocusRing();
  const descriptionId = useId();

  return (
    <label
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: description ? 'flex-start' : 'center',
        gap: 'var(--space-4)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        minHeight: 'var(--tap-min)',
        ...style,
      }}
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        // Without this React warns on a `checked` prop with no handler — which
        // is exactly how the source's read-only examples are written.
        readOnly={!onChange}
        disabled={disabled}
        aria-describedby={description ? descriptionId : undefined}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        {...focusProps}
      />
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
          width: 22,
          height: 22,
          marginTop: description ? 2 : 0,
          borderRadius: 'var(--radius-xs)',
          background: checked ? 'var(--brand)' : 'var(--surface-card)',
          border: `1px solid ${checked || focusVisible ? 'var(--brand)' : 'var(--border-default)'}`,
          boxShadow: focusVisible ? 'var(--focus-ring)' : 'var(--shadow-xs)',
          transition: 'var(--transition-control)',
        }}
      >
        {checked && <Icon name="check" size={15} color="#fff" />}
      </span>
      <span>
        <span style={{ display: 'block', font: 'var(--type-body)', color: 'var(--text-heading)' }}>
          {label}
        </span>
        {description && (
          // aria-hidden + aria-describedby (on the input above), same
          // reasoning as Switch: without it, this text would fold straight
          // into the wrapping <label>'s accessible name and then be
          // announced a second time via aria-describedby.
          <span
            id={descriptionId}
            aria-hidden="true"
            style={{
              display: 'block',
              font: 'var(--type-caption)',
              color: 'var(--text-muted)',
              marginTop: 2,
            }}
          >
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
