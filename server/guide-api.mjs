#!/usr/bin/env node
/**
 * A CUP guide — заказы, ЮMoney notify, токены доступа
 * Секреты только в .env (не коммитить).
 */
import http from 'node:http';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dataDir = resolve(__dirname, 'data');
const storePath = resolve(dataDir, 'orders.json');
const guidePath = resolve(dataDir, 'final-guide.html');

// load .env
const envPath = resolve(root, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const PORT = Number(process.env.GUIDE_PORT || process.env.PORT || 8788);
// Prefer http until custom-domain TLS on GitHub Pages is approved for акап.рф
const SITE_URL = (process.env.SITE_URL || 'http://xn--80aa3av.xn--p1ai').replace(/\/$/, '');
const YM_RECEIVER = process.env.YOOMONEY_RECEIVER || '4100119499142622';
const YM_NOTIFY_SECRET = process.env.YOOMONEY_NOTIFICATION_SECRET || '';
const ADMIN_KEY = process.env.GUIDE_ADMIN_KEY || '';
const PRICE = Number(process.env.GUIDE_PRICE || 299);

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
if (!existsSync(guidePath)) {
  console.error('Missing final-guide.html at', guidePath);
  process.exit(1);
}

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

function text(res, code, body, type = 'text/plain; charset=utf-8') {
  cors(res);
  res.writeHead(code, { 'Content-Type': type });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw;
}

function parseForm(raw) {
  const out = {};
  for (const part of String(raw || '').split('&')) {
    if (!part) continue;
    const [k, v] = part.split('=');
    out[decodeURIComponent(k || '')] = decodeURIComponent((v || '').replace(/\+/g, ' '));
  }
  return out;
}

function genToken() {
  // e.g. ACUP-A1B2-C3D4-E5F6
  const hex = randomBytes(6).toString('hex').toUpperCase();
  return `ACUP-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

function genOrderId() {
  return 'g_' + randomBytes(4).toString('hex') + Date.now().toString(36).slice(-4);
}

/** Verify YooMoney HTTP notification hash if secret is set */
function verifyYmHash(fields) {
  if (!YM_NOTIFY_SECRET) return { ok: true, weak: true };
  // notification_type&operation_id&amount&currency&datetime&sender&codepro&notification_secret&label
  const str = [
    fields.notification_type || '',
    fields.operation_id || '',
    fields.amount || '',
    fields.currency || '',
    fields.datetime || '',
    fields.sender || '',
    fields.codepro || '',
    YM_NOTIFY_SECRET,
    fields.label || '',
  ].join('&');
  const hash = createHash('sha1').update(str, 'utf8').digest('hex');
  const given = String(fields.sha1_hash || '').toLowerCase();
  if (!given || hash.length !== given.length) return { ok: false };
  try {
    const a = Buffer.from(hash);
    const b = Buffer.from(given);
    return { ok: timingSafeEqual(a, b) };
  } catch {
    return { ok: false };
  }
}

function markPaid(orderId, meta = {}) {
  const order = store.orders[orderId];
  if (!order) return null;
  if (order.status === 'paid') return order;
  order.status = 'paid';
  order.paidAt = Date.now();
  order.payment = { ...order.payment, ...meta };
  const tok = store.tokens[order.token];
  if (tok) {
    tok.paid = true;
    tok.paidAt = order.paidAt;
  }
  saveStore();
  return order;
}

function publicOrder(order, { revealToken = false } = {}) {
  if (!order) return null;
  return {
    orderId: order.id,
    status: order.status,
    amount: order.amount,
    email: order.email || '',
    product: order.product,
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
    token: revealToken && order.status === 'paid' ? order.token : undefined,
    accessUrl:
      revealToken && order.status === 'paid'
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

  // health
  if (url.pathname === '/health' || url.pathname === '/api/guide/health') {
    return json(res, 200, {
      ok: true,
      service: 'acup-guide',
      receiver: YM_RECEIVER.slice(0, 6) + '…',
      orders: Object.keys(store.orders).length,
    });
  }

  // Create order + payment form params
  if ((url.pathname === '/api/guide/create-order' || url.pathname === '/api/guide/order') && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      let body = {};
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        body = parseForm(raw);
      }
      const email = String(body.email || '').trim().toLowerCase();
      const acceptOffer = body.acceptOffer === true || body.acceptOffer === '1' || body.acceptOffer === 'on';
      const acceptPrivacy = body.acceptPrivacy === true || body.acceptPrivacy === '1' || body.acceptPrivacy === 'on';
      const acceptDigital = body.acceptDigital === true || body.acceptDigital === '1' || body.acceptDigital === 'on';
      const acceptIp = body.acceptIp === true || body.acceptIp === '1' || body.acceptIp === 'on';

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
      let token = genToken();
      while (store.tokens[token]) token = genToken();

      const amount = PRICE;
      const order = {
        id: orderId,
        token,
        status: 'pending',
        amount,
        email: email || '',
        product: 'guide-specialty',
        productTitle: 'От нуля до specialty',
        createdAt: Date.now(),
        consents: {
          offer: true,
          privacy: true,
          digital: true,
          ip: true,
          at: Date.now(),
        },
        payment: {},
      };
      store.orders[orderId] = order;
      store.tokens[token] = {
        token,
        orderId,
        paid: false,
        email: email || '',
        createdAt: order.createdAt,
      };
      saveStore();

      const successUrl = `${SITE_URL}/guide/success.html?order=${encodeURIComponent(orderId)}`;
      // QuickPay fields — https://yoomoney.ru/docs/payment-buttons/using-api/forms
      const quickpay = {
        receiver: YM_RECEIVER,
        'quickpay-form': 'shop',
        targets: `A CUP: гайд «От нуля до specialty» (${orderId})`.slice(0, 150),
        paymentType: String(body.paymentType || 'AC'),
        sum: amount.toFixed(2),
        label: orderId,
        successURL: successUrl,
        need_email: email ? 'false' : 'true',
      };

      return json(res, 200, {
        orderId,
        amount,
        currency: 'RUB',
        // токен не отдаём до оплаты
        quickpayAction: 'https://yoomoney.ru/quickpay/confirm',
        quickpay,
        successUrl,
      });
    } catch (e) {
      console.error(e);
      return json(res, 500, { error: e.message || 'server_error' });
    }
  }

  // Order status (token only if paid)
  if (url.pathname === '/api/guide/order-status' && req.method === 'GET') {
    const id = url.searchParams.get('order') || url.searchParams.get('id') || '';
    const order = store.orders[id];
    if (!order) return json(res, 404, { error: 'not_found' });
    return json(res, 200, publicOrder(order, { revealToken: true }));
  }

  // YooMoney HTTP notification
  if (url.pathname === '/api/guide/notify' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const fields = parseForm(raw);
      console.log('ym notify', {
        type: fields.notification_type,
        label: fields.label,
        amount: fields.amount,
        op: fields.operation_id,
      });
      const v = verifyYmHash(fields);
      if (!v.ok) {
        console.warn('ym notify bad hash');
        return text(res, 400, 'bad hash');
      }
      const label = String(fields.label || '');
      const order = store.orders[label];
      if (!order) {
        // still 200 so YooMoney doesn't retry forever for unknown
        return text(res, 200, 'unknown label');
      }
      const paidAmount = Number(fields.amount);
      if (Number.isFinite(paidAmount) && paidAmount + 0.001 < order.amount) {
        console.warn('ym notify underpaid', paidAmount, order.amount);
        return text(res, 200, 'underpaid');
      }
      markPaid(label, {
        operationId: fields.operation_id,
        sender: fields.sender,
        amount: fields.amount,
        datetime: fields.datetime,
        notificationType: fields.notification_type,
        weakVerify: !!v.weak,
      });
      return text(res, 200, 'ok');
    } catch (e) {
      console.error('notify', e);
      return text(res, 500, 'error');
    }
  }

  // Admin: mark paid manually (for support)
  if (url.pathname === '/api/guide/admin/mark-paid' && req.method === 'POST') {
    if (!ADMIN_KEY) return json(res, 503, { error: 'admin_disabled' });
    const key = req.headers['x-admin-key'] || '';
    if (key !== ADMIN_KEY) return json(res, 403, { error: 'forbidden' });
    const raw = await readBody(req);
    const body = JSON.parse(raw || '{}');
    const order = markPaid(String(body.orderId || ''), { manual: true, by: 'admin' });
    if (!order) return json(res, 404, { error: 'not_found' });
    return json(res, 200, publicOrder(order, { revealToken: true }));
  }

  // Validate token
  if (url.pathname === '/api/guide/validate' && req.method === 'GET') {
    const token = String(url.searchParams.get('token') || '').trim().toUpperCase();
    const row = store.tokens[token];
    if (!row || !row.paid) return json(res, 403, { ok: false, error: 'invalid_token' });
    return json(res, 200, {
      ok: true,
      token,
      product: 'guide-specialty',
      title: 'От нуля до specialty',
    });
  }

  // Serve guide HTML only with valid paid token
  if (url.pathname === '/api/guide/content' && req.method === 'GET') {
    const token = String(
      url.searchParams.get('token') || req.headers['x-access-token'] || ''
    )
      .trim()
      .toUpperCase();
    const row = store.tokens[token];
    if (!row || !row.paid) {
      return json(res, 403, { error: 'invalid_token', message: 'Нужен оплаченный токен доступа' });
    }
    row.lastAccessAt = Date.now();
    saveStore();
    const html = readFileSync(guidePath, 'utf8');
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
  console.log(`POST /api/guide/create-order`);
  console.log(`POST /api/guide/notify  (YooMoney HTTP notifications)`);
  console.log(`GET  /api/guide/order-status?order=`);
  console.log(`GET  /api/guide/content?token=`);
  console.log(`receiver=${YM_RECEIVER}`);
});
