import * as Sentry from '@sentry/react-native';

import { scrub } from './reportScrub';

/**
 * Crash and error reporting, only when EXPO_PUBLIC_SENTRY_DSN is set.
 *
 * Without a DSN nothing is initialised and reportError() does nothing: no
 * native SDK start, no request. With one, Sentry catches unhandled errors and
 * native crashes, and reportError() sends the handled failures worth knowing
 * about (a render error, a timeout, a request that failed). Every JavaScript
 * event goes through scrub() first; breadcrumbs, sessions and performance
 * data are off, as on the web.
 *
 * In Expo Go there is no native Sentry module: the SDK falls back to
 * JavaScript-only capture, so the app still runs there.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
const RELEASE = process.env.EXPO_PUBLIC_RELEASE_VERSION?.trim() || 'development';

export type SafeErrorContext = { kind?: string; route?: string; correlationId?: string };

let started = false;

export function startErrorReporting(): void {
  if (started || !DSN) return;
  started = true;
  Sentry.init({
    dsn: DSN,
    release: RELEASE,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    enableAutoSessionTracking: false,
    beforeSend: scrub,
  });
}

export function reportError(error: unknown, context: SafeErrorContext = {}): void {
  if (!started) return;
  Sentry.captureException(error, {
    tags: { kind: context.kind, route: context.route, correlation_id: context.correlationId },
  });
}
