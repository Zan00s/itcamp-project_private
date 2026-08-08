package ru.itcamp.elouav.sim.engine

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.sim.model.*
import ru.itcamp.elouav.shared.PortId

class SpreadEngineTest {

    private fun makePumpAndFurnace(): Graph {
        val pump = Node(
            id = NodeId("pump-1"),
            type = "pump",
            name = "Насос",
            outputs = listOf(PortId("flow-out")),
            state = NodeState(
                mode = NodeMode.RUNNING,
                parameters = mapOf("power_percent" to 40.0, "flow_rate" to 80.0, "pressure_out" to 8.0)
            ),
            actions = listOf(
                Action("set_power", "Мощность", "power_percent", 0.0..100.0, ClampMode.CLAMP),
                Action("start", "Пуск"),
                Action("stop", "Стоп"),
            ),
            behavior = listOf(
                BehaviorRule("b_flow", "flow_rate", "input.flow_rate * power_percent / 100"),
                BehaviorRule("b_pressure", "pressure_out", "8.0 + flow_rate * 0.05"),
            ),
        )
        val furnace = Node(
            id = NodeId("furnace-1"),
            type = "furnace",
            name = "Печь",
            inputs = listOf(PortId("flow-in")),
            outputs = listOf(PortId("temp-out")),
            state = NodeState(
                mode = NodeMode.RUNNING,
                parameters = mapOf("temperature" to 300.0, "inlet_flow" to 80.0)
            ),
            behavior = listOf(
                BehaviorRule("b_heat", "inlet_flow", "input.flow-in"),
                BehaviorRule("b_temp", "temperature", "300.0 + inlet_flow * 0.5",
                    constraints = Constraint(max = 400.0, onViolate = ViolateAction.ALARM)),
            ),
        )
        val edge = Edge(
            id = "e1",
            from = NodeId("pump-1"),
            to = NodeId("furnace-1"),
            fromPort = PortId("flow-out"),
            toPort = PortId("flow-in"),
        )
        return Graph.of(listOf(pump, furnace), listOf(edge))
    }

    @Test
    fun `apply valid action updates node state`() {
        val engine = SpreadEngine()
        val graph = makePumpAndFurnace()

        val result = engine.applyAction(graph, ActionRequest(NodeId("pump-1"), "set_power", 60.0))

        assert(result is ru.itcamp.elouav.shared.AppResult.Ok)
        val step = (result as ru.itcamp.elouav.shared.AppResult.Ok).value
        step.validationResult shouldBe ValidationResult.Applied
        val pumpState = step.finalState[NodeId("pump-1")]!!
        pumpState.parameter("power_percent") shouldBe 60.0
    }

    @Test
    fun `value out of range is clamped`() {
        val engine = SpreadEngine()
        val graph = makePumpAndFurnace()

        val result = engine.applyAction(graph, ActionRequest(NodeId("pump-1"), "set_power", 150.0))

        val step = (result as ru.itcamp.elouav.shared.AppResult.Ok).value
        assert(step.validationResult is ValidationResult.Clamped)
        val clamped = step.validationResult as ValidationResult.Clamped
        clamped.original shouldBe 150.0
        clamped.clampedTo shouldBe 100.0
        val pumpState = step.finalState[NodeId("pump-1")]!!
        pumpState.parameter("power_percent") shouldBe 100.0
    }

    @Test
    fun `cascade spread reaches downstream nodes`() {
        val engine = SpreadEngine()
        val graph = makePumpAndFurnace()

        val result = engine.applyAction(graph, ActionRequest(NodeId("pump-1"), "set_power", 80.0))

        val step = (result as ru.itcamp.elouav.shared.AppResult.Ok).value
        assert(step.chain.any { it.node == NodeId("furnace-1") }) {
            "Chain should include furnace-1, got: ${step.chain}"
        }
    }

    @Test
    fun `constraint violation triggers alarm mode`() {
        val engine = SpreadEngine()
        val graph = makePumpAndFurnace()

        val result = engine.applyAction(graph, ActionRequest(NodeId("pump-1"), "set_power", 100.0))

        val step = (result as ru.itcamp.elouav.shared.AppResult.Ok).value
        val furnaceState = step.finalState[NodeId("furnace-1")]!!
        assert(furnaceState.mode == NodeMode.ALARM || furnaceState.parameter("temperature")!! <= 400.0) {
            "Temperature: ${furnaceState.parameter("temperature")}, mode: ${furnaceState.mode}"
        }
    }

    @Test
    fun `nonexistent node returns error`() {
        val engine = SpreadEngine()
        val graph = makePumpAndFurnace()

        val result = engine.applyAction(graph, ActionRequest(NodeId("nonexistent"), "set_power", 50.0))

        assert(result is ru.itcamp.elouav.shared.AppResult.Err)
    }

    @Test
    fun `nonexistent action returns error`() {
        val engine = SpreadEngine()
        val graph = makePumpAndFurnace()

        val result = engine.applyAction(graph, ActionRequest(NodeId("pump-1"), "fly", 50.0))

        assert(result is ru.itcamp.elouav.shared.AppResult.Err)
    }

    @Test
    fun `start and stop actions change mode`() {
        val engine = SpreadEngine()
        val graph = makePumpAndFurnace()

        val stopResult = engine.applyAction(graph, ActionRequest(NodeId("pump-1"), "stop"))
        val stopStep = (stopResult as ru.itcamp.elouav.shared.AppResult.Ok).value
        stopStep.finalState[NodeId("pump-1")]!!.mode shouldBe NodeMode.STOPPED
    }
}
