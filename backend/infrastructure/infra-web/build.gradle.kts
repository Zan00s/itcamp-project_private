plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
    id("io.spring.dependency-management")
}

dependencies {
    implementation(project(":core:core-shared"))
    implementation(project(":core:core-sim"))
    implementation(project(":core:core-audit"))
    implementation(project(":core:core-scoring"))
    implementation(project(":core:core-ai"))
    implementation(project(":application:app-sim"))
    implementation(project(":application:app-scenario"))
    implementation(project(":application:app-scoring"))
    implementation(project(":application:app-ai"))
    implementation(project(":application:app-session"))
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
