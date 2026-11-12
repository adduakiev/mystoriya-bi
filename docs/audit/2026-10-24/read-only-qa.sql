-- Issue #43, dated 2026-10-24. Production NOT EXECUTED. Not a migration. No RPCs invoked.
-- Queries validated separately on disposable PostgreSQL fixtures; that is not warehouse evidence.
-- Dated rows bounded to [2025-10-24,2026-10-24); 30s per statement, fixed 2026-10-24 age reference.
-- Null-date probe reads at most 1001 matches; 1001 means capped, not an exact total.
-- Snapshots and event cohorts: missing calendar dates are diagnostics, not proof of lost events.
-- Run only through an existing authorized read-only connection, save output privately.
-- psql -X -v ON_ERROR_STOP=1 -f docs/audit/2026-10-24/read-only-qa.sql
-- Connection/auth details must stay out of shell output and committed artifacts.
-- Missing/inaccessible relations fail; empty relations return counts, not measured zero KPIs.
-- Do not grant access or bypass RLS.
-- Complete stored totals do not establish upstream completeness or currency parity.
-- Snapshot/event cohorts have different missing-date expectations; see source register.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL TIME ZONE 'UTC';
SELECT current_setting('transaction_read_only') AS transaction_read_only;

-- Schema preflight: every expected date/key/metric column must exist. Empty result is required.
WITH expected(relation, column_name) AS (VALUES
 ('fact_sales_daily','date_id'),
 ('fact_sales_daily','location_id'),
 ('fact_sales_daily','brand_id'),
 ('fact_sales_daily','ownership_id'),
 ('fact_sales_daily','channel_id'),
 ('fact_sales_daily','order_type_id'),
 ('fact_sales_daily','revenue'),
 ('fact_sales_daily','checks'),
 ('fact_sales_daily','markup'),
 ('digital_ga4_daily','date_id'),
 ('digital_ga4_daily','sessions'),
 ('digital_ga4_daily','purchases'),
 ('digital_ga4_daily','purchase_revenue'),
 ('digital_ga4_daily','engaged_sessions'),
 ('digital_ga4_daily','active_users'),
 ('digital_ga4_channel_daily','date_id'),
 ('digital_ga4_channel_daily','channel'),
 ('digital_ga4_channel_daily','sessions'),
 ('digital_ga4_channel_daily','purchases'),
 ('digital_ga4_channel_daily','purchase_revenue'),
 ('digital_ga4_device_daily','date_id'),
 ('digital_ga4_device_daily','device'),
 ('digital_ga4_device_daily','sessions'),
 ('digital_ga4_device_daily','purchases'),
 ('digital_ga4_device_daily','purchase_revenue'),
 ('digital_ga4_landing_daily','date_id'),
 ('digital_ga4_landing_daily','landing_page'),
 ('digital_ga4_landing_daily','sessions'),
 ('digital_ga4_landing_daily','purchases'),
 ('digital_ga4_landing_daily','purchase_revenue'),
 ('digital_search_daily','date_id'),
 ('digital_search_daily','clicks'),
 ('digital_search_daily','impressions'),
 ('digital_search_daily','position'),
 ('digital_search_query_daily','date_id'),
 ('digital_search_query_daily','query'),
 ('digital_search_query_daily','clicks'),
 ('digital_search_query_daily','impressions'),
 ('digital_search_query_daily','position'),
 ('digital_search_page_daily','date_id'),
 ('digital_search_page_daily','page'),
 ('digital_search_page_daily','clicks'),
 ('digital_search_page_daily','impressions'),
 ('digital_search_page_daily','position'),
 ('digital_google_ads_daily','date_id'),
 ('digital_google_ads_daily','cost'),
 ('digital_google_ads_daily','clicks'),
 ('digital_google_ads_daily','impressions'),
 ('digital_google_ads_daily','conversions'),
 ('digital_google_ads_daily','conversion_value'),
 ('staging_google_ads_windsor','date'),
 ('staging_google_ads_windsor','account_id'),
 ('staging_google_ads_windsor','campaign_id'),
 ('staging_google_ads_windsor','cost'),
 ('staging_google_ads_windsor','clicks'),
 ('staging_google_ads_windsor','impressions'),
 ('staging_google_ads_windsor','conversions_value'),
 ('staging_google_ads_windsor','conversions'),
 ('staging_ga4_daily_windsor','date'),
 ('staging_ga4_daily_windsor','sessions'),
 ('staging_ga4_daily_windsor','ecommerce_purchases'),
 ('staging_ga4_daily_windsor','purchase_revenue'),
 ('staging_searchconsole_daily_windsor','date'),
 ('staging_searchconsole_daily_windsor','clicks'),
 ('staging_searchconsole_daily_windsor','impressions'),
 ('staging_searchconsole_daily_windsor','position'),
 ('digital_gbp_daily','date_id'),
 ('digital_gbp_daily','location_id'),
 ('digital_gbp_daily','impressions'),
 ('digital_gbp_daily','clicks'),
 ('digital_gbp_daily','call_clicks'),
 ('digital_gbp_daily','website_clicks'),
 ('digital_gbp_daily','direction_requests'),
 ('digital_gbp_daily','menu_clicks'),
 ('staging_gbp_windsor','date'),
 ('staging_gbp_windsor','location_id'),
 ('staging_gbp_windsor','impressions'),
 ('staging_gbp_windsor','clicks'),
 ('staging_gbp_windsor','call_clicks'),
 ('staging_gbp_windsor','website_clicks'),
 ('staging_gbp_windsor','direction_requests'),
 ('staging_gbp_windsor','business_food_menu_clicks'),
 ('staging_meta_ads_windsor','date'),
 ('staging_meta_ads_windsor','account_id'),
 ('staging_meta_ads_windsor','campaign_id'),
 ('staging_meta_ads_windsor','spend'),
 ('staging_meta_ads_windsor','impressions'),
 ('staging_meta_ads_windsor','clicks'),
 ('staging_meta_ads_windsor','actions_link_click'),
 ('staging_meta_ads_windsor','actions_offsite_conversion_fb_pixel_purchase'),
 ('staging_meta_ads_windsor','action_values_offsite_conversion_fb_pixel_purchase'),
 ('staging_meta_ads_daily','date'),
 ('staging_meta_ads_daily','account_id'),
 ('staging_meta_ads_daily','campaign_id'),
 ('staging_meta_ads_daily','adset_id'),
 ('staging_meta_ads_daily','ad_id'),
 ('staging_meta_ads_daily','spend'),
 ('staging_meta_ads_daily','impressions'),
 ('staging_meta_ads_daily','clicks'),
 ('staging_meta_ads_daily','link_clicks'),
 ('staging_meta_ads_daily','purchases'),
 ('staging_meta_ads_daily','purchase_value'),
 ('staging_facebook_organic_daily','date'),
 ('staging_facebook_organic_daily','followers'),
 ('staging_facebook_organic_daily','daily_follows'),
 ('staging_facebook_organic_daily','daily_unfollows'),
 ('staging_facebook_organic_daily','impressions'),
 ('staging_facebook_organic_daily','organic_impressions'),
 ('staging_facebook_organic_daily','page_views'),
 ('staging_facebook_organic_posts','created_at'),
 ('staging_facebook_organic_posts','post_id'),
 ('staging_facebook_organic_posts','impressions'),
 ('staging_facebook_organic_posts','reach'),
 ('staging_facebook_organic_posts','engagements'),
 ('staging_facebook_organic_posts','clicks'),
 ('staging_instagram_organic_daily','date'),
 ('staging_instagram_organic_daily','followers'),
 ('staging_instagram_organic_daily','reach'),
 ('staging_instagram_organic_daily','impressions'),
 ('staging_instagram_organic_daily','profile_views'),
 ('staging_instagram_organic_daily','website_clicks'),
 ('staging_instagram_organic_media','published_at'),
 ('staging_instagram_organic_media','media_id'),
 ('staging_instagram_organic_media','reach'),
 ('staging_instagram_organic_media','impressions'),
 ('staging_app_store_daily','date'),
 ('staging_app_store_daily','platform'),
 ('staging_app_store_daily','downloads'),
 ('staging_app_store_daily','first_time_downloads'),
 ('staging_app_store_daily','installations'),
 ('staging_app_firebase_daily','date'),
 ('staging_app_firebase_daily','platform'),
 ('staging_app_firebase_daily','first_opens'),
 ('staging_app_firebase_daily','sign_ups'),
 ('staging_app_firebase_daily','purchases'),
 ('staging_app_firebase_daily','purchase_revenue'),
 ('staging_app_quality_daily','date'),
 ('staging_app_quality_daily','platform'),
 ('staging_app_quality_daily','app_version'),
 ('staging_app_quality_daily','crashes'),
 ('staging_app_quality_daily','anr'),
 ('staging_app_quality_daily','checkout_errors'),
 ('staging_app_acquisition_daily','date'),
 ('staging_app_acquisition_daily','platform'),
 ('staging_app_acquisition_daily','source'),
 ('staging_app_acquisition_daily','campaign'),
 ('staging_app_acquisition_daily','spend'),
 ('staging_app_acquisition_daily','installs'),
 ('staging_app_acquisition_daily','registrations'),
 ('staging_app_acquisition_daily','first_buyers'),
 ('staging_app_acquisition_daily','revenue'),
 ('staging_app_users','registered_at'),
 ('staging_app_users','user_id_hash'),
 ('staging_app_orders','ordered_at'),
 ('staging_app_orders','order_id'),
 ('staging_app_orders','revenue'),
 ('staging_app_orders','contribution_margin'),
 ('staging_google_merchant_performance','date'),
 ('staging_google_merchant_performance','product_id'),
 ('staging_google_merchant_performance','impressions'),
 ('staging_google_merchant_performance','clicks'),
 ('staging_google_merchant_performance','conversions'),
 ('staging_google_merchant_catalog','last_update_date'),
 ('staging_google_merchant_catalog','product_id'),
 ('staging_google_merchant_catalog','price'),
 ('staging_google_merchant_status','snapshot_date'),
 ('staging_google_merchant_status','country'),
 ('staging_google_merchant_status','reporting_context'),
 ('staging_google_merchant_status','active_count'),
 ('staging_google_merchant_status','disapproved_count'),
 ('staging_google_merchant_status','pending_count'),
 ('digital_ga4_landing_snapshot','period_end'),
 ('digital_ga4_landing_snapshot','period_days'),
 ('digital_ga4_landing_snapshot','landing_page'),
 ('digital_ga4_landing_snapshot','sessions'),
 ('digital_ga4_landing_snapshot','purchases'),
 ('digital_ga4_landing_snapshot','purchase_revenue'),
 ('digital_search_query_snapshot','period_end'),
 ('digital_search_query_snapshot','period_days'),
 ('digital_search_query_snapshot','query'),
 ('digital_search_query_snapshot','clicks'),
 ('digital_search_query_snapshot','impressions'),
 ('digital_search_query_snapshot','position'),
 ('digital_search_page_snapshot','period_end'),
 ('digital_search_page_snapshot','period_days'),
 ('digital_search_page_snapshot','page'),
 ('digital_search_page_snapshot','clicks'),
 ('digital_search_page_snapshot','impressions'),
 ('digital_search_page_snapshot','position'),
 ('digital_google_ads_campaign_snapshot','period_end'),
 ('digital_google_ads_campaign_snapshot','period_days'),
 ('digital_google_ads_campaign_snapshot','campaign_name'),
 ('digital_google_ads_campaign_snapshot','cost'),
 ('digital_google_ads_campaign_snapshot','clicks'),
 ('digital_google_ads_campaign_snapshot','impressions'),
 ('digital_google_ads_campaign_snapshot','conversions'),
 ('digital_google_ads_campaign_snapshot','conversion_value'),
 ('digital_pagespeed_snapshot','captured_on'),
 ('digital_pagespeed_snapshot','desktop_score'),
 ('digital_pagespeed_snapshot','mobile_score'),
 ('digital_pagespeed_snapshot','desktop_lcp'),
 ('digital_pagespeed_snapshot','mobile_lcp'),
 ('staging_pagespeed_windsor','imported_at'),
 ('staging_pagespeed_windsor','account_id'),
 ('staging_pagespeed_windsor','desktop_score'),
 ('staging_pagespeed_windsor','mobile_score')
) SELECT e.* FROM expected e LEFT JOIN information_schema.columns c
 ON c.table_schema='public' AND c.table_name=e.relation AND c.column_name=e.column_name
 WHERE c.column_name IS NULL;

-- fact_sales_daily: event/date field date_id; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date_id')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date_id',to_jsonb(t)->'location_id',to_jsonb(t)->'brand_id',to_jsonb(t)->'ownership_id',to_jsonb(t)->'channel_id',to_jsonb(t)->'order_type_id') AS grain_key
 FROM public.fact_sales_daily t
 WHERE t.date_id >= DATE '2025-10-24' AND t.date_id < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['revenue','checks','markup']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','fact_sales_daily','time_basis','date_id',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.fact_sales_daily WHERE date_id IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_ga4_daily: event/date field date_id; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date_id')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date_id') AS grain_key
 FROM public.digital_ga4_daily t
 WHERE t.date_id >= DATE '2025-10-24' AND t.date_id < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['sessions','purchases','purchase_revenue','engaged_sessions','active_users']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_ga4_daily','time_basis','date_id',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_ga4_daily WHERE date_id IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_ga4_channel_daily: event/date field date_id; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date_id')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date_id',to_jsonb(t)->'channel') AS grain_key
 FROM public.digital_ga4_channel_daily t
 WHERE t.date_id >= DATE '2025-10-24' AND t.date_id < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['sessions','purchases','purchase_revenue']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_ga4_channel_daily','time_basis','date_id',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_ga4_channel_daily WHERE date_id IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_ga4_device_daily: event/date field date_id; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date_id')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date_id',to_jsonb(t)->'device') AS grain_key
 FROM public.digital_ga4_device_daily t
 WHERE t.date_id >= DATE '2025-10-24' AND t.date_id < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['sessions','purchases','purchase_revenue']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_ga4_device_daily','time_basis','date_id',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_ga4_device_daily WHERE date_id IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_ga4_landing_daily: event/date field date_id; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date_id')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date_id',to_jsonb(t)->'landing_page') AS grain_key
 FROM public.digital_ga4_landing_daily t
 WHERE t.date_id >= DATE '2025-10-24' AND t.date_id < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['sessions','purchases','purchase_revenue']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_ga4_landing_daily','time_basis','date_id',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_ga4_landing_daily WHERE date_id IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_search_daily: event/date field date_id; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date_id')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date_id') AS grain_key
 FROM public.digital_search_daily t
 WHERE t.date_id >= DATE '2025-10-24' AND t.date_id < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['clicks','impressions','position']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_search_daily','time_basis','date_id',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_search_daily WHERE date_id IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_search_query_daily: event/date field date_id; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date_id')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date_id',to_jsonb(t)->'query') AS grain_key
 FROM public.digital_search_query_daily t
 WHERE t.date_id >= DATE '2025-10-24' AND t.date_id < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['clicks','impressions','position']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_search_query_daily','time_basis','date_id',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_search_query_daily WHERE date_id IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_search_page_daily: event/date field date_id; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date_id')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date_id',to_jsonb(t)->'page') AS grain_key
 FROM public.digital_search_page_daily t
 WHERE t.date_id >= DATE '2025-10-24' AND t.date_id < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['clicks','impressions','position']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_search_page_daily','time_basis','date_id',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_search_page_daily WHERE date_id IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_google_ads_daily: event/date field date_id; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date_id')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date_id') AS grain_key
 FROM public.digital_google_ads_daily t
 WHERE t.date_id >= DATE '2025-10-24' AND t.date_id < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['cost','clicks','impressions','conversions','conversion_value']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_google_ads_daily','time_basis','date_id',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_google_ads_daily WHERE date_id IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_google_ads_windsor: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date',to_jsonb(t)->'account_id',to_jsonb(t)->'campaign_id') AS grain_key
 FROM public.staging_google_ads_windsor t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['cost','clicks','impressions','conversions_value','conversions']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_google_ads_windsor','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_google_ads_windsor WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_ga4_daily_windsor: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date') AS grain_key
 FROM public.staging_ga4_daily_windsor t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['sessions','ecommerce_purchases','purchase_revenue']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_ga4_daily_windsor','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_ga4_daily_windsor WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_searchconsole_daily_windsor: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date') AS grain_key
 FROM public.staging_searchconsole_daily_windsor t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['clicks','impressions','position']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_searchconsole_daily_windsor','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_searchconsole_daily_windsor WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_gbp_daily: event/date field date_id; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date_id')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date_id',to_jsonb(t)->'location_id') AS grain_key
 FROM public.digital_gbp_daily t
 WHERE t.date_id >= DATE '2025-10-24' AND t.date_id < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['impressions','clicks','call_clicks','website_clicks','direction_requests','menu_clicks']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_gbp_daily','time_basis','date_id',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_gbp_daily WHERE date_id IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_gbp_windsor: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date',to_jsonb(t)->'location_id') AS grain_key
 FROM public.staging_gbp_windsor t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['impressions','clicks','call_clicks','website_clicks','direction_requests','business_food_menu_clicks']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_gbp_windsor','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_gbp_windsor WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_meta_ads_windsor: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date',to_jsonb(t)->'account_id',to_jsonb(t)->'campaign_id') AS grain_key
 FROM public.staging_meta_ads_windsor t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['spend','impressions','clicks','actions_link_click','actions_offsite_conversion_fb_pixel_purchase','action_values_offsite_conversion_fb_pixel_purchase']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_meta_ads_windsor','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_meta_ads_windsor WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_meta_ads_daily: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date',to_jsonb(t)->'account_id',to_jsonb(t)->'campaign_id',to_jsonb(t)->'adset_id',to_jsonb(t)->'ad_id') AS grain_key
 FROM public.staging_meta_ads_daily t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['spend','impressions','clicks','link_clicks','purchases','purchase_value']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_meta_ads_daily','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_meta_ads_daily WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_facebook_organic_daily: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date') AS grain_key
 FROM public.staging_facebook_organic_daily t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['followers','daily_follows','daily_unfollows','impressions','organic_impressions','page_views']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_facebook_organic_daily','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_facebook_organic_daily WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_facebook_organic_posts: event/date field created_at; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'created_at')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'post_id') AS grain_key
 FROM public.staging_facebook_organic_posts t
 WHERE t.created_at >= DATE '2025-10-24' AND t.created_at < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['impressions','reach','engagements','clicks']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_facebook_organic_posts','time_basis','created_at',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_facebook_organic_posts WHERE created_at IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_instagram_organic_daily: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date') AS grain_key
 FROM public.staging_instagram_organic_daily t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['followers','reach','impressions','profile_views','website_clicks']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_instagram_organic_daily','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_instagram_organic_daily WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_instagram_organic_media: event/date field published_at; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'published_at')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'media_id') AS grain_key
 FROM public.staging_instagram_organic_media t
 WHERE t.published_at >= DATE '2025-10-24' AND t.published_at < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['reach','impressions']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_instagram_organic_media','time_basis','published_at',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_instagram_organic_media WHERE published_at IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_app_store_daily: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date',to_jsonb(t)->'platform') AS grain_key
 FROM public.staging_app_store_daily t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['downloads','first_time_downloads','installations']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_app_store_daily','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_app_store_daily WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_app_firebase_daily: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date',to_jsonb(t)->'platform') AS grain_key
 FROM public.staging_app_firebase_daily t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['first_opens','sign_ups','purchases','purchase_revenue']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_app_firebase_daily','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_app_firebase_daily WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_app_quality_daily: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date',to_jsonb(t)->'platform',to_jsonb(t)->'app_version') AS grain_key
 FROM public.staging_app_quality_daily t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['crashes','anr','checkout_errors']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_app_quality_daily','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_app_quality_daily WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_app_acquisition_daily: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date',to_jsonb(t)->'platform',to_jsonb(t)->'source',to_jsonb(t)->'campaign') AS grain_key
 FROM public.staging_app_acquisition_daily t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['spend','installs','registrations','first_buyers','revenue']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_app_acquisition_daily','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_app_acquisition_daily WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_app_users: event/date field registered_at; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'registered_at')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'user_id_hash') AS grain_key
 FROM public.staging_app_users t
 WHERE t.registered_at >= DATE '2025-10-24' AND t.registered_at < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY[]::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_app_users','time_basis','registered_at',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_app_users WHERE registered_at IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_app_orders: event/date field ordered_at; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'ordered_at')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'order_id') AS grain_key
 FROM public.staging_app_orders t
 WHERE t.ordered_at >= DATE '2025-10-24' AND t.ordered_at < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['revenue','contribution_margin']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_app_orders','time_basis','ordered_at',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_app_orders WHERE ordered_at IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_google_merchant_performance: event/date field date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'date',to_jsonb(t)->'product_id') AS grain_key
 FROM public.staging_google_merchant_performance t
 WHERE t.date >= DATE '2025-10-24' AND t.date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['impressions','clicks','conversions']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_google_merchant_performance','time_basis','date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_google_merchant_performance WHERE date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_google_merchant_catalog: event/date field last_update_date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'last_update_date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'product_id') AS grain_key
 FROM public.staging_google_merchant_catalog t
 WHERE t.last_update_date >= DATE '2025-10-24' AND t.last_update_date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['price']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_google_merchant_catalog','time_basis','last_update_date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_google_merchant_catalog WHERE last_update_date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_google_merchant_status: event/date field snapshot_date; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'snapshot_date')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'snapshot_date',to_jsonb(t)->'country',to_jsonb(t)->'reporting_context') AS grain_key
 FROM public.staging_google_merchant_status t
 WHERE t.snapshot_date >= DATE '2025-10-24' AND t.snapshot_date < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['active_count','disapproved_count','pending_count']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_google_merchant_status','time_basis','snapshot_date',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_google_merchant_status WHERE snapshot_date IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_ga4_landing_snapshot: event/date field period_end; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'period_end')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'period_end',to_jsonb(t)->'period_days',to_jsonb(t)->'landing_page') AS grain_key
 FROM public.digital_ga4_landing_snapshot t
 WHERE t.period_end >= DATE '2025-10-24' AND t.period_end < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['sessions','purchases','purchase_revenue']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_ga4_landing_snapshot','time_basis','period_end',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_ga4_landing_snapshot WHERE period_end IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_search_query_snapshot: event/date field period_end; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'period_end')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'period_end',to_jsonb(t)->'period_days',to_jsonb(t)->'query') AS grain_key
 FROM public.digital_search_query_snapshot t
 WHERE t.period_end >= DATE '2025-10-24' AND t.period_end < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['clicks','impressions','position']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_search_query_snapshot','time_basis','period_end',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_search_query_snapshot WHERE period_end IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_search_page_snapshot: event/date field period_end; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'period_end')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'period_end',to_jsonb(t)->'period_days',to_jsonb(t)->'page') AS grain_key
 FROM public.digital_search_page_snapshot t
 WHERE t.period_end >= DATE '2025-10-24' AND t.period_end < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['clicks','impressions','position']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_search_page_snapshot','time_basis','period_end',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_search_page_snapshot WHERE period_end IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_google_ads_campaign_snapshot: event/date field period_end; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'period_end')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'period_end',to_jsonb(t)->'period_days',to_jsonb(t)->'campaign_name') AS grain_key
 FROM public.digital_google_ads_campaign_snapshot t
 WHERE t.period_end >= DATE '2025-10-24' AND t.period_end < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['cost','clicks','impressions','conversions','conversion_value']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_google_ads_campaign_snapshot','time_basis','period_end',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_google_ads_campaign_snapshot WHERE period_end IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- digital_pagespeed_snapshot: event/date field captured_on; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'captured_on')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'captured_on') AS grain_key
 FROM public.digital_pagespeed_snapshot t
 WHERE t.captured_on >= DATE '2025-10-24' AND t.captured_on < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['desktop_score','mobile_score','desktop_lcp','mobile_lcp']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','digital_pagespeed_snapshot','time_basis','captured_on',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.digital_pagespeed_snapshot WHERE captured_on IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- staging_pagespeed_windsor: event/date field imported_at; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>'imported_at')::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(to_jsonb(t)->'account_id') AS grain_key
 FROM public.staging_pagespeed_windsor t
 WHERE t.imported_at >= DATE '2025-10-24' AND t.imported_at < DATE '2026-10-24'
), coverage AS (
 SELECT w.period, w.lo, w.hi, count(d.j) AS rows, count(DISTINCT d.event_time::date) AS observed_dates,
   count(d.j)-count(DISTINCT d.grain_key) AS duplicate_key_excess,
   count(d.j) FILTER (WHERE d.grain_key @> '[null]'::jsonb) AS unknown_key_rows,
   min(d.event_time) AS earliest_event, max(d.event_time) AS latest_event,
   max((d.j->>'imported_at')::timestamptz) AS latest_receipt,
   DATE '2026-10-24' - max(d.event_time::date) AS event_age_days_at_cutoff,
   ARRAY(SELECT day::date FROM generate_series(w.lo,w.hi,interval '1 day') AS day
     EXCEPT SELECT x.event_time::date FROM data x WHERE x.event_time::date BETWEEN w.lo AND w.hi ORDER BY 1) AS missing_dates
 FROM windows w LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi
 GROUP BY w.period,w.lo,w.hi
), metrics AS (
 SELECT w.period, m.metric, d.j->>'account_id' AS account_id,
   coalesce(d.j->>'account_currency',d.j->>'currency_code') AS currency,
   CASE WHEN m.metric IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     THEN 'NONADDITIVE_DIAGNOSTIC_ONLY' ELSE 'ADDITIVE_STORED_VALUES; upstream completeness UNKNOWN' END AS aggregation_semantics,
   count(d.j) AS rows,
   count(d.j) FILTER (WHERE d.j->>m.metric IS NULL) AS unknown_rows,
   sum((d.j->>m.metric)::numeric) AS known_value_sum,
   CASE WHEN m.metric NOT IN ('active_users','followers','reach','position','price','desktop_score','mobile_score','desktop_lcp','mobile_lcp')
     AND count(d.j)>0 AND count(d.j->>m.metric)=count(d.j)
     THEN sum((d.j->>m.metric)::numeric) END AS complete_stored_total
 FROM windows w CROSS JOIN unnest(ARRAY['desktop_score','mobile_score']::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation','staging_pagespeed_windsor','time_basis','imported_at',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.staging_pagespeed_windsor WHERE imported_at IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));

-- google_ads: field-level raw/curated stored parity, not upstream/account/currency completeness.
WITH raw AS (
 SELECT date AS date_id, count(*) AS rows,
 CASE WHEN count(cost)=count(*) THEN sum(cost) END AS cost, count(*)-count(cost) AS cost_unknown,
 CASE WHEN count(clicks)=count(*) THEN sum(clicks) END AS clicks, count(*)-count(clicks) AS clicks_unknown,
 CASE WHEN count(impressions)=count(*) THEN sum(impressions) END AS impressions, count(*)-count(impressions) AS impressions_unknown,
 CASE WHEN count(conversions)=count(*) THEN sum(conversions) END AS conversions, count(*)-count(conversions) AS conversions_unknown,
 CASE WHEN count(conversions_value)=count(*) THEN sum(conversions_value) END AS conversion_value, count(*)-count(conversions_value) AS conversion_value_unknown
 FROM public.staging_google_ads_windsor WHERE date BETWEEN DATE '2026-09-24' AND DATE '2026-10-23'
 GROUP BY date
), curated AS (
 SELECT * FROM public.digital_google_ads_daily WHERE date_id BETWEEN DATE '2026-09-24' AND DATE '2026-10-23'
), joined AS (
 SELECT r.date_id IS NULL OR c.date_id IS NULL OR
 (r.cost,r.clicks,r.impressions,r.conversions,r.conversion_value) IS DISTINCT FROM (c.cost,c.clicks,c.impressions,c.conversions,c.conversion_value) AS mismatch,
 coalesce(r.cost_unknown,0)>0 OR c.cost IS NULL OR coalesce(r.clicks_unknown,0)>0 OR c.clicks IS NULL OR coalesce(r.impressions_unknown,0)>0 OR c.impressions IS NULL OR coalesce(r.conversions_unknown,0)>0 OR c.conversions IS NULL OR coalesce(r.conversion_value_unknown,0)>0 OR c.conversion_value IS NULL AS unknown_fields
 FROM raw r FULL JOIN curated c USING(date_id)
)
SELECT jsonb_build_object('check_name','google_ads_raw_curated_current30','joined_rows',count(*),
 'mismatch_rows',count(*) FILTER(WHERE mismatch),'unknown_field_rows',count(*) FILTER(WHERE unknown_fields),
 'upstream_completeness','UNKNOWN','account_currency_parity','UNKNOWN') FROM joined;

-- ga4: field-level raw/curated stored parity, not upstream/account/currency completeness.
WITH raw AS (
 SELECT date AS date_id, count(*) AS rows,
 CASE WHEN count(sessions)=count(*) THEN sum(sessions) END AS sessions, count(*)-count(sessions) AS sessions_unknown,
 CASE WHEN count(ecommerce_purchases)=count(*) THEN sum(ecommerce_purchases) END AS purchases, count(*)-count(ecommerce_purchases) AS purchases_unknown,
 CASE WHEN count(purchase_revenue)=count(*) THEN sum(purchase_revenue) END AS purchase_revenue, count(*)-count(purchase_revenue) AS purchase_revenue_unknown
 FROM public.staging_ga4_daily_windsor WHERE date BETWEEN DATE '2026-09-24' AND DATE '2026-10-23'
 GROUP BY date
), curated AS (
 SELECT * FROM public.digital_ga4_daily WHERE date_id BETWEEN DATE '2026-09-24' AND DATE '2026-10-23'
), joined AS (
 SELECT r.date_id IS NULL OR c.date_id IS NULL OR
 (r.sessions,r.purchases,r.purchase_revenue) IS DISTINCT FROM (c.sessions,c.purchases,c.purchase_revenue) AS mismatch,
 coalesce(r.sessions_unknown,0)>0 OR c.sessions IS NULL OR coalesce(r.purchases_unknown,0)>0 OR c.purchases IS NULL OR coalesce(r.purchase_revenue_unknown,0)>0 OR c.purchase_revenue IS NULL AS unknown_fields
 FROM raw r FULL JOIN curated c USING(date_id)
)
SELECT jsonb_build_object('check_name','ga4_raw_curated_current30','joined_rows',count(*),
 'mismatch_rows',count(*) FILTER(WHERE mismatch),'unknown_field_rows',count(*) FILTER(WHERE unknown_fields),
 'upstream_completeness','UNKNOWN','account_currency_parity','UNKNOWN') FROM joined;

-- gsc: field-level raw/curated stored parity, not upstream/account/currency completeness.
WITH raw AS (
 SELECT date AS date_id, count(*) AS rows,
 CASE WHEN count(clicks)=count(*) THEN sum(clicks) END AS clicks, count(*)-count(clicks) AS clicks_unknown,
 CASE WHEN count(impressions)=count(*) THEN sum(impressions) END AS impressions, count(*)-count(impressions) AS impressions_unknown
 FROM public.staging_searchconsole_daily_windsor WHERE date BETWEEN DATE '2026-09-24' AND DATE '2026-10-23'
 GROUP BY date
), curated AS (
 SELECT * FROM public.digital_search_daily WHERE date_id BETWEEN DATE '2026-09-24' AND DATE '2026-10-23'
), joined AS (
 SELECT r.date_id IS NULL OR c.date_id IS NULL OR
 (r.clicks,r.impressions) IS DISTINCT FROM (c.clicks,c.impressions) AS mismatch,
 coalesce(r.clicks_unknown,0)>0 OR c.clicks IS NULL OR coalesce(r.impressions_unknown,0)>0 OR c.impressions IS NULL AS unknown_fields
 FROM raw r FULL JOIN curated c USING(date_id)
)
SELECT jsonb_build_object('check_name','gsc_raw_curated_current30','joined_rows',count(*),
 'mismatch_rows',count(*) FILTER(WHERE mismatch),'unknown_field_rows',count(*) FILTER(WHERE unknown_fields),
 'upstream_completeness','UNKNOWN','account_currency_parity','UNKNOWN') FROM joined;

-- gbp: field-level raw/curated stored parity, not upstream/account/currency completeness.
WITH raw AS (
 SELECT date AS date_id,location_id, count(*) AS rows,
 CASE WHEN count(impressions)=count(*) THEN sum(impressions) END AS impressions, count(*)-count(impressions) AS impressions_unknown,
 CASE WHEN count(clicks)=count(*) THEN sum(clicks) END AS clicks, count(*)-count(clicks) AS clicks_unknown,
 CASE WHEN count(call_clicks)=count(*) THEN sum(call_clicks) END AS call_clicks, count(*)-count(call_clicks) AS call_clicks_unknown,
 CASE WHEN count(website_clicks)=count(*) THEN sum(website_clicks) END AS website_clicks, count(*)-count(website_clicks) AS website_clicks_unknown,
 CASE WHEN count(direction_requests)=count(*) THEN sum(direction_requests) END AS direction_requests, count(*)-count(direction_requests) AS direction_requests_unknown,
 CASE WHEN count(business_food_menu_clicks)=count(*) THEN sum(business_food_menu_clicks) END AS menu_clicks, count(*)-count(business_food_menu_clicks) AS menu_clicks_unknown
 FROM public.staging_gbp_windsor WHERE date BETWEEN DATE '2026-09-24' AND DATE '2026-10-23'
 GROUP BY date,location_id
), curated AS (
 SELECT * FROM public.digital_gbp_daily WHERE date_id BETWEEN DATE '2026-09-24' AND DATE '2026-10-23'
), joined AS (
 SELECT r.date_id IS NULL OR c.date_id IS NULL OR
 (r.impressions,r.clicks,r.call_clicks,r.website_clicks,r.direction_requests,r.menu_clicks) IS DISTINCT FROM (c.impressions,c.clicks,c.call_clicks,c.website_clicks,c.direction_requests,c.menu_clicks) AS mismatch,
 coalesce(r.impressions_unknown,0)>0 OR c.impressions IS NULL OR coalesce(r.clicks_unknown,0)>0 OR c.clicks IS NULL OR coalesce(r.call_clicks_unknown,0)>0 OR c.call_clicks IS NULL OR coalesce(r.website_clicks_unknown,0)>0 OR c.website_clicks IS NULL OR coalesce(r.direction_requests_unknown,0)>0 OR c.direction_requests IS NULL OR coalesce(r.menu_clicks_unknown,0)>0 OR c.menu_clicks IS NULL AS unknown_fields
 FROM raw r FULL JOIN curated c USING(date_id,location_id)
)
SELECT jsonb_build_object('check_name','gbp_raw_curated_current30','joined_rows',count(*),
 'mismatch_rows',count(*) FILTER(WHERE mismatch),'unknown_field_rows',count(*) FILTER(WHERE unknown_fields),
 'upstream_completeness','UNKNOWN','account_currency_parity','UNKNOWN') FROM joined;

-- Proven field mapping only; account/currency separation must additionally be inspected.
WITH joined AS (
 SELECT r.date,r.account_id,r.campaign_id,
   r.date IS NULL OR c.date IS NULL OR
   (r.account_name,r.campaign,r.objective,r.reach,r.imported_at,r.spend,r.impressions,r.clicks,r.actions_link_click,
    r.actions_offsite_conversion_fb_pixel_purchase,r.action_values_offsite_conversion_fb_pixel_purchase,r.account_currency)
   IS DISTINCT FROM
   (c.account_name,c.campaign_name,c.objective,c.reach,c.imported_at,c.spend,c.impressions,c.clicks,c.link_clicks,c.purchases,c.purchase_value,c.account_currency) AS mismatch
 FROM public.staging_meta_ads_windsor r
 FULL JOIN (SELECT * FROM public.staging_meta_ads_daily WHERE ingestion_source='windsor_facebook' AND adset_id='' AND ad_id='') c
 ON (r.date,r.account_id,r.campaign_id)=(c.date,c.account_id,c.campaign_id)
 WHERE coalesce(r.date,c.date) BETWEEN DATE '2026-09-24' AND DATE '2026-10-23'
)
SELECT 'meta_raw_curated_current30' AS check_name,count(*) AS joined_rows,
 count(*) FILTER(WHERE mismatch) AS mismatch_rows FROM joined;
-- Account IDs/currencies are metadata, not credentials; never publish customer/order keys.
SELECT account_id,account_currency,min(date),max(date),count(*) AS rows
FROM public.staging_meta_ads_windsor
WHERE date >= DATE '2025-10-24' AND date < DATE '2026-10-24' GROUP BY account_id,account_currency;
-- RLS/grants can be inspected without changing policy or selecting business rows.
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('fact_sales_daily','bi_sales_flat_mv','staging_meta_ads_windsor','staging_meta_ads_daily');
ROLLBACK;
