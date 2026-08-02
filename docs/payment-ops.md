# A CUP — оплата (ops)

## Что крутится

| Unit | Роль |
|------|------|
| `acup-guide-api.service` | Node `guide-api.mjs` :8788 (ЮKassa) |
| `acup-guide-cloudflared.service` | Cloudflare quick tunnel → :8788 |
| `acup-guide-tunnel.timer` | каждые 2 мин: health → при падении перезапуск + push `apiBase` в Pages |

## Фиксированные токены (не меняются)

| Токен | Как получить |
|-------|----------------|
| `ACUP-PERM-GUIDE-01` | постоянный доступ к гайду |
| `ACUP-PROMO-ARKADIY` | промокод **аркадий** / **arkadiy** (всегда этот токен) |

Открыть: `http://акап.рф/guide/access.html?token=ACUP-PERM-GUIDE-01`

## Команды

```bash
systemctl --user status acup-guide-api acup-guide-cloudflared acup-guide-tunnel.timer
/home/hack/akap/server/ensure-tunnel.sh          # руками
curl -sS http://127.0.0.1:8788/api/guide/health
cat /tmp/acup-api-base.txt
curl -sS "$(cat /tmp/acup-api-base.txt)/api/guide/health"
```

## После ребута

`Linger=yes` у user `hack` — сервисы поднимаются без логина.  
Timer в течение ~30 с поднимет/проверит tunnel и при смене URL закоммитит `config.js` + `api-base.json` и сделает `git push`.

## Если оплата «offline»

1. `systemctl --user restart acup-guide-api acup-guide-cloudflared`
2. `/home/hack/akap/server/ensure-tunnel.sh`
3. Hard refresh buy.html (Ctrl+F5)
4. Проверить, что live `http://акап.рф/api-base.json` совпадает с `/tmp/acup-api-base.txt`

## Ограничение

Quick tunnel URL **меняется** при рестарте cloudflared.  
Watchdog + `js/api.js` + `api-base.json` закрывают это автоматически.  
Для URL «навсегда один» нужен **named Cloudflare Tunnel** (аккаунт CF + домен/subdomain).
