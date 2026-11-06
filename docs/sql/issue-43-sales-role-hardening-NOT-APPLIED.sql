-- REVIEW ONLY / NOT APPLIED. Never run against staging or production here.
-- Depends on BOTH atomic draft AND rejection-only accepted-source overlay.
-- Not a migration/cutover. Existing owner-authenticated SECURITY DEFINER paths
-- retain ownership; no role, membership, default ACL or function body is changed.
-- Read the separate READ-ONLY preflight first. Unknown writers require review.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $hardening$
declare
  targets text[] := array[
    'public.dim_date','public.dim_brand','public.dim_ownership','public.dim_location',
    'public.dim_channel','public.dim_order_type','public.fact_sales_daily',
    'public.import_runs','public.staging_sales_raw','public.data_quality_issues',
    'public.map_location_source','public.location_lifecycle_registry',
    'public.bi_sales_flat','public.bi_sales_flat_mv','public.agg_sales_monthly','public.agg_sales_weekly',
    'bi_import_private.generation','bi_import_private.sales_runs','bi_import_private.sales_batches'];
  blocked_functions text[] := array[
    'public.sync_sales_batch(jsonb,uuid)','public.finalize_sales_snapshot(uuid)',
    'public.refresh_bi_aggregates()','public.bi_trigger_sync(text)'];
  prepared_functions text[] := array[
    'public.begin_sales_snapshot_v2(jsonb)','public.stage_sales_batch_v2(uuid,integer,jsonb)',
    'public.commit_sales_snapshot_v2(uuid)','public.commit_sales_snapshot_with_evidence_v1(uuid,jsonb)'];
  api text; name text; col record; obj record; owners oid[]; member_role record;
begin
  -- Stop rather than revoke unrelated inherited memberships or global defaults.
  foreach api in array array['anon','authenticated','service_role'] loop
    if not exists(select from pg_roles where rolname=api) then
      raise exception using errcode='55000', message='SALES_ROLE_STOP_MISSING_ROLE';
    end if;
    for member_role in select oid,rolsuper,rolcreaterole,rolcreatedb,rolreplication
      from pg_roles where pg_has_role(api,oid,'MEMBER') loop
      if member_role.rolsuper or member_role.rolcreaterole or member_role.rolcreatedb or member_role.rolreplication then
        raise exception using errcode='55000', message='SALES_ROLE_STOP_ELEVATED_MEMBERSHIP';
      end if;
    end loop;
    foreach name in array array['public','bi_import_private'] loop
      if exists(select from pg_roles parent where pg_has_role(api,parent.oid,'MEMBER')
        and has_schema_privilege(parent.oid,name,'CREATE')) then
        raise exception using errcode='55000', message='SALES_ROLE_STOP_SCHEMA_CREATE';
      end if;
    end loop;
  end loop;
  foreach name in array targets loop
    if to_regclass(name) is null then
      raise exception using errcode='55000', message='SALES_ROLE_STOP_MISSING_RELATION';
    end if;
  end loop;
  foreach name in array blocked_functions || prepared_functions loop
    if to_regprocedure(name) is null then
      raise exception using errcode='55000', message='SALES_ROLE_STOP_MISSING_FUNCTION';
    end if;
  end loop;
  if exists(select from pg_proc p where p.pronamespace='public'::regnamespace
    and p.proname in (select q.proname from pg_proc q where q.oid=any
      (array(select to_regprocedure(x) from unnest(blocked_functions || prepared_functions) x)))
    and p.oid<>all(array(select to_regprocedure(x) from unnest(blocked_functions || prepared_functions) x))) then
    raise exception using errcode='55000', message='SALES_ROLE_STOP_UNREVIEWED_RPC_OVERLOAD';
  end if;
  -- Require the existing rejection overlay, never the ungated atomic original.
  -- Inspect catalog bodies; do not execute any writer or invoke an import.
  foreach name in array array['public.commit_sales_snapshot_v2(uuid)',
    'public.commit_sales_snapshot_with_evidence_v1(uuid,jsonb)'] loop
    if not exists(select from pg_proc where oid=to_regprocedure(name) and not prosecdef
      and prosrc ~ '^\s*begin\s+raise exception using errcode = ''55000'', message = ''SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE'';\s*end\s*$') then
      raise exception using errcode='55000', message='SALES_ROLE_STOP_REJECTION_OVERLAY_REQUIRED';
    end if;
  end loop;
  select array_agg(distinct owner_id) into owners from (
    select relowner owner_id from pg_class where oid=any(array(select to_regclass(x) from unnest(targets) x))
    union select proowner from pg_proc where oid=any(array(select to_regprocedure(x) from unnest(blocked_functions || prepared_functions) x))
    union select nspowner from pg_namespace where nspname in ('public','bi_import_private')
  ) s;
  foreach api in array array['anon','authenticated','service_role'] loop
    if exists(select from unnest(owners) o where pg_has_role(api,o,'MEMBER')) then
      raise exception using errcode='55000', message='SALES_ROLE_STOP_OWNER_MEMBERSHIP';
    end if;
  end loop;
  -- Global/per-schema defaults cannot be safely changed for Sales alone.
  -- Any relevant explicit write/EXECUTE default is a separate design STOP gate.
  if exists(select from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
    where d.defaclrole=any(owners)
      and (d.defaclnamespace=0 or d.defaclnamespace in
        (select oid from pg_namespace where nspname in ('public','bi_import_private')))
      and ((d.defaclobjtype='r' and a.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'))
        or (d.defaclobjtype='S' and a.privilege_type in ('USAGE','UPDATE'))
        or (d.defaclobjtype='f' and a.privilege_type='EXECUTE'))
      and (a.grantee=0 or exists(select from pg_roles r where r.rolname in ('anon','authenticated','service_role')
        and pg_has_role(r.oid,a.grantee,'MEMBER')))) then
    raise exception using errcode='55000', message='SALES_ROLE_STOP_DEFAULT_GRANTS';
  end if;

  revoke all on schema bi_import_private from PUBLIC, anon, authenticated, service_role;
  foreach name in array targets loop
    execute format('revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table %s from PUBLIC, anon, authenticated, service_role',to_regclass(name));
    -- Table REVOKE does NOT remove independent column ACLs.
    for col in select attname from pg_attribute where attrelid=to_regclass(name) and attnum>0 and not attisdropped loop
      execute format('revoke INSERT (%I), UPDATE (%I), REFERENCES (%I) on table %s from PUBLIC, anon, authenticated, service_role',
        col.attname,col.attname,col.attname,to_regclass(name));
    end loop;
  end loop;
  -- Identity/serial dependencies only, not unrelated Digital sequences.
  for obj in select distinct s.oid::regclass sequence_name from pg_class s join pg_depend d on d.objid=s.oid
    where s.relkind='S' and d.deptype in ('a','i') and d.refclassid='pg_class'::regclass
      and d.refobjid=any(array(select to_regclass(x) from unnest(targets) x)) loop
    execute format('revoke USAGE, UPDATE on sequence %s from PUBLIC, anon, authenticated, service_role',obj.sequence_name);
    for api in select distinct parent.rolname from pg_roles parent cross join pg_roles caller
      where caller.rolname in ('anon','authenticated','service_role')
        and pg_has_role(caller.oid,parent.oid,'MEMBER') loop
      if has_sequence_privilege(api,obj.sequence_name,'USAGE,UPDATE') then
        raise exception using errcode='55000', message='SALES_ROLE_STOP_INHERITED_SEQUENCE_GRANTS';
      end if;
    end loop;
  end loop;
  foreach name in array blocked_functions loop
    execute format('revoke EXECUTE on function %s from PUBLIC, anon, authenticated, service_role',to_regprocedure(name));
    for api in select distinct parent.rolname from pg_roles parent cross join pg_roles caller
      where caller.rolname in ('anon','authenticated','service_role')
        and pg_has_role(caller.oid,parent.oid,'MEMBER') loop
      if has_function_privilege(api,to_regprocedure(name),'EXECUTE') then
        raise exception using errcode='55000', message='SALES_ROLE_STOP_INHERITED_RPC_GRANTS';
      end if;
    end loop;
  end loop;
  -- Existing prepared owner paths remain service-only; no new EXECUTE grant.
  foreach name in array prepared_functions loop
    for api in select distinct parent.rolname from pg_roles parent cross join pg_roles caller
      where caller.rolname in ('anon','authenticated')
        and pg_has_role(caller.oid,parent.oid,'MEMBER') loop
      if has_function_privilege(api,to_regprocedure(name),'EXECUTE') then
        raise exception using errcode='55000', message='SALES_ROLE_STOP_PREPARED_RPC_EXPOSURE';
      end if;
    end loop;
  end loop;
  for api in select distinct parent.rolname from pg_roles parent cross join pg_roles caller
      where caller.rolname in ('anon','authenticated','service_role')
        and pg_has_role(caller.oid,parent.oid,'MEMBER') loop
    foreach name in array targets loop
      if has_table_privilege(api,to_regclass(name),'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(api,to_regclass(name),'INSERT,UPDATE,REFERENCES') then
        raise exception using errcode='55000', message='SALES_ROLE_STOP_INHERITED_TABLE_OR_COLUMN_GRANTS';
      end if;
    end loop;
    if has_schema_privilege(api,'bi_import_private','USAGE') then
      raise exception using errcode='55000', message='SALES_ROLE_STOP_PRIVATE_SCHEMA_EXPOSURE';
    end if;
  end loop;
end
$hardening$;
rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.
