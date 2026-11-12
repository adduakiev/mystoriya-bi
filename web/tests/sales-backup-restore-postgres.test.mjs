import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareSalesRecovery } from '../../supabase/functions/sync-google-sheet/prepared-sales-recovery.mjs';

const root = new URL('../../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const rollback = 'rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.';
const literal = value => `'${value.replaceAll("'", "''")}'::jsonb`;

// Native logical backup rehearsal ONLY. No remote host, DATABASE_URL, production
// export, shell, inherited PG settings, skip, or fallback to a mocked database.
test('synthetic Sales native backup restores an isolated cluster and survives failed/cancelled mutations', {
  timeout: 240000
}, () => {
  const bin = [process.env.SALES_TEST_PG_BIN, '/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/16/bin']
    .find(dir => dir && fs.existsSync(path.join(dir, 'initdb')));
  assert.ok(bin, 'Local PostgreSQL binaries required; restore gate cannot skip');
  for (const tool of ['initdb', 'pg_ctl', 'psql', 'pg_dump', 'pg_restore']) {
    assert.ok(fs.existsSync(path.join(bin, tool)), `Missing native ${tool}; restore gate cannot skip`);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-restore-pg-'));
  const archive = path.join(dir, 'synthetic.dump');
  const clusters = ['before', 'restored'].map(name => ({
    data: path.join(dir, name), socket: path.join(dir, `${name}-socket`), started: false
  }));
  const env = { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', PGCLIENTENCODING: 'UTF8', PGTZ: 'UTC' };
  const invoke = (tool, args, input) => spawnSync(path.join(bin, tool), args, {
    env, input, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024
  });
  const ok = (tool, args, input) => {
    const result = invoke(tool, args, input);
    // Bounded diagnostics from synthetic clusters only; never print input/dump.
    assert.equal(result.status, 0, `${tool}: ${result.error?.code ?? result.status}; ${result.stderr?.slice(-1500)}`);
    return result.stdout.trim();
  };
  const args = c => ['-h', c.socket, '-p', '5432', '-U', 'restore_fixture', '-d', 'postgres'];
  const sql = (c, input) => ok('psql', ['-X', ...args(c), '-v', 'ON_ERROR_STOP=1', '-Atq'], input);
  const start = c => {
    fs.mkdirSync(c.socket, { mode: 0o700 });
    ok('initdb', ['-D', c.data, '-A', 'trust', '--no-locale', '--encoding=UTF8', '--no-sync', '-U', 'restore_fixture']);
    const log = path.join(c.data, 'fixture.log');
    try {
      // TCP is disabled. Each client has an explicit fresh local socket path.
      ok('pg_ctl', ['-D', c.data, '-l', log, '-o', `-h '' -p 5432 -k ${c.socket}`, '-w', 'start']);
      c.started = true;
    } catch (error) {
      c.started = fs.existsSync(path.join(c.data, 'postmaster.pid'));
      throw new Error(`${error.message}; local server: ${fs.readFileSync(log, 'utf8').slice(-1500)}`, { cause: error });
    }
    assert.equal(fs.realpathSync(sql(c, 'show data_directory;')), fs.realpathSync(c.data));
    assert.equal(sql(c, 'show listen_addresses;'), '');
    // pg_dump does not export cluster roles. Only fixed, credential-free fixture
    // roles are provisioned on BOTH sides, with ownership/ACL restoration enabled.
    sql(c, 'create role anon; create role authenticated; create role service_role;');
  };
  const [before, restored] = clusters;
  // Every fixture table, MV, ordinary view and sequence is enumerated dynamically.
  // Canonical C ordering of full row JSON hashes preserves duplicates and nulls;
  // only counts and SHA-256 digests leave PostgreSQL (bounded client output).
  const parity = c => {
    const relations = JSON.parse(sql(c, `select json_agg(x order by name) from (
      select format('%I.%I',n.nspname,c.relname) name,c.relkind kind
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','bi_import_private') and c.relkind in ('r','m','v','S')
    ) x;`));
    const rows = relations.map(({ name, kind }) => ({ name, kind, proof: JSON.parse(sql(c, `
      select json_build_object('count',count(*)::text,'sha256',
        encode(sha256(convert_to(coalesce(string_agg(h,'' order by h collate "C"),''),'UTF8')),'hex'))
      from (select encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex') h
        from ${kind === 'S' ? `(select last_value,is_called from ${name})` : name} x) s;`)) }));
    // Compare portable definitions, not OIDs, dump ordering, or sequence log_cnt
    // (a physical WAL preallocation detail, not logical sequence state).
    const schema = sql(c, `select encode(sha256(convert_to(jsonb_build_object(
      'relations',(select jsonb_agg(jsonb_build_object('name',format('%I.%I',n.nspname,c.relname),
        'owner',pg_get_userbyid(c.relowner),'acl',(select jsonb_agg(jsonb_build_array(
          pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
          a.privilege_type,a.is_grantable) order by a.grantor,a.grantee,a.privilege_type)
          from aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) a),
        'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
        'options',c.reloptions,'populated',c.relispopulated,
        'view',case when c.relkind in ('v','m') then pg_get_viewdef(c.oid) end,
        'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),
          a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
          from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
          where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) order by n.nspname,c.relname)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','bi_import_private') and c.relkind in ('r','m','v','S')),
      'schemas',(select jsonb_agg(jsonb_build_array(nspname,pg_get_userbyid(nspowner),
        (select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),
          case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable)
          order by a.grantor,a.grantee,a.privilege_type) from aclexplode(coalesce(nspacl,acldefault('n',nspowner))) a)) order by nspname)
        from pg_namespace where nspname in ('public','bi_import_private','extensions')),
      'functions',(select jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,pg_get_userbyid(p.proowner),
        (select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),
          case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable)
          order by a.grantor,a.grantee,a.privilege_type) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),
        pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text)
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in ('public','bi_import_private') and p.prokind='f'),
      'indexes',(select jsonb_agg(indexdef order by schemaname,indexname) from pg_indexes
        where schemaname in ('public','bi_import_private')),
      'constraints',(select jsonb_agg(jsonb_build_array(conrelid::regclass::text,conname,pg_get_constraintdef(oid))
        order by conrelid::regclass::text,conname) from pg_constraint
        where connamespace in ('public'::regnamespace,'bi_import_private'::regnamespace)),
      'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p
        where schemaname in ('public','bi_import_private')),
      'sequences',(select jsonb_agg(to_jsonb(s)-'last_value' order by schemaname,sequencename) from pg_sequences s
        where schemaname in ('public','bi_import_private'))
      )::text,'UTF8')),'hex');`);
    assert.match(schema, /^[a-f0-9]{64}$/, 'Missing schema parity evidence');
    return { rows, schema };
  };
  const metricProof = c => sql(c, `select json_build_object(
    'identities', (select encode(sha256(convert_to(string_agg(to_jsonb(x)::text,E'\n' order by to_jsonb(x)::text collate "C"),'UTF8')),'hex')
      from (select f.date_id,l.canonical_name,b.name brand,o.name ownership,c.channel_group,c.channel_name,t.name order_type,
        (f.revenue*100)::numeric(30,0)::text cents,(f.markup*100)::numeric(30,0)::text markup_cents,f.checks::text checks
        from public.fact_sales_daily f join public.dim_location l on l.id=f.location_id
        join public.dim_brand b on b.id=f.brand_id join public.dim_ownership o on o.id=f.ownership_id
        join public.dim_channel c on c.id=f.channel_id join public.dim_order_type t on t.id=f.order_type_id) x),
    'totals',(select json_agg(x order by name) from (
      ${['fact_sales_daily', 'bi_sales_flat', 'bi_sales_flat_mv', 'agg_sales_monthly', 'agg_sales_weekly'].map(name =>
        `select '${name}' name,sum(revenue)::text revenue,sum(checks)::text checks,sum(markup)::text markup from public.${name}`).join(' union all ')}
    ) x));`);
  const guards = c => {
    sql(c, `do $$begin
      if has_function_privilege('service_role','public.sync_sales_batch(jsonb,uuid)','execute') or
        has_function_privilege('service_role','public.finalize_sales_snapshot(uuid)','execute') or
        has_schema_privilege('service_role','bi_import_private','usage') then raise exception 'RESTORED_BYPASS';end if;
      begin
        set local role service_role;
        perform public.commit_sales_snapshot_v2(null);
        raise exception 'RESTORED_OLD_GATE_OPEN';
      exception when sqlstate '55000' then
        if sqlerrm <> 'SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE' then raise;end if;
      end;
      begin
        set local role service_role;
        perform public.commit_sales_snapshot_with_evidence_v1(null,'{"verified":true}');
        raise exception 'RESTORED_EVIDENCE_GATE_OPEN';
      exception when sqlstate '55000' then
        if sqlerrm <> 'SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE' then raise;end if;
      end;
      if has_function_privilege('anon','public.commit_sales_snapshot_v2(uuid)','execute') or
        has_function_privilege('authenticated','public.commit_sales_snapshot_with_evidence_v1(uuid,jsonb)','execute')
        then raise exception 'RESTORED_PUBLIC_EXECUTE';end if;
    end$$;`);
  };
  try {
    start(before);
    sql(before, 'create schema extensions;');
    const schema = read('supabase/schema.sql');
    const runtime = read('supabase/migrations/20261008_warehouse_runtime.sql');
    sql(before, schema.split('insert into map_location_source')[0]);
    sql(before, schema.match(/create table if not exists location_lifecycle_registry[\s\S]*?\);/)[0]);
    sql(before, 'alter table public.location_lifecycle_registry enable row level security;');
    sql(before, runtime.split('create or replace function public.bi_sales_snapshot')[0]);
    // Same flat-cache MV shape as the atomic harness; actual repository refresh.
    sql(before, 'create materialized view public.bi_sales_flat_mv as select * from public.bi_sales_flat;');
    const refresh = read('supabase/migrations/20261009_performance_tuning_flat_cache.sql')
      .match(/CREATE OR REPLACE FUNCTION public.refresh_bi_aggregates\(\)[\s\S]*?\$function\$\n;/)[0];
    sql(before, refresh);
    const atomic = read('docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql');
    const gate = read('docs/sql/issue-43-sales-accepted-source-gate-NOT-APPLIED.sql');
    assert.ok(atomic.includes(rollback) && gate.includes(rollback), 'Drafts must remain rollback-default');
    sql(before, atomic.replace(rollback, 'commit;'));
    sql(before, `insert into public.map_location_source values('Synthetic alias','Synthetic location',true,null);
      insert into public.location_lifecycle_registry(canonical_name,status,lfl_exclude,close_date,notes)
        values('Synthetic location','closed',true,'2026-10-31',null);`);
    const header = ['', '', '', '', '', 'Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка', 'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
    const matrix = [header, ...Array.from({ length: 120 }, (_, i) => ['', '', '', '', '',
      new Date(Date.UTC(2024 + Math.floor(i / 40), 9, 1 + i % 30)).toISOString().slice(0, 10),
      i % 2 ? 'Synthetic alias' : `Synthetic-${i % 40}`, i < 80 ? 'Historical fixture' : 'Rebrand fixture',
      'Owned', 'Заклад', 'Sale', i === 0 ? '90071992547409.91' : '0.10', '1', '-0.03'])];
    const prepared = prepareSalesRecovery(matrix, { previous: { rawRows: 1, minDate: '2024-10-01', maxDate: '2024-10-01' }, now: new Date('2026-10-31T00:00:00Z') });
    assert.equal(JSON.parse(prepared.manifestJson).raw_rows, 120);
    assert.equal(JSON.parse(prepared.manifestJson).rows, 105);
    const run = sql(before, `select public.begin_sales_snapshot_v2(${literal(prepared.manifestJson)});`);
    for (const batch of prepared.batches) sql(before, `select public.stage_sales_batch_v2('${run}',${batch.batchNo},${literal(batch.json)});`);
    sql(before, `select public.commit_sales_snapshot_v2('${run}');`);
    // Include a nonempty private staging reservation AND raw staging/DQ history.
    const pending = sql(before, `select public.begin_sales_snapshot_v2(${literal(prepared.manifestJson)});`);
    sql(before, `select public.stage_sales_batch_v2('${pending}',0,${literal(prepared.batches[0].json)});
      insert into public.import_runs(id,source_name,status,rows_read,rows_loaded,rows_rejected,finished_at,details)
        values('00000000-0000-4000-8000-000000000001','synthetic-only','failed',1,0,1,now(),'{"synthetic_failure":true}');
      insert into public.staging_sales_raw(import_run_id,source_row_number,revenue_raw,source_payload)
        values('${pending}',1,null,'{"synthetic":true}');
      insert into public.data_quality_issues(import_run_id,source_row_number,issue_type,severity,raw_value)
        values('${pending}',1,'synthetic-missing','error',null);`);
    // Only a pre-overlay synthetic candidate can promote. Archive BOTH closed
    // commit routes; never invent accepted_source_v1 or install an attestor/root.
    sql(before, gate.replace(rollback, 'commit;'));
    guards(before);
    const baseline = parity(before);
    const metrics = metricProof(before);
    for (const totals of JSON.parse(metrics).totals) {
      assert.equal(totals.revenue, '90071992547421.81');
      assert.equal(totals.checks, '120.00');
      assert.equal(totals.markup, '-3.60');
    }
    for (const name of ['public.fact_sales_daily', 'public.import_runs', 'public.staging_sales_raw',
      'public.dim_date', 'public.dim_brand', 'public.dim_ownership', 'public.dim_location', 'public.dim_channel', 'public.dim_order_type',
      'public.map_location_source', 'public.location_lifecycle_registry', 'public.data_quality_issues',
      'bi_import_private.sales_runs', 'bi_import_private.sales_batches', 'bi_import_private.generation']) {
      assert.ok(BigInt(baseline.rows.find(row => row.name === name)?.proof.count ?? '0') > 0n, `${name} must have parity evidence`);
    }
    assert.equal(baseline.rows.filter(row => row.kind === 'm').length, 3);
    assert.equal(baseline.rows.find(row => row.name === 'public.fact_sales_daily').proof.count,
      String(JSON.parse(prepared.manifestJson).rows));
    assert.equal(baseline.rows.find(row => row.name === 'public.import_runs').proof.count, '3');
    assert.equal(sql(before, 'select min(date_id)||\'|\'||max(date_id) from public.fact_sales_daily;'), '2024-10-01|2026-10-30');
    assert.equal(sql(before, 'select version from bi_import_private.generation;'), '1');
    assert.equal(sql(before, "select count(*) from public.import_runs where details ? 'accepted_source_v1';"), '0');
    assert.equal(sql(before, `select count(distinct b.name) from public.fact_sales_daily f
      join public.dim_location l on l.id=f.location_id join public.dim_brand b on b.id=f.brand_id
      where l.canonical_name='Synthetic location';`), '2');
    ok('pg_dump', [...args(before), '--format=custom', '--file', archive]);
    assert.ok(fs.statSync(archive).size > 0, 'Native archive missing');
    // Shut down the source before restoring: restore cannot read its live rows.
    ok('pg_ctl', ['-D', before.data, '-m', 'fast', '-w', 'stop']); before.started = false;
    start(restored);
    assert.notEqual(fs.realpathSync(before.data), fs.realpathSync(restored.data));
    ok('pg_restore', [...args(restored), '--exit-on-error', '--single-transaction', archive]);
    assert.deepEqual(parity(restored), baseline, 'Complete schema/data/sequence parity after native restore');
    assert.equal(metricProof(restored), metrics, 'Historical identity and exact cents restored');
    guards(restored);
    // Owner-only synthetic corruption probe, not an importer/bypass. UPDATE
    // avoids PostgreSQL's intentionally nontransactional sequence allocation.
    const mutation = `update public.fact_sales_daily set revenue=revenue+0.01;
      update public.dim_location set city='Synthetic mutation';
      update public.map_location_source set notes='Synthetic mutation';
      update public.location_lifecycle_registry set lfl_exclude=false;
      update public.import_runs set status='failed',details='{"mutated":true}';
      update public.staging_sales_raw set revenue_raw='mutated';
      update bi_import_private.sales_runs set state='committed';
      update bi_import_private.sales_batches set payload='[]';
      update bi_import_private.generation set version=version+1;
      select public.refresh_bi_aggregates();`;
    for (const [label, input, expected] of [
      ['failure', `begin; ${mutation} do $$begin raise exception 'SYNTHETIC_RESTORE_FAILURE';end$$; commit;`, /SYNTHETIC_RESTORE_FAILURE/],
      ['cancellation', `begin; ${mutation} set statement_timeout='250ms'; select pg_sleep(20); commit;`, /57014: canceling statement due to statement timeout/]
    ]) {
      const result = invoke('psql', ['-X', ...args(restored), '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-Atq'], input);
      assert.equal(result.status, 3, `${label} must fail in PostgreSQL, not time out in the client`);
      assert.match(result.stderr, expected);
      assert.deepEqual(parity(restored), baseline, `${label} corrupted restored baseline`);
      assert.equal(metricProof(restored), metrics);
      guards(restored);
    }
    console.log(`Synthetic native pg_dump/pg_restore PASS; PostgreSQL ${sql(restored, 'show server_version;')}; ${baseline.rows.length} relations/sequences; source stopped; failure/cancellation parity PASS. Production restore NOT PERFORMED.`);
  } finally {
    // Attempt cleanup for both clusters even if one stop fails. Never remove
    // data while a fixture server may still be running.
    const errors = [];
    for (const c of clusters) if (c.started) {
      try { ok('pg_ctl', ['-D', c.data, '-m', 'immediate', '-w', 'stop']); c.started = false; }
      catch (error) { errors.push(error); }
    }
    if (!errors.length) fs.rmSync(dir, { recursive: true, force: true });
    else throw new AggregateError(errors, 'Disposable server cleanup failed');
  }
});
