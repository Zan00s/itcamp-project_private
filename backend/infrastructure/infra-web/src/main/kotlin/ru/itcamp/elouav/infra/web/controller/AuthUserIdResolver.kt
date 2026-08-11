package ru.itcamp.elouav.infra.web.controller

import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.jwt.Jwt

object AuthUserIdResolver {

    fun resolveUserId(authentication: Authentication?): String? {
        if (authentication == null || !authentication.isAuthenticated) {
            return null
        }

        val principal = authentication.principal
        return when (principal) {
            is Jwt -> {
                principal.getClaimAsString("preferred_username")
                    ?: principal.getClaimAsString("sub")
                    ?: principal.subject
            }
            else -> authentication.name
        }?.takeIf { it.isNotBlank() }
    }
}
