# Переменные окружения КТК ЭЛОУ-АВ

## Использование

```bash
cp .env.example .env
# отредактируйте .env под ваше окружение
docker compose up -d --build
```
Все переменные имеют значения по умолчанию — проект запускается локально без изменений.


## Режим запуска

| Переменная | По умолчанию | Значения | Описание |
|-----------|-------------|----------|----------|
| `SPRING_PROFILES_ACTIVE` | `prod` | `dev`, `prod` | Профиль Spring Boot. **`dev`** — авторизация отключена, in-memory хранилище, быстрый старт без Keycloak/PostgreSQL/Redis. **`prod`** — полная авторизация через Keycloak, проверка JWT-токенов |


## GitHub Actions: production deploy

Откройте **Settings -> Secrets and variables -> Actions**. Значения из `Variables`
используются для обычной конфигурации, а значения из `Secrets` доступны workflow
только в замаскированном виде. Перед deploy workflow создает защищенный `.env` на
self-hosted runner и передает его в `docker compose`.

### Actions Variables

Создайте следующие Repository variables:

| Variable | Значение |
|----------|----------|
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `DB_HOST` | `postgres` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `elouav` |
| `DB_USER` | `elouav` |
| `REDIS_HOST` | `redis` |
| `REDIS_PORT` | `6379` |
| `KC_BOOTSTRAP_ADMIN_USERNAME` | имя администратора Keycloak |
| `KC_HOSTNAME` | `https://auth.it-camp-2026.ru` |
| `KC_HOSTNAME_ADMIN` | `https://auth.it-camp-2026.ru` |
| `KC_HTTP_PORT` | `8180` |
| `KC_HTTP_ENABLED` | `true` |
| `KC_REALM` | `elouav` |
| `KC_DB_URL_HOST` | hostname внешнего PostgreSQL для Keycloak |
| `KC_DB_URL_PORT` | `5432` |
| `KC_DB_URL_DATABASE` | имя PostgreSQL database для Keycloak, сейчас `keycloak` |
| `KC_DB_USERNAME` | пользователь PostgreSQL для Keycloak, сейчас `keycloak` |
| `KC_HEALTH_ENABLED` | `true` |
| `KC_METRICS_ENABLED` | `true` |
| `KC_HOSTNAME_STRICT` | `false` |
| `KC_PROXY_HEADERS` | `xforwarded` |
| `KEYCLOAK_URL` | `https://auth.it-camp-2026.ru` |
| `VITE_API_BASE` | `https://api.it-camp-2026.ru/api` |
| `VITE_KEYCLOAK_URL` | `https://auth.it-camp-2026.ru/realms/elouav` |
| `VITE_REDIRECT_URI` | `https://it-camp-2026.ru/callback` |
| `LLM_ENDPOINT` | адрес LLM, доступный из backend-контейнера; не `localhost` |
| `LLM_MODEL` | имя выбранной модели |
| `JAVA_OPTS` | `-Xmx256m` |
| `LOG_LEVEL` | `INFO` |

`LLM_ENDPOINT` и `LLM_MODEL` нельзя корректно заполнить без адреса GPU/LLM-сервера
и имени модели. Для Docker значение `http://localhost:11434` обычно неверно:
оно указывает на контейнер backend.

### Actions Secrets

Создайте следующие Repository secrets:

| Secret | Назначение |
|--------|------------|
| `DB_PASS` | пароль пользователя приложения PostgreSQL |
| `KC_BOOTSTRAP_ADMIN_PASSWORD` | пароль администратора Keycloak |
| `KC_DB_PASSWORD` | пароль PostgreSQL пользователя Keycloak |
| `LLM_API_KEY` | API-ключ LLM |

`GITHUB_TOKEN` создавать не нужно: это встроенный secret GitHub Actions, который
используется для входа в GHCR.

Пароли, которые ранее были записаны в `docker-compose.yml`, считаются раскрытыми.
После первого успешного deploy рекомендуется заменить их на новые значения и
обновить соответствующие Actions secrets.

## Публичные URL (доступны из браузера клиента)

Эти адреса видны пользователю в браузере. В Docker-сети сервисы общаются по внутренним именам (`postgres`, `redis`, `keycloak`, `backend`), но браузер клиента использует внешние адреса.

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `PUBLIC_FRONTEND_URL` | `http://localhost:3000` | Внешний адрес фронтенда, по которому заходят пользователи. **Prod:** `https://elouav.example.ru` |
| `PUBLIC_BACKEND_URL` | `http://localhost:8080` | Внешний адрес API backend. **Prod:** `https://api.elouav.example.ru` |
| `PUBLIC_KEYCLOAK_URL` | `http://localhost:8180` | Внешний адрес Keycloak. **Prod:** `https://auth.elouav.example.ru` |

---

## Vite env (вшиваются в JS-бандл при сборке фронтенда)

Эти переменные подставляются в JavaScript-бандл на этапе сборки (`npm run build`). Изменение требует пересборки Docker-образа фронтенда.

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `VITE_API_BASE` | `/api` | Базовый путь к API. Relative `/api` — запросы идут через nginx proxy (рекомендуется). Можно указать абсолютный URL: `https://api.example.ru/api` |
| `VITE_KEYCLOAK_URL` | `http://localhost:8180/realms/elouav` | URL realm Keycloak. **Должен быть доступен из браузера.** **Prod:** `https://auth.example.ru/realms/elouav` |
| `VITE_REDIRECT_URI` | `http://localhost:3000/callback` | URL возврата после успешной авторизации в Keycloak. **Prod:** `https://elouav.example.ru/callback` |

---

## PostgreSQL

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `DB_HOST` | `postgres` | Имя хоста БД. В Docker-сети: `postgres`. Локально без Docker: `localhost` |
| `DB_PORT` | `5432` | Порт PostgreSQL |
| `DB_NAME` | `elouav` | Имя базы данных |
| `DB_USER` | `elouav` | Пользователь для подключения к БД |
| `DB_PASS` | `elouav_dev` | Пароль БД. **Сменить для prod!** |

---

## Redis

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `REDIS_HOST` | `redis` | Имя хоста Redis. В Docker-сети: `redis`. Локально: `localhost` |
| `REDIS_PORT` | `6379` | Порт Redis |

---

## Keycloak

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `KC_HOSTNAME` | `localhost` | Внешний hostname Keycloak (для генерации URL в токенах). **Prod:** `auth.example.ru` |
| `KC_HTTP_PORT` | `8180` | Внутренний порт Keycloak в контейнере |
| `KC_BOOTSTRAP_ADMIN_USERNAME` | `admin` | Логин администратора Keycloak. **Сменить для prod!** |
| `KC_BOOTSTRAP_ADMIN_PASSWORD` | `admin` | Пароль администратора Keycloak. **Сменить для prod!** |
| `KC_HTTP_ENABLED` | `true` | Разрешить HTTP (без SSL). `false` — только HTTPS. Через nginx ставьте `true`, SSL terminator — nginx |
| `KC_REALM` | `elouav` | Имя realm в Keycloak. Используется в healthcheck и URL |
| `KEYCLOAK_URL` | `http://keycloak:8180` | URL Keycloak для backend (внутренний, Docker-сеть). Backend обращается сюда за JWK-ключами |

---

## Backend JVM

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `JAVA_OPTS` | `-Xmx256m` | Параметры JVM для backend. `-Xmx256m` — максимум 256MB heap. Для слабых серверов можно уменьшить до `-Xmx128m` |

---

## ИИ: LLM-судья (OpenAI-compatible API)

Backend поддерживает любой OpenAI-compatible endpoint для LLM-судьи.

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `LLM_ENDPOINT` | `http://localhost:11434` | URL API. Поддерживает: Ollama, vLLM, LM Studio, GPT4All, OpenAI |
| `LLM_API_KEY` | `test-key` | API-ключ. Для Ollama/vLLM не проверяется, можно оставить `test-key`. Для OpenAI: `sk-...` |
| `LLM_MODEL` | `gpt-4o-mini` | Имя модели |

### Примеры конфигурации

**Ollama (локально):**
```ini
LLM_ENDPOINT=http://localhost:11434
LLM_API_KEY=test-key
LLM_MODEL=qwen2.5-7b
```

**vLLM (GPU-сервер):**
```ini
LLM_ENDPOINT=http://gpu-server:8000
LLM_API_KEY=test-key
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
```

**OpenAI:**
```ini
LLM_ENDPOINT=https://api.openai.com
LLM_API_KEY=sk-xxxxxxxxxxxxxxxx
LLM_MODEL=gpt-4o-mini
```

---

## Тестовые пользователи Keycloak

Создаются при первом импорте realm из `keycloak-config/realm-export.json`. Пароли хранятся в JSON — для смены отредактируйте файл **до первого запуска** (или смените через админку Keycloak после).

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `STUDENT_PASSWORD` | `student` | Пароль пользователя `student` (роль: Студент) |
| `INSTRUCTOR_PASSWORD` | `instructor` | Пароль пользователя `instructor` (роль: Преподаватель) |
| `METHODIST_PASSWORD` | `methodist` | Пароль пользователя `methodist` (роль: Методист) |
| `ADMIN_PASSWORD` | `admin` | Пароль пользователя `admin` (роль: Администратор) |

---

## Порты хоста (маппинг Docker → host)

Какой порт на вашей машине указывает на сервис в Docker.

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `PORT_FRONTEND` | `3000` | Порт фронтенда (nginx) на хосте |
| `PORT_BACKEND` | `8080` | Порт backend (Spring Boot) на хосте |
| `PORT_KEYCLOAK` | `8180` | Порт Keycloak на хосте |
| `PORT_POSTGRES` | `5432` | Порт PostgreSQL на хосте |
| `PORT_REDIS` | `6379` | Порт Redis на хосте |

---

## Логирование

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `LOG_LEVEL` | `DEBUG` | Уровень логирования backend. `DEBUG` — подробно (для разработки). `INFO` — стандартно для prod. `WARN` — только предупреждения и ошибки |

---

## Схема взаимодействия сервисов

### Локально (Docker Compose)

```
Браузер ──→ localhost:3000 (nginx/frontend)
               │
               ├── /api/ ──→ localhost:8080 (backend)
               │                │
               │                ├──→ keycloak:8180 (внутр. Docker-сеть)
               │                ├──→ postgres:5432 (внутр. Docker-сеть)
               │                └──→ redis:6379 (внутр. Docker-сеть)
               │
               └── OIDC ──→ localhost:8180 (keycloak, для браузера)
```

### Production (с обратным прокси nginx)

```
Браузер ──→ nginx:443 (SSL)
              │
              ├── elouav.example.ru ──→ frontend:80
              │                          └── /api/ ──→ backend:8080
              │
              └── auth.elouav.example.ru ──→ keycloak:8180
```

### Переменные по сервисам

| Сервис | Читает переменные |
|--------|------------------|
| **frontend** (Vite build) | `VITE_API_BASE`, `VITE_KEYCLOAK_URL`, `VITE_REDIRECT_URI` |
| **backend** (Spring Boot) | `SPRING_PROFILES_ACTIVE`, `DB_*`, `REDIS_*`, `KEYCLOAK_URL`, `LLM_*`, `JAVA_OPTS`, `LOG_LEVEL` |
| **keycloak** | `KC_HOSTNAME`, `KC_HTTP_PORT`, `KC_BOOTSTRAP_ADMIN_*`, `KC_HTTP_ENABLED`, `KC_REALM` |
| **postgres** | `DB_NAME`, `DB_USER`, `DB_PASS` |
| **redis** | (без переменных) |

---

## Шпаргалка: минимальные изменения для prod

```ini
# 1. Режим
SPRING_PROFILES_ACTIVE=prod

# 2. Внешние адреса (замените example.ru на ваш домен)
VITE_KEYCLOAK_URL=https://auth.example.ru/realms/elouav
VITE_REDIRECT_URI=https://elouav.example.ru/callback

# 3. Пароли (СМЕНИТЬ!)
DB_PASS=сложный_пароль_бд
KC_BOOTSTRAP_ADMIN_PASSWORD=сложный_пароль_админа
KC_HOSTNAME=auth.example.ru

# 4. LLM (если используется)
LLM_ENDPOINT=http://gpu-server:11434
LLM_MODEL=qwen2.5-7b

# 5. Логи
LOG_LEVEL=INFO
```
