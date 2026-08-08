FROM eclipse-temurin:21-jdk AS builder

WORKDIR /build

COPY gradle/ gradle/
COPY settings.gradle.kts build.gradle.kts gradlew ./
COPY core/ core/
COPY application/ application/
COPY infrastructure/ infrastructure/
COPY bootstrap/ bootstrap/

RUN chmod +x gradlew && ./gradlew :bootstrap:bootJar --no-daemon

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=builder /build/bootstrap/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
