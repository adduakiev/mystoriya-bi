-- Disposable local database ONLY, created by scripts/dynamics-period-sql-fixture.mjs.
-- Every synthetic object and role is rolled back. No production data/credentials.
BEGIN;
SET LOCAL bi.fixture_mode='isolated-dynamics-period-comparison-v1';
DO $guard$ BEGIN
 IF current_database()<>'bi_fixture_dynamics_period_comparison' OR session_user<>'fixture'
 THEN RAISE EXCEPTION 'isolated_fixture_required'; END IF;
END $guard$;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.bi_runtime_config(config_key text,value_hash text);
INSERT INTO public.bi_runtime_config VALUES('access_password',encode(extensions.digest('fixture-only','sha256'),'hex'));
CREATE TABLE public.location_lifecycle_registry(canonical_name text,lfl_exclude boolean);
CREATE TABLE public.bi_sales_flat_mv(date date,location text,brand text,ownership text,channel text,order_type text,lfl_exclude boolean,revenue numeric,checks numeric,markup numeric);
CREATE FUNCTION public.bi_dynamics_payload() RETURNS text LANGUAGE sql AS $$ SELECT 'unchanged-old-rpc'::text $$;

INSERT INTO public.bi_sales_flat_mv
 SELECT d::date,'A','CompleteMonths','Own','Доставка','Courier',false,10,2,
   CASE extract(month FROM d) WHEN 1 THEN 2 WHEN 2 THEN 3 ELSE 4 END
 FROM generate_series(date '2025-12-01',date '2026-03-31',interval '1 day') d;
INSERT INTO public.bi_sales_flat_mv
 SELECT d::date,'A','PartialClamp','Own','Доставка','Courier',false,10,2,3
 FROM generate_series(date '2026-01-01',date '2026-03-30',interval '1 day') d;
INSERT INTO public.bi_sales_flat_mv
 SELECT d::date,'A','Partial15','Own','Доставка','Courier',false,10,2,3
 FROM generate_series(date '2026-01-01',date '2026-03-15',interval '1 day') d;
-- Outside the compared Feb1..15 and Mar1..15 windows: no cohort pollution.
INSERT INTO public.bi_sales_flat_mv VALUES
 ('2026-02-20','GapOnly','Partial15','Own','Доставка','Courier',false,5000,1,1),
 ('2026-02-20','A','Partial15','Own','Доставка','Courier',true,5000,1,1),
 ('2026-03-29','ClampedOnly','PartialClamp','Own','Доставка','Courier',false,5000,1,1);
INSERT INTO public.bi_sales_flat_mv
 SELECT d::date,'A',b,'Own','Доставка','Courier',false,10,2,3
 FROM (VALUES('W01after53',date '2020-12-28',date '2021-01-10'),
   ('W01after52',date '2021-12-27',date '2022-01-09'),
   ('W01partial',date '2020-12-28',date '2021-01-08'),
   ('W53partial',date '2020-12-21',date '2021-01-01')) q(b,a,z)
 CROSS JOIN LATERAL generate_series(a,z,interval '1 day') d;
INSERT INTO public.bi_sales_flat_mv
 SELECT d::date,l,'OpenClose','Own','Доставка','Courier',l='RegistryExcluded',10,2,3
 FROM (VALUES('A',date '2026-01-01',date '2026-02-28'),
   ('Opened',date '2026-02-01',date '2026-02-28'),
   ('Closed',date '2026-01-01',date '2026-01-31'),
   ('MissingDay',date '2026-01-01',date '2026-02-28'),
   ('RegistryExcluded',date '2026-01-01',date '2026-02-28')) q(l,a,z)
 CROSS JOIN LATERAL generate_series(a,z,interval '1 day') d
 WHERE NOT(l='MissingDay' AND d::date=date '2026-01-15');
INSERT INTO public.bi_sales_flat_mv
 SELECT d::date,'A','Zero','Own','Доставка','Courier',false,
   CASE WHEN extract(month FROM d)=1 THEN 0 ELSE 10 END,0,0
 FROM generate_series(date '2026-01-01',date '2026-02-15',interval '1 day') d;
INSERT INTO public.bi_sales_flat_mv
 SELECT d::date,'A','MissingMonth','Own','Доставка','Courier',false,10,2,3
 FROM generate_series(date '2025-12-01',date '2026-02-15',interval '1 day') d
 WHERE extract(month FROM d)<>1;
INSERT INTO public.bi_sales_flat_mv
 SELECT d::date,'A',b,'Own','Доставка','Courier',false,
   CASE WHEN b='NullMetric' AND d::date=date '2026-02-02' THEN NULL
        WHEN b='NaNMetric' AND d::date=date '2026-02-02' THEN 'NaN'::numeric ELSE 10 END,2,3
 FROM (VALUES('MissingDay'),('NullMetric'),('NaNMetric')) q(b)
 CROSS JOIN generate_series(date '2026-01-01',date '2026-02-15',interval '1 day') d
 WHERE NOT(b='MissingDay' AND d::date=date '2026-02-02');
-- Stray channel must not leak through a chosen dimension scope.
INSERT INTO public.bi_sales_flat_mv VALUES('2026-03-31','Other','CompleteMonths','Franchise','Агрегатор','Glovo',false,99999,1,1);
-- Real identifiers only for owner-confirmed calendar facts; all amounts synthetic.
INSERT INTO public.bi_sales_flat_mv
 SELECT d::date,'Лавина','МитБАР','Власні','Доставка','Courier',false,10,2,3
 FROM generate_series(date '2026-08-01',date '2026-11-15',interval '1 day') d
 WHERE d::date NOT IN (date '2026-09-04',date '2026-09-30');
\ir dynamics-period-comparison-NOT-APPLIED.sql

DO $test$
DECLARE r jsonb;p jsonb;blocked boolean:=false;
BEGIN
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month','Доставка','Courier','A','CompleteMonths','Own',false);
 ASSERT r->>'contractVersion'='dynamics-period-comparison-v1';
 ASSERT r->>'latestYear'='2026' AND r->>'cutoff'='2026-03-31';
 ASSERT jsonb_array_length(r->'periods')=3;
 ASSERT r->'filters'='{"channel":"Доставка","orderType":"Courier","location":"A","brand":"CompleteMonths","ownership":"Own","lfl":false}'::jsonb;
 p:=r->'periods'->0;
 ASSERT p->>'previousStart'='2025-12-01' AND p->>'previousEnd'='2025-12-31';
 ASSERT (p->>'current')::numeric=310 AND (p->>'previous')::numeric=310;
 p:=r->'periods'->1;
 ASSERT p->>'status'='ready' AND p->>'currentDays'='28' AND p->>'previousDays'='31';
 ASSERT p->'partial'='false'::jsonb AND (p->>'current')::numeric=280 AND (p->>'previous')::numeric=310;
 ASSERT abs((p->>'delta')::numeric-(280::numeric/310-1)*100)<0.000001;
 p:=r->'periods'->2;
 ASSERT p->>'currentEnd'='2026-03-31' AND p->>'previousEnd'='2026-02-28';
 ASSERT p->>'clampedDays'='0' AND (p->>'current')::numeric=310;
 r:=public.bi_dynamics_period_comparison('fixture-only','markupRate','month','Доставка',NULL,NULL,'CompleteMonths');
 p:=r->'periods'->1;
 ASSERT p->>'unit'='pp' AND abs((p->>'delta')::numeric-10)<0.000001;
 r:=public.bi_dynamics_period_comparison('fixture-only','averageCheck','month',NULL,NULL,NULL,'CompleteMonths','Own');
 ASSERT (r#>>'{periods,1,current}')::numeric=5;
 r:=public.bi_dynamics_period_comparison('fixture-only','checks','month',NULL,NULL,NULL,'CompleteMonths','Own');
 ASSERT (r#>>'{periods,1,current}')::numeric=56;

 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'PartialClamp');p:=r->'periods'->2;
 ASSERT p->'partial'='true'::jsonb AND p->>'naturalCurrentEnd'='2026-03-31';
 ASSERT p->>'currentEnd'='2026-03-28' AND p->>'previousEnd'='2026-02-28' AND p->>'clampedDays'='2';
 ASSERT p->>'currentDays'='28' AND p->>'previousDays'='28' AND (p->>'delta')::numeric=0;
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'Partial15');p:=r->'periods'->2;
 ASSERT p->>'currentEnd'='2026-03-15' AND p->>'previousEnd'='2026-02-15' AND p->>'clampedDays'='0';
 ASSERT (p->>'current')::numeric=150 AND (p->>'previous')::numeric=150;
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'Partial15',NULL,true);p:=r->'periods'->2;
 ASSERT p->>'status'='ready' AND p#>>'{cohort,candidateCount}'='1' AND p#>>'{cohort,registryExcludedCount}'='0';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'PartialClamp',NULL,true);p:=r->'periods'->2;
 ASSERT p->>'status'='ready' AND p#>>'{cohort,candidateCount}'='1';

 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','week',NULL,NULL,NULL,'W01after53');p:=r->'periods'->0;
 ASSERT r->>'latestYear'='2021' AND jsonb_array_length(r->'periods')=1;
 ASSERT p->>'key'='2021-W01' AND p->>'previousStart'='2020-12-28' AND p->>'previousEnd'='2021-01-03';
 ASSERT p->>'currentStart'='2021-01-04' AND p->>'currentEnd'='2021-01-10';
 ASSERT (p->>'current')::numeric=70 AND (p->>'previous')::numeric=70;
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','week',NULL,NULL,NULL,'W01after52');p:=r->'periods'->0;
 ASSERT p->>'key'='2022-W01' AND p->>'previousStart'='2021-12-27' AND p->>'previousEnd'='2022-01-02';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','week',NULL,NULL,NULL,'W01partial');p:=r->'periods'->0;
 ASSERT p->>'currentDays'='5' AND p->>'previousDays'='5' AND p->>'previousEnd'='2021-01-01';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','week',NULL,NULL,NULL,'W53partial');p:=r->'periods'->52;
 ASSERT r->>'latestYear'='2020' AND jsonb_array_length(r->'periods')=53;
 ASSERT r#>>'{periods,0,key}'='2020-W01' AND r#>>'{periods,0,status}'='unavailable';
 ASSERT p->>'key'='2020-W53' AND p->>'previousStart'='2020-12-21' AND p->>'previousEnd'='2020-12-25';
 ASSERT (p->>'current')::numeric=50 AND (p->>'previous')::numeric=50;

 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'OpenClose',NULL,true);p:=r->'periods'->1;
 ASSERT p->>'status'='ready' AND p#>>'{cohort,mode}'='pairwise-complete';
 ASSERT p#>>'{cohort,candidateCount}'='5' AND p#>>'{cohort,includedCount}'='1' AND p#>>'{cohort,excludedCount}'='4';
 ASSERT p#>>'{cohort,registryExcludedCount}'='1' AND p#>>'{cohort,incompleteCount}'='3';
 ASSERT (p#>>'{cohort,currentCoverage}')::numeric=1 AND (p#>>'{cohort,previousCoverage}')::numeric=1;
 ASSERT p#>>'{cohort,currentObservedDays}'='28' AND p#>>'{cohort,previousExpectedDays}'='31';
 ASSERT (p->>'current')::numeric=280 AND (p->>'previous')::numeric=310;
 ASSERT (p->>'observedCurrent')::numeric=840 AND (p->>'observedPrevious')::numeric=920;
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'OpenClose',NULL,false);p:=r->'periods'->1;
 ASSERT p->>'status'='unavailable' AND p->>'reason'='INCOMPLETE_COVERAGE' AND p->'current'='null'::jsonb;
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,'Opened','OpenClose',NULL,true);
 ASSERT r#>>'{periods,1,reason}'='NO_TRUSTWORTHY_COHORT';

 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'Zero');p:=r->'periods'->1;
 ASSERT p->>'status'='ready' AND (p->>'previous')::numeric=0 AND (p->>'current')::numeric=150 AND p->'delta'='null'::jsonb;
 r:=public.bi_dynamics_period_comparison('fixture-only','averageCheck','month',NULL,NULL,NULL,'Zero');
 ASSERT r#>>'{periods,1,reason}'='UNDEFINED_METRIC';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'MissingMonth');
 ASSERT jsonb_array_length(r->'periods')=2 AND r#>>'{periods,0,status}'='unavailable' AND r#>>'{periods,1,status}'='unavailable';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'MissingDay');
 ASSERT r#>>'{periods,1,reason}'='NO_TRUSTWORTHY_COHORT';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'NullMetric');
 ASSERT r#>>'{periods,1,status}'='unavailable' AND r#>'{periods,1,observedCurrent}'='null'::jsonb;
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'NaNMetric');
 ASSERT r#>>'{periods,1,status}'='unavailable';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'AbsentBrand');
 ASSERT r->>'status'='unavailable' AND r->>'reason'='NO_DATA' AND r->'periods'='[]'::jsonb;
 ASSERT public.bi_dynamics_payload()='unchanged-old-rpc';
 ASSERT NOT has_table_privilege('anon','public.bi_sales_flat_mv','SELECT');
 ASSERT has_function_privilege('anon','public.bi_dynamics_period_comparison(text,text,text,text,text,text,text,text,boolean)','EXECUTE');
 ASSERT (SELECT provolatile='s' AND prosecdef FROM pg_proc WHERE oid='public.bi_dynamics_period_comparison(text,text,text,text,text,text,text,text,boolean)'::regprocedure);
 BEGIN PERFORM public.bi_dynamics_period_comparison('wrong');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM='unauthorized'; END;
 ASSERT blocked,'bad password must fail';blocked:=false;
 BEGIN PERFORM public.bi_dynamics_period_comparison('fixture-only','invented','month');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM='invalid_parameters'; END;
 ASSERT blocked,'unsupported metrics must fail';
END $test$;
DO $closures$
DECLARE r jsonb;p jsonb;m text;w int;
BEGIN
 FOREACH m IN ARRAY ARRAY['revenue','checks','averageCheck','markupRate'] LOOP
  r:=public.bi_dynamics_period_comparison('fixture-only',m,'month',NULL,NULL,'Лавина','МитБАР','Власні',false);
  p:=r->'periods'->9;
  ASSERT p->>'status'='ready' AND p#>>'{cohort,includedCount}'='1';
  ASSERT p#>>'{cohort,previousConfirmedZeroDays}'='2' AND p#>>'{cohort,currentConfirmedZeroDays}'='0';
  ASSERT p#>>'{cohort,previousObservedDays}'='30' AND p->>'currentDays'='31';
  IF m='revenue' THEN ASSERT (p->>'previous')::numeric=280 AND (p->>'current')::numeric=310;
  ELSIF m='checks' THEN ASSERT (p->>'previous')::numeric=56 AND (p->>'current')::numeric=62;
  ELSIF m='averageCheck' THEN ASSERT (p->>'previous')::numeric=5 AND (p->>'current')::numeric=5;
  ELSE ASSERT (p->>'previous')::numeric=30 AND (p->>'current')::numeric=30; END IF;
 END LOOP;
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','week','Доставка','Courier','Лавина','МитБАР','Власні',true);
 FOREACH w IN ARRAY ARRAY[35,36,39,40] LOOP ASSERT r->'periods'->w->>'status'='ready'; END LOOP;
 ASSERT r#>>'{periods,35,cohort,currentConfirmedZeroDays}'='1';
 ASSERT r#>>'{periods,36,cohort,previousConfirmedZeroDays}'='1';
 ASSERT r#>>'{periods,39,cohort,currentConfirmedZeroDays}'='1';
 ASSERT r#>>'{periods,40,cohort,previousConfirmedZeroDays}'='1';
 ASSERT (r#>>'{periods,35,current}')::numeric=60 AND (r#>>'{periods,35,previous}')::numeric=70;
 ASSERT (r#>>'{periods,36,current}')::numeric=70 AND (r#>>'{periods,36,previous}')::numeric=60;
 -- No later cutoff or false-zero ratio is introduced.
 ASSERT r->>'cutoff'='2026-11-15';
 ASSERT r#>>'{periods,45,cohort,currentConfirmedZeroDays}'='0';
 -- Other location's same date is still unknown, not a global missing-day default.
 INSERT INTO public.bi_sales_flat_mv
 SELECT d::date,'UnknownOther','МитБАР','Власні','Доставка','Courier',false,10,2,3
 FROM generate_series(date '2026-09-01',date '2026-10-31',interval '1 day') d
 WHERE d::date<>date '2026-09-04';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'МитБАР','Власні',false);
 ASSERT r#>>'{periods,9,reason}'='INCOMPLETE_COVERAGE' AND r#>>'{periods,9,cohort,includedCount}'='1';
 DELETE FROM public.bi_sales_flat_mv WHERE location='UnknownOther';
 -- Any real row wins, even from a different channel; no fabricated rows, double count or masking NULLs.
 INSERT INTO public.bi_sales_flat_mv VALUES('2026-09-04','Лавина','МитБАР','Власні','Агрегатор','Glovo',false,50,5,10);
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,'Лавина','МитБАР','Власні',false);
 ASSERT (r#>>'{periods,9,previous}')::numeric=330 AND r#>>'{periods,9,cohort,previousConfirmedZeroDays}'='1';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month','Доставка',NULL,'Лавина','МитБАР','Власні',false);
 ASSERT r#>>'{periods,9,status}'='unavailable';
 UPDATE public.bi_sales_flat_mv SET revenue=NULL WHERE location='Лавина' AND date='2026-09-04';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,'Лавина','МитБАР','Власні',false);
 ASSERT r#>>'{periods,9,status}'='unavailable';
 DELETE FROM public.bi_sales_flat_mv WHERE location='Лавина' AND date='2026-09-04';
 -- The explicit date cannot repair a third missing day or an arbitrary year.
 DELETE FROM public.bi_sales_flat_mv WHERE location='Лавина' AND date='2026-09-10';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,'Лавина','МитБАР','Власні',false);
 ASSERT r#>>'{periods,9,status}'='unavailable';
 INSERT INTO public.bi_sales_flat_mv VALUES('2026-09-10','Лавина','МитБАР','Власні','Доставка','Courier',false,10,2,3);
 -- LFL exclusion is never overridden by closure confirmation.
 INSERT INTO public.location_lifecycle_registry VALUES('Лавина',true);
 UPDATE public.bi_sales_flat_mv SET lfl_exclude=true WHERE location='Лавина';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'МитБАР','Власні',true);
 ASSERT r->>'status'='unavailable';
 UPDATE public.bi_sales_flat_mv SET lfl_exclude=false WHERE location='Лавина';
 DELETE FROM public.location_lifecycle_registry WHERE canonical_name='Лавина';
 -- No nonexistent channel or ownership can be invented.
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month','Absent',NULL,'Лавина','МитБАР','Власні',false);
 ASSERT r->>'status'='unavailable';
 r:=public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,'Лавина','МитБАР','Franchise',false);
 ASSERT r->>'status'='unavailable';
END $closures$;

SET LOCAL ROLE anon;
SELECT public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'Partial15')->>'contractVersion' AS password_gated_anon_contract;
RESET ROLE;
SELECT jsonb_build_object('fixtureSamples',jsonb_build_array(
 public.bi_dynamics_period_comparison('fixture-only','revenue','month','Доставка','Courier','A','CompleteMonths','Own',false),
 public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'PartialClamp'),
 public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'Partial15'),
 public.bi_dynamics_period_comparison('fixture-only','markupRate','month','Доставка',NULL,NULL,'CompleteMonths'),
 public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'OpenClose',NULL,true),
 public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'OpenClose',NULL,false),
 public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,NULL,'Zero'),
 public.bi_dynamics_period_comparison('fixture-only','revenue','week',NULL,NULL,NULL,'W01after53'),
 public.bi_dynamics_period_comparison('fixture-only','revenue','week',NULL,NULL,NULL,'W53partial'),
 public.bi_dynamics_period_comparison('fixture-only','revenue','month',NULL,NULL,'Лавина','МитБАР','Власні',false),
 public.bi_dynamics_period_comparison('fixture-only','revenue','week',NULL,NULL,'Лавина','МитБАР','Власні',true)
));
ROLLBACK;
