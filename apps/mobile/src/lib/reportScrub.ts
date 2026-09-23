import type { ErrorEvent } from '@sentry/react-native';

/**
 * What an error report may carry, and nothing else.
 *
 * Ported from apps/web/src/lib/sentry-reporter.ts: a JavaScript event is
 * rebuilt from an allow-list rather than cleaned field by field, so whatever
 * the SDK adds to it (user, request and its headers, breadcrumbs, extra data,
 * device contexts) never leaves the phone. Events raised by the native SDKs
 * themselves — native crashes, ANRs and app hangs — do not pass through this
 * function; they carry device details and no scrubbing (see
 * docs/MOBILE_RELEASE.md). Exception messages are dropped
 * too: they can quote a server body, an email address or a message someone
 * wrote. What remains is the exception type, its stack frames, the release
 * and these tags. The one addition over the web is the OS name and version,
 * which a native crash needs to be read at all and which identify no one.
 */
export const ALLOWED_TAGS = ['kind', 'route', 'correlation_id'] as const;

export function scrub(event: ErrorEvent): ErrorEvent {
  const tags: Record<string, string> = {};
  for (const key of ALLOWED_TAGS) {
    const value = event.tags?.[key];
    if (typeof value === 'string' && value) tags[key] = value;
  }
  const os = event.contexts?.os;
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    dist: event.dist,
    environment: event.environment,
    sdk: event.sdk,
    tags,
    contexts: os ? { os: { name: os.name, version: os.version } } : undefined,
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
