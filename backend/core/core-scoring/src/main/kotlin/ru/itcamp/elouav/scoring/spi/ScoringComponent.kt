package ru.itcamp.elouav.scoring.spi

interface ScoringComponent {
    fun id(): String
    fun calculate(context: ScoringContext): Double
}

data class ScoringContext(
    val auditRecords: List<ru.itcamp.elouav.audit.model.AuditRecord>,
    val scenario: ru.itcamp.elouav.scenario.model.Scenario,
    val sessionDurationSec: Long,
    val hadCriticalFailure: Boolean,
)
