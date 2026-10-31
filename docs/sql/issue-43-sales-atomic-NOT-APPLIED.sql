-- DESIGN / NOT APPLIED. Execute only in a disposable fixture until owner cutover approval.
-- Depends on reviewed warehouse functions/schema. Not a migration or a deployment script.
begin;
create schema bi_import_private;
revoke all on schema bi_import_private from public, anon, authenticated, service_role;
create table bi_import_private.generation (
  singleton boolean primary key default true check(singleton),
  version bigint not null default 0
);
insert into bi_import_private.generation default values;
create table bi_import_private.sales_runs (
  id uuid primary key references public.import_runs(id),
  base_version bigint not null,
  expected_rows integer not null check(expected_rows between 1 and 200000),
  raw_rows integer not null check(raw_rows >= expected_rows),
  expected_batches integer not null check(expected_batches between 1 and 200),
  revenue numeric not null, checks numeric not null, markup numeric not null,
  min_date date not null, max_date date not null check(max_date >= min_date),
  state text not null default 'staging' check(state in ('staging','committed')),
  expires_at timestamptz not null default clock_timestamp() + interval '2 hours',
  result jsonb
);
create table bi_import_private.sales_batches (
  run_id uuid not null references bi_import_private.sales_runs(id),
  batch_no integer not null check(batch_no >= 0),
  payload jsonb not null,
  primary key(run_id,batch_no)
);
alter table bi_import_private.generation enable row level security;
alter table bi_import_private.sales_runs enable row level security;
alter table bi_import_private.sales_batches enable row level security;
revoke all on all tables in schema bi_import_private from public, anon, authenticated, service_role;

create function public.begin_sales_snapshot_v2(p_manifest jsonb) returns uuid
language plpgsql security definer set search_path = pg_catalog, bi_import_private
as $$
declare v_id uuid; v_version bigint; v_rows integer; v_raw integer; v_batches integer;
  v_revenue numeric; v_checks numeric; v_markup numeric; v_min date; v_max date;
begin
  if jsonb_typeof(p_manifest) is distinct from 'object' or
     not p_manifest ?& array['rows','raw_rows','batches','revenue','checks','markup','min_date','max_date'] then
    raise exception 'INVALID_MANIFEST';
  end if;
  if exists(select from jsonb_each(p_manifest) e where
    (e.key in ('rows','raw_rows','batches','revenue','checks','markup') and jsonb_typeof(e.value) <> 'number') or
    (e.key in ('min_date','max_date') and jsonb_typeof(e.value) <> 'string')) then raise exception 'INVALID_MANIFEST'; end if;
  v_rows := (p_manifest->>'rows')::integer; v_raw := (p_manifest->>'raw_rows')::integer;
  v_batches := (p_manifest->>'batches')::integer;
  if (p_manifest->>'rows')::numeric <> v_rows or (p_manifest->>'raw_rows')::numeric <> v_raw or
     (p_manifest->>'batches')::numeric <> v_batches or v_batches <> ceil(v_rows/2000.0) then
    raise exception 'INVALID_MANIFEST_COUNTS'; end if;
  v_revenue := (p_manifest->>'revenue')::numeric; v_checks := (p_manifest->>'checks')::numeric;
  v_markup := (p_manifest->>'markup')::numeric;
  if v_revenue <> round(v_revenue,2) or v_markup <> round(v_markup,2) or
     v_checks <> trunc(v_checks) or v_checks < 0 then raise exception 'INVALID_MANIFEST_TOTALS'; end if;
  if (p_manifest->>'min_date') !~ '^\d{4}-\d{2}-\d{2}$' or
     (p_manifest->>'max_date') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_MANIFEST_DATES'; end if;
  v_min := (p_manifest->>'min_date')::date; v_max := (p_manifest->>'max_date')::date;
  if v_min < date '2000-01-01' or v_max > date '2100-12-31' then raise exception 'INVALID_MANIFEST_DATES'; end if;
  select version into v_version from bi_import_private.generation where singleton;
  insert into public.import_runs(source_name,status,details)
    values('google_sheets:Данние короткі','running','{"atomic_staging":true}') returning id into v_id;
  insert into bi_import_private.sales_runs(id,base_version,expected_rows,raw_rows,expected_batches,revenue,checks,markup,min_date,max_date)
    values(v_id,v_version,v_rows,v_raw,v_batches,v_revenue,v_checks,v_markup,v_min,v_max);
  return v_id;
end $$;

create function public.stage_sales_batch_v2(p_run_id uuid,p_batch_no integer,p_rows jsonb) returns integer
language plpgsql security definer set search_path = pg_catalog, bi_import_private
as $$
declare v_run bi_import_private.sales_runs%rowtype; v_prior jsonb; v_n integer; v_expected integer; x jsonb; k text; n numeric;
begin
  select * into v_run from bi_import_private.sales_runs where id=p_run_id for update;
  if not found or v_run.state <> 'staging' or v_run.expires_at <= clock_timestamp() then raise exception 'RUN_NOT_STAGING'; end if;
  if p_batch_no is null or p_batch_no < 0 or p_batch_no >= v_run.expected_batches or
    jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'INVALID_BATCH'; end if;
  v_n := jsonb_array_length(p_rows);
  v_expected := least(2000,v_run.expected_rows-p_batch_no*2000);
  if v_n <> v_expected or octet_length(p_rows::text) > 4194304 then raise exception 'INVALID_BATCH_SIZE'; end if;
  for x in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(x) <> 'object' then raise exception 'INVALID_ROW'; end if;
    foreach k in array array['accounting_date','location_raw','brand','ownership','channel_group','order_type'] loop
      if jsonb_typeof(x->k) is distinct from 'string' or nullif(btrim(x->>k),'') is null or length(x->>k)>256 then
        raise exception 'INVALID_DIMENSION'; end if;
    end loop;
    if (x->>'accounting_date') !~ '^\d{4}-\d{2}-\d{2}$' or
       (x->>'accounting_date')::date not between v_run.min_date and v_run.max_date then raise exception 'INVALID_DATE'; end if;
    foreach k in array array['revenue','checks','markup'] loop
      if jsonb_typeof(x->k) is distinct from 'number' then raise exception 'INVALID_METRIC'; end if;
      n := (x->>k)::numeric;
      if abs(n) >= 100000000000000 or n <> round(n,2) or
        (k='checks' and (n<0 or n<>trunc(n))) then raise exception 'INVALID_PRECISION'; end if;
    end loop;
  end loop;
  select payload into v_prior from bi_import_private.sales_batches where run_id=p_run_id and batch_no=p_batch_no;
  if found then
    if v_prior is distinct from p_rows then raise exception 'BATCH_REPLAY_CONFLICT'; end if;
    return v_n;
  end if;
  insert into bi_import_private.sales_batches values(p_run_id,p_batch_no,p_rows);
  return v_n;
end $$;

create function public.commit_sales_snapshot_v2(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, bi_import_private
as $$
declare v_run bi_import_private.sales_runs%rowtype; v_version bigint; v_payload jsonb; v_count integer;
  v_revenue numeric; v_checks numeric; v_markup numeric; v_min date; v_max date;
  v_previous public.import_runs%rowtype; v_result jsonb; v_loaded integer; v_facts integer;
begin
  -- Shared ordering: serialize promotions, then freeze this run against late batches.
  select version into v_version from bi_import_private.generation where singleton for update;
  select * into v_run from bi_import_private.sales_runs where id=p_run_id for update;
  if not found then raise exception 'UNKNOWN_RUN'; end if;
  if v_run.state='committed' then return v_run.result; end if; -- lost response retry, no mutation
  if v_run.expires_at <= clock_timestamp() then raise exception 'RUN_EXPIRED'; end if;
  if v_run.base_version <> v_version then raise exception 'STALE_GENERATION'; end if;
  if (select count(*) from bi_import_private.sales_batches where run_id=p_run_id) <> v_run.expected_batches then
    raise exception 'INCOMPLETE_BATCHES'; end if;
  select jsonb_agg(e.value order by b.batch_no,e.ordinality) into v_payload
    from bi_import_private.sales_batches b cross join lateral jsonb_array_elements(b.payload) with ordinality e
    where b.run_id=p_run_id;
  select count(*),sum(x.revenue),sum(x.checks),sum(x.markup),min(x.accounting_date),max(x.accounting_date)
    into v_count,v_revenue,v_checks,v_markup,v_min,v_max
    from jsonb_to_recordset(v_payload) x(accounting_date date,revenue numeric,checks numeric,markup numeric);
  if v_count is distinct from v_run.expected_rows or v_revenue is distinct from v_run.revenue or
    v_checks is distinct from v_run.checks or v_markup is distinct from v_run.markup or
    v_min is distinct from v_run.min_date or v_max is distinct from v_run.max_date then raise exception 'MANIFEST_MISMATCH'; end if;
  select * into v_previous from public.import_runs where source_name='google_sheets:Данние короткі' and status='success'
    order by finished_at desc nulls last,started_at desc limit 1;
  if found and (v_max < v_previous.source_cutoff_date or
    (v_previous.rows_read >=100 and v_run.raw_rows < floor(v_previous.rows_read*0.95))) then raise exception 'SOURCE_REGRESSION'; end if;
  -- Prevent mapping/lifecycle changes between canonical duplicate validation and merge.
  lock table public.map_location_source, public.location_lifecycle_registry in share mode;
  -- Coordinates even non-cooperating fact writers; legacy RPC access is revoked at cutover.
  -- Historical-key reads and the eventual upsert/delete share this transactional lock.
  lock table public.fact_sales_daily in share row exclusive mode;
  if exists(
    select from jsonb_to_recordset(v_payload) x(accounting_date date,location_raw text,brand text,ownership text,channel_group text,order_type text)
    left join public.map_location_source m on m.source_name=btrim(x.location_raw)
    group by x.accounting_date,coalesce(m.canonical_name,btrim(x.location_raw)),btrim(x.brand),btrim(x.ownership),btrim(x.channel_group),btrim(x.order_type)
    having count(*)>1
  ) then raise exception 'DUPLICATE_CANONICAL_KEY'; end if;

  -- Full historical-key identity guard: a count/totals match cannot authorize a
  -- replacement of an already-published date/location/brand/ownership/channel/type.
  -- Preserve the exact channel ID contract (group AND name), not totals alone.
  -- Lock the dimensions before fact replacement so mapping/labels cannot race.
  lock table public.dim_location, public.dim_brand, public.dim_ownership,
    public.dim_channel, public.dim_order_type in share mode;
  if exists (
    select f.date_id,l.canonical_name,b.name,o.name,c.channel_group,c.channel_name,ot.name
      from public.fact_sales_daily f
      join public.dim_location l on l.id=f.location_id
      join public.dim_brand b on b.id=f.brand_id
      join public.dim_ownership o on o.id=f.ownership_id
      join public.dim_channel c on c.id=f.channel_id
      join public.dim_order_type ot on ot.id=f.order_type_id
    except
    select x.accounting_date,coalesce(m.canonical_name,btrim(x.location_raw)),
      btrim(x.brand),btrim(x.ownership),btrim(x.channel_group),
      btrim(x.channel_group),btrim(x.order_type)
      from jsonb_to_recordset(v_payload) x(
        accounting_date date,location_raw text,brand text,ownership text,
        channel_group text,order_type text
      )
      left join public.map_location_source m on m.source_name=btrim(x.location_raw)
  ) then raise exception 'HISTORICAL_KEY_REGRESSION'; end if;
  -- One complete input preserves cross-batch normalization and dimension ordering.
  v_loaded := public.sync_sales_batch(v_payload,p_run_id);
  if v_loaded <> v_run.expected_rows then raise exception 'LOADED_COUNT_MISMATCH'; end if;
  v_result := public.finalize_sales_snapshot(p_run_id);
  select count(*),sum(revenue),sum(checks),sum(markup),min(date_id),max(date_id)
    into v_facts,v_revenue,v_checks,v_markup,v_min,v_max from public.fact_sales_daily;
  if v_facts is distinct from v_run.expected_rows or v_revenue is distinct from v_run.revenue or
    v_checks is distinct from v_run.checks or v_markup is distinct from v_run.markup or
    v_min is distinct from v_run.min_date or v_max is distinct from v_run.max_date then raise exception 'WAREHOUSE_MISMATCH'; end if;
  update public.import_runs set status='success',finished_at=clock_timestamp(),source_cutoff_date=v_max,
    rows_read=v_run.raw_rows,rows_loaded=v_facts,rows_rejected=0,details=jsonb_build_object('atomic',true,'snapshot',v_result) where id=p_run_id;
  update bi_import_private.sales_runs set state='committed',result=v_result where id=p_run_id;
  update bi_import_private.generation set version=version+1 where singleton;
  delete from bi_import_private.sales_batches where run_id=p_run_id;
  return v_result;
  -- No exception swallowing: facts, dimensions, deletion, MVs, status and generation all roll back.
end $$;

revoke all on function public.begin_sales_snapshot_v2(jsonb), public.stage_sales_batch_v2(uuid,integer,jsonb),
  public.commit_sales_snapshot_v2(uuid) from public,anon,authenticated;
grant execute on function public.begin_sales_snapshot_v2(jsonb), public.stage_sales_batch_v2(uuid,integer,jsonb),
  public.commit_sales_snapshot_v2(uuid) to service_role;
-- Mandatory cutover boundary: old caller must fail closed, never bypass staging.
revoke all on function public.sync_sales_batch(jsonb,uuid),public.finalize_sales_snapshot(uuid) from public,anon,authenticated,service_role;
rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.
