package ru.itcamp.elouav.sim.model

import ru.itcamp.elouav.shared.EdgeId
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.shared.PortId
import ru.itcamp.elouav.shared.AppResult

data class Graph(
    val nodes: Map<NodeId, Node>,
    val edges: List<Edge>,
    val initialState: Map<NodeId, NodeState> = emptyMap(),
) {
    fun node(id: NodeId): Node? = nodes[id]

    fun downstream(nodeId: NodeId): List<Edge> = edges.filter { it.from == nodeId }

    fun upstream(nodeId: NodeId): List<Edge> = edges.filter { it.to == nodeId }

    fun updateNode(nodeId: NodeId, newState: NodeState): Graph {
        val updatedNode = nodes[nodeId]?.copy(state = newState)
            ?: return this
        return copy(nodes = nodes + (nodeId to updatedNode))
    }

    companion object {
        fun of(nodes: List<Node>, edges: List<Edge>): Graph = Graph(
            nodes = nodes.associateBy { it.id },
            edges = edges,
        )
    }
}

data class SimulationEvent(
    val sourceNode: NodeId,
    val changedParams: Map<String, Double>,
    val timestamp: java.time.Instant = ru.itcamp.elouav.shared.Clock.now(),
)

data class ChainLink(
    val node: NodeId,
    val changed: List<String>,
)

data class SimulationStep(
    val action: ActionRequest,
    val resultNode: NodeId,
    val validationResult: ValidationResult,
    val chain: List<ChainLink>,
    val events: List<SimulationEvent>,
    val finalState: Map<NodeId, NodeState>,
    val stabilized: Boolean,
)

data class ActionRequest(
    val node: NodeId,
    val action: String,
    val value: Double? = null,
)
