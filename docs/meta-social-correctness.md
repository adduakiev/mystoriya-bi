# Issue #26 — Meta Ads and Social source readiness

Local implementation for Barbara review. No source import, provider/OAuth mutation,
SQL execution, deployment, commit, push or PR creation is performed. The trusted
GitHub runner owns branch/PR handoff.

## Application contract

`web/lib/data/meta-social-contract.ts` defines pure nullable normalizers and
selected-period evidence. Existing RPC names/signatures and password handling
remain. The Meta Ads cached loader calls `bi_digital_meta_ads_payload`; social
uses `bi_digital_social_payload`. Both use the existing five-minute lifetime and
`digital-data` tag, with new normalization cache keys. A Meta RPC failure shows
an unavailable source message without preventing Google Ads rendering.

Each daily source exposes its own `from`, `to`, selected `rows`, `observedDates`
when known, in-period `latest`, distinct `sourceLatest`, `available`, `freshness`,
`status` and `coverage`. Current RPCs select independent source-anchored inclusive
30-day windows; these pages do not pretend to follow the overview's date selector.
A global/all-history row count never supplies selected-period measurement evidence.
Dates describe source measurements, never import/processing timestamps.

- Explicit `rows=0` or `observedDates=0` overrides all aggregates and legacy status
  flags: every performance metric is null, availability false, status `WAITING`.
- A positive selected row/date count preserves measured zero. Missing/null/blank/
  nonfinite metrics stay null. Ratios require known operands and positive denominators.
- No positive selected evidence means `WAITING`, with null performance metrics.
- `LIVE` means source recency only, not complete collection. The explicit UI policy
  is fresh through two UTC calendar days; older measurements are `STALE`.
- Positive evidence with unknown/invalid/ineligible measurement date is `PARTIAL`.
  Explicit partial coverage or observed calendar gaps also produces `PARTIAL`
  when fresh. `STALE` takes precedence over `PARTIAL`, while coverage remains visible.
- Unknown observed dates stay null. A full calendar span or 30 observed dates
  does not prove completeness; coverage stays `UNKNOWN` unless explicitly supplied
  or gaps prove `PARTIAL`. No account-level coverage or ingestion SLA is inferred.

Facebook's existing `facebook.rows` already counts its own window; its stored
measurements remain visible even when stale. Latest `2026-10-18` relative to
`2026-10-23` is `STALE`, regardless of the legacy `facebookStatus='live'` flag.
Empty Instagram daily data remains `WAITING`, with dashes. Content lists have
independent row-level evidence: null metrics stay null, genuine zeroes survive,
and engagement rates are recomputed from known operands. Content rows never
prove daily-source readiness. Publication dates are not Insights observation
windows; content completeness/freshness is unknown. Returned lists have a limit
of 30; all-history counts are separately labeled.

Paid Advertising presents Google and Meta in separate labeled sections. Meta
purchase value / ROAS never combines with Google conversion value / ROAS. Meta
amounts have no currency symbol because currency/account/attribution settings
remain unverified. Campaign identities include account ID. Google normalization,
collectors, evidence/domain/current-run gates and attribution math are unchanged.
The overview links Ads/Social to source-specific status instead of claiming the
whole report is live.

## Legacy compatibility and remaining limitations

Legacy Meta `meta.rows` counts all history. Only its zero is conclusive; positive
legacy counts cannot validate the selected summary. Until contract v2 or explicit
selected observed-date evidence is supplied, Meta measurements stay unknown.
This deliberately keeps the unfinished live-data path closed.

Legacy social SQL already coalesces some aggregates to zero, losing original
missingness. Daily row evidence cannot recover which original columns were null.
Nonzero Facebook data and positive-evidence additive zeroes remain available;
legacy zero follower endpoint snapshots stay unknown because missing boundary
rows were also coalesced to zero. Version 2 preserves actual endpoint zeroes and
nulls. No historical recovery/backfill is claimed.

Meta reach/frequency across ad/date rows and Instagram daily reach/accounts engaged
cannot establish period-unique audience; these aggregate metrics are unavailable.
Per-content reach remains a known row-level value where supplied. Completeness,
currency/account reconciliation, batch provenance, attribution configuration,
concurrent RPC snapshot consistency and historical metric observation windows
remain unknown. No new paid provider, scheduler or durable/business write is enabled.

## SQL review artifact — NOT APPLIED

`docs/sql/issue-26-meta-social-correctness-NOT-APPLIED.sql` is outside
`supabase/migrations` and ends in `ROLLBACK`. It replaces only the existing two
read RPCs, keeping their signatures, password hash checks, security settings,
search paths and execution grants. It adds contract version 2, selected row/date
evidence and freshness metadata; removes zero-coalescing and undefined ratios;
groups Meta campaigns by account and campaign; and bounds both content lists by
their own daily source windows using UTC publication dates. Empty sums remain
null. It creates no tables, credentials, providers, schedules or write adapters.

No SQL was executed. Static assertions cannot prove PostgreSQL compilation,
RLS/privileges, concurrency or performance. A separately authorized database gate
must verify these before application. Existing security architecture is preserved,
not redesigned by this issue. Original migration files are untouched.

## Verification

Regression fixtures cover empty Meta/IG, October 18 Facebook staleness, positive
measured zeroes, unknown metrics/content, contradictory zero evidence, two-day
freshness boundary, partial/unknown coverage, invalid dates, account-separated
campaigns and independent Google attribution. Existing Digital correctness tests
remain in the full suite. SQL assertions are static only.

Required handoff checks: `npm ci --prefix web`, `npm run check`, `git diff --check`.

Local results for this handoff:

- `npm ci --prefix web`: PASS.
- Focused contract, rendering and existing Google correctness suites: PASS.
- `npm run check`: PASS in `/tmp/issue26-verify-6fw6mq1v` with identical
  implementation/test files and the installed dependency tree: all seven test
  files, TypeScript, optimized Next.js build. The checkout attempt could not write
  the existing tests' `.agents/runtime` directory because the sandbox mounts
  `.agents` read-only. No test or safety gate was skipped or changed.
- `git diff --check`: PASS in the working checkout.

Remaining handoff dependency: the reviewed SQL requires a separately authorized
real database verification/application step before live Meta measurements can
use the v2 contract. No production readiness or SQL execution is claimed here.
