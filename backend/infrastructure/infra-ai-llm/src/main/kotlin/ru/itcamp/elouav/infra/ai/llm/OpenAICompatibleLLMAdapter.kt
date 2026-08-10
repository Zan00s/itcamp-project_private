package ru.itcamp.elouav.infra.ai.llm

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import ru.itcamp.elouav.ai.model.AIVerdict
import ru.itcamp.elouav.ai.model.JudgeRequest
import ru.itcamp.elouav.ai.model.Semantics
import ru.itcamp.elouav.ai.port.LLMChat
import ru.itcamp.elouav.ai.port.LLMJudge
import ru.itcamp.elouav.ai.port.VerdictCache
import ru.itcamp.elouav.shared.AppResult
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

class OpenAICompatibleLLMAdapter(
    private val endpoint: String,
    private val apiKey: String,
    private val model: String = "gpt-4o-mini",
    private val cache: VerdictCache? = null,
    private val mapper: ObjectMapper = jacksonObjectMapper(),
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build(),
) : LLMJudge, LLMChat {

    private val log = LoggerFactory.getLogger("ru.itcamp.elouav.llm")
    private val promptVersion = 1

    override suspend fun chat(systemPrompt: String, userPrompt: String): AppResult<String> =
        chat(systemPrompt, userPrompt, jsonMode = false)

    override suspend fun chat(systemPrompt: String, userPrompt: String, jsonMode: Boolean): AppResult<String> {
        log.info("[LLM chat] model={}, jsonMode={}, systemPromptLen={}, userPromptLen={}", model, jsonMode, systemPrompt.length, userPrompt.length)
        return try {
            val response = withContext(Dispatchers.IO) {
                callLLM(systemPrompt, userPrompt, temperature = 0.5, maxTokens = 800, jsonMode = jsonMode)
            }
            log.info("[LLM chat] response len={}, preview={}", response.length, response.take(200))
            AppResult.Ok(response)
        } catch (e: Exception) {
            log.error("[LLM chat] FAILED: {}", e.message, e)
            AppResult.Err("LLM chat failed: ${e.message}", e)
        }
    }

    override suspend fun judge(request: JudgeRequest): AppResult<AIVerdict> {
        val cacheKey = buildCacheKey(request)
        cache?.get(cacheKey)?.let {
            log.debug("[LLM judge] cache hit for key={}", cacheKey)
            return AppResult.Ok(it)
        }

        val prompt = buildPrompt(request)
        val startTime = System.currentTimeMillis()

        return try {
            val response = withContext(Dispatchers.IO) {
                callLLM(
                    systemPrompt = "Ты — эксперт-судья тренажёра оператора НПЗ. Отвечай только в JSON.",
                    userPrompt = prompt,
                    temperature = 0.3,
                    maxTokens = 300,
                    jsonMode = true,
                )
            }
            log.info("[LLM judge] response len={}, preview={}", response.length, response.take(200))

            val latency = System.currentTimeMillis() - startTime
            val verdict = parseVerdict(response, latency)

            cache?.put(cacheKey, verdict)
            AppResult.Ok(verdict)
        } catch (e: Exception) {
            log.error("[LLM judge] FAILED: {}", e.message, e)
            AppResult.Err("LLM judge failed: ${e.message}", e)
        }
    }

    private fun buildPrompt(request: JudgeRequest): String {
        return """
            Ты — судья-эксперт тренажёра оператора НПЗ (установка ЭЛОУ-АВ).
            Оцени действие оператора по шкале 0-100.

            Сценарий: ${request.scenarioGoal}
            Текущая фаза: ${request.currentPhase}

            Ожидаемое действие:
            ${request.expected?.let { "Узел: ${it.node}, действие: ${it.action}, значение: ${it.value}, допустимый диапазон: ${it.rampOk}" } ?: "Нет строгого ожидания"}

            Фактическое действие:
            Узел: ${request.actual.node}, действие: ${request.actual.action}, значение: ${request.actual.value}, результат: ${request.actual.result}

            Каскадные изменения:
            ${request.chain.joinToString("\n") { "  Узел ${it.node}: изменены параметры ${it.changed}" }}

            Состояние до: ${formatStates(request.stateBefore)}
            Состояние после: ${formatStates(request.stateAfter)}

            Ответь строго в JSON:
            {"grade": <0-100>, "semantics": "VALID|VALID_ALT|WRONG|DANGEROUS", "confidence": <0.0-1.0>, "reason": "<краткое объяснение>"}
        """.trimIndent()
    }

    private fun formatStates(states: Map<String, Map<String, Double>>): String =
        states.entries.joinToString(", ") { (node, params) ->
            "$node(${params.entries.joinToString(", ") { "${it.key}=${it.value}" }})"
        }

    private fun callLLM(
        systemPrompt: String,
        userPrompt: String,
        temperature: Double = 0.3,
        maxTokens: Int = 300,
        jsonMode: Boolean = false,
    ): String {
        val bodyMap = mutableMapOf(
            "model" to model,
            "messages" to listOf(
                mapOf("role" to "system", "content" to systemPrompt),
                mapOf("role" to "user", "content" to userPrompt),
            ),
            "temperature" to temperature,
            "max_tokens" to maxTokens,
        )
        if (jsonMode) {
            bodyMap["response_format"] = mapOf("type" to "json_object")
        }
        val requestBody = mapper.writeValueAsString(bodyMap)

        log.info("[LLM request] POST {}/v1/chat/completions model={} temp={} maxTokens={} jsonMode={}",
            endpoint, model, temperature, maxTokens, jsonMode)
        log.debug("[LLM request] body={}", requestBody)

        val request = HttpRequest.newBuilder()
            .uri(URI.create("$endpoint/v1/chat/completions"))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer $apiKey")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build()

        val startTime = System.currentTimeMillis()
        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        val latency = System.currentTimeMillis() - startTime

        log.info("[LLM response] status={} latency={}ms bodyLen={}", response.statusCode(), latency, response.body().length)
        log.debug("[LLM response] body={}", response.body().take(2000))

        if (response.statusCode() !in 200..299) {
            log.error("[LLM response] error status={}, body={}", response.statusCode(), response.body())
            throw RuntimeException("LLM API returned ${response.statusCode()}: ${response.body()}")
        }

        val json: Map<String, Any> = mapper.readValue(response.body())
        val choices = json["choices"] as? List<*> ?: throw RuntimeException("No choices in response")
        val firstChoice = choices.firstOrNull() as? Map<*, *> ?: throw RuntimeException("Empty choices")
        val message = firstChoice["message"] as? Map<*, *> ?: throw RuntimeException("No message")
        val content = message["content"] as? String ?: throw RuntimeException("No content")
        log.info("[LLM response] content len={} usage={}", content.length, json["usage"])
        return content
    }

    private fun parseVerdict(content: String, latencyMs: Long): AIVerdict {
        val jsonStart = content.indexOf("{")
        val jsonEnd = content.lastIndexOf("}") + 1
        val jsonStr = if (jsonStart >= 0 && jsonEnd > jsonStart) content.substring(jsonStart, jsonEnd) else content

        return try {
            val parsed: Map<String, Any> = mapper.readValue(jsonStr)
            AIVerdict(
                grade = (parsed["grade"] as? Number)?.toInt() ?: 50,
                semantics = when (parsed["semantics"] as? String) {
                    "VALID" -> Semantics.VALID
                    "VALID_ALT" -> Semantics.VALID_ALT
                    "WRONG" -> Semantics.WRONG
                    "DANGEROUS" -> Semantics.DANGEROUS
                    else -> Semantics.WRONG
                },
                confidence = (parsed["confidence"] as? Number)?.toDouble() ?: 0.5,
                reason = parsed["reason"] as? String ?: "No reason provided",
                model = model,
                promptVersion = promptVersion,
                latencyMs = latencyMs,
            )
        } catch (e: Exception) {
            AIVerdict(
                grade = 50,
                semantics = Semantics.WRONG,
                confidence = 0.0,
                reason = "Failed to parse LLM response: ${e.message}",
                model = model,
                promptVersion = promptVersion,
                latencyMs = latencyMs,
            )
        }
    }

    private fun buildCacheKey(request: JudgeRequest): String {
        return "${request.actual.node}:${request.actual.action}:${request.actual.value}:${request.currentPhase}"
    }
}
