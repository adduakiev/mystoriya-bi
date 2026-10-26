# Sales Overview selected-period fallback — issue #43 / existing PR #44

Bounded P1 D25, following the trusted trigger for
[review comment 6425393944](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6425393944).
Trusted run: [40387333537](https://github.com/adduakiev/mystoriya-bi/actions/runs/40387333537).
This is preview code and synthetic SSR evidence. The broader audit is INCOMPLETE.

## Provenance and acknowledgement

Before edits, `git archive de9f9f0245e72889b2abbb2bb7cd3093dac70887 | tar -xf -`
restored the exact existing PR HEAD into writable files. Extraction reported
read-only `.agents` paths/timestamps; all 270 PR-tracked file blobs were compared
using `git hash-object` and matched before edits. Executable modes also match;
there are no PR-removed paths. A normal Git diff cannot verify PR-added files
that appear untracked against the main checkout, so content hashes were used.

Git metadata remains at initial checkout `4f0cfcec48408428d51ee916cb87a97a256e4807`,
branch `astra/issue-43-40387333537`. This is not a new candidate commit. The trusted
workflow owns commit/push and same-PR #44 publication; candidate SHA is PENDING.
No checkout/reset/commit/push or duplicate PR was performed by Codex.

WORKING with the trusted Actions URL was attempted first using GitHub CLI.
It failed because GH_TOKEN is unavailable. Remote acknowledgement remains
ASSIGNED / NOT ACKNOWLEDGED until the trusted workflow posts WORKING. The linked
comment was not independently retrieved. Installed SQL catalog/SELECT findings
are relayed from the trusted trigger; they were not rerun here. No credentials
were read, changed or added to overcome the handoff restriction.

## Reproduced discrepancy and change

The trigger reports that installed `bi_overview_payload` is VOLATILE SECURITY
DEFINER and falls back to `v_rows_latest` when no rows match a selected period.
For example, selected Черкаси 2024 with zero rows can return current period
2026-07-14, and selected October 2026 can return July. The checked-in SQL also
contains that fallback, but repository SQL is not proof of installed parity.
No installed RPC, production SELECT or migration was invoked here.

Before this change, `fetchSqlOverview` accepted the selected year separately
from the returned cutoff/current year and normalized the unrelated metrics.
The actual page could render the selected filters alongside another period's
KPI, chart, comparisons and signal. Missing/invalid cutoff could throw
`RangeError: Invalid time value` in SSR date formatting.

The adapter now validates the raw metadata before metric normalization:

- `cutoffDate` must be a real calendar date in exact YYYY-MM-DD form. Missing,
  null, empty, impossible dates and timestamps fail closed.
- Cutoff year, `meta.currentYear` and `meta.selectedYear` must match the requested
  year. Without an explicit year, the returned selected year is the reference;
  the clock does not determine validity.
- Returned `meta.selectedMonth` must match the requested month, and a selected
  month must match the cutoff month. Numeric SQL strings remain supported.

A rejected payload returns a distinct typed unavailable result with no snapshot,
metric series, channel mix or growth drivers. This normal result never enters
exception-driven legacy fallback. The page shows NO DATA / UNKNOWN and explains
that unavailable data does not mean zero. It renders none of the rejected KPI,
share, channel/location, chart, monthly-table, driver, comparison or signal
blocks, and does not format the rejected cutoff.

Selected year/month and dimension options remain in the controls even if the
payload's available options omit them. Filter chips, resets and quick navigation
remain available. Valid periods keep their original calculations and rendering,
including the existing no-baseline signal and measured current-zero behavior.
Only a synthetic baseline-test fixture was corrected to return September cutoff
for a September selection; its previous October cutoff violated this contract.

## Deterministic evidence

- `npm ci --prefix web`: PASS, 71 packages installed.
- `node --experimental-strip-types web/tests/overview-period.test.mjs`: PASS,
  53 adapter/actual-page SSR tests. Cases include Черкаси 2024, October 2026,
  September 2025, isolated current/selected/cutoff-year and month mismatches,
  missing/invalid cutoff, valid year/month/leap-day/numeric-string contracts,
  implicit year and preservation of every selected filter/navigation argument.
- `node --experimental-strip-types web/tests/overview-baseline.test.mjs`: PASS,
  all 27 existing baseline tests, including measured zero and legacy fallback.
- Original-code regression: restored both original Overview adapter/page from
  exact PR HEAD in a disposable copy. Five selected actual-page SSR tests
  (Черкаси 2024, October 2026, September 2025, missing and invalid cutoff) all
  FAIL against the old code; revised code passes. Missing/invalid cutoff cases
  also reproduce the previous SSR exception. No test reaches a network or
  warehouse; chart and Sidebar components are stubbed.
- Workspace standalone TypeScript `--noEmit`: PASS.
- Final workspace `npm run check`: FAIL, 24 test files pass and three fail
  because `.agents/runtime` cannot be created under its read-only mount
  (`.agents/run.test.mjs`, `operating-tasks.test.mjs`, `operating-v2.test.mjs`).
  TypeScript/build are not reached by this command. An initial run additionally
  found stale generated inventory; it was refreshed and that failure resolved.
- Full `npm run check` in `/tmp/issue43-period-check-w235bfw2`: PASS, all 27 test
  files, TypeScript and optimized Next.js production build. All 270 PR paths
  plus the new regression test were copied and byte-verified before testing;
  final adapter/page/test source remains byte-identical. Dependencies were
  reused; runtime/build outputs stayed in the disposable copy. A new navigation
  assertion initially expected an explicit default grain query parameter; its
  expectation was corrected to the existing canonical URL behavior before the
  successful full run. No application change was needed for that assertion.
  Final report/discrepancy/handoff documentation was added after that full run;
  executable source did not change afterward.
- Generated inventory, RPC lineage and 66-case QA-plan reproducibility checks:
  PASS. `git diff --check` and whitespace checks including new text files: PASS.
  [Machine-readable verification](sales-period-verification-40387333537.json)
  records check scope and source hashes.

Static inventory/matrix and RPC lineage hashes were refreshed because the
Overview component/adapter changed. Inventory remains static code evidence,
not browser execution or installed-contract parity.

## Future SQL follow-up — NOT APPLIED

The installed fallback remains unresolved. A separate reviewed SQL change should
retain explicit selected-period identity when no matching rows exist, expose
current/prior row presence and nullable metrics, and avoid substituting the
latest date from another period. It needs authorized database execution plus
PostgreSQL behavior and UI reconciliation evidence before release. No SQL file
was modified or applied here. Same-period SQL-erased missingness, partial sums,
LFL and broader D04 correctness remain OPEN; matching metadata alone does not
establish completeness or measured-zero provenance.

All 66 authenticated browser cases remain NOT_EXECUTED. No new screenshots,
authenticated preview, upstream parity or production correctness is claimed.
PageSpeed UNKNOWN, D05 source windows, D22/D23 money/ROAS and Meta guards remain
byte-identical to the requested PR HEAD. `docs/PROJECT-STATUS.md` stays unchanged
from that head because no new production status was proven. No merge, deployment,
production/staging migration, scheduler, paid provider, ad/SYRVE/business write
or release gate activation occurred. Owner action NONE for this preview fix.
