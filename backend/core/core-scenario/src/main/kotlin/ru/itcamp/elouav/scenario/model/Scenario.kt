package ru.itcamp.elouav.scenario.model

import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.shared.ScenarioId

enum class Operator { LESS_THAN, GREATER_THAN, EQUALS, ALARM_ACTIVATED }

data class Condition(
    val node: String? = null,
    val param: String? = null,
    val op: Operator = Operator.LESS_THAN,
    val value: Double = 0.0,
    val critical: Boolean = false,
    val condition: String? = null,
) {
    fun evaluate(states: Map<NodeId, ru.itcamp.elouav.sim.model.NodeState>): Boolean {
        if (condition == "alarm_activated") {
            return states.values.any { it.mode == ru.itcamp.elouav.sim.model.NodeMode.ALARM }
        }
        if (node == null || param == null) return false
        val nodeId = NodeId(node)
        val state = states[nodeId] ?: return false
        val actual = state.parameters[param] ?: return false
        return when (op) {
            Operator.LESS_THAN -> actual < value
            Operator.GREATER_THAN -> actual > value
            Operator.EQUALS -> actual == value
            Operator.ALARM_ACTIVATED -> state.mode == ru.itcamp.elouav.sim.model.NodeMode.ALARM
        }
    }
}

data class ExpectedAction(
    val node: String,
    val action: String,
    val value: Double? = null,
    val rampOk: List<Double>? = null,
)

data class Phase(
    val id: String,
    val title: String,
    val expectedActions: List<ExpectedAction> = emptyList(),
)

data class ScenarioSetup(
    val initialState: String = "cold",
    val nodesOverride: Map<String, Map<String, Any>> = emptyMap(),
)

data class Hint(
    val key: String,
    val text: String,
)

data class Scenario(
    val id: ScenarioId,
    val version: Int = 1,
    val name: String,
    val install: String,
    val timeoutSec: Int = 1800,
    val difficulty: Int = 2,
    val ratingEnabled: Boolean = true,
    val setup: ScenarioSetup = ScenarioSetup(),
    val successConditions: List<Condition> = emptyList(),
    val failureConditions: List<Condition> = emptyList(),
    val phases: List<Phase> = emptyList(),
    val allowedNodes: List<String> = emptyList(),
    val bankHints: List<Hint> = emptyList(),
    val passingScore: Int = 70,
    val derivedFrom: String? = null,
    val focusPhases: List<String> = emptyList(),
    val hintBoost: Boolean = false,
    val reasoning: String? = null,
)
