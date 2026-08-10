package ru.itcamp.elouav.app.session

import ru.itcamp.elouav.shared.Clock
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.shared.ScenarioId
import ru.itcamp.elouav.shared.SessionId
import ru.itcamp.elouav.shared.UserId
import ru.itcamp.elouav.scoring.model.Verdict
import ru.itcamp.elouav.sim.model.Graph
import ru.itcamp.elouav.sim.model.NodeState
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

data class Session(
    val id: SessionId,
    val scenarioId: ScenarioId,
    val userId: UserId,
    val attempt: Int,
    val graph: Graph,
    val startedAt: Instant,
    var endedAt: Instant? = null,
    var active: Boolean = true,
    var verdict: Verdict? = null,
)

interface SessionPersistence {
    fun save(session: Session)
    fun loadAll(): List<Session>
}

class SessionStore(
    private val persistence: SessionPersistence? = null,
) {
    private val sessions = ConcurrentHashMap<SessionId, Session>()

    init {
        persistence?.loadAll()?.forEach { sessions[it.id] = it }
    }

    fun create(scenarioId: ScenarioId, userId: UserId, graph: Graph, attempt: Int = 1): Session {
        val session = Session(
            id = SessionId("sess-${System.nanoTime()}"),
            scenarioId = scenarioId,
            userId = userId,
            attempt = attempt,
            graph = graph,
            startedAt = Clock.now(),
        )
        sessions[session.id] = session
        persistence?.save(session)
        return session
    }

    fun get(id: SessionId): Session? = sessions[id]

    fun update(id: SessionId, graph: Graph) {
        sessions[id]?.let {
            val updated = it.copy(graph = graph)
            sessions[id] = updated
            persistence?.save(updated)
        }
    }

    fun end(id: SessionId) {
        sessions[id]?.let {
            val updated = it.copy(active = false, endedAt = Clock.now())
            sessions[id] = updated
            persistence?.save(updated)
        }
    }

    fun setVerdict(id: SessionId, verdict: Verdict) {
        sessions[id]?.let {
            val updated = it.copy(verdict = verdict)
            sessions[id] = updated
            persistence?.save(updated)
        }
    }

    fun all(): List<Session> = sessions.values.toList()

    fun activeByUser(userId: UserId): List<Session> =
        sessions.values.filter { it.userId == userId && it.active }
}

class StartSessionUseCase(
    private val store: SessionStore = SessionStore(null),
) {
    fun execute(
        scenarioId: ScenarioId,
        userId: UserId,
        graph: Graph,
        attempt: Int = 1,
    ): Session = store.create(scenarioId, userId, graph, attempt)
}

class EndSessionUseCase(
    private val store: SessionStore = SessionStore(null),
) {
    fun execute(sessionId: SessionId) {
        store.end(sessionId)
    }
}
