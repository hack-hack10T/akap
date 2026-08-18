# A CUP — AGENTS.md (контекст для Codex-ревью)

## Проект
- Продукт: цифровой гид по кофе «От нуля до specialty» (A CUP), продажа через акап.рф.
- Позиционирование (мастер-план §0): интерактивный помощник по настройке вкуса кофе дома; продаётся не «49 глав», а система, объясняющая, почему чашка не получается и что изменить прямо сейчас.
- Главный бесплатный продукт (лид-магнит): диагностика «Почему кофе кислый / горький / пустой?» — Coffee Fix (`/coffee-fix.html`).
- Цена на старте: 499 ₽ (контроль до 50 продаж и 20 отзывов), затем тесты 690/990 ₽. Реф-скидка 10% = 449 ₽. Stars — 275⭐.

## Стек
- Статика на REG.RU-хостинге (nginx) + Cloudflare Worker `acup-access` (оплата/доступ, D1+R2).
- Единый checkout: `js/checkout.js` → `window.ACUP.beginCheckout({placement, offerVariant})` → `/api/payments` (ЮKassa). Идемпотентность по `client_nonce`.
- Яндекс.Метрика 111214147; цели: view_buy (IntersectionObserver), click_buy, checkout, payment_success, purchase; Coffee Fix: fix_start/fix_method/fix_result/fix_lead.
- Прод-домен: акап.рф (punycode xn--80aa3av.xn--p1ai); API-база: acup-access.acup-access.workers.dev.

## Правила
1. Прод не трогать без команды «запускаем» (владелец). Всё — в отдельных ветках, одно ревью на пакет.
2. Реальные цены в разметке: 499 ₽ (не 299). Гарантия — 7 дней (ст. 26.1 ЗоЗПП, юр. решение 06.08; коммит 6dd41bc).
3. UTM/ref: first-touch (sessionStorage acup_utm_*) + last-touch (URL), единообразно из всех CTA.
4. A11Y: никаких onclick на div — button, aria, focus, клавиатура, reduced-motion.
5. Адаптив: 360/390/768/1440 px, без горизонтального скролла.
6. Источник требований: `docs/A_CUP_MASTER_PLAN.md` (мастер-план v1.0, 18.08.2026). Конфликт задачи с мастер-планом → остановиться и поднять владельцу.

## DoD (для ревью пакетов сектора D/B)
- PAY: единый beginCheckout, ошибки видимы, кнопки разблокируются, client_nonce идемпотентен.
- ANA: события не дублируются, view_buy по видимости, checkout после успешного создания платежа.
- WEB: canonical/OG/Product-разметка с реальными ценами.
- LEAD-01: Coffee Fix — ≥7 методов, mobile ≤90 сек, события fix_*, CTA через beginCheckout.
- PERF: TTFB ≤0.8 с.
