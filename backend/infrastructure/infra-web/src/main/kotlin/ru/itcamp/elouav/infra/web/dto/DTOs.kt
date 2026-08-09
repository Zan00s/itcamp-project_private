package ru.itcamp.elouav.infra.web.dto

import ru.itcamp.elouav.scenario.model.Scenario
import ru.itcamp.elouav.scoring.model.ScoreBreakdown
import ru.itcamp.elouav.scoring.model.Verdict
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.sim.model.Graph
import ru.itcamp.elouav.sim.model.Node
import ru.itcamp.elouav.sim.model.NodeState
import ru.itcamp.elouav.sim.model.SimulationStep

data class NodeDTO(
    val id: String,
    val type: String,
    val name: String,
    val mode: String,
    val parameters: Map<String, Double>,
    val paramLabels: Map<String, String>,
    val actions: List<ActionDTO>,
    val inputs: List<String>,
    val outputs: List<String>,
)

data class ActionDTO(
    val id: String,
    val label: String,
    val param: String?,
    val min: Double?,
    val max: Double?,
)

data class EdgeDTO(
    val id: String,
    val from: String,
    val to: String,
    val fromPort: String,
    val toPort: String,
    val type: String,
)

data class GraphDTO(
    val nodes: List<NodeDTO>,
    val edges: List<EdgeDTO>,
)

data class ActionRequestDTO(
    val node: String,
    val action: String,
    val value: Double? = null,
)

data class SimulationStepDTO(
    val node: String,
    val action: String,
    val value: Double?,
    val validationResult: String,
    val chain: List<ChainLinkDTO>,
    val finalState: Map<String, NodeStateDTO>,
    val stabilized: Boolean,
)

data class ChainLinkDTO(
    val node: String,
    val changed: List<String>,
)

data class NodeStateDTO(
    val mode: String,
    val parameters: Map<String, Double>,
)

data class ScenarioDTO(
    val id: String,
    val name: String,
    val install: String,
    val timeoutSec: Int,
    val difficulty: Int,
    val phases: List<PhaseDTO>,
    val passingScore: Int,
)

data class PhaseDTO(
    val id: String,
    val title: String,
    val expectedActions: List<ExpectedActionDTO>,
)

data class ExpectedActionDTO(
    val node: String,
    val action: String,
    val value: Double?,
)

data class StartSessionRequestDTO(
    val scenarioId: String,
    val attempt: Int = 1,
)

data class SessionDTO(
    val id: String,
    val scenarioId: String,
    val userId: String,
    val attempt: Int,
    val active: Boolean,
)

data class VerdictDTO(
    val sessionId: String,
    val scenarioId: String,
    val attempt: Int,
    val verdict: String,
    val score: Int,
    val componentScores: Map<String, Double>,
    val achievements: List<String>,
    val feedback: List<FeedbackDTO>,
    val aiUsed: Boolean,
)

data class FeedbackDTO(
    val actionId: String?,
    val type: String,
    val text: String,
    val hint: String?,
)

data class SessionInfoDTO(
    val id: String,
    val scenarioId: String,
    val userId: String,
    val attempt: Int,
    val active: Boolean,
    val startedAt: String,
    val endedAt: String?,
    val verdict: VerdictDTO?,
)

object DTOMapper {
    fun toGraphDTO(graph: Graph): GraphDTO = GraphDTO(
        nodes = graph.nodes.values.map { toNodeDTO(it) },
        edges = graph.edges.map { toEdgeDTO(it) },
    )

    fun toNodeDTO(node: Node): NodeDTO = NodeDTO(
        id = node.id.value,
        type = node.type,
        name = node.name,
        mode = node.state.mode.name,
        parameters = node.state.parameters,
        paramLabels = node.paramLabels,
        actions = node.actions.map { toActionDTO(it) },
        inputs = node.inputs.map { it.value },
        outputs = node.outputs.map { it.value },
    )

    fun toActionDTO(action: ru.itcamp.elouav.sim.model.Action): ActionDTO = ActionDTO(
        id = action.id,
        label = action.label,
        param = action.param,
        min = action.range?.start,
        max = action.range?.endInclusive,
    )

    fun toEdgeDTO(edge: ru.itcamp.elouav.sim.model.Edge): EdgeDTO = EdgeDTO(
        id = edge.id,
        from = edge.from.value,
        to = edge.to.value,
        fromPort = edge.fromPort.value,
        toPort = edge.toPort.value,
        type = edge.type.name,
    )

    fun toScenarioDTO(scenario: Scenario): ScenarioDTO = ScenarioDTO(
        id = scenario.id.value,
        name = scenario.name,
        install = scenario.install,
        timeoutSec = scenario.timeoutSec,
        difficulty = scenario.difficulty,
        phases = scenario.phases.map { ph ->
            PhaseDTO(ph.id, ph.title, ph.expectedActions.map {
                ExpectedActionDTO(it.node, it.action, it.value)
            })
        },
        passingScore = scenario.passingScore,
    )

    fun toStepDTO(step: SimulationStep): SimulationStepDTO = SimulationStepDTO(
        node = step.resultNode.value,
        action = step.action.action,
        value = step.action.value,
        validationResult = step.validationResult::class.simpleName ?: "UNKNOWN",
        chain = step.chain.map { ChainLinkDTO(it.node.value, it.changed) },
        finalState = step.finalState.mapKeys { it.key.value }
            .mapValues { NodeStateDTO(it.value.mode.name, it.value.parameters) },
        stabilized = step.stabilized,
    )

    fun toVerdictDTO(verdict: Verdict): VerdictDTO = VerdictDTO(
        sessionId = verdict.sessionId,
        scenarioId = verdict.scenarioId,
        attempt = verdict.attempt,
        verdict = verdict.verdict.name,
        score = verdict.score.total,
        componentScores = verdict.score.componentScores,
        achievements = verdict.achievements,
        feedback = verdict.feedback.map {
            FeedbackDTO(it.actionId, it.type.name, it.text, it.hint)
        },
        aiUsed = verdict.aiUsed,
    )
}
