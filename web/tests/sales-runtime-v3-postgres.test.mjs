import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const candidate = fs.readFileSync(new URL('docs/sql/issue-50-sales-atomic-runtime-NOT-APPLIED.sql', root), 'utf8');
const suffix = process.platform === 'win32' ? '.exe' : '';
const pgBin = [process.env.SALES_TEST_PG_BIN, '/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/16/bin']
  .find(p => p && fs.existsSync(path.join(p, `initdb${suffix}`)));
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

test('v3 release candidate has no enabled policy or existing entrypoint side effect', () => {
  assert.match(candidate, /enabled boolean not null default false/);
  assert.match(candidate, /rollback; -- NOT APPLIED/);
  assert.doesNotMatch(fs.readFileSync(new URL('supabase/functions/sync-google-sheet/index.ts', root), 'utf8'), /handleAtomicSalesRequest/);
});

test('v3 staged replacement is atomic under native PostgreSQL failures and competing writers', {
  timeout: 600000
}, async t => {
  assert.ok(pgBin, 'Native PostgreSQL 16 or 17 required; no synthetic fallback');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-v3-native-'));
  const data = path.join(dir, 'data');
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^PG/i.test(k)));
  env.PGCLIENTENCODING = 'UTF8';
  const run = (name, args, input) => {
    const r = spawnSync(path.join(pgBin, name + suffix), args, { input, encoding: 'utf8', env,
      timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
    if (r.status !== 0) throw Error(`${name}: ${r.error ?? ''}\n${r.stderr}\n${r.stdout}`);
    return r.stdout.trim();
  };
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer(); server.on('error', reject); server.listen(0, '127.0.0.1', () => {
      const p = server.address().port; server.close(() => resolve(p));
    });
  });
  const args = ['-X', '-h', '127.0.0.1', '-p', String(port), '-U', 'v3_fixture', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'];
  const sql = query => run('psql', args, query);
  const asyncSql = query => new Promise(resolve => {
    const p = spawn(path.join(pgBin, 'psql' + suffix), args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', error = ''; p.stdout.on('data', b => output += b); p.stderr.on('data', b => error += b);
    p.on('error', e => resolve({ code: -1, error: String(e) })); p.on('close', code => resolve({ code, output, error })); p.stdin.end(query);
  });
  const row = (name, revenue = 10, channel = 'Заклад', date = '2026-10-30') => ({ accounting_date: date,
    location_raw: name, brand: 'Fixture', ownership: 'Owned', channel_group: channel,
    order_type: 'Sale', revenue, checks: 1, markup: 5 });
  let serial = 0;
  const manifest = rows => {
    const context = JSON.parse(sql('set role service_role; select public.sales_snapshot_context_v3();'));
    return { contract: 'gviz-numeric-canonical-js-number-v1', source_sha256: createHash('sha256').update(String(++serial)).digest('hex'),
      rows: rows.length, raw_rows: rows.length, raw_subcent_cells: 0, batches: Math.ceil(rows.length / 2000),
      revenue: rows.reduce((n, r) => n + r.revenue, 0), checks: rows.reduce((n, r) => n + r.checks, 0),
      markup: rows.reduce((n, r) => n + r.markup, 0), min_date: rows.map(r => r.accounting_date).sort()[0],
      max_date: rows.map(r => r.accounting_date).sort().at(-1), baseline_hash: context.baseline_hash, mapping_hash: context.mapping_hash };
  };
  const begin = rows => sql(`set role service_role; select public.begin_sales_snapshot_v3(${literal(manifest(rows))});`);
  const stage = (id, rows, n = 0) => sql(`set role service_role; select public.stage_sales_batch_v3('${id}',${n},${literal(rows)});`);
  const publish = id => JSON.parse(sql(`set role service_role; select public.commit_sales_snapshot_v3('${id}');`));
  const stageAll = rows => { const id = begin(rows); for (let i = 0; i < rows.length; i += 2000) stage(id, rows.slice(i, i + 2000), i / 2000); return id; };
  const snapshot = () => sql(`select md5(jsonb_build_object(
    'facts',(select jsonb_agg(to_jsonb(f) order by id) from public.fact_sales_daily f),
    'locations',(select jsonb_agg(to_jsonb(f) order by id) from public.dim_location f),
    'brands',(select jsonb_agg(to_jsonb(f) order by id) from public.dim_brand f),
    'owners',(select jsonb_agg(to_jsonb(f) order by id) from public.dim_ownership f),
    'channels',(select jsonb_agg(to_jsonb(f) order by id) from public.dim_channel f),
    'orders',(select jsonb_agg(to_jsonb(f) order by id) from public.dim_order_type f),
    'dates',(select jsonb_agg(to_jsonb(f) order by date_id) from public.dim_date f),
    'flat',(select jsonb_agg(to_jsonb(f) order by date,location) from public.bi_sales_flat_mv f),
    'monthly',(select jsonb_agg(to_jsonb(f) order by location_id,month_start) from public.agg_sales_monthly f),
    'weekly',(select jsonb_agg(to_jsonb(f) order by location_id,week_start) from public.agg_sales_weekly f),
    'generation',(select version from bi_sales_import_v3.generation))::text);`);
  const waitSleeping = async name => {
    for (let i = 0; i < 100; i++) {
      const pid = sql(`select pid from pg_stat_activity where application_name='${name}' and wait_event='PgSleep';`);
      if (pid) return pid;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail(`Session ${name} did not reach its transactional hold`);
  };
  let started = false;
  try {
    run('initdb', ['-D', data, '-A', 'trust', '--no-locale', '--encoding=UTF8', '--no-sync', '-U', 'v3_fixture']);
    run('pg_ctl', ['-D', data, '-l', path.join(dir, 'server.log'), '-o', `-h 127.0.0.1 -p ${port} -c unix_socket_directories=${dir}`, '-w', 'start']);
    started = true;
    assert.equal(path.resolve(sql('show data_directory;')), path.resolve(data));
    const schema = fs.readFileSync(new URL('supabase/schema.sql', root), 'utf8');
    const runtime = fs.readFileSync(new URL('supabase/migrations/20261008_warehouse_runtime.sql', root), 'utf8');
    sql('create role anon; create role authenticated; create role service_role; create schema extensions; create extension pgcrypto with schema extensions;');
    sql(schema.split('insert into map_location_source')[0]);
    sql(schema.match(/create table if not exists location_lifecycle_registry[\s\S]*?\);/)[0]);
    sql(runtime.split('create or replace function public.bi_sales_snapshot')[0]);
    sql(`create schema cron;create table cron.job(jobname text,command text);
      create schema net;create sequence net.fixture_request_id;
      create table net._http_response(id bigint primary key,status_code integer,content text,timed_out boolean);
      create table net.fixture_requests(id bigint,url text,timeout_ms integer);
      create function net.http_post(url text,timeout_milliseconds integer) returns bigint language plpgsql as $$
      declare id bigint;begin id:=nextval('net.fixture_request_id');insert into net.fixture_requests values(id,url,timeout_milliseconds);return id;end$$;
      insert into cron.job values('myastoriya_google_sheet_sync_daily',
        'select net.http_post(url := ''https://rxewpevxqtfmksybykvo.supabase.co/functions/v1/sync-google-sheet'', timeout_milliseconds := 30000);');
      insert into public.bi_runtime_config(config_key,value_hash) values('access_password',encode(extensions.digest('fixture-password','sha256'),'hex'));`);
    // The deployed MV deliberately has a different interface from the live view:
    // channel (not channel_group) and an additional lfl_exclude column.
    sql(`create materialized view public.bi_sales_flat_mv as select f.date,f.location,f.brand,f.ownership,
      f.channel_group as channel,f.order_type,coalesce(l.lfl_exclude,false) as lfl_exclude,f.revenue,f.checks,f.markup
      from public.bi_sales_flat f left join public.location_lifecycle_registry l on l.canonical_name=f.location;`);
    // Reproduce the incident: one wrong channel key, plus a known allowed channel.
    const old = sql("insert into public.import_runs(source_name,status) values('google_sheets:Данние короткі','running') returning id;");
    sql(`select public.sync_sales_batch(${literal([row('Correct', 20), row('Typo', 30, 'ё')])},'${old}');
      refresh materialized view public.bi_sales_flat_mv; refresh materialized view public.agg_sales_monthly; refresh materialized view public.agg_sales_weekly;
      update public.import_runs set status='success',finished_at=now(),source_cutoff_date='2026-10-30',rows_read=2 where id='${old}';`);
    sql(candidate.replace('rollback; -- NOT APPLIED: release controller replaces with COMMIT only after verified backup and tests.', 'commit;'));
    console.log(`v3 native acceptance PostgreSQL ${sql('show server_version;')}`);
    console.log(`v3 SQL sha256=${createHash('sha256').update(candidate).digest('hex')}`);

    await t.test('disabled policy and public/private ACLs reject all bypasses', () => {
      assert.throws(() => sql('set role service_role;select public.sales_snapshot_context_v3();'), /SAFETY_GATE/);
      for (const role of ['anon', 'authenticated']) for (const call of ['sales_snapshot_context_v3()', "begin_sales_snapshot_v3('{}')", `commit_sales_snapshot_v3('${old}')`])
        assert.throws(() => sql(`set role ${role};select public.${call};`), /permission denied/);
      for (const table of ['generation', 'sales_runs', 'sales_batches']) assert.throws(() => sql(`set role service_role;select * from bi_sales_import_v3.${table};`), /permission denied/);
      for (const role of ['anon','authenticated','service_role']) assert.throws(() => sql(`set role ${role};select bi_sales_import_v3.dispatch_sales_sync();`), /permission denied/);
      for (const role of ['anon','authenticated','service_role']) assert.throws(() => sql(`set role ${role};select bi_sales_import_v3.request_progress(1);`), /permission denied/);
      assert.throws(() => sql(`set role service_role;select public.sync_sales_batch('[]','${old}');`), /permission denied/);
      assert.throws(() => sql(`set role service_role;select public.finalize_sales_snapshot('${old}');`), /permission denied/);
      sql('update bi_sales_import_v3.generation set enabled=true;');
    });
    let accepted = [row('Correct', 20), row('Typo', 30)];
    await t.test('channel correction replaces stale key, status is accurate, repeated commit is idempotent', () => {
      const id = stageAll(accepted), before = snapshot();
      const r = publish(id); assert.equal(r.rows_loaded, 2); assert.equal(r.deleted_stale_rows, 1);
      assert.equal(r.atomic, true); assert.notEqual(snapshot(), before); const after = snapshot();
      assert.deepEqual(publish(id), r); assert.equal(snapshot(), after);
      assert.equal(sql("select count(*) from public.fact_sales_daily f join public.dim_channel c on c.id=f.channel_id where c.channel_group='ё';"), '0');
      assert.equal(sql(`select status||':'||rows_read||':'||rows_loaded from public.import_runs where id='${id}';`), 'success:2:2');
      const failed = JSON.parse(sql(`set role service_role;select public.fail_sales_snapshot_v3('${id}','NETWORK_FAILURE');`));
      assert.deepEqual(failed, r); assert.equal(snapshot(), after);
    });
    await t.test('incomplete, conflicting, malformed and duplicate batches never publish', () => {
      const rows = [...accepted, ...Array.from({ length: 1999 }, (_, i) => row(`Batch-${i}`))];
      const id = begin(rows), before = snapshot(); stage(id, rows.slice(0, 2000)); stage(id, rows.slice(0, 2000));
      assert.throws(() => publish(id), /INCOMPLETE_BATCHES/);
      assert.throws(() => stage(id, [...rows.slice(0, 1999), row('Conflict')]), /REPLAY_CONFLICT/);
      const invalid = begin(accepted); assert.throws(() => stage(invalid, [{ ...accepted[0], revenue: 0.004 }, accepted[1]]), /PRECISION/);
      const duplicates = [accepted[0], accepted[0]], d = stageAll(duplicates);
      assert.throws(() => publish(d), /DUPLICATE_CANONICAL_KEY/); assert.equal(snapshot(), before);
      const unknown = stageAll([{ ...accepted[0], channel_group: 'Є' }, accepted[1]]);
      assert.throws(() => publish(unknown), /UNKNOWN_CHANNEL/); assert.equal(snapshot(), before);
    });
    await t.test('mapping or noncooperating fact write after preparation causes compare-and-swap rejection', () => {
      const id = stageAll(accepted); sql("insert into public.map_location_source(source_name,canonical_name) values('Alias','Correct');");
      const before = snapshot(); assert.throws(() => publish(id), /BASELINE_CHANGED/); assert.equal(snapshot(), before);
      const other = stageAll(accepted); sql('update public.fact_sales_daily set imported_at=clock_timestamp() where id=(select min(id) from public.fact_sales_daily);');
      const changed = snapshot(); assert.throws(() => publish(other), /BASELINE_CHANGED/); assert.equal(snapshot(), changed);
    });
    await t.test('baseline is rechecked after waiting for an already active noncooperating writer', async () => {
      const id = stageAll(accepted);
      const writer = asyncSql("set application_name='sales_v3_external';begin;update public.fact_sales_daily set imported_at=clock_timestamp() where id=(select min(id) from public.fact_sales_daily);select pg_sleep(2);commit;");
      await waitSleeping('sales_v3_external');
      const importer = asyncSql(`set role service_role;select public.commit_sales_snapshot_v3('${id}');`);
      const [w, p] = await Promise.all([writer, importer]); assert.equal(w.code, 0, w.error);
      assert.notEqual(p.code, 0); assert.match(p.error, /BASELINE_CHANGED/);
      assert.equal(sql(`select state from bi_sales_import_v3.sales_runs where id='${id}';`), 'staging');
    });
    await t.test('each materialization timeout rolls back facts, dimensions, previous MVs and run status', () => {
      sql("create function public.v3_fixture_pause(label text) returns boolean language plpgsql volatile as $$begin if current_setting('fixture.pause',true)=label then perform pg_sleep(3); end if; return true;end$$;");
      const targets = ['bi_sales_flat_mv', 'agg_sales_monthly', 'agg_sales_weekly'];
      for (const target of targets) {
        const definition = sql(`select pg_get_viewdef('public.${target}'::regclass,true);`).replace(/;\s*$/, '');
        sql(`drop materialized view public.${target};create materialized view public.${target} as select original.* from (${definition}) original where public.v3_fixture_pause('${target}');`);
        const id = stageAll([...accepted, row(`Timeout-${target}`, 99)]), before = snapshot();
        assert.throws(() => sql(`set statement_timeout='150ms';set fixture.pause='${target}';set role service_role;select public.commit_sales_snapshot_v3('${id}');`), /statement timeout/);
        assert.equal(snapshot(), before);
        assert.equal(sql(`select status from public.import_runs where id='${id}';`), 'running');
        const failed = JSON.parse(sql(`set role service_role;select public.fail_sales_snapshot_v3('${id}','MV_TIMEOUT');`));
        assert.equal(failed.status, 'failed'); assert.equal(failed.rows_loaded, 0); assert.equal(snapshot(), before);
      }
    });
    await t.test('failure after MV refresh rolls back deletion, all refreshed data and receipt', () => {
      const id = stageAll([...accepted, row('Status-fail', 75)]), before = snapshot();
      sql("create function public.v3_fixture_status() returns trigger language plpgsql as $$begin raise exception 'INJECTED_STATUS_FAILURE';end$$;create trigger v3_fixture_status before update on public.import_runs for each row when(new.status='success') execute function public.v3_fixture_status();");
      assert.throws(() => publish(id), /INJECTED_STATUS_FAILURE/); assert.equal(snapshot(), before);
      sql('drop trigger v3_fixture_status on public.import_runs;drop function public.v3_fixture_status();');
    });
    await t.test('competing commits serialize and only one generation becomes visible', async () => {
      const winner = [...accepted, row('Winner', 40)], loser = [...accepted, row('Loser', 50)];
      const a = stageAll(winner), b = stageAll(loser);
      const first = asyncSql(`set application_name='sales_v3_winner';set role service_role;begin;select public.commit_sales_snapshot_v3('${a}');select pg_sleep(2);commit;`);
      await waitSleeping('sales_v3_winner');
      assert.equal(sql('select sum(revenue) from public.fact_sales_daily;'), '50.00');
      const second = asyncSql(`set role service_role;select public.commit_sales_snapshot_v3('${b}');`);
      const [ra, rb] = await Promise.all([first, second]); assert.equal(ra.code, 0, ra.error); assert.notEqual(rb.code, 0); assert.match(rb.error, /STALE_GENERATION/);
      accepted = winner;
    });
    await t.test('manual trigger is password gated, deduplicated and correlated to exact verified request receipt', () => {
      const trigger = password => JSON.parse(sql(`set role anon;select public.bi_trigger_atomic_sync('${password}');`));
      const progress = id => JSON.parse(sql(`set role anon;select public.bi_atomic_sync_progress('fixture-password',${id});`));
      assert.throws(() => trigger('wrong'), /UNAUTHORIZED/);
      assert.equal(sql('select count(*) from net.fixture_requests;'), '0');
      assert.throws(() => trigger('fixture-password'), /SAFETY_GATE/);
      sql("update bi_sales_import_v3.generation set trigger_command_hash=(select md5(command) from cron.job);");
      const a = trigger('fixture-password'); assert.equal(a.accepted, true); assert.equal(a.requestId, '1');
      assert.equal(sql('select timeout_ms from net.fixture_requests;'), '120000');
      assert.equal(sql("select command like '%30000%' from cron.job;"), 't');
      assert.equal(progress(a.requestId).status, 'pending');
      assert.throws(() => progress(999), /UNKNOWN_REQUEST/);
      const duplicate = trigger('fixture-password'); assert.equal(duplicate.alreadyRunning, true); assert.equal(duplicate.requestId, a.requestId);
      const receipt = JSON.parse(sql("select result from bi_sales_import_v3.sales_runs where state='committed' order by base_version desc limit 1;"));
      // A historical v9 success cannot masquerade as this staged import's receipt.
      sql(`insert into net._http_response values(1,200,${literal({ ok: true, import_run_id: old, atomic: true })}::text,false);`);
      assert.equal(progress(1).status, 'unknown');
      sql(`update net._http_response set content=${literal({ ...receipt, rows_loaded: 999 })}::text;`);
      assert.equal(progress(1).status, 'unknown');
      sql(`update net._http_response set content=${literal(receipt)}::text;`);
      const ok = progress(1); assert.equal(ok.status, 'success'); assert.equal(ok.runId, receipt.import_run_id);
      assert.equal(ok.rowsLoaded, 3); assert.equal(ok.published, true);
      const before = snapshot(); assert.deepEqual(progress(1), ok); assert.equal(snapshot(), before);
      sql('update net._http_response set timed_out=true;'); assert.equal(progress(1).status, 'unknown');
      sql(`update net._http_response set timed_out=false,status_code=503,content=${literal({ ok: false, code: 'SALES_IMPORT_SAFETY_GATE' })}::text;`);
      assert.deepEqual(progress(1), { requestId: '1', status: 'failed', published: false, done: true });
      sql("update bi_sales_import_v3.requests set requested_at=clock_timestamp()-interval '1 minute';update cron.job set command=command||' '; ");
      assert.throws(() => trigger('fixture-password'), /TRIGGER_CONFIGURATION_CHANGED/);
    });
    await t.test('46,702 canonical rows across 24 staged batches publish with exact identity and totals', () => {
      const count = 46702, base = Date.UTC(2024, 0, 1);
      const rows = [...accepted, ...Array.from({ length: count - accepted.length }, (_, i) => row(`Scale-${Math.floor(i / 1045)}`, 10, 'Заклад', new Date(base + (i % 1045) * 86400000).toISOString().slice(0, 10)))];
      const id = stageAll(rows), before = Date.now(); const result = publish(id);
      console.log(`v3 46,702-row atomic publish duration_ms=${Date.now() - before}`);
      assert.equal(result.rows_loaded, count); assert.equal(result.rows_read, count); assert.equal(result.revenue, 90 + (count - 3) * 10);
      assert.equal(sql('select count(*) from public.bi_sales_flat_mv;'), String(count));
      assert.equal(sql('select count(distinct import_run_id) from public.fact_sales_daily;'), '1');
      assert.equal(sql(`select rows_loaded from public.import_runs where id='${id}';`), String(count));
      // The steady-state warehouse cardinality is essential: validating a large
      // source against only a tiny previous fixture misses correlated-query costs.
      const repeated = stageAll(rows), repeatStarted = Date.now();
      const again = JSON.parse(sql(`set statement_timeout='55s';set role service_role;select public.commit_sales_snapshot_v3('${repeated}');`));
      console.log(`v3 46,702-row steady-state publish duration_ms=${Date.now() - repeatStarted}`);
      assert.equal(again.rows_loaded, count); assert.equal(again.revenue, result.revenue);
      assert.equal(sql(`select count(*) from public.fact_sales_daily where import_run_id='${repeated}';`), String(count));
    });
  } finally {
    if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
