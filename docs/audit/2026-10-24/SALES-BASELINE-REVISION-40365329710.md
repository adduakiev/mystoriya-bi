# Sales Overview comparison baseline — issue #43 / existing PR #44

Bounded P1 scope supplied by the trusted trigger for
[review comment 6422318073](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6422318073).
Trusted run: [40365329710](https://github.com/adduakiev/mystoriya-bi/actions/runs/40365329710).
The broader audit is INCOMPLETE; this report is preview code evidence only.

## Exact source and handoff

Before editing, `git archive 02fbb6d2f9ec90011ed68ab38e883a8f1364f563 | tar -xf -`
materialized the existing PR HEAD. Extraction reported read-only `.agents` file
and timestamp errors. All 268 PR-tracked file blobs were then compared with
`git hash-object`: zero mismatches, including the unchanged `.agents` files.
Executable modes also match. The read-only diff contained no PR-removed paths.
The verified overlay is complete despite the initial tar exit code 2.

Git metadata remains at the runner's initial main checkout
`4f0cfcec48408428d51ee916cb87a97a256e4807`; no checkout/reset/commit/push occurred.
PR-added overlay files appear untracked relative to main. A plain Git diff
against PR HEAD omits those files, so filesystem hashes were used to verify the
overlay. Existing PageSpeed/D05/D22/D23/Meta source files remain byte-identical
to the requested PR HEAD.

The outer Actions workflow owns WORKING acknowledgement, deterministic checks,
candidate commit/push and same-PR publication. No GitHub status was posted from
Codex. A read-only attempt to retrieve the linked comment failed because
`GH_TOKEN` is unavailable; acceptance and production observations below are
relayed from the supplied trusted trigger, not independently fetched.

## Reproduction and presentation change (D24)

At `/?year=2025&location=Черкаси`, the trigger reports 2025 revenue 1,446,111.70,
3,724 checks and 139 rows, versus zero 2024 rows. No production SELECT was run
here. Static reproduction independently confirms that `pctDelta` returns null
for a zero denominator, while `buildSignal` replaced it with zero and displayed
`Позитивна динаміка` and `+0.0%` for revenue, checks and AOV.

`buildOverviewSignal` now inspects the raw nullable RPC metric fields before
`toMetricSet` normalizes them. Each percentage requires both numeric operands
and a nonzero baseline. Missing/zero previous metrics display
`немає зіставної бази`; missing current fields with a valid baseline display
`дані відсутні`. An unavailable revenue comparison receives a neutral title.
Equal measured values display `Без змін обороту` with a valid zero percentage.
Positive/negative comparisons and the measured markup deterioration warning are
preserved. Unknown markup cannot trigger that warning. The Overview fallback
reuses this signal helper after building its snapshot; other tabs and legacy
analytics calculations are unchanged.

SQL, migrations, RPC arguments, caches, aggregation, KPI values, filters,
growth drivers and source normalization are unchanged. The existing RPC
coalesces empty sums and exposes no separate current/prior row counts. This
presentation fix cannot recover SQL-erased missingness or establish completeness;
zero baselines remain non-comparable even if measured. Broader D04 stays OPEN.
Measured current zeroes with a nonzero baseline retain -100% comparisons;
explicit zero-valued current rows are exercised in the fallback regression.

## Deterministic verification

- `npm ci --prefix web`: PASS, 71 packages installed.
- `node --experimental-strip-types web/tests/overview-baseline.test.mjs`:
  PASS, 27 tests covering 0/0, positive/0, missing/null/invalid previous fields,
  missing current, valid positive/negative/unchanged, measured current zero,
  field-specific baselines, numeric strings, markup warning and fallback.
  Actual-page SSR checks selected 2025/Черкаси plus month/comparison RPC bindings.
  Network fetch is denied; chart/Sidebar components are stubbed.
- Original-code check in a separate disposable copy: replace only the adapter
  with its exact original PR HEAD version. All five selected zero/missing-prior
  actual-page SSR cases fail on the false-positive rendered title. Revised
  code passes all 27 cases. This is synthetic regression proof, not live parity.
- Workspace `npm run check`: FAIL, 23 test files pass and three fail because
  `.agents/runtime` cannot be created under the read-only `.agents` mount
  (`.agents/run.test.mjs`, `operating-tasks.test.mjs`, `operating-v2.test.mjs`).
  TypeScript/build are not reached by this command. Standalone workspace
  TypeScript `--noEmit`: PASS.
- Full `npm run check` in `/tmp/issue43-40365329710-check-6a6mmz5c`: PASS,
  all 26 test files, TypeScript and optimized Next.js build. All 268 PR source
  paths plus the new regression test were copied and verified byte-identical;
  dependencies were reused, runtime/build artifacts stayed in the copy.
  Final report/discrepancy documentation was added after that successful run;
  application and test source did not change afterward.
- Static RPC lineage hash refreshed with `node scripts/bi-audit-contracts.mjs`;
  this records the changed adapter source only and proves no deployed parity.
- `git diff --check` and whitespace checks of changed/new text files: PASS.
  Inventory, RPC lineage and 66-case QA plan reproducibility checks: PASS.

All 66 authenticated browser cases remain NOT_EXECUTED. No new screenshots,
authenticated preview, upstream reconciliation or production correctness is
claimed. `docs/PROJECT-STATUS.md` is preserved from the requested PR HEAD because
this bounded task establishes no new production status evidence. No SQL or
migration change, deployment, credentials, paid service, scheduler, business
write, advertising change or SYRVE mutation was performed. Owner action NONE
for this preview fix; release and data-write gates remain separate.
