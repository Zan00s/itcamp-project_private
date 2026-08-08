package ru.itcamp.elouav.scoring.model

enum class SourceType { RULES, AI }

enum class VerdictType { PASSED, FAILED, TIMEOUT }

enum class FeedbackType { SEQUENCE_ERROR, OUT_OF_RANGE, SAFETY_VIOLATION, TIMING, SEMANTIC }

data class ScoreComponent(
    val id: String,
    val weight: Double,
    val source: SourceType = SourceType.RULES,
)

data class ScoringProfile(
    val totalMax: Int = 100,
    val components: List<ScoreComponent> = listOf(
        ScoreComponent("correctness", 0.4),
        ScoreComponent("sequence", 0.25),
        ScoreComponent("efficiency", 0.15),
        ScoreComponent("safety", 0.1),
        ScoreComponent("timing", 0.1),
    ),
) {
    fun aiProfile(): ScoringProfile = ScoringProfile(
        totalMax = totalMax,
        components = listOf(
            ScoreComponent("correctness", 0.35, SourceType.RULES),
            ScoreComponent("sequence", 0.2, SourceType.RULES),
            ScoreComponent("efficiency", 0.1, SourceType.RULES),
            ScoreComponent("safety", 0.1, SourceType.RULES),
            ScoreComponent("semantics", 0.15, SourceType.AI),
            ScoreComponent("reasoning", 0.1, SourceType.AI),
        ),
    )

    fun fallbackProfile(): ScoringProfile {
        val ruleComponents = components.filter { it.source == SourceType.RULES }
        val totalRuleWeight = ruleComponents.sumOf { it.weight }
        val scale = 1.0 / totalRuleWeight
        return ScoringProfile(
            totalMax = totalMax,
            components = ruleComponents.map { it.copy(weight = it.weight * scale) },
        )
    }
}

data class ScoreBreakdown(
    val total: Int,
    val componentScores: Map<String, Double>,
)

data class Feedback(
    val actionId: String?,
    val type: FeedbackType,
    val text: String,
    val hint: String?,
)

data class Verdict(
    val sessionId: String,
    val scenarioId: String,
    val attempt: Int,
    val computedAt: java.time.Instant,
    val verdict: VerdictType,
    val score: ScoreBreakdown,
    val achievements: List<String> = emptyList(),
    val feedback: List<Feedback> = emptyList(),
    val aiUsed: Boolean = false,
)
