import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { catalogSQL } from './fixtures/sales-rehearsal-catalog.mjs';

const root = new URL('../../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const draft = read('docs/sql/issue-43-sales-prewrite-gate-NOT-APPLIED.sql');
const rollback = 'rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.';
const committed = draft.replace(rollback, 'commit;');
const proofDraft = read('docs/sql/issue-43-sales-preflight-proof-NOT-APPLIED.sql');
const reason = 'SALES_PREWRITE_INDEPENDENT_SOURCE_ROOT_AND_IDENTITY_POLICY_UNAVAILABLE';
const q = value => `'${String(value).replaceAll("'", "''")}'`;
const json = value => `${q(JSON.stringify(value))}::jsonb`;
const runId = '00000000-0000-4000-8000-000000000001';
const row = { accounting_date: '2026-10-24', location_raw: 'Synthetic', brand: 'Synthetic',
  ownership: 'Owned', channel_group: 'Store', order_type: 'Sale', revenue: 12.34, checks: 1, markup: -0.03 };
const manifest = { rows: 1, raw_rows: 1, batches: 1, revenue: 12.34, checks: 1, markup: -0.03,
  min_date: row.accounting_date, max_date: row.accounting_date };
const beginCall = `public.begin_sales_snapshot_v2(${json(manifest)})`;
const stageCall = `public.stage_sales_batch_v2('${runId}',0,${json([row])})`;

function error(result, state, message) {
  assert.equal(result.status, 3, `Expected native SQL failure, not startup/client failure: ${result.error ?? ''} ${result.stderr}`);
  const parsed = result.stderr.match(/ERROR:\s+([0-9A-Z]{5}):\s*([^\n]*)/);
  assert.ok(parsed, result.stderr);
  assert.equal(parsed[1], state, result.stderr);
  if (message) assert.equal(parsed[2], message, result.stderr);
}

test('prewrite overlay is rejection-only, rollback-default and disconnected from production', () => {
  assert.ok(draft.endsWith(`${rollback}\n`));
  assert.notEqual(committed, draft);
  assert.ok(proofDraft.endsWith(`${rollback}\n`));
  assert.match(proofDraft, /SYNTHETIC DISPOSABLE DB ONLY/);
  assert.match(proofDraft, /session_user/);
  assert.doesNotMatch(proofDraft, /\b(?:insert\s+into|nextval|setval|create\s+(?:role|schema|sequence))\b/i);
  assert.match(draft, /NOT APPLIED/);
  assert.equal((draft.match(/raise exception using errcode = '55000'/g) ?? []).length, 4);
  assert.doesNotMatch(draft, /\b(?:insert|update|delete|truncate|create\s+(?:table|schema|role|sequence))\b/i);
  for (const file of ['supabase/functions/sync-google-sheet/index.ts', 'web/app/api/data-sync/route.ts',
    'supabase/functions/sync-google-sheet/prepared-sales-transport.mjs', 'scripts/check.mjs', '.github/workflows/astra-runner.yml']) {
    assert.doesNotMatch(read(file), /issue-43-sales-prewrite-gate|SALES_PREWRITE_INDEPENDENT|issue-43-sales-preflight-proof|sales_attestor_private\.preflight/);
  }
  assert.throws(() => error({ status: 0, stderr: '' }, '55000', reason), assert.AssertionError);
  assert.throws(() => error({ status: 3, stderr: 'ERROR:  42702: ambiguous fixture alias' }, '55000', reason), assert.AssertionError);
});

// Mandatory native test. No DATABASE_URL, remote service, mock, skip, or fallback.
// Synthetic acceptance is NOT production source authentication or authorization.
test('pre-first-write rejection on disposable native PostgreSQL', { timeout: 240000 }, async t => {
  const bin = process.env.SALES_TEST_PG_BIN || '/usr/lib/postgresql/16/bin';
  for (const tool of ['initdb', 'pg_ctl', 'psql', 'pg_config']) {
    assert.ok(fs.existsSync(path.join(bin, tool)), `Native PostgreSQL 16/17 required: ${tool}`);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-prewrite-pg-'));
  const data = path.join(dir, 'data');
  const socket = path.join(dir, 'socket');
  const env = { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', PGCLIENTENCODING: 'UTF8', PGTZ: 'UTC' };
  const invoke = (tool, args, input) => spawnSync(path.join(bin, tool), args,
    { input, env, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  const ok = (tool, args, input) => {
    const result = invoke(tool, args, input);
    assert.equal(result.status, 0, `${tool}: ${result.error ?? ''} ${result.stderr}`);
    return result.stdout.trim();
  };
  const args = (role = 'prewrite_fixture') => ['-X', '-h', socket, '-p', '5432', '-U', role,
    '-d', 'sales_attestor_synthetic', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-Atq'];
  const sql = (input, role) => ok('psql', args(role), input);
  const denied = (input, role, state = '55000', message = state === '55000' ? reason : undefined) =>
    error(invoke('psql', args(role), input), state, message);
  // Catalog/ACL proof is collected independently of the SQL under test and row
  // snapshot. Include fixture objects too, without weakening existing coverage.
  const catalog = () => JSON.parse(sql(catalogSQL.replaceAll("'sales_rehearsal_private'",
    "'sales_rehearsal_private','fixture_private'")));
  const rows = () => JSON.parse(sql('select fixture_private.snapshot();'));
  const exact = () => ({ catalog: catalog(), rows: rows() });
  const attempts = () => JSON.parse(sql(`select jsonb_build_object('last_value',w.last_value,'is_called',w.is_called)
    from fixture_private.write_attempts as w;`));
  let started = false;
  try {
    const version = /^PostgreSQL ((?:16|17)\.\d+)(?:\s|$)/.exec(ok('pg_config', ['--version']))?.[1];
    assert.ok(version, 'Selected server must be PostgreSQL 16/17');
    fs.mkdirSync(socket, { mode: 0o700 });
    ok('initdb', ['-D', data, '-A', 'trust', '--no-locale', '--encoding=UTF8', '--no-sync', '-U', 'prewrite_fixture']);
    const log = path.join(dir, 'server.log');
    try {
      ok('pg_ctl', ['-D', data, '-l', log, '-o', `-h '' -p 5432 -k ${socket}`, '-w', 'start']);
      started = true;
    } catch (cause) {
      started = fs.existsSync(path.join(data, 'postmaster.pid'));
      throw new Error(`${cause.message}\n${fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : 'No server log'}`, { cause });
    }
    ok('psql', ['-X', '-h', socket, '-U', 'prewrite_fixture', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
      'create database sales_attestor_synthetic;');
    assert.equal(fs.realpathSync(sql('show data_directory;')), fs.realpathSync(data));
    assert.equal(sql('show listen_addresses;'), '');
    assert.equal(sql('show server_version;').split(' ')[0], version);
    sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create role api_fixture login inherit; grant anon,authenticated,service_role to api_fixture;
      create schema extensions; create schema fixture_private;
      revoke all on schema fixture_private from public,anon,authenticated,service_role;`);
    const schema = read('supabase/schema.sql');
    sql(schema.split('insert into map_location_source')[0]);
    sql(schema.match(/create table if not exists location_lifecycle_registry[\s\S]*?\);/)[0]);
    sql(read('supabase/migrations/20261008_warehouse_runtime.sql').split('create or replace function public.bi_sales_snapshot')[0]);
    sql('create materialized view public.bi_sales_flat_mv as select * from public.bi_sales_flat;');
    sql(read('docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql').replace(rollback, 'commit;'));
    sql(read('docs/sql/issue-43-sales-accepted-source-gate-NOT-APPLIED.sql').replace(rollback, 'commit;'));
    // Direct synthetic seed only: no legacy sync/finalize/import or real data.
    sql(`insert into public.import_runs(id,source_name,status,details) values
        ('${runId}','synthetic-witness','failed','{"synthetic":true}');
      insert into bi_import_private.sales_runs(id,base_version,expected_rows,raw_rows,expected_batches,
        revenue,checks,markup,min_date,max_date) values('${runId}',0,1,1,1,12.34,1,-0.03,'2026-10-24','2026-10-24');
      insert into public.dim_brand(name) values('Synthetic');
      insert into public.dim_ownership(name) values('Owned');
      insert into public.dim_location(canonical_name) values('Synthetic');
      insert into public.dim_channel(channel_group,channel_name) values('Store','Store');
      insert into public.dim_order_type(name) values('Sale');
      insert into public.dim_date values('2026-10-24',2026,4,10,'October',43,'2026-10-19','2026-10-01',6,true);
      insert into public.fact_sales_daily(date_id,location_id,brand_id,ownership_id,channel_id,order_type_id,revenue,checks,markup)
        select '2026-10-24',l.id,b.id,o.id,c.id,ot.id,12.34,1,-0.03 from public.dim_location l
        cross join public.dim_brand b cross join public.dim_ownership o cross join public.dim_channel c cross join public.dim_order_type ot;
      refresh materialized view public.bi_sales_flat_mv;
      refresh materialized view public.agg_sales_monthly;
      refresh materialized view public.agg_sales_weekly;
      create sequence fixture_private.write_attempts;
      create function fixture_private.witness_write() returns trigger language plpgsql security definer
        set search_path=pg_catalog as $$begin
        perform nextval('fixture_private.write_attempts'::regclass);
        if TG_OP='DELETE' then return OLD; end if; return NEW;
      end$$;
      do $$declare relation_record record; begin
        for relation_record in select n.nspname,c.relname from pg_class as c
          join pg_namespace as n on n.oid=c.relnamespace
          where n.nspname in ('public','bi_import_private') and c.relkind='r' loop
          execute format('create trigger fixture_write before insert or update or delete on %I.%I
            for each row execute function fixture_private.witness_write()',relation_record.nspname,relation_record.relname);
          execute format('create trigger fixture_truncate before truncate on %I.%I
            for each statement execute function fixture_private.witness_write()',relation_record.nspname,relation_record.relname);
        end loop;
      end$$;
      create function fixture_private.snapshot() returns jsonb language plpgsql set search_path=pg_catalog as $$
      declare relation_record record; relation_rows jsonb; result jsonb := '{}'::jsonb;
      begin
        for relation_record in select n.nspname,c.relname,c.relkind from pg_class as c
          join pg_namespace as n on n.oid=c.relnamespace
          where n.nspname in ('public','bi_import_private','extensions','fixture_private','sales_attestor_private')
            and c.relkind in ('r','v','m','S') order by n.nspname,c.relname loop
          -- Sequences are NOT row-composite types (42809). Read their native
          -- state explicitly, including is_called before the first nextval.
          if relation_record.relkind='S' then
            execute format('select jsonb_build_object(''last_value'',s.last_value,''is_called'',s.is_called)
              from %I.%I as s',relation_record.nspname,relation_record.relname) into relation_rows;
          else
            execute format('select coalesce(jsonb_agg(to_jsonb(row_record) order by to_jsonb(row_record)::text),''[]''::jsonb)
              from %I.%I as row_record',relation_record.nspname,relation_record.relname) into relation_rows;
          end if;
          result := result || jsonb_build_object(format('%I.%I',relation_record.nspname,relation_record.relname),relation_rows);
        end loop;
        -- Fully qualified aliases avoid PL/pgSQL variable/catalog collisions
        -- (D225 SQLSTATE 42702), including membership ordering columns.
        return jsonb_build_object('relations',result,
          'roles',(select jsonb_agg(to_jsonb(catalog_role_record) order by catalog_role_record.rolname)
            from pg_roles as catalog_role_record),
          'memberships',(select jsonb_agg(to_jsonb(catalog_membership_record)
            order by catalog_membership_record.roleid,catalog_membership_record.member,catalog_membership_record.grantor)
            from pg_auth_members as catalog_membership_record));
      end$$;
      revoke all on all functions in schema fixture_private from public,anon,authenticated,service_role;`);

    await t.test('negative control: old commit-only overlay permits begin/stage write attempts despite rollback', () => {
      assert.deepEqual(attempts(), { last_value: 1, is_called: false });
      for (const [call, expectedAttempts] of [[beginCall, 2], [stageCall, 1]]) {
        const before = exact();
        const prior = attempts();
        sql(`begin; set local role service_role; select ${call}; rollback;`, 'api_fixture');
        const after = exact();
        const next = attempts();
        assert.equal(next.last_value, (prior.is_called ? prior.last_value : 0) + expectedAttempts);
        assert.equal(next.is_called, true);
        // Row rollback alone would conceal this defect. The exact invariant must
        // fail on the nontransactional witness, not on an unrelated SQL error.
        assert.throws(() => assert.deepEqual(after, before), assert.AssertionError);
        const withoutWitness = value => {
          const copy = structuredClone(value);
          delete copy.rows.relations['fixture_private.write_attempts'];
          return copy;
        };
        assert.deepEqual(withoutWitness(after), withoutWitness(before));
      }
    });

    await t.test('review-default rollback preserves exact rows, sequences, schema, roles and ACLs', () => {
      const before = exact();
      sql(draft);
      assert.deepEqual(exact(), before);
      sql(committed);
      const installed = exact();
      sql(committed);
      assert.deepEqual(exact(), installed, 'Overlay replay must be exact/idempotent');
    });

    await t.test('all four routes reject valid/null/fake attestations and role/config bypasses before any writes', () => {
      const baseline = exact();
      const payloads = [null, {}, { verified: true, accepted_source_v1: { verified: true } },
        { root: 'synthetic', historical_root: 'synthetic', authenticated: true, observer: 'owner',
          role: 'service_role', auto_genesis: true, secret: 'synthetic-not-a-secret', bypass: true,
          signature: 'synthetic', independent_reviews: ['a', 'b'], approved: true }];
      const calls = [beginCall, stageCall, 'public.begin_sales_snapshot_v2(null)',
        'public.stage_sales_batch_v2(null,null,null)', `public.commit_sales_snapshot_v2('${runId}')`,
        'public.commit_sales_snapshot_v2(null)', ...payloads.flatMap(payload => [
          `public.begin_sales_snapshot_v2(${json(payload)})`,
          `public.stage_sales_batch_v2('${runId}',0,${json(payload)})`,
          `public.commit_sales_snapshot_with_evidence_v1('${runId}',${json(payload)})`])];
      // Actual LOGIN, inherited role, SET ROLE, owner/superuser, and RLS/JWT/GUC
      // claims all hit the same unconditional STOP. No real secrets are used.
      for (const [login, setup] of [['api_fixture', ''], ['api_fixture', 'set local role service_role;'],
        ['prewrite_fixture', ''], ['prewrite_fixture', `set local row_security=off;
          set local request.jwt.claim.role='service_role'; set local sales.prewrite_verified='true';`]]) {
        for (const call of calls) {
          denied(`begin; ${setup} select ${call};`, login);
          assert.deepEqual(exact(), baseline, `${login}/${setup}/${call} changed rows/sequence/schema/ACLs`);
        }
      }
      for (const role of ['anon', 'authenticated']) {
        for (const call of [beginCall, stageCall, `public.commit_sales_snapshot_v2('${runId}')`,
          `public.commit_sales_snapshot_with_evidence_v1('${runId}','{}')`]) {
          denied(`set role ${role}; select ${call};`, 'api_fixture', '42501', undefined);
          assert.deepEqual(exact(), baseline);
        }
      }
      assert.equal(sql("select to_regnamespace('sales_attestor_private') is null;"), 't', 'No source root or identity policy provisioned');
      console.log(`PREPARE ONLY native PostgreSQL ${version}: synthetic prewrite rejection passed; production NOT APPLIED; NOT READY FOR GATE. Independent final exact-SHA PG16/17 acceptance remains required.`);
    });

    // ONE bounded additional native regression, reusing the full legacy fixture,
    // nontransactional witness and exact catalog/row/ACL snapshots above.
    await t.test('private authenticated preflight decision precedes every possible Sales write', async () => {
      sql(`create role sales_attestor_owner nologin;
        create role sales_reviewer_a login noinherit; create role sales_reviewer_b login noinherit;`);
      sql(read('docs/sql/issue-43-sales-attestor-NOT-APPLIED.sql').replace(rollback, 'commit;'));
      const beforeDraft = exact();
      error(invoke('psql', [...args(), '-d', 'postgres'], proofDraft),
        '55000', 'SALES_PREFLIGHT_DISPOSABLE_FIXTURE_REQUIRED');
      assert.deepEqual(exact(), beforeDraft, 'Wrong-database guard must precede DDL');
      sql(proofDraft);
      assert.deepEqual(exact(), beforeDraft, 'Candidate must default to exact rollback');
      sql(proofDraft.replace(rollback, 'commit;'));
      const asyncSQL = (input, role = 'prewrite_fixture') => new Promise((resolve, reject) => {
        const child = spawn(path.join(bin, 'psql'), args(role), { env, stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
        child.stdout.on('data', b => { stdout += b; });
        child.stderr.on('data', b => { stderr += b; });
        child.on('error', reject);
        child.on('close', status => { clearTimeout(timer); resolve({ status, stdout: stdout.trim(), stderr }); });
        child.stdin.end(input);
      });
      const assertWaitingForLock = async applicationName => {
        for (let i = 0; i < 100; i++) {
          if (sql(`select exists(select from pg_stat_activity where application_name=${q(applicationName)}
            and wait_event_type='Lock');`) === 't') return;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        assert.fail(`${applicationName} did not demonstrably wait for the generation lock`);
      };
      const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
      const digest = char => char.repeat(64);
      const binding = n => ({ kind: 'sales-preflight/synthetic-v1', run_id: id(n),
        prior: { run_id: id(0), receipt_sha256: digest('a'), generation: '0' },
        base_generation: '0', generation: '1', source_identity: 'synthetic:private-sheet:A:N',
        response_sha256: digest('b'), source_sha256: digest('c'),
        manifest_sha256: digest('d'), warehouse_sha256: digest('e') });
      const call = (n = 1, payload = binding(n)) =>
        `select sales_attestor_private.preflight('${id(n)}',${json(payload)});`;
      const rejectExact = (input, role, message, state = '55000') => {
        const before = exact();
        denied(input, role, state, message);
        assert.deepEqual(exact(), before, 'Rejected preflight changed rows/sequences/roles/ACLs');
      };
      sql(`insert into sales_attestor_private.reviewers values
        ('sales_reviewer_a','independent-A'),('sales_reviewer_b','independent-B');`);
      for (let n = 0; n <= 5; n++) {
        sql(`insert into sales_attestor_private.targets values('${id(n)}',${json(binding(n))},
          encode(sha256(convert_to((${json(binding(n))})::text,'UTF8')),'hex'),
          clock_timestamp() ${n === 2 ? '-' : '+'} interval '1 hour');`);
      }
      // Root absent: even a fixture-protected target is insufficient.
      rejectExact(call(), 'sales_reviewer_a', 'SALES_PREFLIGHT_ROOT_UNAVAILABLE');
      sql(`insert into sales_attestor_private.preflight_root values
        (true,'${id(0)}','${digest('a')}',0,'independent-B',clock_timestamp()+interval '1 hour');`);
      // Observe attempts in ALL newly added private tables, including receipts.
      sql(`do $$declare x record; begin
        for x in select tablename from pg_tables where schemaname='sales_attestor_private' loop
          execute format('create trigger fixture_write before insert or update or delete on sales_attestor_private.%I
            for each row execute function fixture_private.witness_write()',x.tablename);
          execute format('create trigger fixture_truncate before truncate on sales_attestor_private.%I
            for each statement execute function fixture_private.witness_write()',x.tablename);
        end loop;
      end$$;`);
      const positive = exact();
      for (let i = 0; i < 2; i++) {
        const result = JSON.parse(sql(call(), 'sales_reviewer_a'));
        assert.equal(result.decision, 'SYNTHETIC_PREFLIGHT_ONLY');
        assert.equal(result.reviewer, 'sales_reviewer_a');
        assert.equal(result.run_id, id(1));
        assert.equal(result.generation, '0');
        assert.equal(result.binding_sha256, sql(`select binding_sha256 from sales_attestor_private.targets where run_id='${id(1)}';`));
        assert.deepEqual(exact(), positive, 'Positive decision MUST NOT write even a receipt/sequence');
      }
      for (const payload of [null, {}, { verified: true, root: binding(1).prior, reviewer: 'sales_reviewer_a' },
        ...Object.keys(binding(1)).map(k => ({ ...binding(1), [k]: null })),
        { ...binding(1), source_identity: 'caller:forged' }, { ...binding(1), extra: 'forged' }]) {
        rejectExact(call(1, payload), 'sales_reviewer_a', 'SALES_PREFLIGHT_UNTRUSTED_BINDING');
      }
      rejectExact(call(99), 'sales_reviewer_a', 'SALES_PREFLIGHT_UNTRUSTED_BINDING');
      rejectExact(call(2), 'sales_reviewer_a', 'SALES_PREFLIGHT_EXPIRED');
      rejectExact(call(), 'sales_reviewer_b', 'SALES_PREFLIGHT_NONINDEPENDENT_REVIEWER');
      rejectExact(call(), 'prewrite_fixture', 'SALES_PREFLIGHT_INDEPENDENT_LOGIN_REQUIRED');
      for (const login of ['api_fixture','sales_reviewer_b']) {
        rejectExact(`set role sales_reviewer_a; ${call()}`, login, undefined, '42501');
        rejectExact(`set session authorization sales_reviewer_a; ${call()}`, login, undefined, '42501');
      }
      for (const role of ['anon','authenticated','service_role']) {
        rejectExact(`set role ${role}; set request.jwt.claim.role='sales_reviewer_a'; ${call()}`,
          'api_fixture', undefined, '42501');
      }
      for (const role of ['anon','authenticated','service_role']) {
        for (const table of ['preflight_root','targets']) {
          rejectExact(`set role ${role}; insert into sales_attestor_private.${table}
            select * from sales_attestor_private.${table};`, 'api_fixture', undefined, '42501');
        }
      }
      for (const table of ['preflight_root','targets','reviewers','receipts','accepted_reviews']) {
        for (const role of ['api_fixture','sales_reviewer_a','sales_reviewer_b']) {
          rejectExact(`insert into sales_attestor_private.${table} select * from sales_attestor_private.${table};`, role, undefined, '42501');
          rejectExact(`truncate sales_attestor_private.${table} cascade;`, role, undefined, '42501');
        }
      }
      rejectExact(`select sales_attestor_private.review('${id(1)}',${json(binding(1))});`,
        'sales_reviewer_a', undefined, '42501');
      // Explicit administrator-only fixture perturbations; never caller/root APIs.
      const rootChange = assignment => sql(`begin;
        alter table sales_attestor_private.preflight_root disable trigger preflight_root_immutable;
        update sales_attestor_private.preflight_root set ${assignment};
        alter table sales_attestor_private.preflight_root enable always trigger preflight_root_immutable; commit;`);
      rootChange(`receipt_sha256='${digest('f')}'`);
      rejectExact(call(), 'sales_reviewer_a', 'SALES_PREFLIGHT_ROOT_OR_GENERATION_MISMATCH');
      rootChange(`receipt_sha256='${digest('a')}',expires_at=clock_timestamp()-interval '1 hour'`);
      rejectExact(call(), 'sales_reviewer_a', 'SALES_PREFLIGHT_EXPIRED');
      rootChange(`expires_at=clock_timestamp()+interval '1 hour',generation=1`);
      rejectExact(call(), 'sales_reviewer_a', 'SALES_PREFLIGHT_ROOT_OR_GENERATION_MISMATCH');
      rootChange('generation=0');
      sql('update bi_import_private.generation set version=1;');
      rejectExact(call(), 'sales_reviewer_a', 'SALES_PREFLIGHT_ROOT_OR_GENERATION_MISMATCH');
      sql('update bi_import_private.generation set version=0;');
      // Same authenticated target cannot replay an already reserved run or receipt.
      sql(`insert into public.import_runs(id,source_name,status) values('${id(3)}','synthetic-replay','failed');
        insert into sales_attestor_private.receipts values('${id(4)}','sales_reviewer_a','independent-A',
          ${json(binding(4))},'${digest('a')}',clock_timestamp(),'${digest('f')}');`);
      for (const n of [0, 3, 4]) rejectExact(call(n), 'sales_reviewer_a', 'SALES_PREFLIGHT_REPLAY');
      // Role membership drift revokes independence, even for the original LOGIN.
      sql('grant service_role to sales_reviewer_a;');
      rejectExact(call(), 'sales_reviewer_a', 'SALES_PREFLIGHT_INDEPENDENT_LOGIN_REQUIRED');
      sql('revoke service_role from sales_reviewer_a;');
      const concurrentBefore = exact();
      const concurrent = await Promise.all([asyncSQL(call(), 'sales_reviewer_a'), asyncSQL(call(), 'sales_reviewer_a')]);
      for (const r of concurrent) assert.equal(r.status, 0, r.stderr);
      assert.equal(concurrent[0].stdout, concurrent[1].stdout);
      assert.deepEqual(exact(), concurrentBefore);
      // Deterministic wait: holder owns generation lock before target expiry is
      // provisioned. Expiry must be evaluated AFTER the blocked preflight wakes.
      const holder = asyncSQL(`set application_name='synthetic-preflight-holder'; begin;
        select version from bi_import_private.generation where singleton for update;
        select pg_sleep(2); commit;`);
      let locked = false;
      for (let i = 0; i < 100; i++) {
        if (sql("select exists(select from pg_stat_activity where application_name='synthetic-preflight-holder' and wait_event='PgSleep');") === 't') { locked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.ok(locked, 'Concurrent generation holder did not acquire lock');
      sql(`begin; alter table sales_attestor_private.targets disable trigger targets_immutable;
        update sales_attestor_private.targets set expires_at=clock_timestamp()+interval '250 milliseconds' where run_id='${id(5)}';
        alter table sales_attestor_private.targets enable always trigger targets_immutable; commit;`);
      const waitingBefore = exact();
      const expiringDecision = asyncSQL(`set application_name='synthetic-expiry-waiter'; ${call(5)}`, 'sales_reviewer_a');
      await assertWaitingForLock('synthetic-expiry-waiter');
      error(await expiringDecision, '55000', 'SALES_PREFLIGHT_EXPIRED');
      const holderResult = await holder;
      assert.equal(holderResult.status, 0, holderResult.stderr);
      assert.deepEqual(exact(), waitingBefore, 'Blocked/expired decision attempted a write');
      const raceBefore = exact();
      const priorAttempts = attempts();
      const writer = asyncSQL(`set application_name='synthetic-generation-writer'; begin;
        update bi_import_private.generation set version=1 where singleton;
        select pg_sleep(2); commit;`);
      let writing = false;
      for (let i = 0; i < 100; i++) {
        if (sql("select exists(select from pg_stat_activity where application_name='synthetic-generation-writer' and wait_event='PgSleep');") === 't') { writing = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.ok(writing, 'Fixture writer did not acquire generation lock');
      const racingDecision = asyncSQL(`set application_name='synthetic-generation-waiter'; ${call()}`, 'sales_reviewer_a');
      await assertWaitingForLock('synthetic-generation-waiter');
      error(await racingDecision, '55000', 'SALES_PREFLIGHT_ROOT_OR_GENERATION_MISMATCH');
      const writerResult = await writer;
      assert.equal(writerResult.status, 0, writerResult.stderr);
      const expectedRace = structuredClone(raceBefore);
      expectedRace.rows.relations['bi_import_private.generation'][0].version = 1;
      expectedRace.rows.relations['fixture_private.write_attempts'] = {
        last_value: (priorAttempts.is_called ? priorAttempts.last_value : 0) + 1, is_called: true };
      assert.deepEqual(exact(), expectedRace, 'Only the explicit fixture writer may mutate generation/sequence');
      sql('update bi_import_private.generation set version=0;');
      // Original four public 55000 bodies remain closed AFTER a positive private
      // decision; actual LOGIN impersonation/JWT claims confer no capability.
      for (const role of ['api_fixture','sales_reviewer_a','sales_reviewer_b']) {
        for (const callSQL of [beginCall, stageCall, `public.commit_sales_snapshot_v2('${runId}')`,
          `public.commit_sales_snapshot_with_evidence_v1('${runId}',${json(binding(1))})`]) {
          rejectExact(`set request.jwt.claim.role='service_role'; select ${callSQL};`, role,
            role === 'api_fixture' ? reason : undefined, role === 'api_fixture' ? '55000' : '42501');
        }
      }
      console.log(`PREPARE ONLY PostgreSQL ${version}: private synthetic preflight writes NOTHING; NOT APPLIED / NOT READY FOR GATE.`);
    });
  } finally {
    if (started) ok('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
