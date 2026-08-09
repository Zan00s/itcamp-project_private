package ru.itcamp.elouav.infra.web.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import ru.itcamp.elouav.app.scenario.ListScenariosUseCase
import ru.itcamp.elouav.app.scenario.LoadScenarioUseCase
import ru.itcamp.elouav.app.session.SessionStore
import ru.itcamp.elouav.app.session.StartSessionUseCase
import ru.itcamp.elouav.app.session.EndSessionUseCase
import ru.itcamp.elouav.app.sim.ApplyActionUseCase
import ru.itcamp.elouav.app.scoring.ScoreAttemptUseCase
import ru.itcamp.elouav.audit.model.AuditData
import ru.itcamp.elouav.audit.model.AuditRecord
import ru.itcamp.elouav.audit.model.EventType
import ru.itcamp.elouav.audit.model.ActionResult
import ru.itcamp.elouav.audit.port.AuditRepository
import ru.itcamp.elouav.infra.web.dto.*
import ru.itcamp.elouav.scoring.model.ScoringProfile
import ru.itcamp.elouav.shared.*
import ru.itcamp.elouav.sim.model.ActionRequest
import ru.itcamp.elouav.sim.port.GraphRepository
import java.time.Duration

@RestController
@RequestMapping("/api")
class ApiController(
    private val graphRepo: GraphRepository,
    private val auditRepo: AuditRepository,
    private val sessionStore: SessionStore,
    private val applyActionUseCase: ApplyActionUseCase,
    private val startSessionUseCase: StartSessionUseCase,
    private val endSessionUseCase: EndSessionUseCase,
    private val listScenariosUseCase: ListScenariosUseCase,
    private val loadScenarioUseCase: LoadScenarioUseCase,
    private val scoreAttemptUseCase: ScoreAttemptUseCase,
) {

    @GetMapping("/graph")
    fun getGraph(@RequestParam(defaultValue = "ELOU-AV") install: String): ResponseEntity<GraphDTO> {
        val result = graphRepo.load(install)
        return when (result) {
            is AppResult.Ok -> ResponseEntity.ok(DTOMapper.toGraphDTO(result.value))
            is AppResult.Err -> ResponseEntity.notFound().build()
        }
    }

    @GetMapping("/scenarios")
    fun listScenarios(): ResponseEntity<List<ScenarioDTO>> {
        val result = listScenariosUseCase.execute()
        return when (result) {
            is AppResult.Ok -> ResponseEntity.ok(result.value.map { DTOMapper.toScenarioDTO(it) })
            is AppResult.Err -> ResponseEntity.internalServerError().build()
        }
    }

    @GetMapping("/scenarios/{id}")
    fun getScenario(@PathVariable id: String): ResponseEntity<ScenarioDTO> {
        val result = loadScenarioUseCase.execute(ScenarioId(id))
        return when (result) {
            is AppResult.Ok -> ResponseEntity.ok(DTOMapper.toScenarioDTO(result.value))
            is AppResult.Err -> ResponseEntity.notFound().build()
        }
    }

    @GetMapping("/scenarios/{id}/hints")
    fun getHints(@PathVariable id: String): ResponseEntity<Map<String, String>> {
        val result = loadScenarioUseCase.execute(ScenarioId(id))
        return when (result) {
            is AppResult.Ok -> {
                val hints = result.value.bankHints.associate { it.key to it.text }
                ResponseEntity.ok(hints)
            }
            is AppResult.Err -> ResponseEntity.notFound().build()
        }
    }

    @PostMapping("/sessions")
    fun startSession(
        @RequestBody req: StartSessionRequestDTO,
        @RequestHeader("X-User-Id") userId: String,
    ): ResponseEntity<SessionDTO> {
        val graphResult = graphRepo.load("ELOU-AV")
        if (graphResult is AppResult.Err) return ResponseEntity.internalServerError().build()
        val session = startSessionUseCase.execute(
            ScenarioId(req.scenarioId),
            UserId(userId),
            (graphResult as AppResult.Ok).value,
            req.attempt,
        )
        return ResponseEntity.ok(SessionDTO(
            id = session.id.value,
            scenarioId = session.scenarioId.value,
            userId = session.userId.value,
            attempt = session.attempt,
            active = session.active,
        ))
    }

    @GetMapping("/sessions/{id}")
    fun getSession(@PathVariable id: String): ResponseEntity<SessionDTO> {
        val session = sessionStore.get(SessionId(id))
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(SessionDTO(
            id = session.id.value,
            scenarioId = session.scenarioId.value,
            userId = session.userId.value,
            attempt = session.attempt,
            active = session.active,
        ))
    }

    @PostMapping("/sessions/{id}/actions")
    fun applyAction(
        @PathVariable id: String,
        @RequestBody req: ActionRequestDTO,
    ): ResponseEntity<SimulationStepDTO> {
        val session = sessionStore.get(SessionId(id))
            ?: return ResponseEntity.notFound().build()

        val actionReq = ActionRequest(NodeId(req.node), req.action, req.value)
        val result = applyActionUseCase.execute(session.graph, actionReq)

        return when (result) {
            is AppResult.Ok -> {
                val step = result.value

                val updatedNodes = session.graph.nodes.mapValues { (nodeId, node) ->
                    step.finalState[nodeId]?.let { newState -> node.copy(state = newState) } ?: node
                }
                sessionStore.update(SessionId(id), session.graph.copy(nodes = updatedNodes))

                val actionResult = when (step.validationResult) {
                    is ru.itcamp.elouav.sim.model.ValidationResult.Applied -> ActionResult.APPLIED
                    is ru.itcamp.elouav.sim.model.ValidationResult.Clamped -> ActionResult.CLAMPED
                    is ru.itcamp.elouav.sim.model.ValidationResult.Rejected -> ActionResult.REJECTED
                    is ru.itcamp.elouav.sim.model.ValidationResult.Alarm -> ActionResult.ALARM
                }

                auditRepo.append(AuditRecord(
                    sessionId = SessionId(id),
                    scenarioId = session.scenarioId,
                    userId = session.userId,
                    attempt = session.attempt,
                    timestamp = Clock.now(),
                    eventType = EventType.ACTION,
                    actionId = ActionId("${req.node}_${req.action}_${System.nanoTime()}"),
                    data = AuditData(
                        node = NodeId(req.node),
                        action = req.action,
                        value = req.value,
                        result = actionResult,
                        chain = step.chain,
                    ),
                ))

                step.events.forEach { event ->
                    auditRepo.append(AuditRecord(
                        sessionId = SessionId(id),
                        scenarioId = session.scenarioId,
                        userId = session.userId,
                        attempt = session.attempt,
                        timestamp = event.timestamp,
                        eventType = EventType.AUTO_EVENT,
                        data = AuditData(
                            node = event.sourceNode,
                            action = "auto",
                            chain = step.chain.filter { it.node == event.sourceNode },
                        ),
                    ))
                }

                ResponseEntity.ok(DTOMapper.toStepDTO(step))
            }
            is AppResult.Err -> ResponseEntity.badRequest().build()
        }
    }

    @PostMapping("/sessions/{id}/end")
    fun endSession(@PathVariable id: String): ResponseEntity<VerdictDTO> {
        val session = sessionStore.get(SessionId(id))
            ?: return ResponseEntity.notFound().build()

        endSessionUseCase.execute(SessionId(id))

        val scenarioResult = loadScenarioUseCase.execute(session.scenarioId)
        if (scenarioResult is AppResult.Err)
            return ResponseEntity.internalServerError().build()
        val scenario = (scenarioResult as AppResult.Ok).value

        val auditResult = auditRepo.readBySession(SessionId(id))
        val auditRecords = (auditResult as? AppResult.Ok)?.value ?: emptyList()

        val durationSec = Duration.between(session.startedAt, session.endedAt ?: Clock.now()).seconds

        val hadCritical = auditRecords.any { it.eventType == EventType.ALARM }
        val hadTimeout = durationSec > scenario.timeoutSec

        val verdict = scoreAttemptUseCase.execute(
            sessionId = SessionId(id),
            scenarioId = session.scenarioId.value,
            attempt = session.attempt,
            auditRecords = auditRecords,
            scenario = scenario,
            sessionDurationSec = durationSec,
            hadCriticalFailure = hadCritical,
            hadTimeout = hadTimeout,
            profile = ScoringProfile(),
        )

        sessionStore.setVerdict(SessionId(id), verdict)

        return ResponseEntity.ok(DTOMapper.toVerdictDTO(verdict))
    }

    @GetMapping("/sessions")
    fun listSessions(): ResponseEntity<List<SessionInfoDTO>> {
        val sessions = sessionStore.all().sortedByDescending { it.startedAt }
        return ResponseEntity.ok(sessions.map { s ->
            SessionInfoDTO(
                id = s.id.value,
                scenarioId = s.scenarioId.value,
                userId = s.userId.value,
                attempt = s.attempt,
                active = s.active,
                startedAt = s.startedAt.toString(),
                endedAt = s.endedAt?.toString(),
                verdict = s.verdict?.let { v ->
                    VerdictDTO(
                        sessionId = v.sessionId,
                        scenarioId = v.scenarioId,
                        attempt = v.attempt,
                        verdict = v.verdict.name,
                        score = v.score.total,
                        componentScores = v.score.componentScores,
                        achievements = v.achievements,
                        feedback = v.feedback.map { f ->
                            FeedbackDTO(f.actionId, f.type.name, f.text, f.hint)
                        },
                        aiUsed = v.aiUsed,
                    )
                },
            )
        })
    }

    @GetMapping("/sessions/{id}/state")
    fun getSessionState(@PathVariable id: String): ResponseEntity<GraphDTO> {
        val session = sessionStore.get(SessionId(id))
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(DTOMapper.toGraphDTO(session.graph))
    }
}
