-- ISOLATED SYNTHETIC DATABASE ONLY. No production data or credentials.
-- psql -v ON_ERROR_STOP=1 -f docs/sql/gbp-valid-observations-fixture-ISOLATED-ONLY.sql
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
  IF to_regclass('public.digital_gbp_daily') IS NOT NULL OR to_regclass('public.bi_runtime_config') IS NOT NULL THEN
    RAISE EXCEPTION 'Use a fresh isolated database; existing application tables detected';
  END IF;
END $guard$;
CREATE SCHEMA IF NOT EXISTS extensions;
-- Isolated digest shim: exercises the unchanged password comparison without pgcrypto setup.
CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS 'SELECT sha256(convert_to($1,''UTF8''))';
CREATE TABLE public.bi_runtime_config(config_key text,value_hash text);
INSERT INTO public.bi_runtime_config VALUES('access_password',encode(extensions.digest('fixture-password','sha256'),'hex'));
CREATE TABLE public.staging_gbp_windsor(date date,location_id text,location_title text,impressions bigint,clicks bigint,call_clicks bigint,website_clicks bigint,direction_requests bigint,business_food_menu_clicks bigint,imported_at timestamptz);
CREATE TABLE public.digital_gbp_daily(date_id date,location_id text,location_title text,impressions bigint,clicks bigint,call_clicks bigint,website_clicks bigint,direction_requests bigint,menu_clicks bigint,imported_at timestamptz,PRIMARY KEY(date_id,location_id));
CREATE TABLE public.staging_ga4_daily_windsor(date date,sessions bigint,active_users bigint,engaged_sessions bigint,add_to_carts bigint,checkouts bigint,ecommerce_purchases bigint,purchase_revenue numeric);
CREATE TABLE public.digital_ga4_daily(date_id date PRIMARY KEY,sessions bigint,active_users bigint,engaged_sessions bigint,add_to_carts bigint,checkouts bigint,purchases bigint,purchase_revenue numeric,imported_at timestamptz);
CREATE TABLE public.staging_searchconsole_daily_windsor(date date,clicks bigint,impressions bigint,position numeric);
CREATE TABLE public.digital_search_daily(date_id date PRIMARY KEY,clicks bigint,impressions bigint,position numeric,imported_at timestamptz);
CREATE TABLE public.staging_google_ads_windsor(date date,campaign_name text,campaign_id text,cost numeric,clicks bigint,impressions bigint,conversions numeric,conversions_value numeric);
CREATE TABLE public.digital_google_ads_daily(date_id date PRIMARY KEY,cost numeric,clicks bigint,impressions bigint,conversions numeric,conversion_value numeric,imported_at timestamptz);
CREATE TABLE public.digital_google_ads_campaign_snapshot(period_end date,period_days int,campaign_name text,cost numeric,clicks bigint,impressions bigint,conversions numeric,conversion_value numeric,imported_at timestamptz);
CREATE TABLE public.staging_pagespeed_windsor(account_id text,desktop_score numeric,mobile_score numeric,crux_desktop_lcp numeric,crux_desktop_inp numeric,crux_desktop_cls numeric,crux_mobile_lcp numeric,crux_mobile_inp numeric,crux_mobile_cls numeric,crux_desktop_overall_category text,crux_mobile_overall_category text);
CREATE TABLE public.digital_pagespeed_snapshot(captured_on date PRIMARY KEY,imported_at timestamptz,desktop_score numeric,mobile_score numeric,desktop_lcp numeric,desktop_inp numeric,desktop_cls numeric,mobile_lcp numeric,mobile_inp numeric,mobile_cls numeric,desktop_category text,mobile_category text);
SET LOCAL bi.gbp_draft_authorized='isolated-fixture';
\ir gbp-valid-observations-NOT-APPLIED.sql

-- Four profiles × 32 days: the valid 30-day window ends November 12.
INSERT INTO public.staging_gbp_windsor
SELECT d::date,'locations/'||id,'Synthetic profile',10,0,0,0,0,0,now()
FROM generate_series('2026-10-12'::date,'2026-11-12'::date,'1 day'::interval) d CROSS JOIN generate_series(1,4) id;
INSERT INTO public.staging_gbp_windsor
SELECT d::date,'reads are paused','These are not your real numbers',999999,999,999,999,999,999,now()
FROM generate_series('2026-11-14'::date,'2026-11-17'::date,'1 day'::interval) d;
-- A syntactically valid ID with provider-error title must also be rejected.
INSERT INTO public.staging_gbp_windsor VALUES('2026-11-17','locations/5','Billing error',999999,0,0,0,0,0,now());
-- Existing polluted curated evidence is retained and ignored, including unknown IDs.
INSERT INTO public.digital_gbp_daily VALUES('2026-11-17','bad-id','Fake profile',999999,0,0,0,0,0,now());
INSERT INTO public.digital_pagespeed_snapshot(captured_on,mobile_score) VALUES('2026-11-17',80);
INSERT INTO public.staging_ga4_daily_windsor VALUES('2026-11-12',2,1,1,0,0,0,0);
INSERT INTO public.staging_searchconsole_daily_windsor VALUES('2026-11-12',3,10,4);
INSERT INTO public.staging_google_ads_windsor VALUES('2026-11-12','Synthetic campaign','synthetic',5,2,20,1,10);
DO $test$ DECLARE result jsonb; p jsonb; BEGIN
  result:=public.refresh_digital_google_models();
  ASSERT (result->>'gbpDailyRows')::int=128,'only valid GBP rows promoted';
  ASSERT (result->>'gbpRejectedRows')::int=5,'all provider errors rejected';
  ASSERT (SELECT count(*) FROM public.staging_gbp_windsor)=133,'source evidence preserved';
  ASSERT (SELECT count(*) FROM public.digital_gbp_daily)=129,'old invalid curated evidence retained';
  ASSERT (SELECT count(*) FROM public.digital_ga4_daily)=1,'GA4 refresh retained';
  ASSERT (SELECT count(*) FROM public.digital_search_daily)=1,'Search refresh retained';
  ASSERT (SELECT count(*) FROM public.digital_google_ads_daily)=1,'Ads refresh retained';
  p:=public.bi_digital_local_payload('fixture-password');
  ASSERT p#>>'{meta,gbpObservationContract}'='gbp-valid-observations-v1','validated contract';
  ASSERT p#>>'{meta,to}'='2026-11-12','valid business cutoff';
  ASSERT p#>>'{meta,validThrough}'='2026-11-12','explicit historical cutoff';
  ASSERT p#>>'{meta,from}'='2026-10-14','30-day window uses valid cutoff';
  ASSERT (p#>>'{meta,rows}')::int=120,'observed rows in valid window';
  ASSERT (p#>>'{meta,observedDates}')::int=30,'observed valid dates';
  ASSERT jsonb_array_length(p->'locations')=4,'no pseudo-location';
  ASSERT (p#>>'{summary,impressions}')::int=1200,'no provider error contamination';
  ASSERT (p#>>'{summary,calls}')::int=0,'measured zero preserved';
  ASSERT p#>>'{meta,status}'='error','source error remains visible';
  ASSERT p#>>'{meta,latestRejectedBusinessDate}'='2026-11-17','rejected date separate';
  ASSERT (p#>>'{meta,rejectedStagingRows}')::int=5,'staging rejection metadata';
  ASSERT (p#>>'{meta,rejectedCuratedRows}')::int=1,'curated rejection metadata';
  ASSERT p#>>'{pageSpeed,captured_on}'='2026-11-17','independent PageSpeed retained';
  ASSERT position('reads are paused' in p::text)=0,'provider raw prose excluded';
  BEGIN
    PERFORM public.bi_digital_local_payload('wrong-password');
    RAISE EXCEPTION 'password guard bypassed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'unauthorized' THEN RAISE; END IF;
  END;
END $test$;
-- Empty/only-invalid evidence cannot invent freshness or measured zero.
TRUNCATE public.staging_gbp_windsor,public.digital_gbp_daily;
INSERT INTO public.staging_gbp_windsor VALUES('2026-11-17','error','Billing limit',0,0,0,0,0,0,now());
DO $test$ DECLARE p jsonb; BEGIN
  PERFORM public.refresh_digital_google_models();
  p:=public.bi_digital_local_payload('fixture-password');
  ASSERT p#>'{meta,to}'='null'::jsonb,'invalid-only has no business cutoff';
  ASSERT p#>'{summary,calls}'='null'::jsonb,'invalid-only not zero';
  ASSERT jsonb_array_length(p->'locations')=0,'invalid-only no profile';
  ASSERT p#>>'{meta,status}'='error','invalid-only warning';
END $test$;
ROLLBACK;
