package ru.itcamp.elouav.audit.port

import ru.itcamp.elouav.audit.model.AuditRecord
import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.SessionId

interface AuditRepository {
    fun append(record: AuditRecord): Result<Unit>
    fun readBySession(sessionId: SessionId): Result<List<AuditRecord>>
}

interface AuditReader {
    fun readBySession(sessionId: SessionId): Result<List<AuditRecord>>
}
