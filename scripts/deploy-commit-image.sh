#!/usr/bin/env bash
set -euo pipefail

# Deploys backend/frontend images built by CI for a specific commit SHA.
# Usage:
#   GHCR_USER=... GHCR_TOKEN=... ./scripts/deploy-commit-image.sh <commit_sha>
# Or:
#   COMMIT_SHA=<commit_sha> ./scripts/deploy-commit-image.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMMIT_SHA="${1:-${COMMIT_SHA:-}}"
REPO_SLUG="${REPO_SLUG:-osetinskiPie/itcamp-project}"

if [[ -z "$COMMIT_SHA" ]]; then
  echo "ERROR: commit SHA is required." >&2
  echo "Usage: ./scripts/deploy-commit-image.sh <commit_sha>" >&2
  exit 1
fi

if ! [[ "$COMMIT_SHA" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  echo "ERROR: invalid commit SHA '$COMMIT_SHA'." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed on this machine." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin is not available." >&2
  exit 1
fi

IMAGE_NAMESPACE="ghcr.io/$(printf '%s' "$REPO_SLUG" | tr '[:upper:]' '[:lower:]')"
IMAGE_TAG="sha-${COMMIT_SHA}"

export BACKEND_IMAGE="${IMAGE_NAMESPACE}/backend:${IMAGE_TAG}"
export FRONTEND_IMAGE="${IMAGE_NAMESPACE}/frontend:${IMAGE_TAG}"

echo "Using images:"
echo "  BACKEND_IMAGE=${BACKEND_IMAGE}"
echo "  FRONTEND_IMAGE=${FRONTEND_IMAGE}"

if [[ -n "${GHCR_USER:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
fi

# Compose file expects these external networks to exist on the target host.
docker network inspect nginx >/dev/null 2>&1 || docker network create nginx
docker network inspect ai >/dev/null 2>&1 || docker network create ai

docker compose pull backend frontend
docker compose up -d --remove-orphans
docker compose ps

echo
echo "Deployed commit SHA: ${COMMIT_SHA}"
echo "Running images:"
docker ps --format 'table {{.Names}}\t{{.Image}}' | grep -E 'elouav-(backend|frontend)|NAMES'
