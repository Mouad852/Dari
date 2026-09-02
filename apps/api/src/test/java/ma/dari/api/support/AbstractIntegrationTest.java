package ma.dari.api.support;

import com.google.firebase.auth.FirebaseAuth;
import io.restassured.RestAssured;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Base for every integration test.
 *
 * <p>Real Postgres with real PostGIS, not H2 and not a mock. Almost everything
 * risky in this system — a generated geography column, a GiST index, keyset
 * pagination over row-value comparison, partial unique indexes — either does not
 * exist or behaves differently on an in-memory database, so a green suite there
 * would prove nothing about production.
 *
 * <p>One container is shared across the whole suite. Startup dominates runtime,
 * and per-class containers make the suite slow enough that people stop running
 * it.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(
            // The PostGIS image is not recognized as Postgres unless told so.
            DockerImageName.parse("postgis/postgis:16-3.4")
                    .asCompatibleSubstituteFor("postgres"))
            .withDatabaseName("dari")
            .withUsername("dari")
            .withPassword("dari_test")
            .withReuse(true);

    static {
        POSTGRES.start();   // shared for the JVM; stopped by Ryuk at exit
    }

    /** Tests never reach Google. Token verification is stubbed per test. */
    @MockitoBean
    protected FirebaseAuth firebaseAuth;

    @LocalServerPort
    protected int port;

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @BeforeEach
    void configureRestAssured() {
        RestAssured.port = port;
        RestAssured.basePath = "/api/v1";
    }
}
