#!/usr/bin/env bash
# Turn off Cloudflare Pages Git auto-builds for Stockr.
# Deploy is GitHub Actions → wrangler pages deploy, not the old Vite Git builder.
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"

API="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects"

api() {
  local method="$1"
  local url="$2"
  shift 2
  curl -sS -X "$method" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "$url" \
    "$@"
}

list_json="$(api GET "$API")"
if [ "$(printf '%s' "$list_json" | jq -r '.success')" != "true" ]; then
  echo "Could not list Pages projects:" >&2
  printf '%s\n' "$list_json" | jq . >&2
  exit 1
fi

mapfile -t names < <(printf '%s' "$list_json" | jq -r --arg repo stockr '
  .result[]
  | select(
      .name == "stockr"
      or (.source.config.repo_name // "") == $repo
    )
  | .name
')

if [ "${#names[@]}" -eq 0 ]; then
  echo "No Pages project named stockr (or linked to this repo) was found."
  exit 0
fi

failed=0
for name in "${names[@]}"; do
  echo "Disabling Git auto-builds on Pages project ${name}..."
  current="$(api GET "${API}/${name}")"
  if [ "$(printf '%s' "$current" | jq -r '.success')" != "true" ]; then
    echo "GET ${name} failed:" >&2
    printf '%s\n' "$current" | jq . >&2
    failed=1
    continue
  fi

  source_type="$(printf '%s' "$current" | jq -r '.result.source.type // empty')"
  deployments="$(printf '%s' "$current" | jq -r '.result.source.config.deployments_enabled // "none"')"
  production="$(printf '%s' "$current" | jq -r '.result.source.config.production_deployments_enabled // "none"')"
  preview="$(printf '%s' "$current" | jq -r '.result.source.config.preview_deployment_setting // "none"')"
  echo "  source=${source_type:-disconnected} deployments=${deployments} production=${production} preview=${preview}"

  if [ -z "$source_type" ]; then
    echo "  already disconnected from Git."
    continue
  fi

  if [ "$deployments" = "false" ] && [ "$production" = "false" ] && [ "$preview" = "none" ]; then
    echo "  Git auto-builds already off."
    continue
  fi

  owner="$(printf '%s' "$current" | jq -r '.result.source.config.owner')"
  repo_name="$(printf '%s' "$current" | jq -r '.result.source.config.repo_name')"
  production_branch="$(printf '%s' "$current" | jq -r '.result.source.config.production_branch // "main"')"
  body="$(jq -n \
    --arg type "$source_type" \
    --arg owner "$owner" \
    --arg repo_name "$repo_name" \
    --arg production_branch "$production_branch" \
    '{
      source: {
        type: $type,
        config: {
          owner: $owner,
          repo_name: $repo_name,
          production_branch: $production_branch,
          deployments_enabled: false,
          production_deployments_enabled: false,
          preview_deployment_setting: "none",
          pr_comments_enabled: false
        }
      }
    }')"

  updated="$(api PATCH "${API}/${name}" --data "$body")"
  if [ "$(printf '%s' "$updated" | jq -r '.success')" != "true" ]; then
    echo "PATCH ${name} failed:" >&2
    printf '%s\n' "$updated" | jq . >&2
    failed=1
    continue
  fi

  echo "  production=$(printf '%s' "$updated" | jq -r '.result.source.config.production_deployments_enabled')"
  echo "  preview=$(printf '%s' "$updated" | jq -r '.result.source.config.preview_deployment_setting')"
  echo "  deployments=$(printf '%s' "$updated" | jq -r '.result.source.config.deployments_enabled')"
done

if [ "$failed" -ne 0 ]; then
  exit 1
fi

echo "Cloudflare Pages Git auto-builds are off. Production stays on GitHub Actions Deploy."
