#!/usr/bin/env bash

# Deploy Snipe frontend to Vercel and run post-deploy verification checks.
# Usage:
#   export VERCEL_TOKEN=your_token
#   ./scripts/vercel-deploy-and-verify.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/Onchainweb"
CURRENT_STAGE="initializing"
SCRIPT_LOG="$(mktemp /tmp/vercel-deploy-verify.XXXX.log)"

exec > >(tee -a "$SCRIPT_LOG") 2>&1

trap 'echo "ERROR: vercel-deploy-and-verify failed during stage: $CURRENT_STAGE"; echo "ERROR: command: $BASH_COMMAND"; echo "ERROR: line: $LINENO"; echo "ERROR: log file: $SCRIPT_LOG"' ERR

resolve_env_value() {
  local key="$1"
  local default_value="$2"

  if [[ -n "${!key:-}" ]]; then
    echo "${!key}"
    return
  fi

  local candidate_files=(
    "$APP_DIR/.env.production"
    "$APP_DIR/.env"
    "$ROOT_DIR/.env.production"
    "$ROOT_DIR/.env"
  )

  for file in "${candidate_files[@]}"; do
    if [[ -f "$file" ]]; then
      local raw
      raw="$(grep -E "^${key}=" "$file" | tail -n 1 | cut -d'=' -f2- || true)"
      if [[ -n "$raw" ]]; then
        # Strip surrounding quotes if present.
        raw="${raw%\"}"
        raw="${raw#\"}"
        echo "$raw"
        return
      fi
    fi
  done

  echo "$default_value"
}

ensure_secure_admin_release() {
  local admin_enabled
  local admin_allowlist

  admin_enabled="$(resolve_env_value "VITE_ENABLE_ADMIN" "false")"
  admin_allowlist="$(resolve_env_value "VITE_ADMIN_ALLOWLIST" "")"

  # Public release baseline: admin routes are allowed only if private slugs + allowlist are present.
  if [[ "$admin_enabled" == "true" ]]; then
    if [[ "$ADMIN_ROUTE" == "/admin" || "$MASTER_ADMIN_ROUTE" == "/master-admin" ]]; then
      echo "ERROR: Admin is enabled with public default routes."
      echo "Set private routes in env: VITE_ADMIN_ROUTE and VITE_MASTER_ADMIN_ROUTE"
      exit 1
    fi

    if [[ -z "$admin_allowlist" ]]; then
      echo "ERROR: Admin is enabled but VITE_ADMIN_ALLOWLIST is empty."
      exit 1
    fi
  fi
}

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

if ! command -v vercel >/dev/null 2>&1; then
  CURRENT_STAGE="installing vercel cli"
  echo "Installing Vercel CLI..."
  npm install -g vercel >/dev/null
fi

CURRENT_STAGE="building frontend"
echo "Building frontend..."
cd "$APP_DIR"
npm install
npm run build

CURRENT_STAGE="deploying to vercel"
echo "Deploying to Vercel production..."
DEPLOY_OUTPUT="$(vercel --prod --yes --token "$VERCEL_TOKEN" 2>&1)"
DEPLOY_URL="$(printf "%s" "$DEPLOY_OUTPUT" | grep -Eo 'https://[[:alnum:].-]+\.vercel\.app' | tail -n 1 || true)"

if [[ -z "$DEPLOY_URL" ]]; then
  echo "$DEPLOY_OUTPUT"
  echo "ERROR: Could not parse deployment URL from Vercel output."
  exit 1
fi

echo "Deployment URL: $DEPLOY_URL"

ADMIN_ROUTE="$(resolve_env_value "VITE_ADMIN_ROUTE" "/internal-admin")"
MASTER_ADMIN_ROUTE="$(resolve_env_value "VITE_MASTER_ADMIN_ROUTE" "/internal-master")"

CURRENT_STAGE="validating admin security posture"
ensure_secure_admin_release

check_url() {
  local url="$1"
  local label="$2"

  echo "Checking $label -> $url"
  local code
  code="$(curl -L -sS -o /tmp/snipe_check_body.txt -w "%{http_code}" "$url" || true)"

  if [[ "$code" != "200" ]]; then
    echo "ERROR: $label returned HTTP $code"
    exit 1
  fi

  if ! grep -qi "<html" /tmp/snipe_check_body.txt; then
    echo "ERROR: $label did not return HTML content"
    exit 1
  fi
}

echo "Running production route checks..."
CURRENT_STAGE="checking main app route"
check_url "$DEPLOY_URL/" "Main app"
CURRENT_STAGE="checking customer service route"
check_url "$DEPLOY_URL/customer-service" "Customer service route"
CURRENT_STAGE="checking admin route"
check_url "$DEPLOY_URL$ADMIN_ROUTE" "Admin route"
CURRENT_STAGE="checking master admin route"
check_url "$DEPLOY_URL$MASTER_ADMIN_ROUTE" "Master admin route"

echo "All route checks passed."
echo "Release candidate is healthy."
echo "Public URL: $DEPLOY_URL"
