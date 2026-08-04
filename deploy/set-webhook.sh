#!/usr/bin/env bash
# Устанавливает webhook Telegram → Worker acup-access (роут /bot).
# Перед запуском:
#   export BOT_TOKEN="<токен из BotFather>"
#   export BOT_WEBHOOK_SECRET="<тот же секрет, что в set-secrets.sh>"
set -euo pipefail

: "${BOT_TOKEN:?Укажите BOT_TOKEN (токен бота из BotFather)}"
: "${BOT_WEBHOOK_SECRET:?Укажите BOT_WEBHOOK_SECRET (тот же, что в секретах Worker)}"

URL="https://acup-access.acup-access.workers.dev/bot"
ALLOWED='["message","callback_query","pre_checkout_query"]'

echo "Устанавливаю webhook: $URL"
curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${URL}" \
  --data-urlencode "secret_token=${BOT_WEBHOOK_SECRET}" \
  --data-urlencode "allowed_updates=${ALLOWED}"

echo
echo "Проверка: curl -sS https://api.telegram.org/bot\${BOT_TOKEN}/getWebhookInfo"
