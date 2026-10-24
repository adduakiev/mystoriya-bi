-- Gate D #37 candidate — NOT APPLIED.
-- Service-only atomic adapter for a completed Windsor Meta Ads snapshot.
-- It validates a non-empty campaign-day snapshot, atomically replaces raw keys
-- inside the explicit account/date window, reconciles raw rows, and refreshes
-- curated Meta models using the resulting evidence fingerprint.
-- No cron or Windsor destination is created by this artifact.
begin;

create or replace function public.sync_meta_windsor_snapshot(
  p_account_id text,
  p_from date,
  p_to date,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_source_rows bigint;
  v_unique_keys bigint;
  v_currency_count bigint;
  v_deleted bigint;
  v_upserted bigint;
  v_evidence jsonb;
  v_refresh jsonb;
  v_raw_rows bigint;
  v_curated_rows bigint;
begin
  if p_account_id is null or btrim(p_account_id)=''
    or p_from is null or p_to is null or p_from>p_to
    or p_to>(now() at time zone 'UTC')::date
    or jsonb_typeof(p_rows) is distinct from 'array'
    or jsonb_array_length(p_rows)=0 then
    raise exception 'invalid or empty Meta Windsor snapshot';
  end if;

  select count(*),
         count(distinct (r.date,r.account_id,r.campaign_id)),
         count(distinct r.account_currency)
    into v_source_rows,v_unique_keys,v_currency_count
  from jsonb_to_recordset(p_rows) as r(
    date date, account_id text, account_name text, account_currency text,
    campaign_id text, campaign text, objective text, spend numeric,
    impressions numeric, reach numeric, clicks numeric, actions_link_click numeric,
    actions_offsite_conversion_fb_pixel_purchase numeric,
    action_values_offsite_conversion_fb_pixel_purchase numeric
  );

  if v_source_rows<=0 or v_source_rows<>jsonb_array_length(p_rows) then
    raise exception 'Meta Windsor snapshot row count is invalid';
  end if;
  if v_unique_keys<>v_source_rows then
    raise exception 'Meta Windsor snapshot contains duplicate campaign-day keys';
  end if;
  if v_currency_count<>1 then
    raise exception 'Meta Windsor snapshot must contain exactly one currency';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r(
      date date, account_id text, account_name text, account_currency text,
      campaign_id text, campaign text, objective text, spend numeric,
      impressions numeric, reach numeric, clicks numeric, actions_link_click numeric,
      actions_offsite_conversion_fb_pixel_purchase numeric,
      action_values_offsite_conversion_fb_pixel_purchase numeric
    )
    where r.account_id is distinct from p_account_id
       or r.date is null or r.date<p_from or r.date>p_to
       or r.campaign_id is null or btrim(r.campaign_id)=''
       or r.account_currency is null or r.account_currency !~ '^[A-Z]{3}$'
       or r.spend<0 or r.impressions<0 or r.reach<0 or r.clicks<0
       or r.actions_link_click<0
       or r.actions_offsite_conversion_fb_pixel_purchase<0
       or r.action_values_offsite_conversion_fb_pixel_purchase<0
  ) then
    raise exception 'Meta Windsor snapshot contains invalid scope or metric values';
  end if;

  lock table public.staging_meta_ads_windsor in share row exclusive mode;
  lock table public.staging_meta_ads_daily in share row exclusive mode;

  delete from public.staging_meta_ads_windsor t
  where t.account_id=p_account_id
    and t.date between p_from and p_to
    and not exists (
      select 1
      from jsonb_to_recordset(p_rows) as r(
        date date, account_id text, account_name text, account_currency text,
        campaign_id text, campaign text, objective text, spend numeric,
        impressions numeric, reach numeric, clicks numeric, actions_link_click numeric,
        actions_offsite_conversion_fb_pixel_purchase numeric,
        action_values_offsite_conversion_fb_pixel_purchase numeric
      )
      where r.date=t.date and r.account_id=t.account_id and r.campaign_id=t.campaign_id
    );
  get diagnostics v_deleted = row_count;

  insert into public.staging_meta_ads_windsor (
    date,account_id,account_name,account_currency,campaign_id,campaign,objective,
    spend,impressions,reach,clicks,actions_link_click,
    actions_offsite_conversion_fb_pixel_purchase,
    action_values_offsite_conversion_fb_pixel_purchase
  )
  select date,account_id,account_name,account_currency,campaign_id,campaign,objective,
         spend,impressions,reach,clicks,actions_link_click,
         actions_offsite_conversion_fb_pixel_purchase,
         action_values_offsite_conversion_fb_pixel_purchase
  from jsonb_to_recordset(p_rows) as r(
    date date, account_id text, account_name text, account_currency text,
    campaign_id text, campaign text, objective text, spend numeric,
    impressions numeric, reach numeric, clicks numeric, actions_link_click numeric,
    actions_offsite_conversion_fb_pixel_purchase numeric,
    action_values_offsite_conversion_fb_pixel_purchase numeric
  )
  on conflict (date,account_id,campaign_id) do update set
    account_name=excluded.account_name,
    account_currency=excluded.account_currency,
    campaign=excluded.campaign,
    objective=excluded.objective,
    spend=excluded.spend,
    impressions=excluded.impressions,
    reach=excluded.reach,
    clicks=excluded.clicks,
    actions_link_click=excluded.actions_link_click,
    actions_offsite_conversion_fb_pixel_purchase=excluded.actions_offsite_conversion_fb_pixel_purchase,
    action_values_offsite_conversion_fb_pixel_purchase=excluded.action_values_offsite_conversion_fb_pixel_purchase;
  get diagnostics v_upserted = row_count;

  select count(*) into v_raw_rows
  from public.staging_meta_ads_windsor
  where account_id=p_account_id and date between p_from and p_to;

  if v_raw_rows<>v_source_rows then
    raise exception 'Meta Windsor raw reconciliation row count mismatch';
  end if;

  if exists (
    with src as (
      select *
      from jsonb_to_recordset(p_rows) as r(
        date date, account_id text, account_name text, account_currency text,
        campaign_id text, campaign text, objective text, spend numeric,
        impressions numeric, reach numeric, clicks numeric, actions_link_click numeric,
        actions_offsite_conversion_fb_pixel_purchase numeric,
        action_values_offsite_conversion_fb_pixel_purchase numeric
      )
    ),
    raw as (
      select date,account_id,account_name,account_currency,campaign_id,campaign,objective,
             spend,impressions,reach,clicks,actions_link_click,
             actions_offsite_conversion_fb_pixel_purchase,
             action_values_offsite_conversion_fb_pixel_purchase
      from public.staging_meta_ads_windsor
      where account_id=p_account_id and date between p_from and p_to
    )
    select 1
    from src s
    full join raw r using(date,account_id,campaign_id)
    where s.date is null or r.date is null
       or s.account_name is distinct from r.account_name
       or s.account_currency is distinct from r.account_currency
       or s.campaign is distinct from r.campaign
       or s.objective is distinct from r.objective
       or s.spend is distinct from r.spend
       or s.impressions is distinct from r.impressions
       or s.reach is distinct from r.reach
       or s.clicks is distinct from r.clicks
       or s.actions_link_click is distinct from r.actions_link_click
       or s.actions_offsite_conversion_fb_pixel_purchase is distinct from r.actions_offsite_conversion_fb_pixel_purchase
       or s.action_values_offsite_conversion_fb_pixel_purchase is distinct from r.action_values_offsite_conversion_fb_pixel_purchase
  ) then
    raise exception 'Meta Windsor raw field reconciliation mismatch';
  end if;

  v_evidence := public.meta_windsor_evidence(p_account_id,p_from,p_to);
  if (v_evidence->>'rows')::bigint<>v_source_rows then
    raise exception 'Meta Windsor evidence row count mismatch';
  end if;

  v_refresh := public.refresh_digital_meta_models(
    p_account_id,p_from,p_to,v_source_rows,v_evidence->>'fingerprint'
  );
  if (v_refresh->>'modeledRows')::bigint<>v_source_rows then
    raise exception 'Meta Windsor modeled row count mismatch';
  end if;

  select count(*) into v_curated_rows
  from public.staging_meta_ads_daily
  where account_id=p_account_id and date between p_from and p_to
    and ingestion_source='windsor_facebook';
  if v_curated_rows<>v_source_rows then
    raise exception 'Meta Windsor curated reconciliation row count mismatch';
  end if;

  return jsonb_build_object(
    'accountId',p_account_id,'from',p_from,'to',p_to,
    'sourceRows',v_source_rows,'rawRows',v_raw_rows,'modeledRows',v_curated_rows,
    'deletedRawRows',v_deleted,'upsertedRawRows',v_upserted,
    'fingerprint',v_evidence->>'fingerprint',
    'sourceLatest',v_evidence->>'latest',
    'currencies',v_evidence->'currencies',
    'purchaseKnownRows',(v_evidence->>'purchaseKnownRows')::bigint,
    'purchaseValueKnownRows',(v_evidence->>'purchaseValueKnownRows')::bigint,
    'refreshedAt',v_refresh->'refreshedAt'
  );
end;
$function$;

revoke all on function public.sync_meta_windsor_snapshot(text,date,date,jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_meta_windsor_snapshot(text,date,date,jsonb)
  to service_role;

rollback;
