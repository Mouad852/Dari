'use client';

import type { ReactNode } from 'react';

import {
  ApiError,
  ApiNetworkError,
  ApiOfflineError,
  ApiTimeoutError,
  ApiUnexpectedResponseError,
} from '@/lib/api';
import { Button } from '@/components/ds/Button';
import { Card } from '@/components/ds/Card';
import { fieldLabel } from '@/lib/labels';

/**
 * The sentence to show for a failed request.
 *
 * apiFetch already throws user-facing French: the server's own message on
 * ApiError, and a specific one on each network class — "Aucune connexion
 * réseau détectée" when the browser is offline, "La requête a dépassé son
 * délai" on the 15 s deadline, "La connexion au service a échoué" otherwise.
 * Every page used to match ApiError alone and replace the rest with its own
 * generic line, so an offline visitor was told "Impossible de charger vos
 * conversations." and never which of the two problems they actually had.
 *
 * A plain string passes through: pages use one for their own cases, such as
 * "Connectez-vous pour voir vos conversations."
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error;
  if (
    error instanceof ApiOfflineError
    || error instanceof ApiTimeoutError
    || error instanceof ApiNetworkError
    || error instanceof ApiUnexpectedResponseError
    || error instanceof ApiError
  ) {
    return error.message;
  }
  return fallback;
}

/**
 * The per-field messages of a validation failure (a 400's `fields`), keyed as
 * the API sent them -- for a form to show each one next to its input. Empty
 * for any other failure.
 */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError && error.fields ? error.fields : {};
}

export interface ErrorNoticeProps {
  error: unknown;
  /** Shown only for a failure with no French of its own. */
  fallback: string;
  /** Omit when nothing can be retried, e.g. a signed-out page. */
  onRetry?: () => void;
  /** A further way out, such as "Se connecter". */
  children?: ReactNode;
}

export function ErrorNotice({ error, fallback, onRetry, children }: ErrorNoticeProps) {
  const fields = Object.entries(fieldErrors(error));
  return (
    <Card padding="var(--card-pad-lg)" style={{ display: 'grid', gap: 'var(--space-4)', justifyItems: 'start' }}>
      {/*
        role="alert" on an element that only mounts on failure: the message is
        announced when it appears, without a live region sitting on the page.
        The per-field list is inside it, so "Données invalides" is never
        announced without the reasons (audit P1-4).
      */}
      <div role="alert" style={{ display: 'grid', gap: 'var(--space-2)' }}>
        <p style={{ margin: 0, color: 'var(--text-body)', font: 'var(--type-body)' }}>
          {errorMessage(error, fallback)}
        </p>
        {fields.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: 'var(--space-1)', color: 'var(--text-body)', font: 'var(--type-body-sm)' }}>
            {fields.map(([key, message]) => (
              <li key={key}>{fieldLabel(key)} : {message}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>Réessayer</Button>
      ) : null}
      {children}
    </Card>
  );
}
