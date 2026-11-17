-- Synthetic fixture for a NEW EMPTY LOCAL PostgreSQL database ONLY.
-- Never run against Supabase/production; no production data or credentials.
-- psql -v ON_ERROR_STOP=1 -f this-file.sql (relative \ir resolves beside file).
BEGIN;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.bi_runtime_config(config_key text,value_hash text);
INSERT INTO public.bi_runtime_config VALUES('access_password',encode(extensions.digest('fixture-only','sha256'),'hex'));
CREATE TABLE public.bi_sales_flat_mv(date date,order_type text,location text,brand text,ownership text,channel text,lfl_exclude boolean,revenue numeric,checks numeric,markup numeric);
INSERT INTO public.bi_sales_flat_mv VALUES
 ('2025-11-15','Glovo','A','B1','Own','Агрегатор',false,100,1,20),
 ('2025-11-30','Glovo','A','B1','Own','Агрегатор',false,900,9,180),
 ('2026-11-15','Glovo','A','B1','Own','Агрегатор',false,200,2,40),
 ('2026-11-15','Bolt','B','B2','Franchise','Агрегатор',false,300,3,60),
 ('2026-11-15','Glovo','Closed','B1','Own','Агрегатор',true,500,5,100),
 ('2026-10-15','Glovo','A','B1','Own','Агрегатор',false,50,1,10),
 ('2026-11-15','Delivery','A','B1','Own','Доставка',false,9999,99,900),
 ('2024-12-30','Glovo','ISO','B1','Own','Агрегатор',false,4,1,1),
 ('2025-01-02','Glovo','ISO','B1','Own','Агрегатор',false,5,1,1),
 ('2026-01-01','Glovo','ISO','B1','Own','Агрегатор',false,10,1,2),
 ('2020-12-25','Glovo','W53','B1','Own','Агрегатор',false,7,1,1),
 ('2021-01-01','Glovo','W53','B1','Own','Агрегатор',false,13,1,2);
\ir aggregators-filters-v3-NOT-APPLIED.sql
DO $test$
DECLARE p jsonb; blocked boolean:=false;
BEGIN
 p:=public.bi_aggregators_payload_v3('fixture-only','month','ly',true,2026,11,'B1','Own','A','Glovo');
 ASSERT p#>>'{meta,contractVersion}'='aggregators-filters-v3';
 ASSERT (p#>>'{current,revenue}')::numeric=200;
 ASSERT (p#>>'{previous,revenue}')::numeric=100;
 ASSERT (p#>>'{aggregators,0,revenue}')::numeric=200;
 ASSERT (p#>>'{locations,0,revenue}')::numeric=200;
 ASSERT p#>>'{meta,cutoffDate}'='2026-11-15';
 p:=public.bi_aggregators_payload_v3('fixture-only','month','ly',true,2026,11);
 ASSERT (p#>>'{current,revenue}')::numeric=500; -- Closed and delivery excluded.
 p:=public.bi_aggregators_payload_v3('fixture-only','month','ly',false,2026,11,NULL,'Franchise');
 ASSERT (p#>>'{current,revenue}')::numeric=300;
 p:=public.bi_aggregators_payload_v3('fixture-only','month','previous',false,2026,11,'B1','Own','A');
 ASSERT (p#>>'{previous,revenue}')::numeric=50;
 p:=public.bi_aggregators_payload_v3('fixture-only','ytd','ly',true,2026,NULL,'B1','Own','A');
 ASSERT (p#>>'{previous,revenue}')::numeric=100;
 ASSERT (p#>>'{trend,10,previous}')::numeric=100; -- Not full Nov2025=1000.
 p:=public.bi_aggregators_payload_v3('fixture-only','week','ly',false,2026,NULL,NULL,NULL,'ISO');
 ASSERT (p#>>'{current,revenue}')::numeric=10;
 ASSERT (p#>>'{previous,revenue}')::numeric=9; -- ISO W01: Dec30 + Jan2.
 p:=public.bi_aggregators_payload_v3('fixture-only','week','previous',false,2021,NULL,NULL,NULL,'W53');
 ASSERT (p#>>'{current,revenue}')::numeric=13;
 ASSERT (p#>>'{previous,revenue}')::numeric=7;
 BEGIN
   PERFORM public.bi_aggregators_payload_v3('fixture-only','week','ly',false,2021,NULL,NULL,NULL,'W53');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM='iso_comparison_unavailable'; END;
 ASSERT blocked,'W53 without prior-year W53 must fail closed';
 blocked:=false;
 BEGIN
   PERFORM public.bi_aggregators_payload_v3('fixture-only','month','ly',false,2026,9);
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM='no_data'; END;
 ASSERT blocked,'Empty September must not fall back to November';
 blocked:=false;
 BEGIN
   PERFORM public.bi_aggregators_payload_v3('wrong-password');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM='unauthorized'; END;
 ASSERT blocked,'Password check must remain enforced';
END;
$test$;
ROLLBACK;
