# Покриття: 30 + 30 днів та 12 місяців

Статус **PARTIAL independent production warehouse evidence; source parity UNKNOWN; browser BLOCKED**. Дата аудиту 2026-10-24.
Календар UTC зафіксовано для відтворення; business/account timezone ще UNKNOWN.

| Вікно | Від | До включно | Очікувані календарні дати |
|---|---|---|---:|
| Останні 30 завершених | 2026-09-24 | 2026-10-23 | 30 |
| Попередні 30 | 2026-08-25 | 2026-09-23 | 30 |
| Останні 12 місяців | 2025-10-24 | 2026-10-23 | 365 |

[coverage.csv](coverage.csv) містить кожне джерело × кожне вікно. Barbara independent
production SELECT-only evidence, переданий latest PR #44 re-review trigger:
**Meta current30 2026-09-24…2026-10-23 = 138 rows / 25 observed dates із 30**.
Receipt: [barbara-production-evidence.json](barbara-production-evidence.json), B01.
Це не Astra runner SQL. Relation-specific counts/metric totals/raw-curated parity
не передані; вони UNKNOWN. Інші неперевірені observed dates, row counts,
upstream/warehouse/RPC/UI totals лишаються UNKNOWN; prior30 і rolling12 не доведені.

**Google Ads App currency gap (B02):** Barbara довела, що
`staging_google_ads_windsor` не має currency column, deployed
`bi_digital_app_payload` не expose currency. App Ads money **UNKNOWN**;
не виводити UAH/USD та не робити conversion. Це deployed contract evidence,
а не доказ account/currency completeness upstream.
[read-only-qa.sql](read-only-qa.sql) готує 35 relation diagnostics для цих вікон
і кожного місяця перетину. Rolling 12 months перетинає 13 календарних місяців:
жовтень 2025 та жовтень 2026 є частковими. Production SELECT-only checks **Barbara існують** (receipt вище). Саме Astra runner
не виконував production SQL; повне виконання generated scripts Barbara не підтверджено.
Ці generated SQL diagnostics виконано й перевірено локально лише
на disposable PostgreSQL fixtures, див. [sql-validation.json](sql-validation.json).
Фіксовані dated scans bounded до 12 місяців, null-date probe capped at 1,001 matches;
це не повний all-history count. Account/business timezone досі UNKNOWN.

Наведені нижче числа — **baseline з issue #43**, не новий запит до Supabase.
Вони не доводять field completeness, attribution, account scope або upstream parity.

| Джерело | Повідомлений baseline | Наслідок для фіксованого вікна, за умови актуальності baseline |
|---|---|---|
| Sales | 46,159 rows, 2024-01-01…2026-10-22, 1,026 distinct dates | 2026-10-23 відсутня; максимум 29/30 дат. Увесь заявлений історичний span має 1,026 календарних дат, але store/channel coverage невідоме |
| GA4 | 661 rows, 2025-01-01…2026-10-23 | Діапазон потенційно охоплює всі три вікна; кількість рядків не замінює перевірки ключів/полів |
| GSC | 478 rows, 2025-07-01…2026-10-21 | Щонайменше 22–23 жовтня не покриті; максимум 28/30 дат |
| Google Ads | daily 12, 2026-10-12…23; campaign snapshots 78; raw 145 | До 12/30 дат; previous30 не має daily coverage. 78 snapshots ≠ 145 campaign-days ≠ 12 daily totals |
| GBP | 48 rows / 12 dates; raw 48 | 12 дат не доводять 30 днів × 4 профілі; latest date у baseline не задана |
| Meta Gate D rolling baseline | raw/curated each 145 rows; 26 dates **2026-09-25…10-24** | Окреме rolling вікно включає 24 жовтня. Barbara bounded audit evidence **2026-09-24…10-23 = 138 rows / 25 dates**; inactive campaign dates потребують upstream пояснення, не zero-fill |
| Facebook | daily 90 через 2026-10-18, posts 26 | 19–23 жовтня відсутні: максимум 25/30 дат. Post lifetime totals не є daily history |
| App | 6 datasets empty | EMPTY згідно baseline; відсутній вимір, а не нуль downloads/orders/CAC |
| Merchant | 3 datasets empty | EMPTY згідно baseline; catalog stock не потребує daily рядка на кожну дату |
| Instagram | 2 datasets empty | EMPTY згідно baseline; потрібні account/access/observation contracts |
| Landing/query/page | daily empty, snapshots populated | Немає підтвердженої daily історії; 30-day snapshots не можна розкласти в 30 daily rows |
| PageSpeed | successful destination reported; count/time UNKNOWN | processing success ≠ новий measurement; coverage по датах непридатне без URL/strategy/captured_at |
| P&L | local metadata: 8 months Jan–Aug, loaded 2026-10-14 | Статичний workbook не покриває 30-day daily audit та rolling12; warehouse parity UNKNOWN |

Для кожного джерела потрібні: completed export marker, однакові timezone/filters,
account/property/site, currency, attribution model/window та excluded statuses.
Перевірити total **і** null-count по кожному полю, duplicate/unknown keys,
late updates/refunds і source event time окремо від imported_at.
Query/page top-N та anonymized GSC omissions можуть законно відрізнятися від site totals.
GA4 active users, social reach/followers, position, scores та catalog stock неадитивні.
Календарні gaps для snapshots/post cohorts — діагностика, не автоматичний FAIL.

SQL повертає лише агрегати, не customer/order keys. Generic sums є діагностичними:
metrics згруповано за наявними account/currency; відсутні dimensions лишаються UNKNOWN; не трактувати sums stocks,
reach, position або performance scores як KPI; їх complete_stored_total лишається null. SELECT не виконує RPC чи refresh.
Якщо relation/колонка недоступна, `ON_ERROR_STOP` припиняє перевірку; змінювати RLS,
надавати grants або викликати service-only mutation для обходу заборонено.


Revision: `read-only-qa.sql` також містить field-level stored joins Google Ads,
GA4, GSC, GBP і Meta. Zero mismatches та однаковий count **не** доводять upstream
export completeness, null-free ingestion, правильні accounts/currencies чи пропущені
однаково в обох шарах записи. `rpc-read-only-qa.sql` перевіряє explicit current30,
prior30 і rolling12 GA4 stored totals проти date-filtered analytics RPC; без existing
session auth повертає BLOCKED. Вікна Ads/App/GBP без date parameters не звіряються
як ці датовані періоди. У coverage.csv внесено лише явно переданий Meta bounded result із Barbara provenance;
решта live results UNKNOWN. Повні independent SELECT receipts недоступні у цьому
runner (GH_TOKEN absent; GitHub API DNS failure), додаткові цифри не вигадано.
