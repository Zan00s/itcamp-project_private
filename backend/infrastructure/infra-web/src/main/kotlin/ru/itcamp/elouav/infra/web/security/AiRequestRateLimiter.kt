package ru.itcamp.elouav.infra.web.security

import java.util.concurrent.ConcurrentHashMap

class AiRequestRateLimiter(
    private val maxRequests: Int = 10,
    private val windowMs: Long = 60_000,
) {
    private val buckets = ConcurrentHashMap<String, MutableList<Long>>()

    fun allow(key: String): Boolean {
        val now = System.currentTimeMillis()
        val windowStart = now - windowMs
        val timestamps = buckets.computeIfAbsent(key) { mutableListOf() }

        synchronized(timestamps) {
            timestamps.removeAll { it < windowStart }
            if (timestamps.size >= maxRequests) {
                return false
            }
            timestamps.add(now)
            return true
        }
    }
}
