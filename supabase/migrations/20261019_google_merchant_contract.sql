-- Google Merchant / Commerce data contracts.
-- Destination sync can be attached later without changing BI.

create table if not exists public.staging_google_merchant_performance (
  date date not null,
  product_id text not null,
  product_title text,
  impressions numeric,
  clicks numeric,
  ctr numeric,
  conversions numeric,
  imported_at timestamptz not null default now(),
  primary key (date, product_id)
);

create table if not exists public.staging_google_merchant_catalog (
  product_id text primary key,
  product_title text,
  availability text,
  price numeric,
  currency_code text,
  product_link text,
  image_link text,
  last_update_date date,
  imported_at timestamptz not null default now()
);

create table if not exists public.staging_google_merchant_status (
  snapshot_date date not null,
  country text not null default '',
  reporting_context text not null default '',
  active_count numeric,
  disapproved_count numeric,
  pending_count numeric,
  expiring_count numeric,
  imported_at timestamptz not null default now(),
  primary key (snapshot_date, country, reporting_context)
);

alter table public.staging_google_merchant_performance enable row level security;
alter table public.staging_google_merchant_catalog enable row level security;
alter table public.staging_google_merchant_status enable row level security;

create or replace function public.bi_digital_merchant_payload(p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_perf_latest date;
  v_perf_from date;
  v_perf_summary jsonb;
  v_top_products jsonb;
  v_catalog jsonb;
  v_health jsonb;
begin
  select value_hash into v_expected_hash from public.bi_runtime_config where config_key='access_password';
  v_actual_hash:=encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash<>v_expected_hash then raise exception 'unauthorized'; end if;

  select max(date) into v_perf_latest from public.staging_google_merchant_performance;
  if v_perf_latest is not null then v_perf_from:=v_perf_latest-29; end if;

  select jsonb_build_object(
    'impressions',coalesce(sum(impressions),0),
    'clicks',coalesce(sum(clicks),0),
    'conversions',coalesce(sum(conversions),0),
    'ctr',case when coalesce(sum(impressions),0)=0 then 0 else sum(clicks)/sum(impressions) end,
    'products',count(distinct product_id)
  ) into v_perf_summary
  from public.staging_google_merchant_performance
  where v_perf_latest is not null and date between v_perf_from and v_perf_latest;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.impressions desc),'[]'::jsonb)
  into v_top_products
  from (
    select product_id,
           max(product_title) product_title,
           sum(impressions)::numeric impressions,
           sum(clicks)::numeric clicks,
           sum(conversions)::numeric conversions,
           case when sum(impressions)=0 then 0 else sum(clicks)/sum(impressions) end ctr
    from public.staging_google_merchant_performance
    where v_perf_latest is not null and date between v_perf_from and v_perf_latest
    group by product_id
    order by sum(impressions) desc
    limit 50
  ) x;

  select jsonb_build_object(
    'rows',count(*),
    'inStock',count(*) filter (where lower(coalesce(availability,'')) in ('instock','in_stock','in stock')),
    'outOfStock',count(*) filter (where lower(coalesce(availability,'')) in ('outofstock','out_of_stock','out of stock')),
    'withPrice',count(*) filter (where price is not null)
  ) into v_catalog
  from public.staging_google_merchant_catalog;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.snapshot_date desc,x.reporting_context),'[]'::jsonb)
  into v_health
  from (
    select snapshot_date,country,reporting_context,
           active_count,disapproved_count,pending_count,expiring_count
    from public.staging_google_merchant_status
    order by snapshot_date desc
    limit 20
  ) x;

  return jsonb_build_object(
    'meta',jsonb_build_object(
      'status','contract-ready',
      'performanceFrom',v_perf_from,
      'performanceTo',v_perf_latest,
      'performanceRows',(select count(*) from public.staging_google_merchant_performance),
      'catalogRows',(select count(*) from public.staging_google_merchant_catalog),
      'healthRows',(select count(*) from public.staging_google_merchant_status)
    ),
    'performance',coalesce(v_perf_summary,'{}'::jsonb),
    'topProducts',coalesce(v_top_products,'[]'::jsonb),
    'catalog',coalesce(v_catalog,'{}'::jsonb),
    'health',coalesce(v_health,'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.bi_digital_merchant_payload(text) from public,authenticated;
grant execute on function public.bi_digital_merchant_payload(text) to anon,service_role;
