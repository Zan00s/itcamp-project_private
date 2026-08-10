package ru.itcamp.elouav.ai.port

import ru.itcamp.elouav.ai.model.AdaptiveScenario
import ru.itcamp.elouav.ai.model.AIVerdict
import ru.itcamp.elouav.ai.model.JudgeRequest
import ru.itcamp.elouav.ai.model.RiskForecast
import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.sim.model.NodeState
import ru.itcamp.elouav.shared.NodeId

interface LLMJudge {
    suspend fun judge(request: JudgeRequest): AppResult<AIVerdict>
}

interface LLMChat {
    suspend fun chat(systemPrompt: String, userPrompt: String): AppResult<String>
    suspend fun chat(systemPrompt: String, userPrompt: String, jsonMode: Boolean): AppResult<String>
}

interface RiskPredictor {
    fun forecast(
        sessionId: String,
        currentPhase: String,
        states: Map<NodeId, NodeState>,
        availableActions: List<AvailableAction>,
    ): AppResult<RiskForecast>
}

data class AvailableAction(
    val node: String,
    val action: String,
    val valueRange: ClosedRange<Double>?,
)

interface AdaptiveGenerator {
    suspend fun generate(
        errors: List<ErrorSummary>,
        scenarioId: String,
        sessionId: String,
    ): AppResult<AdaptiveScenario>
}

data class ErrorSummary(
    val type: String,
    val phase: String,
    val node: String,
    val count: Int,
    val description: String,
)

interface VerdictCache {
    fun get(key: String): AIVerdict?
    fun put(key: String, verdict: AIVerdict)
}
