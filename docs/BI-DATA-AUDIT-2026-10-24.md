# М'ЯСТОРІЯ BI — повний source/code inventory, аудит #43 від 24.10.2026

2026-11-11, D289 issue #43 / #48 / same PR #44:
[Glovo column I correction and evidence limits](audit/2026-10-24/GLOVO-D289-CONTRACT-2026-11-11.md).
Owner-connected-reader evidence reports native numeric 1/0 under UNFORMATTED_VALUE;
the pure contract now normalizes only these and booleans. Missing measures remain
null; no runtime provider or live reconciliation is established. Earlier D288
boolean-only/source-shape-unverified descriptions below are historical.

2026-11-11, D288 issue #43 / #48 / same PR #44:
[Glovo scoped preview addendum](audit/2026-10-24/GLOVO-D288-PREVIEW-2026-11-11.md)
and [per-block matrix](audit/2026-10-24/glovo-d288-inventory.json).
New `/aggregators/glovo` report is SOURCE UNAVAILABLE with no business values;
private source integration and source/SQL/UI reconciliation remain blocked.
Synthetic contract/SSR evidence is distinct from live data and authenticated
Preview QA. Jan–Oct default excludes partial November. No Sales recovery,
production data, SQL or release gate changed; broader audit remains incomplete.

2026-11-04, issue #43 / same PR #44: [coordinated Sales release checklist](audit/2026-10-24/SALES-RECOVERY-RELEASE-CHECKLIST-2026-11-04.md).
Repository contract audit identifies incompatible SQL alternatives and the missing
production success/attestor API. A separately signed, owner-approved transition
may retain the October-26 warehouse as **legacy unverified**; it cannot authenticate
unknown historical source bytes. One-shot readonly header-probe code is prepared. A proposed workflow-dispatch
change was rejected by GitHub workflow permissions and NOT published; exact-SHA
PG16/PG17 acceptance must use the existing authorized CI mechanism. No real secret,
source probe, production backup, SQL installation, release or live correctness
is verified. Keep the 503s/manual control closed; precise owner and code blockers
are consolidated in the checklist. Earlier entries below remain dated evidence.

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

2026-11-03 bounded P0 continuation, same PR #44: [synthetic restore and rollback readiness](audit/2026-10-24/SALES-RESTORE-READINESS-2026-11-03.md).
Prepared one fail-closed native two-cluster backup/restore test with bounded
schema/data/sequence/historical-identity/exact-cent parity and failure/cancellation
checks. Added a repository-grounded writer/grant inventory and ordered owner-only
cutover/rollback prerequisites. Local socket EPERM prevents restore execution;
trusted runner proof is pending. Production backup/restore NOT PERFORMED, no new
source/grant observations, SQL still NOT APPLIED, both runtime 503 guards intact.
NOT READY FOR GATE; no broad audit completion is claimed.

2026-11-03 bounded P0 continuation, same PR #44: [accepted-source transactional gate](audit/2026-10-24/SALES-ACCEPTED-SOURCE-GATE-2026-11-03.md).
Original prepared SQL cannot emit the next accepted-source baseline. Without an
approved DB-authenticated attestor/root, a separate NOT APPLIED overlay rejects
all evidence and closes the old commit route in disposable tests. Persistence,
immutable receipts and authenticated success/readback remain a precise release
gate, not a completed implementation. Original atomic happy-path tests retained;
production/503 guards untouched. No live reads or historical metadata backfill.

2026-11-03, issue #43 / existing PR #44: [typed private Sheets capture preparation](audit/2026-10-24/SALES-SHEET-CAPTURE-PREPARATION-2026-11-03.md).
An isolated server-only adapter retains typed cells, in-memory original JSON
body bytes/fingerprint and fixed request metadata before reader coercion.
Synthetic evidence only; no live observations or legacy authenticity claims.
Dispatch reports trusted base `c0dcc6b98d5f33074d76c090074480c46adf007b`,
Actions 41562042936 PASS (494 native tests, zero skips); new candidate checks
remain separate. Both unconditional 503 guards and NOT APPLIED SQL are intact.
**NOT READY FOR GATE**; broad audit incomplete and all owner gates remain held.

2026-11-03 bounded P0 continuation: [atomic transport/baseline preparation](audit/2026-10-24/SALES-TRANSPORT-PREPARATION-2026-11-03.md).
Exact-body server transport is opt-in and unreferenced; accepted-source minDate
provenance is absent from current writer contracts and fails closed. Original
manual 503 gates and NOT APPLIED SQL remain intact. The trigger's trusted green
base receipt supersedes earlier sandbox-only failures for that base; candidate
checks are separate. No new live reads or source/warehouse/UI parity is claimed.
The full audit remains INCOMPLETE; release/backup/rollback gates remain closed.

D284 bounded follow-up (2026-11-10): [stable full-ID profile labels](audit/2026-10-24/GBP-D284-IDENTITY-2026-11-10.md)
supersede the historical suffix expansion below. Address crosswalk remains
unverified; source data and metrics are unchanged. Native OUTER checks and
Preview acceptance remain separate and pending; broader audit INCOMPLETE.

D26 bounded follow-up (2026-10-27): GBP duplicate profile titles now use
ID-derived labels with accessible full IDs in preview code. Verified address
crosswalk remains UNKNOWN; all 66 authenticated browser cases NOT_EXECUTED.
See [D26 evidence and handoff](audit/2026-10-24/GBP-IDENTITY-REVISION-40444470576.md).
The full audit remains INCOMPLETE; earlier receipts below are historical.

## Sales Overview selected-period guard — 2026-10-26 (preview code)

[Bounded P1 report](audit/2026-10-24/SALES-PERIOD-REVISION-40387333537.md)
continues exact existing PR #44 HEAD `de9f9f0245e72889b2abbb2bb7cd3093dac70887`.
The Overview adapter rejects missing/invalid cutoffs and requested/selected
period mismatches before metric normalization. The actual page shows explicit
NO DATA / UNKNOWN, keeps selected filters/navigation, and mounts no KPI/chart,
comparison, table, driver or signal from the rejected payload. Known mismatches
never enter legacy fallback. Valid periods and the earlier baseline fix remain.
Evidence is deterministic synthetic adapter/actual-page SSR, not live parity.
The reported installed SQL fallback is unchanged; future SQL fix NOT APPLIED.
All 66 authenticated browser cases remain NOT_EXECUTED; broader audit INCOMPLETE.
The trusted runner owns WORKING acknowledgement, exact new SHA and same-PR #44
publication. Owner action NONE for this preview change.

## Sales Overview baseline signal — 2026-10-26 (preview code)

[Bounded P1 report](audit/2026-10-24/SALES-BASELINE-REVISION-40365329710.md)
continues exact PR #44 HEAD `02fbb6d2f9ec90011ed68ab38e883a8f1364f563`.
The Overview signal now explicitly labels zero/missing comparison baselines,
without invented positive or flat growth. Valid percentages, measured current
zeroes and the markup warning remain supported. This changes signal presentation
only, including the Overview fallback; SQL/aggregation and broader D04 remain
unchanged. Evidence is deterministic unit/actual-page synthetic SSR, not a new
production SELECT or authenticated browser result. All 66 authenticated cases
remain NOT_EXECUTED; broader audit INCOMPLETE. The trusted runner owns WORKING,
checks and publication to existing PR #44. Owner action NONE.

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

## Historical bounded SELECT-contract follow-up — Actions 40206730240

Requested PR #44 base `922d04d2afec8181ab17e175b582e113c95c5c17` preserved.
[New dated report](audit/2026-10-24/GOOGLE-ADS-DAILY-RECONCILIATION-2026-10-25.md)
records trusted-trigger independent evidence: UTC 2026-10-12..24 Google Ads raw
157 rows / 13 dates → curated 13 / 13; date FULL OUTER JOIN 0 missing groups,
0 daily mismatches for cost/clicks/impressions/conversions/value; 0 duplicate raw
(date,account_id,campaign_id) groups. Reproduction SELECT tested on synthetic
local PostgreSQL only; no warehouse/RPC execution. Raw date/conversions_value
and curated date_id/conversion_value schema distinction is explicit.
Shifted UTC 2026-09-25..10-24: GA4 30/30, GSC 28/30 through 10-22, Ads 13/30
since 10-12 (13/13 onboarded dates). Earlier GSC 29 rows / 29 observed dates
belongs to 09-24..10-23 with **30 expected dates**; historical receipts unchanged.
Upstream/currency/account/action attribution/timezone/RPC/UI UNKNOWN; D06 OPEN,
D22 fail-closed. **66 browser cases NOT_EXECUTED**, exact-SHA authenticated gate
6398044302 remains open. NOT READY FOR GATE. Owner action NONE for code/docs/tests.
See [handoff](audit/2026-10-24/HANDOFF.md) for runner-only publication constraints.

**Статус: preview revision підготовлено для review; production audit acceptance INCOMPLETE.**
Bounded Barbara stored evidence підтверджує лише наведені coverage та Meta key/metric
checks. All-field/upstream/RPC/rendered UI parity **UNKNOWN**. Історичний protected-preview
403 reported resolved у trigger 26.10; browser QA **NOT VERIFIED**, бо 66 кейсів
не виконано. Поточні sandbox blockers наведено в latest QA report; owner action **NONE**.

## Historical ROAS revision PR #44 — Actions 40193841845

[Trusted run](https://github.com/adduakiev/mystoriya-bi/actions/runs/40193841845),
[CHANGES REQUESTED](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6397712491).
Recovered `ac64aad96628da197a3e02fd0d12e33cb324e3b1` source preserved.
D22 suppresses Google Ads aggregate/campaign/overview numeric ROAS and comparative
value/spend signals until verified same-account/same-currency evidence exists.
Counts/CTR, null versus measured zero, existing money guard, Meta USD/nulls,
App/Merchant and sidebar fixes preserved. No SQL or production fields invented.
Latest independent read-only receipt 2026-10-25: fixed UTC 2026-09-24..10-23
GA4 30/30, GSC 29/29; staging Google Ads zero currency columns. Earlier GSC
28/28 below remains dated historical evidence. No upstream parity fabricated.
See [revision and receipt](audit/2026-10-24/GOOGLE-ADS-ROAS-REVISION-40193841845.md)
and [checks](audit/2026-10-24/verification.json). Browser 66 cases NOT_EXECUTED;
no authorized session. WORKING publication unavailable (gh exit 4, no auth);
trusted runner owns existing PR #44, status posts and actual commit/push SHA.
Owner action NONE for code-only. The following revisions are historical.

## Historical currency revision PR #44 — Actions 40186524170

[Trusted run](https://github.com/adduakiev/mystoriya-bi/actions/runs/40186524170),
[CHANGES REQUESTED](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6396721960).
Existing PR HEAD `7cbe56147f5a65eeeda1136b0f63627e64bd3542` restored over runner
checkout `4f0cfcec48408428d51ee916cb87a97a256e4807` with `git apply`;
runner branch `astra/issue-43-40186524170`. No index/ref/commit/push changes.
D21 fixes inferred UAH across Google Ads KPI, campaigns, trends and overview;
current RPC has no currency, so money is withheld as `currency UNKNOWN` and
monetary trends are suppressed. Count-only zero-conversion observations replace
the unsupported 500 threshold and campaign spend sum; no budget ranking.
App shared currency guards, Meta USD/null/status, sidebar fail-soft/Suspense and
prefetch changes are preserved. D06 source grain remains OPEN; no source fields,
SQL, migrations or live observations added. The broader audit remains INCOMPLETE.
See [currency revision](audit/2026-10-24/GOOGLE-ADS-CURRENCY-REVISION-40186524170.md)
and [current verification](audit/2026-10-24/verification.json).
WORKING post attempted via `gh api`: exit 4, no configured GH_TOKEN; runner must
publish status and actual full pushed SHA to existing PR #44. Owner action NONE.
The following dated revision narratives and check tables are historical receipts.

## Historical revision PR #44 — Actions 40140314226

Current run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40140314226.
Existing PR: https://github.com/adduakiev/mystoriya-bi/pull/44; no duplicate PR.
[Current CHANGES REQUESTED](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6390540921)
requirements supplied in trusted trigger; remote fetch unavailable (`gh` exit 4,
no configured authentication). WORKING post attempted with current run URL and
failed for the same reason; trusted runner must publish it. Code work can proceed.
Preserved exact PR source HEAD: `bd126b802068553dc45194bfb8429516c7bc2569`.
Checkout HEAD: `4f0cfcec48408428d51ee916cb87a97a256e4807`, branch
`astra/issue-43-40140314226`. Existing PR diff restored from local Git object with
`git apply`; read-only `.git` prevented `git restore` index lock, no refs changed.
Target handoff: `astra/issue-43-40107435112`, existing PR #44 only.

**CODE/DOCS TESTED:** focused tests and full writable-copy checks passed; see verification.json.
**END-TO-END AUDIT NOT VERIFIED.** New [machine-readable contract lineage](audit/2026-10-24/rpc-contract-lineage.json)
connects six representative KPI paths: Sales, GA4, GSC, Meta, Google Ads App and
Merchant. It records repository function signatures, effective volatility,
SECURITY DEFINER, repository-only SHA-256 fingerprints, JSON keys, adapters, UI
bindings, grain/window limits and separately attributed reviewer metadata.

Checked-in functions default to VOLATILE and explicitly use SECURITY DEFINER;
reviewer metadata reports the same attributes. This is agreement on reported
attributes only. Exact deployed signatures/definitions/hashes were not supplied:
**deployed-function parity UNKNOWN** for every representative path. Repository
hashes with comments removed are not PostgreSQL canonical/deployed hashes.
App deployed RPC references Google Ads staging and lacks currency **per current
review**, consistent with repository logic; exact body parity remains UNKNOWN.
App repository grouping loses account/campaign ID/date/currency; synthetic
collision regressions demonstrate the loss without pretending to repair SQL.

Safe preview improvements: reject unsupported currency codes (D19), preserve
Meta attribution suppression, test actual caller filter/date mappings through
shared pure argument builders, and replace the unsafe RPC-invocation diagnostic
with catalog-only `pg_proc` metadata inspection (D20). No payload RPC is invoked,
even on disposable fixtures in this revision. Prior fixture receipts remain
historical. Merchant/App guards and independent 2026-10-25 bounded receipts retained.

Unresolved access/evidence: an existing authorized reviewer can provide catalog
metadata plus exact definition/hash receipts without invoking payloads. Upstream
completeness needs same-window source totals, pagination and field semantics.
Business timezone needs source-owner attestation. Protected Vercel browser QA
needs an existing authorized operator/session and exact revision URL/SHA plus
BI role access. No protection/credential/permission change is authorized. Prior
reported 403 stands; **66 cases NOT_EXECUTED**, screenshots [], runtime/role/filter
and rendered-value parity unverified. No owner action required for code revision;
merge/deploy/migration/business-write gates remain separate.

**Post-handoff confirmation dated 2026-10-25:** prior trusted Actions run
40131698750 WORKING/Codex/checks/commit/push **PASS**. GitHub Actions pushed
`485c5a5d16c18a56b286e167f05749b51db0c365`; existing PR #44 was recovered to that HEAD;
exact-SHA Vercel **READY**. [Separate receipt](audit/2026-10-24/POST-HANDOFF-2026-10-25.json).
This confirmation comes from the trusted trigger, not a fresh Codex API query.
Earlier local PENDING/UNKNOWN remains historical, not a current-global outcome.

Protected preview **403**, no screenshots/navigation, browser **NOT VERIFIED**.
Current revision SHA/CI/deployment belongs to the runner after checks/commit/push;
source-SHA READY is separate. Codex performs no commit/push. WORKING post failed as recorded above. Current
WORKING/final posts are delegated to trusted Actions with the current run URL.
Temporary branch recovery to existing PR #44 is not a user blocker.

| Acceptance revision | Результат / межі |
|---|---|
| GA4 coverage | 2026-10-25 Barbara SELECT-only rows/dates current30 30/30, prior30 30/30, trailing365 365/365; current30 null core metric rows 0 |
| GSC coverage | 2026-10-25 rows/dates current30 **28/28** (30 expected), prior30 30/30, trailing365 363/363 (365 expected); current30 null core metric rows 0 |
| Earlier Meta bounded key metrics | 2026-09-24…10-23: 138 USD groups raw/curated; FULL OUTER JOIN account_id/campaign_id/date/account_currency: 0 missing sides; 0 multiplicity/spend/clicks/impressions mismatches |
| Evidence limits | Meta Gate D rolling 145/26 — separate scope; all-field/upstream/RPC/UI UNKNOWN, no zero-fill |
| Merchant / App | Nullable Merchant tests збережено; App source currency UNKNOWN, source-contract design NOT APPLIED |
| Preview / handoff | Exact source SHA READY; browser 403 NOT VERIFIED; new revision CI/SHA/remote READY post pending runner |
| Follow-ups | D04–D11 OPEN; owner action NONE |

## Докази та межі

[Датований redacted receipt](audit/2026-10-24/REVIEWER-EVIDENCE.md) transcribes лише
явні Barbara SELECT-only результати latest trusted trigger, new verification 2026-10-25 plus separately attributed earlier receipts.
Codex production SQL не виконував. Full query text, exact execution timestamp,
account timezone та every-field completeness receipts не supplied. Meta matching
multiplicity не доводить унікальність keys. Explicit prior30/365 row counts are now supplied; date coverage and counts do not prove
upstream completeness. Earlier dated Sales 966 rows/29 dates, Google Ads daily
12/12 and GBP 48/12 restored from comment 6388338141, not newly queried.
New Meta counts/dates/spend: 138 raw/curated rows, 25 dates, 1311.75 USD each;
the 138-group key join remains earlier evidence, not newly executed. Source latest event timestamp не виводиться
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
| [rpc-contract-lineage.json](audit/2026-10-24/rpc-contract-lineage.json) | Six representative KPI contracts, repo signatures/fingerprints, reviewer metadata, adapter/UI bindings; deployed parity UNKNOWN |
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
виконує table diagnostics та catalog metadata лише на disposable synthetic fixtures; payload RPC не виконується.
[SQL receipt](audit/2026-10-24/sql-validation.json) описує обсяг.
[rpc-read-only-qa.sql](audit/2026-10-24/rpc-read-only-qa.sql) тепер містить
лише catalog metadata SELECT. Попередній date-filtered payload-invocation дизайн
WITHDRAWN. READ ONLY не дає дозволу викликати VOLATILE/SECURITY DEFINER RPC.
Жоден production SQL або RPC у цьому runner не виконувався.

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
| D05 | P1 OPEN | Однаковий фільтр або явні різні windows → Digital from/to змінює GA4/GSC, Ads/GBP loaders без date args. Bounded preview now labels independent source windows and UNKNOWN completeness/freshness; authenticated verification OPEN. Live discrepancy amount UNKNOWN |
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
Current check commands/results are recorded in `verification.json`; prior local
results remain in `verification-history-40135370633.json`. Independent production
receipts dated 2026-10-25 remain unchanged. Do not use earlier check results as
proof for this revision. CODE/DOCS TESTED and END-TO-END AUDIT NOT VERIFIED are
separate outcomes. All 66 browser cases remain NOT_EXECUTED; historical protected
preview 403 does not prove any new revision's deployment state.

| Current check | Result |
|---|---|
| `npm ci --prefix web` | PASS; 71 packages |
| Focused contract/audit/Merchant/PostgreSQL/Meta checks | PASS; 5 test files, no skips; seven new contract subtests |
| Workspace `npm run check` | 12 files PASS, 3 runtime-writing files FAIL due to sandbox `.agents/runtime` restriction; TypeScript/build not reached |
| Writable same-source `/tmp/issue43-40140314226-check-0pmmn6wg`: `npm run check` | PASS; all 15 test files, TypeScript and optimized Next.js build |
| Inventory/query/contract generator `--check` | PASS; 6 KPI contracts, 22 pages, 7 API routes, 742 visual/control templates |
| `git diff --check` + every untracked file whitespace check | PASS |
| Matrix generation | 66 cases; zero executed; no screenshots |
| Live SQL/RPC, upstream/rendered parity | NOT EXECUTED / UNKNOWN |

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

## D243 — private capture → disposable v234 contract (PREPARE ONLY)

Initial local HEAD independently matched trusted outer baseline
`8c5ea13c323bd358197198194d3606776496dfe3`; checkout was clean. No inner remote
authentication/DNS check, nested job, commit, push or PR creation was attempted.

The existing native `sales-release-v234-postgres.test.mjs` now obtains every
candidate through the prepared typed Values API capture, using a hermetic OAuth
endpoint that verifies the ephemeral RS256 JWT, pinned account/scope/range and
returned bearer token. The test-only custodian signs the canonical captured bytes
with an ephemeral Ed25519 key. Preparation and provenance consume that same frozen
capture through the existing canonical typed projection, preserving numeric tags,
Unicode, aliases and exact cents without parsing the monetary SQL payload into JS
numbers. No production bridge or runtime change was necessary.

The disposable native test asserts source/manifest/mapping/warehouse SHA-256 parity,
SQL receipt fields, canonical fact readback, source cutoff and receipt/history
agreement. Existing protected dimensions, all three MV totals, independent SCRAM
LOGIN reviewers, immutable retry, generation/sequence/default-ID parity, ISO-year
boundary rejection, transactional rollback and native protected dump/restore checks
remain mandatory. Capture failures additionally compare the complete SQL catalog,
rows and sequences before/after, including synthetic authority registration.
Missing auth, Google 401, deterministic mid-stream abort, numeric precision loss,
sub-cent amounts, fractional checks, missing metrics, unmapped alias, stale/empty/
current-day source, signed snapshot replacement, mismatched manifest and delayed
review replay must fail before promotion writes. Only synthetic fixture authority
rows are seeded; production prior receipts and historical genesis are never invented.

Local verification on 2026-11-05: `npm ci --prefix web` passed; the selected hermetic
capture and rollback-default tests passed (2/2, zero fail/skip); TypeScript and the
optimized Next.js build passed separately. Existing prepared capture/provenance/
cutover/release tests also passed (51/51, zero fail/skip). Full `npm run check` was attempted and
failed under sandbox capabilities. The concrete native blocker is PostgreSQL
16.15 startup: `could not bind Unix address ... Operation not permitted`, followed
by `FATAL: could not create any Unix-domain sockets`. Other full-suite tests also
cannot create the sandbox-protected `.agents/runtime` directory. No socket bypass,
single-user substitute, test skip or weakened assertion was introduced.

**BLOCKED for native acceptance / publication:** the trusted outer runner must run
the unchanged mandatory full check on native PG16 and inspect these exact changes
before any branch publication. This note claims no D243 native parity PASS. After
publication, exact-published-SHA PG17 and Vercel remain independent next gates.
OAuth signatures here authenticate only synthetic test bytes; they do not grant
production source-attestor authority. One exact incompatible root binding remains:
the JS verifier requires the `sales-prior-receipt/v1` tuple digest, whereas SQL
history uses `sales-release-receipt/v234` with SQL binding/result and a synthetic
prior. The regression rejects the synthetic genesis (and, in the mandatory native
phase, the SQL receipt) as `SALES_PROVENANCE_PRIOR_RECEIPT`, even if wrapped in a
valid-looking `atomic-accepted/v1` record. No translation grants production trust.
Owner-approved historical genesis, independent
production attestors, source credentials, real protected backup/rollback, compatible
SQL/Edge cutover, source→warehouse→RPC→UI and authenticated desktop/mobile QA remain
future gates. Prepared `release()`/`refresh()` still throw, active Edge/Next POST
remain 503 and refresh UI remains disabled. SQL stays rollback-default NOT APPLIED;
no real source fetch, database migration, backup, import or business write occurred.

## D246 — signed capture → sealed attestor handoff (PREPARE ONLY)

Initial local HEAD matched trusted outer baseline
`429db79b60f9c5c52098643381580f60ef837196`; worktree was clean. The outer
PR/open/unmerged/expected-SHA gate is authoritative; no inner remote check,
commit, push, new job, migration or deployment was attempted.

Changed paths: private `prepared-sales-attestor-handoff.mjs`, existing native
`web/tests/sales-release-v234-postgres.test.mjs`, and this note. No SQL draft,
workflow, active Edge/Next route, UI or production configuration changed.
The new pure server-only builder has only `prepare()`, accepts independently
pinned synthetic policy, and always returns **BLOCKED**. It embeds no keys or
credentials and has no network, environment, database, signing or release path.

Signature contract: UTF-8 JSON tuple `sales-signed-handoff-observation/v1`, ordered
pinned context, ordered observer roster, canonical typed source text, observer ID,
and observation time. Context binds version/project/source/range, run, prior root,
generations, cutoff, immutable expiry, previous baseline and aliases. Each roster
entry binds observer ID, separately authenticated proposed PostgreSQL LOGIN,
independence group and SHA-256 of public SPKI bytes. Two distinct keys/groups/IDs/
LOGINs and fresh ordered signatures must verify against ONE captured snapshot.
The private packet includes that context/roster/source, derived v234 binding,
exact manifest/payload TEXT, payload SHA-256 and signed observations. Monetary SQL
text is never parsed into JS floating point. Source/manifest/mapping/warehouse
hashes use existing contracts. Packet digest hashes exact UTF-8 packet text;
SQL binding digest separately hashes PostgreSQL `jsonb::text`. These are distinct
contracts, explicitly checked by the new disposable test. Packets contain private
values/signatures: never log, persist as artifacts, or serve through UI/API.

Regression coverage adds tampered/substituted signatures, keys, reviewer mapping,
duplicate/nonindependent/stale observers, project/source/range/root/generation/
expiry/alias/cents/cutoff changes, correctly signed stale/unmapped source, mutable
caller substitution and cancellation. The native addition compares complete
catalog/rows/sequences before any authority registration after preparation
rejections, then requires actual ephemeral SCRAM LOGIN receipts over identical
protected packet/binding bytes, rejects changed SQL packets/bindings and the
unauthorized caller, checks immutable receipt retry, and rehearses v234 promotion
and concurrent requests under rollback. Existing native late cancellation,
expiry, stale-generation, ACL/RLS, dimensions/facts/three-MV/history/sequence/default
ID and restore regressions remain mandatory. Native assertions are **NOT locally
proven**; see acceptance blocker below.

**Exact missing owner-only policy:** an approved historical genesis/receipt format
and transition from JS `sales-prior-receipt/v1` to SQL
`sales-release-receipt/v234`; independently provisioned public-key fingerprints →
authenticated reviewer LOGINs/independence groups; and an authenticated attestor
that verifies this signed packet and pins its bytes, root, generation and absolute
expiry before registering any SQL authority/receipt. Existing SQL authenticates
LOGINs and protected binding equality, but does not verify Ed25519 or enforce the
proposed fingerprint→LOGIN mapping. This patch deliberately does not install that
missing service/policy or reinterpret a synthetic receipt as accepted real prior.
A synthetic packet plus fixture owner registration is NOT a production trust bridge.
`release()`/`refresh()` still throw; Edge/Next POST stay 503 and manual refresh stays
disabled. All SQL remains rollback-default NOT APPLIED.

Local verification (2026-11-05): `npm ci --prefix web` PASS; focused hermetic
capture/handoff/rollback tests 3/3 PASS, zero fail/skip; existing prepared capture,
provenance, cutover and release regressions 51/51 PASS, zero fail/skip; TypeScript
PASS. Full `npm run check` FAILED in sandbox (native socket/runtime capabilities).
Direct native PG16.15 test reproduces `could not bind Unix address ... Operation
not permitted` / `FATAL: could not create any Unix-domain sockets`, before the new
SQL assertions run. Full-suite runtime tests also cannot create protected
`.agents/runtime`. No bypass, substitute DB or skip was added. Optimized Next.js production build
PASS; `git diff --check` PASS. These separate checks do not replace full native
outer acceptance.

**BLOCKED for native acceptance/publication; PREPARE ONLY / NOT READY FOR GATE /
NOT RELEASED.** Trusted outer runner must run the final changed files through full
native PG16 verification with zero fail/skip and independent review before its
same-PR expected-SHA handoff. No new published SHA/job/test receipt is claimed here;
exact-published-SHA PG17 and Vercel are subsequent independent gates.

## D250 — recovered D248 verifier + negative-test correction (OFFLINE PREPARE ONLY)

Initial local HEAD was exactly `c8b59c87bc5104e00d8d5361aa4d0b9591fb1077`
with a clean worktree on `astra/issue-43-40107435112`, matching the authoritative
outer PR #44 OPEN/unmerged/branch/SHA gate supplied with D250. No competing Astra
process was visible in the sandbox; the outer gate owns remote/concurrency checks.
WORKING was acknowledged before implementation. The supplied eight-hunk D248 diff
passed `git apply --check` and was applied verbatim with `git apply`. All three
pre-correction Git blob hashes matched exactly:

- This note: `952521e781279f4ba0775974b9f189521fd4e0b1`.
- Verifier: `6f1edadf49b38e925b7c4e0eb99af67846f3aa2f`.
- v234 test: `89d47bf6b36c424de8ae22e8024dfc0e0a75d7f2`.

Only those three paths change. The recovered verifier remains byte-for-byte
unchanged. The sole mutant correction changes generation to `'3'` when it is
already `'2'`, otherwise to `'2'`; the focused hermetic verifier fixture now uses
base generation `'1'` / generation `'2'` to reproduce the reported native case.
Every negative packet mutation in the verifier defect helpers has explicit
pre-rejection assertions for byte difference and its named malformed condition,
including lexical defects and authenticated/re-signed bad captures. Re-signed
packets are checked again after signing; manual mixed-observation and substituted
fingerprint packets also assert the intended change. Assertions print only defect
labels, never packet contents. No other mutant was corrected, skipped or accepted,
and no verifier check was weakened.

No commit, push, remote check or new workflow was attempted; the trusted outer
runner owns the same-branch expected-SHA handoff after its required gates.

The new pure verifier does not import the handoff builder. Its separately supplied
**synthetic-only** policy pins project/source/range, supported versions, run,
prior root, generations, cutoff, expiry, baseline, aliases, immutable source digest
and exact observer → public-SPKI fingerprint → independence group → proposed SQL
LOGIN mapping. It checks raw packet SHA-256 and fatal UTF-8 decoding, strict ordered
JSON/source roundtrips (including duplicate-key/escape/number/Unicode ambiguity),
two distinct fresh Ed25519 observations, and independently derives the exact
manifest, payload and source/mapping/warehouse digests from one copied capture.
Packet flags, packet roster and transport digest confer no authority. It has no
network, DB, environment, signing, storage or writer capability and returns only
**BLOCKED**, including after valid verification. Private packet/signature/source/
key material must never be logged, served or persisted as CI artifacts.

The authenticated LOGIN input is explicitly a trusted connection read of
`session_user` and `current_user` before role changes, not client metadata. The
pure module cannot authenticate that connection itself. Its injected clock must
likewise come from the independently trusted verifier, never packet/HTTP/client
metadata. The disposable native regression reads those values over existing
actual ephemeral SCRAM LOGINs,
verifies before fixture target/authority registration, and compares SQL receipt
LOGIN/group/binding/packet digest against independently pinned verifier output.
It recomputes the SQL receipt digest and requires identical retry receipts.
Tampered packets, mismatched keys/groups/LOGINs, replay from another run/root,
stale/expired observations, invalid UTF-8, canonical ambiguities, mutable inputs
and cancellation reject before first SQL write. Directly re-signed stale,
unmapped and sub-cent captures test verifier derivation without relying on builder
rejection. Complete catalog/rows/sequence snapshots cover rejected prewrites and
existing rollback rehearsals of facts, dimensions, three MVs, history, RLS/ACL
and IDs. These new native assertions remain unproven locally (blocker below).

Exact current-run retries are intentionally immutable/idempotent, not a new
authorization. This stateless offline verifier provides no consumed-token store;
any future service must independently authenticate its connection, reload current
generation/root/expiry and retain protected SQL replay checks. No service or real
provisioning is installed here. **Owner-approved historical genesis/receipt format
and independently provisioned fingerprint-to-LOGIN/independence policy remain
BLOCKED.** A synthetic SQL target or receipt cannot establish either authority.

D250 local verification on 2026-11-05 (sandbox receipts, not trusted OUTER
native acceptance):

- `npm ci --prefix web`: PASS (exit 0).
- `node --test --test-isolation=none --test-reporter=tap --test-name-pattern='hermetic private|independent offline|sealed handoff|v234 draft' web/tests/sales-release-v234-postgres.test.mjs`:
  **4/4 PASS, zero fail/skip**, including generation `'2'` negative inputs.
- `npm run check`: **FAIL** (exit 1), 56 file-level results: 46 pass / 10 fail /
  zero skips; execution stopped before TypeScript/build. Runtime tests include
  `ENOENT` creating the sandbox-protected `.agents/runtime/`. These counts are
  not the OUTER native test-count receipt.
- Direct `node --test --test-isolation=none --test-reporter=tap web/tests/sales-release-v234-postgres.test.mjs`:
  4 pass / 1 fail / zero skips. Native PG16.15 fails before SQL assertions:
  `pg_ctl: EPERM`, `could not bind Unix address ... Operation not permitted`,
  `FATAL: could not create any Unix-domain sockets` at 2026-11-05 07:53:16 UTC.
  This is a Codex sandbox socket failure, **not an OUTER failure**.
- Separate `cd web && node node_modules/typescript/bin/tsc --noEmit`: PASS
  (exit 0); `cd web && node node_modules/next/dist/bin/next build`: PASS (exit 0).
  These do not replace the failed full check or required OUTER acceptance.
- `git diff --check`: PASS. Local path/hash/diff review confirms exactly the
  three permitted paths and unchanged recovered verifier; independent OUTER
  actual three-path review remains mandatory and is not claimed complete.

Exact failing logs are preserved locally, outside tracked artifacts:
`/tmp/d250-check.log` (SHA-256
`ee9143b8c4bb90e254d15721f173ba6d51b5202578db760e138509f999f6ec39`)
and `/tmp/d250-native-detail.log` (SHA-256
`600b645e47f54569cccd8719102e021a866483a3e0f1d42b33922f9579101cc5`).
The D250-provided prior OUTER receipt (615 total / 613 pass / 2 fail) describes
the uncorrected generation no-op, not this working tree. No socket/permission
bypass, substitute DB, test skip or weakened gate was added.

**BLOCKED for native acceptance/publication; PREPARE ONLY / NOT READY FOR GATE /
NOT RELEASED.** Full trusted OUTER native PG16 `npm run check` with zero fail/skip
and independent actual three-path review must precede any publication to SAME PR
#44 on the exact starting SHA with lease. Independent exact-published-SHA GitHub
PG16 + PG17 and Vercel checks are separate mandatory subsequent gates. No new
published SHA or OUTER success is claimed. Prepared `release()`/`refresh()` still
throw, Edge/Next POST stay 503, manual refresh stays disabled, SQL remains
rollback-default NOT APPLIED. No active route, SQL, workflow, UI, credential,
scheduler, source fetch or production data changed.
