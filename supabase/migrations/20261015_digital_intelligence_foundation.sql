-- Digital Intelligence foundation.
-- Stores source history separately and exposes only password-protected BI RPCs.

create table if not exists public.digital_ga4_daily (
  date_id date primary key,
  sessions bigint not null default 0,
  active_users bigint not null default 0,
  engaged_sessions bigint not null default 0,
  add_to_carts bigint not null default 0,
  checkouts bigint not null default 0,
  purchases bigint not null default 0,
  purchase_revenue numeric(18,2) not null default 0,
  imported_at timestamptz not null default now()
);

create table if not exists public.digital_ga4_channel_daily (
  date_id date not null,
  channel text not null,
  sessions bigint not null default 0,
  purchases bigint not null default 0,
  purchase_revenue numeric(18,2) not null default 0,
  imported_at timestamptz not null default now(),
  primary key (date_id,channel)
);

create table if not exists public.digital_ga4_device_daily (
  date_id date not null,
  device text not null,
  sessions bigint not null default 0,
  purchases bigint not null default 0,
  purchase_revenue numeric(18,2) not null default 0,
  imported_at timestamptz not null default now(),
  primary key (date_id,device)
);

create table if not exists public.digital_ga4_landing_daily (
  date_id date not null,
  landing_page text not null,
  sessions bigint not null default 0,
  purchases bigint not null default 0,
  purchase_revenue numeric(18,2) not null default 0,
  imported_at timestamptz not null default now(),
  primary key (date_id,landing_page)
);

create table if not exists public.digital_search_daily (
  date_id date primary key,
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  position numeric(12,4) not null default 0,
  imported_at timestamptz not null default now()
);

create table if not exists public.digital_search_query_daily (
  date_id date not null,
  query text not null,
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  position numeric(12,4) not null default 0,
  imported_at timestamptz not null default now(),
  primary key (date_id,query)
);

create table if not exists public.digital_search_page_daily (
  date_id date not null,
  page text not null,
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  position numeric(12,4) not null default 0,
  imported_at timestamptz not null default now(),
  primary key (date_id,page)
);

create table if not exists public.digital_ga4_landing_snapshot (
  period_end date not null,
  period_days integer not null default 30,
  landing_page text not null,
  sessions bigint not null default 0,
  purchases bigint not null default 0,
  purchase_revenue numeric(18,2) not null default 0,
  imported_at timestamptz not null default now(),
  primary key(period_end,period_days,landing_page)
);

create table if not exists public.digital_search_query_snapshot (
  period_end date not null,
  period_days integer not null default 30,
  query text not null,
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  position numeric(12,4) not null default 0,
  imported_at timestamptz not null default now(),
  primary key(period_end,period_days,query)
);

create table if not exists public.digital_search_page_snapshot (
  period_end date not null,
  period_days integer not null default 30,
  page text not null,
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  position numeric(12,4) not null default 0,
  imported_at timestamptz not null default now(),
  primary key(period_end,period_days,page)
);

alter table public.digital_ga4_daily enable row level security;
alter table public.digital_ga4_channel_daily enable row level security;
alter table public.digital_ga4_device_daily enable row level security;
alter table public.digital_ga4_landing_daily enable row level security;
alter table public.digital_search_daily enable row level security;
alter table public.digital_search_query_daily enable row level security;
alter table public.digital_search_page_daily enable row level security;
alter table public.digital_ga4_landing_snapshot enable row level security;
alter table public.digital_search_query_snapshot enable row level security;
alter table public.digital_search_page_snapshot enable row level security;

revoke all on public.digital_ga4_daily from anon,authenticated;
revoke all on public.digital_ga4_channel_daily from anon,authenticated;
revoke all on public.digital_ga4_device_daily from anon,authenticated;
revoke all on public.digital_ga4_landing_daily from anon,authenticated;
revoke all on public.digital_search_daily from anon,authenticated;
revoke all on public.digital_search_query_daily from anon,authenticated;
revoke all on public.digital_search_page_daily from anon,authenticated;
revoke all on public.digital_ga4_landing_snapshot from anon,authenticated;
revoke all on public.digital_search_query_snapshot from anon,authenticated;
revoke all on public.digital_search_page_snapshot from anon,authenticated;

create index if not exists idx_digital_ga4_channel_date on public.digital_ga4_channel_daily(date_id);
create index if not exists idx_digital_ga4_device_date on public.digital_ga4_device_daily(date_id);
create index if not exists idx_digital_ga4_landing_date on public.digital_ga4_landing_daily(date_id);
create index if not exists idx_digital_search_query_date on public.digital_search_query_daily(date_id);
create index if not exists idx_digital_search_page_date on public.digital_search_page_daily(date_id);

create or replace function public.bi_digital_payload(
  p_password text,
  p_from date default null,
  p_to date default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_ga4_latest date;
  v_search_latest date;
  v_to date;
  v_from date;
  v_previous_from date;
  v_previous_to date;
  v_days integer;
  v_current jsonb;
  v_previous jsonb;
  v_seo jsonb;
  v_previous_seo jsonb;
  v_trend jsonb;
  v_channels jsonb;
  v_devices jsonb;
  v_landings jsonb := '[]'::jsonb;
  v_queries jsonb := '[]'::jsonb;
  v_pages jsonb := '[]'::jsonb;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash := encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;

  select max(date_id) into v_ga4_latest from public.digital_ga4_daily;
  select max(date_id) into v_search_latest from public.digital_search_daily;
  if v_ga4_latest is null then raise exception 'no_digital_data'; end if;

  v_to := coalesce(p_to,coalesce(least(v_ga4_latest,v_search_latest),v_ga4_latest));
  v_from := coalesce(p_from,v_to-29);
  if v_from>v_to then v_from:=v_to; end if;
  v_days := (v_to-v_from)+1;
  v_previous_to:=v_from-1;
  v_previous_from:=v_previous_to-(v_days-1);

  select jsonb_build_object(
    'sessions',coalesce(sum(sessions),0),
    'activeUsers',coalesce(sum(active_users),0),
    'engagedSessions',coalesce(sum(engaged_sessions),0),
    'engagementRate',case when coalesce(sum(sessions),0)=0 then 0 else sum(engaged_sessions)::numeric/sum(sessions) end,
    'addToCarts',coalesce(sum(add_to_carts),0),
    'checkouts',coalesce(sum(checkouts),0),
    'purchases',coalesce(sum(purchases),0),
    'conversionRate',case when coalesce(sum(sessions),0)=0 then 0 else sum(purchases)::numeric/sum(sessions) end,
    'purchaseRevenue',coalesce(sum(purchase_revenue),0),
    'averageOrderValue',case when coalesce(sum(purchases),0)=0 then 0 else sum(purchase_revenue)/sum(purchases) end
  ) into v_current
  from public.digital_ga4_daily where date_id between v_from and v_to;

  select jsonb_build_object(
    'sessions',coalesce(sum(sessions),0),
    'activeUsers',coalesce(sum(active_users),0),
    'engagedSessions',coalesce(sum(engaged_sessions),0),
    'engagementRate',case when coalesce(sum(sessions),0)=0 then 0 else sum(engaged_sessions)::numeric/sum(sessions) end,
    'addToCarts',coalesce(sum(add_to_carts),0),
    'checkouts',coalesce(sum(checkouts),0),
    'purchases',coalesce(sum(purchases),0),
    'conversionRate',case when coalesce(sum(sessions),0)=0 then 0 else sum(purchases)::numeric/sum(sessions) end,
    'purchaseRevenue',coalesce(sum(purchase_revenue),0),
    'averageOrderValue',case when coalesce(sum(purchases),0)=0 then 0 else sum(purchase_revenue)/sum(purchases) end
  ) into v_previous
  from public.digital_ga4_daily where date_id between v_previous_from and v_previous_to;

  select jsonb_build_object(
    'clicks',coalesce(sum(clicks),0),
    'impressions',coalesce(sum(impressions),0),
    'ctr',case when coalesce(sum(impressions),0)=0 then 0 else sum(clicks)::numeric/sum(impressions) end,
    'position',case when coalesce(sum(impressions),0)=0 then 0 else sum(position*impressions)/sum(impressions) end
  ) into v_seo
  from public.digital_search_daily where date_id between v_from and v_to;

  select jsonb_build_object(
    'clicks',coalesce(sum(clicks),0),
    'impressions',coalesce(sum(impressions),0),
    'ctr',case when coalesce(sum(impressions),0)=0 then 0 else sum(clicks)::numeric/sum(impressions) end,
    'position',case when coalesce(sum(impressions),0)=0 then 0 else sum(position*impressions)/sum(impressions) end
  ) into v_previous_seo
  from public.digital_search_daily where date_id between v_previous_from and v_previous_to;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date',d::date,'sessions',coalesce(g.sessions,0),'purchases',coalesce(g.purchases,0),
    'revenue',coalesce(g.purchase_revenue,0),'clicks',coalesce(s.clicks,0),'impressions',coalesce(s.impressions,0)
  ) order by d),'[]'::jsonb)
  into v_trend
  from generate_series(v_from,v_to,interval '1 day') d
  left join public.digital_ga4_daily g on g.date_id=d::date
  left join public.digital_search_daily s on s.date_id=d::date;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.sessions desc),'[]'::jsonb)
  into v_channels
  from (
    select channel,sum(sessions)::bigint sessions,sum(purchases)::bigint purchases,sum(purchase_revenue)::numeric purchase_revenue,
      case when sum(sessions)=0 then 0 else sum(purchases)::numeric/sum(sessions) end conversion_rate
    from public.digital_ga4_channel_daily where date_id between v_from and v_to
    group by channel
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.sessions desc),'[]'::jsonb)
  into v_devices
  from (
    select device,sum(sessions)::bigint sessions,sum(purchases)::bigint purchases,sum(purchase_revenue)::numeric purchase_revenue,
      case when sum(sessions)=0 then 0 else sum(purchases)::numeric/sum(sessions) end conversion_rate
    from public.digital_ga4_device_daily where date_id between v_from and v_to
    group by device
  ) x;

  if v_days=30 then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.sessions desc),'[]'::jsonb)
    into v_landings
    from (
      select landing_page,sessions,purchases,purchase_revenue,
        case when sessions=0 then 0 else purchases::numeric/sessions end conversion_rate
      from public.digital_ga4_landing_snapshot
      where period_end=v_to and period_days=30
      order by sessions desc limit 30
    ) x;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.clicks desc),'[]'::jsonb)
    into v_queries
    from (
      select query,clicks,impressions,
        case when impressions=0 then 0 else clicks::numeric/impressions end ctr,position
      from public.digital_search_query_snapshot
      where period_end=v_to and period_days=30
      order by clicks desc limit 40
    ) x;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.clicks desc),'[]'::jsonb)
    into v_pages
    from (
      select page,clicks,impressions,
        case when impressions=0 then 0 else clicks::numeric/impressions end ctr,position
      from public.digital_search_page_snapshot
      where period_end=v_to and period_days=30
      order by clicks desc limit 30
    ) x;
  end if;

  return jsonb_build_object(
    'meta',jsonb_build_object(
      'from',v_from,'to',v_to,'previousFrom',v_previous_from,'previousTo',v_previous_to,
      'ga4Latest',v_ga4_latest,'searchLatest',v_search_latest,
      'ga4Rows',(select count(*) from public.digital_ga4_daily),
      'searchRows',(select count(*) from public.digital_search_daily)
    ),
    'current',v_current,'previous',v_previous,'seo',v_seo,'previousSeo',v_previous_seo,
    'trend',v_trend,'channels',v_channels,'devices',v_devices,
    'landingPages',v_landings,'seoQueries',v_queries,'seoPages',v_pages
  );
end;
$function$;

create or replace function public.bi_digital_history_payload(p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_ga4_min date;
  v_ga4_max date;
  v_search_min date;
  v_search_max date;
  v_common_max date;
  v_current_year int;
  v_cutoff_month int;
  v_cutoff_day int;
  v_monthly jsonb;
  v_quality jsonb;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash := encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;

  select min(date_id),max(date_id) into v_ga4_min,v_ga4_max from public.digital_ga4_daily;
  select min(date_id),max(date_id) into v_search_min,v_search_max from public.digital_search_daily;
  v_common_max := least(v_ga4_max,v_search_max);
  v_current_year := extract(year from v_common_max)::int;
  v_cutoff_month := extract(month from v_common_max)::int;
  v_cutoff_day := extract(day from v_common_max)::int;

  with months as (
    select y as yr,m as mon
    from generate_series(greatest(2025,extract(year from v_ga4_min)::int),v_current_year) y
    cross join generate_series(1,v_cutoff_month) m
  ),
  ga4 as (
    select extract(year from date_id)::int as yr,extract(month from date_id)::int as mon,
      sum(sessions)::numeric as sessions,sum(purchases)::numeric as purchases,sum(purchase_revenue)::numeric as revenue
    from public.digital_ga4_daily
    where date_id<=v_common_max
      and extract(month from date_id)::int<=v_cutoff_month
      and not (extract(year from date_id)::int<v_current_year
        and extract(month from date_id)::int=v_cutoff_month
        and extract(day from date_id)::int>v_cutoff_day)
    group by 1,2
  ),
  seo as (
    select extract(year from date_id)::int as yr,extract(month from date_id)::int as mon,
      sum(clicks)::numeric as clicks,sum(impressions)::numeric as impressions,
      case when sum(impressions)=0 then null else sum(position*impressions)/sum(impressions) end as position
    from public.digital_search_daily
    where date_id<=v_common_max
      and extract(month from date_id)::int<=v_cutoff_month
      and not (extract(year from date_id)::int<v_current_year
        and extract(month from date_id)::int=v_cutoff_month
        and extract(day from date_id)::int>v_cutoff_day)
    group by 1,2
  )
  select jsonb_agg(jsonb_build_object(
    'year',m.yr,'month',m.mon,
    'sessions',case when g.yr is null then null else g.sessions end,
    'purchases',case when g.yr is null then null else g.purchases end,
    'revenue',case when g.yr is null then null else g.revenue end,
    'conversionRate',case when g.sessions is null or g.sessions=0 then null else g.purchases/g.sessions end,
    'averageOrderValue',case when g.purchases is null or g.purchases=0 then null else g.revenue/g.purchases end,
    'seoClicks',case when s.yr is null then null else s.clicks end,
    'seoImpressions',case when s.yr is null then null else s.impressions end,
    'seoCtr',case when s.impressions is null or s.impressions=0 then null else s.clicks/s.impressions end,
    'seoPosition',s.position,
    'partial',m.mon=v_cutoff_month
  ) order by m.yr,m.mon)
  into v_monthly
  from months m
  left join ga4 g on g.yr=m.yr and g.mon=m.mon
  left join seo s on s.yr=m.yr and s.mon=m.mon;

  select jsonb_build_object(
    'commonLatest',v_common_max,
    'ga4',jsonb_build_object(
      'from',v_ga4_min,'to',v_ga4_max,'rows',(select count(*) from public.digital_ga4_daily),
      'last7Sessions',(select coalesce(sum(sessions),0) from public.digital_ga4_daily where date_id between v_ga4_max-6 and v_ga4_max),
      'last7Purchases',(select coalesce(sum(purchases),0) from public.digital_ga4_daily where date_id between v_ga4_max-6 and v_ga4_max)
    ),
    'searchConsole',jsonb_build_object('from',v_search_min,'to',v_search_max,'rows',(select count(*) from public.digital_search_daily)),
    'channels',jsonb_build_object('from',(select min(date_id) from public.digital_ga4_channel_daily),'to',(select max(date_id) from public.digital_ga4_channel_daily),'rows',(select count(*) from public.digital_ga4_channel_daily)),
    'devices',jsonb_build_object('from',(select min(date_id) from public.digital_ga4_device_daily),'to',(select max(date_id) from public.digital_ga4_device_daily),'rows',(select count(*) from public.digital_ga4_device_daily)),
    'landingSnapshot',jsonb_build_object('to',(select max(period_end) from public.digital_ga4_landing_snapshot),'rows',(select count(*) from public.digital_ga4_landing_snapshot)),
    'querySnapshot',jsonb_build_object('to',(select max(period_end) from public.digital_search_query_snapshot),'rows',(select count(*) from public.digital_search_query_snapshot)),
    'pageSnapshot',jsonb_build_object('to',(select max(period_end) from public.digital_search_page_snapshot),'rows',(select count(*) from public.digital_search_page_snapshot))
  ) into v_quality;

  return jsonb_build_object(
    'meta',jsonb_build_object('currentYear',v_current_year,'commonLatest',v_common_max,'cutoffMonth',v_cutoff_month,'cutoffDay',v_cutoff_day),
    'monthly',coalesce(v_monthly,'[]'::jsonb),
    'quality',v_quality
  );
end;
$function$;

revoke all on function public.bi_digital_payload(text,date,date) from public,authenticated;
revoke all on function public.bi_digital_history_payload(text) from public,authenticated;
grant execute on function public.bi_digital_payload(text,date,date) to anon,service_role;
grant execute on function public.bi_digital_history_payload(text) to anon,service_role;
