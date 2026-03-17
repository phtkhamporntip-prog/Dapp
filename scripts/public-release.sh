#!/usr/bin/env bash

# One-command public release flow:
# 1) Deploy + verify production routes on Vercel
# 2) Create GitHub release tag/notes
#
# Usage:
#   export VERCEL_TOKEN=...
#   ./scripts/public-release.sh v1.0.0

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${1:-v1.0.0}"
CURRENT_STAGE="initializing"
SCRIPT_LOG="$(mktemp /tmp/public-release.XXXX.log)"

exec > >(tee -a "$SCRIPT_LOG") 2>&1

trap 'echo "ERROR: public-release failed during stage: $CURRENT_STAGE"; echo "ERROR: command: $BASH_COMMAND"; echo "ERROR: line: $LINENO"; echo "ERROR: log file: $SCRIPT_LOG"' ERR

if [[ "${1:-}" == "--doctor" ]]; then
  echo "== Public Release Doctor =="

  if [[ -z "${VERCEL_TOKEN:-}" ]]; then
    echo "[FAIL] VERCEL_TOKEN is not set"
  elif [[ "${VERCEL_TOKEN}" == "your_vercel_token" ]]; then
    echo "[FAIL] VERCEL_TOKEN is placeholder"
  else
    echo "[OK] VERCEL_TOKEN appears set"
  fi

  if command -v gh >/dev/null 2>&1; then
    echo "[OK] gh CLI installed"
    if gh auth status >/dev/null 2>&1; then
      echo "[OK] gh authenticated"
    else
      echo "[FAIL] gh not authenticated"
    fi
  else
    echo "[FAIL] gh CLI not installed"
  fi

  if command -v vercel >/dev/null 2>&1; then
    echo "[OK] vercel CLI installed"
  else
    echo "[WARN] vercel CLI not installed (script can auto-install)"
  fi

  echo "== End Doctor =="
  exit 0
fi

if [[ $# -gt 1 ]]; then
  echo "ERROR: Too many arguments."
  echo "Usage: ./scripts/public-release.sh v1.0.0"
  exit 1
fi

if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([-.][A-Za-z0-9]+)?$ ]]; then
  echo "ERROR: Invalid release tag '$TAG'."
  echo "Expected format: v1.0.0"
  echo "Tip: Ensure commands are on separate lines and not concatenated."
  exit 1
fi

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "ERROR: VERCEL_TOKEN is not set."
  echo "Run: export VERCEL_TOKEN=..."
  exit 1
fi

if [[ "${VERCEL_TOKEN}" == "your_vercel_token" ]]; then
  echo "ERROR: VERCEL_TOKEN is still the placeholder value."
  echo "Set your real Vercel token, then retry."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  CURRENT_STAGE="checking gh cli"
  echo "ERROR: GitHub CLI (gh) is not installed."
  exit 1
fi

CURRENT_STAGE="checking gh authentication"
if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh is not authenticated."
  echo "Run: gh auth login"
  exit 1
fi

CURRENT_STAGE="deploy and route verification"
echo "Running Vercel deploy + verification..."
DEPLOY_LOG="$(mktemp)"
bash "$ROOT_DIR/scripts/vercel-deploy-and-verify.sh" | tee "$DEPLOY_LOG"

CURRENT_STAGE="extracting deployment url"
DEPLOY_URL="$(grep -E '^Public URL:' "$DEPLOY_LOG" | tail -n 1 | sed 's/^Public URL: //')"
if [[ -z "$DEPLOY_URL" ]]; then
  echo "ERROR: Could not determine deployment URL from deploy output."
  exit 1
fi

CURRENT_STAGE="creating or updating github release"
echo "Creating GitHub release $TAG ..."
NOTES="Production deploy verified: app, support, admin, and master-admin routes healthy. URL: $DEPLOY_URL"

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG already exists, updating notes/title..."
  gh release edit "$TAG" \
    --title "$TAG Public Release" \
    --notes "$NOTES"
else
  gh release create "$TAG" \
    --title "$TAG Public Release" \
    --notes "$NOTES"
fi

echo "Release complete: $TAG"
echo "URL: $DEPLOY_URL"
