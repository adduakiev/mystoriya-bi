# Refresh safety review — 2026-11-02 (Europe/Kyiv)

Issue #43 / existing PR #44 only. NOT READY FOR GATE / NOT RELEASED.

## Exact baseline and authenticated UI

- PR baseline: `19fe889f23704ac784e06b3162ff6393ce692fd1`, open/unmerged; Preview `dpl_8UiJDoQK25wfFFuE95nptDK8613t` READY at that SHA.
- Production alias `mystoriya-bi.vercel.app` independently resolved by Vercel to `dpl_AUQqT2xhCpJRhcdy6tH9w49Gxc1z`, SHA `4f0cfcec48408428d51ee916cb87a97a256e4807`.
- Inspected existing authorized Chrome tab `/pnl`. The refresh icon is in the sidebar brand/status area beside the data cutoff and above logout/navigation. Accessible label: `Оновити дані з Google Sheets`; tooltip reports cutoff 26.10.2026. Visible production status says `Warehouse · Sync OK`. No 401 text was visible. Screenshot capture timed out; the authenticated accessibility observation succeeded. No click, navigation reload, import, or credential extraction was performed.
- Exact production code: DataSyncControl POSTs `/api/data-sync`; route calls `bi_trigger_sync`; installed trigger executes the configured cron command. This is a production import, not merely a view refresh. Polling `/api/data-sync/status` calls `bi_sync_progress`. On failed runs UI emits only `Синхронізація завершилась помилкою.`; SQL progress omits `details.error`, so the Google 401 is not displayed specifically. This failure path was traced, NOT re-triggered.

## Read-only source → staging → warehouse → RPC → UI evidence

- Connected Sheets metadata confirms `Данние короткі` (sheetId 1767354614), 48,368 grid rows / 14 columns. Bounded read `F47000:N48368` returned 232 populated rows, ending at row 47,231, latest serial 46327 (2026-11-01). The 33 rows for Nov 1 sum to revenue 524806.88 UAH, checks 680, markup 324575.82 UAH (integer-kopiyka calculation). This verifies the bounded tail, not every historical source row or month-close completeness. User-connected access is not proof of service-account runtime access.
- SELECT-only warehouse: 46,286 facts, max date 2026-10-26, one import_run_id. `staging_sales_raw`: zero rows. Missing later warehouse dates are UNKNOWN, not zero sales.
- Latest import record: 2026-11-01 21:42:10 UTC (23:42 Kyiv), failed `Google Sheets returned 401`, zero read/loaded. Last successful run 2026-10-30 04:15 UTC, cutoff Oct 26. No new run initiated.
- Deployed Edge function remains v8; it anonymously reads Google gviz CSV. Reader permissions alone do not authenticate that request. No live service-account credential was accessed or created.
- Installed `bi_sync_status` returns a literal success status and last successful cutoff, regardless of newer failures. This explains the misleading production badge. PR already changes wording to `Warehouse · статус отримано`; that is not a source-freshness guarantee.
- Installed definitions inspected via pg_get_functiondef only, no mutating RPC invoked: `sync_sales_batch` upserts directly into live facts and dimensions per request. `finalize_sales_snapshot` unconditionally deletes facts whose run differs, then refreshes aggregates. A later batch failure leaves prior committed batches; empty input can reach finalization in deployed v8 and delete the snapshot. Preflight in the PR is useful but does not establish atomicity. Current one-run warehouse state is not evidence that the failure design is safe.

## Change prepared in this PR

1. Render an inert disabled refresh button with a persistent explanation.
2. Direct POST `/api/data-sync` returns 503 `SALES_IMPORT_SAFETY_GATE` without invoking SQL or network.
3. Edge entrypoint returns the same gate before reading credentials, creating import records, reading Google or touching warehouse. No environment flag bypass. Legacy code retained below the unconditional guard for separate reviewed replacement.
4. Native tests execute the real transpiled route and Edge callback with forbidden-I/O sentinels, and SSR the actual control. Regenerated inventory and route matrix.

These are repository changes only. Production still has the active old button and v8. Do not press it.

## Private reader and remaining release gates

The existing `google-sheet-reader.mjs` already implements fixed-account RS256 OAuth, readonly Sheets scope, bounded JSON reads, sanitized errors and no public fallback. Its cryptographic/mock transport tests were rerun; it remains disconnected from the unsafe writer. Do not connect it merely to fix 401.

Existing atomic SQL proposal `docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql` was NOT changed or applied. Required next acceptance: disposable PostgreSQL failure/concurrency tests; reviewed staging manifest and all-or-nothing promotion; empty/truncated snapshot rejection; preservation of facts/dimensions/aggregates on any failure; approval for exact DB changes and credential configuration; read-only service-account probe; separately approved Edge/production release and controlled import; final Nov 1 source→warehouse→RPC→UI amount parity. None is implied by a passing frontend build.

No new PR, merge, production deployment/import, migration, key/permission/schedule/provider/SYRVE/advertising change. Data Gap Workshop stays queued.

## Validation

- `npm ci --prefix web`: passed using local official npm CLI (npm was not on PATH).
- Targeted refresh/auth/preflight tests: 27 passed, zero failed.
- Full repository tests: 432 total, 429 passed, zero failed, 3 skipped (disposable PostgreSQL prerequisites unavailable). Initial restricted run hit Windows junction EPERM; rerun with permitted local test access passed without changing tests.
- TypeScript and optimized Next build: passed. Inventory/contract generator checks and git diff --check: passed. Final exact-commit verification recorded in the handoff.
- npm reports two existing dependency advisories (one high, one critical); dependencies/lockfile not changed in this scoped fix.

Official protocol references: https://developers.google.com/identity/protocols/oauth2/service-account and https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get .
