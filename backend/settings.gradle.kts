rootProject.name = "elou-av-ktc"

// Core modules (pure Kotlin, no framework dependencies)
include(":core:core-shared")
include(":core:core-sim")
include(":core:core-scenario")
include(":core:core-scoring")
include(":core:core-audit")
include(":core:core-ai")

// Application modules (use cases, depend on core)
include(":application:app-sim")
include(":application:app-scenario")
include(":application:app-scoring")
include(":application:app-ai")
include(":application:app-session")

// Infrastructure modules (adapters, depend on core + frameworks)
include(":infrastructure:infra-db")
include(":infrastructure:infra-web")
include(":infrastructure:infra-auth")
include(":infrastructure:infra-ai-llm")
include(":infrastructure:infra-ai-ml")
include(":infrastructure:infra-cache")
include(":infrastructure:infra-monitoring")

// Bootstrap (Spring Boot application wiring)
include(":bootstrap")
