# Current Digital correctness — issue #12

Issue #34 prepares the [Meta Windsor ingestion candidate](meta-windsor-ingestion.md),
including raw field mapping, currency, controlled refresh and disabled activation plan.


Issue #26 extends source correctness to Meta Ads and Social. See
[Meta/Social contract and NOT-APPLIED SQL scope](meta-social-correctness.md).
The phase-1 notes below describe the Google baseline.

## Production DB application — issue #20

Applied to production Supabase on 2026-10-23 as migration `20261023133005_digital_correctness_rpc` after pre-apply rollback backup, live read-only validation and temporary PostgreSQL compilation. The production RPCs now expose the selected-period evidence contract for Ads/GBP and the corrected core Digital null/presence semantics. Business source tables were not modified. Rollback backup: `docs/sql/backups/issue-20-preapply-2026-10-23.sql`. Security hardening remains separate in issue #18.


## Issue #17 — database gate preparation, NOT APPLIED

The application is live from PR #14, as recorded in issue #17. The earlier local
implementation/verification notes below describe the issue #12 handoff; they are
not the current application deployment status. This issue changes only the
prepared SQL design, static regression checks and this documentation.

The prepared Ads and GBP RPCs now return `meta.rows = count(*)` and
`meta.observedDates = count(distinct date_id)` from the same effective window and
source rows used for their summaries. An empty Ads source explicitly returns
`available=false`, `rows=0`, `observedDates=0` and an empty/unknown summary. Empty
GBP input returns both counts as zero and all summary sums as null. Positive
evidence preserves measured zeroes. `locationCount` remains the number of returned
location groups, not measurement evidence. PageSpeed's latest stored snapshot is
queried independently, including when GBP is empty.

Ads evidence describes `digital_google_ads_daily`, not campaign rows in
`staging_google_ads_windsor`. Staging completeness, freshness alignment and
currency reconciliation remain unknown. The core Digital RPC design is unchanged.
The artifact stays outside `supabase/migrations`, explicitly NOT APPLIED, and ends
in `ROLLBACK`. No SQL execution or migration history creation is authorized here.
Static tests do not prove PostgreSQL, RLS, privilege or concurrency behavior;
a real database gate remains a separately authorized follow-up.

Separate security architecture follow-up: the Supabase advisor warns about
anon-executable `SECURITY DEFINER` functions. Review that architecture separately;
it is not a hidden blocker or an authentication redesign in this correctness
artifact. Existing password hash gates, `SECURITY DEFINER`, search paths, revokes
and anon/service_role execution grants remain unchanged for compatibility.

## Barbara review closure — empty Ads / GBP periods

Final review semantics are now executable in the existing source contract: explicit selected-period `rows=0` or `observedDates=0` forces Ads/GBP summary metrics to `null`, even when legacy SQL returned zeroes or nonzero aggregates. A measured zero is preserved only when positive selected-period row/date evidence exists. GBP profile presence is not treated as measurement evidence, and PageSpeed remains independent from GBP period emptiness. The aggregate collector applies the same rule to Google Ads spend. No SQL was executed and no production deployment was performed.


Status: local implementation, **not deployed**. Applies to the already connected
GA4 website, Search Console, Google Ads, GBP and PageSpeed paths. No new source,
credential, provider, account setting, scheduler or business write is activated.

## EXECUTABLE

The server adapters use pure, regression-tested contracts in
`web/lib/data/digital-contract.ts` and `digital-source-contract.ts`. Existing
RPC names, password authentication, cache tags and five-minute cache lifetime
remain; corrected adapters use new cache keys to avoid stale normalized shapes.
The operating collector uses the same GA4/GSC normalization and still reads only
its original three allowlisted RPCs. Domain and current-run gates remain intact.

| Area | Executable behavior | Remaining source limitation |
| --- | --- | --- |
| Numbers | Missing/null/blank/nonfinite values remain `null`; UI uses `—`. Ratios require both operands and a positive denominator. Sums require every operand. Measured zero remains zero. | Warehouse default zeroes have already lost original missingness; client code cannot reconstruct it. |
| Legacy aggregate zero | Empty period counts (`currentGa4Rows`, `previousGa4Rows`, `currentSearchRows`, `previousSearchRows`) explicitly suppress coalesced totals when supplied. Without them, a nonzero aggregate establishes stored row presence; all-zero aggregates remain unknown. | Until prepared SQL is applied separately, a genuinely all-zero period is indistinguishable from an empty SQL aggregate and therefore unavailable. All-history `ga4Rows`/`searchRows` never establish period presence. |
| Trend zero | Per-source `ga4Present`/`searchPresent` flags retain true all-zero days. Without flags, any nonzero additive value for that source proves its row; an all-zero source/day remains unknown. Gaps are not connected. | Current SQL generates dates and fills missing rows with zero; flags are prepared only. |
| GA4 active users | `current.activeUsers` and `previous.activeUsers` are always `null`, including legacy RPC nonzero sums. Audience ratios using them are unavailable. | Daily `active_users` cannot yield exact period uniques. No period-unique contract exists. |
| History/YTD | Monthly nulls remain null. YTD maintains completeness for each operand separately from January; a missing month/operand invalidates its subsequent cumulative result and derived ratios. | Existing history bounds/cutoff are not proof of full collection. `partial` describes calendar truncation, not completeness; absent metadata stays null. |
| Source dates | GA4/GSC/channel/device latest dates remain distinct. Ads/GBP retain their own `from`/`to`. Collector never uses `fetched_at` as a source date, or a global latest date outside the evidence period. | Separate RPC calls/caches do not provide an atomic source snapshot. Collector blocks source freshness when an in-period measurement date cannot be established. |
| PageSpeed | `capturedOn` is explicitly a processing/storage date. `measurementDate` and `fetchedAt` are null; `processedAt` is populated only if `imported_at` is supplied. Missing scores/CWV stay null; categories require all three CWV inputs. | Windsor alignment writes `captured_on=current_date`, not a measurement timestamp. URL, strategy, field/lab provenance and CrUX collection window are absent; freshness cannot be inferred. |
| Snapshots | Query, page and landing snapshots use separate eligible dates, each with its exact inclusive 30-day range. A seven-day payload is never reused merely because its end matches. Mismatched effective response periods are rejected. | History exposes only `max(period_end)` for each table, without period-days filter, snapshot ID, transaction ID or historical candidate list. If latest is after cutoff, an older eligible snapshot cannot be discovered; UI says unavailable. A max date may represent a different stored duration, producing no rows for the exact 30-day request. |
| Snapshot metadata | `periodBasis=REQUESTED_EXACT_30_DAYS`; `snapshotId=null`; completeness UNKNOWN. Known RPC row limits: landing 30, queries 40, pages 30. Display slices (SEO 15 queries/20 pages/10 opportunities) are separate from RPC limits. | Requested period is not proof of actual source coverage, snapshot identity, batch freshness or upstream completeness. Upstream row limits remain null. Query sums can differ from site totals due to GSC omissions. |
| Coverage | Missing completeness is UNKNOWN, never inferred FULL from a date span or count. Quality cards do not claim OK. History counts are labeled all stored rows; Ads trend length counts returned rows only; GBP rows are unknown. | `days` is calendar span, not observed day count. `days × locationCount` is not an observed GBP row count. Daily Ads summary and staging campaign aggregates can differ in freshness, grain and currency. |

App and Merchant remain outside the correctness phases. Social now uses the
issue #26 nullable evidence contract linked above. App/Merchant legacy numeric
adapters and activation status are unchanged. Ads money
formatting remains compatible with the existing UI, with the unconfirmed currency
limitation exposed; no financial reconciliation or ad mutation is performed.

## PREPARED — NOT APPLIED

`docs/sql/issue-12-digital-correctness-NOT-APPLIED.sql` contains a reviewable
replacement design for the existing Digital, Ads and Local RPCs. It is deliberately
outside `supabase/migrations` and ends with `ROLLBACK`:

- period-specific GA4/GSC row counts;
- per-source trend row-presence flags instead of generated zeroes;
- null period active users and undefined ratios; no aggregate `coalesce(sum,0)`;
- PageSpeed processing timestamp kept separate; optional `imported_at` exposed;
- existing password gates, function security settings, revokes and grants retained.

No SQL was executed. Static assertions do **not** prove PostgreSQL execution,
RLS, privileges, concurrency, PostgREST serialization or performance. Application
requires a separately authorized follow-up and real PostgreSQL verification.
This design does not backfill provenance or change importer/table defaults.
The legacy history RPC's coalesced last-seven-day totals are masked by the
executable adapter when no GA4 rows/date exist; its database definition is unchanged.

## NOT IMPLEMENTED

Exact period-unique GA4 users; missingness recovery for historical default-zero
facts; source/property/account/currency and batch-level reconciliation; confirmed
per-source completeness/duplicate/gap auditing; upstream row-limit manifests;
atomic cross-RPC reads; historical snapshot search/identity; PageSpeed true
measurement timestamp/CrUX window. These need additional backend/source data,
not invented frontend values. No provider onboarding or credential change is part
of this work.

## Verification and review limitation

Focused tests execute the actual adapters, snapshot resolver, collector and chart
math with synthetic fixtures; SQL checks are explicitly static. Required checks:
`npm ci --prefix web`, `npm run check`, `git diff --check`.

Barbara's latest CHANGES REQUESTED comment is not in the supplied runner event.
GitHub CLI has no `GH_TOKEN`, and `api.github.com` DNS is unavailable in this
sandbox. Its text was requested, but review-specific closure cannot be claimed
without it. Original issue #12 work proceeds independently. Branch push/PR creation
remain exclusively the trusted runner's responsibility.

Local verification results:

- `npm ci --prefix web`: PASS in the working checkout.
- Focused Digital regression suite: 13/13 PASS.
- `npm run check`: PASS (exit 0), including all five test files, TypeScript and optimized Next.js build, in `/tmp/issue12-verify-za48j4sv` with byte-identical implementation/test files. The direct working-checkout attempt is blocked because existing tests write `.agents/runtime`, which this sandbox mounts read-only; no test or safety gate was skipped or modified to bypass that restriction.
- `git diff --check`: PASS in the working checkout.
- No secret/runtime artifacts in the changed-file list; no commit, push, PR, deploy, migration execution, credential/provider change or business write.

## Exact changed-file list

- `docs/PROJECT-STATUS.md`
- `docs/digital-data-contract.md`
- `docs/sql/issue-12-digital-correctness-NOT-APPLIED.sql`
- `web/app/digital/ads/page.tsx`
- `web/app/digital/audience/page.tsx`
- `web/app/digital/channels/page.tsx`
- `web/app/digital/funnel/page.tsx`
- `web/app/digital/local/page.tsx`
- `web/app/digital/page.tsx`
- `web/app/digital/seo/page.tsx`
- `web/app/digital/site/page.tsx`
- `web/app/digital/tracking/page.tsx`
- `web/components/DigitalAdsTrendChart.tsx`
- `web/components/DigitalHistoryChart.tsx`
- `web/components/DigitalTrendChart.tsx`
- `web/lib/data/digital-contract.ts`
- `web/lib/data/digital-source-contract.ts`
- `web/lib/data/digital-sources.ts`
- `web/lib/data/digital.ts`
- `web/lib/digital-quality.ts`
- `web/lib/operating-collector.ts`
- `web/tests/digital-quality.test.mjs`
- `web/tests/operating-core.test.mjs`
