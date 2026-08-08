package ru.itcamp.elouav.scoring.port

import ru.itcamp.elouav.audit.model.AuditRecord
import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.SessionId

interface AuditReaderPort {
    fun readBySession(sessionId: SessionId): Result<List<AuditRecord>>
}

interface AIJudgePort {
    suspend fun getSemanticsScore(sessionId: SessionId): Result<Double>
    suspend fun getReasoningScore(sessionId: SessionId): Result<Double>
}

interface VerdictWriter {
    fun write(verdict: ru.itcamp.elouav.scoring.model.Verdict): Result<Unit>
}
