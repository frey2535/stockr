#!/usr/bin/env bash
# Layout OpenNext output so Cloudflare Pages serves /_next/* at the site root.
#
# OpenNext puts hashed CSS/JS in .open-next/assets/_next, but the HTML requests
# /_next/.... Pages' ASSETS binding is the upload root (it does not use
# wrangler.jsonc assets.directory). _worker.js also handles every path unless
# _routes.json excludes static files — without that, CSS/JS 404 even when present.
set -euo pipefail

ROOT="${OPEN_NEXT_DIR:-.open-next}"

if [ ! -d "$ROOT/assets/_next" ] || [ ! -f "$ROOT/worker.js" ]; then
  echo "Missing OpenNext build in $ROOT. Run: npx opennextjs-cloudflare build" >&2
  exit 1
fi

rm -rf "$ROOT/_next"
cp -a "$ROOT/assets/_next" "$ROOT/_next"
find "$ROOT/assets" -mindepth 1 -maxdepth 1 ! -name '_next' -exec cp -a {} "$ROOT/" \;
cp "$ROOT/worker.js" "$ROOT/_worker.js"

cat > "$ROOT/_routes.json" <<'EOF'
{
  "version": 1,
  "include": ["/*"],
  "exclude": [
    "/_next/static/*",
    "/manifest.json",
    "/.well-known/*",
    "/*.png",
    "/*.ico",
    "/*.txt",
    "/*.webmanifest"
  ]
}
EOF

if [ "${PAGES_DEPLOY_LAYOUT_ONLY:-}" = "1" ]; then
  echo "Laid out $ROOT for Pages static assets."
  exit 0
fi

if [ -f wrangler.jsonc ]; then
  mv wrangler.jsonc wrangler.jsonc.bak
fi

npx wrangler pages deploy "$ROOT" --project-name=stockr --branch=main --commit-dirty=true
