'use client';

import { useId, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';

import { Icon } from './Icon';

/**
 * Text field with a warm surface, optional leading icon, label and helper text.
 *
 * Ported from `design-system/components/forms/Input.jsx`, tokens untouched.
 *
 * Works controlled (`value` + `onChange`) or uncontrolled (`name` +
 * `defaultValue`). The uncontrolled form matters: the homepage hero is a plain
 * GET form, so its fields are read by the browser from their `name` attributes
 * and never touch React state.
 */
export interface InputProps {
  label?: ReactNode;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  /** Submitted field name. Required for uncontrolled use inside a form. */
  name?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'date';
  /** Lucide slug shown inside the field, before the text. */
  iconLeft?: string;
  /** Trailing unit, e.g. "MAD". */
  suffix?: ReactNode;
  error?: string;
  helper?: string;
  disabled?: boolean;
  required?: boolean;
  size?: 'sm' | 'md' | 'lg';
  min?: number;
  max?: number;
  step?: number;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'search';
  autoComplete?: string;
  style?: CSSProperties;
}

export function Input({
  label,
  placeholder,
  value,
  defaultValue,
  name,
  onChange,
  type = 'text',
  iconLeft,
  suffix,
  error,
  helper,
  disabled = false,
  required,
  size = 'md',
  style,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const helperId = useId();
  const h =
    size === 'lg' ? 'var(--control-h-lg)' : size === 'sm' ? 'var(--control-h-sm)' : 'var(--control-h-md)';

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
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          height: h,
          padding: '0 14px',
          background: disabled ? 'var(--sable-100)' : 'var(--surface-card)',
          border: `1px solid ${error ? 'var(--danger)' : focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-control)',
          boxShadow: focused ? 'var(--focus-ring)' : 'var(--shadow-xs)',
          transition: 'var(--transition-control)',
        }}
      >
        {iconLeft && <Icon name={iconLeft} size={18} color="var(--text-subtle)" />}
        <input
          type={type}
          name={name}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? helperId : undefined}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            font: 'var(--type-body)',
            color: 'var(--text-heading)',
          }}
          {...rest}
        />
        {suffix && <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{suffix}</span>}
      </span>
      {(error || helper) && (
        <span
          id={helperId}
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
