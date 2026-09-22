package ma.dari.api.common.error;

import io.sentry.Hint;
import io.sentry.ISentryClient;
import io.sentry.SentryClient;
import io.sentry.SentryEvent;
import io.sentry.SentryLevel;
import io.sentry.SentryOptions;
import io.sentry.protocol.Contexts;
import io.sentry.protocol.OperatingSystem;
import io.sentry.protocol.SentryException;
import io.sentry.protocol.SentryRuntime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Set;

/**
 * Sends unhandled server errors to Sentry, and nothing else.
 *
 * <p>A private {@link SentryClient}, not {@code Sentry.init}: no global hub, no
 * uncaught-exception handler, no shutdown hook, no log appender, no servlet
 * filter. The only events that exist are the ones {@link #report} builds, and
 * every one passes through {@link #scrub} on the way out.
 *
 * <p>What leaves the account is an allow-list, not a deny-list: exception
 * types and stack frames (class, method, file, line), the release, the
 * environment, the matched route pattern, the HTTP method and the correlation
 * id. Exception <em>messages</em> are dropped, because they are where personal
 * data hides — a constraint violation quotes the email that collided, a parse
 * error quotes the body. The correlation id finds the full log line, which stays
 * in the account's own logs.
 *
 * <p>Never blocks the request thread on the network: capture builds the event
 * and enqueues it; a single background sender with short timeouts drains a
 * bounded queue, and events beyond it are dropped rather than waited for.
 */
public final class SentryErrorReporter implements ErrorReporter, AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(SentryErrorReporter.class);

    /** Events waiting to be sent; beyond this the SDK drops new ones. */
    static final int MAX_QUEUE_SIZE = 30;
    static final int TIMEOUT_MILLIS = 2_000;

    static final String TAG_ROUTE = "route";
    static final String TAG_METHOD = "http_method";
    static final String TAG_CORRELATION_ID = "correlation_id";
    private static final Set<String> ALLOWED_TAGS = Set.of(TAG_ROUTE, TAG_METHOD, TAG_CORRELATION_ID);

    private final ISentryClient client;

    SentryErrorReporter(ISentryClient client) {
        this.client = client;
    }

    /** @throws IllegalArgumentException when the DSN cannot be parsed */
    public static SentryErrorReporter create(String dsn, String environment, String release) {
        return new SentryErrorReporter(new SentryClient(options(dsn, environment, release)));
    }

    static SentryOptions options(String dsn, String environment, String release) {
        SentryOptions options = new SentryOptions();
        options.setDsn(dsn);
        options.setEnvironment(environment);
        options.setRelease(release);

        // Explicit rather than inherited defaults, so a future SDK default
        // cannot start sending more.
        options.setEnableExternalConfiguration(false);  // no sentry.properties, no SENTRY_* auto-read
        options.setSendDefaultPii(false);
        options.setAttachServerName(false);             // the task's hostname identifies nothing useful
        options.setAttachThreads(false);
        options.setAttachStacktrace(false);
        options.setMaxBreadcrumbs(0);
        options.setSendModules(false);
        options.setSendClientReports(false);
        options.setEnableAutoSessionTracking(false);
        options.setEnableUncaughtExceptionHandler(false);
        options.setEnableShutdownHook(false);            // Spring closes the bean
        options.setTracesSampleRate(null);               // errors only, no performance data
        options.addInAppInclude("ma.dari");

        options.setMaxQueueSize(MAX_QUEUE_SIZE);
        options.setConnectionTimeoutMillis(TIMEOUT_MILLIS);
        options.setReadTimeoutMillis(TIMEOUT_MILLIS);
        options.setFlushTimeoutMillis(TIMEOUT_MILLIS);
        options.setShutdownTimeoutMillis(TIMEOUT_MILLIS);

        options.setBeforeSend(SentryErrorReporter::scrub);
        return options;
    }

    @Override
    public void report(Throwable error, SafeErrorContext context) {
        try {
            SentryEvent event = new SentryEvent(error);
            event.setLevel(SentryLevel.ERROR);
            event.setRelease(context.releaseVersion());
            tag(event, TAG_ROUTE, context.route());
            tag(event, TAG_METHOD, context.method());
            tag(event, TAG_CORRELATION_ID, context.correlationId());
            client.captureEvent(event, (Hint) null);
        } catch (RuntimeException | LinkageError failure) {
            // The request already has its 500; reporting is best effort.
            log.warn("Error report was not queued ({})", failure.getClass().getSimpleName());
        }
    }

    private static void tag(SentryEvent event, String key, String value) {
        if (value != null && !value.isBlank()) event.setTag(key, value);
    }

    /**
     * The last step before serialization. Rebuilds the event from the fields
     * listed on the class, whatever the SDK or a future integration added.
     */
    static SentryEvent scrub(SentryEvent event, Hint hint) {
        event.setMessage(null);
        event.setRequest(null);
        event.setUser(null);
        event.setBreadcrumbs(null);
        event.setExtras(null);
        event.setThreads(null);
        event.setModules(null);
        event.setDebugMeta(null);
        event.setServerName(null);
        event.setLogger(null);
        event.setTransaction(null);
        if (event.getTags() != null) event.getTags().keySet().retainAll(ALLOWED_TAGS);
        if (event.getExceptions() != null) {
            for (SentryException exception : event.getExceptions()) exception.setValue(null);
        }
        Contexts contexts = event.getContexts();
        SentryRuntime runtime = contexts.getRuntime();
        OperatingSystem os = contexts.getOperatingSystem();
        contexts.clear();
        if (runtime != null) contexts.setRuntime(runtime);
        if (os != null) contexts.setOperatingSystem(os);
        return event;
    }

    /** Sends what is queued, waiting at most the shutdown timeout. */
    @Override
    public void close() {
        client.close();
    }
}
