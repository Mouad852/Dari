package ma.dari.api.common.error;

/** Used when no error-tracking DSN is configured: the log line is the only signal. */
public class NoopErrorReporter implements ErrorReporter {
    @Override
    public void report(Throwable error, SafeErrorContext context) {
        // Logging remains the operational signal.
    }
}
