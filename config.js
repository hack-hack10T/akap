// ============================================================
// A CUP / акап.рф — настройки магазина цифрового гайда
// ============================================================
window.ACUP = {
  brand: 'A CUP',
  siteUrl: 'https://акап.рф',
  // HTTP пока GitHub Pages SSL для IDN не выпущен (https даёт ошибку сертификата)
  siteUrlAscii: 'http://xn--80aa3av.xn--p1ai',

  seller: {
    status: 'Самозанятый (НПД)',
    fullName: 'Дмитриев Михаил Александрович',
    inn: '772453231807',
    publicName: 'A CUP / АКАП',
    email: 'mikhsan@yandex.ru',
    telegram: 'https://t.me/Arcady_ya',
    telegramHandle: '@Arcady_ya',
    supportHours: 'ежедневно, 10:00–22:00 (МСК)',
  },

  guide: {
    title: 'От нуля до specialty',
    subtitle: 'Цифровой гайд A CUP',
    price: 299,
    priceOld: 999,
    currency: 'RUB',
    description: 'Цифровой гайд «От нуля до specialty» — доступ к HTML-материалу автора',
    // Публичный API (cloudflared → guide-api :8788). ensure-tunnel.sh держит URL живым и пушит сюда.
    apiBase: 'https://repair-meant-oldest-pos.trycloudflare.com',
    // Запасные базы (js/api.js пробует по порядку + api-base.json с сайта)
    apiBases: [
      'https://repair-meant-oldest-pos.trycloudflare.com',
    ],
    // Фиксированный токен доступа (не меняется). Промо «аркадий» → ACUP-PROMO-ARKADIY.
    fixedToken: 'ACUP-PERM-GUIDE-01',
  },

  // ЮKassa (самозанятый, ShopID 1298699) — карта / СБП / ЮMoney
  yookassa: {
    enabled: true,
    shopId: '1298699',
  },

  // Промокоды бесплатного доступа (дублируются на сервере GUIDE_PROMO_FREE)
  promoFree: ['аркадий', 'arkadiy'],

  yoomoneyLegal: {
    operator: 'ООО НКО «ЮМани»',
    inn: '7750005725',
    ogrn: '1127711000031',
    license: 'Лицензия Банка России № 3510-К',
    privacy: 'https://yoomoney.ru/page?id=527708',
    agreement: 'https://yoomoney.ru/page?id=525698',
    transfers: 'https://yoomoney.ru/page?id=522764',
    legalHub: 'https://yoomoney.ru/legal',
    help: 'https://yoomoney.ru/help',
    phone: '+7 495 197-86-86',
  },
};
