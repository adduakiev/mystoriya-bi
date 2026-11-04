import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { deriveSalesProvenance } from '../../supabase/functions/sync-google-sheet/prepared-sales-provenance.mjs';
import { prepareSalesRecovery } from '../../supabase/functions/sync-google-sheet/prepared-sales-recovery.mjs';
import { SPREADSHEET_ID } from '../../supabase/functions/sync-google-sheet/google-sheet-reader.mjs';
import { catalogSQL as rehearsalCatalogSQL } from './fixtures/sales-rehearsal-catalog.mjs';

const catalogSQL = rehearsalCatalogSQL.replaceAll("'sales_rehearsal_private'", "'sales_release_v234_private'");
const root = new URL('../../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const draft = read('docs/sql/issue-43-sales-release-v234-NOT-APPLIED.sql');
const rollback = 'rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.';
const q = value => `'${String(value).replaceAll("'", "''")}'`;
const j = value => `${q(JSON.stringify(value))}::jsonb`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const reviewers = ['sales_reviewer_a', 'sales_reviewer_b'];
const caller = 'sales_release_v234_caller';
const db = 'sales_attestor_synthetic';
const schemas = "'public','bi_import_private','extensions','sales_attestor_private','sales_release_v234_private'";
const parseError = (result, state, message) => {
  assert.equal(result.status, 3, `Expected native SQL error, not client/startup failure: ${result.stderr}`);
  const error = result.stderr.match(/ERROR:\s+([0-9A-Z]{5}):\s*([^\n]*)/);
  assert.ok(error, result.stderr);
  assert.equal(error[1], state, result.stderr);
  if (message) assert.equal(error[2], message);
};
const header = ['', '', '', '', '', 'Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка', 'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
const payload = () => ({ range: "'Данние короткі'!A1:N1000", majorDimension: 'ROWS', values: [header,
  ['', '', '', '', '', '2026-10-25', 'Synthetic alias', 'Historical fixture', 'Owned', 'Заклад', 'Sale', '90071992547409.91', '1', '-0.03'],
  ['', '', '', '', '', '2026-10-26', 'Synthetic alias', 'Rebrand fixture', 'Owned', 'Заклад', 'Sale', '0.10', '2', '0.01'],
  ['', '', '', '', '', '2026-10-26', 'Synthetic alias', 'Rebrand fixture', 'Owned', 'Заклад', 'Sale', '0.10', '1', '0.00']
] });
const aliases = [['Synthetic alias', 'Synthetic location']];
const previous = { rawRows: 1, minDate: '2026-10-25', maxDate: '2026-10-25' };

// This is a NEW bounded reconstruction, not recovery of the absent failed files.
// No native skip, socket substitute, single-user acceptance, inherited PG URL,
// credential lookup, real HTTP call, or production path is available here.
test('v234 draft remains rollback-default, private and disconnected', () => {
  assert.ok(draft.endsWith(`${rollback}\n`));
  assert.doesNotMatch(draft, /create\s+(?:or replace\s+)?function\s+public\.|\b(?:create|alter)\s+role\b/i);
  assert.doesNotMatch(draft, /perform\s+public\.(?:sync_sales_batch|finalize_sales_snapshot)|delete from public\.fact_sales_daily/i);
  assert.doesNotMatch(draft, /set\s+generated\s+by\s+default/i);
  for (const file of ['supabase/functions/sync-google-sheet/index.ts','web/app/api/data-sync/route.ts',
    '.github/workflows/astra-runner.yml']) assert.doesNotMatch(read(file), /sales.release.v234/i);
  assert.throws(() => parseError({status:0,stderr:''},'42501'),assert.AssertionError);
});

test('v234 native prewrite, atomic transaction, independent LOGIN and protected restore', {
  timeout: 300000
}, async t => {
  // A configured PG17 runner must never silently fall back to PG16.
  const bin = process.env.SALES_TEST_PG_BIN || '/usr/lib/postgresql/16/bin';
  assert.ok(fs.existsSync(path.join(bin, 'initdb')), 'Configured native PostgreSQL 16/17 required; no fallback or skip');
  for (const tool of ['initdb', 'pg_ctl', 'psql', 'pg_dump', 'pg_restore', 'pg_config']) assert.ok(fs.existsSync(path.join(bin, tool)), tool);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-release-v234-pg-'));
  const clusters = ['source', 'restored'].map(name => ({ data: path.join(dir, name), socket: path.join(dir, `${name}-socket`), started: false }));
  const [source, restored] = clusters;
  const env = { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', PGCLIENTENCODING: 'UTF8', PGTZ: 'UTC' };
  // Ephemeral FIXTURE passwords only. Never logged, arguments or artifacts.
  const passwords = Object.fromEntries([...reviewers, caller].map(role => [role, randomBytes(32).toString('hex')]));
  const redact = message => Object.values(passwords).reduce((text, password) => text.replaceAll(password, '[REDACTED]'), String(message ?? ''));
  const invoke = (tool, args, input, role) => spawnSync(path.join(bin, tool), args, {
    env: { ...env, ...(role ? { PGPASSWORD: passwords[role] } : {}) }, input, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024
  });
  const ok = (tool, args, input, role) => {
    const result = invoke(tool, args, input, role);
    assert.equal(result.status, 0, `${tool}: ${result.error?.code ?? result.status}; ${redact(result.stderr).slice(-1800)}`);
    return result.stdout.trim();
  };
  // Trust only the selected binary's native server, with an allowed PG16/17 major.
  const testedPgVersion = /^PostgreSQL ((?:16|17)\.\d+)(?:\s|$)/.exec(ok('pg_config', ['--version']))?.[1];
  assert.ok(testedPgVersion, 'Unsupported native PostgreSQL version; never substitute another major');
  const args = (c, role = 'release_v234_fixture') => ['-X', '-h', c.socket, '-p', '5432', '-U', role, '-d', db,
    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-Atq'];
  const sql = (c, input, role) => ok('psql', args(c, role), input, role);
  const denied = (c, input, role, state = '42501', message) => parseError(invoke('psql', args(c, role), input, role), state, message);
  const asyncSQL = (c, input, role) => new Promise((resolve, reject) => {
    const child = spawn(path.join(bin, 'psql'), args(c, role), { env: { ...env, PGPASSWORD: passwords[role] }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
    child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
    child.on('error', reject); child.on('close', status => { clearTimeout(timer); resolve({ status, stdout: stdout.trim(), stderr }); });
    child.stdin.end(input);
  });
  const lockedRace = async (c, inputs) => {
    const holder = spawn(path.join(bin, 'psql'), args(c), { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', diagnostics = '';
    let ready, rejectReady;
    const locked = new Promise((resolve, reject) => { ready = resolve; rejectReady = reject; });
    const timer = setTimeout(() => { holder.kill('SIGKILL'); rejectReady(Error('Fixture lock rendezvous timeout')); }, 15000);
    holder.stdout.on('data', bytes => { output += bytes; if (output.includes('LOCKED')) ready(); });
    holder.stderr.on('data', bytes => { diagnostics += bytes; });
    holder.on('error', rejectReady);
    const finished = new Promise(resolve => holder.on('close', status => {
      clearTimeout(timer); if (!output.includes('LOCKED')) rejectReady(Error('Fixture lock unavailable')); resolve(status);
    }));
    let attempts = [];
    try {
      holder.stdin.write("begin; select version from bi_import_private.generation where singleton for update; select 'LOCKED';\n");
      await locked;
      attempts = inputs.map(input => asyncSQL(c, input, caller));
      let waiting = 0;
      for (let tries = 0; tries < 100; tries++) {
        waiting = Number(sql(c, `select count(*) from pg_stat_activity where usename='${caller}' and wait_event_type='Lock';`));
        if (waiting === inputs.length) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      assert.equal(waiting, inputs.length, 'Both independent commit sessions must actually contend on the held generation lock');
      holder.stdin.end('commit;\n');
      assert.equal(await finished, 0, diagnostics);
      return await Promise.all(attempts);
    } finally {
      if (holder.exitCode === null) holder.kill('SIGKILL');
      await finished; await Promise.allSettled(attempts);
    }
  };
  const catalog = c => JSON.parse(sql(c, catalogSQL));
  const rows = c => {
    const names = JSON.parse(sql(c, `select coalesce(json_agg(w order by name),'[]') from (
      select format('%I.%I',n.nspname,cl.relname) name,cl.relkind kind from pg_class cl
        join pg_namespace n on n.oid=cl.relnamespace where n.nspname in (${schemas}) and cl.relkind in ('r','v','m','S')) w;`));
    return names.map(({ name, kind }) => ({ name, kind, ...JSON.parse(sql(c, `select json_build_object('count',count(*)::text,
      'sha256',encode(sha256(convert_to(coalesce(string_agg(h,'' order by h collate "C"),''),'UTF8')),'hex')) from (
        select encode(sha256(convert_to(to_jsonb(w)::text,'UTF8')),'hex') h from
        ${kind === 'S' ? `(select last_value,is_called from ${name})` : name} w) hashed;`)) }));
  };
  const exact = c => ({ catalog: catalog(c), rows: rows(c) });
  const start = c => {
    fs.mkdirSync(c.socket, { mode: 0o700 });
    ok('initdb', ['-D', c.data, '-A', 'trust', '--no-locale', '--encoding=UTF8', '--no-sync', '-U', 'release_v234_fixture']);
    const hba = path.join(c.data, 'pg_hba.conf');
    fs.writeFileSync(hba, `local ${db} ${[...reviewers, caller].join(',')} scram-sha-256\n${fs.readFileSync(hba, 'utf8')}`);
    const log = path.join(c.data, 'fixture.log');
    try {
      ok('pg_ctl', ['-D', c.data, '-l', log, '-o', `-h '' -p 5432 -k ${c.socket}`, '-w', 'start']); c.started = true;
    } catch (error) {
      c.started = fs.existsSync(path.join(c.data, 'postmaster.pid'));
      throw Error(`${error.message}; local PostgreSQL: ${fs.readFileSync(log, 'utf8').slice(-1800)}`, { cause: error });
    }
    ok('psql', ['-X', '-h', c.socket, '-U', 'release_v234_fixture', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], `create database ${db};`);
    assert.equal(fs.realpathSync(sql(c, 'show data_directory;')), fs.realpathSync(c.data));
    assert.equal(sql(c, 'show listen_addresses;'), '');
    assert.equal(sql(c, 'show server_version;').split(' ')[0], testedPgVersion, 'server and selected native pg_config version must agree');
    sql(c, `create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create role sales_attestor_owner nologin;
      create role sales_restore_operator nologin bypassrls;
      ${[...reviewers, caller].map(role => `create role ${role} login noinherit password ${q(passwords[role])};`).join('\n')}`);
    assert.equal(sql(c, `select count(*) from pg_hba_file_rules where line_number=1 and auth_method='scram-sha-256' and error is null;`), '1');
    for (const role of [...reviewers, caller]) {
      assert.equal(sql(c, 'select session_user||\'|\'||current_user;', role), `${role}|${role}`);
      const bad = spawnSync(path.join(bin, 'psql'), args(c, role), { env: { ...env, PGPASSWORD: 'wrong-synthetic-only' }, encoding: 'utf8', input: 'select 1;', timeout: 10000 });
      assert.equal(bad.status, 2); assert.match(bad.stderr, /password authentication failed/);
      assert.equal(sql(c, `select rolpassword like 'SCRAM-SHA-256$%' from pg_authid where rolname=${q(role)};`), 't');
    }
  };
  const install = (c, file) => sql(c, read(file).replace(rollback, 'commit;'));
  const commit = run => `select sales_release_v234_private.commit('${run}');`;
  const deny = (c, a, message, state = '55000') => {
    const before = exact(c);
    denied(c, commit(a.run), caller, state, message);
    assert.deepEqual(exact(c), before, 'Rejected call changed rows, sequences, RLS, roles or ACLs');
  };
  const both = (c, a) => reviewers.map(role => sql(c,
    `select sales_attestor_private.review('${a.run}',${j(a.binding)});`, role));
  // No real Google I/O: typed fixture uses the exact same canonical derivation.
  const clock = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit' }).format(clock);
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`)-86400000).toISOString().slice(0,10);
  const candidate = async (c, change = () => {}, omitAuthority = false, changeSource = () => {}) => {
    const source = payload(); source.values[2][5]=cutoff; source.values[3][5]=cutoff; changeSource(source);
    const capture = { spreadsheetId: SPREADSHEET_ID,
      requestedRange:"'Данние короткі'!A:N",returnedRange:source.range,majorDimension:'ROWS',
      valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER',values:source.values };
    const provenance = await deriveSalesProvenance({capture,aliases,previous,now:clock});
    const prepared = prepareSalesRecovery(source.values,{previous,now:clock});
    const gen = sql(c,'select version from bi_import_private.generation;');
    const priorHash = sql(c,`select receipt_sha256 from sales_release_v234_private.history where generation=${gen};`) || hash('OFFLINE SYNTHETIC GENESIS ONLY');
    sql(c,`insert into sales_release_v234_private.roots select ${q(priorHash)},${gen},
      sales_release_v234_private.warehouse_rows(),
      (select coalesce(max(rows_read),1) from public.import_runs where status='success'),
      '2026-10-25',(select coalesce(max(date_id),'2026-10-25'::date) from public.fact_sales_daily),'OFFLINE_SYNTHETIC_ONLY' on conflict do nothing;`);
    const run = crypto.randomUUID();
    const binding = {kind:'sales-release/v234/OFFLINE_SYNTHETIC_ONLY',project:'OFFLINE_SYNTHETIC_ONLY',run_id:run,
      prior_receipt_sha256:priorHash,base_generation:gen,generation:String(BigInt(gen)+1n),source_sha256:provenance.sourceSha256,
      raw_rows:String(provenance.rawRows),min_date:provenance.minDate,max_date:provenance.maxDate,
      manifest_sha256:provenance.manifestSha256,warehouse_sha256:provenance.warehouseSha256,
      mapping_sha256:provenance.mappingSha256,canonical_rows:JSON.parse(provenance.canonicalRowsJson),aliases};
    const a = {run,binding,manifest:prepared.manifestJson,payload:prepared.batches[0].json};
    change(a);
    sql(c,`insert into sales_attestor_private.targets values('${run}',${j(binding)},
      encode(sha256(convert_to((${j(binding)})::text,'UTF8')),'hex'),clock_timestamp()+interval '1 hour');`);
    if (!omitAuthority) sql(c,`insert into sales_release_v234_private.authorities values('${run}',${q(priorHash)},${q(a.manifest)},
      ${q(a.payload)}::jsonb,encode(sha256(convert_to((${j(binding)})::text,'UTF8')),'hex'));`);
    return a;
  };
  const guards = c => {
    const before = exact(c);
    for (const role of [...reviewers,caller]) {
      denied(c,'update public.fact_sales_daily set revenue=revenue+0.01;',role);
      denied(c,'set role release_v234_fixture;',role);
      denied(c,'set role sales_restore_operator;',role);
      denied(c,'set session authorization release_v234_fixture;',role);
      for (const table of ['roots','authorities','history','staged','identity_high_water']) {
        denied(c,`insert into sales_release_v234_private.${table} select * from sales_release_v234_private.${table};`,role);
        denied(c,`truncate sales_release_v234_private.${table} cascade;`,role);
      }
    }
    denied(c,`begin;set local role sales_reviewer_a;select sales_attestor_private.review(null,'{}');`,undefined,'42501','SALES_ATTESTOR_INDEPENDENT_LOGIN_REQUIRED');
    for (const fn of ['begin_sales_snapshot_v2(null::jsonb)','stage_sales_batch_v2(null,0,null)',
      'commit_sales_snapshot_v2(null)','commit_sales_snapshot_with_evidence_v1(null,null)']) {
      denied(c,`set role service_role;select public.${fn};`,undefined,'55000',
        'SALES_PREWRITE_INDEPENDENT_SOURCE_ROOT_AND_IDENTITY_POLICY_UNAVAILABLE');
    }
    for (const fn of ['sync_sales_batch(null::jsonb,null::uuid)','finalize_sales_snapshot(null::uuid)'])
      denied(c,`set role service_role;select public.${fn};`);
    assert.deepEqual(exact(c),before);
  };
  try {
    start(source);
    sql(source,'create schema extensions;');
    const schema=read('supabase/schema.sql');
    sql(source,schema.split('insert into map_location_source')[0]);
    sql(source,schema.match(/create table if not exists location_lifecycle_registry[\s\S]*?\);/)[0]);
    sql(source,'alter table public.location_lifecycle_registry enable row level security;');
    sql(source,read('supabase/migrations/20261008_warehouse_runtime.sql').split('create or replace function public.bi_sales_snapshot')[0]);
    sql(source,'create materialized view public.bi_sales_flat_mv as select * from public.bi_sales_flat;');
    // Define the existing trigger for ACL checks; never execute it.
    sql(source,read('supabase/migrations/20261012_dashboard_manual_sync.sql').split('create or replace function public.bi_sync_progress')[0]);
    install(source,'docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql');
    install(source,'docs/sql/issue-43-sales-accepted-source-gate-NOT-APPLIED.sql');
    install(source,'docs/sql/issue-43-sales-attestor-NOT-APPLIED.sql');
    install(source,'docs/sql/issue-43-sales-role-hardening-NOT-APPLIED.sql');
    install(source,'docs/sql/issue-43-sales-prewrite-gate-NOT-APPLIED.sql');
    sql(source,`insert into public.map_location_source values('Synthetic alias','Synthetic location',true,null);
      insert into sales_attestor_private.reviewers values('sales_reviewer_a','independent-A'),('sales_reviewer_b','independent-B');
      grant usage on schema public to sales_restore_operator;
      grant select on all tables in schema public to sales_restore_operator;
      alter materialized view public.bi_sales_flat_mv owner to sales_restore_operator;
      alter materialized view public.agg_sales_monthly owner to sales_restore_operator;
      alter materialized view public.agg_sales_weekly owner to sales_restore_operator;`);
    await t.test('default rollback and installation do not alter existing protected objects',()=>{
      const before=exact(source);sql(source,draft);assert.deepEqual(exact(source),before);
      install(source,'docs/sql/issue-43-sales-release-v234-NOT-APPLIED.sql');
      const after=catalog(source);
      for(const field of ['schemas','relations','sequences','functions','constraints','indexes','triggers','policies']) {
        after[field]=after[field]?.filter(row=>!JSON.stringify(row).includes('sales_release_v234_private'))??null;
        if(after[field]?.length===0)after[field]=null;
      }
      assert.deepEqual(after,before.catalog);
      assert.deepEqual(rows(source).filter(row=>!row.name.startsWith('sales_release_v234_private.')),before.rows);
      guards(source);
    });
    let accepted;
    await t.test('missing authority and independent reviews stop before import_runs, staging or sequences',async()=>{
      const missing=await candidate(source,()=>{},true);
      deny(source,missing,'SALES_RELEASE_V234_PINNED_AUTHORITY_REQUIRED');
      accepted=await candidate(source);
      deny(source,accepted,'SALES_RELEASE_V234_TWO_LOGINS_REQUIRED');
      sql(source,`select sales_attestor_private.review('${accepted.run}',${j(accepted.binding)});`,reviewers[0]);
      deny(source,accepted,'SALES_RELEASE_V234_TWO_LOGINS_REQUIRED');
      sql(source,`select sales_attestor_private.review('${accepted.run}',${j(accepted.binding)});`,reviewers[1]);
      assert.equal(sql(source,'select count(*) from public.import_runs;'),'0');
      assert.equal(sql(source,'select count(*) from sales_release_v234_private.staged;'),'0');
    });
    await t.test('single transaction preserves exact cents, all three MVs and immutable idempotent receipt',()=>{
      const seq=rows(source).filter(row=>row.kind==='S');
      const result=JSON.parse(sql(source,commit(accepted.run),caller));
      assert.equal(result.generation,'1');
      assert.deepEqual(JSON.parse(sql(source,'select sales_release_v234_private.warehouse_rows();')),accepted.binding.canonical_rows);
      for(const name of ['fact_sales_daily','bi_sales_flat_mv','agg_sales_monthly','agg_sales_weekly'])
        assert.equal(sql(source,`select sum(revenue)::text||'|'||sum(checks)::text||'|'||sum(markup)::text from public.${name};`),
          '90071992547410.11|4.00|-0.02');
      const before=exact(source);
      assert.deepEqual(JSON.parse(sql(source,commit(accepted.run),caller)),result);
      assert.deepEqual(exact(source),before,'Identical retry mutated warehouse');
      assert.deepEqual(rows(source).filter(row=>row.kind==='S' && row.name!=='public.fact_sales_daily_id_seq'),
        seq.filter(row=>row.name!=='public.fact_sales_daily_id_seq'),'Unrelated sequences must not change');
      assert.equal(sql(source,"select last_value::text||'|'||is_called from public.fact_sales_daily_id_seq;"),'3|false');
      assert.equal(sql(source,'select high_water from sales_release_v234_private.identity_high_water;'),'2');
      for(const table of ['roots','authorities','history']) {
        denied(source,`truncate sales_release_v234_private.${table} cascade;`,undefined,'42501','SALES_ATTESTOR_IMMUTABLE');
        assert.deepEqual(exact(source),before);
      }
      guards(source);
    });
    await t.test('RLS denies a structurally valid insert and the same valid UPDATE succeeds only under a rolled-back policy',()=>{
      const f=JSON.parse(sql(source,'select to_jsonb(f) from public.fact_sales_daily f order by id limit 1;'));
      const columns=['id','date_id','location_id','brand_id','ownership_id','channel_id','order_type_id','revenue','checks','markup'];
      const values=columns.map(k=>q(String(k==='id'?99999:f[k]))).join(',');
      const before=exact(source);
      denied(source,`begin;grant select,insert on public.fact_sales_daily to ${caller};set local role ${caller};
        insert into public.fact_sales_daily(${columns.join(',')}) overriding system value values(${values});`,undefined,'42501',
        'new row violates row-level security policy for table "fact_sales_daily"');
      assert.deepEqual(exact(source),before);
      const control=invoke('psql',args(source),`begin;
        grant select,update(revenue) on public.fact_sales_daily to ${caller};
        create policy v234_negative_control on public.fact_sales_daily for all to ${caller} using(true) with check(true);
        set local role ${caller};update public.fact_sales_daily set revenue=revenue+0.01 returning revenue;rollback;`);
      assert.equal(control.status,0,control.stderr);assert.ok(control.stdout.trim());
      assert.throws(()=>parseError(control,'42501'),assert.AssertionError);
      assert.deepEqual(exact(source),before);
    });
    await t.test('full manifest, root, project, mapping, precision and identity defects reject before first write',async()=>{
      for(const [change,message] of [
        [a=>{a.binding.project='other';},'ROOT_BINDING_REQUIRED'],
        [a=>{a.binding.prior_receipt_sha256=hash('forged');},'ROOT_BINDING_REQUIRED'],
        [a=>{a.binding.source_sha256=null;},'ROOT_BINDING_REQUIRED'],
        [a=>{a.binding.manifest_sha256=hash('bad manifest');},'MANIFEST'],
        [a=>{a.manifest=a.manifest.replace('90071992547410.11','90071992547410.12');},'MANIFEST'],
        [a=>{a.payload=a.payload.replace('90071992547409.91','90071992547409.911');},'PRECISION'],
        [a=>{a.payload=a.payload.replace('90071992547409.91','null');},'METRIC'],
        [a=>{a.binding.mapping_sha256=hash('wrong mapping');},'CANONICAL_MISMATCH'],
        [a=>{a.binding.canonical_rows[0][2]='Lost historical identity';},'CANONICAL_MISMATCH']
      ]) {const a=await candidate(source,change);both(source,a);deny(source,a,`SALES_RELEASE_V234_${message}`);}
      for(const key of Object.keys(accepted.binding)) {
        const a=await candidate(source,a=>{a.binding[key]=null;});both(source,a);
        deny(source,a); // native 55000 and complete no-first-write parity for EVERY field
      }
      const a=await candidate(source);both(source,a);
      const before=exact(source);
      denied(source,`begin;update public.map_location_source set canonical_name='Changed';
        set session authorization ${caller};${commit(a.run)}`,undefined,'55000','SALES_RELEASE_V234_CANONICAL_MISMATCH');
      assert.deepEqual(exact(source),before);
    });
    const sequence = 'public.fact_sales_daily_id_seq';
    const identityGuard = `do $$begin
      if (select a.attidentity::text from pg_attribute a where a.attrelid='public.fact_sales_daily'::regclass
          and a.attname='id') is distinct from 'a'
        or not (select relrowsecurity from pg_class where oid='public.fact_sales_daily'::regclass)
        or exists(select from pg_roles r where r.rolname in ('anon','authenticated','service_role',
          'sales_release_v234_caller','sales_reviewer_a','sales_reviewer_b') and (
          has_table_privilege(r.oid,'public.fact_sales_daily','INSERT,UPDATE,DELETE,TRUNCATE')
          or has_sequence_privilege(r.oid,'${sequence}','USAGE,UPDATE')
          or exists(select from pg_attribute a where a.attrelid='public.fact_sales_daily'::regclass
            and a.attnum>0 and not a.attisdropped and has_column_privilege(r.oid,a.attrelid,a.attnum,'INSERT,UPDATE'))))
        or not exists(select from pg_sequence where seqrelid='${sequence}'::regclass and seqincrement=1
          and seqmin=1 and seqmax=9223372036854775807 and seqcache=1 and not seqcycle) then
        raise exception 'FIXTURE_IDENTITY_RLS_ACL_SEQUENCE_NOT_PINNED';end if;
    end$$;`;
    const withNewIdentity = source => {
      const row=[...source.values[2]];row[7]='New identity witness';row[11]='0.01';source.values.push(row);
    };
    const defaultInsert = `insert into public.dim_order_type(name) values('Default identity witness');
      insert into public.fact_sales_daily(date_id,location_id,brand_id,ownership_id,channel_id,order_type_id,revenue,checks,markup)
        select date_id,location_id,brand_id,ownership_id,channel_id,
          (select id from public.dim_order_type where name='Default identity witness'),0,0,0
        from public.fact_sales_daily order by id limit 1 returning id;`;
    await t.test('negative explicit/default collision controls and transactional high-water/overflow checks preserve storage',async()=>{
      const a=await candidate(source,()=>{},false,withNewIdentity);both(source,a);
      const before=exact(source);
      // Both controls must really reach the PK, with structurally valid natural keys.
      denied(source,`begin;alter sequence ${sequence} restart with 1;${defaultInsert}`,undefined,'23505',
        'duplicate key value violates unique constraint "fact_sales_daily_pkey"');
      assert.deepEqual(exact(source),before);
      denied(source,`begin;${defaultInsert.replace('fact_sales_daily(date_id','fact_sales_daily(id,date_id')
        .replace('select date_id','overriding system value select 1,date_id')}`,undefined,'23505',
        'duplicate key value violates unique constraint "fact_sales_daily_pkey"');
      assert.deepEqual(exact(source),before);
      // D240: fixture-only UPDATE cannot assign a GENERATED ALWAYS identity.
      // Restore ALWAYS immediately, before assertions/session authorization/promotion.
      const historicalId = id => `alter table public.fact_sales_daily alter column id set generated by default;
        update public.fact_sales_daily set id=${id} where id=1;
        alter table public.fact_sales_daily alter column id set generated always;${identityGuard}
        do $$begin
          if not exists(select from ${sequence} where last_value=3 and not is_called)
            or (select high_water from sales_release_v234_private.identity_high_water)<>2
            or (select count(*) from public.fact_sales_daily where id=${id})<>1 then
            raise exception 'FIXTURE_HISTORICAL_ID_OR_SEQUENCE_NOT_PINNED';end if;end$$;`;
      const high=invoke('psql',args(source),`begin;${historicalId('700')}
        set session authorization ${caller};${commit(a.run)}reset session authorization;
        do $$begin
          if (select max(id) from public.fact_sales_daily)<>701
            or (select high_water from sales_release_v234_private.identity_high_water)<>701
            or not exists(select from ${sequence} where last_value=702 and not is_called) then
            raise exception 'HIGH_WATER_BRANCH_NOT_EXECUTED';end if;end$$;
        rollback;`);
      assert.equal(high.status,0,high.stderr);assert.match(high.stdout,/OFFLINE_SYNTHETIC_ONLY/);
      assert.deepEqual(exact(source),before,'High historical ID fixture leaked after rollback');
      denied(source,`begin;${historicalId('9223372036854775807')}
        set session authorization ${caller};${commit(a.run)}`,undefined,'55000','SALES_RELEASE_V234_IDENTITY_OVERFLOW');
      assert.deepEqual(exact(source),before,'Overflow fixture leaked identity/catalog/RLS/ACL/sequence/rows');
    });
    await t.test('transactional restart permits a future default ID above explicit promotion IDs',async()=>{
      const a=await candidate(source,()=>{},false,withNewIdentity);both(source,a);
      const before=exact(source);
      const result=sql(source,`begin;${identityGuard}set session authorization ${caller};${commit(a.run)}
        reset session authorization;${defaultInsert}${identityGuard}
        do $$begin if (select max(id) from public.fact_sales_daily)<>4 then
          raise exception 'DEFAULT_ID_NOT_ABOVE_PROMOTION';end if;end$$;rollback;`);
      assert.match(result,/OFFLINE_SYNTHETIC_ONLY/);assert.match(result,/\n4$/);
      assert.deepEqual(exact(source),before,'Successful default writer control must roll back completely');
    });
    await t.test('sequence-ahead and protected historical high-water never move allocation backwards',async()=>{
      const a=await candidate(source,()=>{},false,withNewIdentity);both(source,a);
      for(const setup of [`alter sequence ${sequence} restart with 800;`,
        'update sales_release_v234_private.identity_high_water set high_water=799;']) {
        const before=exact(source);
        sql(source,`begin;${setup}${identityGuard}set session authorization ${caller};${commit(a.run)}
          reset session authorization;do $$begin
          if (select max(id) from public.fact_sales_daily)<>800
            or (select high_water from sales_release_v234_private.identity_high_water)<>800
            or not exists(select from ${sequence} where last_value=801 and not is_called) then
            raise exception 'SEQUENCE_HIGH_WATER_REGRESSED';end if;end$$;rollback;`);
        assert.deepEqual(exact(source),before);
      }
    });
    await t.test('identity mode, sequence configuration and effective writer grants reject before first write',async()=>{
      const a=await candidate(source,()=>{},false,withNewIdentity);both(source,a);
      for(const setup of [
        'alter table public.fact_sales_daily alter column id set generated by default;',
        `alter sequence ${sequence} increment by 2;`,
        `grant insert on public.fact_sales_daily to ${caller};`,
        `grant update(id) on public.fact_sales_daily to ${caller};`,
        `grant usage on sequence ${sequence} to ${caller};`,
        `grant update(high_water) on sales_release_v234_private.identity_high_water to ${caller};`,
        'alter table public.fact_sales_daily disable row level security;'
      ]) {
        const before=exact(source);
        denied(source,`begin;${setup}set session authorization ${caller};${commit(a.run)}`,undefined,'55000',
          'SALES_RELEASE_V234_IDENTITY_WRITER_CONTRACT');
        assert.deepEqual(exact(source),before);
      }
    });
    await t.test('both ISO-year boundaries reject before any dimension, fact, sequence or receipt write',async()=>{
      for(const date of ['2025-12-29','2021-01-01']) {
        const a=await candidate(source,()=>{},false,source=>{
          const row=[...source.values[2]];row[5]=date;source.values.push(row);
        });both(source,a);
        deny(source,a,'SALES_RELEASE_V234_ISO_YEAR_BOUNDARY');
      }
    });
    await t.test('a successful update-only promotion keeps future sequence allocation and retry immutable',async()=>{
      const a=await candidate(source);both(source,a);
      const before=exact(source);
      sql(source,`begin;${identityGuard}set session authorization ${caller};${commit(a.run)}${commit(a.run)}
        reset session authorization;do $$begin
        if not exists(select from ${sequence} where last_value=3 and not is_called)
          or (select high_water from sales_release_v234_private.identity_high_water)<>2 then
          raise exception 'UPDATE_ONLY_SEQUENCE_REGRESSION';end if;end$$;rollback;`);
      assert.deepEqual(exact(source),before);
    });
    await t.test('injected refresh error, final-step failure and timeout roll back new IDs, dimensions, MVs and history',async()=>{
      const a=await candidate(source,()=>{},false,source=>{
        const row=[...source.values[2]];row[7]='New rollback brand';row[11]='0.01';source.values.push(row);
      });both(source,a);
      for(const [body,state,message] of [
        ["raise exception using errcode='P0001',message='SYNTHETIC_LATE_FAILURE';",'P0001','SYNTHETIC_LATE_FAILURE'],
        ['perform pg_sleep(20);','57014','canceling statement due to statement timeout']
      ]) {
        sql(source,`create function sales_release_v234_private.fail_generation() returns trigger language plpgsql as $$begin
          if not exists(select from sales_release_v234_private.history where run_id='${a.run}') then
            raise exception 'FAILURE_PROBE_TOO_EARLY';end if;
          insert into public.dim_brand(name) values('Rollback witness');${body}return new;end$$;
          revoke all on function sales_release_v234_private.fail_generation() from PUBLIC;
          create trigger fail_generation before update on bi_import_private.generation for each row
          execute function sales_release_v234_private.fail_generation();`);
        const before=exact(source);
        denied(source,`set statement_timeout='1000ms';${commit(a.run)}`,caller,state,message);
        assert.deepEqual(exact(source),before);
        sql(source,'drop trigger fail_generation on bi_import_private.generation;drop function sales_release_v234_private.fail_generation();');
      }
      const before=exact(source);
      // Invalid MV definition in the same rollback-only fixture transaction forces a native refresh failure.
      denied(source,`begin;drop materialized view public.agg_sales_monthly;
        create materialized view public.agg_sales_monthly as select 1/(count(*)-count(*)) broken from public.fact_sales_daily with no data;
        set session authorization ${caller};${commit(a.run)}`,undefined,'22012','division by zero');
      assert.deepEqual(exact(source),before);
      const control=invoke('psql',args(source,caller),`begin;${commit(a.run)}rollback;`,caller);
      assert.equal(control.status,0,control.stderr);assert.throws(()=>parseError(control,'55000'),assert.AssertionError);
      assert.deepEqual(exact(source),before);
    });
    await t.test('competing writers serialize; identical retries are read-only and old receipts become stale',async()=>{
      const a=await candidate(source),b=await candidate(source);both(source,a);both(source,b);
      const results=await lockedRace(source,[commit(a.run),commit(b.run)]);
      assert.deepEqual(results.map(r=>r.status).sort(),[0,3]);
      parseError(results.find(r=>r.status===3),'55000','SALES_RELEASE_V234_STALE_GENERATION');
      const winner=results[0].status===0?a:b;
      const before=exact(source);sql(source,commit(winner.run),caller);assert.deepEqual(exact(source),before);
      deny(source,accepted,'SALES_RELEASE_V234_STALE_GENERATION');
      const same=await candidate(source);both(source,same);
      const repeated=await lockedRace(source,[commit(same.run),commit(same.run)]);
      assert.deepEqual(repeated.map(r=>r.status),[0,0]);
      assert.equal(repeated[0].stdout,repeated[1].stdout);
    });
    await t.test('native restore operator and MV owner preserve RLS, ACLs, exact sequence state and receipts',()=>{
      guards(source);const baseline=exact(source);
      // Reproduce the old restore failure without touching production policy.
      // A transaction removes ONLY this fixture owner's bypass, then native
      // refresh under row_security=off must fail; disconnect rolls it back.
      const regression=invoke('psql',args(source),`begin;
        alter role sales_restore_operator nobypassrls;
        set local row_security=off;refresh materialized view public.agg_sales_monthly;`);
      parseError(regression,'42501');assert.match(regression.stderr,/row-level security/);
      assert.deepEqual(exact(source),baseline,'Restore-identity negative control left a role or MV change');
      assert.equal(sql(source,"select rolsuper||'|'||rolbypassrls||'|'||rolcanlogin from pg_roles where rolname='sales_restore_operator';"),'false|true|false');
      assert.equal(sql(source,"select count(*) from pg_class where oid in ('public.bi_sales_flat_mv'::regclass,'public.agg_sales_monthly'::regclass,'public.agg_sales_weekly'::regclass) and relowner='sales_restore_operator'::regrole;"),'3');
      assert.equal(sql(source,"select relrowsecurity from pg_class where oid='public.fact_sales_daily'::regclass;"),'t');
      const archive=path.join(dir,'synthetic.dump');
      const connection=c=>['-h',c.socket,'-p','5432','-U','release_v234_fixture','-d',db];
      ok('pg_dump',[...connection(source),'--format=custom','--file',archive]);
      ok('pg_ctl',['-D',source.data,'-m','fast','-w','stop']);source.started=false;
      start(restored);
      ok('pg_restore',[...connection(restored),'--exit-on-error','--single-transaction',archive]);
      assert.deepEqual(exact(restored),baseline,'Native restored definitions, ownership, ACL/RLS, rows, receipts and sequences');
      guards(restored);
      const before=exact(restored);
      denied(restored,'truncate sales_attestor_private.receipts cascade;',undefined,'42501','SALES_ATTESTOR_IMMUTABLE');
      assert.deepEqual(exact(restored),before);
      console.log(`v234 OFFLINE SYNTHETIC PG ${testedPgVersion} native restore PASS; no production backup/import/release.`);
    });
  } finally {
    const errors=[];
    for(const c of clusters)if(c.started) {
      try{ok('pg_ctl',['-D',c.data,'-m','immediate','-w','stop']);c.started=false;}catch(error){errors.push(error);}
    }
    if(!errors.length)fs.rmSync(dir,{recursive:true,force:true});
    else throw new AggregateError(errors,'Disposable PostgreSQL cleanup failed');
  }
});
