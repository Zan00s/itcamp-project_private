# КТК ЭЛОУ-АВ — проект реализации

Концепция: [concept.md](../itcamp/docs-agent/elou-av-digital-twin/concept.md)
ТЗ MVP: [mvp-task.md](../itcamp/docs-agent/elou-av-digital-twin/mvp-task.md)
Тест-кейсы: [mvp-test-cases.md](../itcamp/docs-agent/elou-av-digital-twin/mvp-test-cases.md)

## Архитектура

Backend: Clean / Hexagonal Architecture, Gradle multi-module.
- `core/` — чистое ядро (Kotlin, без фреймворков), порты и SPI
- `application/` — use cases (оркестрация портов)
- `infrastructure/` — адаптеры (PostgreSQL, Keycloak, Redis, LLM)
- `bootstrap/` — Spring Boot main

Frontend: React + TypeScript + Vite, React Flow (P&ID), Zustand.

ИИ: OpenAI-compatible API (адаптер в infra-ai-llm), ML-прогноз (правила в MVP), фолбэк на правила.

## Сборка и тесты

```bash
cd backend && ./gradlew test
cd frontend && npm run build
docker compose up --build
```
