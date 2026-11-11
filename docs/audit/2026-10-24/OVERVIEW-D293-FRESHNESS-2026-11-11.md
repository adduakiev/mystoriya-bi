# D293 — Overview warehouse/report freshness gate (preview candidate)

WORKING acknowledged before inspection. Scope: issue #43, existing unmerged
PR #44, branch `astra/issue-43-40107435112`. Local initial HEAD was exactly
`13293a54266296f038873fa4ad05b5602dc9dd02`, with clean worktree. The supplied
trusted outer preflight is authoritative for remote branch/PR checks; no inner
network/auth retry, alternate checkout, branch writer or new PR was started.
No commit/push or GitHub receipt was sent from Codex.

## Evidence and confidence

The owner's [Production incident evidence](https://github.com/adduakiev/mystoriya-bi/issues/49#issuecomment-6793903567)
was supplied in D293, not independently fetched here. It reports sidebar
`Warehouse · Sync OK · 10.11.2026` alongside November MTD cutoff Nov 1 and
₴524.8K / 680 checks / ₴324.6K markup. Supplied SELECT-only evidence says both
`fact_sales_daily` and `bi_sales_flat_mv`, Nov 1–10, give **₴4,917,182.81 /
6,332 / ₴3,115,226.29**, across 271 dimensional groups. Historical bounded
Nov 1 source evidence is recorded in `REFRESH-SAFETY-2026-11-02.md` as
524806.88 / 680 / 324575.82. No new Production SELECT/RPC, credentials, raw
customer data, Vercel logs or screenshots were retrieved by this task.

**Proven locally:** the report cache key previously depended on filters only,
with 180s revalidation; warehouse status has its own 60s cache. A newer warehouse
status did not change the report cache key. Deterministic fixtures reproduce
Nov 10 status with a cached Nov 1 report; a different server-observed warehouse
version now selects a fresh cache entry. The adapter and actual Overview SSR
map the supplied Nov 1–10 totals and Nov 10 cutoff without retaining Nov 1 KPIs.
These are synthetic boundary tests, not independent source→SQL→UI parity.

**Production root cause remains unconfirmed.** Stale cache retained after a
background failure, SQL/RPC timeout and wrong period/segment remain distinct
hypotheses. The supplied 10:47 UTC Digital revalidation timeouts do not prove an
Overview timeout. The branch's `DataSyncControl`, import POST and progress GET
are already sealed (disabled / 503). Historical successful-status-only
`revalidateTag` and first-500-aborts-poll behavior described in D293 are absent
from this baseline; they were not re-enabled. A new read poll explicitly tests
first GET 500 followed by a later successful warehouse observation.

## Discrepancies and correction

| Priority | Expected vs actual / reproduction | Candidate behavior |
| --- | --- | --- |
| P0 | Unfiltered `/?year=2026&month=11`: supplied warehouse through Nov 10 vs Nov 1 report/cache values above | Warehouse cutoff + last successful sync version participates in the filter-specific report cache key. A banner shows warehouse, global report source and selected report cutoff; mismatch is STALE. |
| P1 | Independent cache failures can retain an older report while status advances | Bounded GET-only metadata checks refresh the current URL; stale/fallback labels persist if report revalidation or RPC fails. |
| P1 | First metadata GET failure must not prevent later recovery | Seven serial checks with delays 0/5/15/30/60/60/60 seconds, each bounded by 8s timeout; errors visible, explicit retry available. No interval or importer POST. |
| P1 | Global max date must not invalidate a legitimate historical month, LFL or dimension cutoff | Global report source date must agree; historical/segmented cutoff is labeled scoped, with no assertion of equal totals or LIVE. Existing selected-period validation remains intact. |

Cache durations and RPC timeout remain unchanged: status 60s / 2s request,
Overview 180s / 10s request, legacy dataset 600s / 20s request. The fallback
remains explicitly unverified. A version change avoids an old cache entry;
same-version background failures can still delay recovery. Polls allow the
normal cache lifecycle to retry without repeating an import. Neither a matched
cutoff nor a successful GET certifies financial totals, completeness, release
readiness or current source freshness. No immediate/guaranteed recovery claim.

The read budget persists through `router.refresh`; automatic report refreshes
are throttled to at most one per 60s. Seven checks span at least 230s excluding
request time; after exhaustion an explicit read retry is needed. This finite
window cannot monitor imports that occur indefinitely after page load. A normal
later navigation/read also observes warehouse status and chooses its cache key.

## Paths and lineage

| Path/block | Source / behavior | Evidence basis |
| --- | --- | --- |
| `web/app/page.tsx` | Existing filters → `overviewRpcArgs` → Overview; additionally reads cached warehouse status before choosing report version | Actual page SSR, synthetic source boundary |
| `web/lib/data/overview.ts` | `bi_overview_payload` → existing snapshot/KPIs/charts; cache key includes server-only warehouse version | Deterministic old/new cache test; no SQL changes |
| `web/lib/overview-freshness.ts` | Warehouse status → cutoff/version; report payload + scope → stale/unknown/aligned/scoped | Pure contract tests; type-only server imports |
| `web/components/OverviewFreshness.tsx` | Visible report freshness block, errors and read retry; bounded router refresh | Actual component with deterministic hook/timer harness, not browser QA |
| `web/lib/overview-poll.ts` | Serial no-store same-origin GET `/api/overview/status`; bounded retries, abort on cleanup | Failure/success/timeout/malformed-response and finite-budget tests |
| `web/app/api/overview/status/route.ts` | Explicit session auth → `loadSalesDataStatus` → existing `bi_sync_status` read-only RPC | Synthetic authenticated/unauthenticated route tests; no invalidation or importer |

`bi_sync_status` returns a literal success that is not evidence of import
success; the new endpoint returns only warehouse cutoff/version, never import
`done`/release status. Middleware coverage is retained and explicit route auth
rejects before status reads. Client input cannot set server cache keys or invoke
invalidation. Safe reads use the existing RPC transport; no importer is called.
Import POST/progress GET and Edge remain unchanged and 503-sealed.

Regression paths: new `web/tests/overview-freshness.test.mjs`, adjusted existing
Overview baseline/period/month-observation mocks and shared preview harness.
Unauthenticated probe expectations now include the new protected API (30
targets); its three synthetic tests pass. Machine inventory, tab/block matrix
and static RPC lineage hashes are regenerated for the new block/API;
23 page routes, 8 API routes and 779 visual/control templates. This is static
coverage, not live navigation proof. Existing 30-day/12-month/source-register
evidence is not expanded by this tightly scoped repair. Glovo #48 stays queued;
no Glovo runtime or private Sheets/atomic recovery gates changed. SU-545195
remains a separate external HOLD.

## Verification and handoff

- `npm ci --prefix web`: PASS (71 packages).
- New deterministic freshness regressions: **8/8 PASS**, zero skip. Includes
  exact supplied totals/cutoff mapping, stale cache vs new warehouse version,
  RPC fallback, legitimate period/segment, first failed poll then success,
  background timeout retaining stale labels, bounded GET-only retry/no double
  refresh, timeout/malformed responses and authenticated route boundary.
- Existing import/Edge safety-gate regressions: **5/5 PASS**, zero skip.
- Existing Overview baseline/period/month-observation file suites: PASS.
- Strict TypeScript and separate optimized Next build: PASS (run separately
  because the required full check stops at sandbox-blocked test failures).
- Inventory/lineage `--check` and `git diff --check`: PASS.
- Full `npm run check`: attempted without reduced tests; sandbox acceptance
  blocked: **54/64 file suites PASS, 10 FAIL, 0 skip**. Failures are the three
  protected runtime suites (`.agents/run`, `operating-tasks`, `operating-v2`)
  and seven native Sales suites (`atomic`, `attestor`, `backup-restore`,
  `prewrite`, `rehearsal`, `release-v234`, `role-hardening`). No guard or test
  was removed. These file counts are not trusted outer native assertion counts.
- Native PG16.15 role-hardening diagnostic: static assertion PASS, disposable
  server startup FAIL before SQL assertions: `could not bind Unix address ...
  Operation not permitted`, `pg_ctl: EPERM`. PG17 binaries are absent here.
  Operating fixtures also cannot create protected `.agents/runtime` (ENOENT).
  These are inner sandbox failures, not trusted outer runner results.

Local diagnostic logs (not committed): `/tmp/d293-check-final.log`,
`/tmp/d293-native-pg16.log`, `/tmp/d293-focused-detail.log`,
`/tmp/d293-safety-detail.log`, `/tmp/d293-auth-probe-detail.log`,
`/tmp/d293-contract-detail.log`, `/tmp/d293-build-final.log`.

**BLOCKED for full acceptance / NOT RELEASED.** Trusted outer runner must run
the unchanged full native PG16 and PG17 checks, strict TS/build/inventory/diff,
then handle commit/push to the same PR. Independent immutable exact-new-SHA
PG16+PG17 CI and matching READY Preview must be inspected separately. Supplied
baseline CI #43001716369 (687/687 per major) is prior-SHA evidence only.

Authenticated Preview desktop/mobile QA is **UNVERIFIED**: no existing
authorized browser session was supplied or exercised in this sandbox. Intended URL checks:
`/?year=2026&month=11`, historical `/?year=2026&month=10`, and
`/?year=2026&month=11&lfl=1` plus existing dimensions, at desktop/mobile sizes,
including transient status error and failed revalidation. No screenshots or
runtime 404/500/performance acceptance are claimed. Production source→warehouse
→RPC→rendered payload parity and owner release approval remain separate gates.

No Production/Edge/SQL/import execution, credentials, scheduling, provider
activation, ad/SYRVE/business writes, merge, deploy or GitHub message occurred.
