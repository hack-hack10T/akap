# CODEX_REVIEW_PROMPTS.md — шаблоны независимого ревью (A CUP)

Перед ревью: прочитай `AGENTS.md`, `docs/A_CUP_PROJECT_STATE.md`, релевантные разделы `docs/A_CUP_MASTER_PLAN.md`. Изучи `git diff` пакета, запусти тесты/линтеры/сборку, проверь happy path / error path / повторное действие / mobile (360/390/768/1440) / соседние контуры. Первый проход — БЕЗ правок.

## Базовый промпт (сектор D — платежи/доступ/аналитика)

```
Ты — независимый ревьюер пакета A CUP (сектор D: платежи, доступ, аналитика).
Ветка/коммит: <ветка>/<commit>. Diff: git diff <base>...<HEAD>.

Проверь по DoD из AGENTS.md:
1. PAY-01: единый beginCheckout({placement, offerVariant}) — нет параллельных реализаций; UTM/ref (first+last-touch) одинаково из hero/sticky/низ; идемпотентность по client_nonce; payment_success — только server-side (вебхук), редирект ≠ оплата.
2. PAY-02: при ошибке — видимое сообщение (#payStatus), кнопки разблокированы, retry безопасен.
3. ANA-01: view_buy по IntersectionObserver (один раз), click_buy/checkout/payment разделены, дублей целей нет.
4. WEB-01: canonical, OG, Product markup — только реальные цены (499 ₽, не 299).
5. PERF-01: TTFB ≤0.8 с.

Прогони: happy path (клик → платёж → confirmation_url), error path (сеть/403 → видимая ошибка → разблокировка), повторное действие (двойной клик/повтор submit — один платёж), mobile (360/390/768/1440 — нет гориз. скролла), соседние контуры (Coffee Fix CTA, SEO-страницы).

Вердикт: PASS / CHANGES REQUIRED / BLOCKED. Ошибки: P0 (блокер), P1 (критично для запуска), P2 (желательно). Статус каждого DoD: OK / FAIL / N/A. Разрешение на merge: да/нет.
```

## Промпт (сектор B — frontend платного продукта, UX)

```
Ты — независимый ревьюер пакета A CUP (сектор B: UX платного продукта).
Ветка/коммит: <ветка>/<commit>.

Проверь по DoD из AGENTS.md:
- UX-01: onboarding + home-screen — выбор метода и свой рецепт за 2 клика.
- UX-02: поиск с опечатками/синонимами, закладки, «Продолжить», print-режим карточек без фоновой графики, дневник чашек.
- A11Y-01: button/aria/focus/клавиатура/reduced-motion, нет onclick на div.
- Адаптив 360/390/768/1440, без гориз. скролла.

Прогони: happy path, error path, повторное действие, mobile, соседние контуры.
Вердикт: PASS / CHANGES REQUIRED / BLOCKED + P0/P1/P2 + статус каждого DoD + разрешение на merge.
```
