package ma.dari.api.common.error;

/** Injectable boundary for a future hosted reporter; the default is deliberately no-op. */
public interface ErrorReporter {
    void report(Throwable error, SafeErrorContext context);

    record SafeErrorContext(String route, String correlationId, String releaseVersion) {
    }
}
