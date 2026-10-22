# Digital correctness closure — phase 1 (issue #12)

Updated 2026-10-22. These are implementation boundaries, not a production deployment report.
Only existing GA4, Search Console, Google Ads, PageSpeed and GBP paths are covered.
App, Social and Merchant contracts retain their prior behavior and need separate correctness work.

## EXECUTABLE

- Pure adapters in `web/lib/digital-contract.ts` and `web/lib/digital-source-contract.ts`
  run behind the existing cached RPC readers. Cache keys changed to avoid serving the old shapes.
- Connected-source numeric measures are `number | null`. Null, missing, empty, boolean,
  nonnumeric and nonfinite inputs stay null. Numeric zero remains zero. UI renders unknown as `—`.
- Derived ratios require both known operands and a strictly positive denominator. A measured
  zero numerator over a positive denominator remains zero. This also applies to funnel event
  ratios, channel shares, local action totals/rates and historical ratios.
- `current.activeUsers` and `previous.activeUsers` are always null under this contract.
  The legacy RPC sums daily `active_users`; that value is deliberately ignored. Sessions per
  period user and purchases per period user are unavailable. No period-unique query is added.
- YTD totals require every preceding calendar month and every required component. A missing
  purchase/revenue value cannot become zero because sessions happen to exist. A partial year
  of available history is not labeled a full YTD total.
- Known empty source/period counts suppress legacy zero-filled summaries. Daily values outside
  known source bounds are null. Counts of stored rows can still legitimately be zero.
- `ga4Latest` and `searchLatest` remain independent source dates. The requested period,
  all-history row counts and per-source period counts are separate concepts. Ads and GBP retain
  their own periods rather than inheriting the overview selection. `days` is calendar span,
  not observed days; GBP row counts are not estimated as days times locations.
- PageSpeed `capturedOn` is **COLLECTOR_DATE**: `refresh_digital_google_models` writes
  `current_date`, not a provider measurement date. `sourceDate` is null. UI labels the collector
  date and explicitly leaves the measurement date / CrUX observation window UNKNOWN.
  Incomplete CrUX inputs produce UNKNOWN category, never an inferred improvement warning.
- Snapshot tables are usable only for exact 30-day periods. SEO selection checks **both**
  endpoints, fetches query/page snapshots separately when their dates differ, rejects mismatched
  responses, and never selects a future snapshot. CTR comparison uses the query snapshot's
  exact period. A different-period RPC response also fails the normal period loader explicitly.
- Snapshot metadata exposes period start/end, returned row count, and known RPC output caps:
  landing pages 30, search queries 40, search pages 30. UI display caps (15 queries / 20 pages
  on SEO) are separate. These caps are not provider limits or proof of complete data.
- `coverage` defaults to UNKNOWN. Explicit source coverage/limits/counts are preserved when
  supplied; populated arrays and a 30-day calendar window never imply FULL. Source-specific
  counts remain separate. Snapshot collection identity and cross-RPC consistency are UNVERIFIED.
- The operating collector uses the same summary normalization, retains its three-RPC allowlist,
  fixed aggregate projection, UNKNOWN coverage, domain isolation and current-run quality gates.
  `fetched_at` remains collector time and cannot replace `source_date`.

## PREPARED — NOT APPLIED

`supabase/migrations/20261022_digital_correctness_phase1_design.sql` prepares replacements
for the four existing password-protected read RPCs. It does not change table/RLS policies,
activate a scheduler, refresh models, write business data or introduce a provider.

The design returns null on empty sums and zero denominators, keeps LEFT JOIN gaps null in daily
series, returns null period active users, adds separate current/previous period counts and
per-source observed/expected dates, and identifies the PageSpeed collector date. Existing source
windows and SQL snapshot caps remain unchanged. Coverage stays UNKNOWN even with every date
present. `contractVersion: 2` / `zeroProvenance: WAREHOUSE_ROWS` mean that RPC aggregation
preserves warehouse rows, not that upstream measurements are complete or authentic.

The frontend accepts both legacy and prepared payloads. Legacy payloads expose
`zeroProvenance: UNKNOWN` and a visible warning that SQL may already have substituted zeroes.
With no period count or source bound, an adapter cannot distinguish a padded zero from a real
zero without discarding valid measurements. Such values are not silently certified as complete.

No migration was executed. PostgreSQL behavior, permissions and concurrent-import consistency
have not been integration-tested here. The design must receive separate database review and
an authorized application before its backend improvements are available.

## NOT IMPLEMENTED / structural limits

| Missing property | Why it cannot be established now |
|---|---|
| Exact period-unique GA4 users | Daily aggregates do not identify overlapping users across dates |
| Provider completeness / truncation / sampling / omissions | Existing tables and legacy RPCs lack collection metadata, provider row limits, pagination and omission records; GSC anonymized queries can differ from site totals |
| Recovery of old missing values stored as zero | Staging/model NOT NULL defaults have already lost that distinction; the SQL design does not rewrite those tables or invent a backfill |
| Atomic collection snapshot across facts, dimensions and requests | No collection/run ID joins these datasets; matching period dates do not prove a common collection |
| Latest eligible historical snapshot when the global latest is after cutoff | Legacy history returns only MAX(period_end), across all period lengths, not a list of eligible 30-day dates; selection returns unavailable rather than inventing an older date |
| Complete replacement of an older snapshot's dimension rows | Upserts can retain rows omitted by a later collection; no immutable snapshot identity is available |
| PageSpeed measurement time / CrUX window | Neither is stored in the current contract; imported_at and captured_on cannot substitute for them |
| GBP location-day completeness | Calendar day and returned location counts cannot establish expected profile membership or per-profile gaps |
| Ads campaign versus daily-total reconciliation | Campaigns use staging while totals use the model; matching windows cannot prove the same refresh or reconcile attribution/currency |

No credentials, accounts, provider settings, ad budgets, durable writes, scheduler state,
SYRVE activation, deployment, GitHub settings, commits, pushes or PR operations are part of this task.

## Verification

Focused regressions exercise actual adapters, snapshot orchestration and cumulative calculations,
including null versus zero, period users, independent dates, mismatched periods, future snapshots,
coverage/row limits and collector projection. SQL assertions are static safeguards only, not proof
of PostgreSQL execution, RLS or concurrency behavior.

The runner's workspace mounts `.agents` read-only. Existing operating tests require scratch files
under `.agents/runtime`; direct `npm run check` therefore fails at fixture creation here. Full
verification is also run against a disposable copy of these exact source files under `/tmp`, where
those unchanged fixture paths are writable. No runtime fixture is added to the source handoff.
