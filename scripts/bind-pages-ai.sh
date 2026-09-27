#!/usr/bin/env bash
# Attach Workers AI to the Pages project so photo ID can see the object.
# Do not put an AI binding in wrangler.jsonc — that breaks `next build` in CI.
set -euo pipefail

ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-}"
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
PROJECT="${1:-stockr}"

if [ -z "$ACCOUNT" ] || [ -z "$TOKEN" ]; then
  echo "Skip Workers AI bind: CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN missing."
  exit 0
fi

auth=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")
base="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}"

project="$(curl -sS "${base}/pages/projects/${PROJECT}" "${auth[@]}")"
payload="$(ACCOUNT_JSON="$project" python3 - <<'PY'
import json, os
data = json.loads(os.environ["ACCOUNT_JSON"])
if not data.get("success"):
    raise SystemExit("read-failed:" + json.dumps(data.get("errors") or data))
prod = ((data.get("result") or {}).get("deployment_configs") or {}).get("production") or {}
bindings = dict(prod.get("ai_bindings") or {})
if "AI" in bindings:
    print("already")
else:
    print(json.dumps({"deployment_configs": {"production": {"ai_bindings": {**bindings, "AI": {}}}}}))
PY
)"

if [[ "$payload" == read-failed:* ]]; then
  echo "Could not read Pages project: ${payload#read-failed:}"
  exit 0
fi

if [ "$payload" != "already" ]; then
  updated="$(curl -sS -X PATCH "${base}/pages/projects/${PROJECT}" "${auth[@]}" --data "$payload")"
  python3 -c 'import json,sys; d=json.loads(sys.argv[1]); print("Bound Workers AI as AI." if d.get("success") else "Workers AI bind skipped: "+json.dumps(d.get("errors") or d))' "$updated"
else
  echo "Workers AI binding already present."
fi

curl -sS -X POST "${base}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct" "${auth[@]}" \
  --data '{"prompt":"agree"}' >/dev/null || true
echo "Workers AI vision license ping sent."
