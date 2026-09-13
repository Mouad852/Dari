'use client';

import { useId, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';

import { useFocusRing } from './useFocusRing';

/**
 * Single-choice control. Always give the group a heading above it — a set of
 * radios with no legend reads as unrelated options.
 *
 * Ported from `design-system/components/forms/Radio.jsx`, tokens untouched.
 * Same two behavioural fixes as {@link Checkbox}: a visible keyboard focus ring,
 * and the hidden input anchored to its own row.
 */
export interface RadioProps {
  label?: ReactNode;
  description?: string;
  checked?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Shared across the group — this is what makes them mutually exclusive. */
  name?: string;
  value?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

export function Radio({
  label,
  description,
  checked = false,
  onChange,
  name,
  value,
  disabled = false,
  style,
}: RadioProps) {
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
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
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
          borderRadius: 'var(--radius-pill)',
          background: 'var(--surface-card)',
          border: `1px solid ${checked || focusVisible ? 'var(--brand)' : 'var(--border-default)'}`,
          boxShadow: focusVisible ? 'var(--focus-ring)' : 'var(--shadow-xs)',
          transition: 'var(--transition-control)',
        }}
      >
        {checked && (
          <span style={{ width: 11, height: 11, borderRadius: 'var(--radius-pill)', background: 'var(--brand)' }} />
        )}
      </span>
      <span>
        <span style={{ display: 'block', font: 'var(--type-body)', color: 'var(--text-heading)' }}>
          {label}
        </span>
        {description && (
          // aria-hidden + aria-describedby (on the input above), same
          // reasoning as Switch/Checkbox: without it, this text would fold
          // straight into the wrapping <label>'s accessible name and then be
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
