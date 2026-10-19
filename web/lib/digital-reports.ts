export type DigitalReport = {
  slug: string;
  label: string;
  title: string;
  description: string;
  source: string;
  metrics: string[];
  decisions: string[];
};

export const DIGITAL_REPORTS: DigitalReport[] = [
  {
    slug: "funnel",
    label: "Воронка",
    title: "Воронка сайту",
    description: "Від першого візиту до оформленого замовлення: де саме ми втрачаємо клієнта.",
    source: "GA4 + дані замовлень",
    metrics: ["Сесії", "Перегляд меню / товару", "Додавання в кошик", "Початок оформлення", "Замовлення", "Конверсія між кроками"],
    decisions: ["Де найбільший відтік", "Який етап потребує UX-покращення", "Як зміни сайту впливають на конверсію"]
  },
  {
    slug: "channels",
    label: "Канали",
    title: "Канали залучення",
    description: "Які джерела приводять не просто трафік, а замовлення та виручку.",
    source: "GA4 + дані замовлень",
    metrics: ["Сесії", "Користувачі", "Замовлення", "Конверсія", "Виручка", "Середній чек", "Частка каналу"],
    decisions: ["Які канали ростуть", "Де найкраща конверсія", "Які джерела дають найбільше виручки"]
  },
  {
    slug: "seo",
    label: "SEO",
    title: "Органічний пошук",
    description: "Видимість М’ЯСТОРІЇ у Google та сторінки, що приводять органічний попит.",
    source: "Google Search Console + GA4",
    metrics: ["Покази", "Кліки", "CTR", "Середня позиція", "SEO-сесії", "SEO-замовлення", "SEO-виручка"],
    decisions: ["Які запити ростуть / падають", "Де високі покази, але низький CTR", "Які сторінки треба посилювати"]
  },
  {
    slug: "ads",
    label: "Реклама",
    title: "Платна реклама",
    description: "Економіка рекламних кампаній — від витрат до реальних замовлень і виручки.",
    source: "Google Ads + GA4 + дані замовлень",
    metrics: ["Витрати", "Кліки", "CPC", "Замовлення", "CPA", "Виручка", "ROAS"],
    decisions: ["Куди переносити бюджет", "Які кампанії окупаються", "Де CPA виходить за ціль"]
  },
  {
    slug: "site",
    label: "Сайт / UX",
    title: "Сайт та поведінка",
    description: "Що люди роблять на сайті та які сторінки реально допомагають продавати.",
    source: "GA4",
    metrics: ["Landing pages", "Залучені сесії", "Engagement rate", "Події", "Конверсія сторінки", "Пристрої"],
    decisions: ["Які landing pages продають", "Де слабка мобільна конверсія", "Які сторінки мають трафік без результату"]
  },
  {
    slug: "local",
    label: "Google / Maps",
    title: "Локальний попит",
    description: "Як люди знаходять наші заклади у Google Search і Maps: покази, дзвінки, маршрути, сайт і меню.",
    source: "Google Business Profile",
    metrics: ["Покази", "Дзвінки", "Маршрути", "Переходи на сайт", "Menu clicks", "Точки"],
    decisions: ["Які точки мають найбільший локальний попит", "Де профіль Google працює слабко", "Де є потенціал для local SEO та реклами"]
  },
  {
    slug: "app",
    label: "App",
    title: "Мобільний застосунок",
    description: "Повний шлях мобільного клієнта: store → install → registration → order → repeat → LTV.",
    source: "App Store + Google Play + Firebase + Orders + Attribution",
    metrics: ["Downloads", "First opens", "Registrations", "First buyers", "Orders", "Revenue", "CAC", "LTV", "Crash-free users"],
    decisions: ["Скільки коштує app-клієнт", "Де втрачаємо користувача", "Які кампанії дають покупців", "Чи окупається залучення"]
  },
  {
    slug: "audience",
    label: "Аудиторія",
    title: "Клієнти та аудиторія",
    description: "Нові та повторні користувачі, географія, пристрої та поведінкові сегменти.",
    source: "GA4 + CRM / дані замовлень",
    metrics: ["Нові користувачі", "Повторні користувачі", "Частота", "Замовлення", "Виручка", "Пристрій", "Географія"],
    decisions: ["Чи росте повторна база", "Хто має вищу цінність", "Де є потенціал для CRM та ретеншну"]
  },
  {
    slug: "tracking",
    label: "Якість аналітики",
    title: "Якість аналітики",
    description: "Контроль того, чи правильно працюють ключові події, теги та джерела даних.",
    source: "GTM + GA4 + технічні перевірки",
    metrics: ["purchase", "add_to_cart", "begin_checkout", "view_item", "Google Ads conversion", "Статус джерел"],
    decisions: ["Чи можна довіряти цифрам", "Які події перестали надходити", "Що треба виправити до аналізу маркетингу"]
  }
];

export const DIGITAL_MAIN_KPIS = [
  { label: "Сесії", hint: "усі візити на сайт", source: "GA4" },
  { label: "Замовлення", hint: "оформлені замовлення з сайту", source: "Замовлення" },
  { label: "Конверсія сайту", hint: "замовлення / сесії", source: "GA4 + замовлення" },
  { label: "Виручка сайту", hint: "реальна виручка замовлень", source: "Замовлення" },
  { label: "Середній чек", hint: "виручка / замовлення", source: "Замовлення" },
  { label: "Рекламні витрати", hint: "витрати платних кампаній", source: "Google Ads" },
  { label: "CPA", hint: "вартість одного замовлення", source: "Ads + замовлення" },
  { label: "ROAS", hint: "виручка / рекламні витрати", source: "Ads + замовлення" }
] as const;
