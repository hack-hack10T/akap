#!/usr/bin/env bash
# Long-running cloudflared for guide-api. Writes URL to /tmp/acup-api-base.txt when ready.
set -euo pipefail
PORT="${GUIDE_PORT:-8788}"
CF="${CLOUDFLARED:-/home/hack/bin/cloudflared}"
LOG="${LOG_CF:-/tmp/acup-guide-tunnel.log}"
STATE="${STATE:-/tmp/acup-api-base.txt}"

: >"$LOG"
exec > >(tee -a "$LOG") 2>&1

echo "[$(date -Iseconds)] starting cloudflared → 127.0.0.1:${PORT}"

# Background: watch log for URL and publish to STATE
(
  for i in $(seq 1 120); do
    sleep 1
    URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | grep -v 'api\.trycloudflare' | tail -1 || true)
    if [ -n "$URL" ]; then
      echo "$URL" >"$STATE"
      echo "[$(date -Iseconds)] published URL $URL"
      break
    fi
  done
) &

exec "$CF" tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate
