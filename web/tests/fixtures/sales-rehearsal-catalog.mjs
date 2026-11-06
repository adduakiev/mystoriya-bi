// Portable full definitions/owners/effective privileges; no passwords or OIDs.
const ns = ['public','bi_import_private','extensions','sales_attestor_private','sales_rehearsal_private'].map(s => `'${s}'`).join(',');
export const catalogSQL = `select jsonb_build_object(
  'roles',(select jsonb_agg(to_jsonb(r)-'oid'-'rolpassword' order by rolname) from pg_roles r),
  'memberships',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(roleid),pg_get_userbyid(member),
    pg_get_userbyid(grantor),admin_option,inherit_option,set_option) order by
    pg_get_userbyid(roleid),pg_get_userbyid(member),pg_get_userbyid(grantor)) from pg_auth_members),
  'schemas',(select jsonb_agg(jsonb_build_array(n.nspname,pg_get_userbyid(n.nspowner),
    (select jsonb_agg(jsonb_build_array(r.rolname,has_schema_privilege(r.oid,n.oid,'USAGE'),
      has_schema_privilege(r.oid,n.oid,'CREATE'),has_schema_privilege(r.oid,n.oid,'USAGE WITH GRANT OPTION'),
      has_schema_privilege(r.oid,n.oid,'CREATE WITH GRANT OPTION')) order by r.rolname) from pg_roles r),
    (select jsonb_agg(a.privilege_type order by a.privilege_type)
      from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where a.grantee=0)) order by n.nspname)
    from pg_namespace n where n.nspname in (${ns})),
  'relations',(select jsonb_agg(jsonb_build_object('name',format('%I.%I',n.nspname,c.relname),
    'kind',c.relkind,'options',c.reloptions,'populated',c.relispopulated,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
    'view',case when c.relkind in ('v','m') then pg_get_viewdef(c.oid) end,
    'acl',(select jsonb_agg(jsonb_build_array(r.rolname,
      ${['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'].map(p =>
        `has_table_privilege(r.oid,c.oid,'${p}'),has_table_privilege(r.oid,c.oid,'${p} WITH GRANT OPTION')`).join(',')}) order by r.rolname) from pg_roles r),
    'public_acl',(select jsonb_agg(jsonb_build_array(a.privilege_type,a.is_grantable) order by a.privilege_type)
      from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee=0),
    'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),
      a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid),
      (select jsonb_agg(jsonb_build_array(r.rolname,
        ${['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'].map(p => `has_column_privilege(r.oid,c.oid,a.attnum,'${p}'),has_column_privilege(r.oid,c.oid,a.attnum,'${p} WITH GRANT OPTION')`).join(',')})
        order by r.rolname) from pg_roles r)) order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in (${ns}) and c.relkind in ('r','v','m')),
  'sequences',(select jsonb_agg(jsonb_build_array(to_jsonb(s)-'last_value',pg_get_userbyid(c.relowner),
    (select jsonb_agg(jsonb_build_array(r.rolname,has_sequence_privilege(r.oid,c.oid,'SELECT'),
      has_sequence_privilege(r.oid,c.oid,'USAGE'),has_sequence_privilege(r.oid,c.oid,'UPDATE'),
      has_sequence_privilege(r.oid,c.oid,'SELECT WITH GRANT OPTION'),has_sequence_privilege(r.oid,c.oid,'USAGE WITH GRANT OPTION'),
      has_sequence_privilege(r.oid,c.oid,'UPDATE WITH GRANT OPTION')) order by r.rolname) from pg_roles r))
    order by s.schemaname,s.sequencename) from pg_sequences s join pg_namespace n on n.nspname=s.schemaname
    join pg_class c on c.relnamespace=n.oid and c.relname=s.sequencename where s.schemaname in (${ns})),
  'functions',(select jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,pg_get_userbyid(p.proowner),pg_get_functiondef(p.oid),
    (select jsonb_agg(jsonb_build_array(r.rolname,has_function_privilege(r.oid,p.oid,'EXECUTE'),
      has_function_privilege(r.oid,p.oid,'EXECUTE WITH GRANT OPTION')) order by r.rolname) from pg_roles r),
    (select jsonb_agg(jsonb_build_array(a.privilege_type,a.is_grantable) order by a.privilege_type)
      from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0)) order by p.oid::regprocedure::text)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in (${ns}) and p.prokind='f'),
  'constraints',(select jsonb_agg(jsonb_build_array(conrelid::regclass::text,conname,pg_get_constraintdef(oid))
    order by conrelid::regclass::text,conname) from pg_constraint where connamespace in
      (select oid from pg_namespace where nspname in (${ns}))),
  'indexes',(select jsonb_agg(indexdef order by schemaname,indexname) from pg_indexes where schemaname in (${ns})),
  'triggers',(select jsonb_agg(jsonb_build_array(t.tgrelid::regclass::text,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid))
    order by t.tgrelid::regclass::text,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname in (${ns}) and not t.tgisinternal),
  'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in (${ns})),
  'defaults',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype,
    case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable)
    order by pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype,
      case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type)
    from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace cross join lateral aclexplode(d.defaclacl) a)
)::text;`;
