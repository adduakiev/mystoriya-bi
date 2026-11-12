# Покриття: 30 + 30 днів та 12 місяців

Latest bounded follow-up (2026-10-25, review 6399469440): **separate shifted UTC
2026-09-25..2026-10-24** window: GA4 **30/30 observed/expected dates**, GSC
**28/30** through 10-22, Google Ads curated **13/30** since 10-12. Ads observed
onboarding interval 10-12..24 is **13/13 dates**; raw **157 rows**, curated **13**.
Reported stored date join: zero missing groups, zero five-metric daily mismatch
groups, zero duplicate raw date/account/campaign groups. This does not prove
source completeness, currency/account/action attribution or business timezone.
[Reproduction/report](GOOGLE-ADS-DAILY-RECONCILIATION-2026-10-25.md),
[new machine receipt](REVIEWER-RECEIPT-2026-10-25-6399469440.json) and
[separate shifted CSV](coverage-shifted-2026-10-25.csv). No warehouse/RPC execution.
Shifted prior30 and 12-month counts UNKNOWN. Original coverage.csv below is
historical and retains original bounds. Prior GSC **29 rows / 29 observed dates**
is **29/30 calendar coverage**, not complete 29/29. All 66 browser cases remain
NOT_EXECUTED; gate 6398044302 is open. The following receipts are historical.

Historical dated receipt (2026-10-25, review 6397712491): fixed UTC
2026-09-24..2026-10-23 GA4 **30 rows / 30 dates**, GSC **29 rows / 29 dates**;
Google Ads staging **zero currency columns**. See
[latest reviewer receipt](GOOGLE-ADS-ROAS-REVISION-40193841845.md#independent-read-only-reviewer-receipt--2026-10-25)
and [machine receipt](REVIEWER-RECEIPT-2026-10-25-6397712491.json).
The prior GSC **28/28** and 363/365 below are **earlier dated historical evidence**,
retained unchanged; the new count supersedes current30 only. No newly supplied
null/duplicate/latest-event/prior30/12-month or upstream/RPC/UI proof. Coverage CSV
current30 uses latest counts; earlier null checks are not relabelled as current.
Browser 66 cases remain NOT_EXECUTED; no authorized session or bypass.

The following sections describe the earlier receipts and their original scope.

Статус **PARTIAL: bounded stored checks reported by Barbara; upstream/RPC/UI UNKNOWN**. Дата аудиту 2026-10-24.
Календар UTC зафіксовано для відтворення; business/account timezone ще UNKNOWN.

| Вікно | Від | До включно | Очікувані календарні дати |
|---|---|---|---:|
| Останні 30 завершених | 2026-09-24 | 2026-10-23 | 30 |
| Попередні 30 | 2026-08-25 | 2026-09-23 | 30 |
| Останні 12 місяців | 2025-10-24 | 2026-10-23 | 365 |

[coverage.csv](coverage.csv) містить кожне джерело × кожне вікно. Неперевірені cells мають UNKNOWN. GA4/GSC current30/prior30/365 date coverage, explicit current30/prior30/365 stored counts,
Meta bounded key/metric reconciliation і GA4/GSC core-metric null checks заповнені лише за незалежним Barbara evidence.
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

## Independent reviewer evidence — verified 2026-10-25

Barbara SELECT-only aggregate results were supplied in the latest trusted trigger;
**not runner SQL**. [Redacted receipt](REVIEWER-EVIDENCE.md) and
[machine receipt](barbara-production-evidence.json) cite the new and earlier reviews.
Exact execution timestamp, full SQL and business/account timezone remain UNKNOWN.

| Source | current30 rows / dates (expected 30) | prior30 rows / dates (expected 30) | 365-day rows / dates (expected 365) | Null core metric rows |
|---|---:|---:|---:|---:|
| GA4 `digital_ga4_daily`, `date_id` | 30 / 30 | 30 / 30 | 365 / 365 | current30 0 newly verified; other windows earlier receipt |
| GSC `digital_search_daily`, `date_id` | 28 / 28 | 30 / 30 | 363 / 363 | current30 0 newly verified; other windows earlier receipt |

Earlier receipt reports GSC current30 through 2026-10-21 with October 22–23 absent; the new count verification does not separately attest latest date. Prior30/365 row counts are explicitly supplied by the 2026-10-25 verification.
Duplicate keys, individual field-null counts and all-field completeness remain UNKNOWN.
The fixed audit windows above are unchanged; verification date does not shift them. Other sources' prior30/365
actual coverage remains UNKNOWN. No gaps are silently zero-filled.

Meta completed current30 2026-09-24…2026-10-23 has **138 USD groups per side**,
25 observed dates and previously reported spend **1311.75 USD** per side.
The **earlier 2026-10-24 receipt's FULL OUTER JOIN** on account_id/campaign_id/date/account_currency found
**0 missing sides** and **0 mismatches** in multiplicity, spend, clicks and
impressions. This establishes only those bounded stored-key/metric comparisons;
absolute duplicate-key counts, all-field completeness and upstream/RPC/UI parity
remain UNKNOWN. Matching multiplicity is not proof of unique keys.

Meta **145 rows/26 dates** is the different Gate D rolling scope
2026-09-25…2026-10-24, including the unfinished audit day. Do not substitute it
for current30 or create duplicate Gate D/Windsor tasks.

Google Ads staging currency remains absent in the earlier Barbara observation;
App money/exchange conversion remain UNKNOWN. Meta USD must not populate App
currency. The App source-contract design stays NOT APPLIED. Upstream → warehouse
→ RPC → rendered UI reconciliation is still UNKNOWN for all sources.

Earlier independent bounded current30 receipt ([review comment](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6388338141)):
Sales **966 rows / 29 dates**, Google Ads daily **12 rows / 12 dates**, GBP
**48 rows / 12 dates**. These are restored earlier dated reviewer observations,
**not newly queried** on 2026-10-25. Exact query execution timestamp was not
supplied. Other-source prior30/365 counts remain UNKNOWN. No count proves source,
warehouse, RPC or rendered UI totals agree.
