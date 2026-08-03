// A CUP — resilient API base resolver (never stick to a dead tunnel)
(function (w) {
  'use strict';

  function uniq(list) {
    var out = [];
    var seen = Object.create(null);
    list.forEach(function (u) {
      u = String(u || '').replace(/\/$/, '').trim();
      if (!u || seen[u]) return;
      seen[u] = 1;
      out.push(u);
    });
    return out;
  }

  function candidatesFromConfig() {
    var CFG = w.ACUP || {};
    var G = CFG.guide || {};
    var list = [];
    if (Array.isArray(G.apiBases)) list = list.concat(G.apiBases);
    if (G.apiBase) list.push(G.apiBase);
    try {
      var cached = localStorage.getItem('acup_api_base');
      if (cached) list.unshift(cached);
    } catch (_) {}
    return uniq(list);
  }

  async function probe(base, ms) {
    ms = ms || 6000;
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, ms);
    try {
      var res = await fetch(base.replace(/\/$/, '') + '/api/guide/health', {
        cache: 'no-store',
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) return false;
      var j = await res.json().catch(function () { return {}; });
      return !!(j && j.ok);
    } catch (_) {
      clearTimeout(t);
      return false;
    }
  }

  async function loadPublishedBase() {
    // api-base.json on same origin (GitHub Pages) — updated by ensure-tunnel
    var urls = [
      '../api-base.json?t=' + Date.now(),
      '/api-base.json?t=' + Date.now(),
      'api-base.json?t=' + Date.now(),
    ];
    for (var i = 0; i < urls.length; i++) {
      try {
        var res = await fetch(urls[i], { cache: 'no-store' });
        if (!res.ok) continue;
        var j = await res.json();
        if (j && j.apiBase) return String(j.apiBase).replace(/\/$/, '');
      } catch (_) {}
    }
    return '';
  }

  /**
   * Resolve a living API base. Caches working URL in localStorage.
   * @returns {Promise<string>}
   */
  w.ACUPResolveApiBase = async function ACUPResolveApiBase() {
    var list = candidatesFromConfig();
    var published = await loadPublishedBase();
    if (published) list.unshift(published);
    list = uniq(list);

    for (var i = 0; i < list.length; i++) {
      var base = list[i];
      if (await probe(base)) {
        try { localStorage.setItem('acup_api_base', base); } catch (_) {}
        return base;
      }
    }
    // last resort: first configured (caller shows error if fetch fails)
    return list[0] || '';
  };

})(window);
