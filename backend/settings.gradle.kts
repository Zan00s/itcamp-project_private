rootProject.name = "elou-av-ktc"

include(":backend")

// Core modules (pure Kotlin, no framework dependencies)
include(":backend:core:core-shared")
include(":backend:core:core-sim")
include(":backend:core:core-scenario")
include(":backend:core:core-scoring")
include(":backend:core:core-audit")
include(":backend:core:core-ai")

// Application modules (use cases, depend on core)
include(":backend:application:app-sim")
include(":backend:application:app-scenario")
include(":backend:application:app-scoring")
include(":backend:application:app-ai")
include(":backend:application:app-session")

// Infrastructure modules (adapters, depend on core + frameworks)
include(":backend:infrastructure:infra-db")
include(":backend:infrastructure:infra-web")
include(":backend:infrastructure:infra-auth")
include(":backend:infrastructure:infra-ai-llm")
include(":backend:infrastructure:infra-ai-ml")
include(":backend:infrastructure:infra-cache")
include(":backend:infrastructure:infra-monitoring")

// Bootstrap (Spring Boot application wiring)
include(":backend:bootstrap")
