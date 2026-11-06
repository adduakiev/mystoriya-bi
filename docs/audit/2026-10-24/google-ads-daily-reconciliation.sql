-- Prepared 2026-10-25 for issue #43 / existing PR #44. NOT executed on a warehouse.
-- One SELECT statement; fixed inclusive UTC calendar dates, not account timezone.
-- Reproduction, only in an already-authorized SELECT-only session:
-- psql -X --set=ON_ERROR_STOP=1 --file=docs/audit/2026-10-24/google-ads-daily-reconciliation.sql
-- No RPC, refresh, migration, session credential, scheduler or business mutation.
-- Aligned raw date column: date (renamed from date_id); curated: date_id.
-- Raw conversions_value maps to curated conversion_value. Currency absent.
WITH bounds AS (
  SELECT DATE '2026-10-12' AS from_date, DATE '2026-10-24' AS to_date
), raw_rows AS (
  SELECT r.date, r.account_id, r.campaign_id, r.cost, r.clicks, r.impressions,
         r.conversions, r.conversions_value
  FROM public.staging_google_ads_windsor r CROSS JOIN bounds b
  WHERE r.date BETWEEN b.from_date AND b.to_date
), curated_rows AS (
  SELECT c.date_id, c.cost, c.clicks, c.impressions, c.conversions, c.conversion_value
  FROM public.digital_google_ads_daily c CROSS JOIN bounds b
  WHERE c.date_id BETWEEN b.from_date AND b.to_date
), raw_daily AS (
  SELECT date, sum(cost) AS cost, sum(clicks) AS clicks, sum(impressions) AS impressions,
         sum(conversions) AS conversions, sum(conversions_value) AS conversion_value
  FROM raw_rows GROUP BY date
), curated_daily AS (
  SELECT date_id, sum(cost) AS cost, sum(clicks) AS clicks, sum(impressions) AS impressions,
         sum(conversions) AS conversions, sum(conversion_value) AS conversion_value
  FROM curated_rows GROUP BY date_id
), joined AS (
  SELECT r.date IS NULL AS missing_raw, c.date_id IS NULL AS missing_curated,
         r.cost IS DISTINCT FROM c.cost AS cost_mismatch,
         r.clicks IS DISTINCT FROM c.clicks AS clicks_mismatch,
         r.impressions IS DISTINCT FROM c.impressions AS impressions_mismatch,
         r.conversions IS DISTINCT FROM c.conversions AS conversions_mismatch,
         r.conversion_value IS DISTINCT FROM c.conversion_value AS conversion_value_mismatch
  FROM raw_daily r FULL OUTER JOIN curated_daily c ON r.date = c.date_id
), raw_duplicates AS (
  SELECT date, account_id, campaign_id, count(*) AS n
  FROM raw_rows GROUP BY date, account_id, campaign_id HAVING count(*) > 1
), curated_duplicates AS (
  SELECT date_id FROM curated_rows GROUP BY date_id HAVING count(*) > 1
)
SELECT jsonb_build_object(
  'check_name', 'google_ads_raw_curated_daily_2026_10_12_24',
  'from', b.from_date, 'to', b.to_date, 'inclusive', true,
  'calendar_timezone', 'UTC', 'expected_calendar_dates', b.to_date - b.from_date + 1,
  'raw_rows', (SELECT count(*) FROM raw_rows),
  'raw_observed_dates', (SELECT count(*) FROM raw_daily),
  'curated_rows', (SELECT count(*) FROM curated_rows),
  'curated_observed_dates', (SELECT count(*) FROM curated_daily),
  'joined_date_groups', (SELECT count(*) FROM joined),
  'missing_raw_date_groups', (SELECT count(*) FROM joined WHERE missing_raw),
  'missing_curated_date_groups', (SELECT count(*) FROM joined WHERE missing_curated),
  'missing_date_groups', (SELECT count(*) FROM joined WHERE missing_raw OR missing_curated),
  'mismatched_daily_aggregate_groups', (SELECT count(*) FROM joined WHERE
    cost_mismatch OR clicks_mismatch OR impressions_mismatch OR conversions_mismatch OR conversion_value_mismatch),
  'metric_mismatch_groups', (SELECT jsonb_build_object(
    'cost', count(*) FILTER (WHERE cost_mismatch),
    'clicks', count(*) FILTER (WHERE clicks_mismatch),
    'impressions', count(*) FILTER (WHERE impressions_mismatch),
    'conversions', count(*) FILTER (WHERE conversions_mismatch),
    'conversion_value', count(*) FILTER (WHERE conversion_value_mismatch)) FROM joined),
  'duplicate_raw_key_groups', (SELECT count(*) FROM raw_duplicates),
  'duplicate_raw_key_excess', (SELECT coalesce(sum(n - 1), 0) FROM raw_duplicates),
  'duplicate_curated_date_groups', (SELECT count(*) FROM curated_duplicates),
  'raw_unknown_identity_rows', (SELECT count(*) FROM raw_rows WHERE
    account_id IS NULL OR btrim(account_id) = '' OR campaign_id IS NULL OR btrim(campaign_id) = ''),
  'raw_unknown_metric_rows', (SELECT count(*) FROM raw_rows WHERE
    cost IS NULL OR clicks IS NULL OR impressions IS NULL OR conversions IS NULL OR conversions_value IS NULL),
  'curated_unknown_metric_rows', (SELECT count(*) FROM curated_rows WHERE
    cost IS NULL OR clicks IS NULL OR impressions IS NULL OR conversions IS NULL OR conversion_value IS NULL),
  'currency', 'UNKNOWN', 'account_scope_parity', 'UNKNOWN',
  'conversion_action_attribution', 'UNKNOWN', 'business_account_timezone', 'UNKNOWN',
  'upstream_completeness', 'UNKNOWN', 'rpc_rendered_ui_parity', 'UNKNOWN'
) AS reconciliation
FROM bounds b;
