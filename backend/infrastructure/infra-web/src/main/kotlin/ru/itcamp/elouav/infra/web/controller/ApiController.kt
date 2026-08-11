package ru.itcamp.elouav.infra.web.controller

import org.springframework.beans.factory.annotation.Value
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.slf4j.LoggerFactory
import ru.itcamp.elouav.ai.port.LLMChat
import ru.itcamp.elouav.app.scenario.ListScenariosUseCase
import ru.itcamp.elouav.app.scenario.LoadScenarioUseCase
import ru.itcamp.elouav.app.scenario.SaveScenarioUseCase
import ru.itcamp.elouav.app.scenario.DeleteScenarioUseCase
import ru.itcamp.elouav.app.session.SessionStore
import ru.itcamp.elouav.app.session.Session
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
import ru.itcamp.elouav.infra.web.security.AiRequestRateLimiter
import ru.itcamp.elouav.infra.web.security.PromptSanitizer
import ru.itcamp.elouav.scoring.model.ScoringProfile
import ru.itcamp.elouav.shared.*
import ru.itcamp.elouav.sim.model.ActionRequest
import ru.itcamp.elouav.sim.model.Graph
import ru.itcamp.elouav.sim.model.NodeMode
import ru.itcamp.elouav.sim.model.NodeState
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
    private val saveScenarioUseCase: SaveScenarioUseCase,
    private val deleteScenarioUseCase: DeleteScenarioUseCase,
    private val scoreAttemptUseCase: ScoreAttemptUseCase,
    private val llmChat: LLMChat,
    @Value("\${KEYCLOAK_URL:http://localhost:8180}") private val keycloakUrl: String,
) {

    private val log = LoggerFactory.getLogger("ru.itcamp.elouav.api")
    private val aiRateLimiter = AiRequestRateLimiter(maxRequests = 10, windowMs = 60_000)

    @GetMapping("/health/keycloak")
    fun checkKeycloak(): ResponseEntity<Map<String, String>> {
        return try {
            val client = java.net.http.HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(5))
                .build()
            val request = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create("$keycloakUrl/realms/elouav"))
                .timeout(java.time.Duration.ofSeconds(5))
                .GET()
                .build()
            val response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString())
            val status = if (response.statusCode() in 200..299) "UP" else "DOWN (${response.statusCode()})"
            ResponseEntity.ok(mapOf("status" to status))
        } catch (e: Exception) {
            ResponseEntity.ok(mapOf("status" to "DOWN", "error" to (e.message ?: "unknown")))
        }
    }

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
        authentication: Authentication,
    ): ResponseEntity<SessionDTO> {
        if (req.scenarioId.isBlank()) {
            throw IllegalArgumentException("scenarioId не может быть пустым")
        }

        val userId = AuthUserIdResolver.resolveUserId(authentication)
            ?: throw IllegalStateException("Пользователь не аутентифицирован")

        if (userId.isBlank()) {
            throw IllegalArgumentException("userId не может быть пустым")
        }

        val graphResult = graphRepo.load("ELOU-AV")
        if (graphResult is AppResult.Err) {
            throw IllegalStateException("Граф установки недоступен")
        }
        var graph = (graphResult as AppResult.Ok).value

        val scenarioResult = loadScenarioUseCase.execute(ScenarioId(req.scenarioId))
        if (scenarioResult is AppResult.Ok) {
            val scenario = (scenarioResult as AppResult.Ok).value
            val overrides = scenario.setup.nodesOverride
            if (overrides.isNotEmpty()) {
                graph = applyInitialState(graph, overrides)
                log.info("[startSession] Применён initialState для сценария {} ({} узлов)", req.scenarioId, overrides.size)
            }
        }

        val existingSessions = sessionStore.all()
            .filter { it.userId == UserId(userId) && it.scenarioId == ScenarioId(req.scenarioId) }
        val nextAttempt = (existingSessions.maxOfOrNull { it.attempt } ?: 0) + 1

        val session = startSessionUseCase.execute(
            ScenarioId(req.scenarioId),
            UserId(userId),
            graph,
            nextAttempt,
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
    fun getSession(
        @PathVariable id: String,
        authentication: Authentication,
    ): ResponseEntity<SessionDTO> {
        val session = sessionStore.get(SessionId(id))
            ?: return ResponseEntity.notFound().build()

        if (!isSessionAccessible(session, authentication)) {
            return ResponseEntity.status(403).build()
        }

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
        authentication: Authentication,
    ): ResponseEntity<SimulationStepDTO> {
        if (req.node.isBlank()) {
            throw IllegalArgumentException("node не может быть пустым")
        }
        if (req.action.isBlank()) {
            throw IllegalArgumentException("action не может быть пустым")
        }

        val session = sessionStore.get(SessionId(id))
            ?: throw NoSuchElementException("Сессия $id не найдена")

        if (!session.active) {
            throw IllegalStateException("Сессия уже завершена")
        }

        val scenarioResult = loadScenarioUseCase.execute(session.scenarioId)
        if (scenarioResult is AppResult.Ok) {
            val elapsed = Duration.between(session.startedAt, Clock.now()).seconds
            if (elapsed > (scenarioResult as AppResult.Ok).value.timeoutSec.toLong()) {
                throw IllegalStateException("Время сценария истекло (${elapsed}с > ${scenarioResult.value.timeoutSec}с). Сессия завершается.")
            }
        }

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
            is AppResult.Err -> ResponseEntity.badRequest().body(
                SimulationStepDTO(
                    node = req.node,
                    action = req.action,
                    value = req.value,
                    validationResult = "Rejected",
                    chain = emptyList(),
                    finalState = emptyMap(),
                    stabilized = false,
                )
            )
        }
    }

    @PostMapping("/sessions/{id}/end")
    fun endSession(
        @PathVariable id: String,
        authentication: Authentication,
    ): ResponseEntity<VerdictDTO> {
        val session = sessionStore.get(SessionId(id))
            ?: throw NoSuchElementException("Сессия $id не найдена")

        if (!isSessionAccessible(session, authentication)) {
            throw AccessDeniedException("Нет доступа к сессии $id")
        }

        if (!hasWriteAccess(authentication)) {
            throw AccessDeniedException("Недостаточно прав для завершения сессии")
        }

        if (!session.active) {
            session.verdict?.let { return ResponseEntity.ok(DTOMapper.toVerdictDTO(it)) }
            throw IllegalStateException("Сессия уже завершена")
        }

        endSessionUseCase.execute(SessionId(id))

        val scenarioResult = loadScenarioUseCase.execute(session.scenarioId)
        if (scenarioResult is AppResult.Err) {
            throw IllegalStateException("Сценарий не найден: ${session.scenarioId.value}")
        }
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
    fun listSessions(authentication: Authentication): ResponseEntity<List<SessionInfoDTO>> {
        val currentUserId = AuthUserIdResolver.resolveUserId(authentication)
            ?: return ResponseEntity.status(401).build()

        val isAdmin = authentication.authorities.any { it.authority.equals("ROLE_admin", ignoreCase = true) }
        val sessions = sessionStore.all()
            .filter { isAdmin || it.userId == UserId(currentUserId) }
            .sortedByDescending { it.startedAt }

        return ResponseEntity.ok(sessions.map { s ->
            val durationSec = s.endedAt?.let { Duration.between(s.startedAt, it).seconds }
                ?: Duration.between(s.startedAt, Clock.now()).seconds
            SessionInfoDTO(
                id = s.id.value,
                scenarioId = s.scenarioId.value,
                userId = s.userId.value,
                attempt = s.attempt,
                active = s.active,
                startedAt = s.startedAt.toString(),
                endedAt = s.endedAt?.toString(),
                durationSec = durationSec,
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
    fun getSessionState(
        @PathVariable id: String,
        authentication: Authentication,
    ): ResponseEntity<GraphDTO> {
        val session = sessionStore.get(SessionId(id))
            ?: throw NoSuchElementException("Сессия $id не найдена")

        if (!isSessionAccessible(session, authentication)) {
            throw AccessDeniedException("Нет доступа к сессии $id")
        }

        return ResponseEntity.ok(DTOMapper.toGraphDTO(session.graph))
    }

    // === Scenario CRUD (methodist) ===

    @PostMapping("/scenarios")
    fun createScenario(@RequestBody req: ScenarioCreateDTO): ResponseEntity<ScenarioDTO> {
        val scenario = DTOMapper.fromCreateDTO(req)
        val saveResult = saveScenarioUseCase.execute(scenario)
        if (saveResult is AppResult.Err) {
            throw IllegalArgumentException(saveResult.message)
        }
        return ResponseEntity.ok(DTOMapper.toScenarioDTO(scenario))
    }

    @PutMapping("/scenarios/{id}")
    fun updateScenario(
        @PathVariable id: String,
        @RequestBody req: ScenarioCreateDTO,
    ): ResponseEntity<ScenarioDTO> {
        val existing = loadScenarioUseCase.execute(ScenarioId(id))
        if (existing is AppResult.Err) {
            throw NoSuchElementException("Сценарий $id не найден")
        }
        val scenario = DTOMapper.fromCreateDTO(req).copy(id = ScenarioId(id))
        val saveResult = saveScenarioUseCase.execute(scenario)
        if (saveResult is AppResult.Err) {
            throw IllegalArgumentException(saveResult.message)
        }
        return ResponseEntity.ok(DTOMapper.toScenarioDTO(scenario))
    }

    @DeleteMapping("/scenarios/{id}")
    fun deleteScenario(@PathVariable id: String): ResponseEntity<Map<String, String>> {
        val result = deleteScenarioUseCase.execute(ScenarioId(id))
        if (result is AppResult.Err) {
            throw IllegalArgumentException(result.message)
        }
        return ResponseEntity.ok(mapOf("status" to "deleted", "id" to id))
    }

    @PostMapping("/scenarios/{id}/validate")
    fun validateScenario(@PathVariable id: String): ResponseEntity<Map<String, Any>> {
        val scenarioResult = loadScenarioUseCase.execute(ScenarioId(id))
        if (scenarioResult is AppResult.Err) {
            throw NoSuchElementException("Сценарий $id не найден")
        }
        val graphResult = graphRepo.load("ELOU-AV")
        val graph = (graphResult as? AppResult.Ok)?.value
            ?: throw IllegalStateException("Граф установки недоступен")
        val errors = mutableListOf<String>()

        val allowedNodes = (scenarioResult as AppResult.Ok).value.phases
            .flatMap { it.expectedActions }
            .map { it.node }
            .distinct()
        allowedNodes.forEach { nodeId ->
            if (graph.node(NodeId(nodeId)) == null) {
                errors.add("Узел '$nodeId' не найден в графе установки")
            }
        }

        val valid = errors.isEmpty()
        return ResponseEntity.ok(mapOf(
            "valid" to valid,
            "errors" to errors,
        ))
    }

    // === AI endpoints ===

    @PostMapping("/ai/scenario-draft")
    fun generateScenarioDraft(
        @RequestBody req: ScenarioDraftRequestDTO,
        authentication: Authentication,
    ): ResponseEntity<ScenarioDraftDTO> {
        if (!isAiAllowed(authentication)) {
            return ResponseEntity.status(403).build()
        }

        val clientKey = AuthUserIdResolver.resolveUserId(authentication) ?: authentication.name
        if (!aiRateLimiter.allow(clientKey)) {
            log.warn("[AI rate-limit] blocked client={} for scenario-draft", clientKey)
            return ResponseEntity.status(429).build()
        }

        if (!isPayloadWithinLimits(req.topic, req.context, maxTextLength = 4000, maxPayloadSize = 5000)) {
            return ResponseEntity.status(413).build()
        }

        log.info("[AI scenario-draft] topic={} difficulty={} timeout={} contextLen={}", req.topic, req.difficulty, req.timeoutSec, req.context?.length)
        val sanitizedTopic = PromptSanitizer.sanitize(req.topic, maxLength = 120)
        val sanitizedContext = PromptSanitizer.sanitize(req.context, maxLength = 4000)
        val systemPrompt = """
            Ты — методист тренажёра оператора НПЗ (установка ЭЛОУ-АВТ).
            Создай черновик сценария обучения в формате JSON.
            Узлы графа: feed_pump (насос Н-82), preheater (теплообменник А-19), dehydrator (дегидратор Э-1), furnace (печь), tank (ёмкость Е-16), regulator (регулятор Р-11).
            Действия: start, stop, set_power (0-100), set_temp (20-400), set_valve (0-100).
            Параметры узлов: power_percent, flow_rate, temperature, water_content, salt_mg_l, level, valve_pos.
            Режимы узлов: RUNNING (работает), STOPPED (остановлен).
            Ответь СТРОГО в JSON без markdown-обрамления и без пояснений.
            JSON-схема: {"name":"...","timeoutSec":1800,"difficulty":2,"initialState":[{"node":"feed_pump","mode":"RUNNING","parameters":{"power_percent":80}}],"phases":[{"id":"ph1","title":"...","expectedActions":[{"node":"feed_pump","action":"start","value":null}]}],"hints":[{"key":"ph1","text":"..."}]}
            В expectedActions используй поля node, action, value (число или null).
            В initialState укажи узлы, которые уже работают и их параметры на момент начала сценария.
            Если пользователь задаёт контекст — учти его: начни сценарий с нужной точки, задай initialState.
            Следи за балансом скобок: каждый { должен быть закрыт }, каждая [ закрыта ].
        """.trimIndent()

        val contextBlock = req.context?.takeIf { it.isNotBlank() }?.let {
            """
            Контекст пользователя (учти при создании сценария):
            $sanitizedContext
            """.trimIndent()
        } ?: "Контекст не задан — создай сценарий с полного пуска установки (холодный старт)."

        val userPrompt = """
            Тема сценария: ${sanitizedTopic ?: "Пуск установки"}
            Сложность: ${req.difficulty ?: 2} (от 1 до 3)
            Таймаут: ${req.timeoutSec ?: 1800} секунд

            $contextBlock

            Создай 3-4 фазы с 2-3 действиями в каждой.
            Если контекст требует начала с промежуточной точки — задай initialState с уже работающими узлами и выставленными параметрами, а фазы начни с нужного этапа.
        """.trimIndent()

        val result = kotlinx.coroutines.runBlocking { llmChat.chat(systemPrompt, userPrompt, jsonMode = true) }
        log.info("[AI scenario-draft] result={} error={}", result is AppResult.Ok, result is AppResult.Err)
        return when (result) {
            is AppResult.Ok -> {
                val content = result.value
                val jsonStr = extractJson(content)
                try {
                    val parsed: Map<String, Any> = jacksonObjectMapper().readValue(jsonStr)
                    ResponseEntity.ok(ScenarioDraftDTO(scenario = parsed, error = null, rawText = null))
                } catch (e: Exception) {
                    ResponseEntity.ok(ScenarioDraftDTO(scenario = null, error = "Не удалось разобрать ответ ИИ: ${e.message}", rawText = content))
                }
            }
            is AppResult.Err -> ResponseEntity.ok(ScenarioDraftDTO(scenario = null, error = result.message, rawText = null))
        }
    }

    @PostMapping("/ai/explain-action")
    fun explainAction(
        @RequestBody req: ExplainActionRequestDTO,
        authentication: Authentication,
    ): ResponseEntity<ExplainActionDTO> {
        if (!isAiAllowed(authentication)) {
            return ResponseEntity.status(403).build()
        }

        val clientKey = AuthUserIdResolver.resolveUserId(authentication) ?: authentication.name
        if (!aiRateLimiter.allow(clientKey)) {
            log.warn("[AI rate-limit] blocked client={} for explain-action", clientKey)
            return ResponseEntity.status(429).build()
        }

        if (!isPayloadWithinLimits(req.node, req.action, maxTextLength = 200, maxPayloadSize = 4000)) {
            return ResponseEntity.status(413).build()
        }

        log.info("[AI explain-action] node={} action={} value={} chainSize={}", req.node, req.action, req.value, req.chain?.size)
        val sanitizedNode = PromptSanitizer.sanitize(req.node, maxLength = 80)
        val sanitizedAction = PromptSanitizer.sanitize(req.action, maxLength = 80)
        val systemPrompt = """
            Ты — ИИ-ассистент тренажёра оператора НПЗ (установка ЭЛОУ-АВТ).
            Объясни студенту, как его действие повлияло на установку.
            Отвечай кратко на русском языке (2-4 предложения).
        """.trimIndent()

        val chainText = (req.chain ?: emptyList()).joinToString("; ") { c ->
            val changed = (c["changed"] as? List<*>)?.joinToString(", ") ?: ""
            val node = PromptSanitizer.sanitize(c["node"]?.toString(), maxLength = 80) ?: "узел"
            val changedSafe = PromptSanitizer.sanitize(changed, maxLength = 200) ?: ""
            "$node: изменены $changedSafe"
        }

        val userPrompt = """
            Действие: ${sanitizedAction ?: "действие"} на узле ${sanitizedNode ?: "узел"}${req.value?.let { ", значение: $it" } ?: ""}
            Каскадные изменения: ${if (chainText.isNotBlank()) chainText else "нет"}
            Объясни физический смысл и влияние на установку.
        """.trimIndent()

        val result = kotlinx.coroutines.runBlocking { llmChat.chat(systemPrompt, userPrompt) }
        log.info("[AI explain-action] result={} error={}", result is AppResult.Ok, result is AppResult.Err)
        return when (result) {
            is AppResult.Ok -> ResponseEntity.ok(ExplainActionDTO(text = result.value, isAI = true, error = false))
            is AppResult.Err -> ResponseEntity.ok(ExplainActionDTO(text = "ИИ-пояснение недоступно: ${result.message}", isAI = true, error = true))
        }
    }

    @PostMapping("/ai/session-analysis")
    fun analyzeSession(
        @RequestBody req: SessionAnalysisRequestDTO,
        authentication: Authentication,
    ): ResponseEntity<SessionAnalysisDTO> {
        if (!isAiAllowed(authentication)) {
            return ResponseEntity.status(403).build()
        }

        val clientKey = AuthUserIdResolver.resolveUserId(authentication) ?: authentication.name
        if (!aiRateLimiter.allow(clientKey)) {
            log.warn("[AI rate-limit] blocked client={} for session-analysis", clientKey)
            return ResponseEntity.status(429).build()
        }

        val session = sessionStore.get(SessionId(req.sessionId))
            ?: throw NoSuchElementException("Сессия не найдена")

        if (!isSessionAccessible(session, authentication)) {
            return ResponseEntity.status(403).build()
        }

        if (!isPayloadWithinLimits(req.sessionId, maxTextLength = 80, maxPayloadSize = 2000)) {
            return ResponseEntity.status(413).build()
        }

        val sanitizedSessionId = PromptSanitizer.sanitize(req.sessionId, maxLength = 80)

        log.info("[AI session-analysis] sessionId={} user={} scenario={} score={}",
            req.sessionId, session.userId.value, session.scenarioId.value, session.verdict?.score?.total)

        val systemPrompt = """
            Ты — ИИ-аналитик тренажёра оператора НПЗ (установка ЭЛОУ-АВТ).
            Подготовь краткий разбор результатов сессии студента и рекомендации по обучению.
            Отвечай на русском языке. Сначала анализ, затем рекомендации (каждая с новой строки, начиная с "- ").
        """.trimIndent()

        val verdict = session.verdict
        val score = verdict?.score?.total ?: 0
        val feedbackText = verdict?.feedback?.joinToString("; ") { it.text } ?: "нет обратной связи"
        val sanitizedSessionId = PromptSanitizer.sanitize(req.sessionId, maxLength = 80) ?: "unknown"
        val sanitizedUserId = PromptSanitizer.sanitize(session.userId.value, maxLength = 80) ?: "unknown"
        val sanitizedScenarioId = PromptSanitizer.sanitize(session.scenarioId.value, maxLength = 80) ?: "unknown"
        val sanitizedFeedbackText = PromptSanitizer.sanitize(feedbackText, maxLength = 2000) ?: "нет обратной связи"

        val userPrompt = """
            Студент: $sanitizedUserId
            Сценарий: $sanitizedScenarioId
            Идентификатор сессии: $sanitizedSessionId
            Попытка: ${session.attempt}
            Балл: $score/100
            Результат: ${verdict?.verdict?.name ?: "не завершён"}
            Обратная связь от системы: $sanitizedFeedbackText
            Дай разбор и 2-3 рекомендации.
        """.trimIndent()

        val result = kotlinx.coroutines.runBlocking { llmChat.chat(systemPrompt, userPrompt) }
        log.info("[AI session-analysis] result={} error={}", result is AppResult.Ok, result is AppResult.Err)
        return when (result) {
            is AppResult.Ok -> {
                val text = result.value
                val recommendations = text.lines().filter { it.trim().startsWith("-") }.map { it.trim().removePrefix("-").trim() }
                ResponseEntity.ok(SessionAnalysisDTO(text = text, recommendations = recommendations, isAI = true, error = false))
            }
            is AppResult.Err -> ResponseEntity.ok(SessionAnalysisDTO(
                text = "ИИ-анализ недоступен: ${result.message}",
                recommendations = emptyList(),
                isAI = true,
                error = true,
            ))
        }
    }

    @GetMapping("/sessions/{id}/hint")
    fun getContextHint(
        @PathVariable id: String,
        authentication: Authentication,
    ): ResponseEntity<Map<String, Any>> {
        val session = sessionStore.get(SessionId(id))
            ?: throw NoSuchElementException("Сессия $id не найдена")

        if (!isSessionAccessible(session, authentication)) {
            throw AccessDeniedException("Нет доступа к сессии $id")
        }

        val scenarioResult = loadScenarioUseCase.execute(session.scenarioId)
        if (scenarioResult is AppResult.Err) {
            throw NoSuchElementException("Сценарий не найден")
        }
        val scenario = (scenarioResult as AppResult.Ok).value
        val auditResult = auditRepo.readBySession(SessionId(id))
        val auditRecords = (auditResult as? AppResult.Ok)?.value ?: emptyList()

        val userActions = auditRecords.filter { it.eventType == EventType.ACTION }
        val hint = computeContextHint(scenario, userActions, session.graph)
        return ResponseEntity.ok(hint)
    }

    private fun isSessionAccessible(session: Session, authentication: Authentication): Boolean {
        val currentUserId = AuthUserIdResolver.resolveUserId(authentication) ?: return false
        val isAdmin = authentication.authorities.any { it.authority.equals("ROLE_admin", ignoreCase = true) }
        return isAdmin || session.userId == UserId(currentUserId)
    }

    private val actionLabelsRu = mapOf(
        "start" to "Пуск",
        "stop" to "Остановка",
        "set_power" to "Мощность, %",
        "set_temp" to "Температура, °C",
        "set_valve" to "Клапан, %",
    )

    private fun actionLabelRu(actionId: String): String = actionLabelsRu[actionId] ?: actionId

    private val nodeLabelsRu = mapOf(
        "feed_pump" to "Н-82",
        "preheater" to "А-19",
        "dehydrator" to "Э-1",
        "tank" to "Е-16",
        "regulator" to "Р-11",
        "furnace" to "Печь",
        "output" to "Выход",
    )

    private fun nodeLabelRu(nodeId: String): String = nodeLabelsRu[nodeId] ?: nodeId

    private fun computeContextHint(
        scenario: ru.itcamp.elouav.scenario.model.Scenario,
        userActions: List<AuditRecord>,
        graph: ru.itcamp.elouav.sim.model.Graph,
    ): Map<String, Any> {
        val allExpected = scenario.phases.flatMap { it.expectedActions }
        if (allExpected.isEmpty()) return mapOf("text" to "Нет ожидаемых действий", "phase" to "")

        val completedActions = userActions.mapNotNull { rec ->
            val data = rec.data ?: return@mapNotNull null
            Triple(data.node.value, data.action, data.value)
        }

        for (phase in scenario.phases) {
            val phaseActions = phase.expectedActions
            val allPhaseDone = phaseActions.all { ea ->
                completedActions.any { (node, action, _) -> node == ea.node && action == ea.action }
            }
            if (!allPhaseDone) {
                val nextAction = phaseActions.firstOrNull { ea ->
                    !completedActions.any { (node, action, _) -> node == ea.node && action == ea.action }
                }
                if (nextAction != null) {
                    val nodeName = nodeLabelRu(nextAction.node)
                    val actionName = actionLabelRu(nextAction.action)
                    val valuePart = nextAction.value?.let { " = $it" } ?: ""
                    val phaseHint = scenario.bankHints.find { it.key == phase.id }?.text ?: ""
                    return mapOf(
                        "text" to "Следующее действие: $nodeName - $actionName$valuePart",
                        "phase" to phase.title,
                        "phaseId" to phase.id,
                        "hint" to phaseHint,
                        "node" to nextAction.node,
                        "action" to nextAction.action,
                    )
                }
            }
        }

        return mapOf("text" to "Все фазы выполнены. Можно завершать сессию.", "phase" to "Завершение")
    }

    private fun applyInitialState(graph: Graph, overrides: Map<String, Map<String, Any>>): Graph {
        var g = graph
        for ((nodeIdStr, props) in overrides) {
            val nodeId = NodeId(nodeIdStr)
            val node = g.node(nodeId) ?: continue
            val modeStr = (props["mode"] as? String) ?: "RUNNING"
            val mode = runCatching { NodeMode.valueOf(modeStr) }.getOrDefault(NodeMode.RUNNING)
            val params = (props["parameters"] as? Map<*, *>)?.entries
                ?.filter { it.key is String && it.value is Number }
                ?.associate { it.key as String to (it.value as Number).toDouble() } ?: emptyMap()
            var newState = node.state.withMode(mode)
            for ((param, value) in params) {
                newState = newState.withParameter(param, value)
            }
            g = g.updateNode(nodeId, newState)
        }
        return g
    }

    private fun isAiAllowed(authentication: Authentication): Boolean {
        if (!authentication.isAuthenticated) {
            return false
        }
        val isAdmin = authentication.authorities.any { it.authority.equals("ROLE_admin", ignoreCase = true) }
        val isStudent = authentication.authorities.any { it.authority.equals("ROLE_student", ignoreCase = true) }
        val isInstructor = authentication.authorities.any { it.authority.equals("ROLE_instructor", ignoreCase = true) }
        val isMethodist = authentication.authorities.any { it.authority.equals("ROLE_methodist", ignoreCase = true) }
        return isAdmin || isStudent || isInstructor || isMethodist
    }

    private fun isPayloadWithinLimits(vararg values: String?, maxTextLength: Int, maxPayloadSize: Int): Boolean {
        val totalLength = values.filterNotNull().sumOf { it.length }
        if (totalLength > maxPayloadSize) return false
        return values.all { it == null || it.length <= maxTextLength }
    }

    private fun hasWriteAccess(authentication: Authentication): Boolean {
        val authorities = authentication.authorities.map { it.authority.lowercase() }
        return authorities.contains("role_student") || authorities.contains("role_admin") || authorities.contains("role_instructor")
            if (firstNl >= 0) s = s.substring(firstNl + 1)
            val fenceEnd = s.lastIndexOf("```")
            if (fenceEnd >= 0) s = s.substring(0, fenceEnd)
            s = s.trim()
        }
        val jsonStart = s.indexOf("{")
        val jsonEnd = s.lastIndexOf("}")
        return if (jsonStart >= 0 && jsonEnd > jsonStart) s.substring(jsonStart, jsonEnd + 1) else s
    }
}
