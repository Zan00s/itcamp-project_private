plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
    id("io.spring.dependency-management")
}

dependencies {
    implementation(platform("org.springframework.boot:spring-boot-dependencies:3.4.1"))
    implementation(project(":core:core-shared"))
    implementation(project(":core:core-sim"))
    implementation(project(":core:core-scenario"))
    implementation(project(":core:core-audit"))
    implementation(project(":core:core-scoring"))
    implementation(project(":core:core-ai"))
    implementation(project(":application:app-sim"))
    implementation(project(":application:app-session"))
    implementation(project(":application:app-scenario"))
    implementation(project(":application:app-scoring"))
    implementation(project(":application:app-ai"))
    implementation(project(":infrastructure:infra-db"))
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
