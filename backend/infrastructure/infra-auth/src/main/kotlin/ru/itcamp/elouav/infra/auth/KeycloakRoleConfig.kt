package ru.itcamp.elouav.infra.auth

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.core.convert.converter.Converter
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter

@Configuration
@Profile("!dev")
class KeycloakRoleConfig {

    @Bean
    fun keycloakJwtConverter(): Converter<Jwt, AbstractAuthenticationToken> {
        return KeycloakJwtConverter()
    }
}

class KeycloakJwtConverter : Converter<Jwt, AbstractAuthenticationToken> {

    private val delegate = JwtAuthenticationConverter()

    override fun convert(jwt: Jwt): AbstractAuthenticationToken {
        val defaultAuth = delegate.convert(jwt)
        val defaultAuthorities = defaultAuth?.authorities ?: emptyList<GrantedAuthority>()

        val realmAccess = jwt.getClaim<Map<String, List<String>>>("realm_access")
        val realmRoles = realmAccess?.get("roles") ?: emptyList()

        val clientAccess = jwt.getClaim<Map<String, Map<String, List<String>>>>("resource_access")
        val clientRoles = clientAccess?.values?.flatMap { it["roles"] ?: emptyList() } ?: emptyList()

        val allRoles = (realmRoles + clientRoles).toSet()
        val roleAuthorities = allRoles.map { SimpleGrantedAuthority("ROLE_$it") }

        val combinedAuthorities = (defaultAuthorities + roleAuthorities).toSet().toList()

        val token = object : AbstractAuthenticationToken(combinedAuthorities) {
            override fun getCredentials(): Any? = jwt.tokenValue
            override fun getPrincipal(): Any = jwt
            override fun getName(): String = jwt.getClaimAsString("preferred_username")
        }
        token.isAuthenticated = true
        return token
    }
}
