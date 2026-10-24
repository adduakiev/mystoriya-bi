# Meta Ads Gate D activation

Status: **ACTIVE** as of 2026-10-24.

Gate D replaces the previously proposed Windsor destination + fixed-delay cron design with a safer application-controlled recurrence, because the connected Windsor Supabase destination reports `create_in_chat=false` and the TRIAL plan does not allow hourly `force_refresh`.

The production adapter is `public.sync_meta_windsor_snapshot(text,date,date,jsonb)`. It is `SECURITY DEFINER` with an empty search path and executable only by `service_role`. A completed non-empty Windsor campaign-day snapshot is validated for account, window, unique keys, one currency and nonnegative metrics. In one database transaction it removes withdrawn raw keys only inside the explicit account/date window, upserts the exact source snapshot, reconciles every raw field, derives the current evidence fingerprint, and calls the existing bounded `refresh_digital_meta_models`. Any error rolls back both raw and curated changes.

A ChatGPT scheduled task named **Meta Ads BI Sync** runs daily around 08:00 Europe/Kyiv. Each run uses the previous 30 completed UTC calendar days (ending yesterday), validates the exact Windsor field set and account `1642925125961488`, and does not use `force_refresh`. It calls the orchestrator only after Windsor returns a completed, non-empty, unique, single-currency snapshot. Success is silent; failures or reconciliation blocks notify the owner.

The task does **not** create or use a Windsor destination task, does not touch Instagram, Google/Social pipelines, advertising objects/budgets, credentials, grants or RLS. Missing link clicks, purchases, purchase value and ROAS remain NULL rather than being coerced to zero.

## First production run

The same orchestration path was executed manually before scheduling: 145 source rows for 2026-09-25..2026-10-24 became 145 raw and 145 curated rows with zero raw-to-curated field mismatches. USD spend was 1,349.52, impressions 1,881,133, clicks 12,426. Purchase and purchase-value evidence remained unknown. The raw evidence fingerprint was `3e1d2787d8a4a24480c491dd316a093c`.

## Rollback

The exact pre-activation 110 raw and 110 curated rows are retained in the non-exposed `private` schema. GitHub stores only counts/fingerprints and the bounded restore SQL in `docs/sql/backups/issue-37-gate-d-orchestrator-rollback.sql`; business row contents are not committed.
