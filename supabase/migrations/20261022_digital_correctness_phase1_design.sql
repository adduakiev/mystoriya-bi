-- PREPARED DESIGN ONLY — NOT APPLIED. Issue #12 does not authorize execution.
-- Replaces read RPCs only; preserves password checks, SECURITY DEFINER search_path and grants.
-- Existing NOT NULL/default-zero storage cannot recover omitted provider fields.
-- Warehouse date counts do not prove provider completeness or an atomic collection snapshot.
-- Requires PostgreSQL integration verification and owner-authorized migration before application.

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
    'sessions',sum(sessions),
    'activeUsers',null,
    'engagedSessions',sum(engaged_sessions),
    'engagementRate',case when sum(sessions)=0 then null else sum(engaged_sessions)::numeric/sum(sessions) end,
    'addToCarts',sum(add_to_carts),
    'checkouts',sum(checkouts),
    'purchases',sum(purchases),
    'conversionRate',case when sum(sessions)=0 then null else sum(purchases)::numeric/sum(sessions) end,
    'purchaseRevenue',sum(purchase_revenue),
    'averageOrderValue',case when sum(purchases)=0 then null else sum(purchase_revenue)/sum(purchases) end
  ) into v_current
  from public.digital_ga4_daily where date_id between v_from and v_to;

  select jsonb_build_object(
    'sessions',sum(sessions),
    'activeUsers',null,
    'engagedSessions',sum(engaged_sessions),
    'engagementRate',case when sum(sessions)=0 then null else sum(engaged_sessions)::numeric/sum(sessions) end,
    'addToCarts',sum(add_to_carts),
    'checkouts',sum(checkouts),
    'purchases',sum(purchases),
    'conversionRate',case when sum(sessions)=0 then null else sum(purchases)::numeric/sum(sessions) end,
    'purchaseRevenue',sum(purchase_revenue),
    'averageOrderValue',case when sum(purchases)=0 then null else sum(purchase_revenue)/sum(purchases) end
  ) into v_previous
  from public.digital_ga4_daily where date_id between v_previous_from and v_previous_to;

  select jsonb_build_object(
    'clicks',sum(clicks),
    'impressions',sum(impressions),
    'ctr',case when sum(impressions)=0 then null else sum(clicks)::numeric/sum(impressions) end,
    'position',case when sum(impressions)=0 then null else sum(position*impressions)/sum(impressions) end
  ) into v_seo
  from public.digital_search_daily where date_id between v_from and v_to;

  select jsonb_build_object(
    'clicks',sum(clicks),
    'impressions',sum(impressions),
    'ctr',case when sum(impressions)=0 then null else sum(clicks)::numeric/sum(impressions) end,
    'position',case when sum(impressions)=0 then null else sum(position*impressions)/sum(impressions) end
  ) into v_previous_seo
  from public.digital_search_daily where date_id between v_previous_from and v_previous_to;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date',d::date,'sessions',g.sessions,'purchases',g.purchases,
    'revenue',g.purchase_revenue,'clicks',s.clicks,'impressions',s.impressions
  ) order by d),'[]'::jsonb)
  into v_trend
  from generate_series(v_from,v_to,interval '1 day') d
  left join public.digital_ga4_daily g on g.date_id=d::date
  left join public.digital_search_daily s on s.date_id=d::date;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.sessions desc),'[]'::jsonb)
  into v_channels
  from (
    select channel,sum(sessions)::bigint sessions,sum(purchases)::bigint purchases,sum(purchase_revenue)::numeric purchase_revenue,
      case when sum(sessions)=0 then null else sum(purchases)::numeric/sum(sessions) end conversion_rate
    from public.digital_ga4_channel_daily where date_id between v_from and v_to
    group by channel
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.sessions desc),'[]'::jsonb)
  into v_devices
  from (
    select device,sum(sessions)::bigint sessions,sum(purchases)::bigint purchases,sum(purchase_revenue)::numeric purchase_revenue,
      case when sum(sessions)=0 then null else sum(purchases)::numeric/sum(sessions) end conversion_rate
    from public.digital_ga4_device_daily where date_id between v_from and v_to
    group by device
  ) x;

  if v_days=30 then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.sessions desc),'[]'::jsonb)
    into v_landings
    from (
      select landing_page,sessions,purchases,purchase_revenue,
        case when sessions=0 then null else purchases::numeric/sessions end conversion_rate
      from public.digital_ga4_landing_snapshot
      where period_end=v_to and period_days=30
      order by sessions desc limit 30
    ) x;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.clicks desc),'[]'::jsonb)
    into v_queries
    from (
      select query,clicks,impressions,
        case when impressions=0 then null else clicks::numeric/impressions end ctr,position
      from public.digital_search_query_snapshot
      where period_end=v_to and period_days=30
      order by clicks desc limit 40
    ) x;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.clicks desc),'[]'::jsonb)
    into v_pages
    from (
      select page,clicks,impressions,
        case when impressions=0 then null else clicks::numeric/impressions end ctr,position
      from public.digital_search_page_snapshot
      where period_end=v_to and period_days=30
      order by clicks desc limit 30
    ) x;
  end if;

  return jsonb_build_object(
    'meta',jsonb_build_object(
      'from',v_from,'to',v_to,'previousFrom',v_previous_from,'previousTo',v_previous_to,
      'ga4Latest',v_ga4_latest,'searchLatest',v_search_latest,
      'contractVersion',2,'coverage','UNKNOWN','providerRowLimit',null,
      'ga4From',(select min(date_id) from public.digital_ga4_daily),
      'searchFrom',(select min(date_id) from public.digital_search_daily),
      'currentGa4Rows',(select count(*) from public.digital_ga4_daily where date_id between v_from and v_to),
      'previousGa4Rows',(select count(*) from public.digital_ga4_daily where date_id between v_previous_from and v_previous_to),
      'currentSearchRows',(select count(*) from public.digital_search_daily where date_id between v_from and v_to),
      'previousSearchRows',(select count(*) from public.digital_search_daily where date_id between v_previous_from and v_previous_to),
      'sources',jsonb_build_object(
        'ga4',jsonb_build_object('contractVersion',2,'coverage','UNKNOWN','expectedDates',v_days,
          'from',(select min(date_id) from public.digital_ga4_daily where date_id between v_from and v_to),
          'to',(select max(date_id) from public.digital_ga4_daily where date_id between v_from and v_to),
          'observedDates',(select count(*) from public.digital_ga4_daily where date_id between v_from and v_to)),
        'searchConsole',jsonb_build_object('contractVersion',2,'coverage','UNKNOWN','expectedDates',v_days,
          'from',(select min(date_id) from public.digital_search_daily where date_id between v_from and v_to),
          'to',(select max(date_id) from public.digital_search_daily where date_id between v_from and v_to),
          'observedDates',(select count(*) from public.digital_search_daily where date_id between v_from and v_to)),
        'channels',jsonb_build_object('contractVersion',2,'coverage','UNKNOWN','expectedDates',v_days,
          'from',(select min(date_id) from public.digital_ga4_channel_daily where date_id between v_from and v_to),
          'to',(select max(date_id) from public.digital_ga4_channel_daily where date_id between v_from and v_to),
          'observedDates',(select count(distinct date_id) from public.digital_ga4_channel_daily where date_id between v_from and v_to)),
        'devices',jsonb_build_object('contractVersion',2,'coverage','UNKNOWN','expectedDates',v_days,
          'from',(select min(date_id) from public.digital_ga4_device_daily where date_id between v_from and v_to),
          'to',(select max(date_id) from public.digital_ga4_device_daily where date_id between v_from and v_to),
          'observedDates',(select count(distinct date_id) from public.digital_ga4_device_daily where date_id between v_from and v_to))
      ),
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
      'last7Sessions',(select sum(sessions) from public.digital_ga4_daily where date_id between v_ga4_max-6 and v_ga4_max),
      'last7Purchases',(select sum(purchases) from public.digital_ga4_daily where date_id between v_ga4_max-6 and v_ga4_max)
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

-- Make live Digital reports reflect the actual imported data window.

create or replace function public.bi_digital_ads_payload(p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_first date;
  v_latest date;
  v_from date;
  v_days integer;
  v_summary jsonb;
  v_campaigns jsonb;
  v_trend jsonb;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;

  select min(date_id),max(date_id) into v_first,v_latest from public.digital_google_ads_daily;
  if v_latest is null then
    return jsonb_build_object(
      'meta',jsonb_build_object('available',false,'contractVersion',2,'coverage','UNKNOWN'),
      'summary',jsonb_build_object(),'campaigns','[]'::jsonb,'trend','[]'::jsonb
    );
  end if;

  v_from:=greatest(v_first,v_latest-29);
  v_days:=(v_latest-v_from)+1;

  select jsonb_build_object(
    'cost',sum(cost),
    'clicks',sum(clicks),
    'impressions',sum(impressions),
    'conversions',sum(conversions),
    'conversionValue',sum(conversion_value),
    'ctr',case when sum(impressions)=0 then null else sum(clicks)::numeric/sum(impressions) end,
    'cpc',case when sum(clicks)=0 then null else sum(cost)/sum(clicks) end,
    'cpa',case when sum(conversions)=0 then null else sum(cost)/sum(conversions) end,
    'roas',case when sum(cost)=0 then null else sum(conversion_value)/sum(cost) end
  ) into v_summary
  from public.digital_google_ads_daily
  where date_id between v_from and v_latest;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.cost desc),'[]'::jsonb)
  into v_campaigns
  from (
    select
      coalesce(campaign_name,campaign_id) campaign_name,
      sum(cost)::numeric cost,
      sum(clicks)::bigint clicks,
      sum(impressions)::bigint impressions,
      sum(conversions)::numeric conversions,
      sum(conversions_value)::numeric conversion_value,
      case when sum(impressions)=0 then null else sum(clicks)::numeric/sum(impressions) end ctr,
      case when sum(clicks)=0 then null else sum(cost)/sum(clicks) end cpc,
      case when sum(conversions)=0 then null else sum(cost)/sum(conversions) end cpa,
      case when sum(cost)=0 then null else sum(conversions_value)/sum(cost) end roas
    from public.staging_google_ads_windsor
    where date between v_from and v_latest
    group by coalesce(campaign_name,campaign_id)
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date',date_id,'cost',cost,'clicks',clicks,'impressions',impressions,
    'conversions',conversions,'conversionValue',conversion_value
  ) order by date_id),'[]'::jsonb)
  into v_trend
  from public.digital_google_ads_daily
  where date_id between v_from and v_latest;

  return jsonb_build_object(
    'meta',jsonb_build_object(
      'available',true,'contractVersion',2,'coverage','UNKNOWN','providerRowLimit',null,
      'expectedDates',v_days,'observedDates',(select count(*) from public.digital_google_ads_daily where date_id between v_from and v_latest),
      'from',v_from,'to',v_latest,'days',v_days,
      'maxWindowDays',30
    ),
    'summary',v_summary,'campaigns',v_campaigns,'trend',v_trend
  );
end;
$function$;

create or replace function public.bi_digital_local_payload(p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_first date;
  v_latest date;
  v_from date;
  v_days integer;
  v_summary jsonb;
  v_locations jsonb;
  v_speed jsonb;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;

  select min(date_id),max(date_id) into v_first,v_latest from public.digital_gbp_daily;
  if v_latest is not null then
    v_from:=greatest(v_first,v_latest-29);
    v_days:=(v_latest-v_from)+1;
  end if;

  select jsonb_build_object(
    'impressions',sum(impressions),
    'clicks',sum(clicks),
    'calls',sum(call_clicks),
    'websiteClicks',sum(website_clicks),
    'directions',sum(direction_requests),
    'menuClicks',sum(menu_clicks)
  ) into v_summary
  from public.digital_gbp_daily
  where v_latest is not null and date_id between v_from and v_latest;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.impressions desc),'[]'::jsonb)
  into v_locations
  from (
    select location_id,location_title,
      sum(impressions)::bigint impressions,
      sum(clicks)::bigint clicks,
      sum(call_clicks)::bigint calls,
      sum(website_clicks)::bigint website_clicks,
      sum(direction_requests)::bigint directions,
      sum(menu_clicks)::bigint menu_clicks
    from public.digital_gbp_daily
    where v_latest is not null and date_id between v_from and v_latest
    group by location_id,location_title
  ) x;

  select jsonb_build_object(
    'captured_on',captured_on,'date_semantics','COLLECTOR_DATE','source_date',null,
    'desktop_score',desktop_score,
    'mobile_score',mobile_score,
    'desktop_lcp',desktop_lcp,
    'desktop_inp',desktop_inp,
    'desktop_cls',desktop_cls,
    'mobile_lcp',mobile_lcp,
    'mobile_inp',mobile_inp,
    'mobile_cls',mobile_cls,
    'desktop_category',
      case when desktop_lcp is null or desktop_inp is null or desktop_cls is null then 'UNKNOWN' else coalesce(desktop_category,
        case
          when desktop_lcp<=2500 and desktop_inp<=200 and desktop_cls<=0.1 then 'GOOD'
          when desktop_lcp>4000 or desktop_inp>500 or desktop_cls>0.25 then 'POOR'
          else 'NEEDS_IMPROVEMENT'
        end) end,
    'mobile_category',
      case when mobile_lcp is null or mobile_inp is null or mobile_cls is null then 'UNKNOWN' else coalesce(mobile_category,
        case
          when mobile_lcp<=2500 and mobile_inp<=200 and mobile_cls<=0.1 then 'GOOD'
          when mobile_lcp>4000 or mobile_inp>500 or mobile_cls>0.25 then 'POOR'
          else 'NEEDS_IMPROVEMENT'
        end) end
  ) into v_speed
  from public.digital_pagespeed_snapshot
  order by captured_on desc
  limit 1;

  return jsonb_build_object(
    'meta',jsonb_build_object(
      'contractVersion',2,'coverage','UNKNOWN','providerRowLimit',null,
      'expectedDates',v_days,'observedDates',(select count(distinct date_id) from public.digital_gbp_daily where date_id between v_from and v_latest),
      'rows',(select count(*) from public.digital_gbp_daily where date_id between v_from and v_latest),
      'from',v_from,'to',v_latest,'days',v_days,
      'locationCount',jsonb_array_length(coalesce(v_locations,'[]'::jsonb)),
      'maxWindowDays',30
    ),
    'summary',coalesce(v_summary,'{}'::jsonb),
    'locations',coalesce(v_locations,'[]'::jsonb),
    'pageSpeed',coalesce(v_speed,'{}'::jsonb)
  );
end;
$function$;

revoke all on function public.bi_digital_ads_payload(text) from public,authenticated;
revoke all on function public.bi_digital_local_payload(text) from public,authenticated;
grant execute on function public.bi_digital_ads_payload(text) to anon,service_role;
grant execute on function public.bi_digital_local_payload(text) to anon,service_role;
