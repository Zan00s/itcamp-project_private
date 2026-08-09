plugins {
    kotlin("jvm")
}

dependencies {
    implementation(project(":core:core-shared"))
    implementation(project(":core:core-sim"))
    implementation(project(":core:core-scenario"))
    implementation(project(":core:core-scoring"))
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
}
