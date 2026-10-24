# Покриття: 30 + 30 днів та 12 місяців

Статус **PARTIAL: bounded stored checks reported by Barbara; upstream/RPC/UI UNKNOWN**. Дата аудиту 2026-10-24.
Календар UTC зафіксовано для відтворення; business/account timezone ще UNKNOWN.

| Вікно | Від | До включно | Очікувані календарні дати |
|---|---|---|---:|
| Останні 30 завершених | 2026-09-24 | 2026-10-23 | 30 |
| Попередні 30 | 2026-08-25 | 2026-09-23 | 30 |
| Останні 12 місяців | 2025-10-24 | 2026-10-23 | 365 |

[coverage.csv](coverage.csv) містить кожне джерело × кожне вікно. Неперевірені cells мають UNKNOWN. Current30 GA4/GSC/Meta stored counts
і GA4/GSC key-metric null checks заповнені лише за незалежним Barbara evidence.
[read-only-qa.sql](read-only-qa.sql) готує 35 relation diagnostics для цих вікон
і кожного місяця перетину. Rolling 12 months перетинає 13 календарних місяців:
жовтень 2025 та жовтень 2026 є частковими. Runner production SQL **НЕ ВИКОНУВАВ**; незалежні Barbara SELECT observations наведено нижче. Ці підготовлені SQL diagnostics виконано й перевірено лише
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
| Meta | raw/curated 145; 26 dates 2026-09-25…10-24 | 24 жовтня — незавершений день аудиту, виключений. Не більше 25/30 completed dates; inactive campaign dates потребують upstream пояснення, не zero-fill |
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
як ці датовані періоди. Unverified upstream/RPC/UI results у coverage.csv залишаються UNKNOWN; bounded stored results наведено окремо.

## Independent reviewer evidence — reported 2026-10-24

Observer **Barbara**, SELECT-only production results relayed verbatim as aggregate
facts in the trusted issue trigger; **not runner SQL**. Exact execution timestamp,
full query/field receipts and business/account timezone remain unavailable.
[Redacted record](REVIEWER-EVIDENCE.md), [machine receipt](barbara-production-evidence.json).

| current30 2026-09-24…2026-10-23 | Rows | Dates | Key metric null rows | Stored spend |
|---|---:|---:|---:|---|
| GA4 `digital_ga4_daily` (`date_id`) | 30 | 30 | 0 | UNKNOWN / not supplied |
| GSC `digital_search_daily` (`date_id`) | 28 | 28, through 2026-10-21 | 0 | UNKNOWN / not supplied |
| Meta `staging_meta_ads_windsor` | 138 | 25 | UNKNOWN | 1311.75; currency UNKNOWN |
| Meta `staging_meta_ads_daily` | 138 | 25 | UNKNOWN | 1311.75; currency UNKNOWN |

Meta 145 rows/26 dates is the **different Gate D rolling scope**
2026-09-25…2026-10-24, including the unfinished audit day. It is neither a
contradiction nor proof of the current30 counts. Equal raw/curated counts and spend
prove only those stored aggregates, not field/key correctness or upstream parity.
No gaps are silently zero-filled. Prior30 and 12-month actual results remain
UNKNOWN for every source. GA4/GSC null key metric rows 0 does not establish every
field complete, duplicate keys absent, or attribution/currency correctness.

Google Ads `staging_google_ads_windsor` has account_id/campaign_id/date, but no
currency/account_currency/currency_code (Barbara schema observation). App source
money and exchange conversion remain UNKNOWN; no conversion is invented. The
repository App RPC discards stable identity/currency; proposal stays NOT APPLIED.
Upstream → warehouse → RPC → rendered UI parity remains UNKNOWN for all sources.
