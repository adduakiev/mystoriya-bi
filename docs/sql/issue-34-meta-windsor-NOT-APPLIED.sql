-- Issue #34: REVIEW CANDIDATE ONLY / NOT APPLIED.
-- Outside automatic migration discovery. Barbara review and separate owner approval
-- required before application. No destination, cron job or business writes enabled.
-- Depends only on the existing Meta contract and bi_runtime_config/pgcrypto.
begin;
set local timezone = 'UTC';

create table public.staging_meta_ads_windsor (
  date date not null,
  account_id text not null check (btrim(account_id) <> ''),
  account_name text,
  account_currency text not null check (account_currency ~ '^[A-Z]{3}$'),
  campaign_id text not null check (btrim(campaign_id) <> ''),
  campaign text,
  objective text,
  spend numeric check (spend >= 0),
  impressions numeric check (impressions >= 0),
  reach numeric check (reach >= 0),
  clicks numeric check (clicks >= 0),
  actions_link_click numeric check (actions_link_click >= 0),
  actions_offsite_conversion_fb_pixel_purchase numeric check (actions_offsite_conversion_fb_pixel_purchase >= 0),
  action_values_offsite_conversion_fb_pixel_purchase numeric check (action_values_offsite_conversion_fb_pixel_purchase >= 0),
  imported_at timestamptz not null default clock_timestamp(),
  primary key (date, account_id, campaign_id)
);
create index staging_meta_ads_windsor_account_date_idx
  on public.staging_meta_ads_windsor(account_id, date);

-- Server-owned receipt time must advance on Windsor upsert, not just first insert.
create function public.meta_windsor_receipt_time()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.imported_at := clock_timestamp();
  return new;
end;
$$;
create trigger meta_windsor_receipt_time before insert or update
  on public.staging_meta_ads_windsor for each row
  execute function public.meta_windsor_receipt_time();
revoke all on function public.meta_windsor_receipt_time() from public, anon, authenticated;

alter table public.staging_meta_ads_daily
  add column account_currency text check (account_currency ~ '^[A-Z]{3}$'),
  add column ingestion_source text,
  add column modeled_at timestamptz;
create index staging_meta_ads_daily_account_date_idx
  on public.staging_meta_ads_daily(account_id, date);

alter table public.staging_meta_ads_windsor enable row level security;
alter table public.staging_meta_ads_daily enable row level security;
revoke all on public.staging_meta_ads_windsor from public, anon, authenticated, service_role;
revoke all on public.staging_meta_ads_daily from public, anon, authenticated;
grant select, insert, update on public.staging_meta_ads_windsor to service_role;
-- No broad DELETE/TRUNCATE grant: withdrawn keys need a separately reviewed cleanup.

-- Inspection only. Receipt recency cannot prove a completed export. The fingerprint
-- covers every raw field (including receipt time) and is not an export-completion token.
create function public.meta_windsor_evidence(p_account_id text, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'accountId',p_account_id,'from',p_from,'to',p_to,
    'rows',count(*),'observedDates',count(distinct r.date),
    'first',min(r.date),'latest',max(r.date),
    'firstReceipt',min(r.imported_at),'lastReceipt',max(r.imported_at),
    'currencies',coalesce(jsonb_agg(distinct r.account_currency),'[]'::jsonb),
    'purchaseKnownRows',count(r.actions_offsite_conversion_fb_pixel_purchase),
    'purchaseValueKnownRows',count(r.action_values_offsite_conversion_fb_pixel_purchase),
    'freshness',case when count(*)=0 then 'UNKNOWN'
      when max(r.date)<(now() at time zone 'UTC')::date-2 then 'STALE' else 'FRESH' end,
    'coverage','UNKNOWN',
    'fingerprint',md5(string_agg(to_jsonb(r)::text,E'\n' order by r.date,r.account_id,r.campaign_id))
  )
  from public.staging_meta_ads_windsor r
  where r.account_id=p_account_id and r.date between p_from and p_to;
$$;
revoke all on function public.meta_windsor_evidence(text,date,date) from public, anon, authenticated;
grant execute on function public.meta_windsor_evidence(text,date,date) to service_role;

-- Explicit bounded refresh only; no default window, auto-discovery or scheduler.
-- Caller must reconcile a COMPLETED export against Windsor before supplying the
-- expected count/fingerprint. Reading evidence and echoing it is not reconciliation.
create function public.refresh_digital_meta_models(
  p_account_id text, p_from date, p_to date,
  p_expected_rows bigint, p_expected_fingerprint text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_evidence jsonb;
  v_currency text;
  v_rows bigint;
begin
  if p_account_id is null or btrim(p_account_id)='' or p_from is null or p_to is null
    or p_from>p_to or p_to>(now() at time zone 'UTC')::date
    or p_expected_rows is null or p_expected_rows<=0
    or p_expected_fingerprint is null or p_expected_fingerprint !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid or unreviewed Meta refresh scope';
  end if;
  -- Same lock order serializes refreshes; raw SHARE blocks inserts/updates while
  -- evidence is checked and transformed. No partial refresh is committed on error.
  lock table public.staging_meta_ads_windsor in share mode;
  lock table public.staging_meta_ads_daily in share row exclusive mode;
  v_evidence := public.meta_windsor_evidence(p_account_id,p_from,p_to);
  if (v_evidence->>'rows')::bigint<>p_expected_rows
    or v_evidence->>'fingerprint' is distinct from p_expected_fingerprint then
    raise exception 'Meta export evidence changed or row count mismatch';
  end if;
  if jsonb_array_length(v_evidence->'currencies')<>1 then
    raise exception 'Meta account currency is inconsistent';
  end if;
  v_currency := v_evidence->'currencies'->>0;
  if exists (select 1 from public.staging_meta_ads_daily
    where account_id=p_account_id and account_currency is distinct from v_currency
      and ingestion_source='windsor_facebook') then
    raise exception 'Meta account currency changed; review history first';
  end if;
  if exists (select 1 from public.staging_meta_ads_daily
    where account_id=p_account_id and date between p_from and p_to
      and (ingestion_source is distinct from 'windsor_facebook' or adset_id<>'' or ad_id<>'')) then
    raise exception 'Meta refresh would overlap another source or grain';
  end if;

  delete from public.staging_meta_ads_daily
  where account_id=p_account_id and date between p_from and p_to
    and ingestion_source='windsor_facebook';
  insert into public.staging_meta_ads_daily (
    date,account_id,account_name,account_currency,campaign_id,campaign_name,
    adset_id,ad_id,objective,spend,impressions,reach,clicks,link_clicks,
    conversions,purchases,purchase_value,imported_at,ingestion_source,modeled_at
  )
  select date,account_id,account_name,account_currency,campaign_id,campaign,
    '','',objective,spend,impressions,reach,clicks,actions_link_click,
    null,actions_offsite_conversion_fb_pixel_purchase,
    action_values_offsite_conversion_fb_pixel_purchase,imported_at,'windsor_facebook',clock_timestamp()
  from public.staging_meta_ads_windsor
  where account_id=p_account_id and date between p_from and p_to;
  get diagnostics v_rows = row_count;
  return v_evidence || jsonb_build_object('modeledRows',v_rows,'refreshedAt',clock_timestamp());
end;
$$;
revoke all on function public.refresh_digital_meta_models(text,date,date,bigint,text) from public, anon, authenticated;
grant execute on function public.refresh_digital_meta_models(text,date,date,bigint,text) to service_role;

-- Strict sums: a partly unknown metric is unknown for the whole group.
-- Money groups include currency; no FX conversion or Google joins. Only this
-- source's campaign-day rows enter the v3 payload. No additive reach/frequency.
create view public.meta_windsor_campaign_metrics with (security_invoker = true) as
select date,account_id,campaign_id,account_currency,max(campaign_name) campaign_name,
  case when count(spend)=count(*) then sum(spend) end spend,
  case when count(impressions)=count(*) then sum(impressions) end impressions,
  case when count(clicks)=count(*) then sum(clicks) end clicks,
  case when count(link_clicks)=count(*) then sum(link_clicks) end link_clicks,
  case when count(purchases)=count(*) then sum(purchases) end purchases,
  case when count(purchase_value)=count(*) then sum(purchase_value) end purchase_value,
  min(imported_at) imported_at
from public.staging_meta_ads_daily
where ingestion_source='windsor_facebook' and adset_id='' and ad_id=''
group by date,account_id,campaign_id,account_currency;
revoke all on public.meta_windsor_campaign_metrics from public, anon, authenticated;

create or replace function public.bi_digital_meta_ads_payload(p_password text)
returns jsonb language plpgsql security definer
set search_path to 'public','extensions' as $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_latest date;
  v_from date;
  v_rows bigint;
  v_dates bigint;
  v_currency text;
  v_summary jsonb;
  v_campaigns jsonb;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;

  select max(date) into v_latest from public.meta_windsor_campaign_metrics;
  v_from := v_latest-29;
  select count(*),count(distinct date),
    case when count(account_currency)=count(*) and count(distinct account_currency)=1 then min(account_currency) end
    into v_rows,v_dates,v_currency
  from public.meta_windsor_campaign_metrics where date between v_from and v_latest;

  select jsonb_build_object(
    'spend',case when v_currency is not null and count(spend)=count(*) then sum(spend) end,
    'impressions',case when count(impressions)=count(*) then sum(impressions) end,
    'clicks',case when count(clicks)=count(*) then sum(clicks) end,
    'linkClicks',case when count(link_clicks)=count(*) then sum(link_clicks) end,
    'purchases',case when count(purchases)=count(*) then sum(purchases) end,
    'purchaseValue',case when v_currency is not null and count(purchase_value)=count(*) then sum(purchase_value) end,
    'conversions',null,'roas',null
  ) into v_summary from public.meta_windsor_campaign_metrics where date between v_from and v_latest;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.account_currency,c.spend desc nulls last),'[]'::jsonb)
    into v_campaigns from (
      select account_id,campaign_id,account_currency,max(campaign_name) campaign_name,
        case when count(spend)=count(*) then sum(spend) end spend,
        case when count(impressions)=count(*) then sum(impressions) end impressions,
        case when count(clicks)=count(*) then sum(clicks) end clicks,
        case when count(link_clicks)=count(*) then sum(link_clicks) end link_clicks,
        case when count(purchases)=count(*) then sum(purchases) end purchases,
        case when count(purchase_value)=count(*) then sum(purchase_value) end purchase_value,
        null::numeric conversions,null::numeric roas
      from public.meta_windsor_campaign_metrics where date between v_from and v_latest
      group by account_id,campaign_id,account_currency
      order by account_currency,sum(spend) desc nulls last,account_id,campaign_id limit 50
    ) c;
  return jsonb_build_object('meta',jsonb_build_object(
    'contractVersion',3,'rows',v_rows,'observedDates',v_dates,'from',v_from,'to',v_latest,
    'latest',v_latest,'sourceLatest',v_latest,'currency',v_currency,
    'attributionVerified',false,'coverage',case when v_rows>0 and v_dates<30 then 'PARTIAL' else 'UNKNOWN' end,
    'source','windsor_facebook','grain','campaign-day',
    'firstReceipt',(select min(imported_at) from public.meta_windsor_campaign_metrics where date between v_from and v_latest),
    'lastReceipt',(select max(imported_at) from public.meta_windsor_campaign_metrics where date between v_from and v_latest)
  ),'summary',v_summary,'campaigns',v_campaigns);
end;
$function$;
revoke all on function public.bi_digital_meta_ads_payload(text) from public, authenticated;
grant execute on function public.bi_digital_meta_ads_payload(text) to anon, service_role;

-- No cron.schedule or destination creation. See the gated activation runbook.
rollback;
