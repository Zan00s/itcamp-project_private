package ru.itcamp.elouav.infra.web.scheduler

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import ru.itcamp.elouav.app.session.SessionStore
import ru.itcamp.elouav.audit.model.AuditData
import ru.itcamp.elouav.audit.model.AuditRecord
import ru.itcamp.elouav.audit.model.ActionResult
import ru.itcamp.elouav.audit.model.EventType
import ru.itcamp.elouav.audit.port.AuditRepository
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.shared.SessionId
import ru.itcamp.elouav.sim.model.NodeMode
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap

@Component
class EmergencyEventScheduler(
    private val sessionStore: SessionStore,
    private val auditRepo: AuditRepository,
) {
    private val log = LoggerFactory.getLogger("ru.itcamp.elouav.emergency")
    private val triggeredEvents = ConcurrentHashMap<SessionId, MutableSet<String>>()

    @Scheduled(fixedRate = 5_000)
    fun processEmergencyEvents() {
        val now = ru.itcamp.elouav.shared.Clock.now()
        val emergencySessions = sessionStore.all().filter {
            it.active && it.scenarioId.value == "emergency_pump_failure"
        }
        if (emergencySessions.isEmpty()) return

        for (session in emergencySessions) {
            try {
                val elapsed = Duration.between(session.startedAt, now).seconds
                val fired = triggeredEvents.getOrPut(session.id) { mutableSetOf() }
                var graph = session.graph

                // t=+10s: Насос Н-82 останавливается (авария)
                if (elapsed >= 10 && "pump_failure" !in fired) {
                    fired.add("pump_failure")
                    val pumpNode = graph.node(NodeId("feed_pump")) ?: continue
                    val newState = pumpNode.state
                        .withMode(NodeMode.ALARM)
                        .withParameter("power_percent", 0.0)
                        .withParameter("flow_rate", 0.0)
                        .withParameter("pressure_out", 0.0)
                    graph = graph.updateNode(NodeId("feed_pump"), newState)
                    log.info("[emergency] t={}с: Насос Н-82 остановлен (авария), session={}", elapsed, session.id.value)

                    auditRepo.append(AuditRecord(
                        sessionId = session.id,
                        scenarioId = session.scenarioId,
                        userId = session.userId,
                        attempt = session.attempt,
                        timestamp = now,
                        eventType = EventType.ALARM,
                        actionId = ru.itcamp.elouav.shared.ActionId("auto_pump_failure_${System.nanoTime()}"),
                        data = AuditData(
                            node = NodeId("feed_pump"),
                            action = "auto_stop",
                            value = 0.0,
                            result = ActionResult.ALARM,
                        ),
                    ))
                }

                // t=+15с (10-60с): Расход в А-19 снижается, сигнализация по низкому расходу воды
                if (elapsed >= 15 && "low_flow_alarm" !in fired) {
                    fired.add("low_flow_alarm")
                    val preheaterNode = graph.node(NodeId("preheater")) ?: continue
                    val newState = preheaterNode.state
                        .withParameter("inlet_flow", 14750.0)
                    graph = graph.updateNode(NodeId("preheater"), newState)
                    log.info("[emergency] t={}с: Снижение расхода в А-19 до 14750, low flow alarm", elapsed)

                    auditRepo.append(AuditRecord(
                        sessionId = session.id,
                        scenarioId = session.scenarioId,
                        userId = session.userId,
                        attempt = session.attempt,
                        timestamp = now,
                        eventType = EventType.WARNING,
                        actionId = ru.itcamp.elouav.shared.ActionId("auto_low_flow_${System.nanoTime()}"),
                        data = AuditData(
                            node = NodeId("preheater"),
                            action = "auto_alarm",
                            value = 14750.0,
                            result = ActionResult.ALARM,
                        ),
                    ))
                }

                // t=+60с (1-5мин): Соли возрастают до 150 мг/л, уровень снижается до 4500мм
                if (elapsed >= 60 && "salt_level_change" !in fired) {
                    fired.add("salt_level_change")
                    val dhNode = graph.node(NodeId("dehydrator")) ?: continue
                    val newState = dhNode.state
                        .withParameter("salt_mg_l", 150.0)
                        .withParameter("level_mm", 4500.0)
                    graph = graph.updateNode(NodeId("dehydrator"), newState)
                    log.info("[emergency] t={}с: Соли 150 мг/л, уровень 4500мм", elapsed)

                    auditRepo.append(AuditRecord(
                        sessionId = session.id,
                        scenarioId = session.scenarioId,
                        userId = session.userId,
                        attempt = session.attempt,
                        timestamp = now,
                        eventType = EventType.WARNING,
                        actionId = ru.itcamp.elouav.shared.ActionId("auto_salt_rise_${System.nanoTime()}"),
                        data = AuditData(
                            node = NodeId("dehydrator"),
                            action = "auto_degradation",
                            result = ActionResult.ALARM,
                        ),
                    ))
                }

                // t=+300с (5-10мин): Температура 150°C, давление 3 кгс/см², уровень снижается к 3500мм
                if (elapsed >= 300 && "critical_degradation" !in fired) {
                    fired.add("critical_degradation")
                    val dhNode = graph.node(NodeId("dehydrator")) ?: continue
                    val currentLevel = dhNode.state.parameters["level_mm"] ?: 4500.0
                    val newLevel = (currentLevel - 2000.0).coerceAtLeast(3500.0)
                    val newState = dhNode.state
                        .withParameter("inlet_temp", 150.0)
                        .withParameter("pressure", 3.0)
                        .withParameter("level_mm", newLevel)
                    graph = graph.updateNode(NodeId("dehydrator"), newState)
                    log.info("[emergency] t={}с: Темп 150°C, давление 3, уровень {}мм", elapsed, newLevel)

                    auditRepo.append(AuditRecord(
                        sessionId = session.id,
                        scenarioId = session.scenarioId,
                        userId = session.userId,
                        attempt = session.attempt,
                        timestamp = now,
                        eventType = EventType.WARNING,
                        actionId = ru.itcamp.elouav.shared.ActionId("auto_critical_${System.nanoTime()}"),
                        data = AuditData(
                            node = NodeId("dehydrator"),
                            action = "auto_critical",
                            result = ActionResult.ALARM,
                        ),
                    ))
                }

                // t=+350с: Блокировка LSA 641A при уровне < 3500мм
                if (elapsed >= 350 && "lsa_block" !in fired) {
                    fired.add("lsa_block")
                    val dhNode = graph.node(NodeId("dehydrator")) ?: continue
                    val currentLevel = dhNode.state.parameters["level_mm"] ?: 3500.0
                    if (currentLevel <= 3500.0) {
                        val newState = dhNode.state
                            .withMode(NodeMode.ALARM)
                            .withParameter("voltage_on", 0.0)
                        graph = graph.updateNode(NodeId("dehydrator"), newState)
                        log.info("[emergency] t={}с: Блокировка LSA 641A - напряжение отключено", elapsed)

                        auditRepo.append(AuditRecord(
                            sessionId = session.id,
                            scenarioId = session.scenarioId,
                            userId = session.userId,
                            attempt = session.attempt,
                            timestamp = now,
                            eventType = EventType.ALARM,
                            actionId = ru.itcamp.elouav.shared.ActionId("auto_lsa_block_${System.nanoTime()}"),
                            data = AuditData(
                                node = NodeId("dehydrator"),
                                action = "auto_lsa_block",
                                value = 0.0,
                                result = ActionResult.ALARM,
                            ),
                        ))
                    }
                }

                // Сохраняем обновлённый граф
                sessionStore.update(session.id, graph)

            } catch (e: Exception) {
                log.error("Ошибка в emergency scheduler для сессии {}: {}", session.id.value, e.message)
            }
        }
    }

    fun clearSession(sessionId: SessionId) {
        triggeredEvents.remove(sessionId)
    }
}
