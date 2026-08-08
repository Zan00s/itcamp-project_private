package ru.itcamp.elouav.sim.port

import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.sim.model.Graph
import ru.itcamp.elouav.sim.model.SimulationEvent

interface GraphRepository {
    fun load(installName: String): AppResult<Graph>
    fun save(graph: Graph): AppResult<Unit>
}

interface EventPublisher {
    fun publish(sessionId: String, events: List<SimulationEvent>)
}
