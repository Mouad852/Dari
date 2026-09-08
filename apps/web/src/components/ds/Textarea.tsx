'use client';

import { useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';

/**
 * Multi-line text field.
 *
 * Not a port: the design system has no textarea. Nothing under
 * `design-system/components/forms/` covers a multi-line field and no token or
 * guideline mentions one, yet the product needs two of them — a listing
 * description and the details box on a report — and both were shipping their
 * own inline copy of Input's border, radius and padding.
 *
 * So this is Input's specification extended vertically, and nothing else: same
 * label treatment, same `--radius-control`, same hairline border going
 * `--border-focus` on focus, same `--focus-ring`, same helper and error rows.
 * The only deliberate differences are the ones a fixed control height cannot
 * express — padding replaces `height`, and the box grows.
 *
 * `resize: vertical`: horizontal resize can push a grid item wider than its
 * track, which is the overflow bug this project keeps finding.
 */
export interface TextareaProps {
  label?: ReactNode;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  /** Submitted field name. Required for uncontrolled use inside a form. */
  name?: string;
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  maxLength?: number;
  error?: string;
  helper?: string;
  disabled?: boolean;
  required?: boolean;
  style?: CSSProperties;
}

export function Textarea({
  label,
  placeholder,
  value,
  defaultValue,
  name,
  onChange,
  rows = 5,
  maxLength,
  error,
  helper,
  disabled = false,
  required,
  style,
}: TextareaProps) {
  const [focused, setFocused] = useState(false);

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
      <textarea
        name={name}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        required={required}
        aria-invalid={error ? true : undefined}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: 'block',
          width: '100%',
          padding: '12px 14px',
          background: disabled ? 'var(--sable-100)' : 'var(--surface-card)',
          border: `1px solid ${error ? 'var(--danger)' : focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-control)',
          boxShadow: focused ? 'var(--focus-ring)' : 'var(--shadow-xs)',
          font: 'var(--type-body)',
          color: 'var(--text-heading)',
          outline: 'none',
          resize: 'vertical',
          transition: 'var(--transition-control)',
        }}
      />
      {(error || helper) && (
        <span
          style={{
            display: 'block',
            marginTop: 'var(--space-2)',
            font: 'var(--type-caption)',
            color: error ? 'var(--danger)' : 'var(--text-muted)',
          }}
        >
          {error || helper}
        </span>
      )}
    </label>
  );
}
