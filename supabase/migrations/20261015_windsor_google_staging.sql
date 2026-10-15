-- Raw Windsor staging layer for reliable recurring Google imports.

create table if not exists public.staging_google_ads_windsor (
  date_id date not null,
  account_id text not null,
  account_name text,
  campaign_id text not null,
  campaign_name text,
  cost numeric(18,4) not null default 0,
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  conversions numeric(18,4) not null default 0,
  conversions_value numeric(18,4) not null default 0,
  imported_at timestamptz not null default now(),
  primary key (date_id,account_id,campaign_id)
);

create table if not exists public.staging_gbp_windsor (
  date_id date not null,
  account_id text,
  location_id text not null,
  location_title text,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  call_clicks bigint not null default 0,
  website_clicks bigint not null default 0,
  direction_requests bigint not null default 0,
  business_food_menu_clicks bigint not null default 0,
  imported_at timestamptz not null default now(),
  primary key (date_id,location_id)
);

alter table public.staging_google_ads_windsor enable row level security;
alter table public.staging_gbp_windsor enable row level security;
revoke all on public.staging_google_ads_windsor from anon,authenticated;
revoke all on public.staging_gbp_windsor from anon,authenticated;

create index if not exists idx_staging_google_ads_windsor_date on public.staging_google_ads_windsor(date_id);
create index if not exists idx_staging_gbp_windsor_date on public.staging_gbp_windsor(date_id);

create or replace function public.refresh_digital_google_models()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ads_rows integer := 0;
  v_gbp_rows integer := 0;
  v_ads_latest date;
begin
  insert into public.digital_google_ads_daily(date_id,cost,clicks,impressions,conversions,conversion_value,imported_at)
  select
    date_id,
    sum(cost),
    sum(clicks),
    sum(impressions),
    sum(conversions),
    sum(conversions_value),
    now()
  from public.staging_google_ads_windsor
  group by date_id
  on conflict(date_id) do update set
    cost=excluded.cost,
    clicks=excluded.clicks,
    impressions=excluded.impressions,
    conversions=excluded.conversions,
    conversion_value=excluded.conversion_value,
    imported_at=now();
  get diagnostics v_ads_rows = row_count;

  select max(date_id) into v_ads_latest from public.staging_google_ads_windsor;
  if v_ads_latest is not null then
    delete from public.digital_google_ads_campaign_snapshot
    where period_end=v_ads_latest and period_days=30;

    insert into public.digital_google_ads_campaign_snapshot(
      period_end,period_days,campaign_name,cost,clicks,impressions,conversions,conversion_value,imported_at
    )
    select
      v_ads_latest,
      30,
      coalesce(campaign_name,campaign_id),
      sum(cost),
      sum(clicks),
      sum(impressions),
      sum(conversions),
      sum(conversions_value),
      now()
    from public.staging_google_ads_windsor
    where date_id between v_ads_latest-29 and v_ads_latest
    group by coalesce(campaign_name,campaign_id);
  end if;

  insert into public.digital_gbp_daily(
    date_id,location_id,location_title,impressions,clicks,call_clicks,website_clicks,direction_requests,menu_clicks,imported_at
  )
  select
    date_id,
    location_id,
    coalesce(location_title,location_id),
    sum(impressions),
    sum(clicks),
    sum(call_clicks),
    sum(website_clicks),
    sum(direction_requests),
    sum(business_food_menu_clicks),
    now()
  from public.staging_gbp_windsor
  group by date_id,location_id,coalesce(location_title,location_id)
  on conflict(date_id,location_id) do update set
    location_title=excluded.location_title,
    impressions=excluded.impressions,
    clicks=excluded.clicks,
    call_clicks=excluded.call_clicks,
    website_clicks=excluded.website_clicks,
    direction_requests=excluded.direction_requests,
    menu_clicks=excluded.menu_clicks,
    imported_at=now();
  get diagnostics v_gbp_rows = row_count;

  return jsonb_build_object(
    'adsDailyRows',v_ads_rows,
    'gbpDailyRows',v_gbp_rows,
    'adsLatest',v_ads_latest,
    'refreshedAt',now()
  );
end;
$function$;

revoke all on function public.refresh_digital_google_models() from public,anon,authenticated;
grant execute on function public.refresh_digital_google_models() to service_role;
