package ru.itcamp.elouav.infra.auth

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.config.annotation.web.invoke
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter
import org.springframework.core.convert.converter.Converter
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableWebSecurity
@Profile("!dev")
class SecurityConfig(
    @Value("\${CORS_ALLOWED_ORIGIN_PATTERNS:*}") private val corsAllowedOriginPatterns: String,
) {

    @Bean
    fun corsConfigurationSource(): UrlBasedCorsConfigurationSource {
        val source = UrlBasedCorsConfigurationSource()
        val config = CorsConfiguration()
        config.allowedOriginPatterns = corsAllowedOriginPatterns
            .split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
        config.allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
        config.allowedHeaders = listOf("*")
        config.allowCredentials = true
        source.registerCorsConfiguration("/**", config)
        return source
    }

    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        jwtConverter: Converter<Jwt, AbstractAuthenticationToken>,
    ): SecurityFilterChain {
        http {
            cors {
                configurationSource = corsConfigurationSource()
            }
            authorizeHttpRequests {
                authorize("/actuator/**", permitAll)
                authorize("/api/health/**", permitAll)

                authorize("/api/scenarios/**", hasAnyRole("student", "instructor", "methodist", "admin"))
                authorize("GET", "/api/scenarios", hasAnyRole("student", "instructor", "methodist", "admin"))
                authorize("POST", "/api/scenarios", hasAnyRole("methodist", "admin"))
                authorize("PUT", "/api/scenarios/**", hasAnyRole("methodist", "admin"))
                authorize("DELETE", "/api/scenarios/**", hasAnyRole("methodist", "admin"))
                authorize("/api/graph", hasAnyRole("student", "instructor", "methodist", "admin"))

                authorize("/api/ai/**", authenticated)
                authorize("/api/sessions/*/hint", hasAnyRole("student", "instructor", "admin"))

                authorize("POST", "/api/sessions", hasAnyRole("student", "instructor", "admin"))
                authorize("GET", "/api/sessions", hasAnyRole("instructor", "admin"))
                authorize("GET", "/api/sessions/{id}", hasAnyRole("student", "instructor", "admin"))
                authorize("POST", "/api/sessions/{id}/actions", hasAnyRole("student", "admin"))
                authorize("GET", "/api/sessions/{id}/state", hasAnyRole("student", "instructor", "admin"))
                authorize("POST", "/api/sessions/{id}/end", hasAnyRole("student", "instructor", "admin"))

                authorize("/api/**", authenticated)
                authorize(anyRequest, permitAll)
            }
            oauth2ResourceServer {
                jwt {
                    jwtAuthenticationConverter = jwtConverter
                }
            }
            csrf { disable() }
        }
        return http.build()
    }
}

@Configuration
@EnableWebSecurity
@Profile("dev")
class DevSecurityConfig {

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http {
            csrf { disable() }
            cors { }
            authorizeHttpRequests {
                authorize(anyRequest, permitAll)
            }
        }
        return http.build()
    }
}
