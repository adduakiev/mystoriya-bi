-- Gate D #37 exact pre-activation rollback.
-- Uses the private-schema backup captured before the first recurring-style sync.
-- Intended only before a later successful Gate D sync intentionally supersedes
-- this backup. It does not touch Google/Social data or any advertising state.

begin;

lock table public.staging_meta_ads_windsor in share row exclusive mode;
lock table public.staging_meta_ads_daily in share row exclusive mode;

delete from public.staging_meta_ads_windsor
where account_id='1642925125961488';

insert into public.staging_meta_ads_windsor
select * from private.meta_ads_gate_d_raw_20261024;

delete from public.staging_meta_ads_daily
where account_id='1642925125961488'
  and ingestion_source='windsor_facebook';

insert into public.staging_meta_ads_daily
select * from private.meta_ads_gate_d_curated_20261024;

drop function if exists public.sync_meta_windsor_snapshot(text,date,date,jsonb);

commit;
