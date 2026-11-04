import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const draft = read('docs/sql/issue-43-sales-role-hardening-NOT-APPLIED.sql');
const preflight = read('docs/sql/issue-43-sales-role-preflight-READ-ONLY.sql');
const rollback = 'rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.';
const committed = draft.replace(rollback, 'commit;');
const uuid = n => `'00000000-0000-4000-8000-${String(n).padStart(12, '0')}'`;

// Every DML uses an actual writable, non-identity column. INSERTs omit identity
// columns and satisfy NOT NULL/FK/unique/check constraints. The SAME statements
// must mutate one row before revocation, then fail specifically with 42501.
const cases = [
  ['public.dim_date', 'month_name', "'January'", "(date_id,year,quarter,month,month_name,iso_week,week_start,month_start,day_of_week,is_weekend) values('2026-01-02',2026,1,1,'January',1,'2025-12-29','2026-01-01',5,false)"],
  ['public.dim_brand', 'name', "'Updated brand'", "(name) values('Inserted brand')"],
  ['public.dim_ownership', 'name', "'Updated ownership'", "(name) values('Inserted ownership')"],
  ['public.dim_location', 'city', "'Updated city'", "(canonical_name) values('Inserted location')"],
  ['public.dim_channel', 'channel_name', "'Updated channel'", "(channel_group,channel_name) values('Fixture','Inserted channel')"],
  ['public.dim_order_type', 'normalized_group', "'Updated type'", "(name) values('Inserted type')"],
  ['public.fact_sales_daily', 'revenue', '12.34', `(date_id,location_id,brand_id,ownership_id,channel_id,order_type_id,revenue) values('2026-01-01',${uuid(3)},${uuid(1)},${uuid(2)},${uuid(4)},${uuid(6)},5.67)`],
  ['public.import_runs', 'source_name', "'Updated source'", "(source_name) values('Inserted source')"],
  ['public.staging_sales_raw', 'revenue_raw', "'12.34'", `(import_run_id,source_row_number) values(${uuid(7)},2)`],
  ['public.data_quality_issues', 'raw_value', "'Updated raw'", `(import_run_id,issue_type,severity) values(${uuid(7)},'fixture','info')`],
  ['public.map_location_source', 'notes', "'Updated mapping'", "(source_name,canonical_name) values('Inserted alias','Fixture')"],
  ['public.location_lifecycle_registry', 'notes', "'Updated lifecycle'", "(canonical_name,status) values('Inserted location','active')"],
  ['bi_import_private.generation', 'version', 'version+1', '(singleton,version) values(true,1)'],
  ['bi_import_private.sales_runs', 'state', "'committed'", `(id,base_version,expected_rows,raw_rows,expected_batches,revenue,checks,markup,min_date,max_date) values(${uuid(8)},0,1,1,1,1,1,1,'2026-01-01','2026-01-01')`],
  ['bi_import_private.sales_batches', 'payload', "'[]'::jsonb", `(run_id,batch_no,payload) values(${uuid(7)},1,'[]')`]
];
const relations = [...cases.map(([name]) => name), 'public.bi_sales_flat', 'public.bi_sales_flat_mv',
  'public.agg_sales_monthly', 'public.agg_sales_weekly'];
const legacy = ['public.sync_sales_batch(jsonb,uuid)', 'public.finalize_sales_snapshot(uuid)',
  'public.refresh_bi_aggregates()', 'public.bi_trigger_sync(text)'];
const sequences = ['public.fact_sales_daily_id_seq', 'public.staging_sales_raw_id_seq', 'public.data_quality_issues_id_seq'];
const prepared = ['public.begin_sales_snapshot_v2(jsonb)', 'public.stage_sales_batch_v2(uuid,integer,jsonb)',
  'public.commit_sales_snapshot_v2(uuid)', 'public.commit_sales_snapshot_with_evidence_v1(uuid,jsonb)'];
const quote = s => `'${s.replaceAll("'", "''")}'`;

test('Sales ACL review stays rollback-default and separate from deployment', () => {
  assert.ok(draft.endsWith(`${rollback}\n`));
  assert.notEqual(draft, committed);
  assert.match(draft, /NOT APPLIED/);
  assert.match(draft, /message='SALES_ROLE_STOP_DEFAULT_GRANTS'/);
  assert.match(preflight, /begin read only;/);
  assert.doesNotMatch(preflight, /pg_get_functiondef|cron\.job|value_hash|select\s+\*|\b(?:insert|update|delete|grant|revoke|alter|create)\s+(?:into|table|role|function|schema)\b/i);
  for (const [name, col] of cases) assert.notEqual(col, 'id', `${name} cannot test ACLs by updating identity`);
});

// Native disposable PostgreSQL only. No DATABASE_URL/remote server, inherited
// PG settings, fallback, skip, test socket workaround, production bytes or keys.
test('Sales role hardening on disposable native PostgreSQL', { timeout: 240000 }, async t => {
  const bin = [process.env.SALES_TEST_PG_BIN, '/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/16/bin']
    .find(dir => dir && fs.existsSync(path.join(dir, 'initdb')));
  assert.ok(bin, 'Local PostgreSQL required; ACL gate cannot skip');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-role-pg-'));
  const data = path.join(dir, 'data');
  const socket = path.join(dir, 'socket');
  const env = { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', PGCLIENTENCODING: 'UTF8', PGTZ: 'UTC' };
  let started = false;
  const invoke = (tool, args, input) => spawnSync(path.join(bin, tool), args, {
    input, env, encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024
  });
  const ok = (tool, args, input) => {
    const r = invoke(tool, args, input);
    assert.equal(r.status, 0, `${tool}: ${r.error?.code ?? r.status}; ${r.stderr?.slice(-1600)}`);
    return r.stdout.trim();
  };
  const args = ['-X', '-h', socket, '-p', '5432', '-U', 'role_fixture', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-Atq'];
  const sql = input => ok('psql', args, input);
  const denied = (input, state = '42501', message) => {
    const r = invoke('psql', args, input);
    assert.equal(r.status, 3, 'Expected server SQL error, not client/startup failure');
    const error = r.stderr.match(/ERROR:\s+([0-9A-Z]{5}):\s*([^\n]*)/);
    assert.ok(error, `Missing PostgreSQL SQLSTATE: ${r.stderr}`);
    assert.equal(error[1], state, r.stderr);
    if (message) assert.equal(error[2], message);
  };
  const snapshot = () => sql(`select jsonb_build_array(${cases.map(([name]) =>
    `(select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text collate "C") from ${name} x)`).join(',')},
    ${sequences.map(name => `(select jsonb_build_array(last_value,is_called) from ${name})`).join(',')})::text;`);
  const aclSnapshot = () => sql(`select jsonb_build_object(
    'relations',(select jsonb_agg(jsonb_build_array(oid,relacl) order by oid) from pg_class where relnamespace in ('public'::regnamespace,'bi_import_private'::regnamespace)),
    'columns',(select jsonb_agg(jsonb_build_array(attrelid,attnum,attacl) order by attrelid,attnum) from pg_attribute where attrelid in
      (select oid from pg_class where relnamespace in ('public'::regnamespace,'bi_import_private'::regnamespace))),
    'functions',(select jsonb_agg(jsonb_build_array(oid,proacl) order by oid) from pg_proc where pronamespace='public'::regnamespace),
    'schemas',(select jsonb_agg(jsonb_build_array(oid,nspacl) order by oid) from pg_namespace where nspname in ('public','bi_import_private')))::text;`);
  // Each test client transaction disconnects on SQL error, rolling back. Sequence
  // allocation in positive INSERT controls is not transactional. Capture the
  // row AND sequence baseline AFTER positive controls; denials must change neither.
  const dml = ([name, col, value, insert], command, role) => `begin;
    ${command === 'INSERT' && name === 'bi_import_private.generation' ? `delete from ${name};` : ''}
    set local role ${role};
    ${command === 'INSERT' ? `insert into ${name} ${insert}` : command === 'UPDATE'
      ? `update ${name} set ${col}=${value}` : `delete from ${name}`} returning 'MUTATED';
    rollback;`;
  const assertAcls = () => {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const name of relations) {
        assert.equal(sql(`select has_table_privilege('${role}','${name}','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          or has_any_column_privilege('${role}','${name}','INSERT,UPDATE,REFERENCES');`), 'f', `${role}: ${name}`);
        assert.equal(sql(`select bool_or(has_column_privilege('${role}',a.attrelid,a.attnum,'INSERT,UPDATE,REFERENCES'))
          from pg_attribute a where a.attrelid='${name}'::regclass and a.attnum>0 and not a.attisdropped;`), 'f');
      }
      for (const name of legacy) assert.equal(sql(`select has_function_privilege('${role}',${quote(name)},'EXECUTE');`), 'f');
      assert.equal(sql(`select has_schema_privilege('${role}','bi_import_private','USAGE');`), 'f');
    }
    for (const name of relations) assert.equal(sql(`select has_table_privilege('service_role','${name}','SELECT');`), 't');
    for (const name of prepared) assert.equal(sql(`select has_function_privilege('service_role',${quote(name)},'EXECUTE');`), 't');
    assert.equal(sql(`select bool_or(has_sequence_privilege('service_role',oid,'USAGE,UPDATE')) from pg_class
      where relkind='S' and relnamespace='public'::regnamespace;`), 'f');
  };
  try {
    fs.mkdirSync(socket, { mode: 0o700 });
    ok('initdb', ['-D', data, '-A', 'trust', '--no-locale', '--encoding=UTF8', '--no-sync', '-U', 'role_fixture']);
    const log = path.join(dir, 'server.log');
    try {
      ok('pg_ctl', ['-D', data, '-l', log, '-o', `-h '' -p 5432 -k ${socket}`, '-w', 'start']);
      started = true;
    } catch (error) {
      started = fs.existsSync(path.join(data, 'postmaster.pid'));
      throw new Error(`${error.message}; local server: ${fs.readFileSync(log, 'utf8').slice(-1600)}`, { cause: error });
    }
    assert.equal(fs.realpathSync(sql('show data_directory;')), fs.realpathSync(data));
    assert.equal(sql('show listen_addresses;'), '');
    sql('create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;');
    const schema = read('supabase/schema.sql');
    sql(schema.split('insert into map_location_source')[0]);
    sql(schema.match(/create table if not exists location_lifecycle_registry[\s\S]*?\);/)[0]);
    sql('alter table public.location_lifecycle_registry enable row level security;');
    sql(read('supabase/migrations/20261008_warehouse_runtime.sql').split('create or replace function public.bi_sales_snapshot')[0]);
    sql('create materialized view public.bi_sales_flat_mv as select * from public.bi_sales_flat;');
    // Define the real manual-trigger function but NEVER call its body. No cron
    // extension/job/network is provisioned in this fixture.
    sql(read('supabase/migrations/20261012_dashboard_manual_sync.sql').split('create or replace function public.bi_sync_progress')[0]);
    sql(read('docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql').replace(rollback, 'commit;'));
    const gate = read('docs/sql/issue-43-sales-accepted-source-gate-NOT-APPLIED.sql');
    sql(gate.replace(rollback, 'commit;'));
    sql(`insert into public.dim_date values('2026-01-01',2026,1,1,'Fixture',1,'2025-12-29','2026-01-01',4,false);
      insert into public.dim_brand(id,name) values(${uuid(1)},'Fixture');
      insert into public.dim_ownership(id,name) values(${uuid(2)},'Fixture');
      insert into public.dim_location(id,canonical_name) values(${uuid(3)},'Fixture');
      insert into public.dim_channel(id,channel_group,channel_name) values(${uuid(4)},'Fixture','Fixture');
      insert into public.dim_order_type(id,name) values(${uuid(5)},'Fixture'),(${uuid(6)},'Insert-only FK');
      insert into public.import_runs(id,source_name) values(${uuid(7)},'Fixture'),(${uuid(8)},'Insert-only FK');
      insert into public.fact_sales_daily(date_id,location_id,brand_id,ownership_id,channel_id,order_type_id)
        values('2026-01-01',${uuid(3)},${uuid(1)},${uuid(2)},${uuid(4)},${uuid(5)});
      insert into public.staging_sales_raw(import_run_id,source_row_number) values(${uuid(7)},1);
      insert into public.data_quality_issues(import_run_id,issue_type,severity) values(${uuid(7)},'Fixture','info');
      insert into public.map_location_source values('Fixture','Fixture',true,null);
      insert into public.location_lifecycle_registry(canonical_name,status) values('Fixture','active');
      insert into bi_import_private.sales_runs(id,base_version,expected_rows,raw_rows,expected_batches,revenue,checks,markup,min_date,max_date)
        values(${uuid(7)},0,1,1,1,1,1,1,'2026-01-01','2026-01-01');
      insert into bi_import_private.sales_batches values(${uuid(7)},0,'[]');
      grant usage on schema bi_import_private to service_role;
      grant select on all tables in schema public,bi_import_private to service_role;
      grant insert,update,delete,truncate,references,trigger on all tables in schema public,bi_import_private to service_role;
      grant usage,update on all sequences in schema public to service_role;
      grant execute on function public.bi_trigger_sync(text) to anon;
      grant execute on function public.sync_sales_batch(jsonb,uuid),public.finalize_sales_snapshot(uuid) to service_role;
      grant update(revenue),insert(revenue),references(revenue) on public.fact_sales_daily to PUBLIC;
      grant update(revenue_raw) on public.staging_sales_raw to authenticated;
      grant delete on public.data_quality_issues to PUBLIC;`);

    await t.test('RLS does not stop BYPASSRLS; all positive controls execute valid DML', () => {
      assert.equal(sql("select rolbypassrls from pg_roles where rolname='service_role';"), 't');
      assert.equal(sql(`select bool_and(relrowsecurity) from pg_class where oid in
        (${cases.map(([name]) => `${quote(name)}::regclass`).join(',')});`), 't');
      for (const item of cases) for (const command of ['INSERT', 'UPDATE', 'DELETE']) {
        // Parent deletes would have orthogonal FK failures. The deferrable-free
        // fixture clears referencing rows as owner inside the SAME rollback-only
        // transaction before testing deletion of the remaining parent row.
        let input = dml(item, command, 'service_role');
        if (command === 'DELETE') input = input.replace('begin;', `begin; ${deleteDependencies(item[0])}`);
        assert.match(sql(input), /MUTATED/, `${item[0]} ${command} positive control`);
      }
    });
    const baseline = snapshot();
    await t.test('rollback default leaves grants intact; committed fixture denies valid DML with 42501 idempotently', () => {
      const acl = aclSnapshot();
      sql(draft);
      assert.equal(aclSnapshot(), acl, 'Default ROLLBACK changed ACLs');
      assert.match(sql(dml(cases[6], 'UPDATE', 'service_role')), /MUTATED/);
      sql(committed);
      assertAcls();
      const hardened = aclSnapshot();
      sql(committed);
      assert.equal(aclSnapshot(), hardened, 'Replay changed ACLs');
      for (const role of ['service_role', 'anon', 'authenticated']) {
        for (const item of cases) for (const command of ['INSERT', 'UPDATE', 'DELETE']) {
          let input = dml(item, command, role);
          if (command === 'DELETE') input = input.replace('begin;', `begin; ${deleteDependencies(item[0])}`);
          denied(input);
          assert.equal(snapshot(), baseline, `${role} ${item[0]} ${command} mutated rows`);
        }
      }
      // Prove private TABLE ACL denial separately from denied schema USAGE.
      sql('grant usage on schema bi_import_private to service_role;');
      for (const item of cases.filter(([name]) => name.startsWith('bi_import_private.'))) {
        for (const command of ['INSERT', 'UPDATE', 'DELETE']) {
          let input = dml(item, command, 'service_role');
          if (command === 'DELETE') input = input.replace('begin;', `begin; ${deleteDependencies(item[0])}`);
          denied(input);
        }
      }
      sql('revoke usage on schema bi_import_private from service_role;');
      assert.equal(snapshot(), baseline);
      for (const call of ["sync_sales_batch('[]'::jsonb,null::uuid)", 'finalize_sales_snapshot(null::uuid)',
        'refresh_bi_aggregates()', "bi_trigger_sync('fixture')"]) {
        for (const role of ['anon', 'authenticated', 'service_role']) denied(`set role ${role}; select public.${call};`);
      }
      for (const call of ['commit_sales_snapshot_v2(null::uuid)',
        `commit_sales_snapshot_with_evidence_v1(null::uuid,'{"verified":true,"accepted_source_v1":{}}')`]) {
        denied(`set role service_role; select public.${call};`, '55000', 'SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE');
      }
      assert.equal(snapshot(), baseline);
    });

    await t.test('service_role cannot forge accepted-source evidence by valid metadata INSERT or UPDATE', () => {
      const forged = '{"accepted_source_v1":{"verified":true,"sha256":"' + 'a'.repeat(64) + '"}}';
      for (const role of ['anon', 'authenticated', 'service_role']) {
        denied(`set role ${role}; update public.import_runs set details='${forged}'::jsonb where id=${uuid(7)};`);
        denied(`set role ${role}; insert into public.import_runs(source_name,details) values('forged-source','${forged}'::jsonb);`);
      }
      assert.equal(snapshot(), baseline);
    });

    await t.test('owner SECURITY DEFINER reservation/staging retained without promotion or forged acceptance', () => {
      const manifest = '{"rows":1,"raw_rows":1,"batches":1,"revenue":1,"checks":1,"markup":1,"min_date":"2026-01-01","max_date":"2026-01-01"}';
      const row = '[{"accounting_date":"2026-01-01","location_raw":"Synthetic","brand":"Synthetic","ownership":"Owned","channel_group":"Store","order_type":"Sale","revenue":1,"checks":1,"markup":1}]';
      const id = sql(`set role service_role; select public.begin_sales_snapshot_v2('${manifest}');`);
      assert.match(id, /^[0-9a-f-]{36}$/);
      assert.equal(sql(`set role service_role; select public.stage_sales_batch_v2('${id}',0,'${row}');`), '1');
      assert.equal(sql(`select count(*) from bi_import_private.sales_batches where run_id='${id}';`), '1');
      assert.equal(sql(`select proowner=(select oid from pg_roles where rolname='role_fixture') and prosecdef
        from pg_proc where oid='public.begin_sales_snapshot_v2(jsonb)'::regprocedure;`), 't');
      denied(`set role service_role; select public.commit_sales_snapshot_v2('${id}');`, '55000', 'SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE');
      assert.equal(sql(`select count(*) from public.import_runs where details ? 'accepted_source_v1';`), '0');
      assert.equal(sql('select version from bi_import_private.generation;'), '0');
      sql(`delete from bi_import_private.sales_batches where run_id='${id}';
        delete from bi_import_private.sales_runs where id='${id}'; delete from public.import_runs where id='${id}';`);
      assert.equal(snapshot(), baseline);
    });

    await t.test('ordinary API roles can TRUNCATE a fresh FK-free RLS table only while granted', () => {
      // No FK, trigger, policy, identity or BYPASSRLS can mask this boundary.
      // This is a database-privilege control, NOT an HTTP/PostgREST exploit test.
      sql(`create table public.sales_acl_probe(id integer primary key, amount numeric not null);
        insert into public.sales_acl_probe values(1,12.34),(2,56.78);
        alter table public.sales_acl_probe enable row level security;
        grant select,truncate on public.sales_acl_probe to anon,authenticated;`);
      const probeSnapshot = () => sql(`select jsonb_agg(to_jsonb(p) order by id)::text from public.sales_acl_probe p;`);
      const rows = probeSnapshot();
      assert.equal(sql(`select relrowsecurity and not relforcerowsecurity
        and not exists(select from pg_policy where polrelid=c.oid)
        and not exists(select from pg_constraint where contype='f' and (conrelid=c.oid or confrelid=c.oid))
        and not exists(select from pg_trigger where tgrelid=c.oid)
        from pg_class c where oid='public.sales_acl_probe'::regclass;`), 't');
      assert.equal(sql("select bool_or(rolsuper or rolbypassrls) from pg_roles where rolname in ('anon','authenticated');"), 'f');
      for (const role of ['anon', 'authenticated']) {
        assert.equal(sql(`select has_table_privilege('${role}','public.sales_acl_probe','TRUNCATE');`), 't');
        assert.equal(sql(`set role ${role}; select count(*) from public.sales_acl_probe;`), '0', 'RLS must hide all rows');
        assert.equal(sql(`begin; set local role ${role}; truncate public.sales_acl_probe;
          reset role; select count(*) from public.sales_acl_probe; rollback;`), '0', 'TRUNCATE must actually empty the table');
        assert.equal(probeSnapshot(), rows, 'Positive control rollback must restore exact rows');
        assert.equal(snapshot(), baseline, 'Positive control must not touch Sales');
      }
      sql('revoke truncate on public.sales_acl_probe from anon,authenticated;');
      for (const role of ['anon', 'authenticated']) {
        assert.equal(sql(`select has_table_privilege('${role}','public.sales_acl_probe','TRUNCATE');`), 'f');
        denied(`set role ${role}; truncate public.sales_acl_probe;`, '42501', 'permission denied for table sales_acl_probe');
        assert.equal(probeSnapshot(), rows, 'Denied TRUNCATE must preserve exact rows');
        assert.equal(snapshot(), baseline, 'Denied TRUNCATE must preserve Sales row/sequence parity');
      }
      sql('drop table public.sales_acl_probe;');
    });

    await t.test('direct table REVOKE leaves inherited TRUNCATE and column UPDATE effective', () => {
      sql(`create role probe_writer;
        grant probe_writer to authenticated;
        create table public.sales_boundary_probe(id integer primary key, amount numeric not null);
        insert into public.sales_boundary_probe values(1,12.34);
        alter table public.sales_boundary_probe enable row level security;
        create policy probe_read on public.sales_boundary_probe for select using(true);
        create policy probe_update on public.sales_boundary_probe for update using(true) with check(true);
        grant select on public.sales_boundary_probe to authenticated;
        grant truncate on public.sales_boundary_probe to probe_writer;
        grant update(amount) on public.sales_boundary_probe to probe_writer;
        revoke update,truncate on public.sales_boundary_probe from authenticated;`);
      const rows = sql('select row_to_json(p)::text from public.sales_boundary_probe p;');
      assert.equal(sql("select has_table_privilege('authenticated','public.sales_boundary_probe','TRUNCATE');"), 't');
      assert.equal(sql(`begin; set local role authenticated; truncate public.sales_boundary_probe;
        reset role; select count(*) from public.sales_boundary_probe; rollback;`), '0');
      assert.equal(sql("select has_table_privilege('authenticated','public.sales_boundary_probe','UPDATE');"), 'f');
      assert.equal(sql("select has_column_privilege('authenticated','public.sales_boundary_probe','amount','UPDATE');"), 't');
      assert.equal(sql(`begin; set local role authenticated;
        update public.sales_boundary_probe set amount=99 where id=1 returning amount; rollback;`), '99');
      assert.equal(sql('select row_to_json(p)::text from public.sales_boundary_probe p;'), rows);
      sql(`revoke truncate on public.sales_boundary_probe from probe_writer;
        revoke update(amount) on public.sales_boundary_probe from probe_writer;`);
      assert.equal(sql(`select has_table_privilege('authenticated','public.sales_boundary_probe','TRUNCATE')
        or has_any_column_privilege('authenticated','public.sales_boundary_probe','UPDATE');`), 'f');
      for (const command of ['truncate public.sales_boundary_probe', 'update public.sales_boundary_probe set amount=99 where id=1']) {
        denied(`set role authenticated; ${command};`, '42501', 'permission denied for table sales_boundary_probe');
        assert.equal(sql('select row_to_json(p)::text from public.sales_boundary_probe p;'), rows);
        assert.equal(snapshot(), baseline);
      }
      sql('drop table public.sales_boundary_probe; revoke probe_writer from authenticated; drop role probe_writer;');
    });

    await t.test('creator-specific global and public defaults propagate to future objects and preserve strict STOP', () => {
      // Synthetic owners only; no installed postgres/supabase_admin ACL is read
      // or modified. Each owner is relevant to the unchanged draft's target set.
      const defaults = () => sql(`select coalesce(jsonb_agg(to_jsonb(d) order by oid),'[]'::jsonb)::text from pg_default_acl d;`);
      const originalDefaults = defaults();
      const originalAcl = aclSnapshot();
      sql(`create role default_owner;
        grant usage,create on schema public to default_owner;`);
      const controls = [
        ['tables', 'insert,update,delete,truncate', 'table',
          'create table public.sales_default_probe(id integer, amount numeric)',
          role => `has_table_privilege('${role}','public.sales_default_probe','INSERT')
            and has_table_privilege('${role}','public.sales_default_probe','UPDATE')
            and has_table_privilege('${role}','public.sales_default_probe','DELETE')
            and has_table_privilege('${role}','public.sales_default_probe','TRUNCATE')`],
        ['sequences', 'update', 'sequence', 'create sequence public.sales_default_probe',
          role => `has_sequence_privilege('${role}','public.sales_default_probe','UPDATE')`],
        ['functions', 'execute', 'function', "create function public.sales_default_probe() returns integer language sql as 'select 1'",
          role => `has_function_privilege('${role}','public.sales_default_probe()','EXECUTE')`]
      ];
      for (const owner of ['role_fixture', 'default_owner']) {
        sql(`alter table public.dim_brand owner to ${owner};`);
        for (const scope of ['', 'in schema public']) for (const role of ['anon', 'authenticated']) {
          for (const [kind, privileges, object, create, effective] of controls) {
            const label = `${owner}/${scope || 'global'}/${role}/${kind}`;
            const before = defaults();
            sql(`alter default privileges for role ${owner} ${scope} grant ${privileges} on ${kind} to ${role};
              set role ${owner}; ${create}; reset role;`);
            assert.equal(sql(`select ${effective(role)};`), 't', `Default propagation: ${label}`);
            assert.equal(sql(`select has_table_privilege('${role}','public.fact_sales_daily','TRUNCATE');`), 'f',
              `Defaults must not retroactively grant existing Sales table access: ${label}`);
            // REVOKE an existing object's ACL: defaults still endanger future
            // objects, so a scoped revoke must NOT clear the draft's STOP.
            sql(`revoke ${privileges} on ${object} public.sales_default_probe${object === 'function' ? '()' : ''} from ${role};`);
            // Functions have built-in PUBLIC EXECUTE; remove it on this local
            // object too, to isolate explicit future-object defaults.
            if (object === 'function') sql('revoke execute on function public.sales_default_probe() from PUBLIC;');
            assert.equal(sql(`select ${effective(role)};`), 'f', `Existing-object revoke: ${label}`);
            const acl = aclSnapshot();
            const defaultAcl = defaults();
            denied(committed, '55000', 'SALES_ROLE_STOP_DEFAULT_GRANTS');
            assert.equal(aclSnapshot(), acl, `STOP must leave table/column/function/schema ACLs intact: ${label}`);
            assert.equal(defaults(), defaultAcl, `STOP must leave default ACLs intact: ${label}`);
            assert.equal(snapshot(), baseline, `STOP must preserve Sales row/sequence parity: ${label}`);
            sql(`drop ${object} public.sales_default_probe${object === 'function' ? '()' : ''};
              alter default privileges for role ${owner} ${scope} revoke ${privileges} on ${kind} from ${role};`);
            assert.equal(defaults(), before, `Fixture must restore exact default ACLs: ${label}`);
          }
        }
      }
      sql(`alter default privileges for role role_fixture grant truncate on tables to anon;
        alter default privileges for role role_fixture in schema public revoke truncate on tables from anon;
        create table public.sales_default_probe(id integer);`);
      assert.equal(sql("select has_table_privilege('anon','public.sales_default_probe','TRUNCATE');"), 't',
        'Per-schema REVOKE cannot subtract a global default GRANT');
      const acl = aclSnapshot();
      const defaultAcl = defaults();
      denied(committed, '55000', 'SALES_ROLE_STOP_DEFAULT_GRANTS');
      assert.equal(aclSnapshot(), acl);
      assert.equal(defaults(), defaultAcl);
      sql(`drop table public.sales_default_probe;
        alter default privileges for role role_fixture revoke truncate on tables from anon;`);
      sql(`alter table public.dim_brand owner to role_fixture;
        revoke usage,create on schema public from default_owner; drop role default_owner;`);
      assert.equal(defaults(), originalDefaults);
      assert.equal(aclSnapshot(), originalAcl);
      assert.equal(snapshot(), baseline);
      sql(committed);
      assertAcls();
    });

    await t.test('inherited/table/column/RPC/sequence/default/ownership hazards STOP and roll back all revokes', () => {
      sql('create role inherited_writer; grant inherited_writer to service_role;');
      const hazards = [
        ["create function public.sync_sales_batch(jsonb) returns integer language sql security definer as 'select 1';",
          'drop function public.sync_sales_batch(jsonb);', 'UNREVIEWED_RPC_OVERLOAD'],
        ['grant inherited_writer to service_role with inherit false; grant update on public.fact_sales_daily to inherited_writer;',
          'revoke update on public.fact_sales_daily from inherited_writer; grant inherited_writer to service_role with inherit true;', 'INHERITED_TABLE_OR_COLUMN_GRANTS'],
        ['grant update on public.fact_sales_daily to inherited_writer;', 'revoke update on public.fact_sales_daily from inherited_writer;', 'INHERITED_TABLE_OR_COLUMN_GRANTS'],
        ['grant update(revenue) on public.fact_sales_daily to inherited_writer;', 'revoke update(revenue) on public.fact_sales_daily from inherited_writer;', 'INHERITED_TABLE_OR_COLUMN_GRANTS'],
        ['grant execute on function public.bi_trigger_sync(text) to inherited_writer;', 'revoke execute on function public.bi_trigger_sync(text) from inherited_writer;', 'INHERITED_RPC_GRANTS'],
        ['grant usage on sequence public.fact_sales_daily_id_seq to inherited_writer;', 'revoke usage on sequence public.fact_sales_daily_id_seq from inherited_writer;', 'INHERITED_SEQUENCE_GRANTS'],
        ['alter default privileges grant update on tables to PUBLIC;', 'alter default privileges revoke update on tables from PUBLIC;', 'DEFAULT_GRANTS'],
        ['alter default privileges in schema public grant insert on tables to inherited_writer;', 'alter default privileges in schema public revoke insert on tables from inherited_writer;', 'DEFAULT_GRANTS'],
        ['grant create on schema public to service_role;', 'revoke create on schema public from service_role;', 'SCHEMA_CREATE'],
        ['grant role_fixture to service_role;', 'revoke role_fixture from service_role;', 'ELEVATED_MEMBERSHIP'],
        ['alter table public.dim_brand owner to inherited_writer;', 'alter table public.dim_brand owner to role_fixture;', 'OWNER_MEMBERSHIP']
      ];
      for (const [setup, cleanup, gate] of hazards) {
        sql(setup);
        const acl = aclSnapshot();
        denied(committed, '55000', `SALES_ROLE_STOP_${gate}`);
        assert.equal(aclSnapshot(), acl, `Partial revoke survived ${gate}`);
        sql(cleanup);
      }
      // Original atomic body alone must never be hardened into a releasable path.
      sql(`create or replace function public.commit_sales_snapshot_v2(p_run_id uuid) returns jsonb
        language plpgsql security invoker set search_path=pg_catalog as $$begin return '{}'::jsonb; end$$;`);
      denied(committed, '55000', 'SALES_ROLE_STOP_REJECTION_OVERLAY_REQUIRED');
      sql(gate.match(/create or replace function public.commit_sales_snapshot_v2[\s\S]*?end \$\$;/)[0]);
      sql(committed);
      assertAcls();
      // Executes catalog-only script against synthetic objects, not production.
      sql(preflight);
      assert.equal(snapshot(), baseline);
    });
    console.log(`Sales role ACL native PASS; PostgreSQL ${sql('show server_version;')}; valid DML positive/42501 controls, independent ACLs and row parity. Production NOT APPLIED.`);
  } finally {
    if (started) ok('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function deleteDependencies(name) {
  const fact = 'delete from public.fact_sales_daily;';
  if (['public.dim_date', 'public.dim_location', 'public.dim_brand', 'public.dim_ownership', 'public.dim_channel', 'public.dim_order_type'].includes(name)) return fact;
  if (name === 'public.import_runs') return `delete from bi_import_private.sales_batches; delete from bi_import_private.sales_runs; ${fact}`;
  if (name === 'bi_import_private.sales_runs') return 'delete from bi_import_private.sales_batches;';
  return '';
}
