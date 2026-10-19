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
      'meta',jsonb_build_object('available',false),
      'summary',jsonb_build_object(),'campaigns','[]'::jsonb,'trend','[]'::jsonb
    );
  end if;

  v_from:=greatest(v_first,v_latest-29);
  v_days:=(v_latest-v_from)+1;

  select jsonb_build_object(
    'cost',coalesce(sum(cost),0),
    'clicks',coalesce(sum(clicks),0),
    'impressions',coalesce(sum(impressions),0),
    'conversions',coalesce(sum(conversions),0),
    'conversionValue',coalesce(sum(conversion_value),0),
    'ctr',case when coalesce(sum(impressions),0)=0 then 0 else sum(clicks)::numeric/sum(impressions) end,
    'cpc',case when coalesce(sum(clicks),0)=0 then 0 else sum(cost)/sum(clicks) end,
    'cpa',case when coalesce(sum(conversions),0)=0 then 0 else sum(cost)/sum(conversions) end,
    'roas',case when coalesce(sum(cost),0)=0 then 0 else sum(conversion_value)/sum(cost) end
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
      case when sum(impressions)=0 then 0 else sum(clicks)::numeric/sum(impressions) end ctr,
      case when sum(clicks)=0 then 0 else sum(cost)/sum(clicks) end cpc,
      case when sum(conversions)=0 then 0 else sum(cost)/sum(conversions) end cpa,
      case when sum(cost)=0 then 0 else sum(conversions_value)/sum(cost) end roas
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
    'impressions',coalesce(sum(impressions),0),
    'clicks',coalesce(sum(clicks),0),
    'calls',coalesce(sum(call_clicks),0),
    'websiteClicks',coalesce(sum(website_clicks),0),
    'directions',coalesce(sum(direction_requests),0),
    'menuClicks',coalesce(sum(menu_clicks),0)
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
    'captured_on',captured_on,
    'desktop_score',desktop_score,
    'mobile_score',mobile_score,
    'desktop_lcp',desktop_lcp,
    'desktop_inp',desktop_inp,
    'desktop_cls',desktop_cls,
    'mobile_lcp',mobile_lcp,
    'mobile_inp',mobile_inp,
    'mobile_cls',mobile_cls,
    'desktop_category',
      coalesce(desktop_category,
        case
          when desktop_lcp<=2500 and desktop_inp<=200 and desktop_cls<=0.1 then 'GOOD'
          when desktop_lcp>4000 or desktop_inp>500 or desktop_cls>0.25 then 'POOR'
          else 'NEEDS_IMPROVEMENT'
        end),
    'mobile_category',
      coalesce(mobile_category,
        case
          when mobile_lcp<=2500 and mobile_inp<=200 and mobile_cls<=0.1 then 'GOOD'
          when mobile_lcp>4000 or mobile_inp>500 or mobile_cls>0.25 then 'POOR'
          else 'NEEDS_IMPROVEMENT'
        end)
  ) into v_speed
  from public.digital_pagespeed_snapshot
  order by captured_on desc
  limit 1;

  return jsonb_build_object(
    'meta',jsonb_build_object(
      'from',v_from,'to',v_latest,'days',coalesce(v_days,0),
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
