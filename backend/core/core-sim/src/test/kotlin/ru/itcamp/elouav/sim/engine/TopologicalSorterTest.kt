package ru.itcamp.elouav.sim.engine

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.sim.model.*
import ru.itcamp.elouav.shared.PortId

class TopologicalSorterTest {

    @Test
    fun `linear graph sorts correctly`() {
        val a = Node(NodeId("a"), "t", "A", outputs = listOf(PortId("o")))
        val b = Node(NodeId("b"), "t", "B", inputs = listOf(PortId("i")), outputs = listOf(PortId("o")))
        val c = Node(NodeId("c"), "t", "C", inputs = listOf(PortId("i")))
        val e1 = Edge("e1", NodeId("a"), NodeId("b"), PortId("o"), PortId("i"))
        val e2 = Edge("e2", NodeId("b"), NodeId("c"), PortId("o"), PortId("i"))
        val graph = Graph.of(listOf(a, b, c), listOf(e1, e2))

        val sorter = TopologicalSorter()
        val result = sorter.sort(graph)

        assert(result is ru.itcamp.elouav.shared.AppResult.Ok)
        val order = (result as ru.itcamp.elouav.shared.AppResult.Ok).value
        order[0] shouldBe NodeId("a")
        order[1] shouldBe NodeId("b")
        order[2] shouldBe NodeId("c")
    }

    @Test
    fun `cycle is detected`() {
        val a = Node(NodeId("a"), "t", "A", inputs = listOf(PortId("i")), outputs = listOf(PortId("o")))
        val b = Node(NodeId("b"), "t", "B", inputs = listOf(PortId("i")), outputs = listOf(PortId("o")))
        val e1 = Edge("e1", NodeId("a"), NodeId("b"), PortId("o"), PortId("i"))
        val e2 = Edge("e2", NodeId("b"), NodeId("a"), PortId("o"), PortId("i"))
        val graph = Graph.of(listOf(a, b), listOf(e1, e2))

        val sorter = TopologicalSorter()
        val result = sorter.sort(graph)

        assert(result is ru.itcamp.elouav.shared.AppResult.Err)
        val cycles = sorter.detectCycles(graph)
        assert(cycles.isNotEmpty())
    }
}

class FormulaEvaluatorTest {

    @Test
    fun `simple arithmetic`() {
        val eval = FormulaEvaluator()
        eval.evaluate("2.0 + 3.0", emptyMap()) shouldBe 5.0
        eval.evaluate("10.0 - 4.0", emptyMap()) shouldBe 6.0
        eval.evaluate("3.0 * 4.0", emptyMap()) shouldBe 12.0
        eval.evaluate("10.0 / 4.0", emptyMap()) shouldBe 2.5
    }

    @Test
    fun `variable substitution`() {
        val eval = FormulaEvaluator()
        val context = mapOf("power_percent" to 60.0, "input.flow_rate" to 120.0)
        val result = eval.evaluate("input.flow_rate * power_percent / 100", context)
        result shouldBe 72.0
    }

    @Test
    fun `parentheses`() {
        val eval = FormulaEvaluator()
        eval.evaluate("(2.0 + 3.0) * 4.0", emptyMap()) shouldBe 20.0
    }
}
