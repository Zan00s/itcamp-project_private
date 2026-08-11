package ru.itcamp.elouav.infra.web.security

import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import ru.itcamp.elouav.infra.web.controller.AuthUserIdResolver

class ApiControllerSecurityTest {

    @Test
    fun `resolver rejects unauthenticated user`() {
        val authentication = UsernamePasswordAuthenticationToken("anonymous", null, emptyList())
        authentication.isAuthenticated = false

        assertNull(AuthUserIdResolver.resolveUserId(authentication))
    }

    @Test
    fun `resolver extracts user id from a authenticated principal`() {
        val authentication = UsernamePasswordAuthenticationToken("principal", "credential", listOf(SimpleGrantedAuthority("ROLE_student")))

        assertEquals("principal", AuthUserIdResolver.resolveUserId(authentication))
    }
}
