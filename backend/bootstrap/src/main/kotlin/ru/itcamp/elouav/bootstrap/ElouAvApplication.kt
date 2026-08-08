package ru.itcamp.elouav.bootstrap

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication(scanBasePackages = ["ru.itcamp.elouav"])
class ElouAvApplication

fun main(args: Array<String>) {
    runApplication<ElouAvApplication>(*args)
}
