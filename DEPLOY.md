# AKAP (акап.рф) — диагностика и восстановление

**Дата проверки:** 2026-07-26  
**Домен:** акап.рф → punycode `xn--80aa3av.xn--p1ai`  
**IP (сейчас):** `37.140.192.64` (server110.hosting.reg.ru)

---

## 1. Диагностика (факты)

| Проверка | Результат |
|----------|-----------|
| DNS A `акап.рф` | `37.140.192.64` ✅ |
| DNS A `www` | `37.140.192.64` ✅ |
| NS | `ns1.reg.ru`, `ns2.reg.ru` |
| AAAA | нет |
| Порт 80 | **OPEN** (не closed) |
| Порт 443 | **OPEN** (не closed) |
| HTTP | **403** |
| HTTPS | **403** |
| SSL | GlobalSign, **валиден** до 2026-09-11 |
| SAN сертификата | `xn--80aa3av.xn--p1ai`, `www.…`, mail, owa, autodiscover |
| nginx | отвечает |
| Тело ответа | страница REG.RU: **«Работа сайта приостановлена»** |
| Причина на странице | *«Закончился срок действия услуги, или сайт был отключен в панели управления»* |
| Панель | https://server110.hosting.reg.ru/manager |

**Вывод:** DNS, nginx и SSL в порядке. Сайт **не «лежит» из‑за сети/порта** — REG.RU **осознанно отдаёт 403 parking/suspend** для этого vhost. DocumentRoot/сборка тут ни при чём, пока аккаунт хостинга выключен или неоплачен.

Локальный код (`index.html`) — **чистый статический HTML** (~56 KB), без сборки. Локально отдаёт **200**.

---

## 2. Стек репозитория

- **Стек:** single-page static HTML + Tailwind CDN + Font Awesome CDN + canvas JS
- **Сборка:** не нужна (`npm` / `dist` нет)
- **Деплой:** положить `index.html` (+ `.htaccess` на Apache) в DocumentRoot **или** GitHub Pages / Cloudflare Pages / Vercel

Файлы в репо:
- `index.html` — сайт
- `.htaccess` — REG.RU Apache
- `nginx.conf.example` — VPS
- `CNAME` + `.nojekyll` + `.github/workflows/pages.yml` — GitHub Pages
- `vercel.json`, `_redirects` — Vercel / Cloudflare Pages / Netlify

---

## 3. Корневая причина

```
REG.RU hosting suspended / expired / disabled for this site
→ nginx serves official 403 page "Работа сайта приостановлена"
→ HTTP 403 on both :80 and :443
```

Не подтвердилось:
- закрытые 80/443 (они open)
- просроченный SSL (сертификат живой)
- «не собран dist» (сайту сборка не нужна)
- GitHub Pages + неверный DNS (DNS указывает на REG.RU, Pages не используется)

---

## 4A. Быстрый вариант — починить на REG.RU

Нужен доступ в панель (логин/пароль REG.RU). Без этого **нельзя** снять 403 снаружи.

### Шаги

1. Войти: https://www.reg.ru/user/account/  
   или https://server110.hosting.reg.ru/manager  
2. Проверить:
   - услуга **хостинга** активна / оплачена (не «заблокирована», не «истекла»);
   - домен **привязан** к этому хостингу;
   - сайт **включён** (не «отключён администратором»).
3. Если истёк срок — **продлить/оплатить** хостинг.
4. В файловом менеджере / FTP открыть DocumentRoot сайта (часто `www/акап.рф` или `public_html` / `www/xn--80aa3av.xn--p1ai`).
5. Залить файлы:

```bash
# с вашей машины (подставьте FTP-данные из панели)
lftp -u 'FTP_USER,FTP_PASS' ftp://server110.hosting.reg.ru <<'EOF'
mirror -R --verbose --exclude-glob .git/ /home/hack/akap/ /www/xn--80aa3av.xn--p1ai/
# или public_html — смотрите фактический путь в панели
bye
EOF
```

Минимум: `index.html` + `.htaccess`.

6. SSL: в панели REG.RU → SSL → убедиться, что сертификат для apex+www активен (сейчас GlobalSign до 11.09.2026 — ок).
7. Проверка:

```bash
curl -I https://xn--80aa3av.xn--p1ai/
# ожидание: HTTP/2 200
curl -I http://xn--80aa3av.xn--p1ai/
# ожидание: 301 → https
```

### Если после оплаты всё ещё 403

- Support REG.RU: https://help.reg.ru/  
- Тема: сайт `акап.рф` / `xn--80aa3av.xn--p1ai` на server110 отдаёт «Работа сайта приостановлена» после продления.  
- Попросить снять suspend и проверить привязку домена к аккаунту.

---

## 4B. Правильный вариант — Pages (рекомендуется для статики)

Статике не нужен shared hosting. Перенос на **Cloudflare Pages** (лучше для кириллических доменов) или **GitHub Pages**.

### B1. GitHub Pages

```bash
cd /home/hack/akap
git add .
git commit -m "AKAP static site: deploy-ready for Pages"
# создать репозиторий (нужен gh auth login)
gh repo create akap-site --public --source=. --remote=origin --push

# Settings → Pages → Source: GitHub Actions
# (workflow уже в .github/workflows/pages.yml)
```

Кастомный домен:
1. Pages → Custom domain → `акап.рф` (и `www.акап.рф` при желании).
2. В DNS REG.RU (пока NS = reg.ru) **или** после переноса NS на Cloudflare:

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `<user>.github.io` |

3. Включить **Enforce HTTPS** после выпуска сертификата (кириллица → punycode; GitHub это умеет).
4. Файл `CNAME` в репо уже содержит `акап.рф`.

Проверка:

```bash
dig +short xn--80aa3av.xn--p1ai A
curl -I https://xn--80aa3av.xn--p1ai/
```

### B2. Cloudflare Pages (предпочтительно для IDN)

```bash
# 1) Залить репо на GitHub (как выше)
# 2) dash.cloudflare.com → Pages → Create → Connect Git → akap-site
#    Build command: (пусто)
#    Output directory: /
# 3) Custom domains → акап.рф
# 4) В REG.RU сменить NS домена на NS от Cloudflare
#    (Cloudflare автоматически SSL Full/Strict + www)
```

### B3. Vercel

```bash
npx vercel --prod
# затем: Project → Domains → акап.рф
# DNS: A/CNAME как покажет Vercel
```

`vercel.json` уже в репо.

---

## 5. www и apex

Цель: **https://акап.рф/** — каноникал, `www` → 301 на apex.

- **REG.RU + .htaccess** — уже настроено в `.htaccess`.
- **GitHub Pages** — в UI указать оба имени, redirect www→apex.
- **Cloudflare** — Page Rule / Bulk Redirect: `www` → apex, Always Use HTTPS.

---

## 6. Чеклист «сайт ожил»

```bash
# DNS
dig +short xn--80aa3av.xn--p1ai A
# SSL
echo | openssl s_client -connect xn--80aa3av.xn--p1ai:443 -servername xn--80aa3av.xn--p1ai 2>/dev/null | openssl x509 -noout -subject -dates
# HTTP
curl -sI https://xn--80aa3av.xn--p1ai/ | head -5   # 200
curl -sI http://xn--80aa3av.xn--p1ai/ | head -5    # 301 https
curl -sI https://www.xn--80aa3av.xn--p1ai/ | head -5 # 301 apex
# Контент — не страница REG.RU
curl -s https://xn--80aa3av.xn--p1ai/ | head -c 200
# должно быть: <title>AKAP — маркетплейс редкого кофе
```

---

## 7. Что **нельзя** сделать без ваших доступов

- Снять suspend REG.RU без панели/оплаты
- Поменять DNS в аккаунте REG.RU
- Запушить на GitHub без `gh auth login` / токена

После доступа к REG.RU **или** GitHub — можно довести до `https://акап.рф/` 200 за 15–30 минут (Pages) или сразу после продления хостинга (REG.RU + FTP).
