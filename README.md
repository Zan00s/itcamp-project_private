# КТК ЭЛОУ-АВ — Компьютерный тренажёрный комплекс

Тренажёр оператора установки электродегидрации и обессоливания (ЭЛОУ-АВ).

## Архитектура

```
itcamp-project/
├── backend/          Kotlin + Spring Boot (Clean Architecture, Gradle multi-module)
│   ├── core/         Чистое ядро (domain model, ports, SPI)
│   ├── application/  Use cases
│   ├── infrastructure/ Адаптеры (REST, DB in-memory, AI, Auth, Cache)
│   └── bootstrap/    Spring Boot main + DI wiring
├── frontend/         React 19 + TypeScript + Vite
├── keycloak-config/  Realm config (роли, тестовые пользователи)
└── docker-compose.yml
```

## Быстрый запуск (Docker)

```bash
cp .env.example .env
docker compose up --build
```

| Сервис | URL | Логин/пароль |
|--------|-----|-------------|
| Frontend | http://localhost:3000 | — |
| Backend API | http://localhost:8080/api | — |
| Keycloak | http://localhost:8180 | admin/admin |
| PostgreSQL | localhost:5432 | elouav/elouav_dev |
| Redis | localhost:6379 | — |

### Тестовые пользователи Keycloak

| Роль | Логин | Пароль |
|------|-------|--------|
| student | student | student |
| instructor | instructor | instructor |
| methodist | methodist | methodist |
| admin | admin | admin |

## Локальная разработка

### Backend

```bash
cd backend
./gradlew :bootstrap:bootRun
```

Backend запускается на http://localhost:8080.
В dev-режиме используется In-Memory хранилище (без PostgreSQL/Redis).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend запускается на http://localhost:5173 (Vite dev server с прокси на :8080).

## API Endpoints

| Method | Path | Описание |
|--------|------|----------|
| GET | /api/graph | Получить технологическую схему |
| GET | /api/scenarios | Список сценариев |
| GET | /api/scenarios/{id} | Сценарий по ID |
| GET | /api/scenarios/{id}/hints | Подсказки по фазам |
| POST | /api/sessions | Начать сессию |
| GET | /api/sessions/{id} | Статус сессии |
| POST | /api/sessions/{id}/actions | Выполнить действие |
| POST | /api/sessions/{id}/end | Завершить и оценить |
| GET | /api/sessions/{id}/state | Текущее состояние схемы |

## Технологическая схема (ЭЛОУ-АВ)

```
Насос → Теплообменник → Печь → Электродегидратор → Выход
         ↓               ↓           ↓
      подогрев      нагрев     обессоливание
```

## Сценарии

1. **Пуск установки** — последовательный запуск насоса, печи, дегидратора
2. **Остановка установки** — плавное снижение параметров и остановка
3. **Нештатная ситуация: отказ насоса** — реакция на аварийную ситуацию

## ИИ-контур

- **LLM-судья**: OpenAI-compatible API (асинхронно, кэш в Redis)
- **Прогноз риска**: RuleBasedRiskPredictor (синхронно, <50мс)
- **Адаптивный генератор**: на основе ошибок оператора
