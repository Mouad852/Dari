package ma.dari.api.support;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.io.IOException;
import java.util.UUID;

/**
 * A real MinIO for S3-mode tests: it verifies SigV4 signatures, which is the
 * part a hand-rolled client gets wrong and a mock never checks.
 *
 * <p>Same image as {@code infra/prod-smoke/docker-compose.yml}, and the bucket
 * is created and made anonymously readable the way its {@code minio-init}
 * service does it, with the {@code mc} client that ships in the image. Tests
 * check objects with {@code mc} as well, so the proof does not depend on the
 * client under test.
 */
public final class TestMinio implements AutoCloseable {

    /**
     * Keep equal to the minio image tag in infra/prod-smoke/docker-compose.yml.
     * A community build of MinIO with the same entrypoint and {@code mc}:
     * the minio/minio repository is gone from Docker Hub, so a runner without
     * a cached copy could not pull it and every S3 test failed on CI.
     */
    public static final String IMAGE = "pgsty/minio:RELEASE.2026-08-04T00-00-00Z";
    public static final String ACCESS_KEY = "test-access-key";
    public static final String SECRET_KEY = "test-secret-key-not-a-secret";
    public static final String REGION = "us-east-1";

    private final GenericContainer<?> container;
    private final String bucket;

    private TestMinio(GenericContainer<?> container, String bucket) {
        this.container = container;
        this.bucket = bucket;
    }

    @SuppressWarnings("resource") // closed by close()
    public static TestMinio start(String bucket) {
        String name = "dari-test-minio-" + UUID.randomUUID().toString().substring(0, 8);
        GenericContainer<?> container = new GenericContainer<>(DockerImageName.parse(IMAGE))
                .withCommand("server", "/data")
                .withEnv("MINIO_ROOT_USER", ACCESS_KEY)
                .withEnv("MINIO_ROOT_PASSWORD", SECRET_KEY)
                .withExposedPorts(9000)
                .withCreateContainerCmdModifier(cmd -> cmd.withName(name))
                .waitingFor(Wait.forHttp("/minio/health/live").forPort(9000));
        container.start();
        TestMinio minio = new TestMinio(container, bucket);
        minio.mc("alias set test http://127.0.0.1:9000 " + ACCESS_KEY + " " + SECRET_KEY);
        minio.mc("mb --ignore-existing test/" + bucket);
        minio.mc("anonymous set download test/" + bucket);
        return minio;
    }

    public String endpoint() {
        return "http://" + container.getHost() + ":" + container.getMappedPort(9000);
    }

    public String bucket() {
        return bucket;
    }

    /** Whether the object exists, asked of MinIO itself rather than of the client under test. */
    public boolean exists(String key) {
        try {
            return container.execInContainer("mc", "stat", "test/" + bucket + "/" + key).getExitCode() == 0;
        } catch (IOException | InterruptedException e) {
            throw new IllegalStateException("mc stat failed to run", e);
        }
    }

    private void mc(String arguments) {
        try {
            var result = container.execInContainer(("mc " + arguments).split(" "));
            if (result.getExitCode() != 0) {
                throw new IllegalStateException("mc " + arguments.split(" ")[0] + " failed: " + result.getStderr());
            }
        } catch (IOException | InterruptedException e) {
            throw new IllegalStateException("mc failed to run", e);
        }
    }

    @Override
    public void close() {
        container.stop();
    }
}
