plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
    id("org.springframework.boot")
    id("io.spring.dependency-management")
}

dependencies {
    // Application layer
    implementation(project(":backend:application:app-sim"))
    implementation(project(":backend:application:app-scenario"))
    implementation(project(":backend:application:app-scoring"))
    implementation(project(":backend:application:app-ai"))
    implementation(project(":backend:application:app-session"))

    // Infrastructure layer
    implementation(project(":backend:infrastructure:infra-db"))
    implementation(project(":backend:infrastructure:infra-web"))
    implementation(project(":backend:infrastructure:infra-auth"))
    implementation(project(":backend:infrastructure:infra-ai-llm"))
    implementation(project(":backend:infrastructure:infra-ai-ml"))
    implementation(project(":backend:infrastructure:infra-cache"))
    implementation(project(":backend:infrastructure:infra-monitoring"))

    // Spring Boot
    implementation("org.springframework.boot:spring-boot-starter")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
