package ru.itcamp.elouav.infra.cache

import ru.itcamp.elouav.ai.model.AIVerdict
import ru.itcamp.elouav.ai.port.VerdictCache
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

class InMemoryVerdictCache(
    private val ttlSeconds: Long = 3600,
) : VerdictCache {
    private val cache = ConcurrentHashMap<String, CacheEntry>()

    override fun get(key: String): AIVerdict? {
        val entry = cache[key] ?: return null
        if (System.currentTimeMillis() - entry.timestamp > TimeUnit.SECONDS.toMillis(ttlSeconds)) {
            cache.remove(key)
            return null
        }
        return entry.verdict
    }

    override fun put(key: String, verdict: AIVerdict) {
        cache[key] = CacheEntry(verdict, System.currentTimeMillis())
    }

    private data class CacheEntry(val verdict: AIVerdict, val timestamp: Long)
}
