package ru.itcamp.elouav.scenario.validator

import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.sim.engine.TopologicalSorter
import ru.itcamp.elouav.sim.model.Graph

class GraphValidator(
    private val sorter: TopologicalSorter = TopologicalSorter(),
) {
    fun validate(graph: Graph): AppResult<Graph> {
        val errors = mutableListOf<String>()

        graph.edges.forEach { edge ->
            if (graph.node(edge.from) == null)
                errors.add("Edge ${edge.id}: source node ${edge.from} not found")
            if (graph.node(edge.to) == null)
                errors.add("Edge ${edge.id}: target node ${edge.to} not found")
        }

        graph.nodes.values.forEach { node ->
            node.actions.forEach { action ->
                val r = action.range
                if (r != null && r.start > r.endInclusive)
                    errors.add("Node ${node.id}: action ${action.id} has invalid range")
            }
            node.behavior.forEach { rule ->
                if (rule.formula.isBlank())
                    errors.add("Node ${node.id}: behavior rule ${rule.id} has empty formula")
                if (rule.output.isBlank())
                    errors.add("Node ${node.id}: behavior rule ${rule.id} has empty output")
            }
        }

        if (errors.isNotEmpty()) return AppResult.Err(errors.joinToString("; "))

        val sortResult = sorter.sort(graph)
        if (sortResult is AppResult.Err)
            return AppResult.Err("Graph validation failed: ${sortResult.message}")

        return AppResult.Ok(graph)
    }
}
