package ru.itcamp.elouav.sim.model

enum class NodeMode {
    STOPPED, RUNNING, ALARM, MAINTENANCE
}

enum class ClampMode {
    CLAMP, REJECT, ALARM
}

enum class EdgeType {
    PIPELINE, CONTROL, SIGNAL
}

enum class ViolateAction {
    ALARM, CLAMP, IGNORE
}
