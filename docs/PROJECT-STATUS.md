# М'ясторія BI — стан проєкту та задачі команди

2026-11-11, D288 issue #43 / #48 / same PR #44:
[Glovo preview and source limitations](audit/2026-10-24/GLOVO-D288-PREVIEW-2026-11-11.md).
Added `/aggregators/glovo` with discoverable child navigation, explicit SOURCE
UNAVAILABLE state, blocked KPI/trend/drilldown structure and a pure tested
monthly contract. No authorized exact Glovo runtime provider is established;
private Sales readers target another source. No business records were fetched,
no financial amounts are published, and no live/source-parity claim is made.
Jan–Oct default excludes partial November; unknown mappings and missing measures
remain unknown. New candidate native CI/Preview acceptance remains pending;
historical 17 real-Preview responsive cases and wider audit remain incomplete.
Sales atomic recovery, both 503 guards and SU-545195 HOLD are unchanged.

2026-11-04, issue #43 / same PR #44: [coordinated Sales release checklist](audit/2026-10-24/SALES-RECOVERY-RELEASE-CHECKLIST-2026-11-04.md).
Code audit confirms the prepared SQL alternatives are not a deployable bundle:
hardening requires the old rejection bodies; prewrite replaces them; production
evidence-bound success remains missing. A distinct signed owner transition can
accept a backed-up **legacy unverified** October-26 warehouse without inventing
historical source authentication. Existing-secret readonly probe adapter is
prepared but NOT run with real credentials. Workflow-dispatch changes were
rejected by GitHub permissions and deliberately EXCLUDED from recovery. Production counts/source access/installed state are
not remeasured; 503s and disabled refresh remain. See the checklist for exact
owner prerequisites, missing implementation, rollback limits and verification.

2026-11-03, issue #43 / same PR #44: [synthetic attestor TRUNCATE retry](audit/2026-10-24/SALES-ATTESTOR-TRUNCATE-RETRY-2026-11-03.md).
Clean pinned HEAD `47c274cf02a9bcbe63ca4eb25c8911a128720c1b` verified locally.
Reconstructed the absent uncommitted review-only private receipt draft; the native
regression distinguishes FK `0A000` from independent immutable-trigger `42501`,
checks exact hashes/counts/FK-linked rows after each, and detects an actual
rollback-only CASCADE bypass. Independent LOGINs, replay/concurrency, rollback,
pre-draft catalog preservation and source-stop native restore remain mandatory.
Trigger-reported outer 563 total / 561 PASS / 2 FAIL / 0 SKIP is FAILED historical
evidence, not this candidate's result. Local native startup is blocked by socket
EPERM; supplemental single-user SQL checks, independent TS/build and inventory
pass but do not clear that gate. SQL NOT APPLIED; production/runtime guards
unchanged. BLOCKED pending trusted outer verification; no recovery claim,
commit/push or broader audit completion. Earlier entries below are historical.

2026-11-03, issue #43 / same PR #44: [composed private Sales review and blocked cutover](audit/2026-10-24/SALES-CUTOVER-CANDIDATE-2026-11-03.md).
Verified starting HEAD `c7e94f4d641563eb115f007e471b23c046811de8`.
Typed private OAuth capture, exact-cent preparation and provenance derivation now
compose into a confidential BLOCKED review. Structural `accepted_source_v1`
metadata is not authentication: prepared transport recovery now rejects before
I/O and all DB POST paths are removed. No approved prior root/DB attestor exists;
full authenticated cutover remains unimplemented. Both runtime 503 guards, SQL
NOT APPLIED and production UI remain unchanged. Trigger-reported trusted base
Actions 41595108624: 524/524 PASS, zero failures/skips; new candidate verification
is separate. Explicit owner credential/probe, attestor, backup and release gates
are in the report. No new production observations; wider audit INCOMPLETE.


2026-11-03, issue #43 / same PR #44: [bounded Sales role/grant retry](audit/2026-10-24/SALES-ROLE-HARDENING-RETRY-2026-11-03.md).
Pinned clean HEAD `3ea0d0154282d6365e5cea81041ef2ee0378d2a4` verified locally.
Prepared separate rollback-default hardening and read-only catalog preflight;
recreated focused native ACL tests with valid non-identity DML, SQLSTATE 42501,
independent effective grants and zero row/sequence mutation checks. Inherited,
default-grant and ownership hazards STOP rather than widening permission changes.
Trigger-reported prior trusted 528/530 PASS was a FAILED candidate, not approval;
local native socket EPERM is a distinct execution blocker. Verification details
and limitations are in the linked report. SQL NOT APPLIED, runtime 503 and
all-evidence rejection guards unchanged. NOT READY FOR GATE; audit INCOMPLETE.

2026-11-03, issue #43 / same PR #44: [synthetic restore and rollback readiness](audit/2026-10-24/SALES-RESTORE-READINESS-2026-11-03.md).
Exact clean starting HEAD `b265cb32e7715461a26eb92db04c13658b811800`
verified locally. Added a fail-closed native two-cluster pg_dump/pg_restore test
and a source-grounded Sales cutover/rollback dependency checklist. Local server
startup is blocked by sandbox socket EPERM; no restore PASS is claimed. Trigger
reports prior trusted base 517/517 PASS; the new candidate needs independent
outer-runner verification and its resulting SHA. No new production observation,
backup/restore, SQL/grant installation, attestor/root or handler integration.
Both runtime 503 guards and historical source gate remain closed. NOT READY FOR
GATE; broader audit INCOMPLETE. Earlier dated entries below are historical.

2026-11-03, issue #43 / same PR #44: [transactional accepted-source gate](audit/2026-10-24/SALES-ACCEPTED-SOURCE-GATE-2026-11-03.md).
Exact clean base `7004a19a65f3e033433fa183628dfd6b6c8fc8d4` verified locally.
No approved DB-authenticated attestor/root exists in the reviewed contract; a new
NOT APPLIED rollback-default SQL overlay rejects every evidence submission and
closes the old commit route in disposable tests. Authenticated persistence and
success/readback remain explicitly unimplemented pending that release gate.
Original atomic happy-path fixture preserved; production and both 503 handlers
untouched. Trigger-supplied D191 trusted 516/516 PASS is base evidence only.
Broader audit INCOMPLETE; no new production observation or release approval.

2026-11-03, issue #43 / existing PR #44: [typed private Sheets capture preparation](audit/2026-10-24/SALES-SHEET-CAPTURE-PREPARATION-2026-11-03.md).
An isolated server-only adapter retains typed cells, in-memory original JSON
body bytes/fingerprint and fixed request metadata before reader coercion.
Synthetic evidence only; no live observations or legacy authenticity claims.
Dispatch reports trusted base `c0dcc6b98d5f33074d76c090074480c46adf007b`,
Actions 41562042936 PASS (494 native tests, zero skips); new candidate checks
remain separate. Both unconditional 503 guards and NOT APPLIED SQL are intact.
**NOT READY FOR GATE**; broad audit incomplete and all owner gates remain held.

2026-11-03, issue #43 / existing PR #44: [atomic transport and authoritative baseline preparation](audit/2026-10-24/SALES-TRANSPORT-PREPARATION-2026-11-03.md).
An opt-in, unreferenced server module preserves exact decimal RPC bodies and
fails closed without accepted-source provenance. Current importers do not emit
that provenance; no production baseline is certified. Both manual Next/Edge
paths retain their exact unconditional 503 guards; SQL remains NOT APPLIED.
The issue trigger records trusted Actions 41546061091 PASS (461 tests, zero
skips) on base `9c91c116a92ad619874b9995fdc0ea6b652bdd69`; historical sandbox
failures below do not negate that base receipt. New candidate verification and
all release/data-write gates remain separate. No new production observations.

## D287 shared shell containment — 2026-11-10 (preview code)

[D287 evidence and verification limits](audit/2026-10-24/RESPONSIVE-D287-SHARED-SHELL-2026-11-10.md):
three shared CSS declarations constrain the workspace grid minimum while
retaining internal table scrolling. Source/SSR failure controls pass; Chromium
startup remains blocked locally. Trigger-supplied independent synthetic metrics
are labelled separately from authenticated Preview, which remains unverified.
Historical inner full check reported 49/59 file-level passes and the same 10
failing files documented in D286; separate TypeScript and optimized build passed.
Superseding D288 trigger receipt independently accepts the narrow offline CSS
gate at `c39095111d895833c95fc6b26145a689a25533a9`: [exact-SHA native CI](https://github.com/adduakiev/mystoriya-bi/actions/runs/42929459819)
PG16.15 and PG17.11 each 646/646 PASS (zero failures/skips), build PASS and
Preview READY. This does not accept the new Glovo candidate, source parity or
authenticated browser containment. Historical 17 overflow cases remain open.
No production observations or Sales recovery changes;
SU-545195 HOLD and owner gates remain. NOT READY FOR RELEASE.

## D284 GBP identity — 2026-11-10 (preview code)

[D284 evidence and verification limits](audit/2026-10-24/GBP-D284-IDENTITY-2026-11-10.md): profile labels now always retain full source IDs,
so result-set changes cannot switch between a title, suffix and full ID.
Addresses remain unverified and explicitly labelled; no guessed crosswalk.
This supersedes the historical D26 suffix-label behavior below. Synthetic
regressions pass; trusted OUTER native CI and authenticated Preview acceptance
remain pending. No new production observations, Sales changes or release.

## D26 GBP profile identity — 2026-10-27 (preview code)

[Bounded D26 report](audit/2026-10-24/GBP-IDENTITY-REVISION-40444470576.md)
continues exact PR #44 source `7fd3233ab5d83885de38eef7316097b59d0370d0`.
Equivalent GBP names now receive deterministic ID-derived labels shared by the
profile table and top-intent card, with accessible complete IDs. Suffix
collisions expand to full IDs; missing/repeated identity remains explicitly
ambiguous. Genuine unique names, raw keys, metrics, null/zero, ranking and
freshness are preserved. The verified ID-to-address crosswalk remains UNKNOWN.
This is synthetic SSR/code evidence; all 66 authenticated browser cases remain
NOT_EXECUTED. No SQL/production changes. Runner owns same-PR #44 publication.
Owner action NONE; broader #43 audit INCOMPLETE. Earlier sections are historical.

Історичний production baseline: **21.10.2026**. Аудит коду та доказів: **24.10.2026**; bounded Barbara SELECT-only evidence recorded; upstream/RPC/UI та browser NOT VERIFIED, див. issue #43 нижче.

Цей документ розрізняє локальну реалізацію, перевірки та роботу в production.
Позначка «зроблено» не означає, що зміна вже опублікована.
Паша — запропонований відповідальний за технічну частину, Соня/агенція —
за маркетинг. Їхні фактичні повноваження та доступи потрібно підтвердити.
Строки виконання командою ще не погоджені.

## Issue #43 — аудит 24.10.2026: локальний код та межі доказів

## D05 source-window correction — 2026-10-26 (preview code)

[Bounded D05 report](audit/2026-10-24/D05-SOURCE-WINDOW-REVISION-2026-10-26.md)
continues exact PR #44 source `6055ab54746be16a99c75d1bd4989d033894a4e5`.
GA4/GSC selected dates and comparisons remain intact. Ads/Local overview cards
now display independent returned source windows, explicit completeness/freshness
UNKNOWN and no selected-period comparison. Both boundaries must match before
stating a match; upstream coverage is still unproven. Ads measured-zero signal
names its source period; null/unknown conversions do not trigger it. D22 Ads
money/ROAS UNKNOWN, D23 GA4 currency UNKNOWN and Meta USD/null guards preserved.
[Actual checks and limitations](audit/2026-10-24/d05-source-window-verification-2026-10-26.json)
record the workspace runtime restriction separately from writable-copy checks.
No new production data proofs; all 66 authenticated browser cases remain
NOT_EXECUTED. D05 overall audit acceptance remains OPEN; runner owns exact
candidate SHA/status and same-PR handoff. Owner action NONE; broader audit INCOMPLETE.

## GA4 currency correction — Actions 40279645896 (2026-10-26)

[Bounded D23 report](audit/2026-10-24/GA4-CURRENCY-REVISION-2026-10-26.md)
continues requested PR #44 source `9c89d854d9f8b0906e348fc430ecf6451e85c8b0`.
GA4 revenue/AOV, channel/device/landing money, monetary comparisons and monthly/YTD
revenue plots now fail closed with currency UNKNOWN until verified reporting
currency/property/account/grain provenance exists. Numeric source data, zero/null
and nonmonetary KPIs remain intact; Google Ads ROAS UNKNOWN and Meta USD/null
regressions pass. Production catalog zero currency/property columns is relayed
from the trusted trigger, not rerun. No SQL/migration changes or production writes.
See [dated lineage](audit/2026-10-24/ga4-monetary-lineage-2026-10-26.json) and
[actual checks](audit/2026-10-24/ga4-currency-verification-2026-10-26.json).
Full tests/types/build pass in a writable identical-source copy; the workspace
check is blocked by the read-only .agents/runtime mount. **66 authenticated browser
cases remain NOT_EXECUTED**; broader audit INCOMPLETE, provenance UNKNOWN.
Remote WORKING could not be posted without GH_TOKEN. Runner owns acknowledgement,
new candidate SHA and same-PR publication; no Codex commit/push/release.
Owner action NONE for bounded code/tests. Earlier sections are historical.

## Historical QA continuation — Actions 40255887088 (2026-10-26)

[QA report](audit/2026-10-24/PREVIEW-QA-2026-10-26.md) and
[66-case execution matrix](audit/2026-10-24/qa-execution-matrix.json) continue
existing PR #44 from reviewed `6f624cf64a50ba4f33ca24998f6140fa79ad9957`.
Trigger reports exact-SHA Preview READY and former Vercel 403 resolved; HTTP 200
is the app login shell, not authenticated BI. This is relayed evidence, not an
independent probe. Local credential-free middleware/API and synthetic SSR tests
cover all 22 pages, filter→RPC bindings, null/zero, currency, freshness and source
failure. **All 66 real browser cases remain NOT_EXECUTED**. Chromium at
360/768/1440 fails before rendering (`SIGABRT`/`EPERM`); external DNS and local
HTTP binding are unavailable. Mock SSR is not viewport, upstream or live parity
proof. Full tests/types/build pass in a writable source copy; workspace runtime
writes remain sandbox-blocked. See the [current receipt](audit/2026-10-24/preview-qa-verification-2026-10-26.json).
No app/SQL changes relative to reviewed source; prior Ads stored parity,
Meta USD/null, fail-closed ROAS and App/Merchant/GA4/GSC guards preserved.
WORKING acknowledged in transcript; GitHub post failed without GH_TOKEN.
Runner owns publication to existing PR #44 and new commit SHA; no Codex
commit/push/deploy or credential action. Broader audit acceptance INCOMPLETE;
owner action NONE for bounded QA. The sections below are dated historical work.

Historical bounded follow-up: [Actions 40206730240](https://github.com/adduakiev/mystoriya-bi/actions/runs/40206730240),
PR #44 requested base `922d04d2afec8181ab17e175b582e113c95c5c17`.
[25 Oct report](audit/2026-10-24/GOOGLE-ADS-DAILY-RECONCILIATION-2026-10-25.md):
independent SELECT-only results relayed by trigger, UTC 12–24 Oct Google Ads raw
157 rows / 13 dates → curated 13 / 13; 0 missing-date groups, 0 five-metric daily
mismatch groups, 0 duplicate raw keys. Query prepared/tested on synthetic local
PostgreSQL only. New 25 Sep–24 Oct coverage: GA4 30/30 dates, GSC 28/30 through
22 Oct, Ads 13/30 since 12 Oct (13/13 onboarded dates). Earlier GSC 29 rows /
29 observed dates is the different 24 Sep–23 Oct window with 30 expected dates.
Source currency, account/action attribution, timezone and upstream/RPC/UI parity
UNKNOWN; D06 OPEN and D22 fail-closed. Shifted prior30/12-month not recounted.
66 browser cases NOT_EXECUTED; exact-SHA gate 6398044302 open. No release; NOT
READY FOR GATE; owner action NONE for code/docs/tests. Runner owns status posts,
commit/push to existing PR #44 and actual revision SHA. Historical review follows.

Historical code-only review: [Actions 40193841845](https://github.com/adduakiev/mystoriya-bi/actions/runs/40193841845),
recovered PR #44 source `ac64aad96628da197a3e02fd0d12e33cb324e3b1`.
D22 blocks Google Ads summary/campaign/overview ROAS and comparative value/spend
signals without verified same-account/same-currency evidence. Known counts/CTR,
null/zero, UNKNOWN-money guard, Meta USD/nulls, App/Merchant and sidebar preserved.
Latest independent receipt dated 25.10: fixed UTC 24.09–23.10 GA4 **30/30**, GSC
**29/29**, Google Ads staging **0 currency columns**. Earlier GSC **28/28** below
is dated historical evidence; prior30/12-month/null checks were not repeated.
See [revision receipt](audit/2026-10-24/GOOGLE-ADS-ROAS-REVISION-40193841845.md)
and [checks](audit/2026-10-24/verification.json). No production release or parity
claim. Browser **66 NOT_EXECUTED**, no authorized preview session. Code-only
owner action NONE; trusted runner handles existing PR #44 and commit/push SHA.

Historical code-only review:
 [Actions 40186524170](https://github.com/adduakiev/mystoriya-bi/actions/runs/40186524170),
existing PR #44 source `7cbe56147f5a65eeeda1136b0f63627e64bd3542`.
D21 removes inferred Google Ads UAH, unverified monetary charts and the 500-unit
threshold across Paid Advertising and Digital overview. Shared App currency
formatting keeps UNKNOWN/MULTI fail-closed; Meta USD/nulls and sidebar/prefetch
fixes preserved. D06 currency/account grain remains OPEN. See
[current revision](audit/2026-10-24/GOOGLE-ADS-CURRENCY-REVISION-40186524170.md)
and [current check receipt](audit/2026-10-24/verification.json).
No new production data observation or release; prior dated evidence below remains
historical. GitHub status publication and commit/push SHA belong to trusted runner.

Historical contract review revision: [Actions 40140314226](https://github.com/adduakiev/mystoriya-bi/actions/runs/40140314226),
existing PR #44 source `bd126b802068553dc45194bfb8429516c7bc2569`.
Six representative [static RPC contracts](audit/2026-10-24/rpc-contract-lineage.json)
now record signatures/hashes and source→RPC→adapter→UI. Deployed exact-definition
parity UNKNOWN; reviewer reports VOLATILE + SECURITY DEFINER, consistent with
repo default volatility. Audit SQL now inspects catalogs only; payload calls
withdrawn. Unsupported currency handling strengthened with regression tests.
**CODE/DOCS TESTED:** focused checks and all 15 test files/TypeScript/build in a writable same-source copy PASS (workspace runtime-write sandbox failure recorded in verification.json);
**END-TO-END AUDIT NOT VERIFIED** (upstream/all-field/RPC/UI/timezone and protected
403 browser access unresolved; 66 cases NOT_EXECUTED). No release/data-write gate
used or changed. WORKING post attempt failed: no configured GitHub CLI auth;
trusted runner handles publication and actual new revision SHA.

**Аудит: 24.10.2026; reviewer verification/post-handoff receipt: 25.10.2026.** Основний production baseline цього документа
залишається історичним станом 21 жовтня. Поточний deployed commit не перевірено.
[Повний звіт #43](BI-DATA-AUDIT-2026-10-24.md) містить статичний inventory,
lineage, register, coverage та відтворювані blockers. Це не підтвердження
production correctness: bounded Barbara read-only stored observations доступні;
upstream/RPC/browser parity залишається UNKNOWN.

- **Gate D Meta — ACTIVE за наявним записом активації 24.10**, а не нове
  спостереження цього аудиту: [activation record](meta-windsor-gate-d-activation.md),
  [postactivation evidence](sql/backups/issue-37-gate-d-postactivation-2026-10-24.json).
  Механізм — ChatGPT scheduled task «Meta Ads BI Sync», daily ~08:00 Europe/Kyiv,
  previous 30 completed UTC dates; Windsor destination для Meta не створено.
  Історичне «Scheduler — NOT IMPLEMENTED» нижче не описує цей Meta scheduler.
  Operating live LLM/manual-run/task persistence — окремі контракти.
- П'ять Google Windsor destinations та source counts від 24.10 наведені в issue
  як baseline; їхній runtime, field completeness і reconciliation тут **UNKNOWN**.
  Повторні destinations/exports/schedulers не створювати.
- **PREVIEW CODE, PR #44 revision:** App nullable/currency/ratio guards,
  PARTIAL/UNKNOWN badges та all-campaign table збережено. Merchant nullable adapter
  тепер зберігає missing fields навіть при positive performance rows; confirmed
  zero показується як 0, missing source counts UNKNOWN ≠ empty counts WAITING.
  SQL-erased missingness та D04–D11 залишаються unresolved.
- **Trusted post-handoff receipt 25.10:** run 40131698750 WORKING/Codex/checks/commit/push
  PASS; GitHub Actions pushed `485c5a5d16c18a56b286e167f05749b51db0c365`; existing PR #44 recovered
  to that HEAD; exact-SHA Vercel READY. [Receipt](audit/2026-10-24/POST-HANDOFF-2026-10-25.json).
  This is trusted-trigger evidence, not a fresh API check. Historical local
  PENDING is superseded for that run. Current run 40140314226 prepares a new
  working-tree revision; its future commit/push/checks need a separate receipt.
- **Barbara SELECT-only, verification 25.10:** fixed audit windows unchanged.
  GA4 current30/prior30/trailing365 **rows/dates 30/30, 30/30, 365/365**; GSC
  **28/28, 30/30, 363/363** (expected dates 30/30/365). Current30 core metric
  null rows 0. Earlier prior30/365 null checks remain separately attributed.
  New Meta current30 **138 raw/curated rows, 25 dates, USD 1311.75 each**.
  Earlier 138-group full-outer key/four-metric evidence retained separately;
  Gate D rolling **145/26** remains a different scope. Earlier dated independent
  Sales **966 rows/29 dates**, Google Ads daily **12/12**, GBP **48/12** restored
  from comment 6388338141, **not newly queried**. No upstream/RPC/UI parity inferred.
  [Redacted receipt](audit/2026-10-24/REVIEWER-EVIDENCE.md).
- **Preview:** exact `485c5a5d16c18a56b286e167f05749b51db0c365` READY confirmed; protected preview
  HTTP 403 leaves desktop/mobile/runtime/filter/role/browser QA NOT VERIFIED.
  No screenshots/navigation or protection bypass. Owner action NONE for this
  preview/code/docs loop; production gates remain unchanged.
- **App grain:** account/campaign/currency та conversion-action ambiguity описано
  в [NOT-APPLIED proposal](audit/2026-10-24/APP-CONTRACT-PROPOSAL.md); money без
  source currency withheld, жодного money/backend-order inference. Barbara reports
  Google staging account_id/campaign_id/date present, currency/account_currency/currency_code absent.
  Source-money UNKNOWN; no exchange conversion. D04–D11 OPEN tasks мають owner/gate/acceptance
  у [follow-up plan](audit/2026-10-24/follow-up-plan.json); owner action зараз NONE.
- Поточні результати tests/TypeScript/build і sandbox runtime write limitation —
  у [QA table](BI-DATA-AUDIT-2026-10-24.md#qa-та-перевірки). SQL diagnostics
  перевірено на disposable PostgreSQL fixtures; це не live Supabase parity.
  Production/staging SQL/migrations/deploy не виконувалися.

## Issue #12 — локальна correctness phase 1 (22.10.2026)

**Review closure:** Ads/GBP empty selected periods now stay unknown instead of fabricated zero; true zero requires positive period evidence. PageSpeed remains independent. Integration is still preview-only / not production.

- **EXECUTABLE:** nullable GA4/GSC/Ads/GBP/PageSpeed adapters, відсутні period-unique active users, null-safe ratios/sums/YTD, окремі дати джерел/обробки, точні 30-денні періоди snapshot і видимі RPC row limits. Повнота без доказів залишається UNKNOWN.
- **PREPARED / NOT APPLIED:** SQL design поза migrations, з фінальним ROLLBACK; жодного SQL execution чи production deploy.
- **NOT IMPLEMENTED:** відновлення historical missingness, точні period uniques, справжній PageSpeed measurement timestamp, upstream completeness, історичний пошук snapshot та атомарність між RPC. App/Merchant/Social поза цією фазою.
- Контракт, структурні обмеження й review blocker: [Digital data contract](digital-data-contract.md). Текст останнього Barbara CHANGES REQUESTED недоступний у runner event; GitHub API недоступний. Review-specific closure не заявляється.
- Поточний production status нижче — історичний; ці локальні зміни його не змінюють.

## Актуальний production status — 21.10.2026

- **Digital Operating Layer v1 — LIVE**.
- Production commit: `800b3ce9d9e062daf907825fd67fdadc11154a7c`.
- Task persistence — **unavailable on Vercel**; local JSON лише для development.
- Council у UI — deterministic/replay; це не production live LLM cycle.
- Live 4-agent production cycle — **NOT IMPLEMENTED**.
- Scheduler — **NOT IMPLEMENTED**.
- v1: 18 regression tests, TypeScript/build та перевірки UI; historical release reports описують стан до публікації.
- v2 готується окремо в `feature/digital-operating-v2`, без migration execution, production deploy чи зовнішнього LLM.
- v2 architecture: [runtime/provider/repository і manual flow](DIGITAL-OPERATING-V2.md). ProductionRuntime/SupabaseTaskRepository — disabled stubs; migration лише файл. Після review Барбари в issue #7: SQL tasks лише з останнього eligible completed LIVE run; creator-wide default privileges прибрано, явні REVOKE для private objects. 45 тестів PASS; локальні HTTP guard checks пройдено на попередньому етапі. Результат поточного TypeScript/build — у work report. Commit/push/PR очікують review Барбари.

Подальші таблиці описують доступність джерел і задачі команди, а не заперечують LIVE-статус v1.

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

- [x] Digital Operating Layer v1 опубліковано: production `800b3ce…`; v2 ще не опублікований.
- [x] Перевірено Ads, SEO й Overview з реальними даними; v2 потребує нового release audit.
- [ ] Запустити повний live-цикл усіх п'яти агентів з актуальними доказами.
- [x] Реалізувати автоматичне формування aggregate input packet.
- [ ] Налаштувати щоденний scheduler.
- [ ] Завершити збір GA4/GSC daily slices: попередній агент зупинився через квоту; завершення не підтверджено.
- [ ] Підключити правильний Meta Ads account та Instagram.
- [ ] Узгодити й підключити SYRVE/backend orders, order_events, refunds та line items.
- [ ] Реалізувати consent-aware pseudonymous identity і backend order attribution.
- [ ] Звірити повну виручку, маркетингові витрати й складові contribution margin.
- [ ] Перенести нові факти у warehouse з контролем grain, currency, duplicates і completeness.
- [ ] Виправити source measurement timestamps та окремо зберігати processing timestamps.
- [x] Локально виправлено connected Google null→0 / daily active users UI й adapters у phase 1; SQL design NOT APPLIED, інші legacy джерела поза фазою.
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
# Stabilization verification — 2026-10-21

Історичний стан до релізу: [STABILIZATION-2026-10-21.md](STABILIZATION-2026-10-21.md). Актуальний LIVE-статус v1 і production commit наведено на початку цього документа. Єдиний lockfile: `web/package-lock.json` (npm).
