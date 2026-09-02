# Guide — Phase 01: Backend foundation

Implementation guide for [`01-backend-foundation.md`](../01-backend-foundation.md).

Target: a running Spring Boot app on PostGIS, verifying Firebase tokens, with `users` and a real integration-test harness. Nothing product-visible. Days, not weeks.

---

## 0. Decisions to settle before writing code

Three of them, with reasoning, because they are cheap now and painful later.

**UUID generation → application-side, v7 if available.** Database-side `gen_random_uuid()` means you cannot know an entity's id before insert, which complicates the outbox pattern in phase 04 and batch inserts in phase 05. Random v4 keys also fragment B-tree indexes. Use time-ordered UUIDv7 if a library is available for your Java version; otherwise v4 and accept the fragmentation.

**Valid token, no internal user row → 404 from `/users/me`; the filter does NOT auto-create.** The alternative — lazily creating the row inside the auth filter — hides a real client bug and performs a write as a side effect of a GET. Instead: the filter authenticates the Firebase identity and attaches it; endpoints needing an internal profile resolve it and 404 if absent; the client calls `POST /users` on first launch and on any 404. Write this contract down, because phase 03 must honour it.

**Flyway, not Hibernate `ddl-auto`.** Non-negotiable once phase 02 brings PostGIS generated columns and partial indexes — Hibernate cannot express either.

---

## 1. Project setup

Already scaffolded — see `apps/api/pom.xml`. To regenerate from scratch:

```bash
curl https://start.spring.io/starter.zip \
  -d dependencies=web,data-jpa,validation,flyway,actuator,postgresql \
  -d type=maven-project -d language=java -d javaVersion=21 \
  -d groupId=ma.dari -d artifactId=dari-api -d packageName=ma.dari.api \
  -o dari-api.zip && unzip dari-api.zip -d dari-api
```

Beyond the starters, the dependencies the Boot parent does not version. Verify
current releases rather than trusting these, they move:

```xml
<!-- Token verification only. There is no login endpoint and never should be. -->
<dependency>
    <groupId>com.google.firebase</groupId>
    <artifactId>firebase-admin</artifactId>
    <version>9.4.3</version>
</dependency>

<!-- JTS types for phase 02's geography(Point,4326). -->
<dependency>
    <groupId>org.hibernate.orm</groupId>
    <artifactId>hibernate-spatial</artifactId>
</dependency>
<dependency>
    <groupId>org.locationtech.jts</groupId>
    <artifactId>jts-core</artifactId>
    <version>1.20.0</version>
</dependency>

<!-- Scheduled-job locking. Added now so phase 10's expiry job is never
     written single-instance-only and retrofitted later. -->
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-spring</artifactId>
    <version>6.3.0</version>
</dependency>
```

Commit the Maven wrapper. Pinning one Maven version for every machine and for CI
is the whole reason it exists.

### Package layout

Package by feature, not by layer. A `controllers/` package holding twelve unrelated controllers ages badly; `listing/` holding everything about listings does not.

```
ma.dari.api
├── config/           SecurityConfig, FirebaseConfig, JacksonConfig
├── common/
│   ├── error/        ApiException, ErrorCode, GlobalExceptionHandler, ErrorResponse
│   ├── pagination/   Cursor, CursorPage
│   └── auth/         FirebaseAuthFilter, AuthenticatedUser, CurrentUser
├── user/             User, UserRepository, UserService, UserController, dto/
├── listing/          (phase 02)
├── messaging/        (phase 04)
├── moderation/       (phase 06)
└── DariApiApplication.java
```

---

## 2. Docker Compose

```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: dari
      POSTGRES_USER: dari
      POSTGRES_PASSWORD: dari_local
    ports: ["5432:5432"]
    volumes: ["dari_pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dari -d dari"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  dari_pgdata:
```

Pin the PostGIS minor version. Phase 02 uses a generated column whose behavior must be identical in dev, CI and production.

---

## 3. Migrations

`src/main/resources/db/migration/V1__extensions.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

`V2__users.sql`:

```sql
CREATE TYPE user_role   AS ENUM ('USER', 'ADMIN');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

CREATE TABLE users (
    id              UUID PRIMARY KEY,
    firebase_uid    TEXT        NOT NULL UNIQUE,
    email           TEXT        NOT NULL,
    email_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
    phone           TEXT,
    phone_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
    first_name      TEXT,
    display_name    TEXT        NOT NULL,
    role            user_role   NOT NULL DEFAULT 'USER',
    status          user_status NOT NULL DEFAULT 'ACTIVE',
    city            TEXT,
    bio             TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_email_lower ON users (lower(email));
CREATE INDEX idx_users_status ON users (status) WHERE status <> 'ACTIVE';
```

Why these choices:

- **Postgres enums over `VARCHAR` + check constraint.** They are harder to alter, which is the point — a typo in a status string becomes an error rather than an invisible bug. Map with `@JdbcTypeCode(SqlTypes.NAMED_ENUM)` in Hibernate 6.
- **`lower(email)` unique index.** Phase 06 blocks banned emails from re-registering; case-sensitive matching makes that trivially bypassable.
- **`TIMESTAMPTZ` everywhere, never `TIMESTAMP`.** Morocco shifts its clocks around Ramadan; naive timestamps will bite.
- **Partial index on non-active users** stays tiny and serves phase 06's admin queries.

---

## 4. Firebase authentication

### Initialization

```java
@Configuration
public class FirebaseConfig {

    @Bean
    FirebaseApp firebaseApp(@Value("${dari.firebase.credentials-path}") String path)
            throws IOException {
        if (!FirebaseApp.getApps().isEmpty()) return FirebaseApp.getInstance();
        try (var in = new FileInputStream(path)) {
            return FirebaseApp.initializeApp(FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(in))
                    .build());
        }
    }

    @Bean
    FirebaseAuth firebaseAuth(FirebaseApp app) { return FirebaseAuth.getInstance(app); }
}
```

Credentials path from an env var. **Never commit the service account JSON** — gitignore it on day one, because purging a leaked key from git history is miserable.

Warm the public-key cache at startup so the first real user does not pay the fetch:

```java
@Component
@RequiredArgsConstructor
class FirebaseWarmup implements ApplicationRunner {
    private final FirebaseAuth auth;

    @Override public void run(ApplicationArguments args) {
        try { auth.verifyIdToken("warmup"); }
        catch (Exception ignored) { /* expected to fail — the point is the key fetch */ }
    }
}
```

### The filter

```java
@Component
@RequiredArgsConstructor
public class FirebaseAuthFilter extends OncePerRequestFilter {

    private final FirebaseAuth firebaseAuth;
    private final UserRepository users;
    private final ObjectMapper mapper;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        String header = req.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) { chain.doFilter(req, res); return; }

        try {
            FirebaseToken token = firebaseAuth.verifyIdToken(header.substring(7));

            // Absent internal profile is legal — the client is between Firebase
            // signup and POST /users. It is deliberately NOT created here.
            Optional<User> user = users.findByFirebaseUid(token.getUid());

            if (user.map(u -> u.getStatus() == UserStatus.BANNED).orElse(false)) {
                writeError(res, 403, ErrorCode.ACCOUNT_BANNED, "Compte suspendu");
                return;
            }

            var principal = new AuthenticatedUser(
                    token.getUid(), token.getEmail(), token.isEmailVerified(), user.orElse(null));

            var authorities = user
                    .map(u -> List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole())))
                    .orElse(List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS_VERIFIED")));

            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(principal, null, authorities));

        } catch (FirebaseAuthException e) {
            writeError(res, 401, ErrorCode.INVALID_TOKEN, "Session expirée");
            return;
        }
        chain.doFilter(req, res);
    }
}
```

Three things worth noticing:

- **A banned user is rejected in the filter**, before any controller runs. Per-endpoint checks eventually miss one.
- **The filter never creates users**, per the decision above.
- **Filter errors use the same envelope as everything else.** Filter-level failures bypass `@RestControllerAdvice`, so `writeError` serializes the envelope by hand — otherwise auth failures return a Spring default shape the frontend cannot parse uniformly.

### Resolving the current user

```java
@Target(ElementType.PARAMETER) @Retention(RetentionPolicy.RUNTIME)
public @interface CurrentUser {}

@Component
public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

    @Override public boolean supportsParameter(MethodParameter p) {
        return p.hasParameterAnnotation(CurrentUser.class) && p.getParameterType() == User.class;
    }

    @Override public Object resolveArgument(MethodParameter p, ModelAndViewContainer m,
                                            NativeWebRequest r, WebDataBinderFactory b) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthenticatedUser au))
            throw new ApiException(401, ErrorCode.UNAUTHENTICATED, "Connexion requise");
        if (au.internalUser() == null)
            throw new ApiException(404, ErrorCode.PROFILE_NOT_FOUND, "Profil introuvable");
        return au.internalUser();
    }
}
```

Now `GET /users/me` is just `me(@CurrentUser User user)`, and the 404 contract lives in exactly one place.

---

## 5. Error envelope

```java
public record ErrorResponse(String code, String message, Map<String,String> fields) {}

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> handle(ApiException e) {
        return ResponseEntity.status(e.status())
                .body(new ErrorResponse(e.code().name(), e.getMessage(), null));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        var fields = e.getBindingResult().getFieldErrors().stream()
                .collect(toMap(FieldError::getField, FieldError::getDefaultMessage, (a,b) -> a));
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("VALIDATION_FAILED", "Données invalides", fields));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> handleUnexpected(Exception e, HttpServletRequest req) {
        log.error("Unhandled [{}] on {}", MDC.get("correlationId"), req.getRequestURI(), e);
        return ResponseEntity.status(500)
                .body(new ErrorResponse("INTERNAL_ERROR", "Une erreur est survenue", null));
    }
}
```

**Messages are user-facing French**, per the design system copy rules: plain, non-blaming, no exclamation marks, no *"Oups !"*. The `code` is what the client branches on; the `message` is what a human reads. Never leak a stack trace or SQL text into `message`.

---

## 6. Endpoints

```java
@RestController @RequestMapping("/api/v1/users") @RequiredArgsConstructor
public class UserController {

    private final UserService service;

    /** Called once after first Firebase signup. Idempotent on firebase_uid. */
    @PostMapping
    ResponseEntity<UserResponse> create(Authentication auth,
                                        @Valid @RequestBody CreateUserRequest body) {
        var principal = (AuthenticatedUser) auth.getPrincipal();
        return ResponseEntity.status(201).body(service.createProfile(principal, body));
    }

    @GetMapping("/me")
    UserResponse me(@CurrentUser User user) { return UserResponse.of(user); }

    @PatchMapping("/me")
    UserResponse update(@CurrentUser User user, @Valid @RequestBody UpdateUserRequest body) {
        return UserResponse.of(service.update(user, body));
    }
}
```

Two rules that matter more than they look:

- **`POST /users` must be idempotent.** If a profile already exists for that `firebase_uid`, return it with 200 rather than a duplicate-key 500. A client retrying after a dropped response is normal traffic, not an error.
- **Email comes from the verified token, never the request body.** Otherwise any user can claim any email — and phase 06's ban-by-email check becomes worthless.

---

## 7. Testing

```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
@Testcontainers
abstract class IntegrationTest {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>(
            DockerImageName.parse("postgis/postgis:16-3.4")
                           .asCompatibleSubstituteFor("postgres"))
        .withReuse(true);

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", db::getJdbcUrl);
        r.add("spring.datasource.username", db::getUsername);
        r.add("spring.datasource.password", db::getPassword);
    }
}
```

`asCompatibleSubstituteFor("postgres")` is required or Testcontainers rejects the PostGIS image. `withReuse(true)` plus `testcontainers.reuse.enable=true` in `~/.testcontainers.properties` makes the local loop bearable.

### Faking Firebase

Do not call real Firebase from tests. Mock `FirebaseAuth` and key the stub off the token string:

```java
@TestConfiguration
static class FakeFirebase {
    @Bean @Primary FirebaseAuth firebaseAuth() throws Exception {
        var mock = Mockito.mock(FirebaseAuth.class);
        when(mock.verifyIdToken(anyString())).thenAnswer(inv -> {
            String t = inv.getArgument(0);
            if (t.startsWith("invalid")) throw Mockito.mock(FirebaseAuthException.class);
            return stubToken(t, t + "@test.ma");
        });
        return mock;
    }
}
```

You still need **one manual check against a real Firebase project** before calling this phase done. The mock proves your wiring, not that real tokens verify.

### Tests to write

| Test | Asserts |
| --- | --- |
| Migrations apply to a virgin container | Flyway + PostGIS extension |
| `POST /users` → `GET /users/me` | Round-trip |
| `POST /users` twice | Idempotent, no 500 |
| Valid token, no profile | 404 `PROFILE_NOT_FOUND`, not 500 |
| No auth header | 401, standard envelope |
| Token `invalid-x` | 401, standard envelope |
| Banned user, any route | 403 `ACCOUNT_BANNED` |
| `PATCH /users/me` with email in body | Email unchanged |
| Validation failure | 400 with `fields` populated |

---

## 8. Observability

Correlation id filter, ordered before the auth filter:

```java
@Component @Order(Ordered.HIGHEST_PRECEDENCE)
class CorrelationIdFilter extends OncePerRequestFilter {
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws IOException, ServletException {
        String id = Optional.ofNullable(req.getHeader("X-Correlation-Id"))
                            .orElseGet(() -> UUID.randomUUID().toString());
        MDC.put("correlationId", id);
        res.setHeader("X-Correlation-Id", id);
        try { chain.doFilter(req, res); } finally { MDC.clear(); }
    }
}
```

`MDC.clear()` in a `finally` matters — thread pools reuse threads, and a leaked id attaches one request's correlation to another's logs.

Expose `/actuator/health` only; keep `/actuator/**` off the public internet in production.

---

## 9. Done checklist

```bash
docker compose up -d
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
curl localhost:8080/actuator/health                    # {"status":"UP"}
curl localhost:8080/api/v1/users/me                    # 401, standard envelope
curl -H "Authorization: Bearer <real>" localhost:8080/api/v1/users/me   # 404 before POST /users
./mvnw test                                             # green on a throwaway PostGIS container
```

- [ ] Fresh-machine setup documented, and followed end to end by someone who is not you
- [ ] Service account key gitignored and absent from history
- [ ] CI runs the Testcontainers suite
- [ ] One manual verification against a real Firebase token

## Carry into phase 02

- The `@CurrentUser` resolver and the 404-on-missing-profile contract
- The error envelope, including the filter-level path
- The Testcontainers base class — phase 02 leans on it heavily
- Postgres 12+ confirmed, which the pinned image satisfies; phase 02's generated geography column requires it
