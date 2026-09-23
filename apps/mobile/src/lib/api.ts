/**
 * The single door to the Dari API.
 *
 * Hand-ported from apps/web/src/lib/api.ts. The core contract (error
 * envelope, bearer token, base URL, 15 s deadline, typed network errors with
 * the same French copy, one forced token refresh and one replay on a 401) is
 * identical; the differences are native to the platform: there is no
 * `window` vs. Server Component split on RN (everything here runs on-device),
 * the base URL comes from Expo's `EXPO_PUBLIC_*` env convention, "offline" is
 * asked of NetInfo rather than `navigator.onLine`, and uploads go through XHR
 * for their progress events.
 */

import { router } from 'expo-router';

import { API_BASE_URL } from './config';
import { ErrorCode } from './errors';
import { getIdToken, signOut } from './firebase';
import { hasNetwork } from './network';
import { reportError } from './reporting';
import type { CursorPage } from '@/types/api';

// Empty only in a release build without EXPO_PUBLIC_API_BASE_URL, which the
// root layout never gets past ("Configuration requise"), and which the
// production build gate in app.config.ts refuses to build in the first place.
// `localhost` only reaches the host machine from the iOS simulator or the web
// target -- an Android emulator needs 10.0.2.2, and a real physical device
// needs the host's LAN IP. Set EXPO_PUBLIC_API_BASE_URL in .env accordingly.
const BASE_URL = API_BASE_URL ?? '';

const DEFAULT_TIMEOUT_MS = 15_000;
/** A photo over a slow mobile connection legitimately takes longer than a JSON call. */
const UPLOAD_TIMEOUT_MS = 60_000;

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

/**
 * The sentence to show for a failed request: the server's own French on an
 * ApiError, the specific one for each network failure, the screen's fallback
 * for anything else. Same rule as the web app's ErrorNotice.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error;
  if (
    error instanceof ApiError
    || error instanceof ApiTimeoutError
    || error instanceof ApiOfflineError
    || error instanceof ApiNetworkError
    || error instanceof ApiUnexpectedResponseError
  ) {
    return error.message;
  }
  return fallback;
}

/**
 * For a screen's catch block. The client has already reported its own
 * transport failures, and an ApiError is the server's deliberate answer, so
 * only anything else — a bug — is reported from here.
 */
export function reportUnexpected(cause: unknown, kind: string): void {
  if (
    cause instanceof ApiError
    || cause instanceof ApiTimeoutError
    || cause instanceof ApiOfflineError
    || cause instanceof ApiNetworkError
    || cause instanceof ApiUnexpectedResponseError
  ) {
    return;
  }
  reportError(cause, { kind });
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
  /** Deadline for this request. Writes are never retried automatically. */
  timeoutMs?: number;
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

/**
 * A 401 the app can recover from: the token was rejected, not the person.
 * 403 is deliberately absent — a suspended account or a non-owner is
 * authenticated, and signing them out would hide why they were refused.
 */
function isRejectedSession(cause: unknown): cause is ApiError {
  return cause instanceof ApiError
    && cause.status === 401
    && (cause.code === ErrorCode.INVALID_TOKEN || cause.code === ErrorCode.UNAUTHENTICATED);
}

/**
 * The one forced refresh per stale token.
 *
 * Several screens and the tab badge ask at once, so an hour-old session
 * produces several 401s within milliseconds. Keyed on the token that was
 * rejected and kept after it settles, so all of them await the same Firebase
 * call. A refresh that fails (offline, Firebase unreachable) rejects and is
 * forgotten, so the next 401 tries again: a network blip during a refresh is
 * not a reason to sign anyone out.
 */
let forcedRefresh: { stale: string; fresh: Promise<string | null> } | undefined;

function refreshRejectedToken(stale: string): Promise<string | null> {
  if (forcedRefresh?.stale === stale) return forcedRefresh.fresh;
  const fresh = getIdToken(true);
  const entry = { stale, fresh };
  forcedRefresh = entry;
  fresh.catch(() => {
    if (forcedRefresh === entry) forcedRefresh = undefined;
  });
  return fresh;
}

/** One sign-out, however many requests discover the session is gone. */
let endingSession: Promise<void> | undefined;

function endSession(): Promise<void> {
  endingSession ??= (async () => {
    await signOut().catch(() => undefined);
    router.push('/sign-in');
  })().finally(() => {
    endingSession = undefined;
  });
  return endingSession;
}

/**
 * Sends, and on a rejected session forces one token refresh and replays
 * exactly once. Replaying a write is safe because a 401 is raised during
 * authentication, before any handler work (see the web copy). If the replay
 * is rejected too, the session is over: sign out and go to sign-in. With no
 * signed-in user at all there is nothing to end.
 */
async function withSessionRecovery<T>(token: string | undefined, send: (token: string | undefined) => Promise<T>): Promise<T> {
  try {
    return await send(token);
  } catch (cause) {
    if (!token || !isRejectedSession(cause)) throw cause;

    let fresh: string | null;
    try {
      fresh = await refreshRejectedToken(token);
    } catch {
      // Could not reach Firebase to refresh: keep the session and surface the 401.
      throw cause;
    }
    if (fresh === null) throw cause;
    if (fresh !== token) {
      try {
        return await send(fresh);
      } catch (replayed) {
        if (!isRejectedSession(replayed)) throw replayed;
      }
    }

    void endSession();
    throw cause;
  }
}

export function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return withSessionRecovery(options.token, (token) => sendRequest<T>(path, { ...options, token }));
}

async function sendRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const { body, token, headers, timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = options;
  // setTimeout + AbortController rather than AbortSignal.timeout(), which
  // Hermes does not provide.
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) forwardAbort();
    else signal.addEventListener('abort', forwardAbort);
  }

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
    // The caller's own cancellation (a newer search replaced this one).
    if (signal?.aborted) throw cause;
    throw await connectionError(cause);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', forwardAbort);
  }

  const correlationId = response.headers.get('X-Correlation-Id') ?? undefined;
  return readResponse<T>(response.status, await response.text().catch(() => ''), correlationId);
}

/** Offline and "the service could not be reached" read differently to a person, so they are told apart. */
async function connectionError(cause: unknown): Promise<Error> {
  const online = await hasNetwork().catch(() => true);
  if (!online) return new ApiOfflineError();
  const error = new ApiNetworkError(cause);
  reportError(error, { kind: 'network' });
  return error;
}

/**
 * The response envelope, shared by fetch and the upload XHR. Same rules as the
 * web client: 204 is `undefined`; any other success must carry JSON, and an
 * error must carry the API's { code, message }, or it is a response from
 * something that is not the API (a proxy's HTML page) and is reported.
 */
function readResponse<T>(status: number, text: string, correlationId?: string): T {
  const ok = status >= 200 && status < 300;
  if (status === 204) return undefined as T;

  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }

  if (!ok) {
    if (!payload || typeof payload !== 'object' || !('code' in payload) || !('message' in payload)) {
      const error = new ApiUnexpectedResponseError(status, correlationId);
      reportError(error, { kind: 'unexpected-response', correlationId });
      throw error;
    }
    const envelope = payload as Partial<ApiErrorBody>;
    throw new ApiError(
      status,
      envelope.code ?? 'INTERNAL_ERROR',
      // Server messages are already user-facing French. Never invent a friendlier
      // one on the client — the two would drift and only one is reviewed.
      envelope.message ?? 'Une erreur est survenue',
      envelope.fields,
    );
  }

  if (payload === null) {
    const error = new ApiUnexpectedResponseError(status, correlationId);
    reportError(error, { kind: 'unexpected-response', correlationId });
    throw error;
  }
  return payload as T;
}

/**
 * Multipart upload through the same API boundary. Fetch does not expose upload
 * progress in React Native, so photo flows use XHR here rather than reaching
 * around the API client in a screen. Same deadline, error types and session
 * recovery as apiFetch; the file is sent again on the one replay.
 */
export function apiUpload<T>(
  path: string,
  file: { uri: string; name: string; type: string },
  options: { token: string; onProgress?: (progress: number) => void },
): Promise<T> {
  return withSessionRecovery(options.token, (token) => sendUpload<T>(path, file, token, options.onProgress));
}

function sendUpload<T>(path: string, file: { uri: string; name: string; type: string }, token: string | undefined, onProgress?: (progress: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${BASE_URL}${path}`);
    request.timeout = UPLOAD_TIMEOUT_MS;
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    request.ontimeout = () => {
      const error = new ApiTimeoutError(UPLOAD_TIMEOUT_MS);
      reportError(error, { kind: 'timeout' });
      reject(error);
    };
    request.onerror = () => { void connectionError(undefined).then(reject); };
    request.onload = () => {
      try {
        resolve(readResponse<T>(request.status, request.responseText ?? '', request.getResponseHeader('X-Correlation-Id') ?? undefined));
      } catch (error) {
        reject(error);
      }
    };
    const form = new FormData();
    form.append('file', file as unknown as Blob);
    request.send(form);
  });
}

export type { CursorPage };
