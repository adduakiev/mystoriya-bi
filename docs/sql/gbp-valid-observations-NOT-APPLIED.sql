-- GBP validation draft. NOT APPLIED. Based on live pg_get_functiondef 2026-11-17.
-- Only GBP changes. Preserve auth/security and other Google models.
-- Invalid records retained. Outside migrations; no automatic deployment.
-- Future reviewed migration requires separate owner authorization.
DO $guard$ BEGIN
  IF current_setting('bi.gbp_draft_authorized',true) IS DISTINCT FROM 'isolated-fixture' THEN
    RAISE EXCEPTION 'GBP draft is NOT APPLIED; isolated fixture authorization required';
  END IF;
END $guard$;

CREATE OR REPLACE FUNCTION public.refresh_digital_google_models()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ga4_rows integer := 0;
  v_search_rows integer := 0;
  v_ads_rows integer := 0;
  v_gbp_rows integer := 0;
  v_speed_rows integer := 0;
  v_gbp_rejected bigint := 0;
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

  -- Preserve invalid source records for diagnosis; never promote them as measurements.
  select count(*) into v_gbp_rejected from public.staging_gbp_windsor
  where not (date is not null and coalesce(location_id ~ '^locations/[0-9]+$',false) and not (coalesce(location_title,'') ~* 'these are not your real numbers|reads are paused|(free|current) plan includes|(quota|rate|account) limit exceeded|billing (error|limit)'));

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
  where (date is not null and coalesce(location_id ~ '^locations/[0-9]+$',false) and not (coalesce(location_title,'') ~* 'these are not your real numbers|reads are paused|(free|current) plan includes|(quota|rate|account) limit exceeded|billing (error|limit)'))
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
    'gbpRejectedRows',v_gbp_rejected,
    'pageSpeedRows',v_speed_rows,
    'adsLatest',v_ads_latest,
    'refreshedAt',now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.bi_digital_local_payload(p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  v_rejected_staging bigint;
  v_rejected_curated bigint;
  v_last_rejected date;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;

  -- Invalid rows remain as evidence, excluded from business dates and metrics.
  select count(*) into v_rejected_staging from public.staging_gbp_windsor
  where not (date is not null and coalesce(location_id ~ '^locations/[0-9]+$',false) and not (coalesce(location_title,'') ~* 'these are not your real numbers|reads are paused|(free|current) plan includes|(quota|rate|account) limit exceeded|billing (error|limit)'));
  select count(*) into v_rejected_curated from public.digital_gbp_daily
  where not (date_id is not null and coalesce(location_id ~ '^locations/[0-9]+$',false) and not (coalesce(location_title,'') ~* 'these are not your real numbers|reads are paused|(free|current) plan includes|(quota|rate|account) limit exceeded|billing (error|limit)'));
  select max(rejected_date) into v_last_rejected from (
    select date as rejected_date from public.staging_gbp_windsor where not (date is not null and coalesce(location_id ~ '^locations/[0-9]+$',false) and not (coalesce(location_title,'') ~* 'these are not your real numbers|reads are paused|(free|current) plan includes|(quota|rate|account) limit exceeded|billing (error|limit)'))
    union all
    select date_id from public.digital_gbp_daily where not (date_id is not null and coalesce(location_id ~ '^locations/[0-9]+$',false) and not (coalesce(location_title,'') ~* 'these are not your real numbers|reads are paused|(free|current) plan includes|(quota|rate|account) limit exceeded|billing (error|limit)'))
  ) rejected;

  select min(date_id),max(date_id) into v_first,v_latest from public.digital_gbp_daily
  where (date_id is not null and coalesce(location_id ~ '^locations/[0-9]+$',false) and not (coalesce(location_title,'') ~* 'these are not your real numbers|reads are paused|(free|current) plan includes|(quota|rate|account) limit exceeded|billing (error|limit)'));
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
  where v_latest is not null and date_id between v_from and v_latest
      and (date_id is not null and coalesce(location_id ~ '^locations/[0-9]+$',false) and not (coalesce(location_title,'') ~* 'these are not your real numbers|reads are paused|(free|current) plan includes|(quota|rate|account) limit exceeded|billing (error|limit)'));

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
      and (date_id is not null and coalesce(location_id ~ '^locations/[0-9]+$',false) and not (coalesce(location_title,'') ~* 'these are not your real numbers|reads are paused|(free|current) plan includes|(quota|rate|account) limit exceeded|billing (error|limit)'))
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
      'maxWindowDays',30,
      'gbpObservationContract','gbp-valid-observations-v1',
      'validThrough',v_latest,
      'coverage',case when v_rows>0 then 'PARTIAL' else 'UNKNOWN' end,
      -- Unresolved rejections remain visible; no provider prose or false import-date freshness.
      'status',case when v_rejected_staging+v_rejected_curated>0 then 'error' else 'ok' end,
      'rejectedStagingRows',v_rejected_staging,
      'rejectedCuratedRows',v_rejected_curated,
      'latestRejectedBusinessDate',v_last_rejected
    ),
    'summary',coalesce(v_summary,'{}'::jsonb),
    'locations',coalesce(v_locations,'[]'::jsonb),
    'pageSpeed',coalesce(v_speed,'{}'::jsonb)
  );
end;
$function$;
