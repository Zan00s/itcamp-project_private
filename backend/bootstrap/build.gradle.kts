plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
    id("org.springframework.boot")
    id("io.spring.dependency-management")
}

dependencies {
    implementation(platform("org.springframework.boot:spring-boot-dependencies:3.4.1"))

    // Core layer
    implementation(project(":core:core-shared"))
    implementation(project(":core:core-sim"))
    implementation(project(":core:core-scenario"))
    implementation(project(":core:core-audit"))
    implementation(project(":core:core-scoring"))
    implementation(project(":core:core-ai"))

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
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
