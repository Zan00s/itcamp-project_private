package ru.itcamp.elouav.app.session

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.shared.PortId
import ru.itcamp.elouav.shared.ScenarioId
import ru.itcamp.elouav.shared.SessionId
import ru.itcamp.elouav.shared.UserId
import ru.itcamp.elouav.sim.model.Graph
import ru.itcamp.elouav.sim.model.Node
import ru.itcamp.elouav.sim.model.NodeMode
import ru.itcamp.elouav.sim.model.NodeState

class SessionStoreTest {

    private fun testGraph(): Graph = Graph.of(
        listOf(
            Node(
                id = NodeId("test"),
                type = "test",
                name = "Test",
                state = NodeState(NodeMode.STOPPED, mapOf("val" to 0.0)),
            )
        ),
        emptyList()
    )

    @Test
    fun `create session with attempt`() {
        val store = SessionStore()
        val session = store.create(
            ScenarioId("sc1"),
            UserId("user1"),
            testGraph(),
            attempt = 1,
        )
        session.attempt shouldBe 1
        session.active shouldBe true
        store.get(session.id) shouldBe session
    }

    @Test
    fun `end session sets active false and endedAt`() {
        val store = SessionStore()
        val session = store.create(ScenarioId("sc1"), UserId("u1"), testGraph(), 1)
        store.end(session.id)
        val ended = store.get(session.id)!!
        ended.active shouldBe false
        assert(ended.endedAt != null)
    }

    @Test
    fun `all returns all sessions`() {
        val store = SessionStore()
        store.create(ScenarioId("sc1"), UserId("u1"), testGraph(), 1)
        store.create(ScenarioId("sc1"), UserId("u1"), testGraph(), 2)
        store.create(ScenarioId("sc2"), UserId("u2"), testGraph(), 1)
        store.all().size shouldBe 3
    }

    @Test
    fun `activeByUser returns only active sessions for user`() {
        val store = SessionStore()
        val s1 = store.create(ScenarioId("sc1"), UserId("u1"), testGraph(), 1)
        store.create(ScenarioId("sc1"), UserId("u2"), testGraph(), 1)
        store.end(s1.id)
        val active = store.activeByUser(UserId("u1"))
        active.size shouldBe 0
    }
}
