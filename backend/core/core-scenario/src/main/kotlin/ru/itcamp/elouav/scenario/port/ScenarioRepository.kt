package ru.itcamp.elouav.scenario.port

import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.ScenarioId
import ru.itcamp.elouav.scenario.model.Scenario

interface ScenarioRepository {
    fun load(scenarioId: ScenarioId): AppResult<Scenario>
    fun save(scenario: Scenario): AppResult<Unit>
    fun list(): AppResult<List<Scenario>>
    fun delete(scenarioId: ScenarioId): AppResult<Unit>
}
