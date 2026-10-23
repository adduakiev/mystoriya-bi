-- PREPARED DESIGN ONLY — NOT APPLIED. Issue #12.
-- Outside supabase/migrations intentionally: no deployment/migration execution authorized.
-- Review with a real PostgreSQL instance and existing RLS/grant contracts before any use.
-- This transaction always ROLLS BACK. An approved follow-up must prepare application separately.
-- Does not recover historical NULLs already stored as default 0, prove completeness,
-- add period-unique users, discover historical eligible snapshots, or invent PSI timestamps.
-- Unchanged SECURITY DEFINER/password gate and grants; no business writes/schedulers.
-- Issue #17: selected-period Ads/GBP evidence contract; still NOT APPLIED.
-- Supabase advisor: anon-executable SECURITY DEFINER RPCs require a separate
-- security architecture follow-up; this correctness design retains compatibility.
begin;

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
    'engagementRate',sum(engaged_sessions)::numeric/nullif(sum(sessions),0),
    'addToCarts',sum(add_to_carts),
    'checkouts',sum(checkouts),
    'purchases',sum(purchases),
    'conversionRate',sum(purchases)::numeric/nullif(sum(sessions),0),
    'purchaseRevenue',sum(purchase_revenue),
    'averageOrderValue',sum(purchase_revenue)/nullif(sum(purchases),0)
  ) into v_current
  from public.digital_ga4_daily where date_id between v_from and v_to;

  select jsonb_build_object(
    'sessions',sum(sessions),
    'activeUsers',null,
    'engagedSessions',sum(engaged_sessions),
    'engagementRate',sum(engaged_sessions)::numeric/nullif(sum(sessions),0),
    'addToCarts',sum(add_to_carts),
    'checkouts',sum(checkouts),
    'purchases',sum(purchases),
    'conversionRate',sum(purchases)::numeric/nullif(sum(sessions),0),
    'purchaseRevenue',sum(purchase_revenue),
    'averageOrderValue',sum(purchase_revenue)/nullif(sum(purchases),0)
  ) into v_previous
  from public.digital_ga4_daily where date_id between v_previous_from and v_previous_to;

  select jsonb_build_object(
    'clicks',sum(clicks),
    'impressions',sum(impressions),
    'ctr',sum(clicks)::numeric/nullif(sum(impressions),0),
    'position',sum(position*impressions)/nullif(sum(impressions),0)
  ) into v_seo
  from public.digital_search_daily where date_id between v_from and v_to;

  select jsonb_build_object(
    'clicks',sum(clicks),
    'impressions',sum(impressions),
    'ctr',sum(clicks)::numeric/nullif(sum(impressions),0),
    'position',sum(position*impressions)/nullif(sum(impressions),0)
  ) into v_previous_seo
  from public.digital_search_daily where date_id between v_previous_from and v_previous_to;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date',d::date,'ga4Present',g.date_id is not null,'searchPresent',s.date_id is not null,
    'sessions',g.sessions,'purchases',g.purchases,
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
      sum(purchases)::numeric/nullif(sum(sessions),0) conversion_rate
    from public.digital_ga4_channel_daily where date_id between v_from and v_to
    group by channel
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.sessions desc),'[]'::jsonb)
  into v_devices
  from (
    select device,sum(sessions)::bigint sessions,sum(purchases)::bigint purchases,sum(purchase_revenue)::numeric purchase_revenue,
      sum(purchases)::numeric/nullif(sum(sessions),0) conversion_rate
    from public.digital_ga4_device_daily where date_id between v_from and v_to
    group by device
  ) x;

  if v_days=30 then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.sessions desc),'[]'::jsonb)
    into v_landings
    from (
      select landing_page,sessions,purchases,purchase_revenue,
        purchases::numeric/nullif(sessions,0) conversion_rate
      from public.digital_ga4_landing_snapshot
      where period_end=v_to and period_days=30
      order by sessions desc limit 30
    ) x;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.clicks desc),'[]'::jsonb)
    into v_queries
    from (
      select query,clicks,impressions,
        clicks::numeric/nullif(impressions,0) ctr,position
      from public.digital_search_query_snapshot
      where period_end=v_to and period_days=30
      order by clicks desc limit 40
    ) x;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.clicks desc),'[]'::jsonb)
    into v_pages
    from (
      select page,clicks,impressions,
        clicks::numeric/nullif(impressions,0) ctr,position
      from public.digital_search_page_snapshot
      where period_end=v_to and period_days=30
      order by clicks desc limit 30
    ) x;
  end if;

  return jsonb_build_object(
    'meta',jsonb_build_object(
      'from',v_from,'to',v_to,'previousFrom',v_previous_from,'previousTo',v_previous_to,
      'ga4Latest',v_ga4_latest,'searchLatest',v_search_latest,
      'coverage','UNKNOWN',
      'currentGa4Rows',(select count(*) from public.digital_ga4_daily where date_id between v_from and v_to),
      'previousGa4Rows',(select count(*) from public.digital_ga4_daily where date_id between v_previous_from and v_previous_to),
      'currentSearchRows',(select count(*) from public.digital_search_daily where date_id between v_from and v_to),
      'previousSearchRows',(select count(*) from public.digital_search_daily where date_id between v_previous_from and v_previous_to),
      'ga4Rows',(select count(*) from public.digital_ga4_daily),
      'searchRows',(select count(*) from public.digital_search_daily)
    ),
    'current',v_current,'previous',v_previous,'seo',v_seo,'previousSeo',v_previous_seo,
    'trend',v_trend,'channels',v_channels,'devices',v_devices,
    'landingPages',v_landings,'seoQueries',v_queries,'seoPages',v_pages
  );
end;
$function$;

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
  v_rows bigint;
  v_observed_dates bigint;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;

  select min(date_id),max(date_id) into v_first,v_latest from public.digital_google_ads_daily;
  if v_latest is null then
    return jsonb_build_object(
      'meta',jsonb_build_object('available',false,'rows',0,'observedDates',0),
      'summary',jsonb_build_object(),'campaigns','[]'::jsonb,'trend','[]'::jsonb
    );
  end if;

  v_from:=greatest(v_first,v_latest-29);
  v_days:=(v_latest-v_from)+1;

  -- Evidence and summary share the effective daily Ads window. Staging campaigns
  -- below are a separate source/grain; completeness and currency reconciliation unknown.
  select count(*),count(distinct date_id),jsonb_build_object(
    'cost',sum(cost),
    'clicks',sum(clicks),
    'impressions',sum(impressions),
    'conversions',sum(conversions),
    'conversionValue',sum(conversion_value),
    'ctr',sum(clicks)::numeric/nullif(sum(impressions),0),
    'cpc',sum(cost)/nullif(sum(clicks),0),
    'cpa',sum(cost)/nullif(sum(conversions),0),
    'roas',sum(conversion_value)/nullif(sum(cost),0)
  ) into v_rows,v_observed_dates,v_summary
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
      sum(clicks)::numeric/nullif(sum(impressions),0) ctr,
      sum(cost)/nullif(sum(clicks),0) cpc,
      sum(cost)/nullif(sum(conversions),0) cpa,
      sum(conversions_value)/nullif(sum(cost),0) roas
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
      'available',true,'from',v_from,'to',v_latest,'days',v_days,
      'rows',v_rows,'observedDates',v_observed_dates,
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
  v_rows bigint;
  v_observed_dates bigint;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;

  select min(date_id),max(date_id) into v_first,v_latest from public.digital_gbp_daily;
  if v_latest is not null then
    v_from:=greatest(v_first,v_latest-29);
    v_days:=(v_latest-v_from)+1;
  end if;

  -- Empty input yields counts of 0 and NULL sums; measured zeroes stay zero.
  select count(*),count(distinct date_id),jsonb_build_object(
    'impressions',sum(impressions),
    'clicks',sum(clicks),
    'calls',sum(call_clicks),
    'websiteClicks',sum(website_clicks),
    'directions',sum(direction_requests),
    'menuClicks',sum(menu_clicks)
  ) into v_rows,v_observed_dates,v_summary
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

  -- Independent snapshot: do not gate PageSpeed on GBP dates, rows or locations.
  select jsonb_build_object(
    'captured_on',captured_on, -- processing/storage date, NOT source measurement
    'imported_at',imported_at,
    'desktop_score',desktop_score,
    'mobile_score',mobile_score,
    'desktop_lcp',desktop_lcp,
    'desktop_inp',desktop_inp,
    'desktop_cls',desktop_cls,
    'mobile_lcp',mobile_lcp,
    'mobile_inp',mobile_inp,
    'mobile_cls',mobile_cls,
    'desktop_category',desktop_category,
    'mobile_category',mobile_category
  ) into v_speed
  from public.digital_pagespeed_snapshot
  order by captured_on desc
  limit 1;

  return jsonb_build_object(
    'meta',jsonb_build_object(
      'from',v_from,'to',v_latest,'days',coalesce(v_days,0),
      'rows',v_rows,'observedDates',v_observed_dates,
      -- Result/dimension count only, never period measurement evidence.
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

revoke all on function public.bi_digital_payload(text,date,date) from public,authenticated;
grant execute on function public.bi_digital_payload(text,date,date) to anon,service_role;

-- Intentional fail-closed design artifact. NOT a deployed migration.
rollback;
