plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
    id("io.spring.dependency-management")
}

dependencies {
    implementation(project(":backend:core:core-shared"))
    implementation(project(":backend:core:core-sim"))
    implementation(project(":backend:core:core-audit"))
    implementation(project(":backend:core:core-scoring"))
    implementation(project(":backend:core:core-ai"))
    implementation(project(":backend:application:app-sim"))
    implementation(project(":backend:application:app-scenario"))
    implementation(project(":backend:application:app-scoring"))
    implementation(project(":backend:application:app-ai"))
    implementation(project(":backend:application:app-session"))
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
