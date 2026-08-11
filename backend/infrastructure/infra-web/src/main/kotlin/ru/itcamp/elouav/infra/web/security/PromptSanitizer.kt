package ru.itcamp.elouav.infra.web.security

object PromptSanitizer {
    private const val REDACTED = "[redacted]"
    private val suspiciousPatterns = listOf(
        Regex("(?i)ignore previous instructions"),
        Regex("(?i)system prompt"),
        Regex("(?i)reveal secrets"),
        Regex("(?i)drop\\s+table"),
        Regex("(?i)union\\s+select"),
        Regex("(?i)(<script|javascript:|onerror=|onload=)"),
    )
    private val secretPatterns = listOf(
        Regex("(?i)\\b(api[_-]?key|token|secret|password|passwd|authorization)\\b[^\\n]{0,40}[:=]\\s*([A-Za-z0-9_\\-./+=]{4,})"),
        Regex("(?i)\\beyJ[A-Za-z0-9\\-_=]+\\.[A-Za-z0-9\\-_=]+\\.[A-Za-z0-9\\-_=]+\\b"),
        Regex("(?i)\\b(sk|ghp|gho|github_pat|xox[baprs]-[A-Za-z0-9-]{10,})\\b"),
        Regex("(?i)-----BEGIN (?:RSA|OPENSSH|EC|DSA|PGP) PRIVATE KEY-----"),
        Regex("(?i)\\b(?:pk_live|pk_test|sk_live|sk_test)_[A-Za-z0-9]{10,}\\b"),
    )

    fun sanitize(value: String?, maxLength: Int): String? {
        if (value == null) return null
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return null

        if (suspiciousPatterns.any { it.containsMatchIn(trimmed) } || secretPatterns.any { it.containsMatchIn(trimmed) }) {
            return REDACTED
        }

        val safe = trimmed
            .replace(Regex("(?i)(<script|javascript:|onerror=|onload=)"), "")
            .replace(Regex("\\s+"), " ")
            .trim()

        return safe.takeIf { it.isNotEmpty() }?.take(maxLength)
    }
}
