-- D234 RECONSTRUCTION / PREPARE ONLY / NOT APPLIED / NOT READY FOR GATE.
-- Versioned disposable transaction model. NEVER a production root/bootstrap.
-- Empty protected authority: no historical evidence, signatures, policy or keys
-- are invented here. Runtime entrypoints remain 503. No public RPC changes.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $preconditions$
begin
  if current_database()<>'sales_attestor_synthetic' or session_user<>'release_v234_fixture'
    or current_user<>'release_v234_fixture'
    or not (select rolsuper from pg_roles where rolname=current_user)
    or to_regnamespace('sales_release_v234_private') is not null
    or to_regclass('sales_attestor_private.accepted_reviews') is null
    or exists(select from pg_default_acl where defaclrole=current_user::regrole)
    or not exists(select from pg_roles where rolname='sales_release_v234_caller' and rolcanlogin
      and not (rolsuper or rolcreaterole or rolcreatedb or rolreplication or rolbypassrls or rolinherit))
    or exists(select from pg_auth_members where roleid='sales_release_v234_caller'::regrole
      or member='sales_release_v234_caller'::regrole) then
    raise exception using errcode='55000',message='SALES_RELEASE_V234_DISPOSABLE_FIXTURE_REQUIRED';
  end if;
end $preconditions$;
create schema sales_release_v234_private;
revoke all on schema sales_release_v234_private from PUBLIC,anon,authenticated,service_role;
-- Only offline fixture operator seeds these. They are NOT production authority.
-- A real historical genesis/accepted-receipt chain and pinned signature policy
-- require an independently approved implementation before this seal can change.
create table sales_release_v234_private.roots (
  receipt_sha256 text primary key check(receipt_sha256 ~ '^[a-f0-9]{64}$'),
  generation bigint not null unique,
  warehouse_rows jsonb not null check(jsonb_typeof(warehouse_rows)='array'),
  raw_rows integer not null check(raw_rows>0),
  min_date date not null, max_date date not null,
  project text not null check(project='OFFLINE_SYNTHETIC_ONLY')
);
create table sales_release_v234_private.authorities (
  run_id uuid primary key references sales_attestor_private.targets(run_id),
  root_sha256 text not null references sales_release_v234_private.roots(receipt_sha256),
  manifest_text text not null,
  payload jsonb not null check(jsonb_typeof(payload)='array'),
  binding_sha256 text not null check(binding_sha256 ~ '^[a-f0-9]{64}$')
);
create table sales_release_v234_private.staged (
  run_id uuid primary key references public.import_runs(id), payload jsonb not null
);
create table sales_release_v234_private.history (
  run_id uuid primary key references public.import_runs(id),
  generation bigint not null unique,
  binding_sha256 text not null,
  receipt_sha256 text not null unique check(receipt_sha256 ~ '^[a-f0-9]{64}$'),
  prior_sha256 text not null references sales_release_v234_private.roots(receipt_sha256),
  result jsonb not null
);
do $protect$
declare n text;
begin
  foreach n in array array['roots','authorities','history'] loop
    execute format('create trigger immutable before update or delete or truncate on sales_release_v234_private.%I for each statement execute function sales_attestor_private.reject_mutation()',n);
    execute format('alter table sales_release_v234_private.%I enable always trigger immutable',n);
  end loop;
  foreach n in array array['roots','authorities','history','staged'] loop
    execute format('alter table sales_release_v234_private.%I enable row level security',n);
  end loop;
end $protect$;
create function sales_release_v234_private.compact(p_value jsonb) returns text
language sql immutable strict set search_path=pg_catalog as $$
  select case jsonb_typeof(p_value)
    when 'array' then '['||(select coalesce(string_agg(sales_release_v234_private.compact(e.value),',' order by e.ordinality),'')
      from jsonb_array_elements(p_value) with ordinality e)||']'
    when 'object' then '{'||(select coalesce(string_agg(to_json(e.key)::text||':'||sales_release_v234_private.compact(e.value),',' order by e.key collate "C"),'')
      from jsonb_each(p_value) e)||'}'
    else p_value::text end;
$$;
create function sales_release_v234_private.warehouse_rows() returns jsonb
language sql stable set search_path=pg_catalog as $$
  select coalesce(jsonb_agg(w.row_value order by sales_release_v234_private.compact(w.row_value) collate "C"),'[]'::jsonb) from (
    select jsonb_build_array(f.date_id::text,l.canonical_name,b.name,o.name,c.channel_group,c.channel_name,t.name,
      (f.revenue*100)::numeric(30,0)::text,f.checks::numeric(30,0)::text,(f.markup*100)::numeric(30,0)::text) row_value
    from public.fact_sales_daily f join public.dim_location l on l.id=f.location_id
    join public.dim_brand b on b.id=f.brand_id join public.dim_ownership o on o.id=f.ownership_id
    join public.dim_channel c on c.id=f.channel_id join public.dim_order_type t on t.id=f.order_type_id
  ) w;
$$;

create function sales_release_v234_private.commit(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
#variable_conflict error
declare
  a sales_release_v234_private.authorities%rowtype;
  root sales_release_v234_private.roots%rowtype;
  h sales_release_v234_private.history%rowtype;
  t sales_attestor_private.targets%rowtype;
  ar sales_attestor_private.accepted_reviews%rowtype;
  v_version bigint; v_payload jsonb; v_rows jsonb; v_aliases jsonb; v_manifest jsonb;
  v_binding jsonb; v_current jsonb; v_result jsonb; v_digest text; x jsonb; k text; n numeric;
begin
  -- Authentication before reservation, staging, sequences or any other mutation.
  -- SET ROLE, JWT claims, service_role and client-selected keys cannot open this.
  if current_database()<>'sales_attestor_synthetic' or current_user<>'release_v234_fixture'
    or session_user<>'sales_release_v234_caller' then
    raise exception using errcode='55000',message='SALES_RELEASE_V234_DISPOSABLE_LOGIN_REQUIRED';
  end if;
  select * into a from sales_release_v234_private.authorities where run_id=p_run_id;
  if not found then raise exception using errcode='55000',message='SALES_RELEASE_V234_PINNED_AUTHORITY_REQUIRED';end if;
  select * into t from sales_attestor_private.targets where run_id=p_run_id;
  select * into root from sales_release_v234_private.roots where receipt_sha256=a.root_sha256;
  v_binding:=t.binding; v_payload:=a.payload; v_manifest:=a.manifest_text::jsonb;
  if root.receipt_sha256 is null or root.project<>'OFFLINE_SYNTHETIC_ONLY'
    or v_binding->>'project' is distinct from root.project
    or v_binding->>'kind' is distinct from 'sales-release/v234/OFFLINE_SYNTHETIC_ONLY'
    or v_binding->>'run_id' is distinct from p_run_id::text
    or v_binding->>'prior_receipt_sha256' is distinct from root.receipt_sha256
    or a.binding_sha256 is distinct from t.binding_sha256
    or coalesce(v_binding->>'source_sha256','') !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='55000',message='SALES_RELEASE_V234_ROOT_BINDING_REQUIRED';end if;
  select * into ar from sales_attestor_private.accepted_reviews where run_id=p_run_id;
  if ar.run_id is null or ar.binding_sha256 is distinct from t.binding_sha256
    or (select count(distinct rr.independence_group) from sales_attestor_private.receipts rr
      join sales_attestor_private.reviewers rv on rv.reviewer=rr.reviewer
      join pg_roles pr on pr.rolname=rr.reviewer and pr.rolcanlogin
        and not (pr.rolsuper or pr.rolbypassrls or pr.rolcreaterole or pr.rolcreatedb or pr.rolreplication)
      where rr.run_id=p_run_id and rr.binding=v_binding and rr.binding_sha256=t.binding_sha256
        and rr.independence_group=rv.independence_group
        and not exists(select from pg_auth_members m where m.roleid=pr.oid or m.member=pr.oid)
        and ((rr.reviewer=ar.reviewer_a and rr.receipt_sha256=ar.receipt_a_sha256)
          or (rr.reviewer=ar.reviewer_b and rr.receipt_sha256=ar.receipt_b_sha256)))<>2 then
    raise exception using errcode='55000',message='SALES_RELEASE_V234_TWO_LOGINS_REQUIRED';end if;
  select version into v_version from bi_import_private.generation where singleton for update;
  select * into h from sales_release_v234_private.history where run_id=p_run_id;
  if found then
    if h.generation<>v_version or h.binding_sha256<>t.binding_sha256 then
      raise exception using errcode='55000',message='SALES_RELEASE_V234_STALE_GENERATION';end if;
    return h.result; -- exact immutable lost-response retry; no write or sequence
  end if;
  if root.generation<>v_version or v_binding->>'base_generation' is distinct from v_version::text
    or v_binding->>'generation' is distinct from (v_version+1)::text then
    raise exception using errcode='55000',message='SALES_RELEASE_V234_STALE_GENERATION';end if;
  if t.expires_at<=clock_timestamp() then
    raise exception using errcode='55000',message='SALES_RELEASE_V234_EXPIRED';end if;
  -- Entire input validated before ANY writes. No monetary float casts.
  if jsonb_typeof(v_manifest) is distinct from 'object' or
    (select array_agg(key order by key) from jsonb_object_keys(v_manifest) key)
      <>array['batches','checks','markup','max_date','min_date','raw_rows','revenue','rows']::text[]
    or jsonb_array_length(v_payload) not between 1 and 200000
    or octet_length(v_payload::text)>33554432 then
    raise exception using errcode='55000',message='SALES_RELEASE_V234_MANIFEST';end if;
  for x in select value from jsonb_array_elements(v_payload) loop
    if jsonb_typeof(x)<>'object' or
      (select count(*) from jsonb_object_keys(x))<>9 then
      raise exception using errcode='55000',message='SALES_RELEASE_V234_ROW';end if;
    foreach k in array array['accounting_date','location_raw','brand','ownership','channel_group','order_type'] loop
      if jsonb_typeof(x->k) is distinct from 'string' or nullif(x->>k,'') is null
        or length(x->>k)>256 or normalize(x->>k,NFC)<>x->>k
        or btrim(regexp_replace(x->>k,'\s+',' ','g'))<>x->>k
        or x->>k ~ '[[:cntrl:]]' or lower(x->>k) in ('unknown','null','undefined','none','nan') then
        raise exception using errcode='55000',message='SALES_RELEASE_V234_DIMENSION';end if;
    end loop;
    if x->>'accounting_date' !~ '^\d{4}-\d{2}-\d{2}$'
      or (x->>'accounting_date')::date<date '2000-01-01'
      or (x->>'accounting_date')::date>=(clock_timestamp() at time zone 'Europe/Kyiv')::date then
      raise exception using errcode='55000',message='SALES_RELEASE_V234_DATE';end if;
    foreach k in array array['revenue','checks','markup'] loop
      if jsonb_typeof(x->k) is distinct from 'number' then
        raise exception using errcode='55000',message='SALES_RELEASE_V234_METRIC';end if;
      n:=(x->>k)::numeric;
      if abs(n)>=100000000000000 or n<>round(n,2) or (k='checks' and (n<0 or n<>trunc(n))) then
        raise exception using errcode='55000',message='SALES_RELEASE_V234_PRECISION';end if;
    end loop;
  end loop;
  if exists(select from jsonb_each(v_manifest) e where
      (e.key in ('rows','raw_rows','batches','revenue','checks','markup') and jsonb_typeof(e.value)<>'number') or
      (e.key in ('min_date','max_date') and jsonb_typeof(e.value)<>'string'))
    or (v_manifest->>'raw_rows')::numeric<>trunc((v_manifest->>'raw_rows')::numeric)
    or (v_manifest->>'raw_rows')::numeric not between greatest(root.raw_rows,jsonb_array_length(v_payload)) and 200000
    or (v_manifest->>'min_date')::date>root.min_date or (v_manifest->>'max_date')::date<root.max_date
    or (v_manifest->>'max_date')::date<>((clock_timestamp() at time zone 'Europe/Kyiv')::date-1)
    or (v_manifest - 'raw_rows') is distinct from (select jsonb_build_object(
      'rows',count(*),'batches',ceil(count(*)/2000.0),'revenue',sum(p.revenue),'checks',sum(p.checks),
      'markup',sum(p.markup),'min_date',min(p.accounting_date)::text,'max_date',max(p.accounting_date)::text)
      from jsonb_to_recordset(v_payload) p(accounting_date date,revenue numeric,checks numeric,markup numeric))
    or encode(sha256(convert_to(a.manifest_text,'UTF8')),'hex') is distinct from v_binding->>'manifest_sha256'
    or v_binding->>'raw_rows' is distinct from v_manifest->>'raw_rows'
    or v_binding->>'min_date' is distinct from v_manifest->>'min_date'
    or v_binding->>'max_date' is distinct from v_manifest->>'max_date' then
    raise exception using errcode='55000',message='SALES_RELEASE_V234_MANIFEST';end if;
  -- Freeze mapping, dimensions and facts before canonical/historical comparisons.
  lock table public.map_location_source,public.location_lifecycle_registry in share mode;
  lock table public.dim_date,public.dim_location,public.dim_brand,public.dim_ownership,
    public.dim_channel,public.dim_order_type,public.fact_sales_daily in share row exclusive mode;
  select jsonb_agg(w.row_value order by sales_release_v234_private.compact(w.row_value) collate "C") into v_rows from (
    select jsonb_build_array(p.accounting_date::text,coalesce(m.canonical_name,p.location_raw),p.brand,p.ownership,
      p.channel_group,p.channel_group,p.order_type,(p.revenue*100)::numeric(30,0)::text,
      p.checks::numeric(30,0)::text,(p.markup*100)::numeric(30,0)::text) row_value
    from jsonb_to_recordset(v_payload) p(accounting_date date,location_raw text,brand text,ownership text,
      channel_group text,order_type text,revenue numeric,checks numeric,markup numeric)
    left join public.map_location_source m on m.source_name=p.location_raw
  ) w;
  select jsonb_agg(w.pair order by sales_release_v234_private.compact(w.pair) collate "C") into v_aliases from (
    select distinct jsonb_build_array(e.value->>'location_raw',coalesce(m.canonical_name,e.value->>'location_raw')) pair
    from jsonb_array_elements(v_payload) e left join public.map_location_source m on m.source_name=e.value->>'location_raw'
  ) w;
  if v_rows is distinct from v_binding->'canonical_rows' or v_aliases is distinct from v_binding->'aliases'
    or encode(sha256(convert_to(sales_release_v234_private.compact(jsonb_build_array('sales-warehouse-cents/v1',v_rows)),'UTF8')),'hex')
      is distinct from v_binding->>'warehouse_sha256'
    or encode(sha256(convert_to(sales_release_v234_private.compact(jsonb_build_array('sales-alias-resolution/v1',v_aliases)),'UTF8')),'hex')
      is distinct from v_binding->>'mapping_sha256'
    or exists(select from jsonb_array_elements(v_rows) e group by e.value->0,e.value->1,e.value->2,
      e.value->3,e.value->4,e.value->5,e.value->6 having count(*)>1) then
    raise exception using errcode='55000',message='SALES_RELEASE_V234_CANONICAL_MISMATCH';
  end if;
  v_current:=sales_release_v234_private.warehouse_rows();
  if v_current is distinct from root.warehouse_rows then
    raise exception using errcode='55000',message='SALES_RELEASE_V234_PRIOR_WAREHOUSE';end if;
  if exists(select from jsonb_array_elements(v_current) old_row where not exists(
    select from jsonb_array_elements(v_rows) new_row where
      (new_row.value-9-8-7)=(old_row.value-9-8-7))) then
    raise exception using errcode='55000',message='SALES_RELEASE_V234_HISTORICAL_IDENTITY';
  end if;
  insert into public.import_runs(id,source_name,status,details)
    values(p_run_id,'google_sheets:Данние короткі','running','{"preview_v234":true}');
  insert into sales_release_v234_private.staged values(p_run_id,v_payload);
  -- A PRIVATE synthetic promotion; NEVER call legacy batch/finalize or reopen
  -- public commit. Existing historical identities are retained, no fact DELETE.
  insert into public.dim_date select distinct (e.value->>0)::date,
    extract(year from (e.value->>0)::date)::int,extract(quarter from (e.value->>0)::date)::int,
    extract(month from (e.value->>0)::date)::int,to_char((e.value->>0)::date,'YYYY-MM'),
    extract(week from (e.value->>0)::date)::int,date_trunc('week',(e.value->>0)::date)::date,
    date_trunc('month',(e.value->>0)::date)::date,extract(isodow from (e.value->>0)::date)::int,
    extract(isodow from (e.value->>0)::date)::int in (6,7)
    from jsonb_array_elements(v_rows) e on conflict do nothing;
  insert into public.dim_brand(name) select distinct e.value->>2 from jsonb_array_elements(v_rows) e on conflict do nothing;
  insert into public.dim_ownership(name) select distinct e.value->>3 from jsonb_array_elements(v_rows) e on conflict do nothing;
  insert into public.dim_location(canonical_name) select distinct e.value->>1 from jsonb_array_elements(v_rows) e on conflict do nothing;
  insert into public.dim_channel(channel_group,channel_name,is_owned,is_aggregator) select distinct e.value->>4,e.value->>5,
    (e.value->>4) in ('Заклад','Доставка'),(e.value->>4)='Агрегатор'
    from jsonb_array_elements(v_rows) e on conflict do nothing;
  insert into public.dim_order_type(name) select distinct e.value->>6 from jsonb_array_elements(v_rows) e on conflict do nothing;
  -- Reuse existing IDs on updates without consuming identity sequence values.
  update public.fact_sales_daily f set revenue=(e.value->>7)::numeric/100,checks=(e.value->>8)::numeric,
    markup=(e.value->>9)::numeric/100,import_run_id=p_run_id
    from jsonb_array_elements(v_rows) e,public.dim_location l,public.dim_brand b,public.dim_ownership o,
      public.dim_channel c,public.dim_order_type ot
    where l.canonical_name=e.value->>1 and b.name=e.value->>2 and o.name=e.value->>3
      and c.channel_group=e.value->>4 and c.channel_name=e.value->>5 and ot.name=e.value->>6
      and f.date_id=(e.value->>0)::date and f.location_id=l.id and f.brand_id=b.id
      and f.ownership_id=o.id and f.channel_id=c.id and f.order_type_id=ot.id;
  insert into public.fact_sales_daily(id,date_id,location_id,brand_id,ownership_id,channel_id,order_type_id,revenue,checks,markup,import_run_id) overriding system value
    select (select coalesce(max(id),0) from public.fact_sales_daily)+row_number() over(order by e.value::text collate "C"),(e.value->>0)::date,l.id,b.id,o.id,c.id,ot.id,(e.value->>7)::numeric/100,
      (e.value->>8)::numeric,(e.value->>9)::numeric/100,p_run_id
    from jsonb_array_elements(v_rows) e join public.dim_location l on l.canonical_name=e.value->>1
      join public.dim_brand b on b.name=e.value->>2 join public.dim_ownership o on o.name=e.value->>3
      join public.dim_channel c on c.channel_group=e.value->>4 and c.channel_name=e.value->>5
      join public.dim_order_type ot on ot.name=e.value->>6
    where not exists(select from public.fact_sales_daily f where f.date_id=(e.value->>0)::date
      and f.location_id=l.id and f.brand_id=b.id and f.ownership_id=o.id and f.channel_id=c.id and f.order_type_id=ot.id);
  refresh materialized view public.bi_sales_flat_mv;
  refresh materialized view public.agg_sales_monthly;
  refresh materialized view public.agg_sales_weekly;
  if sales_release_v234_private.warehouse_rows() is distinct from v_rows then
    raise exception using errcode='55000',message='SALES_RELEASE_V234_READBACK_MISMATCH';
  end if;
  v_result:=jsonb_build_object('fixture','OFFLINE_SYNTHETIC_ONLY','generation',(v_version+1)::text,
    'source_sha256',v_binding->>'source_sha256','manifest_sha256',v_binding->>'manifest_sha256',
    'warehouse_sha256',v_binding->>'warehouse_sha256','mapping_sha256',v_binding->>'mapping_sha256');
  v_digest:=encode(sha256(convert_to(jsonb_build_array('sales-release-receipt/v234',p_run_id,
    a.root_sha256,t.binding_sha256,v_result)::text,'UTF8')),'hex');
  update public.import_runs set status='success',finished_at=clock_timestamp(),
    source_cutoff_date=(v_manifest->>'max_date')::date,rows_read=(v_manifest->>'raw_rows')::int,
    rows_loaded=(v_manifest->>'rows')::int,rows_rejected=0,
    details=jsonb_build_object('preview_v234',v_result,'receipt_sha256',v_digest) where id=p_run_id;
  insert into sales_release_v234_private.history values(p_run_id,v_version+1,t.binding_sha256,v_digest,a.root_sha256,v_result);
  update bi_import_private.generation set version=v_version+1 where singleton;
  delete from sales_release_v234_private.staged where run_id=p_run_id;
  return v_result;
  -- No exception handler: all table/MV/history changes roll back together.
  -- Explicit fact IDs above avoid nontransactional identity nextval on failures.
end $$;
revoke all on all tables in schema sales_release_v234_private from PUBLIC,anon,authenticated,service_role,sales_release_v234_caller;
revoke all on all functions in schema sales_release_v234_private from PUBLIC,anon,authenticated,service_role,sales_release_v234_caller;
grant usage on schema sales_release_v234_private to sales_release_v234_caller;
grant execute on function sales_release_v234_private.commit(uuid) to sales_release_v234_caller;
rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.
