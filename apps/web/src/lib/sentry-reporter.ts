import {
  BrowserClient,
  defaultStackParser,
  makeFetchTransport,
  Scope,
  type ErrorEvent,
} from '@sentry/browser';

import type { ErrorReporter, SafeErrorContext } from './reporting';

/**
 * Sentry for the browser, loaded only in a production build with a DSN, and
 * only when the first error is reported (reporting.ts imports this lazily).
 *
 * A private client on a private scope, not Sentry.init: no global handlers, no
 * breadcrumbs from console, fetch, clicks or navigation, no HTTP context, no
 * session or performance data. Integrations are deliberately empty, so the
 * only events are the ones reportError() asks for.
 *
 * Mirrors the API's reporter: what leaves the browser is an allow-list —
 * exception types and stack frames, release, environment, and the tags below.
 * Error messages are dropped (they can quote user input or a server body);
 * the correlation id and the digest find the full server log line.
 */
const ALLOWED_TAGS = ['kind', 'route', 'digest', 'correlation_id'] as const;

export function createSentryReporter(dsn: string, release: string): ErrorReporter {
  const client = new BrowserClient({
    dsn,
    release,
    environment: 'production',
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: [],
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    sendClientReports: false,
    beforeSend: scrub,
  });
  const scope = new Scope();
  scope.setClient(client);
  client.init();

  return (error: unknown, context: SafeErrorContext) => {
    scope.captureException(error, {
      captureContext: {
        tags: {
          kind: context.kind,
          route: context.route,
          digest: context.digest,
          correlation_id: context.correlationId,
        },
      },
    });
  };
}

/** Rebuilds the event from the allow-list, whatever the SDK added. */
export function scrub(event: ErrorEvent): ErrorEvent {
  const tags: Record<string, string> = {};
  for (const key of ALLOWED_TAGS) {
    const value = event.tags?.[key];
    if (typeof value === 'string' && value) tags[key] = value;
  }
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    environment: event.environment,
    sdk: event.sdk,
    tags,
    exception: {
      values: (event.exception?.values ?? []).map((exception) => ({
        type: exception.type,
        mechanism: exception.mechanism ? { type: exception.mechanism.type, handled: exception.mechanism.handled } : undefined,
        stacktrace: exception.stacktrace
          ? {
              frames: (exception.stacktrace.frames ?? []).map((frame) => ({
                filename: frame.filename?.replace(/[?#].*$/, ''),
                function: frame.function,
                lineno: frame.lineno,
                colno: frame.colno,
                in_app: frame.in_app,
              })),
            }
          : undefined,
      })),
    },
  };
}
