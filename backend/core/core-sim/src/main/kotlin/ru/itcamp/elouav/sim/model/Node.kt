package ru.itcamp.elouav.sim.model

import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.shared.PortId

data class NodeState(
    val mode: NodeMode = NodeMode.STOPPED,
    val parameters: Map<String, Double> = emptyMap(),
) {
    fun withParameter(name: String, value: Double): NodeState =
        copy(parameters = parameters + (name to value))

    fun withMode(newMode: NodeMode): NodeState = copy(mode = newMode)

    fun parameter(name: String): Double? = parameters[name]
}

data class Action(
    val id: String,
    val label: String,
    val param: String? = null,
    val range: ClosedRange<Double>? = null,
    val onOutOfRange: ClampMode = ClampMode.CLAMP,
) {
    fun validate(value: Double): Pair<Double, ValidationResult> {
        val r = range ?: return value to ValidationResult.Applied
        return when {
            value < r.start -> r.start to ValidationResult.Clamped(value, r.start)
            value > r.endInclusive -> r.endInclusive to ValidationResult.Clamped(value, r.endInclusive)
            else -> value to ValidationResult.Applied
        }
    }
}

sealed class ValidationResult {
    data object Applied : ValidationResult()
    data class Clamped(val original: Double, val clampedTo: Double) : ValidationResult()
    data object Rejected : ValidationResult()
    data object Alarm : ValidationResult()
}

data class Constraint(
    val min: Double? = null,
    val max: Double? = null,
    val onViolate: ViolateAction = ViolateAction.ALARM,
) {
    fun check(value: Double): ConstraintResult {
        if (min != null && value < min) return ConstraintResult.Violated(min, onViolate)
        if (max != null && value > max) return ConstraintResult.Violated(max, onViolate)
        return ConstraintResult.Ok
    }
}

sealed class ConstraintResult {
    data object Ok : ConstraintResult()
    data class Violated(val boundary: Double, val action: ViolateAction) : ConstraintResult()
}

data class BehaviorRule(
    val id: String,
    val output: String,
    val formula: String,
    val deps: List<String> = emptyList(),
    val constraints: Constraint? = null,
)

data class Node(
    val id: NodeId,
    val type: String,
    val name: String,
    val inputs: List<PortId> = emptyList(),
    val outputs: List<PortId> = emptyList(),
    val state: NodeState = NodeState(),
    val actions: List<Action> = emptyList(),
    val behavior: List<BehaviorRule> = emptyList(),
) {
    fun action(id: String): Action? = actions.find { it.id == id }
}

data class Edge(
    val id: String,
    val from: NodeId,
    val to: NodeId,
    val fromPort: PortId,
    val toPort: PortId,
    val type: EdgeType = EdgeType.PIPELINE,
    val scale: Double = 1.0,
)
