# Dynamics previous-period comparison — isolated review candidate

Owner requested a compact MoM/WoW column while keeping the existing pivot, YoY and LFL. Base: main 2a6e775488bef04d40cdb040e02e524abea2f19f (released PR #52).

## Behavior

- One extra MoM/WoW column for the latest report year, starting in 2026; existing year columns remain. Expand a change to inspect both amounts, exact dates, days and cohort counts.
- Calendar adjacency is mandatory: January compares December of the prior year; ISO W01 compares the actual previous ISO week, including W53. Missing data never skips to an older available period.
- Full calendar months keep their natural lengths. A partial month/week compares equal elapsed days. If the preceding month is shorter, both comparison windows are clamped; excluded current days are disclosed. The main total remains unchanged.
- Revenue, checks and average check changes are percentages. Markup-rate changes are percentage points, including YoY. A zero previous denominator yields an unavailable percentage rather than infinity; measured zero remains zero.
- Pairwise LFL uses identical locations with valid daily observations in both windows and honors registry exclusions. Its subset can differ from the main YoY total and is explicitly identified. Without LFL, an incomplete candidate set makes comparison unavailable.
- ISO Monday–Sunday dates appear next to each pivot week and in chart tooltips, explicitly tied to the latest ISO year. Dates for other year columns are not implied.
- Observation coverage means observed warehouse location-days, not proof that upstream ingestion contains every order or absent slice. Missing daily observations are conservative exclusions, never inferred zero sales.

## Data boundary and release status

New readonly, password-gated RPC: `bi_dynamics_period_comparison`. The draft SQL is guarded to run only in a disposable fixture database. It does not replace the existing Dynamics RPC or write business rows. The frontend independently validates calendar windows, filters, cohort arithmetic, coverage and deltas. Missing RPC, transport errors, mismatched cutoff or invalid contracts yield an explicit unavailable comparison; no legacy fallback.

`BI_DYNAMICS_PERIOD_COMPARISON_V1=1` is enabled only on the isolated preview branch. Production defaults remain disabled. `BI_ISO_WEEKS_V1=1` is also scoped to that preview branch. No production SQL, source spreadsheet, credentials, schedules or tariffs have been changed for this task.

**Before a separate authorized database rollout, live preview can verify week dates and unavailable-data handling, but cannot demonstrate real MoM/WoW values.** Synthetic SSR and disposable PostgreSQL tests must not be presented as production verification.

## Verification

- New targeted TypeScript/SSR/date checks: 40/40 passed before publishing.
- Initial local prebuild: 729/730 passed; only generated audit inventory was stale. Regenerated inventory; its targeted suite then passed 10/10.
- TypeScript and optimized Next.js build passed locally.
- Workflow `bi-priority-native.yml` runs full repository checks and new disposable SQL fixture on PostgreSQL 16, then PostgreSQL 17. The SQL fixture sends nine actual native SQL payloads through the actual TypeScript validator and verifies rollback. Read the exact candidate SHA workflow result for final counts/status; local prebuild is not full CI.
- Scenarios cover year boundaries, ISO W53, leap dates, full and partial windows, shorter previous month, absent periods, missing days, opened/closed locations, registry exclusion, zero/null/NaN, authentication, privileges and unchanged existing RPC.

## Subsequent release gate

After exact-SHA CI and preview review, obtain approval for the concrete new RPC and release. Verify the function is absent (or save exact existing definition, owner, ACL and dependencies), capture the base schema/function fingerprints, prepare a transactional installation and rollback, and set bounded statement/lock timeouts. Do not remove the fixture guard and run the draft casually. Verify readonly real-data results and latency against the same cutoff before enabling real comparisons. Then review preview; only after approval/checks merge and verify production. Rollback first disables the feature flag; remove only the newly installed function if its unchanged definition and lack of new dependents are confirmed. Existing Dynamics functions and business data stay intact.
