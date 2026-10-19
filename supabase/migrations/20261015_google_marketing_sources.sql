-- Google marketing sources for Digital Intelligence.
create table if not exists public.digital_google_ads_daily (
  date_id date primary key,cost numeric(18,4) not null default 0,clicks bigint not null default 0,impressions bigint not null default 0,
  conversions numeric(18,4) not null default 0,conversion_value numeric(18,4) not null default 0,imported_at timestamptz not null default now()
);
create table if not exists public.digital_google_ads_campaign_snapshot (
  period_end date not null,period_days integer not null default 30,campaign_name text not null,cost numeric(18,4) not null default 0,
  clicks bigint not null default 0,impressions bigint not null default 0,conversions numeric(18,4) not null default 0,
  conversion_value numeric(18,4) not null default 0,imported_at timestamptz not null default now(),primary key(period_end,period_days,campaign_name)
);
create table if not exists public.digital_pagespeed_snapshot (
  captured_on date primary key,desktop_score numeric(10,2),mobile_score numeric(10,2),desktop_lcp numeric(12,2),desktop_inp numeric(12,2),
  desktop_cls numeric(12,4),mobile_lcp numeric(12,2),mobile_inp numeric(12,2),mobile_cls numeric(12,4),desktop_category text,mobile_category text,
  imported_at timestamptz not null default now()
);
create table if not exists public.digital_gbp_daily (
  date_id date not null,location_id text not null,location_title text not null,impressions bigint not null default 0,clicks bigint not null default 0,
  call_clicks bigint not null default 0,website_clicks bigint not null default 0,direction_requests bigint not null default 0,menu_clicks bigint not null default 0,
  imported_at timestamptz not null default now(),primary key(date_id,location_id)
);
alter table public.digital_google_ads_daily enable row level security;
alter table public.digital_google_ads_campaign_snapshot enable row level security;
alter table public.digital_pagespeed_snapshot enable row level security;
alter table public.digital_gbp_daily enable row level security;
revoke all on public.digital_google_ads_daily,public.digital_google_ads_campaign_snapshot,public.digital_pagespeed_snapshot,public.digital_gbp_daily from anon,authenticated;
create index if not exists idx_digital_gbp_date on public.digital_gbp_daily(date_id);



create or replace function public.bi_digital_ads_payload(p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_expected_hash text; v_actual_hash text; v_latest date; v_from date;
  v_summary jsonb; v_campaigns jsonb; v_trend jsonb;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;
  select max(date_id) into v_latest from public.digital_google_ads_daily;
  if v_latest is null then
    return jsonb_build_object('meta',jsonb_build_object('available',false),'summary',jsonb_build_object(),'campaigns','[]'::jsonb,'trend','[]'::jsonb);
  end if;
  v_from:=v_latest-29;
  select jsonb_build_object(
    'cost',coalesce(sum(cost),0),'clicks',coalesce(sum(clicks),0),'impressions',coalesce(sum(impressions),0),
    'conversions',coalesce(sum(conversions),0),'conversionValue',coalesce(sum(conversion_value),0),
    'ctr',case when coalesce(sum(impressions),0)=0 then 0 else sum(clicks)::numeric/sum(impressions) end,
    'cpc',case when coalesce(sum(clicks),0)=0 then 0 else sum(cost)/sum(clicks) end,
    'cpa',case when coalesce(sum(conversions),0)=0 then 0 else sum(cost)/sum(conversions) end,
    'roas',case when coalesce(sum(cost),0)=0 then 0 else sum(conversion_value)/sum(cost) end
  ) into v_summary from public.digital_google_ads_daily where date_id between v_from and v_latest;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.cost desc),'[]'::jsonb) into v_campaigns from (
    select campaign_name,cost,clicks,impressions,conversions,conversion_value,
      case when impressions=0 then 0 else clicks::numeric/impressions end ctr,
      case when clicks=0 then 0 else cost/clicks end cpc,
      case when conversions=0 then 0 else cost/conversions end cpa,
      case when cost=0 then 0 else conversion_value/cost end roas
    from public.digital_google_ads_campaign_snapshot
    where period_end=v_latest and period_days=30
  ) x;
  select coalesce(jsonb_agg(jsonb_build_object(
    'date',date_id,'cost',cost,'clicks',clicks,'impressions',impressions,'conversions',conversions,'conversionValue',conversion_value
  ) order by date_id),'[]'::jsonb) into v_trend
  from public.digital_google_ads_daily where date_id between v_from and v_latest;
  return jsonb_build_object('meta',jsonb_build_object('available',true,'from',v_from,'to',v_latest,'days',30),'summary',v_summary,'campaigns',v_campaigns,'trend',v_trend);
end;
$function$;

create or replace function public.bi_digital_local_payload(p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_expected_hash text; v_actual_hash text; v_latest date; v_from date;
  v_summary jsonb; v_locations jsonb; v_speed jsonb;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;
  select max(date_id) into v_latest from public.digital_gbp_daily;
  v_from:=coalesce(v_latest,current_date)-29;
  select jsonb_build_object(
    'impressions',coalesce(sum(impressions),0),'clicks',coalesce(sum(clicks),0),'calls',coalesce(sum(call_clicks),0),
    'websiteClicks',coalesce(sum(website_clicks),0),'directions',coalesce(sum(direction_requests),0),'menuClicks',coalesce(sum(menu_clicks),0)
  ) into v_summary from public.digital_gbp_daily where date_id between v_from and v_latest;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.impressions desc),'[]'::jsonb) into v_locations from (
    select location_id,location_title,sum(impressions)::bigint impressions,sum(clicks)::bigint clicks,
      sum(call_clicks)::bigint calls,sum(website_clicks)::bigint website_clicks,
      sum(direction_requests)::bigint directions,sum(menu_clicks)::bigint menu_clicks
    from public.digital_gbp_daily where date_id between v_from and v_latest
    group by location_id,location_title
  ) x;
  select to_jsonb(x) into v_speed from (
    select captured_on,desktop_score,mobile_score,desktop_lcp,desktop_inp,desktop_cls,
      mobile_lcp,mobile_inp,mobile_cls,desktop_category,mobile_category
    from public.digital_pagespeed_snapshot order by captured_on desc limit 1
  ) x;
  return jsonb_build_object('meta',jsonb_build_object('from',v_from,'to',v_latest),'summary',v_summary,'locations',v_locations,'pageSpeed',coalesce(v_speed,'{}'::jsonb));
end;
$function$;

revoke all on function public.bi_digital_ads_payload(text) from public,authenticated;
revoke all on function public.bi_digital_local_payload(text) from public,authenticated;
grant execute on function public.bi_digital_ads_payload(text) to anon,service_role;
grant execute on function public.bi_digital_local_payload(text) to anon,service_role;
