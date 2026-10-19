-- Meta Ads staging contract.
-- Source: Windsor facebook connector after OAuth.

create table if not exists public.staging_meta_ads_daily (
  date date not null,
  account_id text not null default '',
  account_name text,
  campaign_id text not null default '',
  campaign_name text,
  adset_id text not null default '',
  adset_name text,
  ad_id text not null default '',
  ad_name text,
  objective text,
  spend numeric,
  impressions numeric,
  reach numeric,
  frequency numeric,
  clicks numeric,
  link_clicks numeric,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  conversions numeric,
  purchases numeric,
  purchase_value numeric,
  imported_at timestamptz not null default now(),
  primary key (date, account_id, campaign_id, adset_id, ad_id)
);

alter table public.staging_meta_ads_daily enable row level security;

create or replace function public.bi_digital_meta_ads_payload(p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_latest date;
  v_from date;
  v_summary jsonb;
  v_campaigns jsonb;
begin
  select value_hash into v_expected_hash
  from public.bi_runtime_config
  where config_key='access_password';

  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then
    raise exception 'unauthorized';
  end if;

  select max(date) into v_latest from public.staging_meta_ads_daily;
  if v_latest is not null then v_from:=v_latest-29; end if;

  select jsonb_build_object(
    'spend',coalesce(sum(spend),0),
    'impressions',coalesce(sum(impressions),0),
    'reach',coalesce(sum(reach),0),
    'clicks',coalesce(sum(clicks),0),
    'linkClicks',coalesce(sum(link_clicks),0),
    'conversions',coalesce(sum(conversions),0),
    'purchases',coalesce(sum(purchases),0),
    'purchaseValue',coalesce(sum(purchase_value),0),
    'ctr',case when coalesce(sum(impressions),0)=0 then 0 else sum(clicks)/sum(impressions) end,
    'cpc',case when coalesce(sum(clicks),0)=0 then 0 else sum(spend)/sum(clicks) end,
    'cpm',case when coalesce(sum(impressions),0)=0 then 0 else 1000*sum(spend)/sum(impressions) end,
    'roas',case when coalesce(sum(spend),0)=0 then 0 else sum(purchase_value)/sum(spend) end
  ) into v_summary
  from public.staging_meta_ads_daily
  where v_latest is not null and date between v_from and v_latest;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.spend desc),'[]'::jsonb)
  into v_campaigns
  from (
    select
      campaign_id,
      max(campaign_name) campaign_name,
      max(objective) objective,
      sum(spend)::numeric spend,
      sum(impressions)::numeric impressions,
      sum(clicks)::numeric clicks,
      sum(link_clicks)::numeric link_clicks,
      sum(conversions)::numeric conversions,
      sum(purchases)::numeric purchases,
      sum(purchase_value)::numeric purchase_value,
      case when sum(impressions)=0 then 0 else sum(clicks)/sum(impressions) end ctr,
      case when sum(clicks)=0 then 0 else sum(spend)/sum(clicks) end cpc,
      case when sum(spend)=0 then 0 else sum(purchase_value)/sum(spend) end roas
    from public.staging_meta_ads_daily
    where v_latest is not null and date between v_from and v_latest
    group by campaign_id
    order by sum(spend) desc
    limit 50
  ) x;

  return jsonb_build_object(
    'meta',jsonb_build_object(
      'status','contract-ready',
      'from',v_from,
      'to',v_latest,
      'rows',(select count(*) from public.staging_meta_ads_daily)
    ),
    'summary',coalesce(v_summary,'{}'::jsonb),
    'campaigns',coalesce(v_campaigns,'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.bi_digital_meta_ads_payload(text) from public,authenticated;
grant execute on function public.bi_digital_meta_ads_payload(text) to anon,service_role;
