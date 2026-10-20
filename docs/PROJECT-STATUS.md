# М'ясторія BI — стан проєкту та задачі команди

Оновлено: **20.10.2026**. Статус за результатами поточної роботи.

Цей документ розрізняє локальну реалізацію, перевірки та роботу в production.
Позначка «зроблено» не означає, що зміна вже опублікована.
Паша — запропонований відповідальний за технічну частину, Соня/агенція —
за маркетинг. Їхні фактичні повноваження та доступи потрібно підтвердити.
Строки виконання командою ще не погоджені.

### Stabilization pass — 20.10.2026

- Додано єдині команди `npm test` і `npm run check` у корені.
- Використовується npm; pnpm lock прибрано, package-lock звірено, чистий npm ci пройшов.
- Live-перевірка оновлених локальних Overview/Ads/SEO пройшла: HTTP 200, без runtime errors; 390 px без горизонтального overflow. Секрет лише в Git-ignored .env.local.
- Foundation-коміт фіксує перевірений локальний фундамент і frontend. Push/deploy не виконано.
- Council, quality gate і cockpit — наступний локальний етап, не реліз Digital 3.0.

## 1. Що зроблено

| Напрям | Зроблено | Перевірка / межі |
|---|---|---|
| Аудит | Переглянуто Digital-екрани, код і доступні джерела; визначено проблеми дат, пропусків та атрибуції | Аудит production — 19.10.2026; не є постійним моніторингом |
| Збір даних | Отримано локальні Google Ads campaign daily, окремі conversion actions і metadata | Не завантажено як нові факти у production; не звірено з backend purchases |
| Збір даних | Отримано локальні Merchant catalog/performance/health, Facebook daily/posts, відповідь PageSpeed | Контракти й повнота ще потребують перевірки; fetch time не є measurement time |
| Агенти | Створено 5 SKILL.md: executive, sales-retail, digital-ads, seo-content, bi-uxui | Файли в `.agents/skills/` |
| Оркестратор | Послідовний CLI, маршрути повідомлень, JSON-шина, перевірка evidence IDs, блокування одночасних запусків | `.agents/run.mjs`, `.agents/orchestrator.json`, `.agents/CONTRACT.md` |
| Тест агентів | Replay усіх 5 етапів пройшов; один погоджений live executive-тест завершено | Live має status=partial: чотири спеціалісти не запускалися в цьому циклі |
| Захист артефактів | Runtime-шина, вхідні пакети та приватні звіти виключені з Git | Не публікувати сирі експорти, credentials чи персональні дані |
| Ads UI | CPA/CPC/CTR/ROAS з невизначеним знаменником або відсутніми вхідними значеннями показують «—» | Справжній нуль збережено; це не глобальне виправлення всіх метрик борду |
| Ads UI | Прибрано оцінки «сильна/стабільна» кампанія за самим ROAS | Без маржі прибутковість не доведена |
| SEO UI | Додано запит відомого доступного знімка не пізніше cutoff звіту | Дати й обмеженість вибірки показуються явно; це frontend-обхід точного фільтра дати в legacy RPC |
| Огляд BI | Додано окремі дати GA4, каналів, пристроїв і GSC | Показ дат не усуває відставання імпорту |
| Збірка | Digital переведено на рендеринг під час запиту; серверний кеш збережено | Збірка не потребує пароля до Digital RPC |
| Перевірки | 3 тести оркестратора, 2 тести метрик/дат, TypeScript і Next.js production build пройшли | Overview/Ads/SEO перевірено локально з живими джерелами |

## 2. Що ще НЕ зроблено

- [ ] Опублікувати локальні зміни: Foundation commit локально є; push / deployment не виконано.
- [x] Перевірити оновлені Ads, SEO й overview локально з реальними даними. Після майбутнього deployment потрібен окремий smoke test.
- [ ] Запустити повний live-цикл усіх п'яти агентів з актуальними доказами.
- [ ] Налаштувати щоденний scheduler і автоматичне формування вхідного пакета.
- [ ] Завершити збір GA4/GSC daily slices: попередній агент зупинився через квоту; завершення не підтверджено.
- [ ] Підключити правильний Meta Ads account та Instagram.
- [ ] Узгодити й підключити SYRVE/backend orders, order_events, refunds та line items.
- [ ] Реалізувати consent-aware pseudonymous identity і backend order attribution.
- [ ] Звірити повну виручку, маркетингові витрати й складові contribution margin.
- [ ] Перенести нові факти у warehouse з контролем grain, currency, duplicates і completeness.
- [ ] Виправити source measurement timestamps та окремо зберігати processing timestamps.
- [ ] Усунути залишкове null→0 в інших метриках та некоректне сумування daily active users як унікальних користувачів періоду.
- [ ] Повністю реалізувати snapshot metadata і вибір знімків у warehouse/RPC.
- [ ] Закрити питання доступу до фінансових даних, виявлені аудитом; деталі зберігати у приватному аудиті.
- [ ] Впровадити й виміряти бізнес-експерименти. Приріст продажів і грошовий ефект поки не доведені.

## 3. Паша — сайт, застосунок, tracking

Статус усіх задач нижче: **очікуємо дані / підтвердження відповідального**.

| ID | Задача та джерело | Що передати | Для чого |
|---|---|---|---|
| P-01 | Digital orders із backend сайту/застосунку | Order ID, зовнішній ID SYRVE, created/paid/cancelled/refunded times, status, сума, знижка, доставка, валюта, web/ios/android/unknown | Звірка реальних покупок |
| P-02 | Склад кошика | Order ID, SKU/product ID, кількість, ціна, знижка, повернена кількість | AOV, cross-sell, refunds |
| P-03 | Схема інтеграції із SYRVE | Спільний ключ; правила повторних відправлень, помилок і змін статусів | Усунення дублів і пропусків |
| P-04 | GA4/GTM/Firebase/server tracking | Перелік подій і параметрів view_item, add_to_cart, begin_checkout, purchase, refund; transaction_id/value/currency; правила dedup | Воронка та коректність conversions |
| P-05 | Джерело замовлення | Які UTM, referrer, click IDs зберігаються; дозволений deterministic link із замовленням | Backend attribution |
| P-06 | Історія клієнтів | Стабільний server-side pseudonymous ID, registration time, consent/source, дозволений зв'язок із замовленнями | Повторні покупки й churn |
| P-07 | Технічна карта | Репозиторії/hosting сайту й застосунку, відповідальний за deploy, джерела checkout errors і performance | Реалізація UX-виправлень |

Результат: схема полів, знеособлений тестовий експорт за спільні 30 завершених
днів, перелік відсутніх даних і спосіб регулярного отримання.

## 4. Соня / агенція — реклама, аналітика, SEO, соцмережі

Статус: **частина джерел уже читається; перелік акаунтів і семантика потребують звірки**.

| ID | Задача та джерело | Що передати / зробити |
|---|---|---|
| A-01 | Реєстр Google Ads / Meta Ads | Правильні account IDs, власник доступу, currency/timezone; підтвердити й підключити Meta М'ясторії |
| A-02 | Campaign daily | Date/source/account/campaign ID/currency, spend/impressions/clicks; Web/App/Local окремо; campaign name — атрибут |
| A-03 | Conversion actions | Action ID, primary/secondary, мета, value definition, attribution model/window; окремі факти без повторення spend |
| A-04 | CAPI разом із Пашею | Перевірка browser/server event_id dedup, event_time, consent, purchase coverage й помилок; агенція перевіряє кабінет, Паша — реалізацію |
| A-05 | Google Ads Search Terms | Query, date, campaign ID, spend, clicks, conversions/value з визначенням метрик; не підміняти query назвою кампанії |
| A-06 | GA4 / GSC | Property/site ID, доступи й daily channel/device/landing/query/page; row limit, completeness, omissions; totals окремо |
| A-07 | Merchant | Основний account, product/feed IDs, country/language, ads/free context, помилки фіда; визначити власника виправлень цін/залишків |
| A-08 | Instagram / Facebook | Правильні акаунти, OAuth; daily metrics і post metrics з observation timestamp та published_at |
| A-09 | Маркетингові витрати | Ad spend, винагорода агенції, production, інфлюенсери та інші витрати окремо за період; звірити з фінансами |

Результат: підтверджений реєстр акаунтів, доступи через запрошення/OAuth,
опис конверсій і tracking-проблем. Уже отримані Google Ads дані спочатку
звірити, не замовляти повторний збір без потреби.

## 5. SYRVE / Кнайпа — продажі та операції

Статус: **за словами користувача, звернення до Кнайпи вже надіслано; доступ
і повнота вивантаження ще не підтверджені**.

Першочергово перевірити: API віддає всі замовлення чи тільки закриті /
проведені через касу? Назва системи сама по собі цього не доводить.

| ID | Задача | Що запросити |
|---|---|---|
| S-01 | Охоплення | Заклади, типи замовлень, статуси; роздріб, доставка, самовивіз, web/app, КЦ, агрегатори |
| S-02 | Order / receipt mapping | Business order ID, external ID, receipt ID; кілька чеків/оплат на одне замовлення |
| S-03 | Order events | Історія статусів із часом, скасування, часткові/повні refunds, суми й причини |
| S-04 | Фінансові поля | Суми до/після знижок, повернення, податки, доставка, currency; семантика кожного поля |
| S-05 | Line items | SKU, category, кількість, ціна, знижка, модифікатори й комплекти |
| S-06 | Собівартість | Cost за товаром/датою, метод розрахунку; якщо API не містить — окремий експорт |
| S-07 | Джерело оформлення | Поле й довідник web/app/КЦ/каса/агрегатор; unknown залишати unknown |
| S-08 | Доставка | Прийняття/готовність/відправлення/вручення, promised time, район/зона, виконавець |
| S-09 | Запаси | SKU/заклад/date, залишки, надходження, списання, строк придатності за наявності |
| S-10 | Регулярний обмін | API docs, read-only доступ, historical depth, pagination, rate limits, updated_at/webhooks або інший механізм отримання змін старих orders |

Результат: документація, експорт за ті самі 30 днів, що й у Паші,
контрольний підсумок SYRVE та пояснення всіх виключених записів.

## 6. Інші дані та відповідальні

| ID | Відповідальний | Що потрібно | Навіщо |
|---|---|---|---|
| O-01 | Фінанси | Визначення net revenue; COGS, пакування, еквайринг, комісії агрегаторів, змінна доставка, marketing costs | Contribution margin, MER |
| O-02 | Контакт-центр | Система обліку, order IDs, зв'язок із SYRVE, канал звернення, результат і причина відмови | Виміряти КЦ без припущень |
| O-03 | Операції / логістика | Зони, promised SLA, потужність кухонь/кур'єрів, причини затримок | p50/p90 доставки й обмеження масштабування |
| O-04 | Категорійний менеджер / склад | Єдиний SKU dictionary, категорії, комплекти, запаси, промокалендар | Допродажі, оборотність і доступність товарів |
| O-05 | Власник застосунку, якщо не Паша | App Store Connect, Google Play Console, Firebase; installs, versions, crashes/ANR | Якість застосунку окремо від acquisition |

## 7. Порядок роботи й критерії приймання

1. **P-01–P-03 + S-01–S-05:** спільні замовлення, статуси, повернення, товари.
2. **A-01–A-04 + P-04–P-05:** правильні акаунти, conversion definitions і dedup.
3. **O-01 + S-06 + A-09:** економіка замовлення й повні marketing costs.
4. **КЦ, логістика, склад та app quality:** операційна деталізація.

Кожен відповідальний повертає:
- що доступно й у якій системі;
- за який період та для яких закладів/каналів;
- що відсутнє або неповне;
- спосіб передачі й регулярного оновлення;
- відповідального та погоджену дату готовності.

Пілот — однакові **30 завершених днів**. Після звірки — щонайменше
12 місяців історії, бажано 24, якщо джерело підтримує.
Фіксувати timezone, валюту, одиниці метрик, filters, extracted_at,
source timestamps, row limits і completeness. Наявність файлу не дорівнює
завершеній інтеграції: потрібні перевірка ключів, дублів, повноти та звірка totals.

## 8. Незмінні правила даних

- Total sales − digital sales = **незвірена виручка**, а не доведені продажі КЦ.
- Order channel, platform, marketing source і fulfillment — різні виміри.
- Platform-attributed conversions не є backend orders.
- Unknown ≠ zero. Processing time ≠ source observation time.
- Reach не сумувати як унікальних людей; followers — stock, follows/unfollows — flows.
- Web field/lab performance розділяти; web CWV не переносити на native app.
- Attribution credits ≤1 на order у межах model_version; unknown bucket явний.
- Customer identity — versioned pseudonymous keys із consent/source і merge lineage.
- Raw email/phone, адреси, паролі й API-ключі не передавати LLM та не комітити.
- Доступи — через запрошення/OAuth або захищене сховище секретів.

## 9. Подальші бізнес-експерименти

| Гіпотеза | Що має бути готово | Критерій |
|---|---|---|
| Стейк + соус/напій | Line items, costs, stock | Додаткова contribution margin/order без неприйнятного падіння conversion |
| Покращення mobile checkout | Датовані performance виміри, device funnel, звірені покупки | Purchase/session; guardrails errors, refunds, margin |
| Оптимізація рекламного бюджету | Purchase dedup, backend reconciliation, маржа й залишки | Інкрементальна маржа в обмеженому експерименті |

Ці експерименти **не запущені**, ефект у гривнях **не визначений**.

## 10. Де шукати реалізацію

- Агенти й запуск: [`.agents/README.md`](../.agents/README.md).
- Спільний контракт: [`.agents/CONTRACT.md`](../.agents/CONTRACT.md).
- Ads normalization: [`digital-sources.ts`](../web/lib/data/digital-sources.ts).
- SEO snapshots: [`digital.ts`](../web/lib/data/digital.ts).
- Правила missing/ratio/date: [`digital-quality.ts`](../web/lib/digital-quality.ts).
- Тести: [`digital-quality.test.mjs`](../web/tests/digital-quality.test.mjs).
- Runtime-звіти — локально в `.agents/runtime/`, виключені з Git.
- Детальний аудит і сирі результати збору зберігаються поза публічним репозиторієм.
