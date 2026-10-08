-- Live warehouse additions for М'ЯСТОРІЯ BI.
-- Runtime secret HASH values are intentionally NOT versioned here.
-- Required config keys in public.bi_runtime_config:
--   access_password
--   sync_key

create extension if not exists pgcrypto;

create table if not exists public.bi_runtime_config (
  config_key text primary key,
  value_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.bi_runtime_config enable row level security;
revoke all on table public.bi_runtime_config from public, anon, authenticated;

alter table public.fact_sales_daily
add column if not exists import_run_id uuid references public.import_runs(id);

create index if not exists idx_fact_sales_daily_import_run
on public.fact_sales_daily(import_run_id);

create materialized view if not exists public.agg_sales_monthly as
select
  d.month_start,
  f.location_id,
  f.brand_id,
  f.ownership_id,
  f.channel_id,
  f.order_type_id,
  sum(f.revenue)::numeric(18,2) as revenue,
  sum(f.checks)::numeric(18,2) as checks,
  sum(f.markup)::numeric(18,2) as markup
from public.fact_sales_daily f
join public.dim_date d on d.date_id = f.date_id
group by
  d.month_start,
  f.location_id,
  f.brand_id,
  f.ownership_id,
  f.channel_id,
  f.order_type_id;

create unique index if not exists ux_agg_sales_monthly_grain
on public.agg_sales_monthly(
  month_start,
  location_id,
  brand_id,
  ownership_id,
  channel_id,
  order_type_id
);

create index if not exists ix_agg_sales_monthly_month
on public.agg_sales_monthly(month_start);

create materialized view if not exists public.agg_sales_weekly as
select
  d.week_start,
  f.location_id,
  f.brand_id,
  f.ownership_id,
  f.channel_id,
  f.order_type_id,
  sum(f.revenue)::numeric(18,2) as revenue,
  sum(f.checks)::numeric(18,2) as checks,
  sum(f.markup)::numeric(18,2) as markup
from public.fact_sales_daily f
join public.dim_date d on d.date_id = f.date_id
group by
  d.week_start,
  f.location_id,
  f.brand_id,
  f.ownership_id,
  f.channel_id,
  f.order_type_id;

create unique index if not exists ux_agg_sales_weekly_grain
on public.agg_sales_weekly(
  week_start,
  location_id,
  brand_id,
  ownership_id,
  channel_id,
  order_type_id
);

create index if not exists ix_agg_sales_weekly_week
on public.agg_sales_weekly(week_start);

create or replace view public.bi_sales_flat
with (security_invoker = true)
as
select
  f.date_id as date,
  l.canonical_name as location,
  b.name as brand,
  o.name as ownership,
  c.channel_group,
  ot.name as order_type,
  f.revenue,
  f.checks,
  f.markup
from public.fact_sales_daily f
join public.dim_location l on l.id = f.location_id
join public.dim_brand b on b.id = f.brand_id
join public.dim_ownership o on o.id = f.ownership_id
join public.dim_channel c on c.id = f.channel_id
join public.dim_order_type ot on ot.id = f.order_type_id;

create or replace function public.refresh_bi_aggregates()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.agg_sales_monthly;
  refresh materialized view public.agg_sales_weekly;
end;
$$;

revoke all on function public.refresh_bi_aggregates() from public, anon, authenticated;
grant execute on function public.refresh_bi_aggregates() to service_role;

create or replace function public.sync_sales_batch(
  p_rows jsonb,
  p_import_run_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer := 0;
begin
  create temporary table if not exists _sync_sales_rows (
    accounting_date date not null,
    location_raw text not null,
    brand text not null,
    ownership text not null,
    channel_group text not null,
    order_type text not null,
    revenue numeric(16,2) not null,
    checks numeric(16,2) not null,
    markup numeric(16,2) not null
  ) on commit drop;

  truncate table _sync_sales_rows;

  insert into _sync_sales_rows (
    accounting_date,
    location_raw,
    brand,
    ownership,
    channel_group,
    order_type,
    revenue,
    checks,
    markup
  )
  select
    x.accounting_date,
    btrim(x.location_raw),
    btrim(x.brand),
    btrim(x.ownership),
    btrim(x.channel_group),
    btrim(x.order_type),
    coalesce(x.revenue, 0),
    coalesce(x.checks, 0),
    coalesce(x.markup, 0)
  from jsonb_to_recordset(p_rows) as x(
    accounting_date date,
    location_raw text,
    brand text,
    ownership text,
    channel_group text,
    order_type text,
    revenue numeric,
    checks numeric,
    markup numeric
  )
  where x.accounting_date is not null
    and nullif(btrim(x.location_raw), '') is not null
    and nullif(btrim(x.brand), '') is not null
    and nullif(btrim(x.ownership), '') is not null
    and nullif(btrim(x.channel_group), '') is not null
    and nullif(btrim(x.order_type), '') is not null;

  get diagnostics v_count = row_count;

  insert into public.dim_date (
    date_id, year, quarter, month, month_name, iso_week,
    week_start, month_start, day_of_week, is_weekend
  )
  select distinct
    accounting_date,
    extract(year from accounting_date)::int,
    extract(quarter from accounting_date)::int,
    extract(month from accounting_date)::int,
    to_char(accounting_date, 'YYYY-MM'),
    extract(week from accounting_date)::int,
    date_trunc('week', accounting_date)::date,
    date_trunc('month', accounting_date)::date,
    extract(isodow from accounting_date)::int,
    extract(isodow from accounting_date)::int in (6,7)
  from _sync_sales_rows
  on conflict (date_id) do nothing;

  insert into public.dim_brand(name)
  select distinct brand from _sync_sales_rows
  on conflict (name) do nothing;

  insert into public.dim_ownership(name)
  select distinct ownership from _sync_sales_rows
  on conflict (name) do nothing;

  insert into public.dim_order_type(name)
  select distinct order_type from _sync_sales_rows
  on conflict (name) do nothing;

  insert into public.dim_channel(channel_group, channel_name, is_owned, is_aggregator)
  select distinct
    channel_group,
    channel_group,
    channel_group in ('Заклад', 'Доставка'),
    channel_group = 'Агрегатор'
  from _sync_sales_rows
  on conflict (channel_group, channel_name) do update
  set is_owned = excluded.is_owned,
      is_aggregator = excluded.is_aggregator;

  with normalized_raw as (
    select
      r.accounting_date,
      coalesce(m.canonical_name, r.location_raw) as canonical_name,
      r.brand,
      r.ownership
    from _sync_sales_rows r
    left join public.map_location_source m on m.source_name = r.location_raw
  ),
  normalized as (
    select distinct on (canonical_name)
      canonical_name,
      brand,
      ownership
    from normalized_raw
    order by canonical_name, accounting_date desc
  )
  insert into public.dim_location(canonical_name, brand_id, ownership_id, is_active)
  select
    n.canonical_name,
    b.id,
    o.id,
    coalesce(not l.lfl_exclude, true)
  from normalized n
  join public.dim_brand b on b.name = n.brand
  join public.dim_ownership o on o.name = n.ownership
  left join public.location_lifecycle_registry l on l.canonical_name = n.canonical_name
  on conflict (canonical_name) do update
  set brand_id = excluded.brand_id,
      ownership_id = excluded.ownership_id,
      is_active = excluded.is_active,
      updated_at = now();

  with normalized_raw as (
    select
      r.accounting_date,
      coalesce(m.canonical_name, r.location_raw) as canonical_name,
      r.brand,
      r.ownership,
      r.channel_group,
      r.order_type,
      r.revenue,
      r.checks,
      r.markup
    from _sync_sales_rows r
    left join public.map_location_source m on m.source_name = r.location_raw
  ),
  normalized as (
    select
      accounting_date,
      canonical_name,
      brand,
      ownership,
      channel_group,
      order_type,
      sum(revenue)::numeric(16,2) as revenue,
      sum(checks)::numeric(16,2) as checks,
      sum(markup)::numeric(16,2) as markup
    from normalized_raw
    group by
      accounting_date,
      canonical_name,
      brand,
      ownership,
      channel_group,
      order_type
  )
  insert into public.fact_sales_daily(
    date_id,
    location_id,
    brand_id,
    ownership_id,
    channel_id,
    order_type_id,
    revenue,
    checks,
    markup,
    source_row_hash,
    imported_at,
    import_run_id
  )
  select
    n.accounting_date,
    l.id,
    b.id,
    o.id,
    c.id,
    ot.id,
    n.revenue,
    n.checks,
    n.markup,
    encode(
      digest(
        concat_ws('|',
          n.accounting_date::text,
          n.canonical_name,
          n.brand,
          n.ownership,
          n.channel_group,
          n.order_type,
          n.revenue::text,
          n.checks::text,
          n.markup::text
        ),
        'sha256'
      ),
      'hex'
    ),
    now(),
    p_import_run_id
  from normalized n
  join public.dim_location l on l.canonical_name = n.canonical_name
  join public.dim_brand b on b.name = n.brand
  join public.dim_ownership o on o.name = n.ownership
  join public.dim_channel c
    on c.channel_group = n.channel_group
   and c.channel_name = n.channel_group
  join public.dim_order_type ot on ot.name = n.order_type
  on conflict (
    date_id,
    location_id,
    brand_id,
    ownership_id,
    channel_id,
    order_type_id
  ) do update
  set revenue = excluded.revenue,
      checks = excluded.checks,
      markup = excluded.markup,
      source_row_hash = excluded.source_row_hash,
      imported_at = now(),
      import_run_id = excluded.import_run_id;

  return v_count;
end;
$$;

revoke all on function public.sync_sales_batch(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.sync_sales_batch(jsonb, uuid) to service_role;

create or replace function public.finalize_sales_snapshot(p_import_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
  v_rows bigint := 0;
  v_revenue numeric := 0;
  v_checks numeric := 0;
  v_markup numeric := 0;
  v_min_date date;
  v_max_date date;
begin
  delete from public.fact_sales_daily
  where import_run_id is distinct from p_import_run_id;

  get diagnostics v_deleted = row_count;

  perform public.refresh_bi_aggregates();

  select
    count(*),
    coalesce(sum(revenue), 0),
    coalesce(sum(checks), 0),
    coalesce(sum(markup), 0),
    min(date_id),
    max(date_id)
  into
    v_rows,
    v_revenue,
    v_checks,
    v_markup,
    v_min_date,
    v_max_date
  from public.fact_sales_daily;

  return jsonb_build_object(
    'deleted_stale_rows', v_deleted,
    'warehouse_rows', v_rows,
    'revenue', round(v_revenue, 2),
    'checks', round(v_checks, 2),
    'markup', round(v_markup, 2),
    'min_date', v_min_date,
    'max_date', v_max_date
  );
end;
$$;

revoke all on function public.finalize_sales_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.finalize_sales_snapshot(uuid) to service_role;

create or replace function public.bi_sales_snapshot(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_payload jsonb;
begin
  select value_hash into v_expected_hash
  from public.bi_runtime_config
  where config_key = 'access_password';

  v_actual_hash := encode(extensions.digest(coalesce(p_password, ''), 'sha256'), 'hex');

  if v_expected_hash is null or v_actual_hash <> v_expected_hash then
    raise exception 'unauthorized';
  end if;

  select jsonb_build_object(
    'source', 'supabase',
    'meta', jsonb_build_object(
      'cutoffDate', (
        select max(source_cutoff_date)
        from public.import_runs
        where status = 'success'
      ),
      'lastSuccessfulSync', (
        select max(finished_at)
        from public.import_runs
        where status = 'success'
      ),
      'warehouseRows', (select count(*) from public.fact_sales_daily),
      'monthlyAggregateRows', (select count(*) from public.agg_sales_monthly),
      'weeklyAggregateRows', (select count(*) from public.agg_sales_weekly)
    ),
    'rows',
    coalesce(
      jsonb_agg(
        jsonb_build_array(
          f.date_id::text,
          l.canonical_name,
          b.name,
          o.name,
          c.channel_group,
          ot.name,
          f.revenue,
          f.checks,
          f.markup
        )
        order by f.date_id, l.canonical_name, c.channel_group, ot.name
      ),
      '[]'::jsonb
    )
  )
  into v_payload
  from public.fact_sales_daily f
  join public.dim_location l on l.id = f.location_id
  join public.dim_brand b on b.id = f.brand_id
  join public.dim_ownership o on o.id = f.ownership_id
  join public.dim_channel c on c.id = f.channel_id
  join public.dim_order_type ot on ot.id = f.order_type_id;

  return v_payload;
end;
$$;

revoke all on function public.bi_sales_snapshot(text) from public, authenticated;
grant execute on function public.bi_sales_snapshot(text) to anon;

create or replace function public.bi_sync_status(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_expected_hash text;
  v_actual_hash text;
begin
  select value_hash into v_expected_hash
  from public.bi_runtime_config
  where config_key = 'access_password';

  v_actual_hash := encode(extensions.digest(coalesce(p_password, ''), 'sha256'), 'hex');

  if v_expected_hash is null or v_actual_hash <> v_expected_hash then
    raise exception 'unauthorized';
  end if;

  return jsonb_build_object(
    'source', 'supabase',
    'cutoffDate', (
      select max(source_cutoff_date)
      from public.import_runs
      where status = 'success'
    ),
    'lastSuccessfulSync', (
      select max(finished_at)
      from public.import_runs
      where status = 'success'
    ),
    'warehouseRows', (select count(*) from public.fact_sales_daily),
    'monthlyAggregateRows', (select count(*) from public.agg_sales_monthly),
    'weeklyAggregateRows', (select count(*) from public.agg_sales_weekly),
    'status', 'success'
  );
end;
$$;

revoke all on function public.bi_sync_status(text) from public, authenticated;
grant execute on function public.bi_sync_status(text) to anon;

revoke all on table public.agg_sales_monthly from public, anon, authenticated;
revoke all on table public.agg_sales_weekly from public, anon, authenticated;
grant select on table public.agg_sales_monthly to service_role;
grant select on table public.agg_sales_weekly to service_role;
