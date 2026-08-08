package ru.itcamp.elouav.scenario.port

import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.ScenarioId
import ru.itcamp.elouav.scenario.model.Scenario

interface ScenarioRepository {
    fun load(scenarioId: ScenarioId): Result<Scenario>
    fun save(scenario: Scenario): Result<Unit>
    fun list(): Result<List<Scenario>>
    fun delete(scenarioId: ScenarioId): Result<Unit>
}
