-- Rollback for Gate C #37 bounded Meta model refresh.
-- Scope is intentionally narrow and does not touch raw Windsor staging.
-- Use only to revert the Gate C modeled rows before any later Meta model refresh overlaps this scope.

delete from public.staging_meta_ads_daily
where account_id = '1642925125961488'
  and date between date '2026-10-01' and date '2026-10-23'
  and ingestion_source = 'windsor_facebook';
