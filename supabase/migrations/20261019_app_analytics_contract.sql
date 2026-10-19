-- App Analytics staging contracts and password-gated payload.
-- Empty by design until Firebase / stores / backend / attribution sources are connected.

create table if not exists public.staging_app_store_daily (
  date date not null,
  platform text not null check (platform in ('ios','android')),
  store_impressions numeric,
  product_page_views numeric,
  downloads numeric,
  first_time_downloads numeric,
  redownloads numeric,
  installations numeric,
  deletions numeric,
  first_opens numeric,
  store_conversion_rate numeric,
  imported_at timestamptz not null default now(),
  primary key (date, platform)
);

create table if not exists public.staging_app_firebase_daily (
  date date not null,
  platform text not null check (platform in ('ios','android')),
  active_users numeric,
  new_users numeric,
  first_opens numeric,
  sign_ups numeric,
  logins numeric,
  view_items numeric,
  add_to_carts numeric,
  begin_checkouts numeric,
  purchases numeric,
  purchase_revenue numeric,
  push_opens numeric,
  app_removes numeric,
  imported_at timestamptz not null default now(),
  primary key (date, platform)
);

create table if not exists public.staging_app_quality_daily (
  date date not null,
  platform text not null check (platform in ('ios','android')),
  app_version text not null default 'unknown',
  crash_free_users_rate numeric,
  crash_free_sessions_rate numeric,
  crashes numeric,
  fatal_crashes numeric,
  nonfatal_errors numeric,
  anr numeric,
  api_errors numeric,
  checkout_errors numeric,
  payment_errors numeric,
  imported_at timestamptz not null default now(),
  primary key (date, platform, app_version)
);

create table if not exists public.staging_app_acquisition_daily (
  date date not null,
  platform text not null check (platform in ('ios','android')),
  source text not null,
  campaign text not null default '',
  spend numeric,
  impressions numeric,
  clicks numeric,
  installs numeric,
  registrations numeric,
  first_buyers numeric,
  orders numeric,
  revenue numeric,
  imported_at timestamptz not null default now(),
  primary key (date, platform, source, campaign)
);

create table if not exists public.staging_app_users (
  user_id_hash text primary key,
  platform text check (platform in ('ios','android')),
  registered_at timestamptz,
  first_open_at timestamptz,
  first_order_at timestamptz,
  last_order_at timestamptz,
  acquisition_source text,
  acquisition_campaign text,
  imported_at timestamptz not null default now()
);

create table if not exists public.staging_app_orders (
  order_id text primary key,
  ordered_at timestamptz not null,
  user_id_hash text,
  platform text check (platform in ('ios','android')),
  acquisition_source text,
  acquisition_campaign text,
  revenue numeric,
  contribution_margin numeric,
  order_number_for_user integer,
  status text,
  location_id text,
  imported_at timestamptz not null default now()
);

alter table public.staging_app_store_daily enable row level security;
alter table public.staging_app_firebase_daily enable row level security;
alter table public.staging_app_quality_daily enable row level security;
alter table public.staging_app_acquisition_daily enable row level security;
alter table public.staging_app_users enable row level security;
alter table public.staging_app_orders enable row level security;

create or replace function public.bi_digital_app_payload(p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_ads jsonb;
  v_sources jsonb;
  v_overview jsonb;
  v_economics jsonb;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.spend desc),'[]'::jsonb)
  into v_ads
  from (
    select
      case
        when lower(campaign_name) like '%android%' then 'android'
        when lower(campaign_name) like '%ios%' then 'ios'
        else 'unknown'
      end platform,
      campaign_name,
      sum(cost)::numeric spend,
      sum(impressions)::bigint impressions,
      sum(clicks)::bigint clicks,
      sum(conversions)::numeric conversions,
      sum(conversions_value)::numeric conversion_value,
      case when sum(conversions)=0 then null else sum(cost)/sum(conversions) end cost_per_conversion,
      min(date) from_date,
      max(date) to_date
    from public.staging_google_ads_windsor
    where lower(campaign_name) like 'app_%'
    group by 1,2
  ) x;

  select jsonb_build_object(
    'store',jsonb_build_object(
      'rows',(select count(*) from public.staging_app_store_daily),
      'latest',(select max(date) from public.staging_app_store_daily)
    ),
    'firebase',jsonb_build_object(
      'rows',(select count(*) from public.staging_app_firebase_daily),
      'latest',(select max(date) from public.staging_app_firebase_daily)
    ),
    'quality',jsonb_build_object(
      'rows',(select count(*) from public.staging_app_quality_daily),
      'latest',(select max(date) from public.staging_app_quality_daily)
    ),
    'acquisition',jsonb_build_object(
      'rows',(select count(*) from public.staging_app_acquisition_daily),
      'latest',(select max(date) from public.staging_app_acquisition_daily)
    ),
    'users',jsonb_build_object(
      'rows',(select count(*) from public.staging_app_users)
    ),
    'orders',jsonb_build_object(
      'rows',(select count(*) from public.staging_app_orders),
      'latest',(select max(ordered_at) from public.staging_app_orders)
    )
  ) into v_sources;

  select jsonb_build_object(
    'downloads',coalesce((select sum(downloads) from public.staging_app_store_daily),0),
    'firstTimeDownloads',coalesce((select sum(first_time_downloads) from public.staging_app_store_daily),0),
    'firstOpens',coalesce((select sum(first_opens) from public.staging_app_firebase_daily),0),
    'registrations',coalesce((select sum(sign_ups) from public.staging_app_firebase_daily),0),
    'purchases',coalesce((select sum(purchases) from public.staging_app_firebase_daily),0),
    'purchaseRevenue',coalesce((select sum(purchase_revenue) from public.staging_app_firebase_daily),0),
    'registeredUsers',coalesce((select count(*) from public.staging_app_users where registered_at is not null),0),
    'registeredNoOrder',coalesce((select count(*) from public.staging_app_users where registered_at is not null and first_order_at is null),0),
    'buyers',coalesce((select count(*) from public.staging_app_users where first_order_at is not null),0),
    'orders',coalesce((select count(*) from public.staging_app_orders where coalesce(status,'') not in ('cancelled','refunded')),0),
    'orderRevenue',coalesce((select sum(revenue) from public.staging_app_orders where coalesce(status,'') not in ('cancelled','refunded')),0),
    'repeatBuyers',coalesce((select count(distinct user_id_hash) from public.staging_app_orders where order_number_for_user>=2),0)
  ) into v_overview;

  select jsonb_build_object(
    'spend',coalesce((select sum(spend) from public.staging_app_acquisition_daily),0),
    'installs',coalesce((select sum(installs) from public.staging_app_acquisition_daily),0),
    'registrations',coalesce((select sum(registrations) from public.staging_app_acquisition_daily),0),
    'firstBuyers',coalesce((select sum(first_buyers) from public.staging_app_acquisition_daily),0),
    'revenue',coalesce((select sum(revenue) from public.staging_app_acquisition_daily),0)
  ) into v_economics;

  return jsonb_build_object(
    'meta',jsonb_build_object('status','contract-ready'),
    'sources',v_sources,
    'overview',v_overview,
    'economics',v_economics,
    'googleAdsApp',v_ads
  );
end;
$function$;

revoke all on function public.bi_digital_app_payload(text) from public,authenticated;
grant execute on function public.bi_digital_app_payload(text) to anon,service_role;
