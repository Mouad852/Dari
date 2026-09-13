'use client';

import { useId, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';

import { useFocusRing } from './useFocusRing';

/**
 * Instant-apply toggle — settings and filter refinements, never a form that
 * ends in a Save button.
 *
 * Ported from `design-system/components/forms/Switch.jsx`, tokens untouched:
 * 48x28 track, 22px knob, terracotta when on, the inset warm shadow.
 *
 * Same fixes as {@link Checkbox}: a visible keyboard focus ring, and the hidden
 * input anchored to its own row. `prefers-reduced-motion` is already handled
 * globally in `tokens/base.css`, so the knob's slide stops with everything else.
 */
export interface SwitchProps {
  label?: ReactNode;
  description?: string;
  checked?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  style?: CSSProperties;
}

export function Switch({
  label,
  description,
  checked = false,
  onChange,
  disabled = false,
  style,
}: SwitchProps) {
  const { focusVisible, focusProps } = useFocusRing();
  const descriptionId = useId();

  return (
    <label
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-5)',
        minHeight: 'var(--tap-min)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      <span>
        <span style={{ display: 'block', font: 'var(--type-body)', color: 'var(--text-heading)' }}>
          {label}
        </span>
        {description && (
          // aria-hidden so this text is excluded from the wrapping <label>'s
          // implicit accessible-name computation (it would otherwise fold
          // straight into the name, ahead of aria-describedby below) --
          // aria-describedby still reads it as a description even though the
          // element itself is hidden from normal accessible-tree traversal.
          // Without this, a screen reader announces the description twice:
          // once merged into the name, once again via aria-describedby.
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
      <input
        type="checkbox"
        role="switch"
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
          flex: '0 0 auto',
          position: 'relative',
          width: 48,
          height: 28,
          borderRadius: 'var(--radius-pill)',
          background: checked ? 'var(--brand)' : 'var(--sable-300)',
          boxShadow: focusVisible
            ? 'var(--focus-ring)'
            : 'inset 0 1px 2px rgba(58,42,32,.12)',
          transition: 'background-color var(--dur-med) var(--ease-standard)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
            width: 22,
            height: 22,
            borderRadius: 'var(--radius-pill)',
            background: '#fff',
            boxShadow: 'var(--shadow-sm)',
            transition: 'left var(--dur-med) var(--ease-out)',
          }}
        />
      </span>
    </label>
  );
}
