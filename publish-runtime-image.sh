#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IMAGE_REPO="${IMAGE_REPO:-ghcr.io/froemic/otto-openclaw}"
IMAGE_TAG="${IMAGE_TAG:-}"
IMAGE_REVISION="${IMAGE_REVISION:-1}"
OPENCLAW_BASE_IMAGE="${OPENCLAW_BASE_IMAGE:-ghcr.io/openclaw/openclaw:2026.4.22}"
PLATFORMS="${PLATFORMS:-linux/amd64}"
PUSH_IMAGE="${PUSH_IMAGE:-1}"
LOAD_IMAGE="${LOAD_IMAGE:-0}"

if [[ -z "${IMAGE_TAG}" ]]; then
  if [[ "${OPENCLAW_BASE_IMAGE}" == *@* ]]; then
    echo "IMAGE_TAG cannot be derived from a digest-pinned OPENCLAW_BASE_IMAGE." >&2
    echo "Set IMAGE_TAG explicitly when using a digest." >&2
    exit 1
  fi

  BASE_IMAGE_TAG="${OPENCLAW_BASE_IMAGE##*:}"

  if [[ -z "${BASE_IMAGE_TAG}" || "${BASE_IMAGE_TAG}" == "${OPENCLAW_BASE_IMAGE}" ]]; then
    echo "OPENCLAW_BASE_IMAGE must include a tag, or IMAGE_TAG must be set explicitly." >&2
    exit 1
  fi

  if ! [[ "${IMAGE_REVISION}" =~ ^[0-9]+$ ]]; then
    echo "IMAGE_REVISION must be a positive integer." >&2
    exit 1
  fi

  IMAGE_TAG="${BASE_IMAGE_TAG}.${IMAGE_REVISION}"
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
echo "  IMAGE_REVISION=${IMAGE_REVISION}"
echo "  OPENCLAW_BASE_IMAGE=${OPENCLAW_BASE_IMAGE}"
echo "  PLATFORMS=${PLATFORMS}"

docker "${BUILD_ARGS[@]}"

echo
echo "Published runtime image:"
echo "  ${IMAGE_REPO}:${IMAGE_TAG}"
echo
echo "Set this in the control plane env:"
echo "  RUNTIME_OPENCLAW_IMAGE=${IMAGE_REPO}:${IMAGE_TAG}"
