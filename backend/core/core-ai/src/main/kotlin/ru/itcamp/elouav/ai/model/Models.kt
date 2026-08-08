package ru.itcamp.elouav.ai.model

import java.time.Instant

enum class Semantics { VALID, VALID_ALT, WRONG, DANGEROUS }

enum class RiskCategory { SAFE, CAUTION, DANGEROUS }

data class AIVerdict(
    val grade: Int,
    val semantics: Semantics,
    val confidence: Double,
    val reason: String,
    val model: String,
    val promptVersion: Int,
    val latencyMs: Long,
    val archived: Boolean = true,
)

data class RiskItem(
    val node: String,
    val action: String,
    val valueRange: ClosedRange<Double>,
    val riskScore: Double,
    val category: RiskCategory,
    val reason: String,
    val recommendedRange: ClosedRange<Double>? = null,
)

data class RiskForecast(
    val sessionId: String,
    val timestamp: Instant,
    val currentPhase: String,
    val riskAssessment: List<RiskItem>,
    val model: String,
    val latencyMs: Long,
)

data class AdaptiveScenario(
    val derivedFrom: String,
    val sessionIdOriginal: String,
    val focusPhases: List<String>,
    val initialStateOverride: Map<String, Map<String, Any>>,
    val difficulty: Int,
    val hintBoost: Boolean,
    val reasoning: String,
    val generatedAt: Instant,
    val model: String,
    val promptVersion: Int,
)

data class JudgeRequest(
    val scenarioGoal: String,
    val currentPhase: String,
    val expected: ExpectedActionContext?,
    val actual: ActualActionContext,
    val chain: List<ChainLinkContext>,
    val stateBefore: Map<String, Map<String, Double>>,
    val stateAfter: Map<String, Map<String, Double>>,
)

data class ExpectedActionContext(
    val node: String,
    val action: String,
    val value: Double?,
    val rampOk: List<Double>?,
)

data class ActualActionContext(
    val node: String,
    val action: String,
    val value: Double?,
    val result: String,
)

data class ChainLinkContext(
    val node: String,
    val changed: List<String>,
)
