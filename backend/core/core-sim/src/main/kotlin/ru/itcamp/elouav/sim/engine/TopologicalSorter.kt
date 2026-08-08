package ru.itcamp.elouav.sim.engine

import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.sim.model.Graph

class TopologicalSorter {

    fun sort(graph: Graph): AppResult<List<NodeId>> {
        val cycles = detectCycles(graph)
        if (cycles.isNotEmpty()) {
            return AppResult.Err("Graph has cycles: ${cycles.joinToString("; ") { it.joinToString("->") }}")
        }

        val inDegree = graph.nodes.keys.associateWith { 0 }.toMutableMap()
        graph.edges.forEach { edge ->
            inDegree[edge.to] = (inDegree[edge.to] ?: 0) + 1
        }

        val queue = ArrayDeque<NodeId>().apply {
            inDegree.filter { it.value == 0 }.keys.forEach { addLast(it) }
        }

        val sorted = mutableListOf<NodeId>()
        while (queue.isNotEmpty()) {
            val node = queue.removeFirst()
            sorted.add(node)
            graph.downstream(node).forEach { edge ->
                val newDegree = (inDegree[edge.to] ?: 1) - 1
                inDegree[edge.to] = newDegree
                if (newDegree == 0) queue.addLast(edge.to)
            }
        }

        return if (sorted.size == graph.nodes.size) AppResult.Ok(sorted)
        else AppResult.Err("Topological sort incomplete (possible cycle)")
    }

    fun detectCycles(graph: Graph): List<List<NodeId>> {
        val visited = mutableSetOf<NodeId>()
        val recursionStack = mutableSetOf<NodeId>()
        val cycles = mutableListOf<List<NodeId>>()
        val path = mutableListOf<NodeId>()

        fun dfs(node: NodeId) {
            if (node in recursionStack) {
                val cycleStart = path.indexOf(node)
                cycles.add(path.subList(cycleStart, path.size).toList() + node)
                return
            }
            if (node in visited) return

            visited.add(node)
            recursionStack.add(node)
            path.add(node)

            graph.downstream(node).forEach { edge -> dfs(edge.to) }

            recursionStack.remove(node)
            path.removeLast()
        }

        graph.nodes.keys.forEach { dfs(it) }
        return cycles
    }
}
