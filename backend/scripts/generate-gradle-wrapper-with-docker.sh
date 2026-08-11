#!/usr/bin/env bash
# Генерирует gradle-wrapper.jar в папке backend через официальный Docker-образ Gradle
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден. Установите Docker или сгенерируйте wrapper локально через 'gradle wrapper'."
  exit 2
fi

echo "Запускаю контейнер gradle для генерации wrapper в $ROOT_DIR/backend"

docker run --rm -u $(id -u):$(id -g) -v "$ROOT_DIR/backend":/work -w /work gradle:8.12-jdk21 gradle wrapper --no-daemon

echo "Готово. Проверьте файл backend/gradle/wrapper/gradle-wrapper.jar и закоммитьте изменения."
