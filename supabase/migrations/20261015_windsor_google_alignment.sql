-- Align Windsor staging column names to connector field ids and cover all core Google sources.

alter table public.staging_google_ads_windsor rename column date_id to date;
alter table public.staging_gbp_windsor rename column date_id to date;

create table if not exists public.staging_ga4_daily_windsor (
  date date primary key,
  sessions bigint not null default 0,
  active_users bigint not null default 0,
  engaged_sessions bigint not null default 0,
  add_to_carts bigint not null default 0,
  checkouts bigint not null default 0,
  ecommerce_purchases bigint not null default 0,
  purchase_revenue numeric(18,2) not null default 0,
  imported_at timestamptz not null default now()
);

create table if not exists public.staging_searchconsole_daily_windsor (
  date date primary key,
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  position numeric(12,4) not null default 0,
  imported_at timestamptz not null default now()
);

create table if not exists public.staging_pagespeed_windsor (
  account_id text primary key,
  account_name text,
  desktop_score numeric(10,2),
  mobile_score numeric(10,2),
  crux_desktop_lcp numeric(12,2),
  crux_desktop_inp numeric(12,2),
  crux_desktop_cls numeric(12,4),
  crux_mobile_lcp numeric(12,2),
  crux_mobile_inp numeric(12,2),
  crux_mobile_cls numeric(12,4),
  crux_desktop_overall_category text,
  crux_mobile_overall_category text,
  imported_at timestamptz not null default now()
);

alter table public.staging_ga4_daily_windsor enable row level security;
alter table public.staging_searchconsole_daily_windsor enable row level security;
alter table public.staging_pagespeed_windsor enable row level security;

revoke all on public.staging_ga4_daily_windsor from anon,authenticated;
revoke all on public.staging_searchconsole_daily_windsor from anon,authenticated;
revoke all on public.staging_pagespeed_windsor from anon,authenticated;

create index if not exists idx_staging_google_ads_windsor_date on public.staging_google_ads_windsor(date);
create index if not exists idx_staging_gbp_windsor_date on public.staging_gbp_windsor(date);

create or replace function public.refresh_digital_google_models()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ga4_rows integer := 0;
  v_search_rows integer := 0;
  v_ads_rows integer := 0;
  v_gbp_rows integer := 0;
  v_speed_rows integer := 0;
  v_ads_latest date;
begin
  insert into public.digital_ga4_daily(
    date_id,sessions,active_users,engaged_sessions,add_to_carts,checkouts,purchases,purchase_revenue,imported_at
  )
  select
    date,sessions,active_users,engaged_sessions,add_to_carts,checkouts,ecommerce_purchases,purchase_revenue,now()
  from public.staging_ga4_daily_windsor
  on conflict(date_id) do update set
    sessions=excluded.sessions,
    active_users=excluded.active_users,
    engaged_sessions=excluded.engaged_sessions,
    add_to_carts=excluded.add_to_carts,
    checkouts=excluded.checkouts,
    purchases=excluded.purchases,
    purchase_revenue=excluded.purchase_revenue,
    imported_at=now();
  get diagnostics v_ga4_rows = row_count;

  insert into public.digital_search_daily(date_id,clicks,impressions,position,imported_at)
  select date,clicks,impressions,position,now()
  from public.staging_searchconsole_daily_windsor
  on conflict(date_id) do update set
    clicks=excluded.clicks,
    impressions=excluded.impressions,
    position=excluded.position,
    imported_at=now();
  get diagnostics v_search_rows = row_count;

  insert into public.digital_google_ads_daily(date_id,cost,clicks,impressions,conversions,conversion_value,imported_at)
  select
    date,
    sum(cost),
    sum(clicks),
    sum(impressions),
    sum(conversions),
    sum(conversions_value),
    now()
  from public.staging_google_ads_windsor
  group by date
  on conflict(date_id) do update set
    cost=excluded.cost,
    clicks=excluded.clicks,
    impressions=excluded.impressions,
    conversions=excluded.conversions,
    conversion_value=excluded.conversion_value,
    imported_at=now();
  get diagnostics v_ads_rows = row_count;

  select max(date) into v_ads_latest from public.staging_google_ads_windsor;
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
    where date between v_ads_latest-29 and v_ads_latest
    group by coalesce(campaign_name,campaign_id);
  end if;

  insert into public.digital_gbp_daily(
    date_id,location_id,location_title,impressions,clicks,call_clicks,website_clicks,direction_requests,menu_clicks,imported_at
  )
  select
    date,
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
  group by date,location_id,coalesce(location_title,location_id)
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

  insert into public.digital_pagespeed_snapshot(
    captured_on,desktop_score,mobile_score,desktop_lcp,desktop_inp,desktop_cls,
    mobile_lcp,mobile_inp,mobile_cls,desktop_category,mobile_category,imported_at
  )
  select
    current_date,
    desktop_score,
    mobile_score,
    crux_desktop_lcp,
    crux_desktop_inp,
    crux_desktop_cls,
    crux_mobile_lcp,
    crux_mobile_inp,
    crux_mobile_cls,
    crux_desktop_overall_category,
    crux_mobile_overall_category,
    now()
  from public.staging_pagespeed_windsor
  order by account_id
  limit 1
  on conflict(captured_on) do update set
    desktop_score=excluded.desktop_score,
    mobile_score=excluded.mobile_score,
    desktop_lcp=excluded.desktop_lcp,
    desktop_inp=excluded.desktop_inp,
    desktop_cls=excluded.desktop_cls,
    mobile_lcp=excluded.mobile_lcp,
    mobile_inp=excluded.mobile_inp,
    mobile_cls=excluded.mobile_cls,
    desktop_category=excluded.desktop_category,
    mobile_category=excluded.mobile_category,
    imported_at=now();
  get diagnostics v_speed_rows = row_count;

  return jsonb_build_object(
    'ga4Rows',v_ga4_rows,
    'searchRows',v_search_rows,
    'adsDailyRows',v_ads_rows,
    'gbpDailyRows',v_gbp_rows,
    'pageSpeedRows',v_speed_rows,
    'adsLatest',v_ads_latest,
    'refreshedAt',now()
  );
end;
$function$;

revoke all on function public.refresh_digital_google_models() from public,anon,authenticated;
grant execute on function public.refresh_digital_google_models() to service_role;
