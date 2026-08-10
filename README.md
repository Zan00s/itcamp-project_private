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
├── docker-compose.yml
├── .env.example      Шаблон переменных окружения
└── README.md
```

## Быстрый старт (локально, Docker)

### 1. Подготовка

```bash
cp .env.example .env
# При необходимости отредактируйте .env (пароли, URL, модель LLM)
```

### 2. Сборка backend jar

```bash
cd backend
./gradlew :bootstrap:bootJar
cd ..
```

### 3. Запуск всех сервисов

```bash
docker compose up -d --build
```

### 4. Проверка

| Сервис | URL | Проверка |
|--------|-----|----------|
| Frontend | http://localhost:3000 | Страница входа |
| Backend API | http://localhost:8080/api/scenarios | 401 (нужен токен) |
| Keycloak | http://localhost:8180 | Страница входа |
| PostgreSQL | localhost:5432 | elouav/elouav_dev |
| Redis | localhost:6379 | — |

### 5. Учётные записи

| Роль | Логин | Пароль | Доступ |
|------|-------|--------|--------|
| Студент | `student` | `student` | Проходит сценарии |
| Преподаватель | `instructor` | `instructor` | Мониторинг сессий и результатов |
| Методист | `methodist` | `methodist` | Управление сценариями |
| Администратор | `admin` | `admin` | Полный доступ + админка Keycloak |

Keycloak админка: http://localhost:8180, `admin`/`admin`.

---

## Развёртывание на сервере (production)

### 1. Настройте `.env`

```bash
cp .env.example .env
```

Заполните значениями для вашего сервера:

```ini
# --- Режим ---
SPRING_PROFILES_ACTIVE=prod

# --- Публичные URL (доступны из браузера) ---
# Если через обратный прокси (nginx), укажите внешние адреса
PUBLIC_FRONTEND_URL=https://elouav.example.ru
PUBLIC_BACKEND_URL=https://api.elouav.example.ru
PUBLIC_KEYCLOAK_URL=https://auth.elouav.example.ru

# --- Vite env (вшиваются в фронтенд-бандл) ---
VITE_API_BASE=/api
VITE_KEYCLOAK_URL=https://auth.elouav.example.ru/realms/elouav
VITE_REDIRECT_URI=https://elouav.example.ru/callback

# --- PostgreSQL (поменяйте пароль!) ---
DB_HOST=postgres
DB_PORT=5432
DB_NAME=elouav
DB_USER=elouav
DB_PASS=СЛОЖНЫЙ_ПАРОЛЬ_ЗДЕСЬ

# --- Redis ---
REDIS_HOST=redis
REDIS_PORT=6379

# --- Keycloak (поменяйте пароль админа!) ---
KC_HOSTNAME=auth.elouav.example.ru
KC_HTTP_PORT=8180
KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=СЛОЖНЫЙ_ПАРОЛЬ_ЗДЕСЬ
KC_HTTP_ENABLED=true
KC_REALM=elouav

# --- Backend → Keycloak (внутренний URL в Docker-сети) ---
KEYCLOAK_URL=http://keycloak:8180

# --- ИИ: LLM-судья ---
# Ollama:   LLM_ENDPOINT=http://gpu-server:11434  LLM_MODEL=qwen2.5-7b
# vLLM:     LLM_ENDPOINT=http://gpu-server:8000   LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
# OpenAI:   LLM_ENDPOINT=https://api.openai.com   LLM_MODEL=gpt-4o-mini  LLM_API_KEY=sk-...
LLM_ENDPOINT=http://localhost:11434
LLM_API_KEY=test-key
LLM_MODEL=gpt-4o-mini

# --- Порты (если нужны нестандартные) ---
PORT_FRONTEND=3000
PORT_BACKEND=8080
PORT_KEYCLOAK=8180
PORT_POSTGRES=5432
PORT_REDIS=6379

# --- Логирование ---
LOG_LEVEL=INFO
```

### 2. Сборка и запуск

```bash
cd backend && ./gradlew :bootstrap:bootJar && cd ..
docker compose up -d --build
```

### 3. Обратный прокси (nginx)

Для production рекомендуется nginx перед Docker-сервисами:

```nginx
# /etc/nginx/sites-available/elouav

# Frontend
server {
    listen 443 ssl http2;
    server_name elouav.example.ru;

    ssl_certificate     /etc/ssl/certs/elouav.crt;
    ssl_certificate_key /etc/ssl/private/elouav.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API проксируется на backend
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Keycloak
server {
    listen 443 ssl http2;
    server_name auth.elouav.example.ru;

    ssl_certificate     /etc/ssl/certs/elouav.crt;
    ssl_certificate_key /etc/ssl/private/elouav.key;

    location / {
        proxy_pass http://127.0.0.1:8180;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. Проверка после деплоя

```bash
# Все сервисы запущены
docker compose ps

# Backend отвечает (401 = правильно, нужен токен)
curl -s -o /dev/null -w "%{http_code}" https://api.elouav.example.ru/api/scenarios

# Keycloak realm доступен
curl -s https://auth.elouav.example.ru/realms/elouav | python3 -m json.tool | head -3

# Frontend загружается
curl -s -o /dev/null -w "%{http_code}" https://elouav.example.ru/
```

---

## Локальная разработка без Docker

### Backend (dev-режим, без Keycloak/PostgreSQL/Redis)

```bash
cd backend
./gradlew :bootstrap:bootRun --args='--spring.profiles.active=dev'
```

Backend: http://localhost:8080 — API доступно без авторизации.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173 — Vite dev server с прокси `/api` → `:8080`.
В dev-режиме Vite (`import.meta.env.DEV = true`) авторизация отключена.

---

## Переменные окружения — полный справочник

### Режим запуска

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `SPRING_PROFILES_ACTIVE` | `prod` | `dev` — без авторизации; `prod` — полная авторизация |

### База данных (PostgreSQL)

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `DB_HOST` | `postgres` | Хост БД (в Docker: `postgres`) |
| `DB_PORT` | `5432` | Порт БД |
| `DB_NAME` | `elouav` | Имя базы данных |
| `DB_USER` | `elouav` | Пользователь БД |
| `DB_PASS` | `elouav_dev` | Пароль БД (**сменить для prod!**) |

### Redis

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `REDIS_HOST` | `redis` | Хост Redis |
| `REDIS_PORT` | `6379` | Порт Redis |

### Keycloak

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `KC_HOSTNAME` | `localhost` | Внешний hostname Keycloak |
| `KC_HTTP_PORT` | `8180` | Внутренний порт Keycloak |
| `KC_BOOTSTRAP_ADMIN_USERNAME` | `admin` | Логин админа Keycloak (**сменить для prod!**) |
| `KC_BOOTSTRAP_ADMIN_PASSWORD` | `admin` | Пароль админа Keycloak (**сменить для prod!**) |
| `KC_HTTP_ENABLED` | `true` | HTTP (без SSL). `false` для HTTPS |
| `KC_REALM` | `elouav` | Имя realm |
| `KEYCLOAK_URL` | `http://keycloak:8180` | URL Keycloak для backend (внутренний, Docker-сеть) |

### Frontend (Vite, вшиваются в бандл при сборке)

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `VITE_API_BASE` | `/api` | Базовый URL API (relative — через nginx proxy) |
| `VITE_KEYCLOAK_URL` | `http://localhost:8180/realms/elouav` | URL realm Keycloak (доступен из браузера) |
| `VITE_REDIRECT_URI` | `http://localhost:3000/callback` | URL возврата после авторизации |

### ИИ (LLM-судья, OpenAI-compatible)

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `LLM_ENDPOINT` | `http://localhost:11434` | URL API (Ollama, vLLM, OpenAI, ...) |
| `LLM_API_KEY` | `test-key` | API ключ (для Ollama не нужен) |
| `LLM_MODEL` | `gpt-4o-mini` | Имя модели |

### Порты (маппинг Docker → host)

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `PORT_FRONTEND` | `3000` | Порт фронтенда на хосте |
| `PORT_BACKEND` | `8080` | Порт backend на хосте |
| `PORT_KEYCLOAK` | `8180` | Порт Keycloak на хосте |
| `PORT_POSTGRES` | `5432` | Порт PostgreSQL на хосте |
| `PORT_REDIS` | `6379` | Порт Redis на хосте |

### Прочее

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `JAVA_OPTS` | `-Xmx256m` | Параметры JVM для backend |
| `LOG_LEVEL` | `DEBUG` | Уровень логирования (`DEBUG`, `INFO`, `WARN`) |

---

## API Endpoints

| Method | Path | Роли | Описание |
|--------|------|------|----------|
| GET | `/api/graph` | all | Технологическая схема |
| GET | `/api/scenarios` | all | Список сценариев |
| GET | `/api/scenarios/{id}` | all | Сценарий по ID |
| GET | `/api/scenarios/{id}/hints` | all | Подсказки по фазам |
| POST | `/api/sessions` | student, instructor, admin | Начать сессию |
| GET | `/api/sessions` | instructor, admin | Все сессии (результаты) |
| GET | `/api/sessions/{id}` | student, instructor, admin | Статус сессии |
| POST | `/api/sessions/{id}/actions` | student, admin | Выполнить действие |
| GET | `/api/sessions/{id}/state` | student, instructor, admin | Текущее состояние схемы |
| POST | `/api/sessions/{id}/end` | student, instructor, admin | Завершить и оценить |

---

## Сценарии

| ID | Название | Сложность | Время |
|----|----------|-----------|-------|
| `startup` | Пуск установки | 2/3 | 30 мин |
| `shutdown` | Остановка установки | 1/3 | 20 мин |
| `emergency_pump_failure` | Нештатная ситуация: отказ насоса | 3/3 | 10 мин |

## Технологическая схема (ЭЛОУ-АВ)

```
Насос → Теплообменник → Печь → Электродегидратор → Выход
         ↓               ↓           ↓
      подогрев      нагрев     обессоливание
```
