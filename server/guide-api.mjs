#!/usr/bin/env node
/**
 * A CUP guide — ЮKassa + промокоды + токены доступа
 */
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dataDir = resolve(__dirname, 'data');
const storePath = resolve(dataDir, 'orders.json');
const guidePath = resolve(dataDir, 'final-guide.html');

const envPath = resolve(root, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const PORT = Number(process.env.GUIDE_PORT || process.env.PORT || 8788);
const SITE_URL = (process.env.SITE_URL || 'http://xn--80aa3av.xn--p1ai').replace(/\/$/, '');
const SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';
const SECRET = process.env.YOOKASSA_SECRET_KEY || '';
const ADMIN_KEY = process.env.GUIDE_ADMIN_KEY || '';
const PRICE = Number(process.env.GUIDE_PRICE || 299);
const FREE_PROMOS = String(process.env.GUIDE_PROMO_FREE || 'аркадий,arkadiy')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Фиксированные токены доступа (не генерируются заново). */
const FIXED_TOKEN_PERM = String(process.env.GUIDE_FIXED_TOKEN || 'ACUP-PERM-GUIDE-01').toUpperCase();
const FIXED_PROMO_TOKENS = {
  аркадий: 'ACUP-PROMO-ARKADIY',
  arkadiy: 'ACUP-PROMO-ARKADIY',
};

if (!SECRET || !SHOP_ID) {
  console.error('YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY required in .env');
  process.exit(1);
}
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
if (!existsSync(guidePath)) {
  console.error('Missing final-guide.html at', guidePath);
  process.exit(1);
}

const auth = Buffer.from(`${SHOP_ID}:${SECRET}`).toString('base64');

/** @type {{ orders: Record<string, any>, tokens: Record<string, any> }} */
let store = { orders: {}, tokens: {} };

function loadStore() {
  try {
    if (existsSync(storePath)) {
      store = JSON.parse(readFileSync(storePath, 'utf8'));
      if (!store.orders) store.orders = {};
      if (!store.tokens) store.tokens = {};
    }
  } catch (e) {
    console.error('store load', e.message);
  }
}
function saveStore() {
  try {
    writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('store save', e.message);
  }
}
loadStore();

function seedFixedTokens() {
  const now = Date.now();
  const seed = [
    { token: FIXED_TOKEN_PERM, orderId: 'fixed_perm', note: 'permanent' },
    { token: 'ACUP-PROMO-ARKADIY', orderId: 'fixed_promo_arkadiy', note: 'promo:аркадий' },
  ];
  let changed = false;
  for (const row of seed) {
    const t = row.token.toUpperCase();
    if (!store.tokens[t] || !store.tokens[t].paid) {
      store.tokens[t] = {
        token: t,
        orderId: row.orderId,
        paid: true,
        email: '',
        createdAt: store.tokens[t]?.createdAt || now,
        paidAt: store.tokens[t]?.paidAt || now,
        fixed: true,
        note: row.note,
      };
      changed = true;
    } else {
      store.tokens[t].paid = true;
      store.tokens[t].fixed = true;
    }
  }
  if (changed) saveStore();
}
seedFixedTokens();

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key, X-Access-Token');
}
function json(res, code, obj) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function genToken() {
  const hex = randomBytes(6).toString('hex').toUpperCase();
  return `ACUP-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}
function genOrderId() {
  return 'g_' + randomBytes(4).toString('hex') + Date.now().toString(36).slice(-4);
}
function normalizePromo(code) {
  return String(code || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}
function isFreePromo(code) {
  const n = normalizePromo(code);
  return n && FREE_PROMOS.includes(n);
}

async function yk(path, { method = 'GET', body, idempotenceKey } = {}) {
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };
  if (idempotenceKey) headers['Idempotence-Key'] = idempotenceKey;
  const r = await fetch(`https://api.yookassa.ru/v3${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

function fixedTokenForPromo(promo) {
  const n = normalizePromo(promo);
  if (!n) return null;
  const t = FIXED_PROMO_TOKENS[n];
  return t ? String(t).toUpperCase() : null;
}

function ensureTokenForOrder(order) {
  // Промо → всегда один и тот же токен
  const fixed = fixedTokenForPromo(order.promo);
  if (fixed) {
    order.token = fixed;
    store.tokens[fixed] = {
      ...(store.tokens[fixed] || {}),
      token: fixed,
      orderId: order.id,
      paid: order.status === 'paid' || !!(store.tokens[fixed] && store.tokens[fixed].paid),
      email: order.email || (store.tokens[fixed] && store.tokens[fixed].email) || '',
      createdAt: (store.tokens[fixed] && store.tokens[fixed].createdAt) || order.createdAt || Date.now(),
      promo: order.promo || null,
      fixed: true,
    };
    if (order.status === 'paid') {
      store.tokens[fixed].paid = true;
      store.tokens[fixed].paidAt = order.paidAt || Date.now();
    }
    return fixed;
  }
  if (order.token && store.tokens[order.token]) return order.token;
  let token = genToken();
  while (store.tokens[token]) token = genToken();
  order.token = token;
  store.tokens[token] = {
    token,
    orderId: order.id,
    paid: order.status === 'paid',
    email: order.email || '',
    createdAt: order.createdAt || Date.now(),
    promo: order.promo || null,
  };
  return token;
}

function markPaid(orderId, meta = {}) {
  const order = store.orders[orderId];
  if (!order) return null;
  ensureTokenForOrder(order);
  if (order.status !== 'paid') {
    order.status = 'paid';
    order.paidAt = Date.now();
  }
  order.payment = { ...(order.payment || {}), ...meta };
  const tok = store.tokens[order.token];
  if (tok) {
    tok.paid = true;
    tok.paidAt = order.paidAt;
  }
  saveStore();
  return order;
}

function publicOrder(order) {
  if (!order) return null;
  const paid = order.status === 'paid';
  return {
    orderId: order.id,
    status: order.status,
    amount: order.amount,
    email: order.email || '',
    product: order.product,
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
    promo: order.promo || null,
    paymentId: order.paymentId || null,
    token: paid ? order.token : undefined,
    accessUrl: paid
      ? `${SITE_URL}/guide/access.html?token=${encodeURIComponent(order.token)}`
      : undefined,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  if (url.pathname === '/health' || url.pathname === '/api/guide/health') {
    return json(res, 200, {
      ok: true,
      service: 'acup-guide',
      provider: 'yookassa',
      shopId: SHOP_ID,
      orders: Object.keys(store.orders).length,
    });
  }

  // Create order: free promo OR YooKassa payment
  if (
    (url.pathname === '/api/guide/create-order' || url.pathname === '/api/guide/order') &&
    req.method === 'POST'
  ) {
    try {
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const promo = normalizePromo(body.promo || body.promoCode || '');
      const allConsent = !!(body.consent || body.acceptAll || body.cAll);
      const acceptOffer = !!(body.acceptOffer || allConsent);
      const acceptPrivacy = !!(body.acceptPrivacy || allConsent);
      const acceptDigital = !!(body.acceptDigital || allConsent);
      const acceptIp = !!(body.acceptIp || allConsent);

      if (!acceptOffer || !acceptPrivacy || !acceptDigital || !acceptIp) {
        return json(res, 400, {
          error: 'need_consents',
          message: 'Нужно принять оферту, политику, условия цифрового товара и авторские права',
        });
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 400, { error: 'bad_email', message: 'Некорректный email' });
      }

      const orderId = genOrderId();
      const free = isFreePromo(promo);

      // Free promo path
      if (free) {
        const order = {
          id: orderId,
          status: 'paid',
          amount: 0,
          email,
          product: 'guide-specialty',
          productTitle: 'От нуля до specialty',
          createdAt: Date.now(),
          paidAt: Date.now(),
          promo,
          payment: { method: 'promo', code: promo },
          consents: { offer: true, privacy: true, digital: true, ip: true, at: Date.now() },
        };
        ensureTokenForOrder(order);
        store.tokens[order.token].paid = true;
        store.tokens[order.token].paidAt = order.paidAt;
        store.orders[orderId] = order;
        saveStore();
        return json(res, 200, {
          orderId,
          free: true,
          amount: 0,
          ...publicOrder(order),
        });
      }

      // Invalid promo typed but not free list → error (so user notices typo)
      if (promo && !free) {
        return json(res, 400, {
          error: 'promo_not_found',
          message: 'Промокод не найден. Проверьте написание или оплатите 299 ₽',
        });
      }

      // Paid path via YooKassa
      const order = {
        id: orderId,
        status: 'pending',
        amount: PRICE,
        email,
        product: 'guide-specialty',
        productTitle: 'От нуля до specialty',
        createdAt: Date.now(),
        promo: null,
        payment: {},
        consents: { offer: true, privacy: true, digital: true, ip: true, at: Date.now() },
      };
      ensureTokenForOrder(order);
      store.orders[orderId] = order;
      saveStore();

      const returnUrl = `${SITE_URL}/guide/success.html?order=${encodeURIComponent(orderId)}`;
      const { ok, status, data } = await yk('/payments', {
        method: 'POST',
        idempotenceKey: randomUUID(),
        body: {
          amount: { value: PRICE.toFixed(2), currency: 'RUB' },
          capture: true,
          confirmation: { type: 'redirect', return_url: returnUrl },
          description: `A CUP: гайд «От нуля до specialty» (${orderId})`.slice(0, 128),
          metadata: {
            orderId,
            product: 'guide-specialty',
            site: 'akap.rf',
          },
        },
      });

      if (!ok) {
        console.error('YK create', status, data);
        order.status = 'error';
        order.payment = { error: data };
        saveStore();
        return json(res, status || 502, {
          error: data.description || data.code || 'yookassa_error',
          details: data,
        });
      }

      order.paymentId = data.id;
      order.payment = { id: data.id, status: data.status };
      saveStore();

      return json(res, 200, {
        orderId,
        free: false,
        amount: PRICE,
        currency: 'RUB',
        paymentId: data.id,
        confirmation_url: data.confirmation && data.confirmation.confirmation_url,
        successUrl: returnUrl,
      });
    } catch (e) {
      console.error(e);
      return json(res, 500, { error: e.message || 'server_error' });
    }
  }

  // Poll order: also sync YooKassa payment status if pending
  if (url.pathname === '/api/guide/order-status' && req.method === 'GET') {
    const id = url.searchParams.get('order') || url.searchParams.get('id') || '';
    const order = store.orders[id];
    if (!order) return json(res, 404, { error: 'not_found' });

    if (order.status !== 'paid' && order.paymentId) {
      try {
        const { ok, data } = await yk(`/payments/${encodeURIComponent(order.paymentId)}`);
        if (ok && data) {
          order.payment = { ...(order.payment || {}), status: data.status, paid: !!data.paid };
          if (data.paid || data.status === 'succeeded') {
            markPaid(id, { yookassaStatus: data.status, synced: true });
          } else {
            saveStore();
          }
        }
      } catch (e) {
        console.error('yk sync', e.message);
      }
    }
    return json(res, 200, publicOrder(store.orders[id]));
  }

  // YooKassa webhook (optional)
  if (url.pathname === '/api/guide/webhook' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const obj = body.object || body;
      const paymentId = obj.id;
      const metaOrder = obj.metadata && obj.metadata.orderId;
      let orderId = metaOrder;
      if (!orderId && paymentId) {
        orderId = Object.keys(store.orders).find((k) => store.orders[k].paymentId === paymentId);
      }
      if (orderId && (obj.paid || obj.status === 'succeeded')) {
        markPaid(orderId, { webhook: true, paymentId, status: obj.status });
      }
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  // Admin mark paid
  if (url.pathname === '/api/guide/admin/mark-paid' && req.method === 'POST') {
    if (!ADMIN_KEY) return json(res, 503, { error: 'admin_disabled' });
    const key = req.headers['x-admin-key'] || '';
    if (key !== ADMIN_KEY) return json(res, 403, { error: 'forbidden' });
    const body = await readBody(req);
    const order = markPaid(String(body.orderId || ''), { manual: true });
    if (!order) return json(res, 404, { error: 'not_found' });
    return json(res, 200, publicOrder(order));
  }

  // Redeem promo only (shortcut) — same as create with promo
  if (url.pathname === '/api/guide/promo' && req.method === 'POST') {
    const body = await readBody(req);
    // reuse create-order logic by internal call shape
    req.url = '/api/guide/create-order';
    // fallthrough not easy — just duplicate free path
    const promo = normalizePromo(body.promo || body.promoCode || '');
    if (!isFreePromo(promo)) {
      return json(res, 400, { error: 'promo_not_found', message: 'Промокод не найден' });
    }
    // force consents for promo-only endpoint if not provided
    body.acceptOffer = body.acceptOffer !== false;
    body.acceptPrivacy = body.acceptPrivacy !== false;
    body.acceptDigital = body.acceptDigital !== false;
    body.acceptIp = body.acceptIp !== false;
  }

  if (url.pathname === '/api/guide/validate' && req.method === 'GET') {
    const token = String(url.searchParams.get('token') || '').trim().toUpperCase();
    const row = store.tokens[token];
    if (!row || !row.paid) return json(res, 403, { ok: false, error: 'invalid_token' });
    return json(res, 200, { ok: true, token, product: 'guide-specialty', title: 'От нуля до specialty' });
  }

  if (url.pathname === '/api/guide/content' && req.method === 'GET') {
    const token = String(url.searchParams.get('token') || req.headers['x-access-token'] || '')
      .trim()
      .toUpperCase();
    const row = store.tokens[token];
    if (!row || !row.paid) {
      return json(res, 403, { error: 'invalid_token', message: 'Нужен оплаченный или промо-токен' });
    }
    row.lastAccessAt = Date.now();
    saveStore();
    let html = readFileSync(guidePath, 'utf8');
    // Fallback: .reveal starts at opacity:0 until JS adds .vis — ensure text visible if scripts lag
    const inject = `<style id="acup-access-fix">
.reveal{opacity:1!important;transform:none!important;transition:none!important}
.hero-bottom{opacity:1!important;transform:none!important}
.letter{opacity:1!important}
</style>`;
    if (html.includes('</head>')) html = html.replace('</head>', inject + '</head>');
    else html = inject + html;
    cors(res);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    return res.end(html);
  }

  return json(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  console.log(`acup-guide listening on :${PORT}`);
  console.log(`shopId=${SHOP_ID} price=${PRICE}`);
  console.log(`free promos: ${FREE_PROMOS.join(', ')}`);
  console.log(`POST /api/guide/create-order`);
  console.log(`GET  /api/guide/order-status?order=`);
  console.log(`GET  /api/guide/content?token=`);
});
