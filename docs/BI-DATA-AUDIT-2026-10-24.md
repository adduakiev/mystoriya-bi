# М'ЯСТОРІЯ BI — повний source/code inventory, аудит #43 від 24.10.2026

**Статус: preview revision підготовлено для review; production audit acceptance INCOMPLETE.**
Bounded Barbara stored evidence підтверджує лише наведені coverage та Meta key/metric
checks. All-field/upstream/RPC/rendered UI parity **UNKNOWN**. Protected-preview
403 залишає browser QA **NOT VERIFIED**. Sandbox-only restrictions не є глобальним
BLOCKED; owner action зараз **NONE**.

## Revision PR #44 — Actions 40131698750

Поточний run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40131698750.
Існуючий PR: https://github.com/adduakiev/mystoriya-bi/pull/44; **без duplicate PR**.
[Latest CHANGES REQUESTED](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6389387455) supplied in trusted trigger.
Preserved exact existing PR source HEAD: `fc05b4843dd85d958633df72515e4b527c6fc4d8`.
Checkout HEAD: `4f0cfcec48408428d51ee916cb87a97a256e4807`, branch
`astra/issue-43-40131698750`; PR tree відновлено з local git object без зміни index.
Target handoff: `astra/issue-43-40107435112`, існуючий PR #44.

Source SHA `fc05b4843dd85d958633df72515e4b527c6fc4d8` — Vercel **READY** за latest trusted trigger; це не fresh API
check, remote GitHub CI тут **UNKNOWN**. Protected preview **403**, no screenshots,
no browser navigation. Новий revision SHA з'явиться лише після runner commit/push;
його CI/READY не можна підмінювати source-SHA status. [Provenance](audit/2026-10-24/revision-provenance.json).

WORKING attempted on issue #43 з current run URL; `gh` exit 4 (GH_TOKEN unavailable).
Поточний remote WORKING outcome не перевірено; trusted workflow має окремий step.
Historical trusted pushes/PR recovery не спростовуються sandbox failures. Codex
не виконує commit/push/PR creation; runner публікує READY FOR REVIEW після checks
і push з повним новим SHA. Temporary-branch recovery Barbara — не user blocker.

| Acceptance revision | Результат / межі |
|---|---|
| GA4 coverage | Barbara SELECT-only current30 30/30, prior30 30/30, 365/365 dates; null core metric rows 0 |
| GSC coverage | Barbara current30 **28/30**, prior30 30/30, 363/365 dates; null core metric rows 0; current30 through 10-21 |
| Meta bounded key metrics | 2026-09-24…10-23: 138 USD groups raw/curated; FULL OUTER JOIN account_id/campaign_id/date/account_currency: 0 missing sides; 0 multiplicity/spend/clicks/impressions mismatches |
| Evidence limits | Meta Gate D rolling 145/26 — separate scope; all-field/upstream/RPC/UI UNKNOWN, no zero-fill |
| Merchant / App | Nullable Merchant tests збережено; App source currency UNKNOWN, source-contract design NOT APPLIED |
| Preview / handoff | Exact source SHA READY; browser 403 NOT VERIFIED; new revision CI/SHA/remote READY post pending runner |
| Follow-ups | D04–D11 OPEN; owner action NONE |

## Докази та межі

[Датований redacted receipt](audit/2026-10-24/REVIEWER-EVIDENCE.md) transcribes лише
явні Barbara SELECT-only результати latest trusted trigger, reported 2026-10-24.
Codex production SQL не виконував. Full query text, exact execution timestamp,
account timezone та every-field completeness receipts не supplied. Meta matching
multiplicity не доводить унікальність keys. Prior30/365 date coverage не доводить
row counts або upstream completeness. Source latest event timestamp не виводиться
з daily date/imported_at. Historical fixtures, issue baseline, Barbara production
aggregates та поточні local checks мають окрему provenance.

Supabase/upstream session та authenticated browser тут не використовувалися.
Historical local EPERM не описує current Vercel; credentials/protection/RLS,
source schedules та business data не змінено. Production correctness/acceptance
не оголошено завершеними через preview readiness.

## Артефакти та відтворення

| Артефакт | Зміст і межі |
|---|---|
| [inventory.json](audit/2026-10-24/inventory.json) | 22 pages, 7 API routes; import component tree, RPC/SQL definitions, 742 unique visual/control templates; shared paths normalized |
| [tab-block-matrix.csv](audit/2026-10-24/tab-block-matrix.csv) | 1,382 route/block references: path/component/line/definition/evidence + route_contract link; grain/filters/timezone/freshness/status/source candidates inherit from inventory route |
| [metric-lineage.csv](audit/2026-10-24/metric-lineage.csv) | Broader source→warehouse→RPC formulas; concise actual JSON→adapter→JSX bindings in KPI-LINEAGE.md |
| [source-register.json](audit/2026-10-24/source-register.json) | Sources, IDs where known, baseline provenance, grain, ownership/access/schedule/expected volume; bounded Barbara measurements separately attributed |
| [HANDOFF.md](audit/2026-10-24/HANDOFF.md) | Existing PR #44 only; actual revision SHA and READY post belong to trusted runner after checks/push |
| [follow-up-plan.json](audit/2026-10-24/follow-up-plan.json) | D04–D11 OPEN: proposed owner, gate, minimal acceptance; no assignment or release authorization |
| [discrepancies.json](audit/2026-10-24/discrepancies.json) | D01–D18: severity, reproduction, expected/actual, patch status та residual risk |
| [COVERAGE.md](audit/2026-10-24/COVERAGE.md), [coverage.csv](audit/2026-10-24/coverage.csv) | Фіксовані current30/prior30/rolling12 windows, bounded Barbara results, GA4/GSC current30/prior30/365 coverage, bounded Meta key metrics та UNKNOWN parity/other-source cells |
| [read-only-qa.sql](audit/2026-10-24/read-only-qa.sql) | 35 relation diagnostics; read-only transaction, monthly/date gaps, null counts, duplicate keys, Meta raw/curated mismatch, RLS flags; **production NOT EXECUTED**; executed on disposable fixtures, не migration |
| [browser-qa.json](audit/2026-10-24/browser-qa.json) | Точні local URLs для кожного route, 360/768/1440px cases, blocker та NOT_EXECUTED outcomes; screenshots []; executable manual matrix generator |

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
existing authorized session; production execution відсутнє. Для продовження на вже
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
| D04 | P1 OPEN | Null має зберігатися end-to-end → sales/P&L helpers та App/Merchant SQL coalesce стирають missingness. Merchant adapter виправлено D18; SQL-erased null не відновлено |
| D05 | P1 OPEN | Однаковий фільтр або явні різні windows → Digital from/to змінює GA4/GSC, Ads/GBP loaders без date args. Live discrepancy amount UNKNOWN |
| D06 | P1 OPEN | Ads money grain з account/currency → curated Google daily key=date, campaign snapshot key=name; metadata втрачена до UI |
| D07 | P1 OPEN | LFL однаковий на SQL/fallback → registry joins проти static closed-name exclusion. Не стверджується конкретна різниця сум без даних |
| D08 | P1 OPEN | Finance methodology/coverage має бути звірена → static 8-month workbook, missing→0 та 70/30 allocation; Glovo net/order margin UNKNOWN |
| D09 | P2 OPEN | Daily slices/complete top-N → reported empty daily та capped snapshots; не називати повною історією |
| D10 | P2 OPEN | Actual measurement timestamp → PageSpeed processing date не доводить measurement recency |
| D11 | P2 OPEN | Кнопка KPI має drilldown → KpiCard button не має handler/link |
| D12 | P1 BLOCKED_ACCESS | Source→warehouse→RPC→UI parity → reviewer stored checks окремо; upstream/RPC/UI UNKNOWN, protected preview 403 |
| D13 | P2 DOCUMENTED | Актуальний scheduler scope → 21 Oct blanket statement superseded лише для documented Meta Gate D |
| D14–D16 | P1 FIXED_PREVIEW | App source currency, presence badges, all-campaign rows; source-grain limitations залишаються |
| D17 | P1 FIXED_PREVIEW | Catalog/health rows не вмикають performance cards |
| D18 | P1 FIXED_PREVIEW | Positive-row/null-field Merchant metrics лишаються —; measured zero збережено; missing counts UNKNOWN ≠ confirmed zero WAITING |

Жодного нового P0 не доведено; це **не** security clearance. Known #18/#27/#31
межі не послаблювалися. Патч не змінює transports/grants/auth, evidence domains,
current-run gates, schedules, Ads settings, paid providers або SYRVE behavior.

D01–D03 мають regression coverage у `web/tests/bi-audit.test.mjs`:
missing/null/invalid values при непорожньому source; measured zero; denominators
0/null/undefined; CPA recomputation; nullable ROAS render guard; відсутність
hard-coded tracking claims. Окремо перевірено inventory reproducibility/routes
та SELECT-only/read-only SQL skeleton. OPEN findings не оголошуються виправленими.

## QA та перевірки

Current revision receipt: [verification.json](audit/2026-10-24/verification.json).
Full check used the same final code/tests; subsequent edits were documentation only.

| Перевірка | Результат / межі |
|---|---|
| `npm ci --prefix web` | PASS; 71 packages installed; lockfile не змінено |
| Focused App/badges/inventory/SQL safety + Merchant tests | PASS: 9 audit tests + 3 Merchant tests; PostgreSQL ще 2 executed tests |
| `bi-audit-postgres.test.mjs` | PASS, 2 tests executed (not skipped); 35 relation diagnostics, field mappings, analytics RPC on synthetic local PostgreSQL 16; not production evidence |
| Inventory/query `--check` | PASS; deterministic artifacts match current source |
| Workspace `npm run check` | FAIL: `.agents/run.test.mjs`, `operating-tasks.test.mjs`, `operating-v2.test.mjs` write to sandbox-protected `.agents/runtime` (ENOENT on mkdir in this sandbox); 11/14 files passed; checks stop before TypeScript/build |
| Writable source-only `/tmp/issue43-40131698750-check-9fux9vbx`: `npm run check` | PASS: all 14 test files, TypeScript, optimized Next.js build; exit 0. Same code/tests, installed dependency symlink; runtime output only under `/tmp` |
| TypeScript | PASS in writable full repository check |
| `git diff --check` | PASS; new/untracked audit files also checked with no-index whitespace diagnostics |
| Remote CI / new revision SHA | UNKNOWN to Codex; runner attaches actual CI to actual new SHA after commit/push. Reported source-SHA Vercel READY is separate |
| Browser/Preview | Latest trusted trigger: exact fc05b4843dd85d958633df72515e4b527c6fc4d8 READY; protected preview 403, browser NOT VERIFIED. Historical local EPERM окремо. Matrix generator PASS: 22 routes × 3 viewports = 66 NOT_EXECUTED cases |
| Live data | Barbara-reported bounded GA4/GSC/Meta results transcribed; GA4/GSC current30/prior30/365 та Meta bounded key metrics recorded; full SQL/time/all-field receipts unavailable. Codex live SQL NOT EXECUTED; upstream/RPC/UI UNKNOWN |
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

1. **Evidence/access continuation (P1, no owner action requested):** використати вже дозволену read-only
   session і preview з портами/browser. Не створювати/міняти credentials. Поточні
   WORKING/READY posts належать runner; отримати повні linked review receipts, підтвердити
   deployed commit/RPC definitions. Відсутність PR permission не вимагає user recovery
   до спроби штатного runner handoff.
2. **Data proof gate (P1):** запустити SELECT-only QA, порівняти current30/prior30
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
   через trusted workflow PR після його deterministic checks. OPEN D04–D11 мають мінімальні fix tasks у
   [follow-up-plan.json](audit/2026-10-24/follow-up-plan.json), proposed owners, gates та acceptance. Date/currency/schema зміни не робити
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

READY FOR REVIEW стосується **preview revision**, після trusted checks/push;
повний production audit acceptance залишається INCOMPLETE без parity/browser proofs.
Owner action зараз **NONE**; жодного production approval не запитується для підготовки revision. Trusted workflow виконує remote handoff після commit/push і checks;
preview source changes та limitations не є завершенням production audit.
