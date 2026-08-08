plugins {
    kotlin("jvm")
}

dependencies {
    implementation(project(":core:core-shared"))
    implementation(project(":core:core-sim"))
    implementation(project(":core:core-scenario"))
    implementation(project(":core:core-audit"))
    implementation(project(":core:core-scoring"))
    implementation(project(":core:core-ai"))
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
}
