package ru.itcamp.elouav.infra.db

import ru.itcamp.elouav.scenario.model.Scenario
import ru.itcamp.elouav.scenario.model.Operator
import ru.itcamp.elouav.scenario.model.Condition
import ru.itcamp.elouav.scenario.model.ExpectedAction
import ru.itcamp.elouav.scenario.model.Hint
import ru.itcamp.elouav.scenario.model.Phase
import ru.itcamp.elouav.scenario.model.ScenarioSetup
import ru.itcamp.elouav.scenario.port.ScenarioRepository
import ru.itcamp.elouav.audit.model.AuditRecord
import ru.itcamp.elouav.audit.model.ActionResult
import ru.itcamp.elouav.audit.model.EventType
import ru.itcamp.elouav.audit.port.AuditRepository
import ru.itcamp.elouav.audit.port.AuditReader
import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.ScenarioId
import ru.itcamp.elouav.shared.SessionId
import ru.itcamp.elouav.sim.model.Graph
import ru.itcamp.elouav.sim.model.Node
import ru.itcamp.elouav.sim.model.Edge
import ru.itcamp.elouav.sim.model.NodeState
import ru.itcamp.elouav.sim.model.NodeMode
import ru.itcamp.elouav.sim.model.Action
import ru.itcamp.elouav.sim.model.BehaviorRule
import ru.itcamp.elouav.sim.model.Constraint
import ru.itcamp.elouav.sim.model.EdgeType
import ru.itcamp.elouav.sim.model.ViolateAction
import ru.itcamp.elouav.sim.port.GraphRepository
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.shared.PortId
import java.util.concurrent.ConcurrentHashMap

class InMemoryGraphRepository(
    private val installs: ConcurrentHashMap<String, Graph> = ConcurrentHashMap(),
) : GraphRepository {

    init {
        put(defaultElouAvGraph())
    }

    fun put(graph: Graph) {
        installs["ELOU-AV"] = graph
    }

    override fun load(installName: String): AppResult<Graph> {
        return installs[installName]?.let { AppResult.Ok(it) }
            ?: AppResult.Err("Install '$installName' not found")
    }

    override fun save(graph: Graph): AppResult<Unit> {
        installs["ELOU-AV"] = graph
        return AppResult.Ok(Unit)
    }

    companion object {
        fun defaultElouAvGraph(): Graph {
            val feedPump = Node(
                id = NodeId("feed_pump"),
                type = "feed_pump",
                name = "Н-82 Насос подачи",
                outputs = listOf(PortId("flow-out")),
                state = NodeState(
                    mode = NodeMode.STOPPED,
                    parameters = mapOf(
                        "power_percent" to 0.0,
                        "flow_rate" to 0.0,
                        "pressure_out" to 0.0,
                    ),
                ),
                actions = listOf(
                    Action("set_power", "Установить мощность, %", "power_percent", 0.0..100.0),
                    Action("start", "Пуск"),
                    Action("stop", "Остановка"),
                ),
                behavior = listOf(
                    BehaviorRule("b_flow", "flow_rate", "power_percent * 2.0",
                        deps = listOf("power_percent")),
                    BehaviorRule("b_pressure", "pressure_out", "8.0 + flow_rate * 0.02",
                        deps = listOf("flow_rate")),
                ),
                paramLabels = mapOf(
                    "power_percent" to "Мощность, %",
                    "flow_rate" to "Расход, м³/ч",
                    "pressure_out" to "Давление, бар",
                ),
            )

            val preheater = Node(
                id = NodeId("preheater"),
                type = "preheater",
                name = "А-19 Теплообменник",
                inputs = listOf(PortId("flow-in")),
                outputs = listOf(PortId("flow-out"), PortId("temp-out")),
                state = NodeState(
                    mode = NodeMode.STOPPED,
                    parameters = mapOf("inlet_flow" to 0.0, "temperature" to 20.0),
                ),
                actions = listOf(
                    Action("set_temp", "Установить температуру, °C", "temperature", 20.0..180.0),
                    Action("start", "Пуск"),
                    Action("stop", "Остановка"),
                ),
                behavior = listOf(
                    BehaviorRule("b_iflow", "inlet_flow", "input.flow-in",
                        deps = listOf("input.flow-in")),
                    BehaviorRule("b_temp", "temperature", "20.0 + inlet_flow * 2.0",
                        deps = listOf("inlet_flow"),
                        constraints = Constraint(max = 180.0, onViolate = ViolateAction.ALARM)),
                ),
                paramLabels = mapOf(
                    "inlet_flow" to "Входной расход, м³/ч",
                    "temperature" to "Температура, °C",
                ),
            )

            val furnace = Node(
                id = NodeId("furnace"),
                type = "furnace",
                name = "Печь подогрева",
                inputs = listOf(PortId("flow-in")),
                outputs = listOf(PortId("temp-out")),
                state = NodeState(
                    mode = NodeMode.STOPPED,
                    parameters = mapOf("temperature" to 20.0, "inlet_flow" to 0.0),
                ),
                actions = listOf(
                    Action("set_temp", "Установить температуру, °C", "temperature", 20.0..400.0),
                    Action("start", "Пуск"),
                    Action("stop", "Остановка"),
                ),
                behavior = listOf(
                    BehaviorRule("b_iflow", "inlet_flow", "input.flow-in",
                        deps = listOf("input.flow-in")),
                    BehaviorRule("b_temp", "temperature", "300.0 + inlet_flow * 0.5",
                        deps = listOf("inlet_flow"),
                        constraints = Constraint(max = 400.0, onViolate = ViolateAction.ALARM)),
                ),
                paramLabels = mapOf(
                    "temperature" to "Температура, °C",
                    "inlet_flow" to "Входной расход, м³/ч",
                ),
            )

            val dehydrator = Node(
                id = NodeId("dehydrator"),
                type = "electrodehydrator",
                name = "Э-1 Электродегидратор",
                inputs = listOf(PortId("flow-in"), PortId("temp-in")),
                outputs = listOf(PortId("flow-out"), PortId("quality-out"), PortId("drain-out")),
                state = NodeState(
                    mode = NodeMode.STOPPED,
                    parameters = mapOf(
                        "inlet_flow" to 0.0,
                        "inlet_temp" to 20.0,
                        "water_content" to 5.0,
                        "salt_mg_l" to 50.0,
                    ),
                ),
                actions = listOf(
                    Action("start", "Пуск"),
                    Action("stop", "Остановка"),
                ),
                behavior = listOf(
                    BehaviorRule("b_iflow", "inlet_flow", "input.flow-in"),
                    BehaviorRule("b_itemp", "inlet_temp", "input.temp-in"),
                    BehaviorRule("b_water", "water_content", "5.0 - inlet_temp * 0.01",
                        constraints = Constraint(min = 0.0, onViolate = ViolateAction.CLAMP)),
                    BehaviorRule("b_salt", "salt_mg_l", "50.0 - inlet_temp * 0.1",
                        constraints = Constraint(min = 0.0, onViolate = ViolateAction.CLAMP)),
                ),
                paramLabels = mapOf(
                    "inlet_flow" to "Входной расход, м³/ч",
                    "inlet_temp" to "Входная температура, °C",
                    "water_content" to "Содержание воды, %",
                    "salt_mg_l" to "Содержание солей, мг/л",
                ),
            )

            val tank = Node(
                id = NodeId("tank"),
                type = "tank",
                name = "Е-16 Ёмкость",
                inputs = listOf(PortId("drain-in")),
                outputs = listOf(PortId("flow-out")),
                state = NodeState(
                    mode = NodeMode.STOPPED,
                    parameters = mapOf("level" to 0.0, "drain_flow" to 0.0),
                ),
                actions = listOf(
                    Action("start", "Пуск"),
                    Action("stop", "Остановка"),
                ),
                behavior = listOf(
                    BehaviorRule("b_drain", "drain_flow", "input.drain-in"),
                    BehaviorRule("b_level", "level", "drain_flow * 0.5",
                        constraints = Constraint(max = 100.0, onViolate = ViolateAction.ALARM)),
                ),
                paramLabels = mapOf(
                    "level" to "Уровень, %",
                    "drain_flow" to "Расход слива, м³/ч",
                ),
            )

            val regulator = Node(
                id = NodeId("regulator"),
                type = "regulator",
                name = "Р-11 Регулятор",
                inputs = listOf(PortId("flow-in")),
                state = NodeState(
                    mode = NodeMode.STOPPED,
                    parameters = mapOf("outlet_flow" to 0.0, "valve_pos" to 0.0),
                ),
                actions = listOf(
                    Action("set_valve", "Положение клапана, %", "valve_pos", 0.0..100.0),
                    Action("start", "Пуск"),
                    Action("stop", "Остановка"),
                ),
                behavior = listOf(
                    BehaviorRule("b_flow", "outlet_flow", "input.flow-in * valve_pos / 100.0",
                        deps = listOf("input.flow-in", "valve_pos")),
                ),
                paramLabels = mapOf(
                    "outlet_flow" to "Выходной расход, м³/ч",
                    "valve_pos" to "Положение клапана, %",
                ),
            )

            val output = Node(
                id = NodeId("output"),
                type = "output",
                name = "Выходной поток",
                inputs = listOf(PortId("flow-in"), PortId("quality-in")),
                state = NodeState(
                    mode = NodeMode.STOPPED,
                    parameters = mapOf("flow_rate" to 0.0, "water_content" to 5.0, "salt_mg_l" to 50.0),
                ),
                behavior = listOf(
                    BehaviorRule("b_flow", "flow_rate", "input.flow-in"),
                    BehaviorRule("b_water", "water_content", "input.quality-in"),
                    BehaviorRule("b_salt", "salt_mg_l", "input.quality-in"),
                ),
                paramLabels = mapOf(
                    "flow_rate" to "Расход, м³/ч",
                    "water_content" to "Содержание воды, %",
                    "salt_mg_l" to "Содержание солей, мг/л",
                ),
            )

            val edges = listOf(
                Edge("e1", NodeId("feed_pump"), NodeId("preheater"), PortId("flow-out"), PortId("flow-in")),
                Edge("e2", NodeId("preheater"), NodeId("dehydrator"), PortId("flow-out"), PortId("flow-in")),
                Edge("e3", NodeId("preheater"), NodeId("dehydrator"), PortId("temp-out"), PortId("temp-in")),
                Edge("e4", NodeId("dehydrator"), NodeId("output"), PortId("flow-out"), PortId("flow-in")),
                Edge("e5", NodeId("dehydrator"), NodeId("output"), PortId("quality-out"), PortId("quality-in")),
                Edge("e6", NodeId("dehydrator"), NodeId("tank"), PortId("drain-out"), PortId("drain-in")),
                Edge("e7", NodeId("tank"), NodeId("regulator"), PortId("flow-out"), PortId("flow-in")),
                Edge("e8", NodeId("preheater"), NodeId("furnace"), PortId("flow-out"), PortId("flow-in")),
            )

            return Graph.of(listOf(feedPump, preheater, furnace, dehydrator, tank, regulator, output), edges)
        }
    }
}

class InMemoryScenarioRepository : ScenarioRepository {
    private val scenarios = ConcurrentHashMap<ScenarioId, Scenario>()

    init {
        put(defaultStartupScenario())
        put(defaultShutdownScenario())
        put(defaultEmergencyScenario())
    }

    fun put(scenario: Scenario) {
        scenarios[scenario.id] = scenario
    }

    override fun load(scenarioId: ScenarioId): AppResult<Scenario> =
        scenarios[scenarioId]?.let { AppResult.Ok(it) }
            ?: AppResult.Err("Scenario '${scenarioId.value}' not found")

    override fun save(scenario: Scenario): AppResult<Unit> {
        scenarios[scenario.id] = scenario
        return AppResult.Ok(Unit)
    }

    override fun list(): AppResult<List<Scenario>> =
        AppResult.Ok(scenarios.values.toList())

    override fun delete(scenarioId: ScenarioId): AppResult<Unit> {
        scenarios.remove(scenarioId)
        return AppResult.Ok(Unit)
    }

    private fun defaultStartupScenario(): Scenario = Scenario(
        id = ScenarioId("startup"),
        name = "Пуск установки",
        install = "ELOU-AV",
        timeoutSec = 1800,
        difficulty = 2,
        successConditions = listOf(
            Condition(node = "output", param = "water_content", op = Operator.LESS_THAN, value = 0.5),
            Condition(node = "output", param = "salt_mg_l", op = Operator.LESS_THAN, value = 5.0),
        ),
        failureConditions = listOf(
            Condition(node = "preheater", param = "temperature", op = Operator.GREATER_THAN, value = 180.0, critical = true),
            Condition(condition = "alarm_activated", critical = true),
        ),
        phases = listOf(
            Phase("ph1", "Проверка готовности", listOf(
                ExpectedAction("feed_pump", "start"),
                ExpectedAction("feed_pump", "set_power", 20.0, rampOk = listOf(10.0, 30.0)),
            )),
            Phase("ph2", "Выход на рабочий режим", listOf(
                ExpectedAction("preheater", "start"),
                ExpectedAction("feed_pump", "set_power", 60.0, rampOk = listOf(40.0, 80.0)),
                ExpectedAction("preheater", "set_temp", 120.0),
            )),
            Phase("ph3", "Стабилизация", listOf(
                ExpectedAction("dehydrator", "start"),
            )),
        ),
        bankHints = listOf(
            Hint("ph1", "Сначала запустите насос подачи Н-82 и установите начальную мощность 20%."),
            Hint("ph2", "Включите теплообменник А-19, поднимите мощность насоса до 60% и установите температуру подогрева 120°C."),
            Hint("ph3", "Запустите электродегидратор Э-1 для обессоливания нефти."),
        ),
    )

    private fun defaultShutdownScenario(): Scenario = Scenario(
        id = ScenarioId("shutdown"),
        name = "Остановка установки",
        install = "ELOU-AV",
        timeoutSec = 1200,
        difficulty = 1,
        successConditions = listOf(
            Condition(node = "feed_pump", param = "power_percent", op = Operator.LESS_THAN, value = 1.0),
            Condition(node = "furnace", param = "temperature", op = Operator.LESS_THAN, value = 50.0),
        ),
        failureConditions = listOf(
            Condition(node = "furnace", param = "temperature", op = Operator.GREATER_THAN, value = 400.0, critical = true),
        ),
        phases = listOf(
            Phase("ph1", "Снижение нагрузки", listOf(
                ExpectedAction("furnace", "set_temp", 50.0),
                ExpectedAction("feed_pump", "set_power", 0.0),
            )),
            Phase("ph2", "Остановка", listOf(
                ExpectedAction("furnace", "stop"),
                ExpectedAction("feed_pump", "stop"),
            )),
        ),
        bankHints = listOf(
            Hint("ph1", "Плавно снизьте температуру печи и мощность насоса."),
            Hint("ph2", "Остановите оборудование после снижения параметров."),
        ),
    )

    private fun defaultEmergencyScenario(): Scenario = Scenario(
        id = ScenarioId("emergency_pump_failure"),
        name = "Нештатная ситуация: отказ насоса",
        install = "ELOU-AV",
        timeoutSec = 600,
        difficulty = 3,
        successConditions = listOf(
            Condition(node = "furnace", param = "temperature", op = Operator.LESS_THAN, value = 100.0),
        ),
        failureConditions = listOf(
            Condition(node = "furnace", param = "temperature", op = Operator.GREATER_THAN, value = 400.0, critical = true),
            Condition(condition = "alarm_activated", critical = true),
        ),
        phases = listOf(
            Phase("ph1", "Реакция на отказ", listOf(
                ExpectedAction("furnace", "set_temp", 50.0),
                ExpectedAction("furnace", "stop"),
            )),
        ),
        bankHints = listOf(
            Hint("ph1", "Насос остановлен! Срочно снизьте температуру печи для предотвращения перегрева."),
        ),
    )
}

class InMemoryAuditRepository : AuditRepository, AuditReader {
    private val records = ConcurrentHashMap<SessionId, MutableList<AuditRecord>>()

    override fun append(record: AuditRecord): AppResult<Unit> {
        records.getOrPut(record.sessionId) { mutableListOf() }.add(record)
        return AppResult.Ok(Unit)
    }

    override fun readBySession(sessionId: SessionId): AppResult<List<AuditRecord>> =
        AppResult.Ok(records[sessionId]?.toList() ?: emptyList())
}
