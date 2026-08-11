package ru.itcamp.elouav.infra.web.controller

import org.springframework.beans.factory.annotation.Value
import org.springframework.http.ResponseEntity
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
import ru.itcamp.elouav.infra.web.exam.ExamAssignmentStore
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
    private val examAssignmentStore: ExamAssignmentStore,
    private val emergencyEventScheduler: ru.itcamp.elouav.infra.web.scheduler.EmergencyEventScheduler,
    @Value("\${KEYCLOAK_URL:http://localhost:8180}") private val keycloakUrl: String,
) {

    private val log = LoggerFactory.getLogger("ru.itcamp.elouav.api")

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
        @RequestHeader("X-User-Id") userId: String,
    ): ResponseEntity<SessionDTO> {
        if (req.scenarioId.isBlank()) {
            throw IllegalArgumentException("scenarioId не может быть пустым")
        }
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
    fun endSession(@PathVariable id: String): ResponseEntity<VerdictDTO> {
        val session = sessionStore.get(SessionId(id))
            ?: throw NoSuchElementException("Сессия $id не найдена")

        if (!session.active) {
            session.verdict?.let { return ResponseEntity.ok(DTOMapper.toVerdictDTO(it)) }
            throw IllegalStateException("Сессия уже завершена")
        }

        endSessionUseCase.execute(SessionId(id))
        emergencyEventScheduler.clearSession(SessionId(id))

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
    fun listSessions(): ResponseEntity<List<SessionInfoDTO>> {
        val sessions = sessionStore.all().sortedByDescending { it.startedAt }
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
    fun getSessionState(@PathVariable id: String): ResponseEntity<GraphDTO> {
        val session = sessionStore.get(SessionId(id))
            ?: throw NoSuchElementException("Сессия $id не найдена")
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

    @PostMapping("/scenarios/upload-docx", consumes = ["multipart/form-data"])
    fun uploadDocxScenario(
        @RequestParam("file") file: org.springframework.web.multipart.MultipartFile,
    ): ResponseEntity<Map<String, Any>> {
        if (file.isEmpty) {
            throw IllegalArgumentException("Файл пуст")
        }
        val originalName = file.originalFilename ?: "unknown.docx"
        log.info("[upload-docx] Получен файл: {}, размер={} байт", originalName, file.size)

        // Извлекаем текст из DOCX
        val extractedText = extractDocxText(file.inputStream)
        if (extractedText.isBlank()) {
            throw IllegalArgumentException("Не удалось извлечь текст из DOCX — файл пуст или повреждён")
        }
        log.info("[upload-docx] Извлечён текст: {} символов", extractedText.length)

        // Отправляем в LLM для генерации сценария
        val systemPrompt = """
            Ты — методист тренажёра оператора НПЗ (установка ЭЛОУ-АВТ).
            На основе описания ситуации в виде обычного текста создай структурированный сценарий обучения в формате JSON.
            Узлы графа: feed_pump (насос Н-82), preheater (смеситель А-19), dehydrator (электродегидратор Э-1), tank (ёмкость Е-16), regulator (регулятор Р-11), output (выход), heat_exchanger (теплообменник Т-1), column (колонна К-1).
            Действия: start, stop, set_power (0-100), set_temp (20-200), set_valve (0-100), set_voltage (0-1), set_drain (0-15000), increase_drain.
            Параметры узлов: power_percent, flow_rate, pressure_out, temperature, inlet_flow, pressure, level_mm, voltage_on, drain_flow, valve_pos, water_content, salt_mg_l, level, top_temp, bottom_temp.
            Режимы узлов: RUNNING (работает), STOPPED (остановлен).
            Ответь СТРОГО в JSON без markdown-обрамления и без пояснений.
            JSON-схема: {"name":"...","timeoutSec":1800,"difficulty":2,"initialState":[{"node":"feed_pump","mode":"RUNNING","parameters":{"power_percent":80}}],"phases":[{"id":"ph1","title":"...","expectedActions":[{"node":"feed_pump","action":"start","value":null}]}],"hints":[{"key":"ph1","text":"..."}]}
            В expectedActions используй поля node, action, value (число или null).
            В initialState укажи узлы, которые уже работают и их параметры на момент начала сценария.
            Следи за балансом скобок: каждый { должен быть закрыт }, каждая [ закрыта ].
        """.trimIndent()

        val userPrompt = """
            Ниже приведено описание ситуации для сценария обучения оператора НПЗ.
            Создай из него структурированный сценарий с 3-5 фазами, каждая фаза — 2-4 действия.
            Если в тексте описана авария или нештатная ситуация — задай initialState с предаварийным состоянием узлов.
            Описание:
            
            $extractedText
        """.trimIndent()

        val llmResult = kotlinx.coroutines.runBlocking { llmChat.chat(systemPrompt, userPrompt, jsonMode = true) }

        return when (llmResult) {
            is AppResult.Err -> ResponseEntity.ok(mapOf(
                "success" to false,
                "error" to "ИИ недоступен: ${llmResult.message}",
                "extractedText" to extractedText,
            ))
            is AppResult.Ok -> {
                val content = llmResult.value
                val jsonStr = extractJson(content)
                try {
                    val parsed: Map<String, Any> = jacksonObjectMapper().readValue(jsonStr)

                    // Создаём сценарий из распарсенного JSON
                    val createDto = parseScenarioFromMap(parsed)
                    val scenario = DTOMapper.fromCreateDTO(createDto)
                    val saveResult = saveScenarioUseCase.execute(scenario)
                    if (saveResult is AppResult.Err) {
                        return ResponseEntity.ok(mapOf(
                            "success" to false,
                            "error" to saveResult.message,
                            "scenario" to parsed,
                            "rawText" to content,
                        ))
                    }

                    log.info("[upload-docx] Сценарий '{}' сохранён: id={}", scenario.name, scenario.id.value)
                    ResponseEntity.ok(mapOf(
                        "success" to true,
                        "scenario" to DTOMapper.toScenarioDTO(scenario),
                        "extractedText" to extractedText,
                    ))
                } catch (e: Exception) {
                    log.warn("[upload-docx] Не удалось разобрать JSON: {}", e.message)
                    ResponseEntity.ok(mapOf(
                        "success" to false,
                        "error" to "Не удалось разобрать ответ ИИ: ${e.message}",
                        "rawText" to content,
                        "extractedText" to extractedText,
                    ))
                }
            }
        }
    }

    private fun extractDocxText(inputStream: java.io.InputStream): String {
        val sb = StringBuilder()
        org.apache.poi.xwpf.usermodel.XWPFDocument(inputStream).use { doc ->
            for (para in doc.paragraphs) {
                val text = para.text.trim()
                if (text.isNotEmpty()) sb.append(text).append("\n")
            }
            for (table in doc.tables) {
                for (row in table.rows) {
                    val cells = row.tableCells.map { it.text.trim() }
                    if (cells.any { it.isNotEmpty() }) {
                        sb.append(cells.joinToString(" | ")).append("\n")
                    }
                }
            }
        }
        return sb.toString().trim()
    }

    @Suppress("UNCHECKED_CAST")
    private fun parseScenarioFromMap(map: Map<String, Any>): ScenarioCreateDTO {
        val phasesRaw = (map["phases"] as? List<Any?>) ?: emptyList()
        val phases = phasesRaw.mapIndexed { idx, ph ->
            val p = ph as Map<String, Any>
            val actionsRaw = (p["expectedActions"] as? List<Any?>) ?: emptyList()
            PhaseCreateDTO(
                id = (p["id"] as? String) ?: "ph${idx + 1}",
                title = (p["title"] as? String) ?: "Фаза ${idx + 1}",
                expectedActions = actionsRaw.map { a ->
                    val am = a as Map<String, Any>
                    ExpectedActionDTO(
                        node = (am["node"] as? String) ?: "",
                        action = (am["action"] as? String) ?: "",
                        value = (am["value"] as? Number)?.toDouble(),
                    )
                },
            )
        }

        val initialStateRaw = (map["initialState"] as? List<Any?>) ?: emptyList()
        val initialState = initialStateRaw.map { s ->
            val sm = s as Map<String, Any>
            val paramsRaw = (sm["parameters"] as? Map<String, Any>) ?: emptyMap()
            InitialStateNodeDTO(
                node = (sm["node"] as? String) ?: "",
                mode = (sm["mode"] as? String) ?: "RUNNING",
                parameters = paramsRaw.entries
                    .filter { it.value is Number }
                    .associate { it.key to (it.value as Number).toDouble() },
            )
        }

        val hintsRaw = (map["hints"] as? List<Any?>) ?: emptyList()
        val hints = hintsRaw.map { h ->
            val hm = h as Map<String, Any>
            HintDTO(
                key = (hm["key"] as? String) ?: "ph1",
                text = (hm["text"] as? String) ?: "",
            )
        }

        return ScenarioCreateDTO(
            name = (map["name"] as? String) ?: "Импортированный сценарий",
            install = "ELOU-AV",
            timeoutSec = (map["timeoutSec"] as? Number)?.toInt() ?: 1800,
            difficulty = (map["difficulty"] as? Number)?.toInt() ?: 2,
            passingScore = 70,
            phases = phases,
            hints = hints,
            initialState = initialState,
        )
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
    fun generateScenarioDraft(@RequestBody req: ScenarioDraftRequestDTO): ResponseEntity<ScenarioDraftDTO> {
        log.info("[AI scenario-draft] topic={} difficulty={} timeout={} contextLen={}", req.topic, req.difficulty, req.timeoutSec, req.context?.length)
        val systemPrompt = """
            Ты — методист тренажёра оператора НПЗ (установка ЭЛОУ-АВТ).
            Создай черновик сценария обучения в формате JSON.
            Узлы графа: feed_pump (насос Н-82), preheater (смеситель А-19), dehydrator (электродегидратор Э-1), tank (ёмкость Е-16), regulator (регулятор Р-11), output (выход), heat_exchanger (теплообменник Т-1), column (колонна К-1).
            Действия: start, stop, set_power (0-100), set_temp (20-200), set_valve (0-100), set_voltage (0-1), set_drain (0-15000), increase_drain.
            Параметры узлов: power_percent, flow_rate, pressure_out, temperature, inlet_flow, pressure, level_mm, voltage_on, drain_flow, valve_pos, water_content, salt_mg_l, level, top_temp, bottom_temp.
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
            $it
            """.trimIndent()
        } ?: "Контекст не задан — создай сценарий с полного пуска установки (холодный старт)."

        val userPrompt = """
            Тема сценария: ${req.topic ?: "Пуск установки"}
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
    fun explainAction(@RequestBody req: ExplainActionRequestDTO): ResponseEntity<ExplainActionDTO> {
        log.info("[AI explain-action] node={} action={} value={} chainSize={}", req.node, req.action, req.value, req.chain?.size)
        val systemPrompt = """
            Ты — ИИ-ассистент тренажёра оператора НПЗ (установка ЭЛОУ-АВТ).
            Объясни студенту, как его действие повлияло на установку.
            Отвечай кратко на русском языке (2-4 предложения).
        """.trimIndent()

        val chainText = (req.chain ?: emptyList()).joinToString("; ") { c ->
            val changed = (c["changed"] as? List<*>)?.joinToString(", ") ?: ""
            "${c["node"]}: изменены $changed"
        }

        val userPrompt = """
            Действие: ${req.action ?: "действие"} на узле ${req.node ?: "узел"}${req.value?.let { ", значение: $it" } ?: ""}
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
    fun analyzeSession(@RequestBody req: SessionAnalysisRequestDTO): ResponseEntity<SessionAnalysisDTO> {
        val session = sessionStore.get(SessionId(req.sessionId))
            ?: throw NoSuchElementException("Сессия не найдена")

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

        val userPrompt = """
            Студент: ${session.userId.value}
            Сценарий: ${session.scenarioId.value}
            Попытка: ${session.attempt}
            Балл: $score/100
            Результат: ${verdict?.verdict?.name ?: "не завершён"}
            Обратная связь от системы: $feedbackText
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

    @GetMapping("/sessions/{id}/events")
    fun getSessionEvents(@PathVariable id: String): ResponseEntity<List<Map<String, Any>>> {
        val session = sessionStore.get(SessionId(id))
            ?: throw NoSuchElementException("Сессия $id не найдена")
        val auditResult = auditRepo.readBySession(SessionId(id))
        val records = (auditResult as? AppResult.Ok)?.value ?: emptyList()
        val events: List<Map<String, Any>> = records.filter {
            it.eventType == EventType.ALARM || it.eventType == EventType.WARNING || it.eventType == EventType.AUTO_EVENT
        }.map { rec ->
            mapOf<String, Any>(
                "timestamp" to rec.timestamp.toEpochMilli(),
                "eventType" to rec.eventType.name,
                "node" to (rec.data?.node?.value ?: ""),
                "nodeLabel" to nodeLabelRu(rec.data?.node?.value ?: ""),
                "action" to (rec.data?.action ?: ""),
                "actionLabel" to actionLabelRu(rec.data?.action ?: ""),
                "value" to (rec.data?.value as? Any ?: ""),
                "result" to (rec.data?.result?.name ?: ""),
            )
        }
        return ResponseEntity.ok(events)
    }

    @GetMapping("/sessions/{id}/hint")
    fun getContextHint(@PathVariable id: String): ResponseEntity<Map<String, Any>> {
        val session = sessionStore.get(SessionId(id))
            ?: throw NoSuchElementException("Сессия $id не найдена")
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

    private val actionLabelsRu = mapOf(
        "start" to "Пуск",
        "stop" to "Остановка",
        "set_power" to "Мощность, %",
        "set_temp" to "Температура, °C",
        "set_valve" to "Задвижка, %",
        "set_voltage" to "Подача напряжения",
        "increase_drain" to "Увеличить сброс в Е-16",
        "set_drain" to "Расход слива, м³/ч",
    )

    private fun actionLabelRu(actionId: String): String = actionLabelsRu[actionId] ?: actionId

    private val nodeLabelsRu = mapOf(
        "feed_pump" to "Н-82",
        "preheater" to "А-19",
        "dehydrator" to "Э-1",
        "tank" to "Е-16",
        "regulator" to "Р-11",
        "output" to "Выход",
        "heat_exchanger" to "Т-1",
        "column" to "К-1",
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

    private fun extractJson(content: String): String {
        var s = content.trim()
        if (s.startsWith("```")) {
            val firstNl = s.indexOf("\n")
            if (firstNl >= 0) s = s.substring(firstNl + 1)
            val fenceEnd = s.lastIndexOf("```")
            if (fenceEnd >= 0) s = s.substring(0, fenceEnd)
            s = s.trim()
        }
        val jsonStart = s.indexOf("{")
        val jsonEnd = s.lastIndexOf("}")
        return if (jsonStart >= 0 && jsonEnd > jsonStart) s.substring(jsonStart, jsonEnd + 1) else s
    }

    // === Exam assignments (instructor → student) ===

    @PostMapping("/exam-assignments")
    fun assignExam(
        @RequestBody req: ExamAssignmentRequestDTO,
        @RequestHeader("X-User-Id") instructorId: String,
    ): ResponseEntity<ExamAssignmentDTO> {
        if (req.scenarioId.isBlank() || req.studentId.isBlank()) {
            throw IllegalArgumentException("scenarioId и studentId обязательны")
        }
        val scenarioResult = loadScenarioUseCase.execute(ScenarioId(req.scenarioId))
        if (scenarioResult is AppResult.Err) {
            throw NoSuchElementException("Сценарий ${req.scenarioId} не найден")
        }
        val dto = examAssignmentStore.assign(req.scenarioId, req.studentId, instructorId)
        return ResponseEntity.ok(dto)
    }

    @GetMapping("/exam-assignments")
    fun listExamAssignments(
        @RequestParam(required = false) studentId: String?,
    ): ResponseEntity<List<ExamAssignmentDTO>> {
        val list = if (studentId != null) {
            examAssignmentStore.listForStudent(studentId)
        } else {
            examAssignmentStore.listAll()
        }
        return ResponseEntity.ok(list)
    }

    @DeleteMapping("/exam-assignments/{id}")
    fun removeExamAssignment(@PathVariable id: String): ResponseEntity<Map<String, String>> {
        val removed = examAssignmentStore.remove(id)
        if (!removed) {
            throw NoSuchElementException("Назначение $id не найдено")
        }
        return ResponseEntity.ok(mapOf("status" to "deleted", "id" to id))
    }

    @GetMapping("/keycloak/users")
    fun listKeycloakUsers(): ResponseEntity<List<Map<String, String>>> {
        return try {
            val token = getKeycloakAdminToken()
            val client = java.net.http.HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(5))
                .build()
            val request = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create("$keycloakUrl/admin/realms/elouav/users?max=100"))
                .timeout(java.time.Duration.ofSeconds(10))
                .header("Authorization", "Bearer $token")
                .GET()
                .build()
            val response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() in 200..299) {
                val users: List<Map<String, Any>> = jacksonObjectMapper().readValue(response.body())
                val result = users.map { u ->
                    mapOf(
                        "id" to (u["id"] as? String ?: ""),
                        "username" to (u["username"] as? String ?: ""),
                        "firstName" to (u["firstName"] as? String ?: ""),
                        "lastName" to (u["lastName"] as? String ?: ""),
                        "email" to (u["email"] as? String ?: ""),
                    )
                }
                ResponseEntity.ok(result)
            } else {
                ResponseEntity.ok(emptyList())
            }
        } catch (e: Exception) {
            log.warn("[keycloak-users] error: {}", e.message)
            ResponseEntity.ok(emptyList())
        }
    }

    private fun getKeycloakAdminToken(): String {
        val client = java.net.http.HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(5))
            .build()
        val body = "client_id=admin-cli&username=admin&password=admin&grant_type=password"
        val request = java.net.http.HttpRequest.newBuilder()
            .uri(java.net.URI.create("$keycloakUrl/realms/master/protocol/openid-connect/token"))
            .timeout(java.time.Duration.ofSeconds(10))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(java.net.http.HttpRequest.BodyPublishers.ofString(body))
            .build()
        val response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw IllegalStateException("Keycloak admin token failed: ${response.statusCode()}")
        }
        val json: Map<String, Any> = jacksonObjectMapper().readValue(response.body())
        return json["access_token"] as String
    }
}
