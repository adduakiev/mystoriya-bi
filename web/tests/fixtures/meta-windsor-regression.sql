-- Synthetic fixture only; no customer or campaign data.
create function pg_temp.assert(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'assertion failed: %',label; end if; end;
$$;

select pg_temp.assert(not has_table_privilege('anon','public.staging_meta_ads_windsor','SELECT'), 'raw anon denied');
select pg_temp.assert(not has_table_privilege('authenticated','public.staging_meta_ads_daily','SELECT'), 'curated authenticated denied');
select pg_temp.assert(not has_table_privilege('anon','public.meta_windsor_campaign_metrics','SELECT'), 'view anon denied');
select pg_temp.assert((select relrowsecurity from pg_class where oid='public.staging_meta_ads_windsor'::regclass), 'raw RLS');
select pg_temp.assert((select relrowsecurity from pg_class where oid='public.staging_meta_ads_daily'::regclass), 'curated RLS');
select pg_temp.assert(not has_function_privilege('anon','public.refresh_digital_meta_models(text,date,date,bigint,text)','EXECUTE'), 'refresh anon denied');
select pg_temp.assert(not has_function_privilege('authenticated','public.meta_windsor_evidence(text,date,date)','EXECUTE'), 'evidence authenticated denied');
select pg_temp.assert(has_function_privilege('service_role','public.refresh_digital_meta_models(text,date,date,bigint,text)','EXECUTE'), 'service refresh allowed');
select pg_temp.assert(not has_table_privilege('service_role','public.staging_meta_ads_windsor','DELETE'), 'raw deletion not enabled');

do $$
begin
  begin perform public.bi_digital_meta_ads_payload('wrong'); raise exception 'auth bypass';
  exception when raise_exception then if sqlerrm<>'unauthorized' then raise; end if; end;
end;
$$;
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'meta'->>'rows'='0','empty evidence');
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'summary'->>'spend' is null,'empty spend unknown');

set local role service_role;
insert into public.staging_meta_ads_windsor
  (date,account_id,account_currency,campaign_id,campaign,spend,impressions,clicks,actions_link_click)
values (current_date-1,'account-usd','USD','shared-campaign','Synthetic campaign',10,100,10,5),
       (current_date,'account-usd','USD','shared-campaign','Synthetic campaign',0,0,0,0);
reset role;
create function pg_temp.refresh_account(a text, f date, t date) returns jsonb language sql as $$
  select public.refresh_digital_meta_models(a,f,t,(e->>'rows')::bigint,e->>'fingerprint')
  from (select public.meta_windsor_evidence(a,f,t) e) x;
$$;
select pg_temp.refresh_account('account-usd',current_date-1,current_date);
select pg_temp.refresh_account('account-usd',current_date-1,current_date);
select pg_temp.assert((select count(*)=2 from public.staging_meta_ads_daily),'idempotent grain');
select pg_temp.assert((select bool_and(campaign_name='Synthetic campaign' and account_currency='USD' and adset_id='' and ad_id='') from public.staging_meta_ads_daily),'explicit field mapping');
select pg_temp.assert((select bool_and(conversions is null and purchases is null and purchase_value is null and frequency is null) from public.staging_meta_ads_daily),'unknown metrics preserved');
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'summary'->>'spend'='10','measured zero included');
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'summary'->>'purchaseValue' is null,'null purchase aggregate');
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'meta'->>'observedDates'='2','selected dates');
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'meta'->>'currency'='USD','currency preserved');
select pg_temp.assert(public.meta_windsor_evidence('account-usd',current_date-1,current_date)->>'purchaseKnownRows'='0','null evidence');

-- Upsert corrections advance receipt and replace values, never add duplicates.
create temp table receipt as select imported_at from public.staging_meta_ads_windsor where date=current_date-1;
insert into public.staging_meta_ads_windsor(date,account_id,account_currency,campaign_id,spend,impressions,clicks)
values (current_date-1,'account-usd','USD','shared-campaign',12,100,10)
on conflict(date,account_id,campaign_id) do update set spend=excluded.spend;
select pg_temp.assert((select r.imported_at>old.imported_at from public.staging_meta_ads_windsor r cross join receipt old where r.date=current_date-1),'upsert receipt advanced');
select pg_temp.refresh_account('account-usd',current_date-1,current_date);
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'summary'->>'spend'='12','correction replaces');
select pg_temp.assert((select d.imported_at=r.imported_at and d.modeled_at>=d.imported_at from public.staging_meta_ads_daily d join public.staging_meta_ads_windsor r using(date,account_id,campaign_id) where d.date=current_date-1),'source receipt retained');

do $$
declare e jsonb;
begin
  e:=public.meta_windsor_evidence('account-usd',current_date-1,current_date);
  begin perform public.refresh_digital_meta_models('account-usd',current_date-1,current_date,3,e->>'fingerprint'); raise exception 'count bypass';
  exception when raise_exception then if sqlerrm<>'Meta export evidence changed or row count mismatch' then raise; end if; end;
  update public.staging_meta_ads_windsor set spend=13 where date=current_date-1;
  begin perform public.refresh_digital_meta_models('account-usd',current_date-1,current_date,2,e->>'fingerprint'); raise exception 'fingerprint bypass';
  exception when raise_exception then if sqlerrm<>'Meta export evidence changed or row count mismatch' then raise; end if; end;
  begin perform public.refresh_digital_meta_models('account-usd',current_date,current_date,0,null); raise exception 'empty bypass';
  exception when raise_exception then if sqlerrm<>'invalid or unreviewed Meta refresh scope' then raise; end if; end;
end;
$$;
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'summary'->>'spend'='12','rejected refresh leaves model intact');

-- Genuine purchase zero survives; mixed known/unknown sums remain unknown.
update public.staging_meta_ads_windsor set actions_offsite_conversion_fb_pixel_purchase=0,
 action_values_offsite_conversion_fb_pixel_purchase=0 where date=current_date;
select pg_temp.refresh_account('account-usd',current_date,current_date);
select pg_temp.assert((select purchases=0 and purchase_value=0 from public.staging_meta_ads_daily where date=current_date),'measured purchase zero');
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'summary'->>'purchases' is null,'partial purchase evidence stays unknown');
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'meta'->>'attributionVerified'='false','attribution remains unverified');

-- Same campaign ID in a different account/currency must stay separate.
insert into public.staging_meta_ads_windsor(date,account_id,account_currency,campaign_id,spend,impressions)
values (current_date,'account-uah','UAH','shared-campaign',100,1000);
select pg_temp.refresh_account('account-uah',current_date,current_date);
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'summary'->>'spend' is null,'mixed currency spend blocked');
select pg_temp.assert(jsonb_array_length(public.bi_digital_meta_ads_payload('fixture-password')->'campaigns')=2,'account campaign isolation');
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'summary'->>'clicks' is null,'partial click sum blocked');

-- Existing foreign data/grain cannot be overwritten, even on another campaign.
insert into public.staging_meta_ads_daily(date,account_id,campaign_id,adset_id,spend)
values (current_date,'account-usd','foreign','adset',999);
do $$
begin
  begin perform pg_temp.refresh_account('account-usd',current_date,current_date); raise exception 'overlap bypass';
  exception when raise_exception then if sqlerrm<>'Meta refresh would overlap another source or grain' then raise; end if; end;
  update public.staging_meta_ads_windsor set account_currency='EUR' where account_id='account-uah';
  begin perform pg_temp.refresh_account('account-uah',current_date,current_date); raise exception 'currency bypass';
  exception when raise_exception then if sqlerrm<>'Meta account currency changed; review history first' then raise; end if; end;
end;
$$;
select pg_temp.assert((select spend=999 from public.staging_meta_ads_daily where campaign_id='foreign'),'foreign rows untouched');
select pg_temp.assert(public.bi_digital_meta_ads_payload('fixture-password')->'meta'->>'rows'='3','foreign rows excluded');
select pg_temp.assert(not exists(select 1 from public.staging_meta_ads_daily where account_currency='EUR'),'currency failure atomic');

-- An upsert never removes withdrawn keys: reconcile/delete under a separate gate.
-- Once the raw snapshot is corrected, a bounded refresh removes only owned keys.
delete from public.staging_meta_ads_windsor where account_id='account-usd' and date=current_date;
delete from public.staging_meta_ads_daily where campaign_id='foreign';
select pg_temp.refresh_account('account-usd',current_date-1,current_date);
select pg_temp.assert((select count(*)=1 from public.staging_meta_ads_daily where account_id='account-usd'),'withdrawn owned row removed');
select pg_temp.assert((select count(*)=1 from public.staging_meta_ads_daily where account_id='account-uah'),'other account preserved');
select pg_temp.assert(public.meta_windsor_evidence('missing',current_date-1,current_date)->>'freshness'='UNKNOWN','empty freshness unknown');
insert into public.staging_meta_ads_windsor(date,account_id,account_currency,campaign_id,spend)
values (current_date-10,'old-account','USD','old-campaign',1);
select pg_temp.assert(public.meta_windsor_evidence('old-account',current_date-10,current_date)->>'freshness'='STALE','receipt does not mask stale measurement');
