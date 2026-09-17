#!/usr/bin/env bash
# Verify Pages layout copies /_next to the upload root and writes _routes.json.
set -euo pipefail

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/assets/_next/static/chunks" "$tmp/assets/.well-known"
printf 'css\n' > "$tmp/assets/_next/static/chunks/app.css"
printf 'js\n' > "$tmp/assets/_next/static/chunks/app.js"
printf 'png\n' > "$tmp/assets/logo.png"
printf '{}\n' > "$tmp/assets/manifest.json"
printf '{"sha":"test"}\n' > "$tmp/assets/build-version.json"
printf 'links\n' > "$tmp/assets/.well-known/assetlinks.json"
printf '// worker\n' > "$tmp/worker.js"

OPEN_NEXT_DIR="$tmp" PAGES_DEPLOY_LAYOUT_ONLY=1 bash "$(dirname "$0")/pages-deploy.sh"

fail() {
  echo "pages-deploy layout test failed: $1" >&2
  exit 1
}

[ -f "$tmp/_next/static/chunks/app.css" ] || fail "missing /_next CSS"
[ -f "$tmp/_worker.js" ] || fail "missing _worker.js"
[ -f "$tmp/logo.png" ] || fail "missing public file at root"
[ -f "$tmp/manifest.json" ] || fail "missing manifest.json at root"
[ -f "$tmp/build-version.json" ] || fail "missing build-version.json at root"
[ -f "$tmp/.well-known/assetlinks.json" ] || fail "missing .well-known file at root"
grep -q '/_next/static/\*' "$tmp/_routes.json" || fail "_routes.json does not exclude /_next/static/*"
grep -q '/build-version.json' "$tmp/_routes.json" || fail "_routes.json does not exclude /build-version.json"

echo "pages-deploy layout test passed."
