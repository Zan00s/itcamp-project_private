package ru.itcamp.elouav.app.scoring

import ru.itcamp.elouav.audit.model.AuditRecord
import ru.itcamp.elouav.scenario.model.Scenario
import ru.itcamp.elouav.scoring.engine.ScoringEngine
import ru.itcamp.elouav.scoring.model.ScoringProfile
import ru.itcamp.elouav.scoring.model.Verdict
import ru.itcamp.elouav.shared.SessionId

class ScoreAttemptUseCase(
    private val engine: ScoringEngine = ScoringEngine(),
) {
    fun execute(
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
    ): Verdict = engine.score(
        sessionId, scenarioId, attempt, auditRecords, scenario,
        sessionDurationSec, hadCriticalFailure, hadTimeout, aiScores, profile,
    )
}
