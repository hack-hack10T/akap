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
    // Публичный API (cloudflared / worker). Обновлять при смене туннеля.
    apiBase: 'https://pour-oxygen-presently-watched.trycloudflare.com',
  },

  // ЮMoney QuickPay — кошелёк самозанятого (идентифицированный)
  // Настройка уведомлений: ЮMoney → настройки → HTTP-уведомления
  // URL: {apiBase}/api/guide/notify
  yoomoney: {
    enabled: true,
    // Номер кошелька ЮMoney (из кабинета / как в Поздравке)
    receiver: '4100119499142622',
    // AC = банковская карта, PC = кошелёк, SB = СБП
    defaultPaymentType: 'AC',
    // quickpay-form: shop | button | small
    form: 'shop',
  },

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
