// Generate SELECT-only aggregate diagnostics. Does not connect or execute SQL.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const target=fileURLToPath(new URL('../docs/audit/2026-10-24/read-only-qa.sql',import.meta.url));
export const specs=[
 ['fact_sales_daily','date_id','date_id location_id brand_id ownership_id channel_id order_type_id','revenue checks markup'],
 ['digital_ga4_daily','date_id','date_id','sessions purchases purchase_revenue engaged_sessions active_users'],
 ['digital_ga4_channel_daily','date_id','date_id channel','sessions purchases purchase_revenue'],
 ['digital_ga4_device_daily','date_id','date_id device','sessions purchases purchase_revenue'],
 ['digital_ga4_landing_daily','date_id','date_id landing_page','sessions purchases purchase_revenue'],
 ['digital_search_daily','date_id','date_id','clicks impressions position'],
 ['digital_search_query_daily','date_id','date_id query','clicks impressions position'],
 ['digital_search_page_daily','date_id','date_id page','clicks impressions position'],
 ['digital_google_ads_daily','date_id','date_id','cost clicks impressions conversions conversion_value'],
 ['staging_google_ads_windsor','date','date account_id campaign_id','cost clicks impressions conversions_value conversions'],
 ['staging_ga4_daily_windsor','date','date','sessions ecommerce_purchases purchase_revenue'],
 ['staging_searchconsole_daily_windsor','date','date','clicks impressions position'],
 ['digital_gbp_daily','date_id','date_id location_id','impressions clicks call_clicks website_clicks direction_requests menu_clicks'],
 ['staging_gbp_windsor','date','date location_id','impressions clicks call_clicks website_clicks direction_requests business_food_menu_clicks'],
 ['staging_meta_ads_windsor','date','date account_id campaign_id','spend impressions clicks actions_link_click actions_offsite_conversion_fb_pixel_purchase action_values_offsite_conversion_fb_pixel_purchase'],
 ['staging_meta_ads_daily','date','date account_id campaign_id adset_id ad_id','spend impressions clicks link_clicks purchases purchase_value'],
 ['staging_facebook_organic_daily','date','date','followers daily_follows daily_unfollows impressions organic_impressions page_views'],
 ['staging_facebook_organic_posts','created_at','post_id','impressions reach engagements clicks'],
 ['staging_instagram_organic_daily','date','date','followers reach impressions profile_views website_clicks'],
 ['staging_instagram_organic_media','published_at','media_id','reach impressions'],
 ['staging_app_store_daily','date','date platform','downloads first_time_downloads installations'],
 ['staging_app_firebase_daily','date','date platform','first_opens sign_ups purchases purchase_revenue'],
 ['staging_app_quality_daily','date','date platform app_version','crashes anr checkout_errors'],
 ['staging_app_acquisition_daily','date','date platform source campaign','spend installs registrations first_buyers revenue'],
 ['staging_app_users','registered_at','user_id_hash',''],
 ['staging_app_orders','ordered_at','order_id','revenue contribution_margin'],
 ['staging_google_merchant_performance','date','date product_id','impressions clicks conversions'],
 ['staging_google_merchant_catalog','last_update_date','product_id','price'],
 ['staging_google_merchant_status','snapshot_date','snapshot_date country reporting_context','active_count disapproved_count pending_count'],
 ['digital_ga4_landing_snapshot','period_end','period_end period_days landing_page','sessions purchases purchase_revenue'],
 ['digital_search_query_snapshot','period_end','period_end period_days query','clicks impressions position'],
 ['digital_search_page_snapshot','period_end','period_end period_days page','clicks impressions position'],
 ['digital_google_ads_campaign_snapshot','period_end','period_end period_days campaign_name','cost clicks impressions conversions conversion_value'],
 ['digital_pagespeed_snapshot','captured_on','captured_on','desktop_score mobile_score desktop_lcp mobile_lcp'],
 // Processing date only: never treat imported_at as a source observation.
 ['staging_pagespeed_windsor','imported_at','account_id','desktop_score mobile_score']
];
const literal=s=>`'${s.replaceAll("'","''")}'`;
const statements=specs.map(([table,date,keys,fields])=>{
  const metricNames=fields.split(' ').filter(Boolean);
  return `-- ${table}: event/date field ${date}; snapshot dates are NOT daily observations.
WITH windows AS (
 SELECT 'current30' AS period, DATE '2026-09-24' AS lo, DATE '2026-10-23' AS hi
 UNION ALL SELECT 'prior30', DATE '2026-08-25', DATE '2026-09-23'
 UNION ALL SELECT 'trailing12months', DATE '2025-10-24', DATE '2026-10-23'
 UNION ALL SELECT 'month_' || to_char(d,'YYYY-MM'), greatest(d::date,DATE '2025-10-24'),
   least((d + interval '1 month - 1 day')::date,DATE '2026-10-23')
 FROM generate_series(DATE '2025-10-01',DATE '2026-10-01',interval '1 month') AS d
), data AS MATERIALIZED (
 SELECT to_jsonb(t) AS j, (to_jsonb(t)->>${literal(date)})::timestamptz AT TIME ZONE 'UTC' AS event_time,
   jsonb_build_array(${keys.split(' ').map(k=>`to_jsonb(t)->${literal(k)}`).join(',')}) AS grain_key
 FROM public.${table} t
 WHERE t.${date} >= DATE '2025-10-24' AND t.${date} < DATE '2026-10-24'
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
 FROM windows w CROSS JOIN unnest(ARRAY[${metricNames.map(literal).join(',')}]::text[]) AS m(metric)
 LEFT JOIN data d ON d.event_time::date BETWEEN w.lo AND w.hi GROUP BY w.period,m.metric,d.j->>'account_id',coalesce(d.j->>'account_currency',d.j->>'currency_code')
)
SELECT jsonb_build_object('relation',${literal(table)},'time_basis','${date}',
 'measurement_semantics','UNKNOWN; stocks/reach/position/snapshots are not additive',
 'bounded_12month_range',(SELECT jsonb_build_object('rows',count(*),'min_event',min(event_time),'max_event',max(event_time),
   'scope','dated rows only; null dates excluded; not full historical count') FROM data),
 'null_date_probe_rows_capped_1001',(SELECT count(*) FROM (SELECT 1 FROM public.${table} WHERE ${date} IS NULL LIMIT 1001) AS probe),
 'coverage',(SELECT jsonb_agg(to_jsonb(c) ORDER BY period) FROM coverage c),
 'metrics',(SELECT jsonb_agg(to_jsonb(m) ORDER BY period,metric) FROM metrics m));`;
});
const mappings=[
 ['google_ads','staging_google_ads_windsor','digital_google_ads_daily',[['cost','cost'],['clicks','clicks'],['impressions','impressions'],['conversions','conversions'],['conversions_value','conversion_value']]],
 ['ga4','staging_ga4_daily_windsor','digital_ga4_daily',[['sessions','sessions'],['ecommerce_purchases','purchases'],['purchase_revenue','purchase_revenue']]],
 ['gsc','staging_searchconsole_daily_windsor','digital_search_daily',[['clicks','clicks'],['impressions','impressions']]],
 ['gbp','staging_gbp_windsor','digital_gbp_daily',[['impressions','impressions'],['clicks','clicks'],['call_clicks','call_clicks'],['website_clicks','website_clicks'],['direction_requests','direction_requests'],['business_food_menu_clicks','menu_clicks']]]
];
const mappingQueries=mappings.map(([name,raw,curated,fields])=>{
 const location=name==='gbp';
 return `-- ${name}: field-level raw/curated stored parity, not upstream/account/currency completeness.
WITH raw AS (
 SELECT date AS date_id${location?',location_id':''}, count(*) AS rows,
 ${fields.map(([r,c])=>`CASE WHEN count(${r})=count(*) THEN sum(${r}) END AS ${c}, count(*)-count(${r}) AS ${c}_unknown`).join(',\n ')}
 FROM public.${raw} WHERE date BETWEEN DATE '2026-09-24' AND DATE '2026-10-23'
 GROUP BY date${location?',location_id':''}
), curated AS (
 SELECT * FROM public.${curated} WHERE date_id BETWEEN DATE '2026-09-24' AND DATE '2026-10-23'
), joined AS (
 SELECT r.date_id IS NULL OR c.date_id IS NULL OR
 (${fields.map(([,c])=>`r.${c}`).join(',')}) IS DISTINCT FROM (${fields.map(([,c])=>`c.${c}`).join(',')}) AS mismatch,
 ${fields.map(([,c])=>`coalesce(r.${c}_unknown,0)>0 OR c.${c} IS NULL`).join(' OR ')} AS unknown_fields
 FROM raw r FULL JOIN curated c USING(date_id${location?',location_id':''})
)
SELECT jsonb_build_object('check_name','${name}_raw_curated_current30','joined_rows',count(*),
 'mismatch_rows',count(*) FILTER(WHERE mismatch),'unknown_field_rows',count(*) FILTER(WHERE unknown_fields),
 'upstream_completeness','UNKNOWN','account_currency_parity','UNKNOWN') FROM joined;`;
}).join('\n\n');
let text=`-- Issue #43, dated 2026-10-24. Production NOT EXECUTED. Not a migration. No RPCs invoked.
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
${specs.flatMap(([table,date,keys,fields])=>[...new Set([date,...keys.split(' '),...fields.split(' ').filter(Boolean)])].map(field=>` (${literal(table)},${literal(field)})`)).join(',\n')}
) SELECT e.* FROM expected e LEFT JOIN information_schema.columns c
 ON c.table_schema='public' AND c.table_name=e.relation AND c.column_name=e.column_name
 WHERE c.column_name IS NULL;
\n`+statements.join('\n\n')+`\n
${mappingQueries}

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
`;
if(process.argv[1] === fileURLToPath(import.meta.url)) {
  if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==text)throw Error('Read-only SQL is stale');}
  else fs.writeFileSync(target,text);
  console.log(`${specs.length} relation diagnostics prepared; SQL execution NOT performed`);
}
