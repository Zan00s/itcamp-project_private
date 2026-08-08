package ru.itcamp.elouav.audit.model

import java.time.Instant
import ru.itcamp.elouav.shared.ActionId
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.shared.ScenarioId
import ru.itcamp.elouav.shared.SessionId
import ru.itcamp.elouav.shared.UserId
import ru.itcamp.elouav.sim.model.ChainLink
enum class EventType { ACTION, AUTO_EVENT, SYSTEM, WARNING, ALARM }

enum class ActionResult { APPLIED, REJECTED, OUT_OF_RANGE, ALARM, CLAMPED }

data class AuditData(
    val node: NodeId,
    val action: String,
    val value: Double? = null,
    val result: ActionResult = ActionResult.APPLIED,
    val chain: List<ChainLink> = emptyList(),
)

data class AuditRecord(
    val sessionId: SessionId,
    val scenarioId: ScenarioId,
    val userId: UserId,
    val attempt: Int,
    val timestamp: Instant,
    val eventType: EventType,
    val actionId: ActionId? = null,
    val data: AuditData? = null,
)
