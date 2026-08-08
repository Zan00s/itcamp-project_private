plugins {
    kotlin("jvm")
}

dependencies {
    implementation(project(":backend:core:core-shared"))
    implementation(project(":backend:core:core-ai"))
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
}
