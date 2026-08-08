plugins {
    kotlin("jvm")
}

dependencies {
    implementation(project(":core:core-shared"))
    implementation(project(":core:core-ai"))
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
}
