package ma.dari.api.common.error;

import org.springframework.stereotype.Component;

/** No external reporting provider is configured without owner credentials and approval. */
@Component
public class NoopErrorReporter implements ErrorReporter {
    @Override
    public void report(Throwable error, SafeErrorContext context) {
        // Logging remains the operational signal until the owner selects a provider.
    }
}
