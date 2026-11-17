-- NEW EMPTY LOCAL PostgreSQL DB ONLY. Never Supabase/production.
-- psql -v ON_ERROR_STOP=1 -f this-file.sql; all fixture changes rolled back.
BEGIN;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE TABLE public.bi_runtime_config(config_key text,value_hash text);
INSERT INTO public.bi_runtime_config VALUES('access_password',encode(extensions.digest('fixture-only','sha256'),'hex'));
CREATE TABLE public.bi_sales_flat_mv(date date,order_type text,location text,brand text,ownership text,channel text,lfl_exclude boolean,revenue numeric,checks numeric,markup numeric);
INSERT INTO public.bi_sales_flat_mv VALUES
 ('2024-12-30','Courier','ISO','B1','Own','Доставка',false,4,1,1),
 ('2025-01-02','Courier','ISO','B1','Own','Доставка',false,5,1,1),
 ('2025-01-03','Courier','ISO','B1','Own','Доставка',false,999,1,1),
 ('2026-01-01','Courier','ISO','B1','Own','Доставка',false,10,1,2),
 ('2026-01-01','Courier','ISO','B1','Own','Доставка',true,9999,1,2),
 ('2019-12-27','Courier','W53','B1','Own','Доставка',false,50,1,1),
 ('2020-12-28','Courier','W53','B1','Own','Доставка',false,100,1,20),
 ('2021-01-01','Courier','W53','B1','Own','Доставка',false,200,2,40),
 ('2025-01-02','Courier','Zero','B1','Own','Доставка',false,0,0,0),
 ('2026-01-01','Courier','Zero','B1','Own','Доставка',false,20,2,4);
\ir iso-week-live-functions-NOT-APPLIED.sql
DO $test$
DECLARE p jsonb; blocked boolean:=false;
BEGIN
 p:=public.bi_delivery_payload(p_password=>'fixture-only',p_location=>'ISO',p_focus_year=>2026,p_grain=>'week',p_lfl=>true);
 ASSERT p#>>'{meta,weeklyContract}'='iso-year-week-elapsed-days-v1';
 ASSERT p#>'{meta,weeklyYears}'='[2025,2026]'::jsonb;
 ASSERT p#>>'{meta,weeklyCutoff}'='2026-01-01';
 ASSERT p#>'{meta,weeklyCalendarPartial}'='true'::jsonb;
 ASSERT (p#>>'{multiYearData,0,2025}')::numeric=9; -- Jan3 excluded to match Thursday cutoff.
 ASSERT (p#>>'{multiYearData,0,2026}')::numeric=10; -- LFL registry applied.
 ASSERT p#>'{meta,years}' @> '[2024]'::jsonb; -- Calendar navigation remains distinct.
 p:=public.bi_overview_payload(p_password=>'fixture-only',p_location=>'ISO',p_focus_year=>2026,p_period=>'week',p_grain=>'week',p_lfl=>true);
 ASSERT p#>'{meta,weeklyYears}'='[2025,2026]'::jsonb;
 ASSERT (p#>>'{multiYearData,0,2025}')::numeric=9;
 ASSERT (p#>>'{previous,revenue}')::numeric=9; -- Week KPI uses same ISO comparison.
 p:=public.bi_dynamics_payload(p_password=>'fixture-only',p_location=>'ISO',p_grain=>'week',p_lfl=>true);
 ASSERT p#>'{meta,years}'='[2025,2026]'::jsonb;
 ASSERT (p#>>'{series,0,2025}')::numeric=9;
 ASSERT (p#>>'{summary,latestYearTotal}')::numeric=10;
 ASSERT (p#>>'{summary,previousYearTotal}')::numeric=9;
 p:=public.bi_delivery_payload(p_password=>'fixture-only',p_location=>'W53',p_focus_year=>2021,p_grain=>'week');
 ASSERT jsonb_array_length(p->'multiYearData')=53;
 ASSERT p#>'{meta,weeklyYears}'='[2019,2020]'::jsonb;
 ASSERT (p#>>'{multiYearData,52,2020}')::numeric=300;
 ASSERT p#>'{multiYearData,52,2019}'='null'::jsonb;
 p:=public.bi_overview_payload(p_password=>'fixture-only',p_location=>'W53',p_focus_year=>2021,p_grain=>'week');
 ASSERT (p#>>'{multiYearData,52,2020}')::numeric=300;
 ASSERT p#>'{multiYearData,52,2019}'='null'::jsonb;
 p:=public.bi_dynamics_payload(p_password=>'fixture-only',p_location=>'W53',p_grain=>'week');
 ASSERT p#>>'{meta,latestYear}'='2020';
 ASSERT (p#>>'{series,52,2020}')::numeric=300;
 ASSERT p#>'{series,52,2019}'='null'::jsonb;
 p:=public.bi_dynamics_payload(p_password=>'fixture-only',p_location=>'Zero',p_grain=>'week');
 ASSERT p#>'{series,0,2025}'='0'::jsonb; -- Observed zero is preserved, not missing.
 BEGIN
   PERFORM public.bi_overview_payload(p_password=>'fixture-only',p_location=>'W53',p_focus_year=>2021,p_period=>'week',p_grain=>'week');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM='iso_comparison_unavailable'; END;
 ASSERT blocked,'Nonexistent comparison W53 must not become W01';
 blocked:=false;
 BEGIN
   PERFORM public.bi_delivery_payload(p_password=>'wrong',p_grain=>'week');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM='unauthorized'; END;
 ASSERT blocked,'Authentication unchanged';
END;
$test$;
ROLLBACK;
