/**
 * The single door to the Dari API.
 *
 * Nothing else in the app calls fetch against the backend. That keeps three
 * things in one place: the error envelope, the bearer token, and the base URL,
 * which differs between the browser and a Server Component.
 */

import { ErrorCode } from './errors';

const BASE_URL =
  typeof window === 'undefined'
    ? process.env.API_BASE_URL ?? 'http://localhost:8080/api/v1'
    : process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1';

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

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /**
   * Serialized as JSON, unless it is a FormData — see apiFetch. FormData is how
   * photo uploads reach POST /listings/{id}/photos.
   */
  body?: unknown;
  /** Bearer token. Omitted on public reads so responses stay cacheable. */
  token?: string;
}

/**
 * Origin serving the API's static files.
 *
 * Photo URLs come back from the API as root-relative paths (/uploads/...), and
 * the API is on a different origin than the web app, so a bare src would resolve
 * against the Next server and 404. Derived from the same env var as BASE_URL so
 * the two can never point at different backends.
 */
export const apiOrigin = BASE_URL.replace(/\/api\/v1\/?$/, '');

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers, ...rest } = options;

  // A FormData body must be handed to fetch untouched and WITHOUT a Content-Type
  // header: the browser has to set it itself so it can include the multipart
  // boundary. Setting it here, or stringifying the body, breaks the upload in a
  // way the server reports only as a generic parse failure.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
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

  return payload as T;
}

/** A page of results. Mirrors CursorPage on the server; there is no total count. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
