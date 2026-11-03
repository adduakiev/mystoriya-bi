-- OFFLINE SYNTHETIC REHEARSAL ONLY / NOT APPLIED. Not a production migration.
-- Does not replace/rename/grant access to ANY existing public function.
-- No root bootstrap, roles, credentials, source reads or runtime wiring.
-- Only the disposable fixture may provision the EMPTY authority table below.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $preconditions$
begin
  if current_database()<>'sales_attestor_synthetic' or session_user<>'rehearsal_fixture'
    or current_user<>'rehearsal_fixture'
    or not (select rolsuper from pg_roles where rolname=current_user)
    or to_regnamespace('sales_rehearsal_private') is not null
    or to_regclass('sales_attestor_private.accepted_reviews') is null
    or not exists(select from pg_roles where rolname='sales_rehearsal_caller' and rolcanlogin
      and not (rolsuper or rolcreaterole or rolcreatedb or rolreplication or rolbypassrls or rolinherit))
    or exists(select from pg_default_acl where defaclrole='rehearsal_fixture'::regrole)
    or exists(select from pg_auth_members where roleid='sales_rehearsal_caller'::regrole
      or member='sales_rehearsal_caller'::regrole) then
    raise exception using errcode='55000',message='SALES_REHEARSAL_DISPOSABLE_FIXTURE_REQUIRED';
  end if;
  if exists(select from pg_proc p where p.oid in ('public.commit_sales_snapshot_v2(uuid)'::regprocedure,
      'public.commit_sales_snapshot_with_evidence_v1(uuid,jsonb)'::regprocedure)
    and (p.prosecdef or p.prosrc !~ '^\s*begin\s+raise exception using errcode = ''55000'', message = ''SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE'';\s*end\s*$')) then
    raise exception using errcode='55000',message='SALES_REHEARSAL_REJECTION_OVERLAY_REQUIRED';
  end if;
end $preconditions$;
create schema sales_rehearsal_private authorization rehearsal_fixture;
revoke all on schema sales_rehearsal_private from PUBLIC,anon,authenticated,service_role;
create table sales_rehearsal_private.authorities (
  run_id uuid primary key references sales_attestor_private.targets(run_id),
  fixture_kind text not null check(fixture_kind='OFFLINE_SYNTHETIC_ONLY'),
  manifest_text text not null,
  payload jsonb not null check(jsonb_typeof(payload)='array'),
  binding_sha256 text not null check(binding_sha256 ~ '^[a-f0-9]{64}$'),
  synthetic_prior jsonb not null check(jsonb_typeof(synthetic_prior)='object' and synthetic_prior ? 'prior'
    and (synthetic_prior->>'fixture') is not distinct from 'OFFLINE_SYNTHETIC_ONLY')
);
alter table sales_rehearsal_private.authorities enable row level security;
create trigger authorities_immutable before update or delete or truncate on sales_rehearsal_private.authorities
  for each statement execute function sales_attestor_private.reject_mutation();
alter table sales_rehearsal_private.authorities enable always trigger authorities_immutable;

-- JSON.stringify tuple parity, preserving spaces WITHIN strings. Never regexp
-- strip whitespace from JSON. Only used for this fixed synthetic tuple contract.
create function sales_rehearsal_private.compact(p_value jsonb) returns text
language sql immutable strict set search_path=pg_catalog as $$
  select case jsonb_typeof(p_value)
    when 'array' then '['||(select coalesce(string_agg(sales_rehearsal_private.compact(e.value),',' order by e.ordinality),'')
      from jsonb_array_elements(p_value) with ordinality e)||']'
    when 'object' then '{'||(select coalesce(string_agg(to_json(e.key)::text||':'||sales_rehearsal_private.compact(e.value),',' order by e.key collate "C"),'')
      from jsonb_each(p_value) e)||'}'
    else p_value::text end;
$$;
create function sales_rehearsal_private.warehouse_rows() returns jsonb
language sql stable set search_path=pg_catalog as $$
  select coalesce(jsonb_agg(w.row_value order by w.row_value::text collate "C"),'[]'::jsonb) from (
    select jsonb_build_array(f.date_id::text,l.canonical_name,b.name,o.name,c.channel_group,c.channel_name,t.name,
      (f.revenue*100)::numeric(30,0)::text,f.checks::numeric(30,0)::text,(f.markup*100)::numeric(30,0)::text) row_value
    from public.fact_sales_daily f join public.dim_location l on l.id=f.location_id
    join public.dim_brand b on b.id=f.brand_id join public.dim_ownership o on o.id=f.ownership_id
    join public.dim_channel c on c.id=f.channel_id join public.dim_order_type t on t.id=f.order_type_id
  ) w;
$$;

create function sales_rehearsal_private.commit(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
#variable_conflict error
declare
  v_authority sales_rehearsal_private.authorities%rowtype;
  v_target sales_attestor_private.targets%rowtype;
  v_run bi_import_private.sales_runs%rowtype;
  v_review sales_attestor_private.accepted_reviews%rowtype;
  v_version bigint; v_payload jsonb; v_rows jsonb; v_aliases jsonb; v_manifest jsonb;
  v_result jsonb; v_binding jsonb; v_current jsonb;
begin
  -- Repeat the database boundary on EVERY call, including restored definitions.
  if current_database()<>'sales_attestor_synthetic' or current_user<>'rehearsal_fixture'
    or session_user<>'sales_rehearsal_caller' then
    raise exception using errcode='55000',message='SALES_REHEARSAL_FIXTURE_CALLER_REQUIRED';
  end if;
  -- One ordering for concurrent attempts, including different run IDs. A stale
  -- retry MUST be rejected, including a previously committed run (no new success).
  select g.version into v_version from bi_import_private.generation g where g.singleton for update;
  select a.* into v_authority from sales_rehearsal_private.authorities a where a.run_id=p_run_id;
  if not found then raise exception using errcode='55000',message='SALES_REHEARSAL_AUTHORITY_REQUIRED'; end if;
  select t.* into v_target from sales_attestor_private.targets t where t.run_id=p_run_id for update;
  select r.* into v_run from bi_import_private.sales_runs r where r.id=p_run_id for update;
  v_binding := v_target.binding;
  if v_run.id is null or v_run.base_version<>v_version or v_run.state<>'staging'
    or v_binding->>'base_generation' is distinct from v_version::text
    or v_binding->>'generation' is distinct from (v_version+1)::text then
    raise exception using errcode='55000',message='SALES_REHEARSAL_STALE_GENERATION';
  end if;
  if v_target.expires_at<=clock_timestamp() or v_run.expires_at<=clock_timestamp()
    or v_authority.fixture_kind<>'OFFLINE_SYNTHETIC_ONLY'
    or v_binding->>'kind' is distinct from 'sales-accepted-source-review/synthetic-v1'
    or v_binding->>'run_id' is distinct from p_run_id::text
    or v_binding->'prior' is distinct from v_authority.synthetic_prior->'prior'
    or v_binding->'prior'->>'generation' is distinct from v_version::text
    or v_authority.binding_sha256 is distinct from v_target.binding_sha256 then
    raise exception using errcode='55000',message='SALES_REHEARSAL_BINDING_MISMATCH';
  end if;
  select ar.* into v_review from sales_attestor_private.accepted_reviews ar where ar.run_id=p_run_id;
  if not found or v_review.binding_sha256 is distinct from v_target.binding_sha256
    or (select count(*) from sales_attestor_private.receipts rr
      join sales_attestor_private.reviewers rv on rv.reviewer=rr.reviewer
      where rr.run_id=p_run_id and rr.binding=v_binding and rr.binding_sha256=v_target.binding_sha256
        and rr.independence_group=rv.independence_group
        and ((rr.reviewer=v_review.reviewer_a and rr.receipt_sha256=v_review.receipt_a_sha256)
          or (rr.reviewer=v_review.reviewer_b and rr.receipt_sha256=v_review.receipt_b_sha256)))<>2 then
    raise exception using errcode='55000',message='SALES_REHEARSAL_TWO_REVIEWS_REQUIRED';
  end if;
  if (select count(distinct rr.independence_group) from sales_attestor_private.receipts rr where rr.run_id=p_run_id)<>2 then
    raise exception using errcode='55000',message='SALES_REHEARSAL_TWO_REVIEWS_REQUIRED';
  end if;
  select jsonb_agg(e.value order by sb.batch_no,e.ordinality) into v_payload
    from bi_import_private.sales_batches sb cross join lateral jsonb_array_elements(sb.payload) with ordinality e
    where sb.run_id=p_run_id;
  if v_payload is distinct from v_authority.payload
    or (select count(*) from bi_import_private.sales_batches sb where sb.run_id=p_run_id)<>v_run.expected_batches then
    raise exception using errcode='55000',message='SALES_REHEARSAL_STAGE_MISMATCH';
  end if;
  v_manifest:=v_authority.manifest_text::jsonb;
  if encode(sha256(convert_to(v_authority.manifest_text,'UTF8')),'hex') is distinct from v_binding->>'manifest_sha256'
    or v_manifest is distinct from jsonb_build_object('rows',v_run.expected_rows,'raw_rows',v_run.raw_rows,
      'batches',v_run.expected_batches,'revenue',v_run.revenue,'checks',v_run.checks,'markup',v_run.markup,
      'min_date',v_run.min_date::text,'max_date',v_run.max_date::text)
    or v_binding->>'raw_rows' is distinct from v_run.raw_rows::text
    or v_binding->>'min_date' is distinct from v_run.min_date::text
    or v_binding->>'max_date' is distinct from v_run.max_date::text
    or coalesce(v_binding->>'source_sha256','') !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='55000',message='SALES_REHEARSAL_MANIFEST_MISMATCH';
  end if;
  -- Freeze mapping, dimensions and facts before canonical/historical comparisons.
  lock table public.map_location_source,public.location_lifecycle_registry in share mode;
  lock table public.dim_date,public.dim_location,public.dim_brand,public.dim_ownership,
    public.dim_channel,public.dim_order_type,public.fact_sales_daily in share row exclusive mode;
  select jsonb_agg(w.row_value order by w.row_value::text collate "C") into v_rows from (
    select jsonb_build_array(p.accounting_date::text,coalesce(m.canonical_name,p.location_raw),p.brand,p.ownership,
      p.channel_group,p.channel_group,p.order_type,(p.revenue*100)::numeric(30,0)::text,
      p.checks::numeric(30,0)::text,(p.markup*100)::numeric(30,0)::text) row_value
    from jsonb_to_recordset(v_payload) p(accounting_date date,location_raw text,brand text,ownership text,
      channel_group text,order_type text,revenue numeric,checks numeric,markup numeric)
    left join public.map_location_source m on m.source_name=p.location_raw
  ) w;
  select jsonb_agg(w.pair order by w.pair::text collate "C") into v_aliases from (
    select distinct jsonb_build_array(e.value->>'location_raw',coalesce(m.canonical_name,e.value->>'location_raw')) pair
    from jsonb_array_elements(v_payload) e left join public.map_location_source m on m.source_name=e.value->>'location_raw'
  ) w;
  if v_rows is distinct from v_binding->'canonical_rows' or v_aliases is distinct from v_binding->'aliases'
    or encode(sha256(convert_to(sales_rehearsal_private.compact(jsonb_build_array('sales-warehouse-cents/v1',v_rows)),'UTF8')),'hex')
      is distinct from v_binding->>'warehouse_sha256'
    or encode(sha256(convert_to(sales_rehearsal_private.compact(jsonb_build_array('sales-alias-resolution/v1',v_aliases)),'UTF8')),'hex')
      is distinct from v_binding->>'mapping_sha256'
    or exists(select from jsonb_array_elements(v_rows) e group by e.value->0,e.value->1,e.value->2,
      e.value->3,e.value->4,e.value->5,e.value->6 having count(*)>1) then
    raise exception using errcode='55000',message='SALES_REHEARSAL_CANONICAL_MISMATCH';
  end if;
  v_current:=sales_rehearsal_private.warehouse_rows();
  if exists(select from jsonb_array_elements(v_current) old_row where not exists(
    select from jsonb_array_elements(v_rows) new_row where
      (new_row.value-9-8-7)=(old_row.value-9-8-7))) then
    raise exception using errcode='55000',message='SALES_REHEARSAL_HISTORICAL_IDENTITY';
  end if;
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
  insert into public.dim_channel(channel_group,channel_name) select distinct e.value->>4,e.value->>5
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
  insert into public.fact_sales_daily(date_id,location_id,brand_id,ownership_id,channel_id,order_type_id,revenue,checks,markup,import_run_id)
    select (e.value->>0)::date,l.id,b.id,o.id,c.id,ot.id,(e.value->>7)::numeric/100,
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
  if sales_rehearsal_private.warehouse_rows() is distinct from v_rows then
    raise exception using errcode='55000',message='SALES_REHEARSAL_READBACK_MISMATCH';
  end if;
  v_result:=jsonb_build_object('fixture','OFFLINE_SYNTHETIC_ONLY','generation',(v_version+1)::text,
    'source_sha256',v_binding->>'source_sha256','manifest_sha256',v_binding->>'manifest_sha256',
    'warehouse_sha256',v_binding->>'warehouse_sha256','mapping_sha256',v_binding->>'mapping_sha256');
  update public.import_runs ir set status='success',finished_at=clock_timestamp(),source_cutoff_date=v_run.max_date,
    rows_read=v_run.raw_rows,rows_loaded=v_run.expected_rows,rows_rejected=0,
    details=jsonb_build_object('synthetic_rehearsal',v_result,'binding',v_binding) where ir.id=p_run_id;
  update bi_import_private.sales_runs sr set state='committed',result=v_result where sr.id=p_run_id;
  update bi_import_private.generation g set version=v_version+1 where g.singleton;
  return v_result;
end $$;
revoke all on all tables in schema sales_rehearsal_private from PUBLIC,anon,authenticated,service_role,sales_rehearsal_caller;
revoke all on all functions in schema sales_rehearsal_private from PUBLIC,anon,authenticated,service_role,sales_rehearsal_caller;
grant usage on schema sales_rehearsal_private to sales_rehearsal_caller;
grant execute on function sales_rehearsal_private.commit(uuid) to sales_rehearsal_caller;
rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.
