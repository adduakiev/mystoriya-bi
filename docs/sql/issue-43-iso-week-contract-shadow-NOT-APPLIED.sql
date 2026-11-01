-- Issue #43 / existing PR #44. D160 ISO-week SELECT-only SHADOW; NOT APPLIED.
-- NOT a replacement function nor a migration. Never run in production as DDL.
-- D158 review-only functions retain the calendar YEAR + ISO WEEK defect.
-- Owner-gated eventual replacement needs ISOYEAR+WEEK together in Dynamics
-- stats.years, weekly joins, year_totals and cutoff; and in Overview weekly
-- chart keys, joins and cutoff. Preserve distinct CALENDAR years for the
-- Overview date navigation. Week 53 and Jan rollover need end-to-end tests.
-- Observation rows (Dynamics) differ from observation dates (Overview).
-- Missing point => NULL metrics, 0 observations; measured 0 => count > 0.
-- Weekly comparisons through cutoff_week can compare partial vs full weeks;
-- explicitly label partials before promoting any replacement RPC.
-- A) Source-to-ISO-week shadow. Edit parameters only for read-only cohort QA.
WITH parameters AS (
 SELECT NULL::text p_channel,NULL::text p_order_type,NULL::text p_location,
 NULL::text p_brand,NULL::text p_ownership,false::boolean p_lfl
), base AS MATERIALIZED (
 SELECT b.date,b.revenue,b.checks,b.markup FROM public.bi_sales_flat_mv b
 CROSS JOIN parameters p
 WHERE (p.p_channel IS NULL OR b.channel=p.p_channel)
 AND (p.p_order_type IS NULL OR b.order_type=p.p_order_type)
 AND (p.p_location IS NULL OR b.location=p.p_location)
 AND (p.p_brand IS NULL OR b.brand=p.p_brand)
 AND (p.p_ownership IS NULL OR b.ownership=p.p_ownership)
 AND (NOT p.p_lfl OR NOT b.lfl_exclude)
), scope AS (
 SELECT max(date) latest_date,extract(isoyear FROM max(date))::int latest_iso_year,
 extract(week FROM max(date))::int cutoff_week FROM base
), years AS (
 SELECT DISTINCT extract(isoyear FROM date)::int iso_year FROM base
), points AS (
 SELECT y.iso_year,w.week_no,s.latest_date,s.latest_iso_year,s.cutoff_week
 FROM years y CROSS JOIN scope s
 CROSS JOIN LATERAL generate_series(1,s.cutoff_week) w(week_no)
), observed AS (
 SELECT extract(isoyear FROM date)::int iso_year,
 extract(week FROM date)::int week_no,
 count(*)::int observation_rows,count(DISTINCT date)::int observation_days,
 sum(revenue) revenue,sum(checks) checks,sum(markup) markup
 FROM base GROUP BY 1,2
), cells AS (
 SELECT p.*,coalesce(o.observation_rows,0) observation_rows,
 coalesce(o.observation_days,0) observation_days,
 o.revenue,o.checks,o.markup
 FROM points p LEFT JOIN observed o USING (iso_year,week_no)
)
SELECT iso_year,week_no AS iso_week,'W'||lpad(week_no::text,2,'0') label,
 latest_date,latest_iso_year,cutoff_week,observation_rows,observation_days,
 revenue,checks,markup,
 CASE WHEN checks<>0 THEN revenue/checks ELSE NULL END average_check,
 CASE WHEN revenue<>0 THEN markup/revenue*100 ELSE NULL END markup_rate,
 sum(revenue) OVER(PARTITION BY iso_year) iso_ytd_revenue,
 sum(checks) OVER(PARTITION BY iso_year) iso_ytd_checks,
 (iso_year=latest_iso_year AND week_no=cutoff_week
 AND extract(isodow FROM latest_date)::int<7) current_week_calendar_partial
FROM cells ORDER BY iso_week,iso_year;
-- B) Synthetic ISO W53 and New Year SQL regression. Expect passed=true.
WITH fixture(date_id,revenue) AS (
 VALUES (date '2020-12-28',100::numeric),(date '2021-01-01',200),
 (date '2021-01-04',300),(date '2026-12-31',10),(date '2027-01-01',20)
), grouped AS (
 SELECT extract(isoyear FROM date_id)::int iso_year,
 extract(week FROM date_id)::int iso_week,sum(revenue) revenue
 FROM fixture GROUP BY 1,2
), expected(iso_year,iso_week,revenue) AS (
 VALUES (2020,53,300::numeric),(2021,1,300),(2026,53,30)
)
SELECT e.iso_year,e.iso_week,e.revenue expected_revenue,g.revenue actual_revenue,
 (e.revenue IS NOT DISTINCT FROM g.revenue) passed
FROM expected e LEFT JOIN grouped g USING(iso_year,iso_week)
ORDER BY e.iso_year,e.iso_week;
-- C) Exact installed function provenance; never extract credentials or call RPC.
SELECT proname,md5(pg_get_functiondef(oid)) installed_md5 FROM pg_proc
WHERE pronamespace='public'::regnamespace
AND proname IN ('bi_overview_payload','bi_dynamics_payload') ORDER BY proname;
