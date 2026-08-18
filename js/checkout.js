// A CUP — единый checkout (PAY-01/PAY-02, ANA-01, расп. N1-D)
// Единая точка создания платежа для всех CTA: hero / sticky / блок покупки / формы.
// Метрика: click_buy (placement) → checkout (order_id) → payment_success (на странице возврата).
// UTM/ref: first-touch (sessionStorage acup_utm_*) + last-touch (URL), проброс в /api/payments.
(function (w) {
  'use strict';
  var S = w.ACUP || (w.ACUP = {});

  function qs(n) { try { return new URLSearchParams(location.search).get(n) || ''; } catch (_) { return ''; } }
  function ss(n) { try { return sessionStorage.getItem(n) || ''; } catch (_) { return ''; } }
  function uuid() { try { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2); } catch (_) { return String(Date.now()) + '-' + Math.random().toString(36).slice(2); } }
  function reach(goal, params) { try { if (w.ACUPMetrika) w.ACUPMetrika.reach(goal, params || {}); } catch (_) {} }

  function collectUtm() {
    var keys = ['source', 'medium', 'campaign', 'term', 'content'];
    var utm = {};
    keys.forEach(function (k) {
      var last = qs('utm_' + k);
      var first = ss('acup_utm_' + k);
      if (last) { try { sessionStorage.setItem('acup_utm_' + k, last); } catch (_) {} }
      utm[k] = last || first || '';
    });
    var u = new URLSearchParams();
    keys.forEach(function (k) { if (utm[k]) u.set('utm_' + k, utm[k]); });
    var ref = qs('ref') ? 'ref=' + encodeURIComponent(qs('ref').toUpperCase().trim().slice(0, 9)) : '';
    return [u.toString(), ref].filter(Boolean).join('&');
  }

  function showError(msg) {
    var st = document.getElementById('payStatus');
    if (st) {
      st.textContent = msg || 'Не удалось создать платёж. Проверьте соединение и попробуйте ещё раз.';
      st.hidden = false;
      st.setAttribute('role', 'alert');
    }
  }
  function clearError() { var st = document.getElementById('payStatus'); if (st) st.hidden = true; }

  function lockButtons(lock) {
    document.querySelectorAll('[data-checkout]').forEach(function (b) {
      if (lock) {
        if (!b.dataset.label) b.dataset.label = b.textContent;
        b.disabled = true; b.textContent = 'Переходим к безопасной оплате…';
      } else {
        b.disabled = false; b.textContent = b.dataset.label || b.textContent;
      }
    });
  }

  // Единый checkout: создание платежа, цели Метрики, обработка ошибок и retry
  async function beginCheckout(opts) {
    opts = opts || {};
    var placement = opts.placement || 'buy_card';
    var offerVariant = opts.offerVariant || (qs('ref') ? 'ref' : 'standard');
    if (w.ACUPMetrika) reach('click_buy', { placement: placement, offer: offerVariant, price: 499, currency: 'RUB' });
    lockButtons(true);
    clearError();
    try {
      var base = await w.ACUPResolveApiBase();
      var nonce = uuid();
      try { sessionStorage.setItem('acup_payment_nonce', nonce); } catch (_) {}
      var utmS = collectUtm();
      var url = base + '/api/payments' + (utmS ? '?' + utmS : '');
      var r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_nonce: nonce, acceptOffer: true, acceptPrivacy: true, acceptDigital: true, acceptIp: true, consent: true, placement: placement, offer_variant: offerVariant }),
      });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok || !d.confirmation_url) throw new Error(d.message || d.error || 'Не удалось создать платёж');
      try { sessionStorage.setItem('acup_guide_order', d.orderId); } catch (_) {}
      reach('checkout', { placement: placement, order_id: d.orderId || '', price: 499, currency: 'RUB' });
      location.href = d.confirmation_url;
    } catch (e) {
      lockButtons(false);
      showError(e && e.message ? e.message : undefined);
    }
  }
  S.beginCheckout = beginCheckout;

  function bind() {
    document.querySelectorAll('form.direct-buy').forEach(function (f) {
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        beginCheckout({ placement: f.dataset.placement || 'buy_card', offerVariant: f.dataset.offer || undefined });
      });
    });
    document.querySelectorAll('[data-checkout]').forEach(function (b) {
      b.addEventListener('click', function () {
        beginCheckout({ placement: b.dataset.placement || 'cta', offerVariant: b.dataset.offer || undefined });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();

  // ANA-01: view_buy по фактической видимости блока покупки (один раз)
  function bindViewBuy() {
    var target = document.getElementById('buy');
    if (!target) return;
    var fired = false;
    function fire() { if (fired) return; fired = true; reach('view_buy', { price: 499, currency: 'RUB' }); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { fire(); io.disconnect(); } });
      }, { threshold: 0.4 });
      io.observe(target);
    } else { fire(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindViewBuy); else bindViewBuy();
})(window);
