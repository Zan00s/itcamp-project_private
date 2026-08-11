package ru.itcamp.elouav.infra.web.controller

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken

class AuthUserIdResolverTest {

    @Test
    fun `extracts user id from jwt authentication`() {
        val jwt = Jwt.withTokenValue("token")
            .header("alg", "none")
            .claim("preferred_username", "alice")
            .build()

        val authentication = JwtAuthenticationToken(jwt, listOf(SimpleGrantedAuthority("ROLE_student")))

        assertEquals("alice", AuthUserIdResolver.resolveUserId(authentication))
    }
}
