import { publicOrigins } from './public-origins.mjs';

export type SafeErrorContext = {
  route?: string;
  digest?: string;
  correlationId?: string;
  releaseVersion?: string;
  kind?: string;
};

export type ErrorReporter = (error: unknown, context: SafeErrorContext) => void;

let reporter: ErrorReporter | undefined;

export function configureErrorReporter(nextReporter: ErrorReporter): void {
  reporter = nextReporter;
}

/**
 * Error tracking, only in a production build, only in the browser, and only
 * when NEXT_PUBLIC_SENTRY_DSN is set; anywhere else reporting is a no-op. The
 * DSN comes from publicOrigins(), the call next.config.mjs builds the CSP's
 * connect-src from, so the endpoint the browser sends to is always allowed.
 * The SDK is fetched on the first report, so pages that never fail never
 * download it. A report that cannot be delivered is dropped silently.
 */
function defaultReporter(): ErrorReporter {
  if (process.env.NODE_ENV !== 'production' || typeof window === 'undefined') return () => undefined;
  let endpoint: { dsn: string } | null;
  try {
    endpoint = publicOrigins().errorReporting;
  } catch {
    // The build gate already refused bad configuration; never fail an error page over it.
    return () => undefined;
  }
  if (!endpoint) return () => undefined;
  const { dsn } = endpoint;

  let sentry: Promise<ErrorReporter> | undefined;
  return (error, context) => {
    sentry ??= import('./sentry-reporter').then(({ createSentryReporter }) =>
      createSentryReporter(dsn, context.releaseVersion ?? 'development'));
    sentry.then((send) => send(error, context)).catch(() => undefined);
  };
}

/**
 * The path with its identifiers replaced, so a report says which kind of page
 * failed without naming the listing, profile or conversation.
 * `/profile/3f1c…` becomes `/profile/[id]`; `/flatshare/rabat` stays.
 */
export function routePattern(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
      || /^\d+$/.test(segment)
      || /^[A-Za-z0-9_-]{20,}$/.test(segment)
        ? '[id]'
        : segment)
    .join('/');
}

export function reportError(error: unknown, context: SafeErrorContext = {}): void {
  reporter ??= defaultReporter();
  const path = context.route ?? (typeof window !== 'undefined' ? window.location.pathname : undefined);
  reporter(error, {
    ...context,
    route: path === undefined ? undefined : routePattern(path),
    releaseVersion: context.releaseVersion ?? process.env.NEXT_PUBLIC_RELEASE_VERSION ?? 'development',
  });
}
