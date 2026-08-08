package ru.itcamp.elouav.infra.ai.llm

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.itcamp.elouav.ai.model.AIVerdict
import ru.itcamp.elouav.ai.model.JudgeRequest
import ru.itcamp.elouav.ai.model.Semantics
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
) : LLMJudge {

    private val promptVersion = 1

    override suspend fun judge(request: JudgeRequest): AppResult<AIVerdict> {
        val cacheKey = buildCacheKey(request)
        cache?.get(cacheKey)?.let { return AppResult.Ok(it) }

        val prompt = buildPrompt(request)
        val startTime = System.currentTimeMillis()

        return try {
            val response = withContext(Dispatchers.IO) {
                callLLM(prompt)
            }

            val latency = System.currentTimeMillis() - startTime
            val verdict = parseVerdict(response, latency)

            cache?.put(cacheKey, verdict)
            AppResult.Ok(verdict)
        } catch (e: Exception) {
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

    private fun callLLM(prompt: String): String {
        val requestBody = mapper.writeValueAsString(mapOf(
            "model" to model,
            "messages" to listOf(
                mapOf("role" to "system", "content" to "Ты — эксперт-судья тренажёра оператора НПЗ. Отвечай только в JSON."),
                mapOf("role" to "user", "content" to prompt),
            ),
            "temperature" to 0.3,
            "max_tokens" to 300,
        ))

        val request = HttpRequest.newBuilder()
            .uri(URI.create("$endpoint/v1/chat/completions"))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer $apiKey")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())

        if (response.statusCode() !in 200..299) {
            throw RuntimeException("LLM API returned ${response.statusCode()}: ${response.body()}")
        }

        val json: Map<String, Any> = mapper.readValue(response.body())
        val choices = json["choices"] as? List<*> ?: throw RuntimeException("No choices in response")
        val firstChoice = choices.firstOrNull() as? Map<*, *> ?: throw RuntimeException("Empty choices")
        val message = firstChoice["message"] as? Map<*, *> ?: throw RuntimeException("No message")
        return message["content"] as? String ?: throw RuntimeException("No content")
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
