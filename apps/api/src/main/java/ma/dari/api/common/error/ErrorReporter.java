package ma.dari.api.common.error;

/**
 * Where an unhandled server error goes besides the log. Implementations must
 * never throw and never block the calling request thread.
 *
 * <p>The context holds only values that are safe to leave the account: the
 * matched route pattern (never the concrete path or query string), the HTTP
 * method, the correlation id that finds the full log line, and the release.
 */
public interface ErrorReporter {
    void report(Throwable error, SafeErrorContext context);

    record SafeErrorContext(String route, String method, String correlationId, String releaseVersion) {
    }
}
