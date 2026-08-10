package ru.itcamp.elouav.sim.engine

import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.Clock
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.sim.model.*
import ru.itcamp.elouav.sim.spi.NodeTypeRegistry

class SpreadEngine(
    private val evaluator: FormulaEvaluator = FormulaEvaluator(),
    private val nodeTypes: NodeTypeRegistry = NodeTypeRegistry(emptyList()),
    private val maxIterations: Int = 100,
) {
    private val sorter = TopologicalSorter()

    fun applyAction(graph: Graph, request: ActionRequest): AppResult<SimulationStep> {
        val node = graph.node(request.node)
            ?: return AppResult.Err("Node ${request.node} not found")

        val action = node.action(request.action)
            ?: return AppResult.Err("Action ${request.action} not found on node ${request.node}")

        val (clampedValue, validationResult) = if (request.value != null && action.param != null) {
            action.validate(request.value)
        } else {
            (request.value ?: 0.0) to ValidationResult.Applied
        }

        val newState = applyActionToState(node.state, action, clampedValue, request)
        val updatedGraph = graph.updateNode(request.node, newState)

        val (finalGraph, chain, events) = spread(updatedGraph, request.node)

        val stabilized = chain.isNotEmpty()

        return AppResult.Ok(SimulationStep(
            action = request,
            resultNode = request.node,
            validationResult = validationResult,
            chain = chain,
            events = events,
            finalState = finalGraph.nodes.mapValues { it.value.state },
            stabilized = stabilized,
        ))
    }

    private fun applyActionToState(
        state: NodeState,
        action: Action,
        value: Double,
        request: ActionRequest,
    ): NodeState {
        if (action.id == "start") return state.withMode(NodeMode.RUNNING)
        if (action.id == "stop") return state.withMode(NodeMode.STOPPED)
        if (action.param != null) return state.withParameter(action.param, value)
        return state
    }

    private fun spread(graph: Graph, startNode: NodeId): Triple<Graph, List<ChainLink>, List<SimulationEvent>> {
        val chain = mutableListOf<ChainLink>()
        val events = mutableListOf<SimulationEvent>()
        var currentGraph = graph
        var iteration = 0
        var changed = true

        val order = when (val r = sorter.sort(graph)) {
            is AppResult.Ok -> r.value
            is AppResult.Err -> graph.nodes.keys.toList()
        }
        val startIndex = order.indexOf(startNode).takeIf { it >= 0 } ?: 0
        val spreadOrder = order.drop(startIndex)

        while (changed && iteration < maxIterations) {
            changed = false
            iteration++

            for (nodeId in spreadOrder) {
                val node = currentGraph.node(nodeId) ?: continue
                if (node.state.mode == NodeMode.STOPPED) continue

                val inputContext = collectInputs(currentGraph, nodeId)
                val evalContext = inputContext + node.state.parameters

                val updatedParams = mutableMapOf<String, Double>()
                node.behavior.forEach { rule ->
                    val computed = evaluator.evaluate(rule.formula, evalContext)
                    val constrained = applyConstraints(computed, rule.constraints)
                    if (constrained != node.state.parameters[rule.output]) {
                        updatedParams[rule.output] = constrained
                    }
                }

                if (updatedParams.isNotEmpty()) {
                    val newState = node.state.copy(
                        parameters = node.state.parameters + updatedParams
                    )
                    currentGraph = currentGraph.updateNode(nodeId, newState)
                    chain.add(ChainLink(nodeId, updatedParams.keys.toList()))
                    events.add(SimulationEvent(nodeId, updatedParams, Clock.now()))
                    changed = true

                    updatedParams.forEach { (param, value) ->
                        val constraintResult = checkConstraints(nodeId, param, value, node.behavior, currentGraph)
                        if (constraintResult != null) {
                            currentGraph = constraintResult
                            val alarmNode = currentGraph.node(nodeId)
                            if (alarmNode != null && alarmNode.state.mode == NodeMode.ALARM) {
                                events.add(SimulationEvent(nodeId, mapOf("mode" to 1.0), Clock.now()))
                            }
                        }
                    }
                }
            }
        }

        return Triple(currentGraph, chain, events)
    }

    private fun collectInputs(graph: Graph, nodeId: NodeId): Map<String, Double> {
        val inputs = mutableMapOf<String, Double>()
        graph.upstream(nodeId).forEach { edge ->
            val sourceNode = graph.node(edge.from) ?: return@forEach
            val sourceValue = sourceNode.state.parameters[edge.fromPort.value]
                ?: return@forEach
            val scaled = sourceValue * edge.scale
            inputs["input.${edge.toPort.value}"] = scaled
        }
        return inputs
    }

    private fun applyConstraints(value: Double, constraints: Constraint?): Double {
        if (constraints == null) return value
        var result = value
        if (constraints.min != null && result < constraints.min) {
            result = when (constraints.onViolate) {
                ViolateAction.CLAMP -> constraints.min
                ViolateAction.ALARM -> result
                ViolateAction.IGNORE -> result
            }
        }
        if (constraints.max != null && result > constraints.max) {
            result = when (constraints.onViolate) {
                ViolateAction.CLAMP -> constraints.max
                ViolateAction.ALARM -> result
                ViolateAction.IGNORE -> result
            }
        }
        return result
    }

    private fun checkConstraints(
        nodeId: NodeId,
        param: String,
        value: Double,
        behavior: List<BehaviorRule>,
        graph: Graph,
    ): Graph? {
        val rule = behavior.find { it.output == param } ?: return null
        val constraint = rule.constraints ?: return null
        val result = constraint.check(value)
        if (result is ConstraintResult.Violated && constraint.onViolate == ViolateAction.ALARM) {
            val node = graph.node(nodeId)
            if (node != null && node.state.mode != NodeMode.ALARM) {
                return graph.updateNode(nodeId, node.state.withMode(NodeMode.ALARM))
            }
        }
        return null
    }
}
