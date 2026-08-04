// bot.js — Telegram-бот продажи справочника A CUP «От нуля до specialty»
// Webhook-роут: POST /bot (секрет в заголовке X-Telegram-Bot-Api-Secret-Token)
// Оплата: карта через ЮKassa (Telegram Payments) и Telegram Stars.
// Токен доступа выдаётся той же функцией token(), что и на сайте;
// возврат (карта/Stars) отзывает доступ через те же сессии.

const BOT_API = 'https://api.telegram.org/bot';

const WELCOME = `
☕ <b>A CUP — «От нуля до specialty»</b>

Практический справочник, который поможет понимать зерно, упаковку и вкус без профессиональной терминологии.

<b>После прочтения ты сможешь:</b>
✔ выбирать зерно без маркетинговых уловок
✔ понимать, что написано на упаковке
✔ перестать получать кислый или горький кофе
✔ готовить вкуснее дома
✔ экономить деньги на неудачных покупках

💰 <b>299 ₽</b> картой или <b>165 ⭐</b> — один вечер чтения вместо месяцев случайных ошибок.
`;

const INSIDE = `
📖 <b>Что внутри справочника</b>

Главы продают результат, а не темы:

• <b>Как читать упаковку</b> — после этой главы ты перестанешь покупать зерно только потому, что упаковка красивая.
• <b>Как выбирать зерно</b> — без маркетинговых уловок и громких слов на этикетке.
• <b>Как готовить дома</b> — перестань получать кислый или горький кофе: понятные рецепты и шпаргалки.
• <b>Как экономить</b> — больше никаких неудачных покупок вслепую.

Внутри: реальные таблицы, шпаргалки и примеры рецептов. Формат — интерактивный справочник, доступ открывается по персональному токену.
`;

export const successText = (order, token, url) => `
🎉 <b>Оплата прошла успешно!</b>

Заказ: <code>${order}</code>

<b>Твой персональный токен доступа:</b>
<code>${token}</code>

Как открыть справочник:
1. Перейди по ссылке: ${url}/login
2. Введи токен (или сохрани его — он действует всё время доступа).

Сохрани токен в надёжном месте. При возврате оплаты доступ будет отозван автоматически.
`;

const MENU = {
  inline_keyboard: [
    [
      { text: '💳 Купить за 299 ₽', callback_data: 'buy_card' },
      { text: '⭐ Купить за 165 ⭐', callback_data: 'buy_stars' },
    ],
    [
      { text: '📖 Что внутри', callback_data: 'whats_inside' },
      { text: '🔑 Мой доступ', callback_data: 'my_access' },
    ],
  ],
};

async function tg(e, method, body) {
  const r = await fetch(BOT_API + e.BOT_TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({}));
}

async function send(e, chatId, text, extra = {}) {
  return tg(e, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra,
  });
}

async function sendInvoice(e, chatId, provider) {
  const isStars = provider === 'stars';
  const body = {
    chat_id: chatId,
    title: 'Справочник A CUP «От нуля до specialty»',
    description:
      'Практический гайд: понимать зерно, упаковку и вкус. Персональный токен доступа после оплаты.',
    payload: crypto.randomUUID(), // id будущего заказа; привязывается при successful_payment
    provider_token: isStars ? '' : (e.YOOKASSA_PROVIDER_TOKEN || ''),
    currency: isStars ? 'XTR' : 'RUB',
    prices: isStars
      ? [{ label: 'Справочник «От нуля до specialty»', amount: Number(e.BOT_STARS_PRICE || 165) }]
      : [{ label: 'Справочник «От нуля до specialty»', amount: 29900 }],
  };
  return tg(e, 'sendInvoice', body);
}

// Оплата картой без provider-токена Telegram: создаём платёж ЮKassa напрямую
// (self-fetch Worker→Worker нестабилен) и отдаём ссылку; после оплаты webhook
// ЮKassa сам пришлёт токен в этот чат (см. activate + tg_chat_id в index.js).
async function cardLinkFlow(e, chatId) {
  try {
    const now = Date.now();
    const id = crypto.randomUUID();
    const pub = 'AC-' + id.replaceAll('-', '').slice(0, 16).toUpperCase();
    const key = crypto.randomUUID();
    const returnKey = crypto.randomUUID() + crypto.randomUUID();
    const returnHash = await e.__hash(returnKey);
    await e.DB.prepare(
      `INSERT INTO orders(id,public_id,product_id,product_version,amount,currency,status,idempotency_key,created_at,updated_at,return_key_hash,tg_chat_id)
       VALUES(?,?,?,?,29900,'RUB','created',?,?,?,?,?)`
    )
      .bind(id, pub, e.PRODUCT_ID, e.PRODUCT_VERSION, key, now, now, returnHash, chatId)
      .run();
    const ret = new URL('/payment/return', e.__origin);
    ret.searchParams.set('order', pub);
    ret.searchParams.set('key', returnKey);
    const q = await e.__yk(e, '/payments', {
      method: 'POST',
      key,
      body: {
        amount: { value: '299.00', currency: 'RUB' },
        capture: true,
        confirmation: { type: 'redirect', return_url: ret.href },
        description: `Справочник A CUP «От нуля до specialty», заказ №${pub}`,
        metadata: { order_id: id, product_id: e.PRODUCT_ID, product_version: e.PRODUCT_VERSION },
      },
    });
    if (!q.ok) throw new Error('payment_unavailable');
    await e.DB.prepare("UPDATE orders SET status='payment_pending',yookassa_payment_id=?,confirmation_url=?,updated_at=? WHERE id=?")
      .bind(q.data.id, q.data.confirmation.confirmation_url, Date.now(), id)
      .run();
    return send(e, chatId, '💳 Оплата картой — по кнопке ниже (ЮKassa). После оплаты персональный токен доступа придёт прямо в этот чат.', {
      reply_markup: { inline_keyboard: [[{ text: '💳 Оплатить 299 ₽', url: q.data.confirmation.confirmation_url }]] },
    });
  } catch (err) {
    try {
      await e.DB.prepare('INSERT INTO system_events VALUES(?,?,?,?,?,?,?,NULL)')
        .bind(crypto.randomUUID(), 'error', 'bot', 'card_payment', String(err?.message || err).slice(0, 300), '{}', Date.now())
        .run();
    } catch (_) {}
    return send(e, chatId, '⚠️ Не удалось создать платёж. Попробуй ещё раз чуть позже.');
  }
}

// Создаёт заказ после подтверждённой оплаты и выдаёт токен. Идемпотентно.
async function activateBotOrder(e, u, chargeId) {
  // u: {tgUserId, tgChatId, provider:'card'|'stars', amount, currency, providerChargeId}
  const now = Date.now();
  const id = crypto.randomUUID();
  const pub = 'AC-' + id.replaceAll('-', '').slice(0, 16).toUpperCase();
  const t = await e.__token(id);
  const th = await e.__hash(t);
  try {
    await e.DB.prepare(
      `INSERT INTO orders(id,public_id,product_id,product_version,amount,currency,status,idempotency_key,yookassa_payment_id,created_at,updated_at,paid_at,token_key_version,token_hash,receipt_status,tg_user_id,tg_chat_id)
       VALUES(?,?,?,?,?,?,'access_created',?,?,?,?,?,1,?,'none',?,?)`
    )
      .bind(id, pub, e.PRODUCT_ID, e.PRODUCT_VERSION, u.amount, u.currency, chargeId, u.providerChargeId, now, now, now, th, u.tgUserId, u.tgChatId)
      .run();
  } catch (err) {
    // Повторная доставка successful_payment: находим существующий заказ по charge id
    const existing = await e.DB.prepare(
      "SELECT id,public_id,token_hash FROM orders WHERE idempotency_key=? AND status='access_created'"
    )
      .bind(chargeId)
      .first();
    if (existing) {
      const tok = await e.__token(existing.id);
      await send(e, u.tgChatId, successText(existing.public_id, tok, e.__origin));
      return false;
    }
    throw err;
  }
  await e.__notify(`A CUP: продажа через бота ${pub} — ${u.currency === 'XTR' ? u.amount / 100 + ' ⭐ (Stars)' : u.amount / 100 + ' ₽ (карта)'}`);
  await send(e, u.tgChatId, successText(pub, t, e.__origin));
  return true;
}

async function handleUpdate(e, upd) {
  if (upd.message?.text === '/start') {
    return send(e, upd.message.chat.id, WELCOME, { reply_markup: MENU });
  }
  // Админ-команды (только владелец)
  if (upd.message?.text && String(upd.message.chat.id) === String(e.TELEGRAM_CHAT_ID)) {
    const m = upd.message.text.trim();
    if (m.startsWith('/refund')) {
      const pub = m.split(/\s+/)[1] || '';
      return refundOrder(e, upd.message.chat.id, pub.toUpperCase());
    }
    if (m === '/stats') {
      const row = await e.DB.prepare(
        "SELECT COUNT(*) n, SUM(CASE WHEN status='access_created' THEN 1 ELSE 0 END) sold FROM orders WHERE created_at>?"
      )
        .bind(Date.now() - 864e5)
        .first();
      return send(e, upd.message.chat.id, `📊 Продажи за 24ч: всего ${row.n}, оплачено и выдано: ${row.sold || 0}`);
    }
  }
  if (upd.callback_query) {
    const cq = upd.callback_query;
    const chatId = cq.message?.chat?.id || cq.from.id;
    if (cq.data === 'buy_card') {
      await tg(e, 'answerCallbackQuery', { callback_query_id: cq.id });
      if (!e.YOOKASSA_PROVIDER_TOKEN) return cardLinkFlow(e, chatId);
      const ok = await sendInvoice(e, chatId, 'card');
      if (ok?.ok) return;
      return cardLinkFlow(e, chatId);
    }
    if (cq.data === 'buy_stars') {
      const ok = await sendInvoice(e, chatId, 'stars');
      await tg(e, 'answerCallbackQuery', { callback_query_id: cq.id });
      if (!ok?.ok) {
        await send(e, chatId, '⚠️ Не удалось создать платёж Stars. Попробуй ещё раз чуть позже.');
      }
      return;
    }
    if (cq.data === 'whats_inside') {
      await tg(e, 'answerCallbackQuery', { callback_query_id: cq.id });
      return send(e, chatId, INSIDE, { reply_markup: MENU });
    }
    if (cq.data === 'my_access') {
      await tg(e, 'answerCallbackQuery', { callback_query_id: cq.id });
      const o = await e.DB.prepare(
        "SELECT id,public_id FROM orders WHERE tg_user_id=? AND status='access_created' ORDER BY created_at DESC LIMIT 1"
      )
        .bind(cq.from.id)
        .first();
      if (!o) return send(e, chatId, 'У тебя пока нет оплаченного доступа. Нажми «Купить» — и через минуту он появится здесь. 😉', { reply_markup: MENU });
      const tok = await e.__token(o.id);
      return send(e, chatId, successText(o.public_id, tok, e.__origin), { reply_markup: MENU });
    }
  }
  if (upd.pre_checkout_query) {
    return tg(e, 'answerPreCheckoutQuery', { pre_checkout_query_id: upd.pre_checkout_query.id, ok: true });
  }
  if (upd.message?.successful_payment) {
    const p = upd.message.successful_payment;
    const isStars = p.currency === 'XTR';
    return activateBotOrder(
      e,
      {
        tgUserId: upd.message.from.id,
        tgChatId: upd.message.chat.id,
        provider: isStars ? 'stars' : 'card',
        amount: p.total_amount,
        currency: p.currency,
        providerChargeId: p.provider_payment_charge_id || p.telegram_payment_charge_id,
      },
      p.telegram_payment_charge_id
    );
  }
  return null;
}

async function refundOrder(e, chatId, pub) {
  const o = await e.DB.prepare(
    "SELECT * FROM orders WHERE public_id=? AND status='access_created'"
  )
    .bind(pub)
    .first();
  if (!o) return send(e, chatId, 'Заказ не найден или доступ не был выдан.');
  if (o.currency === 'XTR') {
    const r = await tg(e, 'refundStarPayment', {
      chat_id: o.tg_chat_id,
      user_id: o.tg_user_id,
      telegram_payment_charge_id: o.idempotency_key,
    });
    if (!r?.ok) return send(e, chatId, 'Не удалось вернуть Stars: ' + (r?.description || 'ошибка Telegram'));
    await revoke(e, o);
    return send(e, chatId, `⭐ Возврат Stars оформлен, доступ по ${o.public_id} отозван.`);
  }
  if (o.yookassa_payment_id) {
    const q = await e.__yk(e, '/refunds', {
      method: 'POST',
      key: crypto.randomUUID(),
      body: { payment_id: o.yookassa_payment_id, amount: { value: '299.00', currency: 'RUB' } },
    });
    if (!q.ok) return send(e, chatId, 'Не удалось оформить возврат в ЮKassa: ' + JSON.stringify(q.data?.description || q.data));
    await revoke(e, o);
    return send(e, chatId, `💳 Возврат в ЮKassa оформлен, доступ по ${o.public_id} отозван.`);
  }
  return send(e, chatId, 'Нет данных для возврата по этому заказу.');
}

async function revoke(e, o) {
  await e.DB.batch([
    e.DB.prepare("UPDATE orders SET status='refunded',refunded_at=?,updated_at=? WHERE id=? AND status='access_created'")
      .bind(Date.now(), Date.now(), o.id),
    e.DB.prepare('UPDATE sessions SET revoked_at=? WHERE order_id=? AND revoked_at IS NULL')
      .bind(Date.now(), o.id),
  ]);
  await e.__notify('A CUP: возврат через бота, доступ отозван ' + o.public_id);
}

export async function botFetch(req, e, helpers) {
  // Проверка секрета webhook (Telegram шлёт X-Telegram-Bot-Api-Secret-Token)
  if (!e.BOT_TOKEN || !e.BOT_WEBHOOK_SECRET) return new Response('not configured', { status: 503 });
  if (req.headers.get('x-telegram-bot-api-secret-token') !== e.BOT_WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 401 });
  }
  const upd = await req.json().catch(() => null);
  if (!upd) return new Response('bad json', { status: 400 });
  // Прокидываем хелперы из index.js (token/hash/yk/notify) + origin для ссылок
  e.__token = helpers.token;
  e.__hash = helpers.hash;
  e.__yk = helpers.yk;
  e.__notify = helpers.notify;
  e.__origin = helpers.origin;
  try {
    const out = await handleUpdate(e, upd);
    // Ответ Telegram должен быть быстрым; отвечаем 200 всегда
    return new Response('ok');
  } catch (err) {
    try {
      await e.__notify('A CUP bot error: ' + String(err?.message || err).slice(0, 300));
    } catch {}
    return new Response('ok');
  }
}
