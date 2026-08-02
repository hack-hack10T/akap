# Гайд A CUP — оплата ЮKassa + промокод

## Поток

1. `guide/buy.html` — согласия + опционально промокод  
2. **Промокод `АРКАДИЙ`** → сразу токен (0 ₽)  
3. Без промокода → платёж **ЮKassa** (ShopID `1298699`) → redirect checkout  
4. `guide/success.html` — поллинг статуса, выдача токена  
5. `guide/access.html?token=…` — HTML гайда  

## API

```
POST /api/guide/create-order
GET  /api/guide/order-status?order=
GET  /api/guide/validate?token=
GET  /api/guide/content?token=
```

## Промокоды

В `.env`: `GUIDE_PROMO_FREE=аркадий,arkadiy`  
Регистр не важен: `АРКАДИЙ`, `Аркадий`, `arkadiy`.

## Запуск API

```bash
cd /home/hack/akap
node server/guide-api.mjs   # :8788
cloudflared tunnel --url http://127.0.0.1:8788
# URL → config.js guide.apiBase
```
