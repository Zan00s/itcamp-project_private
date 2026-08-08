plugins {
    kotlin("jvm")
}

dependencies {
    implementation(project(":core:core-shared"))
    implementation(project(":core:core-scoring"))
    implementation(project(":core:core-audit"))
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
}
