package ru.itcamp.elouav.app.ai

import ru.itcamp.elouav.ai.model.AdaptiveScenario
import ru.itcamp.elouav.ai.model.AIVerdict
import ru.itcamp.elouav.ai.model.JudgeRequest
import ru.itcamp.elouav.ai.model.RiskForecast
import ru.itcamp.elouav.ai.port.AdaptiveGenerator
import ru.itcamp.elouav.ai.port.ErrorSummary
import ru.itcamp.elouav.ai.port.LLMJudge
import ru.itcamp.elouav.ai.port.RiskPredictor
import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.sim.model.NodeState
import ru.itcamp.elouav.ai.port.AvailableAction

class RequestAIVerdictUseCase(
    private val judge: LLMJudge,
) {
    suspend fun execute(request: JudgeRequest): AppResult<AIVerdict> = judge.judge(request)
}

class ForecastRiskUseCase(
    private val predictor: RiskPredictor,
) {
    fun execute(
        sessionId: String,
        currentPhase: String,
        states: Map<NodeId, NodeState>,
        availableActions: List<AvailableAction>,
    ): AppResult<RiskForecast> = predictor.forecast(sessionId, currentPhase, states, availableActions)
}

class GenerateAdaptiveScenarioUseCase(
    private val generator: AdaptiveGenerator,
) {
    suspend fun execute(
        errors: List<ErrorSummary>,
        scenarioId: String,
        sessionId: String,
    ): AppResult<AdaptiveScenario> = generator.generate(errors, scenarioId, sessionId)
}
