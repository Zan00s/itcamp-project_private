package ru.itcamp.elouav.infra.auth

import org.springframework.core.convert.converter.Converter
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.util.stream.Stream

@Configuration
class KeycloakRoleConfig {

    @Bean
    fun jwtAuthenticationConverter(): Converter<Jwt, AbstractAuthenticationToken> {
        val jwtConverter = JwtAuthenticationConverter()
        jwtConverter.setJwtGrantedAuthoritiesConverter(JwtGrantedAuthoritiesConverter())

        return Converter { jwt ->
            val defaultAuth = jwtConverter.convert(jwt) ?: return@Converter null

            val realmAccess = jwt.getClaim<Map<String, List<String>>>("realm_access")
            val realmRoles = realmAccess?.get("roles") ?: emptyList()

            val clientAccess = jwt.getClaim<Map<String, Map<String, List<String>>>>("resource_access")
            val clientRoles = clientAccess?.values?.flatMap { it["roles"] ?: emptyList() } ?: emptyList()

            val allRoles = (realmRoles + clientRoles).toSet()
            val authorities = Stream.concat(
                defaultAuth.authorities.stream(),
                allRoles.stream().map { SimpleGrantedAuthority("ROLE_$it") }
            ).toList()

            object : AbstractAuthenticationToken(authorities) {
                override fun getCredentials(): Any? = jwt.tokenValue
                override fun getPrincipal(): Any = jwt
                override fun getName(): String = jwt.getClaimAsString("preferred_username")
            }
        }
    }
}
