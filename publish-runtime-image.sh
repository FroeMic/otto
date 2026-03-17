#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IMAGE_REPO="${IMAGE_REPO:-ghcr.io/froemic/otto-openclaw}"
IMAGE_TAG="${IMAGE_TAG:-}"
OPENCLAW_BASE_IMAGE="${OPENCLAW_BASE_IMAGE:-ghcr.io/openclaw/openclaw:latest}"
PLATFORMS="${PLATFORMS:-linux/amd64}"
PUSH_IMAGE="${PUSH_IMAGE:-1}"
LOAD_IMAGE="${LOAD_IMAGE:-0}"

if [[ -z "${IMAGE_TAG}" ]]; then
  echo "IMAGE_TAG is required." >&2
  echo "Example: IMAGE_TAG=2026.3.14-1 ./publish-runtime-image.sh" >&2
  exit 1
fi

if [[ "${PUSH_IMAGE}" != "0" && -n "${GHCR_TOKEN:-}" ]]; then
  GHCR_USERNAME="${GHCR_USERNAME:-${GITHUB_ACTOR:-}}"

  if [[ -z "${GHCR_USERNAME}" ]]; then
    echo "GHCR_USERNAME is required when GHCR_TOKEN is provided." >&2
    exit 1
  fi

  printf '%s' "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin
fi

BUILD_ARGS=(
  buildx
  build
  --file "${ROOT_DIR}/runtime-image/Dockerfile"
  --platform "${PLATFORMS}"
  --build-arg "OPENCLAW_BASE_IMAGE=${OPENCLAW_BASE_IMAGE}"
  --tag "${IMAGE_REPO}:${IMAGE_TAG}"
)

if [[ "${LOAD_IMAGE}" == "1" ]]; then
  BUILD_ARGS+=(--load)
fi

if [[ "${PUSH_IMAGE}" != "0" ]]; then
  BUILD_ARGS+=(--push)
fi

BUILD_ARGS+=("${ROOT_DIR}")

echo "Building runtime image:"
echo "  IMAGE_REPO=${IMAGE_REPO}"
echo "  IMAGE_TAG=${IMAGE_TAG}"
echo "  OPENCLAW_BASE_IMAGE=${OPENCLAW_BASE_IMAGE}"
echo "  PLATFORMS=${PLATFORMS}"

docker "${BUILD_ARGS[@]}"

echo
echo "Published runtime image:"
echo "  ${IMAGE_REPO}:${IMAGE_TAG}"
echo
echo "Set this in the control plane env:"
echo "  RUNTIME_OPENCLAW_IMAGE=${IMAGE_REPO}:${IMAGE_TAG}"
