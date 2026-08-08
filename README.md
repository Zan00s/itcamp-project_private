# КТК ЭЛОУ-АВ — Компьютерный тренажёрный комплекс

Проект реализует цифровой двойник тренажёра установки ЭЛОУ-АВ для обучения операторов
нефтеперерабатывающего завода.

## Структура проекта

```
itcamp-project/
├── backend/                 Kotlin + Spring Boot (Clean Architecture, Gradle multi-module)
│   ├── core/                Чистое ядро (domain + порты + SPI)
│   │   ├── core-sim/        Симуляционный движок (граф, правила, spread)
│   │   ├── core-scenario/   Сценарии (фазы, условия, валидация)
│   │   ├── core-scoring/    Движок оценки (правила)
│   │   ├── core-audit/      Модель аудита
│   │   ├── core-ai/         Модели ИИ-контрактов + порты
│   │   └── core-shared/     Общие типы
│   ├── application/         Use cases (оркестрация портов)
│   ├── infrastructure/      Адаптеры (PostgreSQL, Redis, Keycloak, LLM, ML)
│   └── bootstrap/           Spring Boot main + wiring
├── frontend/                React + TypeScript + Vite
├── keycloak-config/         Realm config (роли, тестовые пользователи)
├── configs/                 JSON-конфиги установок и сценариев
├── docs/                    Документация
└── docker-compose.yml       PostgreSQL + Keycloak + Redis + Backend + Frontend
```

## Быстрый старт

```bash
cp .env.example .env
docker compose up --build
```

| Сервис | URL | Логин/пароль |
|---|---|---|
| Frontend | http://localhost:3000 | — |
| Backend API | http://localhost:8080 | — |
| Keycloak | http://localhost:8090 | admin/admin |
| PostgreSQL | localhost:5432 | elouav/elouav_dev |
| Redis | localhost:6379 | — |

### Тестовые пользователи Keycloak

| Роль | Логин | Пароль |
|---|---|---|
| Студент | student | student |
| Преподаватель | instructor | instructor |
| Методист | methodist | methodist |
| Администратор | admin | admin |

## Разработка

### Backend

```bash
cd backend
./gradlew test          # юнит-тесты
./gradlew bootRun       # локальный запуск (нужны PostgreSQL, Redis, Keycloak)
```

### Frontend

```bash
cd frontend
npm install
npm run dev             # http://localhost:3000 (прокси на backend:8080)
```
