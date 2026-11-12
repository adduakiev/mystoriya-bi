-- REVIEW / READ ONLY. No function bodies, cron commands, source/customer rows,
-- credentials or settings values are emitted. Do not call any writer/trigger.
-- Catalog snapshot only: external clients, in-flight jobs and future grants need
-- independent review. This file is not authorization to query production.
begin read only;
set local statement_timeout = '30s';
select current_timestamp observed_at, current_database() database_name,
  current_user observer, current_setting('server_version') server_version;

select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls
from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname;
-- Includes indirect and NOINHERIT memberships; SET ROLE may still be a bypass.
select api.rolname api_role, parent.rolname member_of, parent.rolsuper,parent.rolbypassrls
from pg_roles api cross join pg_roles parent
where api.rolname in ('anon','authenticated','service_role')
  and api.oid<>parent.oid and pg_has_role(api.oid,parent.oid,'MEMBER')
order by 1,2;
select pg_get_userbyid(roleid) parent_role,pg_get_userbyid(member) member_role,
  admin_option,inherit_option,set_option from pg_auth_members order by 1,2;

select n.nspname,pg_get_userbyid(n.nspowner) owner,r.rolname api_role,
  has_schema_privilege(r.oid,n.oid,'USAGE') usage,has_schema_privilege(r.oid,n.oid,'CREATE') create_objects
from pg_namespace n cross join pg_roles r
where n.nspname in ('public','bi_import_private') and r.rolname in ('anon','authenticated','service_role') order by 1,3;

-- Public is inventoried broadly so unknown Sales views/tables are visible;
-- candidate revocations themselves are restricted to explicit Sales objects.
select n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) owner,
  c.relrowsecurity,c.relforcerowsecurity,r.rolname api_role,
  has_table_privilege(r.oid,c.oid,'SELECT') can_select,
  has_table_privilege(r.oid,c.oid,'INSERT') can_insert,
  has_table_privilege(r.oid,c.oid,'UPDATE') can_update,
  has_table_privilege(r.oid,c.oid,'DELETE') can_delete,
  has_table_privilege(r.oid,c.oid,'TRUNCATE') can_truncate,
  has_table_privilege(r.oid,c.oid,'REFERENCES,TRIGGER') references_or_trigger,
  has_any_column_privilege(r.oid,c.oid,'INSERT,UPDATE,REFERENCES') column_write
from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r
where n.nspname in ('public','bi_import_private') and c.relkind in ('r','p','v','m','f')
  and r.rolname in ('anon','authenticated','service_role') order by 1,2,7;
select n.nspname,c.relname,a.attname,a.attidentity,a.attgenerated,
  case when acl.grantee=0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end grantee,
  pg_get_userbyid(acl.grantor) grantor,acl.privilege_type,acl.is_grantable
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
cross join lateral aclexplode(a.attacl) acl
where n.nspname in ('public','bi_import_private') order by 1,2,3,5,7;
select n.nspname,c.relname,
  case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end grantee,
  pg_get_userbyid(a.grantor) grantor,a.privilege_type,a.is_grantable
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) a
where n.nspname in ('public','bi_import_private') and c.relkind in ('r','p','v','m','S','f') order by 1,2,3,5;
select n.nspname,c.relname,pg_get_userbyid(c.relowner) owner,r.rolname api_role,
  has_sequence_privilege(r.oid,c.oid,'USAGE') usage,has_sequence_privilege(r.oid,c.oid,'UPDATE') can_update
from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r
where c.relkind='S' and n.nspname in ('public','bi_import_private')
  and r.rolname in ('anon','authenticated','service_role') order by 1,2,4;

select p.oid::regprocedure signature,pg_get_userbyid(p.proowner) owner,
  p.prosecdef security_definer,p.provolatile,r.rolname api_role,
  has_function_privilege(r.oid,p.oid,'EXECUTE') can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join pg_roles r
where n.nspname in ('public','bi_import_private') and p.prokind='f'
  and r.rolname in ('anon','authenticated','service_role') order by 1,5;
select pg_get_userbyid(d.defaclrole) creator,
  case when d.defaclnamespace=0 then '(global)' else d.defaclnamespace::regnamespace::text end schema_name,
  d.defaclobjtype,case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end grantee,
  a.privilege_type,a.is_grantable
from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a order by 1,2,3,4,5;
-- Names/owners/timing only; never print trigger arguments, policy expressions,
-- function definitions, cron SQL or configuration values containing secrets.
select n.nspname,c.relname,t.tgname,t.tgenabled,t.tgfoid::regprocedure function_signature
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname in ('public','bi_import_private') order by 1,2,3;
rollback;
