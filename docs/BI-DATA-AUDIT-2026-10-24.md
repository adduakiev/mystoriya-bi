# М'ЯСТОРІЯ BI — повний source/code inventory, аудит #43 від 24.10.2026

**Статус: BLOCKED для live data/browser acceptance; preview patch підготовлено.**
Цей звіт не підтверджує correctness production BI. Перевірено repository source
та локальні regression checks; upstream → warehouse → RPC → rendered UI parity
залишається **UNKNOWN**. Barbara виконала незалежні live SELECT-only warehouse checks; нижче вони явно
відокремлені від baseline issue та локальних перевірок Astra. Повна source parity не доведена.

## Revision PR #44 — Actions 40123774124

Поточний run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40123774124.
Існуючий PR: https://github.com/adduakiev/mystoriya-bi/pull/44; **не створювати новий PR**.
Вимоги review надано в trigger: повний remote comment недоступний без GH_TOKEN.
[Machine-readable provenance](audit/2026-10-24/revision-provenance.json) фіксує:

- Actual runner branch: `astra/issue-43-40123774124`, HEAD `4f0cfcec48408428d51ee916cb87a97a256e4807`.
- Required destination: **existing** `astra/issue-43-40107435112`, PR #44.
- Попередню реалізацію від `a261c82` завантажено з локального remote ref у writable
  working tree. `git switch` відхилено: `.git/index.lock: Read-only file system`.
  Branch **не переключено**. Trusted runner має застосувати revision до існуючої
  PR branch; у Codex commit/push/PR не виконуються.
- WORKING з новим run URL спробувано через `gh issue comment 43 --body …` перед
  revision edits; exit 4, GH_TOKEN unavailable. Remote WORKING **не опубліковано**.
  Local commentary не видається за GitHub acknowledgment.
- READY FOR REVIEW remote **не опубліковано**. Follow-up commit не створено
  відповідно до operating contract; це runner handoff, не запит user PR permissions.

| Latest Barbara re-review criterion | Результат revision / межі |
|---|---|
| 1. Live SELECT-only evidence | Незалежні production checks **Barbara**, не Astra runner. [Receipt](audit/2026-10-24/barbara-production-evidence.json): Meta current30 138 rows / 25 dates; provenance у coverage/register. Повний remote query output недоступний; інші totals UNKNOWN |
| 2. Production wording | Warehouse SELECT checks існують; **Astra runner** production SQL NOT EXECUTED. Fixture validation окрема; upstream/source parity UNKNOWN |
| 3. App currency gap | Barbara довела: `staging_google_ads_windsor` не має currency column, deployed `bi_digital_app_payload` не expose currency. App Ads money **UNKNOWN**, без UAH/USD або conversion |
| 4. Meta scope | Gate D rolling 2026-09-25…10-24: raw/curated each 145 rows / 26 dates. Бounded audit 2026-09-24…10-23: 138 rows / 25 dates. Це різні windows, не mismatch |
| 5. Browser | Preview build **READY** за Barbara; protected deployment fetch blocked current Vercel connector team/protection **403**. Browser **NOT_EXECUTED**, screenshots []; protection/credentials не змінено |
| 6. D04–D08 | [Machine-readable follow-up plan](audit/2026-10-24/follow-up-plan.json): proposed owners, gate classification, minimal acceptance criteria; усі OPEN, жодного DB/source change |
| 7. Checks/handoff | Поточні rerun результати нижче; commit/push/оновлення **same PR #44** — trusted runner. READY FOR REVIEW лише після pushed follow-up commit; тут не опубліковано |

## Незалежні production докази Barbara — current30

Джерело: latest PR #44 Barbara re-review, переданий у trusted issue trigger.
Це **Barbara independent SELECT-only production evidence**, не нове виконання SQL
Astra runner. Точний remote comment permalink, query text і повний aggregate output
не доступні: `gh` exit 4 (GH_TOKEN absent), public GitHub API — DNS failure.
[Receipt](audit/2026-10-24/barbara-production-evidence.json) зберігає лише явно
надані факти; не відтворює непередані результати.

- Вікно **2026-09-24…2026-10-23 inclusive**: Meta **138 rows / 25 observed dates**
  із 30 календарних. Relation-specific counts, duplicate/null/metric totals та
  raw→curated equality у переданому trigger не наведені: **UNKNOWN**.
- Окремий **Gate D rolling scope 2026-09-25…2026-10-24**: raw та curated each
  **145 rows / 26 dates** за baseline #43. Включає незавершену дату 24 жовтня.
  Не переносити 145/26 у bounded current30; previous30 і rolling12 не доведені.
- **Google Ads App currency-contract gap proven:** `staging_google_ads_windsor`
  не має currency column; deployed `bi_digital_app_payload` не expose currency.
  App Ads spend/CPA/conversion value money залишаються **UNKNOWN**. Немає доказу
  UAH, USD чи FX conversion. Preview withholding виправляє presentation, не source contract (D06/D14).
- Інші current30 counts, prior30/12-month coverage, upstream completeness,
  source→warehouse→RPC→rendered UI parity залишаються **UNKNOWN**. Successful
  warehouse SELECT не доводить upstream exports, attribution чи rendered values.

Додаткові preview fixes: збережено **всі** App campaign rows замість first-match
Android/iOS; Merchant catalog/health presence більше не вмикає performance zeros.
D14–D17 у discrepancy log. Known D04–D11 залишаються відкритими в зазначеному scope.

## Докази, доступ та protocol

- Попередня реалізація фіксує читання `AGENTS.md`, Data Quality / BI UX/UI skills
  та `.agents/CONTRACT.md`; ця revision повторно перевірила `AGENTS.md` і contract;
  враховано current-run/domain boundaries, security boundary, Vault design,
  Social v2, Meta Gate D activation і SQL history. Віддалені comments/reviews
  #6/#18/#27/#31/#32/#37 недоступні через GitHub CLI; closure review не заявляється.
- Попередній run 40107435112 також повідомляв WORKING publication failure:
  `gh issue comment 43 --body 'WORKING — Astra audit started. GitHub Actions run: …'`.
  Відповідь: `gh: To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN environment variable.`
  Exit 4; коментар **не опубліковано**, remote acknowledgment не підтверджено.
  Наявних GH_TOKEN/GITHUB_TOKEN немає; credentials не змінювалися.
- BI_ACCESS_PASSWORD та DATABASE_URL відсутні, MCP resources/templates порожні,
  Supabase/upstream/browser connectors не експоновані. Public API transport key
  не є дозволом обходити password/RLS; прямий доступ до protected data не робився.
- Історичний local preview attempt не стартував: `listen EPERM: operation not permitted
  127.0.0.1:3100`. Chromium наявний, Playwright/Puppeteer відсутні; authenticated
  desktop/mobile navigation і screenshots **не отримано**. Це відтворюваний blocker,
  а не твердження про runtime 404/500 або про UX-якість застосунку.
  Актуальний незалежний blocker Barbara: Preview build READY, protected fetch
  через current Vercel connector team/protection повертає 403. Browser PASS немає.
  Exact deployment URL не переданий; loopback URLs у cases — лише planned local targets.
- Runner-only PR permission failure не є user blocker: PR/push тут не робилися.
  Реальні незакриті acceptance gates — source access, live reconciliation та browser QA.

## Артефакти та відтворення

| Артефакт | Зміст і межі |
|---|---|
| [inventory.json](audit/2026-10-24/inventory.json) | 22 pages, 7 API routes; import component tree, RPC/SQL definitions, 742 unique visual/control templates; shared paths normalized |
| [tab-block-matrix.csv](audit/2026-10-24/tab-block-matrix.csv) | 1,382 route/block references: path/component/line/definition/evidence + route_contract link; grain/filters/timezone/freshness/status/source candidates inherit from inventory route |
| [metric-lineage.csv](audit/2026-10-24/metric-lineage.csv) | Broader source→warehouse→RPC formulas; concise actual JSON→adapter→JSX bindings in KPI-LINEAGE.md |
| [source-register.json](audit/2026-10-24/source-register.json) | Sources, IDs where known, baseline provenance, grain, ownership/access/schedule/expected volume; Barbara independent bounded warehouse evidence + scoped UNKNOWN measurements |
| [barbara-production-evidence.json](audit/2026-10-24/barbara-production-evidence.json) | Independent SELECT facts relayed by trigger; observer/window/scope/UNKNOWN boundaries |
| [follow-up-plan.json](audit/2026-10-24/follow-up-plan.json) | D04–D08 OPEN: proposed owner, gate classification, minimal acceptance criteria; no DB/source changes |
| [discrepancies.json](audit/2026-10-24/discrepancies.json) | D01–D17: severity, reproduction, expected/actual, patch status та residual risk |
| [COVERAGE.md](audit/2026-10-24/COVERAGE.md), [coverage.csv](audit/2026-10-24/coverage.csv) | Фіксовані current30/prior30/rolling12 windows, baseline implications та UNKNOWN reconciliation cells |
| [read-only-qa.sql](audit/2026-10-24/read-only-qa.sql) | 35 relation diagnostics; read-only transaction, monthly/date gaps, null counts, duplicate keys, Meta raw/curated mismatch, RLS flags; Astra runner production NOT EXECUTED; Barbara independent SELECT checks у separate receipt; fixtures не migration |
| [browser-qa.json](audit/2026-10-24/browser-qa.json) | Точні local URLs для кожного route, 360/768/1440px cases, blocker та NOT_EXECUTED outcomes; screenshots [] |

Inventory schema v2 зберігає shared component templates один раз із paths;
route_contract у CSV посилається на indexed route у JSON. Grain, filters, timezone,
freshness, status і candidate sources успадковуються від route. Повторення parent
text, headings, strong values, table cells та option labels не створюють окремих
visual blocks; їхні enclosing blocks/controls залишаються у matrix. Inventory генерується TypeScript AST зі всіх Next page/API files, transitive imports,
parent layouts/loading і component JSX. Включені forms, selects/options, links/buttons,
charts, tables/rows, KPI cards, banners/status та shared sidebar/sync/logout.
Repeated runtime rows/cards збережено як **templates**, з `repeat_template` та bindings;
їхню фактичну кількість без даних не вигадано. Conditional branches також включені.
Route RPC/table candidates **не є** доведеним per-field lineage: це явно позначено
`INHERIT_ROUTE_CANDIDATES_NOT_PROVEN_PER_METRIC`. Shared sidebar має додатковий status/fallback
RPC, описаний у metric lineage. Latest repository SQL definition не доводить deployed SQL.
LIVE не призначається за наявністю JSX, row count, label чи migration file.

```bash
node scripts/bi-audit-inventory.mjs
node scripts/bi-audit-inventory.mjs --check
node scripts/bi-audit-queries.mjs
node scripts/bi-audit-queries.mjs --check
node --experimental-strip-types web/tests/bi-audit.test.mjs
node --experimental-strip-types web/tests/bi-audit-postgres.test.mjs
```

Генератори не підключаються до мережі та не запускають SQL. PostgreSQL test
виконує діагностику й RPC лише на disposable synthetic fixtures.
[SQL receipt](audit/2026-10-24/sql-validation.json) описує обсяг.
[rpc-read-only-qa.sql](audit/2026-10-24/rpc-read-only-qa.sql) підготовлено для
existing authorized session; саме цей runner production SQL не виконував.
Незалежні production SELECT checks Barbara описані окремо; повний запуск цих
generated scripts не приписується Barbara без query receipts. Для продовження на вже
авторизованому read-only connection виконати SQL командою з його header; зберегти
aggregate output приватно, опублікувати лише редагований підсумок без secrets/PII.
Немає запиту додати credentials у Git або послабити RLS.

## Tab-by-tab review

Статуси нижче описують доказовість у цьому аудиті. PARTIAL — статичний lineage
є, live values/parity не перевірено. WAITING — baseline повідомляє порожні джерела.
Повний per-block перелік — у CSV; ця таблиця дає огляд кожного route.

| URL path | Блоки / керування | Source → RPC | Статус / головна межа |
|---|---|---|---|
| `/` | KPI, channel shares, multi-year, channel mix, growth decomposition, location contribution, filters/LFL | fact_sales_daily + dimensions → bi_overview_payload; snapshot/Sheets fallback | PARTIAL; null/zero, cutoff і LFL parity не звірено |
| `/aggregators` | Aggregator KPI/cards, dynamics, comparison/table, period/brand/LFL | fact_sales_daily → bi_aggregators_payload_v2 | PARTIAL; оборот/націнка не доводять commission-adjusted margin |
| `/delivery` | Delivery/pickup KPI, type mix, multi-year, aggregators comparison, location rows, filters | fact_sales_daily → bi_delivery_payload | PARTIAL; fulfillment/order origin/refunds не звірено |
| `/locations` | Network/LFL KPI, per-store rows/comparison, year/month/brand/ownership | fact_sales_daily + lifecycle → bi_locations_payload | PARTIAL; static fallback cohort відрізняється від registry contract |
| `/dynamics` | Period metric charts, year/month/week grouping, comparisons/filters | fact_sales_daily → bi_dynamics_payload | PARTIAL; denominator/coverage/cohort parity UNKNOWN |
| `/explorer` | Grouping/metric filters, comparison chart та management table | fact_sales_daily → bi_explorer_payload | PARTIAL; totals/filter/row-limit parity потребує runtime |
| `/insights` | Signals, location/channel/order-type drivers, period/LFL links | fact_sales_daily → bi_insights_payload | PARTIAL; rules не доводять причинність або фінансовий ефект |
| `/pnl` | Finance KPI, trend, delivery/aggregator economics, expense/detail tables, selectors | static PNL_SOURCE workbook → JS calculate; no RPC | PARTIAL; Jan–Aug; null→zero і 70/30 allocation, live reconciliation відсутня |
| `/digital` | Date/year/month/compare filters, KPI/trends/YTD, sources, attention/report cards | GA4/GSC period/history + Ads/GBP independent RPCs | PARTIAL; selected Google analytics window не керує Ads/GBP window |
| `/digital/funnel` | Event-stage diagnostic flow, ratios, limitations | digital_ga4_daily → bi_digital_payload | PARTIAL; не sequential user funnel/backend orders |
| `/digital/channels` | Top-channel cards, traffic/purchase/revenue table | GA4 channel daily → bi_digital_payload/history | PARTIAL; attribution/session channel scope, period uniques UNKNOWN |
| `/digital/seo` | GSC KPI, queries/pages, snapshots/opportunities | GSC daily/snapshots → bi_digital_payload/history | PARTIAL; top-N/query omissions; daily slices reported empty |
| `/digital/ads` | Google KPI/trend/campaigns, Meta evidence/KPI/campaigns | Google daily/raw; Meta strict campaign view → separate Ads RPCs | PARTIAL; accounts/currencies/source periods separate; conversions ≠ orders |
| `/digital/site` | Landing pages, devices/behavior, performance context | GA4 daily/device/landing snapshot → period/history | PARTIAL; snapshot ≠ daily; landing limit 30 |
| `/digital/local` | Maps actions KPI, intent/profile table, PageSpeed | GBP daily/PageSpeed snapshot → bi_digital_local_payload | PARTIAL; calls=button actions, measurement freshness UNKNOWN |
| `/digital/social` | Facebook + Instagram evidence/cards/content tables | Social staging → bi_digital_social_payload | PARTIAL Facebook / WAITING Instagram; stocks/reach nonadditive |
| `/digital/commerce` | Product KPI, catalog/availability, health/table/contract | Merchant 3 staging tables → bi_digital_merchant_payload | WAITING baseline; snapshot/context/currency completeness UNKNOWN |
| `/digital/app` | Ads app acquisition, six-source funnel, CPI/CPR/CAC/ROAS/LTV placeholders, readiness/target model | six App staging + Google Ads → bi_digital_app_payload | WAITING native sources; Ads-only slice PARTIAL; nullable preview fixes below |
| `/digital/audience` | User/session/engagement cards, devices, customer/geo limitations | GA4 daily/device → period/history | PARTIAL; period-unique users intentionally unavailable |
| `/digital/tracking` | Source cards, last7 tracking health, missingness/priorities | history + Ads/GBP RPCs | PARTIAL; hard-coded historical current-state assertions removed |
| `/operating` | Run state, KPI/sources, direction/changes, Council/Astra decisions, tasks, disabled run control | allowlisted collector RPCs → qualityGate → validated current-run bus | PARTIAL; current-run/domain gates retained; durable production writes remain disabled |
| `/login` | Password form, missing-config/error state | auth middleware/session boundary | PREPARED; browser/auth/role exercise blocked |

Shared actions: navigation, sidebar freshness, manual `DataSyncControl`, logout,
chart metric switches and Operating tasks are inventoried. No standalone CSV/XLSX
export implementation was found in the traced page/component/API tree; no duplicate
export was added. Existing data-sync/task/manual-run write paths were **not invoked**.
KpiCard is a button without a drilldown handler (D11); chart tooltip/click behavior
needs actual desktop/touch/keyboard exercise, not source-only approval.

## Відтворювані discrepancies та preview fixes

| ID | Severity / стан | Expected → actual before / доказ |
|---|---|---|
| D01 | P1 FIXED_PREVIEW | App missing download/spend навіть при source.rows>0: UNKNOWN → adapter повертав 0. Nullable adapter тепер зберігає null/invalid, measured zero лишається 0 |
| D02 | P1 FIXED_PREVIEW | Spend 100 / installs або conversions 0: undefined → UI/CPA приймали 0. Спільний metricRatio повертає null; ROAS guarded, CPA обчислюється з operands |
| D03 | P1 FIXED_PREVIEW | Tracking має показувати перевірений стан → hard-coded App «0 рядків…14.10» та Google automation assertion. Тепер UNKNOWN/окрема перевірка schedule |
| D04 | P1 OPEN | Null має зберігатися end-to-end → sales/Merchant/P&L helpers та App SQL coalesce вже стирають missingness. Preview adapter не відновить SQL-erased null |
| D05 | P1 OPEN | Однаковий фільтр або явні різні windows → Digital from/to змінює GA4/GSC, Ads/GBP loaders без date args. Live discrepancy amount UNKNOWN |
| D06 | P1 OPEN | Ads money grain з account/currency → curated Google daily key=date, campaign snapshot key=name; metadata втрачена до UI |
| D07 | P1 OPEN | LFL однаковий на SQL/fallback → registry joins проти static closed-name exclusion. Не стверджується конкретна різниця сум без даних |
| D08 | P1 OPEN | Finance methodology/coverage має бути звірена → static 8-month workbook, missing→0 та 70/30 allocation; Glovo net/order margin UNKNOWN |
| D09 | P2 OPEN | Daily slices/complete top-N → reported empty daily та capped snapshots; не називати повною історією |
| D10 | P2 OPEN | Actual measurement timestamp → PageSpeed processing date не доводить measurement recency |
| D11 | P2 OPEN | Кнопка KPI має drilldown → KpiCard button не має handler/link |
| D12 | P1 BLOCKED_ACCESS | Warehouse SELECT evidence Barbara існує; source/UI parity UNKNOWN. Preview READY, protected Vercel connector fetch 403; browser NOT_EXECUTED |
| D13 | P2 DOCUMENTED | Актуальний scheduler scope → 21 Oct blanket statement superseded лише для documented Meta Gate D |

Жодного нового P0 не доведено; це **не** security clearance. Known #18/#27/#31
межі не послаблювалися. Патч не змінює transports/grants/auth, evidence domains,
current-run gates, schedules, Ads settings, paid providers або SYRVE behavior.

D01–D03 мають regression coverage у `web/tests/bi-audit.test.mjs`:
missing/null/invalid values при непорожньому source; measured zero; denominators
0/null/undefined; CPA recomputation; nullable ROAS render guard; відсутність
hard-coded tracking claims. Окремо перевірено inventory reproducibility/routes
та SELECT-only/read-only SQL skeleton. OPEN findings не оголошуються виправленими.

## QA та перевірки

| Перевірка | Результат / межі |
|---|---|
| `npm ci --prefix web` | PASS; 71 packages installed; lockfile не змінено |
| Focused App/badges/inventory/SQL safety tests | PASS, 9 tests (including evidence-scope, unknown currency, browser/follow-up contract regressions) |
| `bi-audit-postgres.test.mjs` | PASS, 2 tests executed (not skipped); 35 relation diagnostics, field mappings, analytics RPC on synthetic local PostgreSQL 16; not production evidence |
| Inventory/query `--check` | PASS; deterministic artifacts match current source |
| Workspace `npm run check` | FAIL: `.agents/run.test.mjs`, `operating-tasks.test.mjs`, `operating-v2.test.mjs` write to sandbox read-only `.agents/runtime`; інших test-file failures не було |
| Source-only `/tmp/issue43-rereview-verification` copy, `npm run check --prefix /tmp/issue43-rereview-verification` | PASS: all 13 test files, TypeScript, optimized Next.js build. Same source, dependency symlink; temporary runtime output only under `/tmp` |
| TypeScript у source-only `/tmp` check | PASS (`tsc --noEmit`, перед optimized build) |
| `git diff --check` | PASS |
| Browser protected Preview | Barbara: build READY; current Vercel connector team/protection fetch 403. NOT_EXECUTED; no navigations/screenshots. Historical loopback attempt EPERM kept separately |
| Production warehouse / upstream / rendered UI | Barbara independent SELECT-only warehouse evidence recorded; Astra runner NOT EXECUTED. Upstream/source and rendered UI parity UNKNOWN. Full independent query output unavailable |
| PostgreSQL diagnostics on disposable fixtures | PASS actual SQL execution. Production PostgreSQL/RLS/concurrency NOT VERIFIED; no production/staging migration executed |

Build route output confirms all listed pages compile. It does not measure live
page latency, Core Web Vitals, user role isolation, mobile overflow or data parity.
Runtime logs/screenshots/customer data/credentials не додано в Git.

Browser continuation: для **кожного** URL з `browser-qa.json` на 1440/768/360px
перевірити loading/empty/error/stale, every period/segment control, cross-tab same
scope, keyboard/focus/contrast, horizontal tables, chart tooltip/drilldown та touch.
Зберігати screenshots приватно; редаговані evidence links додати до outcomes.
Перевіряти auth/role boundaries окремо від credential-free build. Не натискати sync,
create/update task або manual analysis під час read-only live audit: mutation UI
перевіряється із intercepted requests у disposable preview без external writes.

## Пріоритетний план та окремі decision gates

1. **Evidence/access gate (P1):** trusted runner/owner надає вже дозволену read-only
   session; protected Preview QA залишається blocked current Vercel connector team/protection 403.
   Preview build READY за Barbara; protection/credentials не змінювати. Не створювати/міняти credentials. Відновити
   WORKING publication через runner; отримати linked review comments, підтвердити
   deployed commit/RPC definitions. Відсутність PR permission не вимагає user recovery
   до спроби штатного runner handoff.
2. **Data proof gate (P1):** доповнити вже наявні незалежні SELECT checks Barbara повними aggregate receipts; запустити решту SELECT-only QA, порівняти current30/prior30
   та monthly rolling12. Source export → raw → curated → RPC → UI: same account,
   currency, timezone, eligible dates/stores, metric definition та field null-count.
   Duplicates перевіряти по business grain, не лише surrogate PK. Google Ads/GA4/GSC/GBP stored field joins уже підготовлено та fixture-validated;
   PageSpeed measurement mapping потребує додаткового доказу. Stored equality
   не доводить upstream completeness або full source reconciliation.
3. **Finance/attribution gate (P1):** підтвердити backend/SYRVE completeness,
   order/receipt mapping, cancellations/refunds/net revenue і partial refunds.
   Conversion actions/action value/model/window окремі від backend orders; не
   множити spend через action rows. MER потребує всіх marketing costs та same scope.
   Для Glovo звірити gross/net receipts, commission/promo/logistics/tax/COGS без
   подвійного віднімання; markup у Sales не є margin після цих витрат.
   Для LFL потрібні opening/closure dates і єдиний eligible cohort для SQL/fallback.
4. **Preview code/review gate:** D01–D03 + audit artifacts можна передати Barbara
   через trusted workflow PR після його deterministic checks. D04–D08 розбиті на concrete tasks у [follow-up-plan.json](audit/2026-10-24/follow-up-plan.json),
   proposed owner/gates та minimal acceptance criteria; D09–D11 лишаються окремим backlog. Date/currency/schema зміни не робити
   без підтверджених контрактів. P&L allocations потребують рішення фінансів.
5. **SQL application gate (окреме точне owner approval):** будь-який майбутній
   migration design лишається NOT APPLIED поза виконанням; PostgreSQL/RLS/concurrency
   перевіряти на дозволеній isolated database. SQL з цього аудиту — SELECT diagnostics,
   не migration і не доказ applied design.
6. **Release gate (окреме точне owner approval):** merge/main, deploy/promote,
   production/staging migrations не випливають із code review або PASS build.
7. **External-write gate (окреме точне owner approval):** durable writes, SYRVE,
   Ads budgets/campaigns, paid services, credentials та нові schedulers/providers
   не активувати. Existing Meta Gate D **не дублювати**: documented ACTIVE ChatGPT
   recurrence ≠ Windsor destination. П'ять Google daily destinations теж не дублювати.

READY FOR REVIEW для **повного production audit** не заявляється без live proofs
та browser evidence. Remote status publication blocked by missing CLI auth;
preview source changes і всі відомі limitations залишені для trusted runner handoff.
