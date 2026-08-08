package ru.itcamp.elouav.bootstrap.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import ru.itcamp.elouav.ai.port.LLMJudge
import ru.itcamp.elouav.ai.port.RiskPredictor
import ru.itcamp.elouav.ai.port.VerdictCache
import ru.itcamp.elouav.app.ai.ForecastRiskUseCase
import ru.itcamp.elouav.app.ai.GenerateAdaptiveScenarioUseCase
import ru.itcamp.elouav.app.ai.RequestAIVerdictUseCase
import ru.itcamp.elouav.app.scenario.ListScenariosUseCase
import ru.itcamp.elouav.app.scenario.LoadScenarioUseCase
import ru.itcamp.elouav.app.scenario.ValidateGraphUseCase
import ru.itcamp.elouav.app.scoring.ScoreAttemptUseCase
import ru.itcamp.elouav.app.session.EndSessionUseCase
import ru.itcamp.elouav.app.session.SessionStore
import ru.itcamp.elouav.app.session.StartSessionUseCase
import ru.itcamp.elouav.app.sim.ApplyActionUseCase
import ru.itcamp.elouav.audit.port.AuditReader
import ru.itcamp.elouav.audit.port.AuditRepository
import ru.itcamp.elouav.infra.ai.llm.OpenAICompatibleLLMAdapter
import ru.itcamp.elouav.infra.ai.ml.RuleBasedRiskPredictor
import ru.itcamp.elouav.infra.cache.InMemoryVerdictCache
import ru.itcamp.elouav.infra.db.InMemoryAuditRepository
import ru.itcamp.elouav.infra.db.InMemoryGraphRepository
import ru.itcamp.elouav.infra.db.InMemoryScenarioRepository
import ru.itcamp.elouav.scenario.port.ScenarioRepository
import ru.itcamp.elouav.scoring.engine.ScoringEngine
import ru.itcamp.elouav.sim.engine.SpreadEngine
import ru.itcamp.elouav.sim.port.GraphRepository

@Configuration
class AppConfig {

    @Bean
    fun graphRepository(): GraphRepository = InMemoryGraphRepository()

    @Bean
    fun scenarioRepository(): ScenarioRepository = InMemoryScenarioRepository()

    @Bean
    fun auditRepository(): AuditRepository = InMemoryAuditRepository()

    @Bean
    fun sessionStore(): SessionStore = SessionStore()

    @Bean
    fun spreadEngine(): SpreadEngine = SpreadEngine()

    @Bean
    fun applyActionUseCase(spreadEngine: SpreadEngine): ApplyActionUseCase =
        ApplyActionUseCase(spreadEngine)

    @Bean
    fun startSessionUseCase(sessionStore: SessionStore): StartSessionUseCase =
        StartSessionUseCase(sessionStore)

    @Bean
    fun endSessionUseCase(sessionStore: SessionStore): EndSessionUseCase =
        EndSessionUseCase(sessionStore)

    @Bean
    fun listScenariosUseCase(repo: ScenarioRepository): ListScenariosUseCase =
        ListScenariosUseCase(repo)

    @Bean
    fun loadScenarioUseCase(repo: ScenarioRepository): LoadScenarioUseCase =
        LoadScenarioUseCase(repo)

    @Bean
    fun validateGraphUseCase(): ValidateGraphUseCase = ValidateGraphUseCase()

    @Bean
    fun scoringEngine(): ScoringEngine = ScoringEngine()

    @Bean
    fun scoreAttemptUseCase(engine: ScoringEngine): ScoreAttemptUseCase =
        ScoreAttemptUseCase(engine)

    @Bean
    fun verdictCache(): VerdictCache = InMemoryVerdictCache()

    @Bean
    fun llmJudge(
        @Value("\${ai.llm.endpoint:http://localhost:11434}") endpoint: String,
        @Value("\${ai.llm.api-key:test-key}") apiKey: String,
        @Value("\${ai.llm.model:gpt-4o-mini}") model: String,
        cache: VerdictCache,
    ): LLMJudge = OpenAICompatibleLLMAdapter(endpoint, apiKey, model, cache)

    @Bean
    fun riskPredictor(): RiskPredictor = RuleBasedRiskPredictor()

    @Bean
    fun requestAIVerdictUseCase(judge: LLMJudge): RequestAIVerdictUseCase =
        RequestAIVerdictUseCase(judge)

    @Bean
    fun forecastRiskUseCase(predictor: RiskPredictor): ForecastRiskUseCase =
        ForecastRiskUseCase(predictor)
}
