package ru.itcamp.elouav.app.scenario

import ru.itcamp.elouav.scenario.model.Scenario
import ru.itcamp.elouav.scenario.port.ScenarioRepository
import ru.itcamp.elouav.scenario.validator.GraphValidator
import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.ScenarioId
import ru.itcamp.elouav.sim.model.Graph

class ValidateGraphUseCase(
    private val validator: GraphValidator = GraphValidator(),
) {
    fun execute(graph: Graph): AppResult<Graph> = validator.validate(graph)
}

class LoadScenarioUseCase(
    private val repo: ScenarioRepository,
) {
    fun execute(id: ScenarioId): AppResult<Scenario> = repo.load(id)
}

class ListScenariosUseCase(
    private val repo: ScenarioRepository,
) {
    fun execute(): AppResult<List<Scenario>> = repo.list()
}

class SaveScenarioUseCase(
    private val repo: ScenarioRepository,
) {
    fun execute(scenario: Scenario): AppResult<Unit> {
        if (scenario.name.isBlank()) {
            return AppResult.Err("Имя сценария не может быть пустым")
        }
        if (scenario.phases.isEmpty()) {
            return AppResult.Err("Сценарий должен содержать хотя бы одну фазу")
        }
        return repo.save(scenario)
    }
}

class DeleteScenarioUseCase(
    private val repo: ScenarioRepository,
) {
    fun execute(id: ScenarioId): AppResult<Unit> = repo.delete(id)
}
