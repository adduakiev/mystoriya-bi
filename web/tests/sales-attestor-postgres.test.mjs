import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const draft = read('docs/sql/issue-43-sales-attestor-NOT-APPLIED.sql');
const rollback = 'rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.';
const committed = draft.replace(rollback, 'commit;');
const q = s => `'${String(s).replaceAll("'", "''")}'`;
const json = x => `${q(JSON.stringify(x))}::jsonb`;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hash = s => createHash('sha256').update(s).digest('hex');
const reviewers = ['sales_reviewer_a', 'sales_reviewer_b'];
const schemas = ['public', 'bi_import_private', 'extensions', 'sales_attestor_private'];
const ns = schemas.map(q).join(',');
const immutable = 'SALES_ATTESTOR_IMMUTABLE';

// Portable catalog definitions + effective ACLs, never raw relacl or cross-cluster
// OIDs. All fixture roles, relations, columns, functions, schema privileges and
// PUBLIC entries are covered. Ownership is compared by role name.
const catalogSQL = `select jsonb_build_object(
  'roles',(select jsonb_agg(to_jsonb(r)-'oid'-'rolpassword' order by rolname) from pg_roles r),
  'memberships',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(roleid),pg_get_userbyid(member),
    pg_get_userbyid(grantor),admin_option,inherit_option,set_option) order by
    pg_get_userbyid(roleid),pg_get_userbyid(member),pg_get_userbyid(grantor)) from pg_auth_members),
  'schemas',(select jsonb_agg(jsonb_build_array(n.nspname,pg_get_userbyid(n.nspowner),
    (select jsonb_agg(jsonb_build_array(r.rolname,has_schema_privilege(r.oid,n.oid,'USAGE'),
      has_schema_privilege(r.oid,n.oid,'CREATE')) order by r.rolname) from pg_roles r),
    (select jsonb_agg(a.privilege_type order by a.privilege_type)
      from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where a.grantee=0)) order by n.nspname)
    from pg_namespace n where n.nspname in (${ns})),
  'relations',(select jsonb_agg(jsonb_build_object('name',format('%I.%I',n.nspname,c.relname),
    'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
    'view',case when c.relkind in ('v','m') then pg_get_viewdef(c.oid) end,
    'acl',(select jsonb_agg(jsonb_build_array(r.rolname,
      ${['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'].map(p =>
        `has_table_privilege(r.oid,c.oid,'${p}'),has_table_privilege(r.oid,c.oid,'${p} WITH GRANT OPTION')`).join(',')}) order by r.rolname) from pg_roles r),
    'public_acl',(select jsonb_agg(jsonb_build_array(a.privilege_type,a.is_grantable) order by a.privilege_type)
      from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee=0),
    'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),
      a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid),
      (select jsonb_agg(jsonb_build_array(r.rolname,
        ${['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'].map(p => `has_column_privilege(r.oid,c.oid,a.attnum,'${p}')`).join(',')})
        order by r.rolname) from pg_roles r)) order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in (${ns}) and c.relkind in ('r','v','m')),
  'sequences',(select jsonb_agg(jsonb_build_array(to_jsonb(s)-'last_value',pg_get_userbyid(c.relowner),
    (select jsonb_agg(jsonb_build_array(r.rolname,has_sequence_privilege(r.oid,c.oid,'SELECT'),
      has_sequence_privilege(r.oid,c.oid,'USAGE'),has_sequence_privilege(r.oid,c.oid,'UPDATE')) order by r.rolname) from pg_roles r))
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

function parseError(r, state, message) {
  assert.equal(r.status, 3, `Expected PostgreSQL error, not client/startup failure: ${r.stderr}`);
  const error = r.stderr.match(/ERROR:\s+([0-9A-Z]{5}):\s*([^\n]*)/);
  assert.ok(error, `Missing native SQLSTATE: ${r.stderr}`);
  assert.equal(error[1], state, r.stderr);
  if (message) assert.equal(error[2], message);
}

test('attestor draft is rollback-default and disconnected from production code and runners', () => {
  assert.ok(draft.endsWith(`${rollback}\n`));
  assert.match(draft, /NOT APPLIED/);
  assert.doesNotMatch(draft, /\b(?:create|alter)\s+role\b|\b(?:public|bi_import_private)\./i);
  for (const name of ['supabase/functions/sync-google-sheet/index.ts', 'web/app/api/data-sync/route.ts',
    'supabase/functions/sync-google-sheet/prepared-sales-transport.mjs', 'scripts/check.mjs', '.github/workflows/astra-runner.yml']) {
    assert.doesNotMatch(read(name), /sales_attestor_private|issue-43-sales-attestor-NOT-APPLIED/);
  }
  // A 0A000-only probe is insufficient: this same assertion parser must reject
  // an actual successful bypass instead of accepting its lack of SQLSTATE.
  assert.throws(() => parseError({ status: 0, stderr: '' }, '42501', immutable), assert.AssertionError);
  assert.throws(() => parseError({ status: 3, stderr: 'ERROR:  0A000: FK' }, '42501', immutable), assert.AssertionError);
});

// Mandatory native, two separate LOGINs and two fresh clusters. No network,
// inherited PG variables, production URL, skip, mock, or single-user replacement.
test('synthetic accepted-source attestor on native PostgreSQL', { timeout: 240000 }, async t => {
  // A configured PG17 runner must never silently fall back to PG16.
  const bin = process.env.SALES_TEST_PG_BIN || '/usr/lib/postgresql/16/bin';
  assert.ok(fs.existsSync(path.join(bin, 'initdb')), 'Configured native PostgreSQL 16/17 required; no fallback or skip');
  for (const tool of ['initdb', 'pg_ctl', 'psql', 'pg_dump', 'pg_restore', 'pg_config']) assert.ok(fs.existsSync(path.join(bin, tool)), tool);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-attestor-pg-'));
  const clusters = ['source', 'restored'].map(name => ({ data: path.join(dir, name), socket: path.join(dir, `${name}-socket`), started: false }));
  const [source, restored] = clusters;
  const env = { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', PGCLIENTENCODING: 'UTF8', PGTZ: 'UTC' };
  const invoke = (tool, args, input) => spawnSync(path.join(bin, tool), args, { env, input, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  const ok = (tool, args, input) => {
    const r = invoke(tool, args, input);
    assert.equal(r.status, 0, `${tool}: ${r.error?.code ?? r.status}; ${r.stderr?.slice(-1600)}`);
    return r.stdout.trim();
  };
  // Trust only the selected binary's native server, with an allowed PG16/17 major.
  const testedPgVersion = /^PostgreSQL ((?:16|17)\.\d+)(?:\s|$)/.exec(ok('pg_config', ['--version']))?.[1];
  assert.ok(testedPgVersion, 'Unsupported native PostgreSQL version; never substitute another major');
  const args = (c, role = 'attestor_fixture') => ['-X', '-h', c.socket, '-p', '5432', '-U', role, '-d', 'sales_attestor_synthetic',
    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-Atq'];
  const sql = (c, input, role) => ok('psql', args(c, role), input);
  const denied = (c, input, role, state = '42501', message) => parseError(invoke('psql', args(c, role), input), state, message);
  const catalog = c => JSON.parse(sql(c, catalogSQL));
  const proof = c => {
    const names = JSON.parse(sql(c, `select coalesce(json_agg(x order by name),'[]') from (
      select format('%I.%I',n.nspname,c.relname) name,c.relkind kind from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in (${ns}) and c.relkind in ('r','v','m','S')) x;`));
    return names.map(({ name, kind }) => ({ name, kind, ...JSON.parse(sql(c, `select json_build_object('count',count(*)::text,
      'sha256',encode(sha256(convert_to(coalesce(string_agg(h,'' order by h collate "C"),''),'UTF8')),'hex'))
      from (select encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex') h from
        ${kind === 'S' ? `(select last_value,is_called from ${name})` : name} x) s;`)) }));
  };
  const exact = c => ({ catalog: catalog(c), rows: proof(c) });
  const start = c => {
    fs.mkdirSync(c.socket, { mode: 0o700 });
    ok('initdb', ['-D', c.data, '-A', 'trust', '--no-locale', '--encoding=UTF8', '--no-sync', '-U', 'attestor_fixture']);
    const log = path.join(c.data, 'fixture.log');
    try {
      ok('pg_ctl', ['-D', c.data, '-l', log, '-o', `-h '' -p 5432 -k ${c.socket}`, '-w', 'start']); c.started = true;
    } catch (e) {
      c.started = fs.existsSync(path.join(c.data, 'postmaster.pid'));
      throw new Error(`${e.message}; local PostgreSQL: ${fs.readFileSync(log, 'utf8').slice(-1600)}`, { cause: e });
    }
    ok('psql', ['-X', '-h', c.socket, '-U', 'attestor_fixture', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
      `create database sales_attestor_synthetic;`);
    assert.equal(fs.realpathSync(sql(c, 'show data_directory;')), fs.realpathSync(c.data));
    assert.equal(sql(c, 'show listen_addresses;'), '');
    assert.equal(sql(c, 'show server_version;').split(' ')[0], testedPgVersion, 'server and selected native pg_config version must agree');
    sql(c, `create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create role sales_attestor_owner nologin;
      create role sales_reviewer_a login noinherit; create role sales_reviewer_b login noinherit;
      create role api_fixture login inherit; grant service_role,anon,authenticated to api_fixture;`);
  };
  const review = (c, n, binding, role) => sql(c,
    `select sales_attestor_private.review('${id(n)}',${json(binding)});`, role);
  const asyncSQL = (c, input, role) => new Promise((resolve, reject) => {
    const child = spawn(path.join(bin, 'psql'), args(c, role), { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
    child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
    child.on('error', reject); child.on('close', status => { clearTimeout(timer); resolve({ status, stdout: stdout.trim(), stderr }); });
    child.stdin.end(input);
  });
  const canonicalRows = [
    ['2026-10-25', 'Synthetic', 'Brand', 'Owned', 'Store', 'Store', 'Sale', '9007199254740991', '1', '-3'],
    ['2026-10-26', 'Synthetic', 'Brand', 'Owned', 'Store', 'Store', 'Sale', '10', '1', '0']
  ];
  const aliases = [['Synthetic alias', 'Synthetic']];
  const binding = n => ({ kind: 'sales-accepted-source-review/synthetic-v1', run_id: id(n),
    prior: { run_id: id(0), receipt_sha256: hash('synthetic prior root ONLY'), generation: '7' },
    base_generation: '7', generation: '8', source_sha256: hash('synthetic source'), raw_rows: '2',
    min_date: '2026-10-25', max_date: '2026-10-26', manifest_sha256: hash('synthetic manifest'),
    warehouse_sha256: hash(JSON.stringify(['sales-warehouse-cents/v1', canonicalRows])),
    mapping_sha256: hash(JSON.stringify(['sales-alias-resolution/v1', aliases])),
    canonical_rows: canonicalRows, aliases });
  const seed = (c, n, expired = false) => sql(c, `insert into sales_attestor_private.targets values
    ('${id(n)}',${json(binding(n))},encode(sha256(convert_to((${json(binding(n))})::text,'UTF8')),'hex'),
    clock_timestamp() ${expired ? '-' : '+'} interval '1 hour');`);
  const guards = c => {
    for (const fn of ['commit_sales_snapshot_v2(null::uuid)', "commit_sales_snapshot_with_evidence_v1(null::uuid,'{\"verified\":true}')"]) {
      denied(c, `select public.${fn};`, 'api_fixture', '55000', 'SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE');
    }
  };
  // BOTH denials independently compare all receipt content hashes/counts and the
  // entire FK-linked accepted_reviews/targets/reviewer rows (plus other tables).
  const truncateLayers = c => {
    const before = exact(c);
    assert.ok(Number(before.rows.find(r => r.name === 'sales_attestor_private.receipts').count) >= 2);
    assert.ok(Number(before.rows.find(r => r.name === 'sales_attestor_private.accepted_reviews').count) > 0);
    denied(c, 'truncate sales_attestor_private.receipts;', undefined, '0A000');
    assert.deepEqual(exact(c), before, 'FK rejection changed exact contents/counts/linked rows');
    denied(c, 'truncate sales_attestor_private.receipts cascade;', undefined, '42501', immutable);
    assert.deepEqual(exact(c), before, 'Trigger rejection changed exact contents/counts/linked rows');
    // The child's guard must not mask a missing receipts guard. An SQL error
    // disconnects this transaction and rolls back the temporary trigger disable.
    denied(c, `begin;
      alter table sales_attestor_private.accepted_reviews disable trigger accepted_reviews_immutable;
      truncate sales_attestor_private.receipts cascade;`, undefined, '42501', immutable);
    assert.deepEqual(exact(c), before, 'Independent receipts guard or trigger rollback failed');
  };
  try {
    start(source);
    sql(source, 'create schema extensions;');
    const schema = read('supabase/schema.sql');
    sql(source, schema.split('insert into map_location_source')[0]);
    sql(source, schema.match(/create table if not exists location_lifecycle_registry[\s\S]*?\);/)[0]);
    sql(source, read('supabase/migrations/20261008_warehouse_runtime.sql').split('create or replace function public.bi_sales_snapshot')[0]);
    sql(source, 'create materialized view public.bi_sales_flat_mv as select * from public.bi_sales_flat;');
    sql(source, read('docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql').replace(rollback, 'commit;'));
    sql(source, read('docs/sql/issue-43-sales-accepted-source-gate-NOT-APPLIED.sql').replace(rollback, 'commit;'));
    // A harmless nonempty exact-cent witness; no legacy import/finalize is called.
    sql(source, `insert into public.import_runs(source_name,status,details) values('synthetic-witness','failed','{"synthetic":true}');`);
    const preDraft = exact(source);
    await t.test('default rollback preserves exact pre-draft roles objects owners grants and rows', () => {
      sql(source, draft);
      assert.deepEqual(exact(source), preDraft);
      assert.equal(sql(source, "select to_regnamespace('sales_attestor_private') is null;"), 't');
      sql(source, committed);
      const installed = catalog(source);
      // Existing namespaces, role settings/memberships/default grants stay exact.
      const withoutDraft = structuredClone(installed);
      for (const field of ['schemas', 'relations', 'sequences', 'functions', 'constraints', 'indexes', 'triggers', 'policies']) {
        withoutDraft[field] = withoutDraft[field]?.filter(x => !JSON.stringify(x).includes('sales_attestor_private')) ?? null;
        if (withoutDraft[field]?.length === 0) withoutDraft[field] = null;
      }
      assert.deepEqual(withoutDraft, preDraft.catalog);
      assert.deepEqual(proof(source).filter(x => !x.name.startsWith('sales_attestor_private.')), preDraft.rows);
      guards(source);
    });
    sql(source, `insert into sales_attestor_private.reviewers values('sales_reviewer_a','independent-A'),('sales_reviewer_b','independent-B');`);
    for (let n = 1; n <= 5; n++) seed(source, n);
    seed(source, 6, true);
    await t.test('separate LOGIN sessions deny impersonation direct writes and untrusted evidence with 42501', () => {
      assert.equal(sql(source, "select rolcanlogin from pg_roles where rolname='service_role';"), 'f');
      assert.equal(sql(source, "select count(*) from pg_auth_members where roleid in (select oid from pg_roles where rolname in ('sales_attestor_owner','sales_reviewer_a','sales_reviewer_b'));"), '0');
      const before = exact(source);
      for (const role of reviewers) {
        assert.equal(sql(source, 'select session_user||\'|\'||current_user;', role), `${role}|${role}`);
        denied(source, 'alter table sales_attestor_private.receipts disable trigger receipts_immutable;', role);
        for (const target of ['sales_attestor_owner', ...reviewers.filter(x => x !== role), 'service_role']) {
          denied(source, `set role ${target};`, role);
          denied(source, `set session authorization ${target};`, role);
        }
        for (const table of ['reviewers', 'targets', 'receipts', 'accepted_reviews']) {
          assert.equal(sql(source, `select has_table_privilege('${role}','sales_attestor_private.${table}',
            'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or
            has_any_column_privilege('${role}','sales_attestor_private.${table}','SELECT,INSERT,UPDATE,REFERENCES');`), 'f');
          denied(source, `insert into sales_attestor_private.${table} select * from sales_attestor_private.${table};`, role);
          for (const op of [`select * from`, `delete from`, `truncate`, `update`]) {
            denied(source, `${op} sales_attestor_private.${table}${op === 'update' ? ` set ${table === 'reviewers' ? 'independence_group=independence_group' : 'run_id=run_id'}` : ''};`, role);
          }
        }
        denied(source, `select sales_attestor_private.review('${id(1)}','{"verified":true}');`, role, '42501', 'SALES_ATTESTOR_UNTRUSTED_BINDING');
        for (const key of Object.keys(binding(1))) {
          const forged = { ...binding(1), [key]: null };
          denied(source, `select sales_attestor_private.review('${id(1)}',${json(forged)});`, role, '42501', 'SALES_ATTESTOR_UNTRUSTED_BINDING');
        }
        denied(source, `select sales_attestor_private.review('${id(99)}',${json(binding(99))});`, role, '42501', 'SALES_ATTESTOR_UNTRUSTED_BINDING');
        denied(source, `select sales_attestor_private.review('${id(6)}',${json(binding(6))});`, role, '42501', 'SALES_ATTESTOR_TARGET_EXPIRED');
      }
      for (const role of ['api_fixture', 'attestor_fixture']) {
        denied(source, `select sales_attestor_private.review('${id(1)}',${json(binding(1))});`, role,
          '42501', role === 'attestor_fixture' ? 'SALES_ATTESTOR_INDEPENDENT_LOGIN_REQUIRED' : undefined);
      }
      // Table ACL denial independently of schema USAGE; service_role is still NOLOGIN.
      sql(source, 'grant usage on schema sales_attestor_private to api_fixture;');
      for (const table of ['reviewers', 'targets', 'receipts', 'accepted_reviews']) {
        denied(source, `delete from sales_attestor_private.${table};`, 'api_fixture');
        assert.equal(sql(source, `select has_table_privilege('service_role','sales_attestor_private.${table}',
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');`), 'f');
      }
      sql(source, 'revoke usage on schema sales_attestor_private from api_fixture;');
      assert.deepEqual(exact(source), before);
      guards(source);
    });
    await t.test('two distinct independent LOGIN sessions produce immutable exact review receipts with idempotent readback', () => {
      const first = review(source, 1, binding(1), reviewers[0]);
      assert.equal(sql(source, 'select count(*) from sales_attestor_private.accepted_reviews;'), '0');
      assert.equal(review(source, 1, binding(1), reviewers[0]), first);
      assert.equal(sql(source, 'select count(*) from sales_attestor_private.receipts;'), '1');
      const second = review(source, 1, binding(1), reviewers[1]);
      for (const [index, receipt] of [first, second].entries()) {
        const r = JSON.parse(receipt);
        assert.equal(r.reviewer, reviewers[index]);
        assert.equal(r.independence_group, `independent-${index ? 'B' : 'A'}`);
        assert.deepEqual(r.binding, binding(1));
        assert.match(r.binding_sha256, /^[a-f0-9]{64}$/);
        assert.match(r.receipt_sha256, /^[a-f0-9]{64}$/);
        assert.equal(sql(source, `select sales_attestor_private.read_receipt('${id(1)}');`, reviewers[index]), receipt);
        assert.equal(review(source, 1, binding(1), reviewers[index]), receipt);
      }
      assert.notEqual(JSON.parse(first).receipt_sha256, JSON.parse(second).receipt_sha256);
      assert.equal(sql(source, `select bool_and(
        receipt_sha256=encode(sha256(convert_to(jsonb_build_array('sales-review-receipt/synthetic-v1',
          run_id,reviewer,independence_group,binding_sha256,observed_at)::text,'UTF8')),'hex')
        and binding_sha256=encode(sha256(convert_to(binding::text,'UTF8')),'hex'))
        from sales_attestor_private.receipts;`), 't');
      assert.equal(sql(source, `select count(*) from sales_attestor_private.accepted_reviews a
        join sales_attestor_private.receipts x on x.receipt_sha256=a.receipt_a_sha256 and x.run_id=a.run_id and x.reviewer=a.reviewer_a
        join sales_attestor_private.receipts y on y.receipt_sha256=a.receipt_b_sha256 and y.run_id=a.run_id and y.reviewer=a.reviewer_b
        where x.binding=y.binding and x.binding_sha256=a.binding_sha256 and y.binding_sha256=a.binding_sha256
          and x.independence_group<>y.independence_group;`), '1');
      const before = exact(source);
      for (const table of ['receipts', 'accepted_reviews']) {
        denied(source, `update sales_attestor_private.${table} set run_id=run_id;`, undefined, '42501', immutable);
        assert.deepEqual(exact(source), before);
        denied(source, `delete from sales_attestor_private.${table};`, undefined, '42501', immutable);
        assert.deepEqual(exact(source), before);
      }
      truncateLayers(source);
    });
    await t.test('negative control detects an ACTUAL trigger bypass even while plain TRUNCATE still fails FK', () => {
      const before = exact(source);
      const result = invoke('psql', args(source), `begin;
        alter table sales_attestor_private.receipts disable trigger receipts_immutable;
        alter table sales_attestor_private.accepted_reviews disable trigger accepted_reviews_immutable;
        do $$begin
          begin
            truncate sales_attestor_private.receipts;
            raise exception 'NEGATIVE_CONTROL_FK_MISSING';
          exception when sqlstate '0A000' then null;end;
          if (select count(*) from sales_attestor_private.receipts)<2 or
            (select count(*) from sales_attestor_private.accepted_reviews)<1 then
            raise exception 'NEGATIVE_CONTROL_FK_CHANGED_ROWS';end if;
        end$$;
        truncate sales_attestor_private.receipts cascade;
        select (select count(*) from sales_attestor_private.receipts)||'|'||(select count(*) from sales_attestor_private.accepted_reviews);
        rollback;`);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), '0|0', 'Negative control did not actually clear both FK-linked tables');
      assert.throws(() => parseError(result, '42501', immutable), assert.AssertionError,
        'Immutability gate accepted a real CASCADE bypass');
      assert.deepEqual(exact(source), before, 'Negative control must roll back disabled triggers and data');
      truncateLayers(source);
    });
    await t.test('concurrent independent reviews and same-reviewer retries serialize without duplicate receipts', async () => {
      const results = await Promise.all([
        asyncSQL(source, `begin; select sales_attestor_private.review('${id(2)}',${json(binding(2))}); select pg_sleep(0.25); commit;`, reviewers[0]),
        asyncSQL(source, `select sales_attestor_private.review('${id(2)}',${json(binding(2))});`, reviewers[1]),
        asyncSQL(source, `select sales_attestor_private.review('${id(2)}',${json(binding(2))});`, reviewers[0])
      ]);
      for (const r of results) assert.equal(r.status, 0, r.stderr);
      assert.equal(sql(source, `select count(*) from sales_attestor_private.receipts where run_id='${id(2)}';`), '2');
      assert.equal(sql(source, `select count(*) from sales_attestor_private.accepted_reviews where run_id='${id(2)}';`), '1');
      assert.equal(results[0].stdout.split('\n')[0], results[2].stdout);
      const before = exact(source);
      denied(source, `select sales_attestor_private.review('${id(2)}',${json({ ...binding(2), generation: '9' })});`, reviewers[0], '42501', 'SALES_ATTESTOR_UNTRUSTED_BINDING');
      assert.deepEqual(exact(source), before);
    });
    await t.test('transaction failure and cancellation roll back both independent receipt and paired readback', () => {
      review(source, 3, binding(3), reviewers[0]);
      const before = exact(source);
      for (const [suffix, state, message] of [
        ["do $$begin raise exception 'SYNTHETIC_REVIEW_FAILURE';end$$;", 'P0001', 'SYNTHETIC_REVIEW_FAILURE'],
        ["set statement_timeout='100ms'; select pg_sleep(5);", '57014', 'canceling statement due to statement timeout']
      ]) {
        denied(source, `begin; select sales_attestor_private.review('${id(3)}',${json(binding(3))}); ${suffix} commit;`, reviewers[1], state, message);
        assert.deepEqual(exact(source), before);
      }
      review(source, 3, binding(3), reviewers[1]);
      truncateLayers(source);
      guards(source);
    });
    await t.test('source-stop native dump/restore preserves exact data owners effective ACLs and immutability', () => {
      const before = exact(source);
      const archive = path.join(dir, 'synthetic.dump');
      ok('pg_dump', ['-h', source.socket, '-U', 'attestor_fixture', '-d', 'sales_attestor_synthetic', '--format=custom', '--file', archive]);
      assert.ok(fs.statSync(archive).size > 0);
      ok('pg_ctl', ['-D', source.data, '-m', 'fast', '-w', 'stop']); source.started = false;
      start(restored);
      assert.notEqual(fs.realpathSync(source.data), fs.realpathSync(restored.data));
      ok('pg_restore', ['-h', restored.socket, '-U', 'attestor_fixture', '-d', 'sales_attestor_synthetic', '--exit-on-error', '--single-transaction', archive]);
      assert.deepEqual(exact(restored), before, 'Native restore data/owner/effective-ACL parity failed');
      for (const role of reviewers) {
        assert.equal(sql(restored, `select sales_attestor_private.read_receipt('${id(1)}');`, role),
          review(restored, 1, binding(1), role));
      }
      truncateLayers(restored);
      guards(restored);
      console.log(`Synthetic attestor native PostgreSQL ${sql(restored, 'show server_version;')}: source stopped; exact row hashes/counts/FK links and owners/effective ACLs restored. Production NOT APPLIED.`);
    });
  } finally {
    const errors = [];
    for (const c of clusters) if (c.started) {
      try { ok('pg_ctl', ['-D', c.data, '-m', 'immediate', '-w', 'stop']); c.started = false; }
      catch (e) { errors.push(e); }
    }
    if (errors.length) throw new AggregateError(errors, 'Disposable attestor server cleanup failed');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
