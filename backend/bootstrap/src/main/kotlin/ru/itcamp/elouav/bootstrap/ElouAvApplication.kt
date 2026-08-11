package ru.itcamp.elouav.bootstrap

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication(scanBasePackages = ["ru.itcamp.elouav"])
@EnableScheduling
class ElouAvApplication

fun main(args: Array<String>) {
    runApplication<ElouAvApplication>(*args)
}
