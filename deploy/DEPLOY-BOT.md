# Деплой Telegram-бота продаж справочника A CUP

Бот уже написан и закоммичен в `main` (`worker/src/bot.js`, роут `POST /bot`).
Эта ветка содержит скрипты и инструкцию, чтобы запустить его за пару минут.

## Предусловия

1. Создан бот в @BotFather и получен токен — см. ветку `docs/botfather-checklist` → `CHECKLIST-BOT.md`.
2. Доступ к Cloudflare (wrangler OAuth) — уже настроен на этой машине.
3. Рабочая директория — корень репозитория (`/home/hack/akap`).

## Шаги

### 1. Секреты

```bash
cd /home/hack/akap

export BOT_TOKEN="<токен из BotFather>"
export BOT_WEBHOOK_SECRET="$(openssl rand -hex 24)"   # любая случайная строка
# Опционально — нативные инвойсы картой прямо в чате:
export YOOKASSA_PROVIDER_TOKEN="<provider-токен ЮKassa для Telegram>"

./deploy/set-secrets.sh
```

Без `YOOKASSA_PROVIDER_TOKEN` кнопка «💳 Купить за 299 ₽» автоматически
переключится на ссылку оплаты ЮKassa (`/api/bot/payment`) — токен доступа
после оплаты всё равно придёт прямо в чат (через webhook ЮKassa).

### 2. Деплой Worker

```bash
npx wrangler@4.118.0 deploy
```

(wrangler глобально не установлен — только через `npx`.)

### 3. Webhook Telegram → Worker

```bash
export BOT_TOKEN="<тот же токен>"
export BOT_WEBHOOK_SECRET="<тот же секрет>"
./deploy/set-webhook.sh
```

Webhook встанет на `https://acup-access.acup-access.workers.dev/bot`
с проверкой заголовка `X-Telegram-Bot-Api-Secret-Token`.

## Проверка

- `/start` у бота → приветствие и кнопки (💳 299 ₽, ⭐ 165, 📖 Что внутри, 🔑 Мой доступ).
- Покупка Stars → инвойс → после оплаты приходит токен доступа.
- Покупка картой → инвойс (если есть provider-токен) или ссылка ЮKassa.
- Владелец (chat id = `TELEGRAM_CHAT_ID`): `/stats` — продажи за 24 ч, `/refund <AC-XXXX>` — возврат.

## Откат

```bash
curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook"
```
