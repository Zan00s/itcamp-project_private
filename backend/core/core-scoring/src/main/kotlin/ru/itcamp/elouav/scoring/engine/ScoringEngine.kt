package ru.itcamp.elouav.scoring.engine

import ru.itcamp.elouav.audit.model.AuditRecord
import ru.itcamp.elouav.audit.model.EventType
import ru.itcamp.elouav.audit.model.ActionResult
import ru.itcamp.elouav.scenario.model.Scenario
import ru.itcamp.elouav.scoring.model.*
import ru.itcamp.elouav.scoring.spi.ScoringComponent
import ru.itcamp.elouav.scoring.spi.ScoringContext
import ru.itcamp.elouav.shared.Clock
import ru.itcamp.elouav.shared.SessionId

class ScoringEngine(
    private val components: List<ScoringComponent> = listOf(
        CorrectnessComponent(),
        SequenceComponent(),
        EfficiencyComponent(),
        SafetyComponent(),
        TimingComponent(),
    ),
) {
    fun score(
        sessionId: SessionId,
        scenarioId: String,
        attempt: Int,
        auditRecords: List<AuditRecord>,
        scenario: Scenario,
        sessionDurationSec: Long,
        hadCriticalFailure: Boolean,
        hadTimeout: Boolean = false,
        aiScores: Map<String, Double> = emptyMap(),
        profile: ScoringProfile = ScoringProfile(),
    ): Verdict {
        val ctx = ScoringContext(auditRecords, scenario, sessionDurationSec, hadCriticalFailure)

        val componentScores = mutableMapOf<String, Double>()
        profile.components.forEach { comp ->
            val score = if (comp.source == SourceType.AI) {
                aiScores[comp.id] ?: run {
                    val fallback = profile.fallbackProfile()
                    fallback.components.find { it.id == comp.id }?.let { fbComp ->
                        components.find { it.id() == comp.id }?.calculate(ctx)
                    } ?: 0.0
                }
            } else {
                components.find { it.id() == comp.id }?.calculate(ctx) ?: 0.0
            }
            componentScores[comp.id] = score * comp.weight
        }

        val total = (componentScores.values.sum() * profile.totalMax).toInt()
            .coerceIn(0, profile.totalMax)

        val verdictType = when {
            hadTimeout -> VerdictType.TIMEOUT
            hadCriticalFailure -> VerdictType.FAILED
            total >= scenario.passingScore -> VerdictType.PASSED
            else -> VerdictType.FAILED
        }

        val feedback = generateFeedback(auditRecords, scenario)

        return Verdict(
            sessionId = sessionId.value,
            scenarioId = scenarioId,
            attempt = attempt,
            computedAt = Clock.now(),
            verdict = verdictType,
            score = ScoreBreakdown(total, componentScores),
            feedback = feedback,
            aiUsed = aiScores.isNotEmpty(),
        )
    }

    private fun generateFeedback(
        auditRecords: List<AuditRecord>,
        scenario: Scenario,
    ): List<Feedback> {
        val feedback = mutableListOf<Feedback>()

        auditRecords
            .filter { it.eventType == EventType.ACTION && it.data?.result == ActionResult.OUT_OF_RANGE }
            .forEach { rec ->
                feedback.add(Feedback(
                    actionId = rec.actionId?.value,
                    type = FeedbackType.OUT_OF_RANGE,
                    text = "Значение ${rec.data?.value} вне диапазона для узла ${rec.data?.node}",
                    hint = "Проверьте допустимые пределы параметра",
                ))
            }

        auditRecords
            .filter { it.eventType == EventType.ALARM }
            .forEach { rec ->
                feedback.add(Feedback(
                    actionId = rec.actionId?.value,
                    type = FeedbackType.SAFETY_VIOLATION,
                    text = "Сработала аварийная защита",
                    hint = "Проверьте последовательность действий",
                ))
            }

        val userActions = auditRecords.filter { it.eventType == EventType.ACTION }
        scenario.phases.forEachIndexed { idx, phase ->
            val phaseActions = userActions.filter { rec ->
                val nodeInPhase = phase.expectedActions.any { it.node == rec.data?.node?.value }
                nodeInPhase
            }
            if (phaseActions.isEmpty() && phase.expectedActions.isNotEmpty()) {
                feedback.add(Feedback(
                    actionId = null,
                    type = FeedbackType.SEQUENCE_ERROR,
                    text = "Фаза '${phase.title}' не была выполнена",
                    hint = scenario.bankHints.find { it.key == phase.id }?.text,
                ))
            }
        }

        return feedback
    }
}
