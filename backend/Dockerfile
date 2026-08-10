FROM gradle:8.12-jdk21 AS builder

WORKDIR /build

ENV GRADLE_OPTS="-Xmx512m -XX:MaxMetaspaceSize=256m -Dorg.gradle.daemon=false -Dorg.gradle.parallel=false"
ENV JAVA_OPTS="-Xmx512m"

COPY gradle/ gradle/
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY core/ core/
COPY application/ application/
COPY infrastructure/ infrastructure/
COPY bootstrap/ bootstrap/

RUN gradle :bootstrap:bootJar --no-daemon --no-parallel

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=builder /build/bootstrap/build/libs/*-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-Xmx256m", "-jar", "app.jar"]
