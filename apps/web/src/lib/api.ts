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

export { resolveMediaUrl } from './config';

const WEB_CONFIG = getWebConfig();
const BASE_URL = WEB_CONFIG.apiBaseUrl;

/**
 * Server renders (Server Components, metadata, sitemap, robots, ISR) all reach
 * the API from this host's one address. The server-only shared secret lets the
 * API count them against its shared SSR ceiling instead of that address's
 * per-IP quota. Browser code never has it: the variable is not NEXT_PUBLIC_, so
 * its value is never inlined, and this branch is compiled out of client chunks.
 */
function serverRenderHeaders(): Record<string, string> {
  if (typeof window !== 'undefined') return {};
  const secret = process.env.DARI_SSR_SHARED_SECRET?.trim();
  return secret ? { 'X-Dari-Ssr-Key': secret } : {};
}

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
 * A 401 the browser can recover from: the token was rejected, not the person.
 *
 * Both codes come from the auth filter or the @CurrentUser resolver, i.e.
 * before the handler runs. 403 is deliberately absent — a suspended account, a
 * non-owner or a non-admin is *authenticated*, and signing them out would
 * hide why they were refused.
 */
function isRejectedSession(cause: unknown): cause is ApiError {
  return cause instanceof ApiError
    && cause.status === 401
    && (cause.code === ErrorCode.INVALID_TOKEN || cause.code === ErrorCode.UNAUTHENTICATED);
}

/**
 * The one forced refresh per stale token.
 *
 * Every authenticated page asks for a token on mount and the nav polls its
 * badge, so an hour-old session produces several 401s within milliseconds.
 * Keyed on the token that was rejected, and kept after it settles, so all of
 * them await the same Firebase call and a request whose 401 arrives late
 * reuses the answer instead of asking again.
 *
 * Resolves to null only when there is no signed-in user. A refresh that
 * *fails* (offline, Firebase unreachable) rejects instead and is forgotten,
 * so the next 401 tries again: a network blip during a refresh is not a
 * reason to sign anyone out.
 */
let forcedRefresh: { stale: string; fresh: Promise<string | null> } | undefined;

function refreshRejectedToken(stale: string): Promise<string | null> {
  if (forcedRefresh?.stale === stale) return forcedRefresh.fresh;
  const fresh = import('./firebase').then(({ getIdToken }) => getIdToken(true));
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
    await import('./firebase').then(({ signOut }) => signOut()).catch(() => undefined);
    if (window.location.pathname === '/sign-in') {
      // Already where the visitor has to go, and no navigation will reset
      // this module: forget this sign-out so a later session can end too.
      endingSession = undefined;
      return;
    }
    const here = `${window.location.pathname}${window.location.search}`;
    // A full navigation, not a router push: every page's state was built for a
    // session that no longer exists.
    window.location.assign(`/sign-in?next=${encodeURIComponent(here)}`);
  })();
  return endingSession;
}

/**
 * Sends the request, and on a rejected session forces one token refresh and
 * replays it exactly once.
 *
 * Replaying a POST or DELETE is safe here specifically because a 401 is raised
 * before any handler work: FirebaseAuthFilter and CurrentUserArgumentResolver
 * both reject the request during authentication, and POST /users checks the
 * principal in its first statement. Nothing was executed, so nothing can
 * happen twice. If the replay is rejected too, the session is over: sign out
 * and send the visitor to /sign-in with the path they were on.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await sendRequest<T>(path, options);
  } catch (cause) {
    const stale = options.token;
    if (!stale || typeof window === 'undefined' || !isRejectedSession(cause)) throw cause;

    let fresh: string | null;
    try {
      fresh = await refreshRejectedToken(stale);
    } catch {
      // Could not reach Firebase to refresh: keep the session and surface the
      // 401, which the page shows with a retry.
      throw cause;
    }
    if (fresh && fresh !== stale) {
      try {
        return await sendRequest<T>(path, { ...options, token: fresh });
      } catch (replayed) {
        if (!isRejectedSession(replayed)) throw replayed;
      }
    }

    void endSession();
    throw cause;
  }
}

async function sendRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
        ...serverRenderHeaders(),
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
