package ru.itcamp.elouav.infra.web.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.CorsRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class WebConfig(
    @Value("\${CORS_ALLOWED_ORIGIN_PATTERNS:*}") private val corsAllowedOriginPatterns: String,
) : WebMvcConfigurer {

    private fun origins(): Array<String> = corsAllowedOriginPatterns
        .split(",")
        .map { it.trim() }
        .filter { it.isNotEmpty() }
        .toTypedArray()

    override fun addCorsMappings(registry: CorsRegistry) {
        registry.addMapping("/api/**")
            .allowedOriginPatterns(*origins())
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true)
        registry.addMapping("/actuator/**")
            .allowedOriginPatterns(*origins())
            .allowedMethods("GET")
            .allowCredentials(true)
    }
}
