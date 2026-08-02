# Цифровой гайд A CUP — оплата и доступ

## Схема

1. Баннер «Купить гайд» → `guide/buy.html`
2. Галочки (оферта, политика, цифровой товар, авторские права, ЮMoney) + email
3. API создаёт заказ и отправляет на **ЮMoney QuickPay** (кошелёк самозанятого)
4. После оплаты ЮMoney редиректит на `guide/success.html?order=…`
5. HTTP-уведомление ЮMoney → API помечает заказ **paid** и открывает **токен**
6. `guide/access.html?token=…` отдаёт HTML «Финальный гайд»

## API (локально)

```bash
cd /home/hack/akap
node server/guide-api.mjs
# :8788

# публичный HTTPS (пример):
cloudflared tunnel --url http://127.0.0.1:8788
# вписать URL в config.js → guide.apiBase
```

## ЮMoney (обязательно)

1. Кошелёк **идентифицирован**, приём карт/СБП включён  
2. Кошелёк в `.env`: `YOOMONEY_RECEIVER=4100…`  
3. **HTTP-уведомления** в настройках ЮMoney:
   - URL: `https://ВАШ-ТУННЕЛЬ/api/guide/notify`
   - Скопировать **секрет** → `YOOMONEY_NOTIFICATION_SECRET` в `.env`
4. Без уведомлений токен не выдастся автоматически — поддержка может подтвердить:

```bash
curl -X POST "$API/api/guide/admin/mark-paid" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $GUIDE_ADMIN_KEY" \
  -d '{"orderId":"g_…"}'
```

## Юридические страницы

- `guide/offer.html` — оферта (самозанятый, авторский гайд, цифровой товар)
- `guide/privacy.html` — политика

## Файлы

- `server/data/final-guide.html` — защищённый гайд (не отдавать статикой без токена)
- `server/data/orders.json` — заказы/токены (в .gitignore)
