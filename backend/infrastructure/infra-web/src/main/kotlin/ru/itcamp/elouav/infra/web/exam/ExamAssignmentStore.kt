package ru.itcamp.elouav.infra.web.exam

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import ru.itcamp.elouav.app.scenario.LoadScenarioUseCase
import ru.itcamp.elouav.infra.web.dto.ExamAssignmentDTO
import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.ScenarioId
import java.sql.Timestamp
import java.util.concurrent.atomic.AtomicLong

@Component
class ExamAssignmentStore(
    private val loadScenarioUseCase: LoadScenarioUseCase,
    private val jdbc: JdbcTemplate,
) {
    private val idCounter = AtomicLong(System.currentTimeMillis())

    fun assign(scenarioId: String, studentId: String, assignedBy: String): ExamAssignmentDTO {
        val scenarioName = (loadScenarioUseCase.execute(ScenarioId(scenarioId)) as? AppResult.Ok)?.value?.name
            ?: scenarioId
        val id = "exam-${idCounter.incrementAndGet()}"
        val now = java.time.Instant.now()
        jdbc.update(
            """INSERT INTO exam_assignments (id, scenario_id, scenario_name, student_id, assigned_by, assigned_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            id, scenarioId, scenarioName, studentId, assignedBy, Timestamp.from(now),
        )
        return ExamAssignmentDTO(
            id = id,
            scenarioId = scenarioId,
            scenarioName = scenarioName,
            studentId = studentId,
            assignedBy = assignedBy,
            assignedAt = now.toString(),
        )
    }

    fun listForStudent(studentId: String): List<ExamAssignmentDTO> =
        jdbc.query(
            """SELECT id, scenario_id, scenario_name, student_id, assigned_by, assigned_at
               FROM exam_assignments WHERE student_id = ? ORDER BY assigned_at DESC""",
            { rs, _ -> rowToDto(rs) },
            studentId,
        )

    fun listAll(): List<ExamAssignmentDTO> =
        jdbc.query(
            """SELECT id, scenario_id, scenario_name, student_id, assigned_by, assigned_at
               FROM exam_assignments ORDER BY assigned_at DESC""",
        ) { rs, _ -> rowToDto(rs) }

    fun remove(id: String): Boolean = jdbc.update("DELETE FROM exam_assignments WHERE id = ?", id) > 0

    private fun rowToDto(rs: java.sql.ResultSet): ExamAssignmentDTO = ExamAssignmentDTO(
        id = rs.getString("id"),
        scenarioId = rs.getString("scenario_id"),
        scenarioName = rs.getString("scenario_name"),
        studentId = rs.getString("student_id"),
        assignedBy = rs.getString("assigned_by"),
        assignedAt = rs.getTimestamp("assigned_at").toInstant().toString(),
    )
}
