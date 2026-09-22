package ma.dari.api.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;
import java.util.zip.GZIPInputStream;

/**
 * A local stand-in for the error-tracking ingest endpoint, on the JDK's own
 * HTTP server. Tests never contact the real vendor: the DSN points here.
 *
 * <p>Records every envelope it receives, exactly as serialized by the SDK, so
 * assertions run on the bytes that would have left the account.
 */
public final class FakeSentry implements AutoCloseable {

    public enum Mode { ACCEPT, FAIL, STALL }

    private static final ObjectMapper JSON = new ObjectMapper();

    private final HttpServer server;
    private final List<String> envelopes = new CopyOnWriteArrayList<>();
    private final AtomicInteger stalledRequests = new AtomicInteger();
    private volatile Mode mode = Mode.ACCEPT;
    private volatile CountDownLatch release = new CountDownLatch(0);

    public FakeSentry() {
        try {
            server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        server.createContext("/", this::handle);
        server.setExecutor(Executors.newCachedThreadPool(runnable -> {
            Thread thread = new Thread(runnable, "fake-sentry");
            thread.setDaemon(true);
            return thread;
        }));
        server.start();
    }

    /** A DSN for project 7 on this server. The key is a placeholder, not a credential. */
    public String dsn() {
        return "http://test-only-public-key@127.0.0.1:" + server.getAddress().getPort() + "/7";
    }

    public void mode(Mode next) {
        if (next == Mode.STALL) release = new CountDownLatch(1);
        else release.countDown();
        mode = next;
    }

    public void reset() {
        mode(Mode.ACCEPT);
        envelopes.clear();
        stalledRequests.set(0);
    }

    public int stalledRequests() {
        return stalledRequests.get();
    }

    public List<String> envelopes() {
        return List.copyOf(envelopes);
    }

    /** Every event item received so far, parsed. */
    public List<JsonNode> events() {
        List<JsonNode> events = new ArrayList<>();
        for (String envelope : envelopes) {
            String[] lines = envelope.split("\n");
            for (int i = 1; i + 1 < lines.length; i += 2) {
                JsonNode header = parse(lines[i]);
                if ("event".equals(header.path("type").asText())) events.add(parse(lines[i + 1]));
            }
        }
        return events;
    }

    /** The raw envelope containing the first event that matches, waiting up to the timeout. */
    public Optional<String> awaitEnvelope(Predicate<JsonNode> event, Duration timeout) throws InterruptedException {
        long deadline = System.nanoTime() + timeout.toNanos();
        do {
            for (String envelope : envelopes) {
                String[] lines = envelope.split("\n");
                for (int i = 1; i + 1 < lines.length; i += 2) {
                    if ("event".equals(parse(lines[i]).path("type").asText()) && event.test(parse(lines[i + 1]))) {
                        return Optional.of(envelope);
                    }
                }
            }
            Thread.sleep(50);
        } while (System.nanoTime() < deadline);
        return Optional.empty();
    }

    public static JsonNode eventIn(String envelope) {
        String[] lines = envelope.split("\n");
        for (int i = 1; i + 1 < lines.length; i += 2) {
            if ("event".equals(parse(lines[i]).path("type").asText())) return parse(lines[i + 1]);
        }
        throw new AssertionError("no event item in envelope");
    }

    private void handle(HttpExchange exchange) throws IOException {
        try (exchange) {
            byte[] body = read(exchange);
            if (mode == Mode.STALL) {
                stalledRequests.incrementAndGet();
                try {
                    release.await(30, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            envelopes.add(new String(body, StandardCharsets.UTF_8));
            byte[] response = "{}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(mode == Mode.FAIL ? 500 : 200, response.length);
            exchange.getResponseBody().write(response);
        }
    }

    private static byte[] read(HttpExchange exchange) throws IOException {
        InputStream raw = exchange.getRequestBody();
        boolean gzip = "gzip".equalsIgnoreCase(exchange.getRequestHeaders().getFirst("Content-Encoding"));
        try (InputStream in = gzip ? new GZIPInputStream(raw) : raw) {
            return in.readAllBytes();
        }
    }

    private static JsonNode parse(String line) {
        try {
            return JSON.readTree(line);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void close() {
        release.countDown();
        server.stop(0);
    }
}
