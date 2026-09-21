/**
 * The single door to the Dari API.
 *
 * Hand-ported from apps/web/src/lib/api.ts. The core contract (error
 * envelope, bearer token, base URL) is identical; the two differences are
 * native to the platform, not a design choice: there is no `window` vs.
 * Server Component split on RN (everything here runs on-device), and the
 * base URL comes from Expo's `EXPO_PUBLIC_*` env convention instead of
 * Next's `NEXT_PUBLIC_*`.
 */

import { ErrorCode } from './errors';
import type { CursorPage } from '@/types/api';

// `localhost` only reaches the host machine from the iOS simulator or the
// web target -- an Android emulator needs 10.0.2.2, and a real physical
// device needs the host's LAN IP. Set EXPO_PUBLIC_API_BASE_URL in .env
// accordingly per platform; there is no single default that works on all
// four (iOS sim / Android emulator / physical device / web).
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080/api/v1';

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
   * Serialized as JSON, unless it is a FormData — see apiFetch. FormData is
   * how photo uploads reach POST /listings/{id}/photos (from the camera or
   * photo library, via expo-image-picker's file result).
   */
  body?: unknown;
  /** Bearer token. Omitted on public reads so responses stay cacheable. */
  token?: string;
}

/**
 * Origin serving the API's static files.
 *
 * Photo URLs come back from the API as root-relative paths (/uploads/...),
 * so an <Image source={{ uri }}> needs this prefix or it resolves against
 * nothing. Derived from the same env var as BASE_URL so the two can never
 * point at different backends.
 */
export const apiOrigin = BASE_URL.replace(/\/api\/v1\/?$/, '');

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers, ...rest } = options;

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

/**
 * Multipart upload through the same API boundary. Fetch does not expose upload
 * progress in React Native, so photo flows use XHR here rather than reaching
 * around the API client in a screen.
 */
export function apiUpload<T>(
  path: string,
  file: { uri: string; name: string; type: string },
  options: { token: string; onProgress?: (progress: number) => void },
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${BASE_URL}${path}`);
    request.setRequestHeader('Authorization', `Bearer ${options.token}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    request.onerror = () => reject(new Error('NETWORK_ERROR'));
    request.onload = () => {
      let payload: unknown = null;
      try { payload = request.responseText ? JSON.parse(request.responseText) : null; } catch { payload = null; }
      if (request.status >= 200 && request.status < 300) {
        resolve(payload as T);
        return;
      }
      const error = (payload ?? {}) as Partial<ApiErrorBody>;
      reject(new ApiError(request.status, error.code ?? 'INTERNAL_ERROR', error.message ?? 'Une erreur est survenue', error.fields));
    };
    const form = new FormData();
    form.append('file', file as unknown as Blob);
    request.send(form);
  });
}

export type { CursorPage };
