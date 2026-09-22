# Production image for the Dari API. Build from the repository root:
#
#   docker build -t dari-api:<release> apps/api
#
# The build context is apps/api only; .dockerignore is an allowlist, so the
# Firebase key in infra/firebase cannot enter the image even by accident. The
# key is mounted at runtime as a read-only file and FIREBASE_CREDENTIALS_PATH
# points at it.
#
# The release version is deliberately NOT baked in: the deployment sets
# DARI_RELEASE_VERSION to the same immutable tag it deploys (the git SHA), so
# the image a task runs and the version it reports cannot disagree.

# --- build -------------------------------------------------------------------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# Dependencies first, in their own layer: it is only rebuilt when pom.xml or the
# wrapper changes, not on every source edit.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw --batch-mode --quiet dependency:go-offline

# Tests are not run here. CI runs the full Testcontainers suite, which needs a
# Docker daemon this build does not have.
COPY src/ src/
RUN ./mvnw --batch-mode --quiet package -DskipTests \
    && cp target/dari-api-*.jar app.jar \
    && java -Djarmode=tools -jar app.jar extract --layers --destination extracted

# --- runtime -----------------------------------------------------------------
# Ubuntu-based JRE, not Alpine: ImageIO/AWT re-encodes every uploaded photo, and
# the musl builds are where headless AWT tends to break.
FROM eclipse-temurin:21-jre

RUN groupadd --system --gid 10001 dari \
    && useradd --system --uid 10001 --gid dari --no-create-home --shell /usr/sbin/nologin dari

WORKDIR /app

# Spring Boot's layers, least to most volatile, so a code-only release reuses
# the dependency layers already on the host.
COPY --from=build /workspace/extracted/dependencies/ ./
COPY --from=build /workspace/extracted/spring-boot-loader/ ./
COPY --from=build /workspace/extracted/snapshot-dependencies/ ./
COPY --from=build /workspace/extracted/application/ ./

USER dari:dari
EXPOSE 8080

# Exec form: java is PID 1 and receives SIGTERM directly, which is what lets
# server.shutdown=graceful drain in-flight requests. Extra JVM flags go in
# JAVA_TOOL_OPTIONS, which the JVM reads without a shell.
ENTRYPOINT ["java", \
    "-XX:MaxRAMPercentage=75", \
    "-XX:+ExitOnOutOfMemoryError", \
    "-Djava.awt.headless=true", \
    "-jar", "/app/app.jar"]
