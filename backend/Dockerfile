# =============================================================================
# Backend Quarkus - imagen de contenedor
# Multi-stage: build con Maven + runtime con JRE 17
# Los tests se omiten en el build (usan Testcontainers y no tienen acceso al
# daemon Docker dentro de docker build); la verificacion real ocurre al
# arrancar el contenedor con Flyway sobre BD limpia.
# =============================================================================

# --- Stage 1: build ---
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B package -DskipTests

# --- Stage 2: runtime ---
FROM eclipse-temurin:17-jre
ENV TZ=America/Lima
WORKDIR /app
COPY --from=build /build/target/quarkus-app/ ./quarkus-app/
EXPOSE 6101
ENTRYPOINT ["java", "-Duser.timezone=America/Lima", "-jar", "quarkus-app/quarkus-run.jar"]