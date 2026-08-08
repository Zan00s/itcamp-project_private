plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
    id("org.springframework.boot")
    id("io.spring.dependency-management")
}

dependencies {
    // Application layer
    implementation(project(":application:app-sim"))
    implementation(project(":application:app-scenario"))
    implementation(project(":application:app-scoring"))
    implementation(project(":application:app-ai"))
    implementation(project(":application:app-session"))

    // Infrastructure layer
    implementation(project(":infrastructure:infra-db"))
    implementation(project(":infrastructure:infra-web"))
    implementation(project(":infrastructure:infra-auth"))
    implementation(project(":infrastructure:infra-ai-llm"))
    implementation(project(":infrastructure:infra-ai-ml"))
    implementation(project(":infrastructure:infra-cache"))
    implementation(project(":infrastructure:infra-monitoring"))

    // Spring Boot
    implementation("org.springframework.boot:spring-boot-starter")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
