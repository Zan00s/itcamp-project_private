package ru.itcamp.elouav.infra.web.scheduler

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import ru.itcamp.elouav.app.scenario.LoadScenarioUseCase
import ru.itcamp.elouav.app.scoring.ScoreAttemptUseCase
import ru.itcamp.elouav.app.session.EndSessionUseCase
import ru.itcamp.elouav.app.session.SessionStore
import ru.itcamp.elouav.audit.model.EventType
import ru.itcamp.elouav.audit.port.AuditRepository
import ru.itcamp.elouav.scoring.model.ScoringProfile
import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.Clock
import ru.itcamp.elouav.shared.SessionId
import java.time.Duration

@Component
class SessionTimeoutScheduler(
    private val sessionStore: SessionStore,
    private val endSessionUseCase: EndSessionUseCase,
    private val loadScenarioUseCase: LoadScenarioUseCase,
    private val scoreAttemptUseCase: ScoreAttemptUseCase,
    private val auditRepo: AuditRepository,
) {
    private val log = LoggerFactory.getLogger("ru.itcamp.elouav.scheduler")

    @Scheduled(fixedRate = 30_000)
    fun autoEndExpiredSessions() {
        val now = Clock.now()
        val activeSessions = sessionStore.all().filter { it.active }
        if (activeSessions.isEmpty()) return

        for (session in activeSessions) {
            try {
                val elapsed = Duration.between(session.startedAt, now).seconds
                val scenarioResult = loadScenarioUseCase.execute(session.scenarioId)
                if (scenarioResult is AppResult.Err) {
                    log.warn("Сценарий не найден для сессии {}: {}", session.id.value, session.scenarioId.value)
                    endSessionUseCase.execute(session.id)
                    continue
                }
                val scenario = (scenarioResult as AppResult.Ok).value
                val timeout = scenario.timeoutSec.toLong()

                if (elapsed > timeout) {
                    log.info("Авто-завершение сессии {} (превышен таймаут {}с, прошло {}с)",
                        session.id.value, timeout, elapsed)
                    endSessionUseCase.execute(session.id)

                    val auditResult = auditRepo.readBySession(session.id)
                    val auditRecords = (auditResult as? AppResult.Ok)?.value ?: emptyList()
                    val hadCritical = auditRecords.any { it.eventType == EventType.ALARM }

                    val verdict = scoreAttemptUseCase.execute(
                        sessionId = session.id,
                        scenarioId = session.scenarioId.value,
                        attempt = session.attempt,
                        auditRecords = auditRecords,
                        scenario = scenario,
                        sessionDurationSec = elapsed,
                        hadCriticalFailure = hadCritical,
                        hadTimeout = true,
                        profile = ScoringProfile(),
                    )
                    sessionStore.setVerdict(session.id, verdict)
                    log.info("Сессия {} завершена с вердиктом: {} (score={})",
                        session.id.value, verdict.verdict, verdict.score.total)
                }
            } catch (e: Exception) {
                log.error("Ошибка при авто-завершении сессии {}: {}", session.id.value, e.message)
            }
        }
    }
}
