# A CUP — PROJECT STATE (источник: мастер-план v1.0, 18.08.2026; актуализация 19.08.2026)

## Текущее состояние
- **main** = e08d942 (Merge LEAD-01) + 4ea6119 (Merge N1-D ФАЗА 0). Статус: «подготовлено к запуску» (требование к 19.08).
- **Прод**: НЕ выкачен — ждёт команду владельца «запускаем». Работает старая инфраструктура (buy.html, worker acup-access).
- **Готово (в main)**:
  - ФАЗА 0 (N1-D): `js/checkout.js` — единый `beginCheckout({placement, offerVariant})`; PAY-02 (видимая ошибка `#payStatus`, разблокировка, retry); UTM/ref first+last-touch; цели Метрики click_buy/checkout/view_buy(IO); canonical/OG/Product JSON-LD (499 ₽).
  - LEAD-01: `coffee-fix.html` — диагностика вкуса (4 симптома × 8 методов), события fix_start/fix_method/fix_result/fix_lead, a11y, CTA через beginCheckout.
- **После запуска**: N1-B (UX-01/02, A11Y-01), Toolkit, партнёрка, клуб, 16–20 SEO-страниц, тест цен 690/990 ₽.

## Ключевые факты
- Цена: 499 ₽ (контроль), реф 449 ₽, Stars 275⭐.
- Гарантия: 7 дней (ст. 26.1 ЗоЗПП; юр. решение 06.08, коммит 6dd41bc).
- Метрика: счётчик 111214147; цели view_buy/click_buy/checkout/payment_success/purchase (+ fix_* для Coffee Fix).
- Домен: акап.рф (punycode xn--80aa3av.xn--p1ai); API: acup-access.acup-access.workers.dev.
- Схема событий 8.1 (landing_view→referral_purchase) — в работе (Софья); файл docs/events-schema-8.1.md должен появиться в репо.

## Открытые вопросы
- Оригинальная папка A_CUP_Codex_Context (ChatGPT Library) запрошена у владельца; ревью идёт по мастер-плану (см. AGENTS.md, CODEX_REVIEW_PROMPTS.md).
- PERF-01: TTFB <0.8 с (замерено 19.08); «12–15 с» владельца — вероятная сетевая аномалия, повторные замеры при необходимости.
