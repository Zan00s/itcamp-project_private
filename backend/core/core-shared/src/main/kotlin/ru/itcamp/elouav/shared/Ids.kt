package ru.itcamp.elouav.shared

import java.time.Instant

@JvmInline
value class Id<T>(val value: String) {
    override fun toString(): String = value
}

@JvmInline
value class NodeId(val value: String) {
    override fun toString(): String = value
}

@JvmInline
value class EdgeId(val value: String) {
    override fun toString(): String = value
}

@JvmInline
value class PortId(val value: String) {
    override fun toString(): String = value
}

@JvmInline
value class SessionId(val value: String) {
    override fun toString(): String = value
}

@JvmInline
value class ScenarioId(val value: String) {
    override fun toString(): String = value
}

@JvmInline
value class UserId(val value: String) {
    override fun toString(): String = value
}

@JvmInline
value class ActionId(val value: String) {
    override fun toString(): String = value
}

object Clock {
    fun now(): Instant = Instant.now()
}
