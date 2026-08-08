package ru.itcamp.elouav.infra.ai.ml

import ru.itcamp.elouav.ai.model.RiskCategory
import ru.itcamp.elouav.ai.model.RiskForecast
import ru.itcamp.elouav.ai.model.RiskItem
import ru.itcamp.elouav.ai.port.AvailableAction
import ru.itcamp.elouav.ai.port.RiskPredictor
import ru.itcamp.elouav.shared.AppResult
import ru.itcamp.elouav.shared.Clock
import ru.itcamp.elouav.shared.NodeId
import ru.itcamp.elouav.sim.model.NodeMode
import ru.itcamp.elouav.sim.model.NodeState

class RuleBasedRiskPredictor : RiskPredictor {

    override fun forecast(
        sessionId: String,
        currentPhase: String,
        states: Map<NodeId, NodeState>,
        availableActions: List<AvailableAction>,
    ): AppResult<RiskForecast> {
        val startTime = System.currentTimeMillis()
        val risks = mutableListOf<RiskItem>()

        states.forEach { (nodeId, state) ->
            if (state.mode == NodeMode.ALARM) {
                risks.add(RiskItem(
                    node = nodeId.value,
                    action = "auto",
                    valueRange = 0.0..0.0,
                    riskScore = 0.9,
                    category = RiskCategory.DANGEROUS,
                    reason = "Узел в состоянии ALARM",
                ))
            }

            state.parameters.forEach { (param, value) ->
                when {
                    param == "temperature" && value > 350.0 -> risks.add(RiskItem(
                        node = nodeId.value,
                        action = "set_temp",
                        valueRange = value..value,
                        riskScore = 0.8,
                        category = RiskCategory.DANGEROUS,
                        reason = "Температура $value близка к предельной (400°C)",
                        recommendedRange = 300.0..330.0,
                    ))
                    param == "temperature" && value in 320.0..350.0 -> risks.add(RiskItem(
                        node = nodeId.value,
                        action = "set_temp",
                        valueRange = value..value,
                        riskScore = 0.5,
                        category = RiskCategory.CAUTION,
                        reason = "Температура $value в зоне повышенного внимания",
                    ))
                    param == "pressure_out" && value > 12.0 -> risks.add(RiskItem(
                        node = nodeId.value,
                        action = "set_power",
                        valueRange = value..value,
                        riskScore = 0.6,
                        category = RiskCategory.CAUTION,
                        reason = "Давление $value выше нормы (норма < 12 бар)",
                    ))
                    param == "water_content" && value > 1.0 -> risks.add(RiskItem(
                        node = nodeId.value,
                        action = "set_temp",
                        valueRange = value..value,
                        riskScore = 0.4,
                        category = RiskCategory.CAUTION,
                        reason = "Содержание воды $value% выше нормы (< 0.5%)",
                    ))
                    param == "salt_mg_l" && value > 10.0 -> risks.add(RiskItem(
                        node = nodeId.value,
                        action = "set_temp",
                        valueRange = value..value,
                        riskScore = 0.4,
                        category = RiskCategory.CAUTION,
                        reason = "Содержание солей $value мг/л выше нормы (< 5 мг/л)",
                    ))
                }
            }

            if (state.mode == NodeMode.STOPPED && nodeId.value in listOf("furnace", "dehydrator")) {
                val feedPumpActive = states[NodeId("feed_pump")]?.mode == NodeMode.RUNNING
                if (feedPumpActive) {
                    risks.add(RiskItem(
                        node = nodeId.value,
                        action = "start",
                        valueRange = 0.0..0.0,
                        riskScore = 0.3,
                        category = RiskCategory.CAUTION,
                        reason = "Насос работает, но ${nodeId.value} остановлен — нет протока",
                    ))
                }
            }
        }

        val latency = System.currentTimeMillis() - startTime

        return AppResult.Ok(RiskForecast(
            sessionId = sessionId,
            timestamp = Clock.now(),
            currentPhase = currentPhase,
            riskAssessment = risks.sortedByDescending { it.riskScore },
            model = "rule-based-v1",
            latencyMs = latency,
        ))
    }
}
