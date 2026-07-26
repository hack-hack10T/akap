# AKAP — интернет-маркетплейс редкого кофе

Сайт: **https://акап.рф/** (punycode: `xn--80aa3av.xn--p1ai`)

Высокохудожественный статический лендинг/маркетплейс. Один файл `index.html`, без сборки.

## Быстрый запуск локально

```bash
cd /home/hack/akap
python3 -m http.server 8765
# http://127.0.0.1:8765
```

## Стек

- HTML / CSS / JS (vanilla)
- Tailwind CDN, Font Awesome CDN, Google Fonts
- **Сборка не нужна**

## Деплой

См. полный разбор и планы A/B: **[DEPLOY.md](./DEPLOY.md)**

Кратко:

| Цель | Действие |
|------|----------|
| REG.RU (shared) | Залить `index.html` + `.htaccess` в DocumentRoot (хостинг должен быть **оплачен и включён**) |
| GitHub Pages | Push + Actions workflow `.github/workflows/pages.yml` + Custom domain |
| Cloudflare Pages | Connect repo, output `/`, custom domain + NS |
| Vercel | `npx vercel --prod` |

## Концепция

AKAP — пространство, где каждый лот имеет историю. Hero canvas, каталог, «лаборатория ароматов», корзина, клуб подписок.

## Дизайн

- Палитра: эспрессо / карамель / крем  
- Шрифты: Space Grotesk + Playfair Display  

AKAP 2026.
