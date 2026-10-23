-- Issue #26 Meta Ads + Instagram correctness — NOT APPLIED.
-- REVIEW ARTIFACT ONLY. Outside automatic migration discovery.
-- No production/staging SQL execution authorized by this issue.
-- Retains the existing password gate, security settings and execution grants.
-- Existing signatures keep independent source-anchored inclusive 30-day windows;
-- these are NOT the global dashboard's selected dates or proof of completeness.
-- UTC date policy: freshness FRESH <=2 calendar days, STALE >2 days.
-- rows/observedDates count the exact rows used by each daily summary.
-- Content dates are publication dates, not Insights measurement dates; lists
-- are filtered by source window, limited to 30 and do not prove completeness.
-- Meta reach/frequency and IG reach/accountsEngaged are not additive period uniques.
-- Currency/account/attribution reconciliation and historic null recovery remain unknown.
-- Static review does not prove PostgreSQL/RLS/privilege/concurrency behavior.
-- A separately authorized DB gate must compile/verify before any application.
-- Keep the default rollback; this file is not an executable migration handoff.
begin;
set local timezone = 'UTC';

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
  v_rows bigint;
  v_observed_dates bigint;
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

  select count(*),count(distinct date),jsonb_build_object(
    'spend',sum(spend),
    'impressions',sum(impressions),
    'reach',null,
    'clicks',sum(clicks),
    'linkClicks',sum(link_clicks),
    'conversions',sum(conversions),
    'purchases',sum(purchases),
    'purchaseValue',sum(purchase_value),
    'ctr',sum(clicks)/nullif(sum(impressions),0),
    'cpc',sum(spend)/nullif(sum(clicks),0),
    'cpm',1000*sum(spend)/nullif(sum(impressions),0),
    'roas',sum(purchase_value)/nullif(sum(spend),0)
  ) into v_rows,v_observed_dates,v_summary
  from public.staging_meta_ads_daily
  where v_latest is not null and date between v_from and v_latest;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.spend desc nulls last),'[]'::jsonb)
  into v_campaigns
  from (
    select
      account_id,
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
      sum(clicks)/nullif(sum(impressions),0) ctr,
      sum(spend)/nullif(sum(clicks),0) cpc,
      sum(purchase_value)/nullif(sum(spend),0) roas
    from public.staging_meta_ads_daily
    where v_latest is not null and date between v_from and v_latest
    group by account_id,campaign_id
    order by sum(spend) desc nulls last
    limit 50
  ) x;

  return jsonb_build_object(
    'meta',jsonb_build_object(
      'contractVersion',2,
      'available',v_rows>0,
      'status',case when v_rows=0 then 'WAITING' when v_latest<current_date-2 then 'STALE' when v_observed_dates<30 then 'PARTIAL' else 'LIVE' end,
      'coverage',case when v_rows>0 and v_observed_dates<30 then 'PARTIAL' else 'UNKNOWN' end,
      'freshnessDays',2,
      'freshness',case when v_rows=0 then 'UNKNOWN' when v_latest<current_date-2 then 'STALE' else 'FRESH' end,
      'latest',v_latest,
      'sourceLatest',v_latest,
      'observedDates',v_observed_dates,
      'from',v_from,
      'to',v_latest,
      'rows',v_rows
    ),
    'summary',coalesce(v_summary,'{}'::jsonb),
    'campaigns',coalesce(v_campaigns,'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.bi_digital_meta_ads_payload(text) from public,authenticated;
grant execute on function public.bi_digital_meta_ads_payload(text) to anon,service_role;

create or replace function public.bi_digital_social_payload(p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_fb_latest date;
  v_fb_from date;
  v_fb_summary jsonb;
  v_ig_latest date;
  v_ig_from date;
  v_fb_posts jsonb;
  v_ig_summary jsonb;
  v_ig_media jsonb;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;

  select max(date) into v_fb_latest from public.staging_facebook_organic_daily;
  if v_fb_latest is not null then v_fb_from:=v_fb_latest-29; end if;

  select max(date) into v_ig_latest from public.staging_instagram_organic_daily;
  if v_ig_latest is not null then v_ig_from:=v_ig_latest-29; end if;

  select jsonb_build_object(
    'from',v_fb_from,
    'to',v_fb_latest,
    'latest',v_fb_latest,
    'sourceLatest',v_fb_latest,
    'available',count(*)>0,
    'coverage',case when count(*)>0 and count(distinct date)<30 then 'PARTIAL' else 'UNKNOWN' end,
    'freshnessDays',2,
    'freshness',case when count(*)=0 then 'UNKNOWN' when v_fb_latest<current_date-2 then 'STALE' else 'FRESH' end,
    'status',case when count(*)=0 then 'WAITING' when v_fb_latest<current_date-2 then 'STALE' when count(distinct date)<30 then 'PARTIAL' else 'LIVE' end,
    'followers',(select followers from public.staging_facebook_organic_daily where date=v_fb_latest),
    'followersStart',(select followers from public.staging_facebook_organic_daily where date=v_fb_from),
    'dailyFollows',sum(daily_follows),
    'dailyUnfollows',sum(daily_unfollows),
    'impressions',sum(impressions),
    'organicImpressions',sum(organic_impressions),
    'pageViews',sum(page_views),
    'rows',count(*),
    'observedDates',count(distinct date)
  ) into v_fb_summary
  from public.staging_facebook_organic_daily
  where v_fb_latest is not null and date between v_fb_from and v_fb_latest;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.impressions desc nulls last),'[]'::jsonb)
  into v_fb_posts
  from (
    select post_id,created_at,message,impressions,reach,engagements,clicks,reactions,comments,
           engagements/nullif(reach,0) engagement_rate
    from public.staging_facebook_organic_posts
    where (created_at at time zone 'UTC')::date between v_fb_from and v_fb_latest
    order by impressions desc nulls last
    limit 30
  ) x;

  select jsonb_build_object(
    'rows',count(*),
    'observedDates',count(distinct date),
    'latest',v_ig_latest,
    'from',v_ig_from,
    'to',v_ig_latest,
    'sourceLatest',v_ig_latest,
    'available',count(*)>0,
    'coverage',case when count(*)>0 and count(distinct date)<30 then 'PARTIAL' else 'UNKNOWN' end,
    'freshnessDays',2,
    'freshness',case when count(*)=0 then 'UNKNOWN' when v_ig_latest<current_date-2 then 'STALE' else 'FRESH' end,
    'status',case when count(*)=0 then 'WAITING' when v_ig_latest<current_date-2 then 'STALE' when count(distinct date)<30 then 'PARTIAL' else 'LIVE' end,
    'followers',(select followers from public.staging_instagram_organic_daily where date=v_ig_latest),
    'reach',null,
    'impressions',sum(impressions),
    'profileViews',sum(profile_views),
    'websiteClicks',sum(website_clicks),
    'accountsEngaged',null
  ) into v_ig_summary
  from public.staging_instagram_organic_daily
  where v_ig_latest is not null and date between v_ig_from and v_ig_latest;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.reach desc nulls last),'[]'::jsonb)
  into v_ig_media
  from (
    select media_id,published_at,media_type,caption,permalink,reach,impressions,plays,likes,comments,saves,shares
    from public.staging_instagram_organic_media
    where (published_at at time zone 'UTC')::date between v_ig_from and v_ig_latest
    order by reach desc nulls last
    limit 30
  ) x;

  return jsonb_build_object(
    'facebook',coalesce(v_fb_summary,'{}'::jsonb),
    'facebookPosts',coalesce(v_fb_posts,'[]'::jsonb),
    'instagram',coalesce(v_ig_summary,'{}'::jsonb),
    'instagramMedia',coalesce(v_ig_media,'[]'::jsonb),
    'meta',jsonb_build_object(
      'contractVersion',2,
      'facebookStatus',v_fb_summary->>'status',
      'instagramStatus',v_ig_summary->>'status',
      'facebookRows',(select count(*) from public.staging_facebook_organic_daily),
      'facebookPostRows',(select count(*) from public.staging_facebook_organic_posts),
      'instagramRows',(select count(*) from public.staging_instagram_organic_daily),
      'instagramMediaRows',(select count(*) from public.staging_instagram_organic_media)
    )
  );
end;
$function$;

revoke all on function public.bi_digital_social_payload(text) from public,authenticated;
grant execute on function public.bi_digital_social_payload(text) to anon,service_role;

rollback;
