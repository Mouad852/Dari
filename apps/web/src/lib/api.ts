/**
 * The single door to the Dari API.
 *
 * Nothing else in the app calls fetch against the backend. That keeps three
 * things in one place: the error envelope, the bearer token, and the base URL,
 * which differs between the browser and a Server Component.
 */

import { ErrorCode } from './errors';
import { getWebConfig } from './config';
import { reportError } from './reporting';

const WEB_CONFIG = getWebConfig();
const BASE_URL = WEB_CONFIG.apiBaseUrl;

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The client's cue to create the profile, not a failure to show the user. */
  get isMissingProfile(): boolean {
    return this.code === ErrorCode.PROFILE_NOT_FOUND;
  }
}

export class ApiTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super('La requête a dépassé son délai');
    this.name = 'ApiTimeoutError';
  }
}

export class ApiOfflineError extends Error {
  constructor() {
    super('Aucune connexion réseau détectée');
    this.name = 'ApiOfflineError';
  }
}

export class ApiNetworkError extends Error {
  constructor(cause?: unknown) {
    super('La connexion au service a échoué', { cause });
    this.name = 'ApiNetworkError';
  }
}

export class ApiUnexpectedResponseError extends Error {
  constructor(readonly status: number, readonly correlationId?: string) {
    super('Réponse inattendue du service');
    this.name = 'ApiUnexpectedResponseError';
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /**
   * Serialized as JSON, unless it is a FormData — see apiFetch. FormData is how
   * photo uploads reach POST /listings/{id}/photos.
   */
  body?: unknown;
  /** Bearer token. Omitted on public reads so responses stay cacheable. */
  token?: string;
  /** Deadline for this request. Writes are never retried automatically. */
  timeoutMs?: number;
}

/**
 * Origin serving the API's static files.
 *
 * Photo URLs come back from the API as root-relative paths (/uploads/...), and
 * the API is on a different origin than the web app, so a bare src would resolve
 * against the Next server and 404. Derived from the same env var as BASE_URL so
 * the two can never point at different backends.
 */
export const apiOrigin = WEB_CONFIG.apiOrigin;

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers, timeoutMs = 15000, signal, ...rest } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) forwardAbort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }

  // A FormData body must be handed to fetch untouched and WITHOUT a Content-Type
  // header: the browser has to set it itself so it can include the multipart
  // boundary. Setting it here, or stringifying the body, breaks the upload in a
  // way the server reports only as a generic parse failure.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    });
  } catch (cause) {
    if (timedOut) {
      const error = new ApiTimeoutError(timeoutMs);
      reportError(error, { kind: 'timeout' });
      throw error;
    }
    if (signal?.aborted) throw cause;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const error = offline ? new ApiOfflineError() : new ApiNetworkError(cause);
    reportError(error, { kind: offline ? 'offline' : 'network' });
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', forwardAbort);
  }

  if (response.status === 204) return undefined as T;

  const correlationId = response.headers.get('X-Correlation-Id') ?? undefined;
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (!payload || typeof payload !== 'object' || !('code' in payload) || !('message' in payload)) {
      const error = new ApiUnexpectedResponseError(response.status, correlationId);
      reportError(error, { kind: 'unexpected-response', correlationId });
      throw error;
    }
    const error = (payload ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(
      response.status,
      error.code ?? 'INTERNAL_ERROR',
      // Server messages are already user-facing French. Never invent a friendlier
      // one on the client — the two would drift and only one is reviewed.
      error.message ?? 'Une erreur est survenue',
      error.fields,
    );
  }

  if (payload === null && response.status !== 204) {
    const error = new ApiUnexpectedResponseError(response.status, correlationId);
    reportError(error, { kind: 'unexpected-response', correlationId });
    throw error;
  }

  return payload as T;
}

/** A page of results. Mirrors CursorPage on the server; there is no total count. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
