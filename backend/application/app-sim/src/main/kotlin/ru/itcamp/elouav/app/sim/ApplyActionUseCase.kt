package ru.itcamp.elouav.app.sim

import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.SessionId
import ru.itcamp.elouav.sim.engine.SpreadEngine
import ru.itcamp.elouav.sim.model.ActionRequest
import ru.itcamp.elouav.sim.model.Graph
import ru.itcamp.elouav.sim.model.SimulationStep

class ApplyActionUseCase(
    private val engine: SpreadEngine = SpreadEngine(),
) {
    fun execute(graph: Graph, request: ActionRequest): AppResult<SimulationStep> {
        return engine.applyAction(graph, request)
    }
}
