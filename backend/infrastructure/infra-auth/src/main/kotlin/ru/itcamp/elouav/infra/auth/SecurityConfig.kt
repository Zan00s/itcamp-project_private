package ru.itcamp.elouav.infra.auth

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.config.annotation.web.invoke

@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http {
            authorizeHttpRequests {
                authorize("/api/**", authenticated)
                authorize("/ws/**", permitAll)
                authorize("/actuator/**", permitAll)
                authorize(anyRequest, permitAll)
            }
            oauth2ResourceServer {
                jwt { }
            }
            csrf { disable() }
        }
        return http.build()
    }
}
