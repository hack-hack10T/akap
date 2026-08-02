/**
 * Яндекс.Метрика — A CUP / акап.рф
 * Счётчик: 111214147 (единый на весь сайт + гайд)
 */
(function () {
  var id = 111214147;
  (function (m, e, t, r, i, k, a) {
    m[i] =
      m[i] ||
      function () {
        (m[i].a = m[i].a || []).push(arguments);
      };
    m[i].l = 1 * new Date();
    for (var j = 0; j < document.scripts.length; j++) {
      if (document.scripts[j].src === r) return;
    }
    (k = e.createElement(t)), (a = e.getElementsByTagName(t)[0]);
    k.async = 1;
    k.src = r;
    a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=' + id, 'ym');

  window.ym(id, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
    ecommerce: 'dataLayer',
  });

  window.ACUPMetrika = {
    id: id,
    reach: function (goal, params) {
      try {
        if (typeof window.ym === 'function') window.ym(id, 'reachGoal', goal, params || {});
      } catch (_) {}
    },
  };
})();
