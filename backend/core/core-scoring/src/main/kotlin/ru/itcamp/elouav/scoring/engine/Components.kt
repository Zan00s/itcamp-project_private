package ru.itcamp.elouav.scoring.engine

import ru.itcamp.elouav.audit.model.AuditRecord
import ru.itcamp.elouav.audit.model.EventType
import ru.itcamp.elouav.audit.model.ActionResult
import ru.itcamp.elouav.scenario.model.Scenario
import ru.itcamp.elouav.scoring.model.*
import ru.itcamp.elouav.scoring.spi.ScoringComponent
import ru.itcamp.elouav.scoring.spi.ScoringContext
import ru.itcamp.elouav.shared.SessionId

class CorrectnessComponent : ScoringComponent {
    override fun id() = "correctness"
    override fun calculate(ctx: ScoringContext): Double {
        val userActions = ctx.auditRecords.filter { it.eventType == EventType.ACTION }
        if (userActions.isEmpty()) return 0.0
        val allExpected = ctx.scenario.phases.flatMap { it.expectedActions }
        if (allExpected.isEmpty()) return 1.0
        var matched = 0
        allExpected.forEach { expected ->
            val found = userActions.any { rec ->
                val data = rec.data
                val expectedVal = expected.value
                val dataVal = data?.value
                data?.node?.value == expected.node &&
                    data?.action == expected.action &&
                    (expectedVal == null || (dataVal != null && dataVal >= expectedVal))
            }
            if (found) matched++
        }
        return matched.toDouble() / allExpected.size
    }
}

class SequenceComponent : ScoringComponent {
    override fun id() = "sequence"
    override fun calculate(ctx: ScoringContext): Double {
        val userActions = ctx.auditRecords.filter { it.eventType == EventType.ACTION }
        if (userActions.isEmpty()) return 0.0
        val phases = ctx.scenario.phases
        if (phases.isEmpty()) return 1.0
        var phaseIdx = 0
        var completed = 0
        for (rec in userActions) {
            val currentPhase = phases.getOrNull(phaseIdx) ?: break
            val matched = currentPhase.expectedActions.any { ea ->
                rec.data?.node?.value == ea.node && rec.data?.action == ea.action
            }
            if (matched) completed++
            val phaseComplete = currentPhase.expectedActions.all { ea ->
                userActions.any { r -> r.data?.node?.value == ea.node && r.data?.action == ea.action }
            }
            if (phaseComplete) phaseIdx++
        }
        return completed.toDouble() / phases.flatMap { it.expectedActions }.size.coerceAtLeast(1)
    }
}

class EfficiencyComponent : ScoringComponent {
    override fun id() = "efficiency"
    override fun calculate(ctx: ScoringContext): Double {
        val userActions = ctx.auditRecords.filter { it.eventType == EventType.ACTION }
        if (userActions.isEmpty()) return 0.0
        val errors = userActions.count { it.data?.result != ActionResult.APPLIED }
        val total = userActions.size
        return 1.0 - (errors.toDouble() / total).coerceIn(0.0, 1.0)
    }
}

class SafetyComponent : ScoringComponent {
    override fun id() = "safety"
    override fun calculate(ctx: ScoringContext): Double {
        if (ctx.hadCriticalFailure) return 0.0
        val alarms = ctx.auditRecords.count { it.eventType == EventType.ALARM }
        if (alarms == 0) return 1.0
        return (1.0 - alarms * 0.2).coerceIn(0.0, 1.0)
    }
}

class TimingComponent : ScoringComponent {
    override fun id() = "timing"
    override fun calculate(ctx: ScoringContext): Double {
        if (ctx.sessionDurationSec <= 0) return 0.0
        val timeout = ctx.scenario.timeoutSec.toLong()
        if (timeout <= 0) return 1.0
        val ratio = ctx.sessionDurationSec.toDouble() / timeout
        return (1.0 - ratio).coerceIn(0.0, 1.0)
    }
}
