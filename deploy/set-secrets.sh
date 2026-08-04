#!/usr/bin/env bash
# Устанавливает секреты Worker acup-access для Telegram-бота.
# Перед запуском (из корня репозитория):
#   export BOT_TOKEN="<токен из BotFather>"
#   export BOT_WEBHOOK_SECRET="<случайная строка>"
#   export YOOKASSA_PROVIDER_TOKEN="<provider-токен ЮKassa>"   # опционально
set -euo pipefail
cd "$(dirname "$0")/.."

WRANGLER="npx wrangler@4.118.0"

: "${BOT_TOKEN:?Укажите BOT_TOKEN (токен бота из BotFather)}"
: "${BOT_WEBHOOK_SECRET:?Укажите BOT_WEBHOOK_SECRET (случайная строка, понадобится и в set-webhook.sh)}"

echo "$BOT_TOKEN" | $WRANGLER secret put BOT_TOKEN
echo "$BOT_WEBHOOK_SECRET" | $WRANGLER secret put BOT_WEBHOOK_SECRET

if [ -n "${YOOKASSA_PROVIDER_TOKEN:-}" ]; then
  echo "$YOOKASSA_PROVIDER_TOKEN" | $WRANGLER secret put YOOKASSA_PROVIDER_TOKEN
  echo "YOOKASSA_PROVIDER_TOKEN установлен — карта: нативный инвойс."
else
  echo "YOOKASSA_PROVIDER_TOKEN не задан — карта будет работать через ссылку на ЮKassa (fallback)."
fi

echo "Готово. Дальше: npx wrangler@4.118.0 deploy"
