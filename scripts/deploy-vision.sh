#!/usr/bin/env bash
# Dedicated Workers AI service so photo ID can see the object without OpenNext bindings.
set -euo pipefail

ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-}"
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CONFIG="workers/vision/wrangler.jsonc"

if [ -z "$ACCOUNT" ] || [ -z "$TOKEN" ]; then
  echo "Skip vision worker: CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN missing."
  exit 0
fi

printf '%s' "$TOKEN" | npx wrangler secret put VISION_SECRET --config "$CONFIG" --name stockr-vision
deploy_log="$(npx wrangler deploy --config "$CONFIG" 2>&1)"
echo "$deploy_log"
url="$(printf '%s\n' "$deploy_log" | grep -Eo 'https://[a-zA-Z0-9._-]+\.workers\.dev' | head -1 || true)"
if [ -z "$url" ]; then
  echo "Vision worker deployed but no workers.dev URL was printed."
  exit 1
fi
printf '%s' "$url" | npx wrangler pages secret put STOCKR_VISION_URL --project-name=stockr
printf '%s' "$TOKEN" | npx wrangler pages secret put STOCKR_VISION_SECRET --project-name=stockr
echo "Vision worker live at $url"
