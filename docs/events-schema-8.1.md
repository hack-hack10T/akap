# Единая схема событий A CUP 2.0 — раздел 8.1 Master Plan

Статус: черновик для внедрения (Фаза 0 / ANA-01, LEAD-01)
Версия: 0.1 · Дата: 18.08.2026 · Автор: Софья Белова (аналитика)
Связанные требования: Master Plan 8.1, 8.2, 8.4; распоряжения N1-D (PAY-01, PAY-02, ANA-01), N2.

## 1. Принципы

1. **Одно событие = один факт.** Не склеивать «клик + оплата» в одно событие.
2. **Источник истины для денег — сервер.** `payment_success` создаёт только серверный webhook ЮKassa. Редирект пользователя на `/payment/return` оплатой НЕ считается.
3. **Идемпотентность по `client_nonce`.** Повторный клик с тем же nonce не создаёт второй активный заказ.
4. **Единая атрибуция.** UTM/ref из всех CTA (hero, sticky, нижняя форма) передаются одинаково, через один код-путь `beginCheckout`.
5. **Валидация.** Событие появляется один раз, содержит обязательные параметры, связывается с order (order_id) там, где это предусмотрено.
6. **view_buy — по видимости**, не по загрузке страницы (IntersectionObserver на offer-блок).

Каналы: **C** = клиент (браузер → Метрика), **S** = сервер (worker → D1 + Метрика по API при наличии доступа; минимум D1-запись).

## 2. Таблица событий

| Событие | Канал | Триггер | Обязательные параметры | Связь с заказом | Цель Метрики |
|---|---|---|---|---|---|
| `landing_view` | C | Первый квалифицированный просмотр лендинга (видимость hero/offer) | `page_variant`, `utm` (source/medium/campaign/term/content), `ref`, `device` | нет | — (визит) |
| `diagnostic_start` | C | Начало Coffee Fix | `method` (если известен), `entry_page` | нет | `diagnostic_start` |
| `diagnostic_step` | C | Каждый шаг диагностики | `step`, `answer_id` | нет | — |
| `diagnostic_complete` | C | Получен результат | `method`, `problem`, `result_id` | нет | `diagnostic_complete` |
| `result_save` | C | Сохранение результата / контакт (opt-in) | `result_id`, `channel` | нет | `result_save` |
| `preview_open` | C | Открытие настоящего демо продукта | `screen_id`, `source` | нет | `preview_open` |
| `cta_click` | C | Клик по любому CTA (кнопка/ссылка покупки или диагностики) | `placement` (hero/sticky/footer/seo_fix/…), `price_variant`, `offer_variant` | нет | `cta_click` / `click_buy` |
| `checkout_create` | C | Создан заказ в `/api/payments` (успешный ответ, order_id получен) | `order_id`, `source`, `price`, `currency` | да (order_id) | `checkout_create` |
| `checkout_redirect` | C | Переход в ЮKassa (confirmed payment URL) | `order_id`, `payment_method_if_known` | да (order_id) | — |
| `payment_success` | **S** | Webhook ЮKassa `payment.succeeded`, статус заказа → paid | `order_id`, `product`, `net_amount`, `utm`, `ref` | да (order_id) | `purchase` / `payment_succeeded` |
| `access_open` | C | Получен доступ к продукту (первый вход) | `order_id`/`user_id`, `first_time` | да (order_id) | `access_open` |
| `tool_use` | C | Использование инструмента продукта | `tool`, `method`, `result` | нет | — |
| `recipe_save` | C | Сохранение рецепта | `method`, `ratio` | нет | `recipe_save` |
| `review_submit` | C | Отзыв после покупки | `verified`, `method`, `rating` | да (order_id) | `review_submit` |
| `refund` | **S** | Webhook `refund.succeeded` | `order_id`, `reason`, `days_after` | да (order_id) | — |
| `upsell_purchase` | S | Покупка апселла | `source_product`, `target_product` | да (order_id) | — |
| `referral_purchase` | S | Покупка по реф-коду партнёра | `ref_id`, `product` | да (order_id) | — |

## 3. Маппинг целей Яндекс.Метрики (счётчик 111214147)

| Цель в Метрике | Событие | Тип цели | ID (текущий) |
|---|---|---|---|
| `click_buy` («Клик Купить гайд») | cta_click по CTA покупки | JS-событие, параметр ур.1 = click_buy | 591937440 |
| `view_buy` («Просмотр страницы покупки») | view_buy (buy.html, по видимости offer) | JS-событие, идентификатор содержит view_buy | 593419260 |
| `purchase` («Покупка гайда») | payment_success (сервер) | JS-событие, параметр ур.1 = purchase | 591937343 |
| `payment_succeeded` («Успешная оплата гайда») | payment_success (сервер) | JS-событие, идентификатор содержит payment_succeeded | 592465415 |
| `checkout_create` — **создать** | checkout_create | JS-событие, параметр ур.1 = checkout_create | — |

Требование ANA-01: клик, checkout и payment — РАЗДЕЛЬНЫЕ цели (не одна цель на всю воронку). Текущий набор это обеспечивает после добавления `checkout_create`.

## 4. Спецификация beginCheckout (PAY-01)

Единая функция в клиенте (заменяет две параллельные реализации: старый `/guide/payment.html?promo=` и текущий form submit на `/api/payments`):

```
beginCheckout({ placement, offerVariant, priceVariant })
```

Поведение:
1. Считать `client_nonce` (crypto.randomUUID), сохранить в сессии до ответа.
2. Собрать атрибуцию из единого источника (см. §5): utm + ref + first_touch/last_touch.
3. Отправить `cta_click` {placement, price_variant, offer_variant}.
4. POST `/api/payments` с {placement, offerVariant, priceVariant, client_nonce, utm, ref}.
5. При успехе: `checkout_create` {order_id, source, price, currency} → редирект на URL ЮKassa.
6. При ошибке: показать видимый `role="status"`/`aria-live`, разблокировать все кнопки, НЕ создавать новый заказ автоматически (безопасный retry — см. §7).

Все CTA (hero, sticky-панель, нижний блок, mobileBuy) вызывают ОДНУ функцию; placement передаётся из атрибута `data-placement` кнопки.

## 5. Атрибуция UTM/ref (PAY-01)

- При первом заходе на сайт: все `utm_*` из URL сохранить в sessionStorage (`acup_utm_<name>`), `ref` — из `document.referrer` (первый внешний источник) или параметра `ref`.
- **first-touch**: значение, сохранённое при первом визите в сессии; **last-touch**: значение из текущего URL (если пришёл с рекламы повторно — перезаписывает last-touch, first-touch не трогаем).
- В `/api/payments` и в заказ D1 сохраняются ОБА набора + utm из текущего клика.
- webhook `payment_success` несёт utm/ref из записи заказа (не из редиректа).

Текущий код (buy.html, строки ~220–250) уже пишет utm в sessionStorage и передаёт в `/api/payments` — привести к единому виду: добавить ref, first/last-touch, и вызывать из hero-CTA тоже (сейчас hero ведёт на /guide/buy.html через location.href — потеря utm при переходе; исправить на beginCheckout или прокидку location.search).

## 6. view_buy по видимости (ANA-01)

- Триггер: `IntersectionObserver` на offer-блок (#buy), `threshold: 0.6` (или 0.5 — зафиксировать одно значение), срабатывает ОДИН раз за сессию (флаг в sessionStorage).
- НЕ отправлять при загрузке страницы, если блок не виден.
- Параметры: нет (или price_variant).

## 7. Ошибки и идемпотентность (PAY-02)

- Все кнопки оплаты: `disabled` + смена текста на время запроса; при ошибке — снять disabled, показать текст ошибки в `role="status" aria-live="polite"`.
- Повторный клик с тем же `client_nonce` не создаёт новый заказ: сервер возвращает существующий order_id (idempotent по nonce). `client_nonce` хранится в сессии и в заказе D1.
- Время жизни nonce: 30 минут; по истечении — новый nonce (новый заказ).

## 8. Проверка (как убедиться, что событие работает)

1. Метрика: CDP-браузер → `Network.enable` → следить за `goal://<host>/<goal_name>` (reachGoal) и `watch/<id>`.
2. D1: `SELECT order_id, utm_source, client_nonce, status FROM orders ORDER BY created_at DESC LIMIT 20` — один order_id на nonce, utm заполнены.
3. Повторный клик: тот же nonce → тот же order_id, нет дублей.
4. view_buy: открыть buy.html без скролла → событие НЕ должно уйти; проскроллить до offer → уходит один раз.
5. payment_success: тестовый платёж → webhook → D1 status=paid; редирект /payment/return без webhook → статус не меняется.

## 9. Открытые вопросы к Главному

1. `checkout_create` в Метрике — создаю как JS-событие (параметр ур.1 = checkout_create); подтвердить именование цели («Начало оплаты (checkout)»).
2. Лимит целей Метрики 200 — текущих 8 + checkout_create = 9, запас есть.
3. Dashboard владельца (8.3) — спецификация отдельным документом, релиз после запуска (не блокирует N2).
