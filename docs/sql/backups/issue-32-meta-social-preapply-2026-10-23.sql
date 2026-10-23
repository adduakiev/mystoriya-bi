-- PRE-APPLY ROLLBACK BACKUP - Digital Phase 2 DB gate #32 - 2026-10-23
-- Restores the exact two production Meta/Social RPC definitions and grants.
-- Contains no credentials or business-row contents.

CREATE OR REPLACE FUNCTION public.bi_digital_meta_ads_payload(p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_latest date;
  v_from date;
  v_summary jsonb;
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

  select jsonb_build_object(
    'spend',coalesce(sum(spend),0),
    'impressions',coalesce(sum(impressions),0),
    'reach',coalesce(sum(reach),0),
    'clicks',coalesce(sum(clicks),0),
    'linkClicks',coalesce(sum(link_clicks),0),
    'conversions',coalesce(sum(conversions),0),
    'purchases',coalesce(sum(purchases),0),
    'purchaseValue',coalesce(sum(purchase_value),0),
    'ctr',case when coalesce(sum(impressions),0)=0 then 0 else sum(clicks)/sum(impressions) end,
    'cpc',case when coalesce(sum(clicks),0)=0 then 0 else sum(spend)/sum(clicks) end,
    'cpm',case when coalesce(sum(impressions),0)=0 then 0 else 1000*sum(spend)/sum(impressions) end,
    'roas',case when coalesce(sum(spend),0)=0 then 0 else sum(purchase_value)/sum(spend) end
  ) into v_summary
  from public.staging_meta_ads_daily
  where v_latest is not null and date between v_from and v_latest;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.spend desc),'[]'::jsonb)
  into v_campaigns
  from (
    select
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
      case when sum(impressions)=0 then 0 else sum(clicks)/sum(impressions) end ctr,
      case when sum(clicks)=0 then 0 else sum(spend)/sum(clicks) end cpc,
      case when sum(spend)=0 then 0 else sum(purchase_value)/sum(spend) end roas
    from public.staging_meta_ads_daily
    where v_latest is not null and date between v_from and v_latest
    group by campaign_id
    order by sum(spend) desc
    limit 50
  ) x;

  return jsonb_build_object(
    'meta',jsonb_build_object(
      'status','contract-ready',
      'from',v_from,
      'to',v_latest,
      'rows',(select count(*) from public.staging_meta_ads_daily)
    ),
    'summary',coalesce(v_summary,'{}'::jsonb),
    'campaigns',coalesce(v_campaigns,'[]'::jsonb)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bi_digital_social_payload(p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_fb_latest date;
  v_fb_from date;
  v_fb_summary jsonb;
  v_fb_posts jsonb;
  v_ig_summary jsonb;
  v_ig_media jsonb;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;

  select max(date) into v_fb_latest from public.staging_facebook_organic_daily;
  if v_fb_latest is not null then v_fb_from:=v_fb_latest-29; end if;

  select jsonb_build_object(
    'from',v_fb_from,
    'to',v_fb_latest,
    'followers',coalesce((select followers from public.staging_facebook_organic_daily where date=v_fb_latest),0),
    'followersStart',coalesce((select followers from public.staging_facebook_organic_daily where date=v_fb_from),0),
    'dailyFollows',coalesce(sum(daily_follows),0),
    'dailyUnfollows',coalesce(sum(daily_unfollows),0),
    'impressions',coalesce(sum(impressions),0),
    'organicImpressions',coalesce(sum(organic_impressions),0),
    'pageViews',coalesce(sum(page_views),0),
    'rows',count(*)
  ) into v_fb_summary
  from public.staging_facebook_organic_daily
  where v_fb_latest is not null and date between v_fb_from and v_fb_latest;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.impressions desc),'[]'::jsonb)
  into v_fb_posts
  from (
    select post_id,created_at,message,impressions,reach,engagements,clicks,reactions,comments,
           case when coalesce(reach,0)=0 then 0 else coalesce(engagements,0)/reach end engagement_rate
    from public.staging_facebook_organic_posts
    where created_at::date >= coalesce(v_fb_from,current_date-29)
    order by impressions desc nulls last
    limit 30
  ) x;

  select jsonb_build_object(
    'rows',count(*),
    'latest',(select max(date) from public.staging_instagram_organic_daily),
    'followers',coalesce((select followers from public.staging_instagram_organic_daily order by date desc limit 1),0),
    'reach',coalesce(sum(reach),0),
    'impressions',coalesce(sum(impressions),0),
    'profileViews',coalesce(sum(profile_views),0),
    'websiteClicks',coalesce(sum(website_clicks),0),
    'accountsEngaged',coalesce(sum(accounts_engaged),0)
  ) into v_ig_summary
  from public.staging_instagram_organic_daily
  where date >= coalesce((select max(date)-29 from public.staging_instagram_organic_daily),current_date-29);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.reach desc),'[]'::jsonb)
  into v_ig_media
  from (
    select media_id,published_at,media_type,caption,permalink,reach,impressions,plays,likes,comments,saves,shares
    from public.staging_instagram_organic_media
    order by reach desc nulls last
    limit 30
  ) x;

  return jsonb_build_object(
    'facebook',coalesce(v_fb_summary,'{}'::jsonb),
    'facebookPosts',coalesce(v_fb_posts,'[]'::jsonb),
    'instagram',coalesce(v_ig_summary,'{}'::jsonb),
    'instagramMedia',coalesce(v_ig_media,'[]'::jsonb),
    'meta',jsonb_build_object(
      'facebookStatus',case when (select count(*) from public.staging_facebook_organic_daily)>0 then 'live' else 'waiting' end,
      'instagramStatus',case when (select count(*) from public.staging_instagram_organic_daily)>0 then 'live' else 'waiting' end,
      'facebookRows',(select count(*) from public.staging_facebook_organic_daily),
      'facebookPostRows',(select count(*) from public.staging_facebook_organic_posts),
      'instagramRows',(select count(*) from public.staging_instagram_organic_daily),
      'instagramMediaRows',(select count(*) from public.staging_instagram_organic_media)
    )
  );
end;
$function$
;

revoke all on function public.bi_digital_meta_ads_payload(text) from public,authenticated;
revoke all on function public.bi_digital_social_payload(text) from public,authenticated;
grant execute on function public.bi_digital_meta_ads_payload(text) to anon,service_role;
grant execute on function public.bi_digital_social_payload(text) to anon,service_role;
