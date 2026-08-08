plugins {
    kotlin("jvm")
}

dependencies {
    implementation(project(":core:core-shared"))
    implementation(project(":core:core-sim"))
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("io.kotest:kotest-assertions-core:5.9.1")
}
