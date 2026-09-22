package ma.dari.api.media;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import ma.dari.api.common.error.ApiException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * Timeouts and the single retry, against a local HTTP server that stalls,
 * fails or rejects on demand. Real S3 cannot be made to misbehave on cue.
 */
class S3ImageStoreResilienceTest {

    private final List<Received> received = new CopyOnWriteArrayList<>();
    private final CountDownLatch release = new CountDownLatch(1);
    private final ExecutorService handlers = Executors.newCachedThreadPool();
    private HttpServer server;

    record Received(String method, String host, String amzDate, String authorization, String cacheControl) {
    }

    interface Responder {
        int status(int attempt) throws Exception;
    }

    @AfterEach
    void stopServer() {
        release.countDown();
        if (server != null) server.stop(0);
        handlers.shutdownNow();
    }

    @Test
    void aStalledServerFailsWithinTheTimeoutInsteadOfHanging() {
        start(attempt -> {
            release.await(30, TimeUnit.SECONDS);   // far longer than any bound below
            return 200;
        });
        S3ImageStore store = store(Duration.ofMillis(400), Clock.systemUTC());

        long started = System.nanoTime();
        ApiException upload = catchThrowableOfType(ApiException.class,
                () -> store.store(ImageStore.LISTINGS, UUID.randomUUID(), S3ImageStoreMinioTest.photo()));
        Duration elapsed = Duration.ofNanos(System.nanoTime() - started);

        assertThat(upload.status()).isEqualTo(503);
        assertThat(upload.getCause()).hasMessageContaining("HttpTimeoutException");
        // Two 400 ms attempts plus the 200 ms backoff: about a second, with
        // margin either side, and nowhere near the 30 s the server would stall.
        assertThat(elapsed).isBetween(Duration.ofMillis(800), Duration.ofSeconds(5));
        assertThat(received).hasSize(2);

        received.clear();
        started = System.nanoTime();
        ApiException deletion = catchThrowableOfType(ApiException.class, () -> store.delete("listings/a/b.jpg"));
        assertThat(deletion.status()).isEqualTo(503);
        assertThat(Duration.ofNanos(System.nanoTime() - started)).isLessThan(Duration.ofSeconds(5));
        assertThat(received).hasSize(2);
    }

    @Test
    void oneRetryAfterA5xxIsSignedAfresh() throws Exception {
        start(attempt -> attempt == 1 ? 500 : 200);
        S3ImageStore store = store(Duration.ofSeconds(5), tickingClock());

        ImageStore.StoredImage stored = store.store(ImageStore.LISTINGS, UUID.randomUUID(), S3ImageStoreMinioTest.photo());

        assertThat(stored.storageKey()).startsWith(ImageStore.LISTINGS + "/");
        assertThat(received).hasSize(2);
        Received first = received.get(0);
        Received retry = received.get(1);
        assertThat(retry.method()).isEqualTo("PUT");
        assertThat(retry.amzDate()).isNotEqualTo(first.amzDate());
        assertThat(retry.authorization()).isNotEqualTo(first.authorization());
        assertThat(retry.cacheControl()).isEqualTo("public, max-age=3600");
        // Never set by hand (8491a6e): the client derives it from the URI,
        // which is the authority the signature covers.
        assertThat(retry.host()).isEqualTo("127.0.0.1:" + server.getAddress().getPort());
    }

    @Test
    void aClientErrorIsNotRetried() {
        start(attempt -> 403);
        S3ImageStore store = store(Duration.ofSeconds(5), Clock.systemUTC());

        ApiException upload = catchThrowableOfType(ApiException.class,
                () -> store.store(ImageStore.LISTINGS, UUID.randomUUID(), S3ImageStoreMinioTest.photo()));

        assertThat(upload.status()).isEqualTo(503);
        assertThat(upload.getCause()).hasMessage("S3 PUT failed: HTTP 403");
        assertThat(received).hasSize(1);
    }

    @Test
    void aRedirectIsAFailureNotASilentSuccess() {
        // S3 answers a wrong-region endpoint with 301 PermanentRedirect, which
        // the client does not follow. It used to count as a stored photo.
        start(attempt -> 301);
        S3ImageStore store = store(Duration.ofSeconds(5), Clock.systemUTC());

        ApiException upload = catchThrowableOfType(ApiException.class,
                () -> store.store(ImageStore.LISTINGS, UUID.randomUUID(), S3ImageStoreMinioTest.photo()));

        assertThat(upload.getCause()).hasMessage("S3 PUT failed: HTTP 301");
        assertThat(received).hasSize(1);
    }

    @Test
    void aSecondServerErrorGivesUp() {
        start(attempt -> 503);
        S3ImageStore store = store(Duration.ofSeconds(5), Clock.systemUTC());

        ApiException deletion = catchThrowableOfType(ApiException.class, () -> store.delete("listings/a/b.jpg"));

        assertThat(deletion.status()).isEqualTo(503);
        assertThat(deletion.getCause()).hasMessage("S3 DELETE failed: HTTP 503");
        assertThat(received).hasSize(2);
    }

    @Test
    void deletingAnAbsentKeySucceedsAndCarriesNoCacheControl() {
        start(attempt -> 404);
        S3ImageStore store = store(Duration.ofSeconds(5), Clock.systemUTC());

        store.delete("listings/a/b.jpg");

        assertThat(received).singleElement().satisfies(request -> {
            assertThat(request.method()).isEqualTo("DELETE");
            assertThat(request.cacheControl()).isNull();
        });
    }

    @Test
    void anInterruptedCallerKeepsItsInterruptFlag() {
        start(attempt -> 200);
        S3ImageStore store = store(Duration.ofSeconds(5), Clock.systemUTC());

        Thread.currentThread().interrupt();
        ApiException deletion = catchThrowableOfType(ApiException.class, () -> store.delete("listings/a/b.jpg"));

        assertThat(Thread.interrupted()).as("interrupt flag restored (and cleared here)").isTrue();
        assertThat(deletion.status()).isEqualTo(503);
        assertThat(deletion.getCause()).hasMessage("S3 DELETE failed: interrupted");
    }

    private void start(Responder responder) {
        AtomicInteger attempts = new AtomicInteger();
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        server.setExecutor(handlers);
        server.createContext("/", exchange -> {
            try (exchange) {
                exchange.getRequestBody().readAllBytes();
                received.add(received(exchange));
                int status = responder.status(attempts.incrementAndGet());
                exchange.sendResponseHeaders(status, -1);
            } catch (Exception e) {
                // A stalled exchange is abandoned by the client; nothing to answer.
            }
        });
        server.start();
    }

    private static Received received(HttpExchange exchange) {
        var headers = exchange.getRequestHeaders();
        return new Received(exchange.getRequestMethod(), headers.getFirst("Host"), headers.getFirst("x-amz-date"),
                headers.getFirst("Authorization"), headers.getFirst("Cache-Control"));
    }

    private S3ImageStore store(Duration requestTimeout, Clock clock) {
        return new S3ImageStore("http://127.0.0.1:" + server.getAddress().getPort(), "us-east-1",
                "resilience-access-key", "resilience-secret-key", "bucket", "https://cdn.test.invalid",
                Duration.ofSeconds(2), requestTimeout, "public, max-age=3600", clock);
    }

    /** Moves one second per reading, so two signatures can never share a timestamp. */
    private static Clock tickingClock() {
        AtomicInteger readings = new AtomicInteger();
        Instant base = Instant.parse("2026-09-22T10:00:00Z");
        return new Clock() {
            @Override public ZoneId getZone() { return ZoneOffset.UTC; }
            @Override public Clock withZone(ZoneId zone) { return this; }
            @Override public Instant instant() { return base.plusSeconds(readings.getAndIncrement()); }
        };
    }
}
