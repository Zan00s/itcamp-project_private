package ru.itcamp.elouav.infra.db

import com.fasterxml.jackson.core.JsonParser
import com.fasterxml.jackson.databind.DeserializationContext
import com.fasterxml.jackson.databind.JsonDeserializer
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.KeyDeserializer
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.module.SimpleModule
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.springframework.jdbc.core.JdbcTemplate
import ru.itcamp.elouav.app.session.Session
import ru.itcamp.elouav.app.session.SessionPersistence
import ru.itcamp.elouav.scoring.model.Verdict
import ru.itcamp.elouav.scoring.model.VerdictType
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.shared.PortId
import ru.itcamp.elouav.shared.ScenarioId
import ru.itcamp.elouav.shared.SessionId
import ru.itcamp.elouav.shared.UserId
import ru.itcamp.elouav.sim.model.Graph
import java.sql.Timestamp

class ClosedRangeDeserializer : JsonDeserializer<ClosedRange<Double>>() {
    override fun deserialize(p: JsonParser, ctxt: DeserializationContext): ClosedRange<Double> {
        val node: JsonNode = p.codec.readTree(p)
        val start = node.get("start").asDouble()
        val end = node.get("end").asDouble()
        return start..end
    }
}

data class VerificationVerdict(
    val sessionId: String,
    val scenarioId: String,
    val attempt: Int,
    val verdict: String,
    val score: Int,
    val achievements: List<String> = emptyList(),
    val feedback: List<String> = emptyList(),
    val aiUsed: Boolean = false,
)

class JdbcSessionPersistence(
    private val jdbc: JdbcTemplate,
) : SessionPersistence {

    private val mapper: ObjectMapper = jacksonObjectMapper()
        .registerModule(JavaTimeModule())
        .registerModule(valueClassKeyModule())
        .apply {
            val sm = SimpleModule("closedRange")
            sm.addDeserializer(ClosedRange::class.java, ClosedRangeDeserializer())
            registerModule(sm)
        }

    private fun valueClassKeyModule(): SimpleModule {
        val module = SimpleModule("valueClassKeys")
        module.addKeyDeserializer(NodeId::class.java, object : KeyDeserializer() {
            override fun deserializeKey(key: String, ctxt: DeserializationContext) = NodeId(key)
        })
        module.addKeyDeserializer(PortId::class.java, object : KeyDeserializer() {
            override fun deserializeKey(key: String, ctxt: DeserializationContext) = PortId(key)
        })
        module.addKeyDeserializer(SessionId::class.java, object : KeyDeserializer() {
            override fun deserializeKey(key: String, ctxt: DeserializationContext) = SessionId(key)
        })
        module.addKeyDeserializer(ScenarioId::class.java, object : KeyDeserializer() {
            override fun deserializeKey(key: String, ctxt: DeserializationContext) = ScenarioId(key)
        })
        module.addKeyDeserializer(UserId::class.java, object : KeyDeserializer() {
            override fun deserializeKey(key: String, ctxt: DeserializationContext) = UserId(key)
        })
        return module
    }

    override fun save(session: Session) {
        val graphJson = mapper.writeValueAsString(session.graph)
        val verdictJson = session.verdict?.let { sanitizeVerdict(it) }?.let { mapper.writeValueAsString(it) }
        jdbc.update(
            """INSERT INTO sessions (id, scenario_id, user_id, attempt, active, started_at, ended_at, graph, verdict)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb)
               ON CONFLICT (id) DO UPDATE SET
                 scenario_id = EXCLUDED.scenario_id,
                 user_id = EXCLUDED.user_id,
                 attempt = EXCLUDED.attempt,
                 active = EXCLUDED.active,
                 started_at = EXCLUDED.started_at,
                 ended_at = EXCLUDED.ended_at,
                 graph = EXCLUDED.graph,
                 verdict = EXCLUDED.verdict""",
            session.id.value,
            session.scenarioId.value,
            session.userId.value,
            session.attempt,
            session.active,
            Timestamp.from(session.startedAt),
            session.endedAt?.let { Timestamp.from(it) },
            graphJson,
            verdictJson,
        )
    }

    private fun sanitizeVerdict(verdict: Verdict): VerificationVerdict = VerificationVerdict(
        sessionId = verdict.sessionId.value,
        scenarioId = verdict.scenarioId,
        attempt = verdict.attempt,
        verdict = verdict.verdict.name,
        score = verdict.score.total,
        achievements = verdict.achievements,
        feedback = verdict.feedback.map { it.text },
        aiUsed = verdict.aiUsed,
    )

    override fun loadAll(): List<Session> {
        return try {
            val rows = jdbc.query(
                """SELECT id, scenario_id, user_id, attempt, active, started_at, ended_at, graph, verdict FROM sessions""",
            ) { rs, _ ->
                val graphJson = rs.getString("graph")
                val graph: Graph = mapper.readValue(graphJson)
                val verdictJson = rs.getString("verdict")
                val verdict: Verdict? = verdictJson?.let { mapper.readValue<VerificationVerdict>(it) }
                Session(
                    id = SessionId(rs.getString("id")),
                    scenarioId = ScenarioId(rs.getString("scenario_id")),
                    userId = UserId(rs.getString("user_id")),
                    attempt = rs.getInt("attempt"),
                    graph = graph,
                    startedAt = rs.getTimestamp("started_at").toInstant(),
                    endedAt = rs.getTimestamp("ended_at")?.toInstant(),
                    active = rs.getBoolean("active"),
                    verdict = verdict,
                )
            }
            rows
        } catch (e: Exception) {
            emptyList()
        }
    }
}
