package ru.itcamp.elouav.scoring.port

import ru.itcamp.elouav.audit.model.AuditRecord
import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.SessionId

interface AuditReaderPort {
    fun readBySession(sessionId: SessionId): AppResult<List<AuditRecord>>
}

interface AIJudgePort {
    suspend fun getSemanticsScore(sessionId: SessionId): AppResult<Double>
    suspend fun getReasoningScore(sessionId: SessionId): AppResult<Double>
}

interface VerdictWriter {
    fun write(verdict: ru.itcamp.elouav.scoring.model.Verdict): AppResult<Unit>
}
