#!/usr/bin/env bash
# Keep guide-api + cloudflared up. If public URL dies or changes — patch config and push to GH Pages.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE="${NODE:-/home/hack/.nvm/versions/node/v24.14.0/bin/node}"
CF="${CLOUDFLARED:-/home/hack/bin/cloudflared}"
PORT="${GUIDE_PORT:-8788}"
LOG_API="${LOG_API:-/tmp/acup-guide-api.log}"
LOG_CF="${LOG_CF:-/tmp/acup-guide-tunnel.log}"
STATE="${STATE:-/tmp/acup-api-base.txt}"
LOCK="/tmp/acup-ensure-tunnel.lock"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "ensure-tunnel already running"
  exit 0
fi

log() { echo "[$(date -Iseconds)] $*"; }

need_restart_api=0
if ! curl -sf -m 3 "http://127.0.0.1:${PORT}/api/guide/health" | grep -q '"ok"'; then
  need_restart_api=1
fi

if [ "$need_restart_api" = 1 ]; then
  log "API down — restarting guide-api.mjs"
  pkill -f 'node .*akap/server/guide-api.mjs' 2>/dev/null || true
  pkill -f 'node server/guide-api.mjs' 2>/dev/null || true
  sleep 1
  nohup "$NODE" "$ROOT/server/guide-api.mjs" >>"$LOG_API" 2>&1 &
  for i in $(seq 1 20); do
    sleep 0.5
    if curl -sf -m 3 "http://127.0.0.1:${PORT}/api/guide/health" | grep -q '"ok"'; then
      log "API up on :$PORT"
      break
    fi
  done
  if ! curl -sf -m 3 "http://127.0.0.1:${PORT}/api/guide/health" | grep -q '"ok"'; then
    log "ERROR: API failed to start (see $LOG_API)"
    exit 1
  fi
fi

# Current URL from config / state
CURRENT=""
if [ -f "$STATE" ]; then CURRENT=$(tr -d '[:space:]' <"$STATE" || true); fi
if [ -z "$CURRENT" ] && [ -f "$ROOT/config.js" ]; then
  CURRENT=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$ROOT/config.js" | head -1 || true)
fi

public_ok=0
if [ -n "$CURRENT" ]; then
  if curl -sf -m 12 "$CURRENT/api/guide/health" | grep -q '"ok"'; then
    public_ok=1
  fi
fi

if [ "$public_ok" = 1 ]; then
  log "OK public $CURRENT"
  echo "$CURRENT" >"$STATE"
  # Keep api-base.json in sync even if only state file had it
  printf '%s\n' "{\"apiBase\":\"$CURRENT\",\"updatedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >"$ROOT/api-base.json"
  exit 0
fi

log "Public API down (current=${CURRENT:-none}) — restarting cloudflared tunnel"

# Kill only the guide tunnel (8788), not pozdravka 8787
pkill -f "cloudflared tunnel --url http://127.0.0.1:${PORT}" 2>/dev/null || true
sleep 1
: >"$LOG_CF"
nohup "$CF" tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate >"$LOG_CF" 2>&1 &

URL=""
for i in $(seq 1 45); do
  sleep 1
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_CF" | tail -1 || true)
  if [ -n "$URL" ]; then
    if curl -sf -m 10 "$URL/api/guide/health" | grep -q '"ok"'; then
      break
    fi
    URL=""
  fi
done

if [ -z "$URL" ]; then
  log "ERROR: could not establish public tunnel (see $LOG_CF)"
  exit 1
fi

log "New tunnel $URL"
echo "$URL" >"$STATE"
printf '%s\n' "{\"apiBase\":\"$URL\",\"updatedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >"$ROOT/api-base.json"

# Patch config.js apiBase (and apiBases[0] if present)
python3 - "$ROOT/config.js" "$URL" <<'PY'
import re, sys
path, base = sys.argv[1], sys.argv[2].rstrip("/")
text = open(path, encoding="utf-8").read()
orig = text
text = re.sub(
    r"(apiBase:\s*')https://[^']+\.trycloudflare\.com(')",
    rf"\g<1>{base}\2",
    text,
    count=1,
)
# optional first entry in apiBases array
text = re.sub(
    r"(apiBases:\s*\[\s*')https://[^']+\.trycloudflare\.com(')",
    rf"\g<1>{base}\2",
    text,
    count=1,
)
if text == orig:
    print("warning: config.js not patched", file=sys.stderr)
open(path, "w", encoding="utf-8").write(text)
print(base)
PY

# Deploy to GitHub Pages so live site picks up new URL
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" add config.js api-base.json 2>/dev/null || true
  if ! git -C "$ROOT" diff --cached --quiet 2>/dev/null; then
    git -C "$ROOT" commit -m "chore(api): refresh Cloudflare tunnel apiBase (auto)" || true
    # push may fail offline — don't crash watchdog
    if git -C "$ROOT" push origin HEAD:main 2>>"$LOG_API"; then
      log "Pushed apiBase to origin/main"
    else
      log "WARN: git push failed — URL local-only until push succeeds"
    fi
  else
    log "config already up to date in git index"
  fi
fi

log "DONE public=$URL"
echo "$URL"
