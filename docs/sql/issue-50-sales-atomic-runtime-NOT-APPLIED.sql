-- RELEASE CANDIDATE / NOT APPLIED. Requires verified backup/restore and writer exclusion.
-- Install transactionally; remains DISABLED until the release controller enables the policy row.
-- Existing source sync key/authentication is unchanged; no credentials in this file.
begin;
set local lock_timeout='3s';
set local statement_timeout='55s';
-- Drain already-entered legacy writes before revoking their entrypoints. The
-- order follows the installed importer; a busy writer aborts this installation.
lock table public.dim_date,public.dim_brand,public.dim_ownership,
  public.dim_order_type,public.dim_channel,public.dim_location in share mode;
lock table public.fact_sales_daily in share row exclusive mode;
create schema bi_sales_import_v3;
revoke all on schema bi_sales_import_v3 from public, anon, authenticated, service_role;
create table bi_sales_import_v3.generation (
  singleton boolean primary key default true check(singleton),
  version bigint not null default 0,
  enabled boolean not null default false,
  trigger_command_hash text
);
insert into bi_sales_import_v3.generation default values;
create table bi_sales_import_v3.sales_runs (
  id uuid primary key references public.import_runs(id),
  base_version bigint not null,
  manifest jsonb not null,
  source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
  baseline_hash text not null,
  mapping_hash text not null,
  expected_rows integer not null check(expected_rows between 1 and 200000),
  raw_rows integer not null check(raw_rows >= expected_rows),
  expected_batches integer not null check(expected_batches between 1 and 200),
  revenue numeric not null, checks numeric not null, markup numeric not null,
  min_date date not null, max_date date not null check(max_date >= min_date),
  state text not null default 'staging' check(state in ('staging','committed','failed')),
  expires_at timestamptz not null default clock_timestamp() + interval '2 hours',
  result jsonb
);
create table bi_sales_import_v3.sales_batches (
  run_id uuid not null references bi_sales_import_v3.sales_runs(id),
  batch_no integer not null check(batch_no >= 0),
  payload jsonb not null,
  primary key(run_id,batch_no)
);
create table bi_sales_import_v3.requests (
  request_id bigint primary key,
  requested_at timestamptz not null default clock_timestamp()
);
alter table bi_sales_import_v3.generation enable row level security;
alter table bi_sales_import_v3.sales_runs enable row level security;
alter table bi_sales_import_v3.sales_batches enable row level security;
alter table bi_sales_import_v3.requests enable row level security;
revoke all on all tables in schema bi_sales_import_v3 from public, anon, authenticated, service_role;

-- Private compare-and-swap fingerprints cover actual facts and mapping, including
-- the previous run ids. They are concurrency checks, not assertions about source authenticity.
create function bi_sales_import_v3.fact_hash() returns text language sql stable
set search_path=pg_catalog,public as $$
  select md5(coalesce(string_agg(md5(to_jsonb(f)::text),'' order by id),'')) from public.fact_sales_daily f
$$;
create function bi_sales_import_v3.mapping_hash() returns text language sql stable
set search_path=pg_catalog,public as $$
  select md5(coalesce(string_agg(md5(to_jsonb(m)::text),'' order by source_name),'')) from public.map_location_source m
$$;
create function public.sales_snapshot_context_v3() returns jsonb language plpgsql security definer
set search_path=pg_catalog,bi_sales_import_v3 as $$
declare v_enabled boolean; v_raw integer; v_result jsonb;
begin
  select enabled into v_enabled from bi_sales_import_v3.generation where singleton;
  if not v_enabled then raise exception 'SALES_IMPORT_SAFETY_GATE'; end if;
  select rows_read into v_raw from public.import_runs where source_name='google_sheets:Данние короткі'
    and status='success' and rows_read>0 order by finished_at desc nulls last,started_at desc limit 1;
  if v_raw is null or not exists(select from public.fact_sales_daily) then raise exception 'MISSING_BASELINE'; end if;
  select jsonb_build_object('enabled',true,'raw_rows',v_raw,'baseline_hash',bi_sales_import_v3.fact_hash(),
    'mapping_hash',bi_sales_import_v3.mapping_hash(),'min_date',min(date_id),'max_date',max(date_id),
    'mapping',(select coalesce(jsonb_agg(jsonb_build_object('source_name',source_name,'canonical_name',canonical_name) order by source_name),'[]') from public.map_location_source),
    'channels',(select jsonb_agg(channel_group order by channel_group) from
       (select distinct c.channel_group from public.dim_channel c join public.fact_sales_daily f on f.channel_id=c.id) c))
    into v_result from public.fact_sales_daily;
  return v_result;
end $$;

create function public.begin_sales_snapshot_v3(p_manifest jsonb) returns uuid
language plpgsql security definer set search_path = pg_catalog, bi_sales_import_v3
as $$
declare v_id uuid; v_version bigint; v_rows integer; v_raw integer; v_batches integer;
  v_revenue numeric; v_checks numeric; v_markup numeric; v_min date; v_max date; v_context jsonb;
begin
  v_context := public.sales_snapshot_context_v3();
  if p_manifest->>'contract' is distinct from 'gviz-numeric-canonical-js-number-v1' or
    (p_manifest->>'source_sha256') !~ '^[a-f0-9]{64}$' or p_manifest->>'source_sha256' is null or
    p_manifest->>'baseline_hash' is distinct from v_context->>'baseline_hash' or
    p_manifest->>'mapping_hash' is distinct from v_context->>'mapping_hash' then raise exception 'SOURCE_BINDING'; end if;
  if jsonb_typeof(p_manifest) is distinct from 'object' or
     not p_manifest ?& array['rows','raw_rows','raw_subcent_cells','batches','revenue','checks','markup','min_date','max_date'] then
    raise exception 'INVALID_MANIFEST';
  end if;
  if exists(select from jsonb_each(p_manifest) e where
    (e.key in ('rows','raw_rows','raw_subcent_cells','batches','revenue','checks','markup') and jsonb_typeof(e.value) <> 'number') or
    (e.key in ('min_date','max_date') and jsonb_typeof(e.value) <> 'string')) then raise exception 'INVALID_MANIFEST'; end if;
  v_rows := (p_manifest->>'rows')::integer; v_raw := (p_manifest->>'raw_rows')::integer;
  v_batches := (p_manifest->>'batches')::integer;
  if (p_manifest->>'raw_subcent_cells')::numeric <> trunc((p_manifest->>'raw_subcent_cells')::numeric) or
    (p_manifest->>'raw_subcent_cells')::numeric not between 0 and v_raw*2 then raise exception 'INVALID_SOURCE_PRECISION_COUNT'; end if;
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
  if v_raw < (v_context->>'raw_rows')::integer or v_min > (v_context->>'min_date')::date or
     v_max < (v_context->>'max_date')::date or v_max >= (now() at time zone 'Europe/Kyiv')::date then raise exception 'SOURCE_REGRESSION'; end if;
  select version into v_version from bi_sales_import_v3.generation where singleton for update;
  -- A killed Edge request cannot publish later after its lease/generation ends.
  -- Reclaim only private payloads and report those attempts as unpublished.
  with expired as (
    update bi_sales_import_v3.sales_runs set state='failed'
    where state='staging' and (expires_at<=clock_timestamp() or base_version<>v_version)
    returning id,raw_rows,source_sha256
  ) update public.import_runs i set status='failed',finished_at=clock_timestamp(),
    rows_read=e.raw_rows,rows_loaded=0,rows_rejected=0,
    details=jsonb_build_object('protocol','sales-v3','atomic',true,'published',false,'error','RUN_EXPIRED','source_sha256',e.source_sha256)
    from expired e where i.id=e.id;
  delete from bi_sales_import_v3.sales_batches b using bi_sales_import_v3.sales_runs r where b.run_id=r.id and r.state='failed';
  select id into v_id from bi_sales_import_v3.sales_runs where base_version=v_version
    and source_sha256=p_manifest->>'source_sha256' and manifest=p_manifest and state='staging' and expires_at>clock_timestamp();
  if found then return v_id; end if;
  insert into public.import_runs(source_name,status,details)
    values('google_sheets:Данние короткі','running',jsonb_build_object('atomic_staging',true,'protocol','sales-v3','source_sha256',p_manifest->>'source_sha256')) returning id into v_id;
  insert into bi_sales_import_v3.sales_runs(id,base_version,manifest,source_sha256,baseline_hash,mapping_hash,expected_rows,raw_rows,expected_batches,revenue,checks,markup,min_date,max_date)
    values(v_id,v_version,p_manifest,p_manifest->>'source_sha256',p_manifest->>'baseline_hash',p_manifest->>'mapping_hash',v_rows,v_raw,v_batches,v_revenue,v_checks,v_markup,v_min,v_max);
  return v_id;
end $$;

create function public.stage_sales_batch_v3(p_run_id uuid,p_batch_no integer,p_rows jsonb) returns integer
language plpgsql security definer set search_path = pg_catalog, bi_sales_import_v3
as $$
declare v_run bi_sales_import_v3.sales_runs%rowtype; v_prior jsonb; v_n integer; v_expected integer; x jsonb; k text; n numeric;
begin
  select * into v_run from bi_sales_import_v3.sales_runs where id=p_run_id for update;
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
  select payload into v_prior from bi_sales_import_v3.sales_batches where run_id=p_run_id and batch_no=p_batch_no;
  if found then
    if v_prior is distinct from p_rows then raise exception 'BATCH_REPLAY_CONFLICT'; end if;
    return v_n;
  end if;
  insert into bi_sales_import_v3.sales_batches values(p_run_id,p_batch_no,p_rows);
  return v_n;
end $$;

create function public.commit_sales_snapshot_v3(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, bi_sales_import_v3
-- PostgREST hoists this function setting before executing the RPC statement.
-- It is scoped to this operation; it does not change the API role defaults.
set statement_timeout = '55s'
as $$
declare v_run bi_sales_import_v3.sales_runs%rowtype; v_version bigint; v_payload jsonb; v_count integer;
  v_revenue numeric; v_checks numeric; v_markup numeric; v_min date; v_max date;
  v_previous public.import_runs%rowtype; v_result jsonb; v_loaded integer; v_facts integer; v_deleted integer; v_enabled boolean;
begin
  -- Shared ordering: serialize promotions, then freeze this run against late batches.
  select version,enabled into v_version,v_enabled from bi_sales_import_v3.generation where singleton for update;
  if not v_enabled then raise exception 'SALES_IMPORT_SAFETY_GATE'; end if;
  select * into v_run from bi_sales_import_v3.sales_runs where id=p_run_id for update;
  if not found then raise exception 'UNKNOWN_RUN'; end if;
  if v_run.state='committed' then return v_run.result; end if; -- lost response retry, no mutation
  if v_run.state<>'staging' then raise exception 'RUN_NOT_STAGING'; end if;
  if v_run.expires_at <= clock_timestamp() then raise exception 'RUN_EXPIRED'; end if;
  if v_run.base_version <> v_version then raise exception 'STALE_GENERATION'; end if;
  if (select count(*) from bi_sales_import_v3.sales_batches where run_id=p_run_id) <> v_run.expected_batches then
    raise exception 'INCOMPLETE_BATCHES'; end if;
  select jsonb_agg(e.value order by b.batch_no,e.ordinality) into v_payload
    from bi_sales_import_v3.sales_batches b cross join lateral jsonb_array_elements(b.payload) with ordinality e
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
  -- Freeze all dimension names before the fact lock; match the legacy writer's
  -- dimension-before-fact acquisition order to avoid an avoidable deadlock.
  lock table public.dim_date, public.dim_brand, public.dim_ownership,
    public.dim_order_type, public.dim_channel, public.dim_location in share mode;
  -- Coordinates even non-cooperating fact writers; legacy RPC access is revoked at cutover.
  -- Historical-key reads and the eventual upsert/delete share this transactional lock.
  lock table public.fact_sales_daily in share row exclusive mode;
  if bi_sales_import_v3.fact_hash() is distinct from v_run.baseline_hash or
     bi_sales_import_v3.mapping_hash() is distinct from v_run.mapping_hash then raise exception 'BASELINE_CHANGED'; end if;
  if exists(
    select from jsonb_to_recordset(v_payload) x(accounting_date date,location_raw text,brand text,ownership text,channel_group text,order_type text)
    left join public.map_location_source m on m.source_name=btrim(x.location_raw)
    group by x.accounting_date,coalesce(m.canonical_name,btrim(x.location_raw)),btrim(x.brand),btrim(x.ownership),btrim(x.channel_group),btrim(x.order_type)
    having count(*)>1
  ) then raise exception 'DUPLICATE_CANONICAL_KEY'; end if;

  -- A source correction may legitimately replace a channel key (incident #50).
  -- Preserve complete date coverage and raw row count, not the erroneous old key.
  if exists(select distinct date_id from public.fact_sales_daily except
    select x.accounting_date from jsonb_to_recordset(v_payload) x(accounting_date date)) then
    raise exception 'HISTORICAL_DATE_REGRESSION'; end if;
  -- Compare the channel sets once. A correlated probe per canonical source row
  -- repeatedly scans the real fact table and can exhaust the publish timeout.
  if exists(
    select x.channel_group from jsonb_to_recordset(v_payload) x(channel_group text)
    except
    select c.channel_group from public.dim_channel c join public.fact_sales_daily f on f.channel_id=c.id
      where c.channel_name=c.channel_group
  ) then raise exception 'UNKNOWN_CHANNEL'; end if;
  -- One complete input preserves cross-batch normalization and dimension ordering.
  v_loaded := public.sync_sales_batch(v_payload,p_run_id);
  if v_loaded <> v_run.expected_rows then raise exception 'LOADED_COUNT_MISMATCH'; end if;
  delete from public.fact_sales_daily where import_run_id is distinct from p_run_id;
  get diagnostics v_deleted = row_count;
  -- Every live write and every materialization shares this one PostgreSQL transaction.
  refresh materialized view public.bi_sales_flat_mv;
  refresh materialized view public.agg_sales_monthly;
  refresh materialized view public.agg_sales_weekly;
  select count(*),sum(revenue),sum(checks),sum(markup),min(date_id),max(date_id)
    into v_facts,v_revenue,v_checks,v_markup,v_min,v_max from public.fact_sales_daily;
  if v_facts is distinct from v_run.expected_rows or v_revenue is distinct from v_run.revenue or
    v_checks is distinct from v_run.checks or v_markup is distinct from v_run.markup or
    v_min is distinct from v_run.min_date or v_max is distinct from v_run.max_date then raise exception 'WAREHOUSE_MISMATCH'; end if;
  if exists((select date,location,brand,ownership,channel_group,order_type,revenue,checks,markup from public.bi_sales_flat
      except all select date,location,brand,ownership,channel as channel_group,order_type,revenue,checks,markup from public.bi_sales_flat_mv)
    union all (select date,location,brand,ownership,channel as channel_group,order_type,revenue,checks,markup from public.bi_sales_flat_mv
      except all select date,location,brand,ownership,channel_group,order_type,revenue,checks,markup from public.bi_sales_flat)) then raise exception 'FLAT_PARITY'; end if;
  if exists(select from (select sum(revenue) r,sum(checks) c,sum(markup) m from public.agg_sales_monthly union all
    select sum(revenue),sum(checks),sum(markup) from public.agg_sales_weekly) a
    where r is distinct from v_run.revenue or c is distinct from v_run.checks or m is distinct from v_run.markup) then raise exception 'AGGREGATE_PARITY'; end if;
  -- Complete source identity and measures are checked in both directions, not totals alone.
  if exists((select x.accounting_date,x.location_raw,x.brand,x.ownership,x.channel_group,x.order_type,x.revenue,x.checks,x.markup
    from jsonb_to_recordset(v_payload) x(accounting_date date,location_raw text,brand text,ownership text,channel_group text,order_type text,revenue numeric,checks numeric,markup numeric)
    except all select date,location,brand,ownership,channel_group,order_type,revenue,checks,markup from public.bi_sales_flat)
    union all (select date,location,brand,ownership,channel_group,order_type,revenue,checks,markup from public.bi_sales_flat
    except all select x.accounting_date,x.location_raw,x.brand,x.ownership,x.channel_group,x.order_type,x.revenue,x.checks,x.markup
    from jsonb_to_recordset(v_payload) x(accounting_date date,location_raw text,brand text,ownership text,channel_group text,order_type text,revenue numeric,checks numeric,markup numeric))) then raise exception 'SOURCE_KEY_PARITY'; end if;
  v_result := jsonb_build_object('ok',true,'import_run_id',p_run_id,'rows_read',v_run.raw_rows,'rows_loaded',v_facts,'rows_rejected',0,
    'cutoff_date',v_max,'deleted_stale_rows',v_deleted,'source_sha256',v_run.source_sha256,
    'revenue',v_revenue,'checks',v_checks,'markup',v_markup,'atomic',true);
  update public.import_runs set status='success',finished_at=clock_timestamp(),source_cutoff_date=v_max,
    rows_read=v_run.raw_rows,rows_loaded=v_facts,rows_rejected=0,details=jsonb_build_object('atomic',true,'protocol','sales-v3','source_contract','gviz-numeric-canonical-js-number-v1','raw_subcent_cells',v_run.manifest->'raw_subcent_cells','source_sha256',v_run.source_sha256,'snapshot',v_result) where id=p_run_id;
  update bi_sales_import_v3.sales_runs set state='committed',result=v_result where id=p_run_id;
  update bi_sales_import_v3.generation set version=version+1 where singleton;
  delete from bi_sales_import_v3.sales_batches where run_id=p_run_id;
  return v_result;
  -- No exception swallowing: facts, dimensions, deletion, MVs, status and generation all roll back.
end $$;

create function public.get_sales_snapshot_v3(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,bi_sales_import_v3 as $$
declare v_run bi_sales_import_v3.sales_runs%rowtype;
begin
  select * into v_run from bi_sales_import_v3.sales_runs where id=p_run_id;
  if not found then raise exception 'UNKNOWN_RUN'; end if;
  return case when v_run.state='committed' then v_run.result else jsonb_build_object('ok',false,'import_run_id',p_run_id,'status',v_run.state) end;
end $$;
create function public.fail_sales_snapshot_v3(p_run_id uuid,p_code text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,bi_sales_import_v3 as $$
declare v_run bi_sales_import_v3.sales_runs%rowtype;
begin
  -- Wait for any uncertain commit result. Never overwrite a committed success.
  select * into v_run from bi_sales_import_v3.sales_runs where id=p_run_id for update;
  if not found then raise exception 'UNKNOWN_RUN'; end if;
  if v_run.state='committed' then return v_run.result; end if;
  update bi_sales_import_v3.sales_runs set state='failed' where id=p_run_id;
  update public.import_runs set status='failed',finished_at=clock_timestamp(),rows_read=v_run.raw_rows,rows_loaded=0,rows_rejected=0,
    details=jsonb_build_object('protocol','sales-v3','atomic',true,'published',false,'source_sha256',v_run.source_sha256,
      'error',case when p_code ~ '^[A-Z0-9_]{1,80}$' then p_code else 'IMPORT_FAILED' end) where id=p_run_id;
  delete from bi_sales_import_v3.sales_batches where run_id=p_run_id;
  return jsonb_build_object('ok',false,'import_run_id',p_run_id,'status','failed','rows_read',v_run.raw_rows,'rows_loaded',0);
end $$;

-- UI calls use the existing dashboard password capability. No sync key leaves
-- the database: the exact reviewed inactive cron command is reused internally.
create function bi_sales_import_v3.assert_dashboard_password(p_password text) returns void
language plpgsql security definer set search_path=pg_catalog,bi_sales_import_v3 as $$
declare expected text;
begin
  if p_password is null or length(p_password)>4096 then raise exception 'UNAUTHORIZED'; end if;
  select value_hash into expected from public.bi_runtime_config where config_key='access_password';
  if expected is null or expected<>encode(extensions.digest(p_password,'sha256'),'hex') then raise exception 'UNAUTHORIZED'; end if;
end $$;
create function bi_sales_import_v3.dispatch_sales_sync() returns jsonb
language plpgsql security definer set search_path=pg_catalog,bi_sales_import_v3 as $$
declare v_enabled boolean; v_hash text; v_command text; v_id bigint; v_at timestamptz;
begin
  select enabled,trigger_command_hash into v_enabled,v_hash from bi_sales_import_v3.generation where singleton for update;
  if not v_enabled or v_hash is null then raise exception 'SALES_IMPORT_SAFETY_GATE'; end if;
  select r.request_id,r.requested_at into v_id,v_at from bi_sales_import_v3.requests r
    where r.requested_at>clock_timestamp()-interval '5 minutes'
      and (r.requested_at>clock_timestamp()-interval '5 seconds' or
        not exists(select from net._http_response n where n.id=r.request_id))
    order by r.requested_at desc limit 1;
  if found then return jsonb_build_object('accepted',false,'alreadyRunning',true,'requestId',v_id::text,'requestedAt',v_at); end if;
  if (select count(*) from cron.job where jobname='myastoriya_google_sheet_sync_daily')<>1 then raise exception 'TRIGGER_CONFIGURATION_CHANGED'; end if;
  select command into v_command from cron.job where jobname='myastoriya_google_sheet_sync_daily';
  if not found or md5(v_command) is distinct from v_hash or
    v_command !~ '^\s*select\s+net\.http_post\s*\(' or
    position('https://rxewpevxqtfmksybykvo.supabase.co/functions/v1/sync-google-sheet' in v_command)=0 then
    raise exception 'TRIGGER_CONFIGURATION_CHANGED'; end if;
  -- Extend only this manual invocation. The stored schedule/secret is unchanged.
  if (select count(*) from regexp_matches(v_command,'timeout_milliseconds\s*(:=|=>)\s*30000','g'))<>1 then
    raise exception 'TRIGGER_TIMEOUT_CONFIGURATION'; end if;
  v_command := regexp_replace(v_command,'(timeout_milliseconds\s*(?::=|=>)\s*)30000','\1120000');
  execute v_command into v_id;
  if v_id is null then raise exception 'TRIGGER_RECEIPT'; end if;
  insert into bi_sales_import_v3.requests(request_id) values(v_id) returning requested_at into v_at;
  return jsonb_build_object('accepted',true,'alreadyRunning',false,'requestId',v_id::text,'requestedAt',v_at);
end $$;
create function public.bi_trigger_atomic_sync(p_password text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,bi_sales_import_v3 as $$
begin
  perform bi_sales_import_v3.assert_dashboard_password(p_password);
  return bi_sales_import_v3.dispatch_sales_sync();
end $$;
create function bi_sales_import_v3.request_progress(p_request_id bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog,bi_sales_import_v3 as $$
declare v_at timestamptz; v_response record; v_body jsonb; v_run bi_sales_import_v3.sales_runs%rowtype;
  v_import public.import_runs%rowtype; v_status text;
begin
  select requested_at into v_at from bi_sales_import_v3.requests where request_id=p_request_id;
  if not found then raise exception 'UNKNOWN_REQUEST'; end if;
  select status_code,content,timed_out into v_response from net._http_response where id=p_request_id;
  if not found then return jsonb_build_object('requestId',p_request_id::text,'status',
    case when clock_timestamp()-v_at<interval '5 minutes' then 'pending' else 'unknown' end,'published',null,'done',false); end if;
  if v_response.timed_out is true or v_response.content is null or octet_length(v_response.content)>65536 then
    return jsonb_build_object('requestId',p_request_id::text,'status','unknown','published',null,'done',false); end if;
  begin v_body:=v_response.content::jsonb; exception when others then
    return jsonb_build_object('requestId',p_request_id::text,'status','unknown','published',null,'done',false); end;
  if (v_body->>'import_run_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    select * into v_run from bi_sales_import_v3.sales_runs where id=(v_body->>'import_run_id')::uuid;
    if found then
      select * into v_import from public.import_runs where id=v_run.id;
      if v_run.state='committed' and v_import.status='success'
        and ((v_response.status_code=200 and v_body=v_run.result) or
          (v_response.status_code=202 and v_body->>'code'='SALES_IMPORT_STATUS_PENDING')) then
        return jsonb_build_object('requestId',p_request_id::text,'status','success','published',true,'done',true,'atomic',true,
          'runId',v_run.id,'cutoffDate',v_import.source_cutoff_date,'rowsRead',v_import.rows_read,
          'rowsLoaded',v_import.rows_loaded,'rowsRejected',v_import.rows_rejected,'finishedAt',v_import.finished_at);
      elsif v_run.state='failed' and v_import.status='failed'
        and v_response.status_code=500 and v_body->>'code'='SALES_IMPORT_FAILED' and v_body->'published'='false'::jsonb then
        return jsonb_build_object('requestId',p_request_id::text,'status','failed','published',false,'done',true,'runId',v_run.id);
      elsif v_run.state='staging' and v_response.status_code=202
        and v_body->>'code'='SALES_IMPORT_STATUS_PENDING' then
        return jsonb_build_object('requestId',p_request_id::text,'status','unknown','published',null,'done',false,'runId',v_run.id);
      end if;
    end if;
  elsif v_response.status_code=503 and v_body->>'code'='SALES_IMPORT_SAFETY_GATE' then
    return jsonb_build_object('requestId',p_request_id::text,'status','failed','published',false,'done',true);
  end if;
  return jsonb_build_object('requestId',p_request_id::text,'status','unknown','published',null,'done',false);
end $$;
create function public.bi_atomic_sync_progress(p_password text,p_request_id bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog,bi_sales_import_v3 as $$
begin
  perform bi_sales_import_v3.assert_dashboard_password(p_password);
  return bi_sales_import_v3.request_progress(p_request_id);
end $$;
revoke all on all functions in schema bi_sales_import_v3 from public,anon,authenticated,service_role;
revoke all on function public.sales_snapshot_context_v3(),public.get_sales_snapshot_v3(uuid),public.fail_sales_snapshot_v3(uuid,text) from public,anon,authenticated;
grant execute on function public.sales_snapshot_context_v3(),public.get_sales_snapshot_v3(uuid),public.fail_sales_snapshot_v3(uuid,text) to service_role;

revoke all on function public.begin_sales_snapshot_v3(jsonb), public.stage_sales_batch_v3(uuid,integer,jsonb),
  public.commit_sales_snapshot_v3(uuid) from public,anon,authenticated;
grant execute on function public.begin_sales_snapshot_v3(jsonb), public.stage_sales_batch_v3(uuid,integer,jsonb),
  public.commit_sales_snapshot_v3(uuid) to service_role;
revoke all on function public.bi_trigger_atomic_sync(text),public.bi_atomic_sync_progress(text,bigint) from public,anon,authenticated,service_role;
grant execute on function public.bi_trigger_atomic_sync(text),public.bi_atomic_sync_progress(text,bigint) to anon,authenticated;
-- Mandatory cutover boundary: old caller must fail closed, never bypass staging.
revoke all on function public.sync_sales_batch(jsonb,uuid),public.finalize_sales_snapshot(uuid) from public,anon,authenticated,service_role;
do $$begin
  if to_regprocedure('public.bi_trigger_sync(text)') is not null then
    execute 'revoke all on function public.bi_trigger_sync(text) from public,anon,authenticated,service_role';
  end if;
end$$;
rollback; -- NOT APPLIED: release controller replaces with COMMIT only after verified backup and tests.
