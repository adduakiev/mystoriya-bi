import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { capturePreparedPrivateSalesSheet } from '../../supabase/functions/sync-google-sheet/prepared-sales-sheet-capture.mjs';
import { canonicalSalesSourceBytes, deriveSalesProvenance } from '../../supabase/functions/sync-google-sheet/prepared-sales-provenance.mjs';
import { prepareSalesRecovery } from '../../supabase/functions/sync-google-sheet/prepared-sales-recovery.mjs';
import { SERVICE_ACCOUNT } from '../../supabase/functions/sync-google-sheet/google-sheet-reader.mjs';
import { catalogSQL } from './fixtures/sales-rehearsal-catalog.mjs';

const root = new URL('../../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const draft = read('docs/sql/issue-43-sales-rehearsal-NOT-APPLIED.sql');
const rollback = 'rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.';
const q = value => `'${String(value).replaceAll("'", "''")}'`;
const j = value => `${q(JSON.stringify(value))}::jsonb`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const reviewers = ['sales_reviewer_a', 'sales_reviewer_b'];
const caller = 'sales_rehearsal_caller';
const db = 'sales_attestor_synthetic';
const schemas = "'public','bi_import_private','extensions','sales_attestor_private','sales_rehearsal_private'";
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
const now = new Date('2026-10-27T12:00:00Z');

// This is a NEW bounded reconstruction, not recovery of the absent failed files.
// No native skip, socket substitute, single-user acceptance, inherited PG URL,
// credential lookup, real HTTP call, or production path is available here.
test('offline rehearsal remains rollback-default and disconnected from existing code', () => {
  assert.ok(draft.endsWith(`${rollback}\n`));
  assert.match(draft, /OFFLINE SYNTHETIC REHEARSAL ONLY \/ NOT APPLIED/);
  assert.doesNotMatch(draft, /create\s+(?:or replace\s+)?function\s+public\.|\b(?:create|alter)\s+role\b|grant\s+.*public\.commit_sales_snapshot/i);
  assert.doesNotMatch(draft, /perform\s+public\.(?:sync_sales_batch|finalize_sales_snapshot)|delete from public\.fact_sales_daily/i);
  for (const file of ['supabase/functions/sync-google-sheet/index.ts', 'web/app/api/data-sync/route.ts',
    'supabase/functions/sync-google-sheet/prepared-sales-cutover.mjs', 'scripts/check.mjs', '.github/workflows/astra-runner.yml']) {
    assert.doesNotMatch(read(file), /sales_rehearsal_private|issue-43-sales-rehearsal/);
  }
  assert.throws(() => parseError({ status: 0, stderr: '' }, '42501'), assert.AssertionError);
  assert.throws(() => parseError({ status: 3, stderr: 'ERROR:  428C9: identity' }, '42501'), assert.AssertionError);
});

test('offline synthetic capture → SCRAM reviews → staged atomic generation → independent readback and restore', {
  timeout: 300000
}, async t => {
  const bin = [process.env.SALES_TEST_PG_BIN, '/usr/lib/postgresql/16/bin']
    .find(dir => dir && fs.existsSync(path.join(dir, 'initdb')));
  assert.ok(bin, 'Native PostgreSQL 16.15 required; cannot skip');
  for (const tool of ['initdb', 'pg_ctl', 'psql', 'pg_dump', 'pg_restore']) assert.ok(fs.existsSync(path.join(bin, tool)), tool);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-rehearsal-pg-'));
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
  const args = (c, role = 'rehearsal_fixture') => ['-X', '-h', c.socket, '-p', '5432', '-U', role, '-d', db,
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
    ok('initdb', ['-D', c.data, '-A', 'trust', '--no-locale', '--encoding=UTF8', '--no-sync', '-U', 'rehearsal_fixture']);
    const hba = path.join(c.data, 'pg_hba.conf');
    fs.writeFileSync(hba, `local ${db} ${[...reviewers, caller].join(',')} scram-sha-256\n${fs.readFileSync(hba, 'utf8')}`);
    const log = path.join(c.data, 'fixture.log');
    try {
      ok('pg_ctl', ['-D', c.data, '-l', log, '-o', `-h '' -p 5432 -k ${c.socket}`, '-w', 'start']); c.started = true;
    } catch (error) {
      c.started = fs.existsSync(path.join(c.data, 'postmaster.pid'));
      throw Error(`${error.message}; local PostgreSQL: ${fs.readFileSync(log, 'utf8').slice(-1800)}`, { cause: error });
    }
    ok('psql', ['-X', '-h', c.socket, '-U', 'rehearsal_fixture', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], `create database ${db};`);
    assert.equal(fs.realpathSync(sql(c, 'show data_directory;')), fs.realpathSync(c.data));
    assert.equal(sql(c, 'show listen_addresses;'), '');
    assert.match(sql(c, 'show server_version;'), /^16\.15(?:\s|$)/);
    sql(c, `create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create role sales_attestor_owner nologin; create role sales_mv_reader nologin;
      ${[...reviewers, caller].map(role => `create role ${role} login noinherit password ${q(passwords[role])};`).join('\n')}`);
    assert.equal(sql(c, `select count(*) from pg_hba_file_rules where line_number=1 and auth_method='scram-sha-256' and error is null;`), '1');
    for (const role of [...reviewers, caller]) {
      assert.equal(sql(c, 'select session_user||\'|\'||current_user;', role), `${role}|${role}`);
      const bad = spawnSync(path.join(bin, 'psql'), args(c, role), { env: { ...env, PGPASSWORD: 'wrong-synthetic-only' }, encoding: 'utf8', input: 'select 1;', timeout: 10000 });
      assert.equal(bad.status, 2); assert.match(bad.stderr, /password authentication failed/);
      assert.equal(sql(c, `select rolpassword like 'SCRAM-SHA-256$%' from pg_authid where rolname=${q(role)};`), 't');
    }
  };
  const closed = c => {
    const before = exact(c);
    for (const role of [caller, ...reviewers]) for (const fn of ['commit_sales_snapshot_v2(null::uuid)',
      `commit_sales_snapshot_with_evidence_v1(null::uuid,'{"verified":true}')`, 'sync_sales_batch(null::jsonb,null::uuid)', 'finalize_sales_snapshot(null::uuid)']) {
      denied(c, `select public.${fn};`, role);
    }
    // A legitimate fixture service-role principal ALREADY has only the closed
    // overlay EXECUTE; caller receives no legacy/public grant, even temporarily.
    for (const fn of ['commit_sales_snapshot_v2(null::uuid)', `commit_sales_snapshot_with_evidence_v1(null::uuid,'{"verified":true}')`]) {
      denied(c, `begin; set local role service_role; select public.${fn};`, undefined, '55000', 'SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE');
    }
    denied(c, `select sales_rehearsal_private.commit('00000000-0000-4000-8000-000000000099');`, caller, '55000', 'SALES_REHEARSAL_AUTHORITY_REQUIRED');
    assert.deepEqual(exact(c), before, 'Closed boundaries changed rows/catalog/ACLs');
  };
  const install = (c, file) => sql(c, read(file).replace(rollback, 'commit;'));
  const review = (c, candidate, role) => JSON.parse(sql(c,
    `select sales_attestor_private.review('${candidate.run}',${j(candidate.binding)});`, role));
  let secret;
  const observe = async (value = payload(), response) => {
    let calls = 0;
    const observation = await capturePreparedPrivateSalesSheet(secret, { fetchImpl: async (url, init) => {
      ++calls;
      assert.ok(calls <= 2, 'no retries');
      if (calls === 1) {
        assert.equal(url, 'https://oauth2.googleapis.com/token'); assert.equal(init.method, 'POST');
        return Response.json({ access_token: 'offline-synthetic-token', token_type: 'Bearer', expires_in: 3600 });
      }
      assert.equal(new URL(url).hostname, 'sheets.googleapis.com'); assert.equal(init.method, 'GET');
      return response ? response() : Response.json(value);
    } });
    assert.equal(calls, 2);
    return observation;
  };
  const derive = observation => deriveSalesProvenance({ capture: observation.capture, aliases, previous, now });
  const candidate = async (c, { mutateBinding, authority = true, alterAuthority, observation } = {}) => {
    observation ??= await observe();
    const provenance = await derive(observation);
    const matrix = JSON.parse(new TextDecoder().decode(canonicalSalesSourceBytes(observation.capture)))[8]
      .map(row => row.map(cell => cell[0] === 'blank' ? '' : cell[1]));
    const prepared = prepareSalesRecovery(matrix, { previous, now });
    const run = sql(c, `select public.begin_sales_snapshot_v2(${q(prepared.manifestJson)}::jsonb);`);
    for (const batch of prepared.batches) sql(c, `select public.stage_sales_batch_v2('${run}',${batch.batchNo},${q(batch.json)}::jsonb);`);
    const generation = sql(c, 'select version from bi_import_private.generation;');
    const prior = { run_id: '00000000-0000-4000-8000-000000000000', receipt_sha256: hash('OFFLINE SYNTHETIC PRIOR ONLY'), generation };
    const binding = { kind: 'sales-accepted-source-review/synthetic-v1', run_id: run, prior,
      base_generation: generation, generation: String(BigInt(generation) + 1n), source_sha256: provenance.sourceSha256,
      raw_rows: String(provenance.rawRows), min_date: provenance.minDate, max_date: provenance.maxDate,
      manifest_sha256: provenance.manifestSha256, warehouse_sha256: provenance.warehouseSha256,
      mapping_sha256: provenance.mappingSha256, canonical_rows: JSON.parse(provenance.canonicalRowsJson), aliases };
    if (mutateBinding) mutateBinding(binding);
    sql(c, `insert into sales_attestor_private.targets values('${run}',${j(binding)},
      encode(sha256(convert_to((${j(binding)})::text,'UTF8')),'hex'),clock_timestamp()+interval '1 hour');`);
    // Preserve exact JSON numeric lexemes; never Number-parse monetary payloads.
    const auth = { manifest: prepared.manifestJson, payloadJson: prepared.batches[0].json, prior };
    if (alterAuthority) alterAuthority(auth);
    if (authority) sql(c, `insert into sales_rehearsal_private.authorities values('${run}','OFFLINE_SYNTHETIC_ONLY',${q(auth.manifest)},
      ${q(auth.payloadJson)}::jsonb,encode(sha256(convert_to((${j(binding)})::text,'UTF8')),'hex'),${j({ fixture: 'OFFLINE_SYNTHETIC_ONLY', prior: auth.prior })});`);
    return { run, binding, prepared, provenance, observation };
  };
  const promoteSQL = run => `select sales_rehearsal_private.commit('${run}');`;
  const denyPromotion = (c, candidate, message) => {
    const before = exact(c);
    denied(c, promoteSQL(candidate.run), caller, '55000', message);
    assert.deepEqual(exact(c), before, 'Failed promotion changed facts/dimensions/MVs/generation/runs/evidence/ACL/sequences');
  };
  const reviewObservation = async (c, candidate, observation, role) => {
    const independent = await derive(observation);
    if (independent.sourceSha256 !== candidate.binding.source_sha256 || independent.manifestSha256 !== candidate.binding.manifest_sha256 ||
      independent.warehouseSha256 !== candidate.binding.warehouse_sha256 || independent.mappingSha256 !== candidate.binding.mapping_sha256 ||
      independent.rawRows !== Number(candidate.binding.raw_rows) || independent.minDate !== candidate.binding.min_date ||
      independent.maxDate !== candidate.binding.max_date || independent.canonicalRowsJson !== JSON.stringify(candidate.binding.canonical_rows)) {
      throw Error('OFFLINE_REHEARSAL_OBSERVATION_CHANGED');
    }
    return review(c, candidate, role);
  };
  // Adversarial policy fixtures below deliberately use direct reviews so SQL's
  // independent canonical/manifest/root gates, rather than this JS guard, reject.
  const both = (c, candidate) => reviewers.map(role => review(c, candidate, role));
  try {
    start(source);
    sql(source, 'create schema extensions;');
    const schema = read('supabase/schema.sql');
    sql(source, schema.split('insert into map_location_source')[0]);
    sql(source, schema.match(/create table if not exists location_lifecycle_registry[\s\S]*?\);/)[0]);
    sql(source, 'alter table public.location_lifecycle_registry enable row level security;');
    sql(source, read('supabase/migrations/20261008_warehouse_runtime.sql').split('create or replace function public.bi_sales_snapshot')[0]);
    sql(source, 'create materialized view public.bi_sales_flat_mv as select * from public.bi_sales_flat;');
    install(source, 'docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql');
    install(source, 'docs/sql/issue-43-sales-accepted-source-gate-NOT-APPLIED.sql');
    install(source, 'docs/sql/issue-43-sales-attestor-NOT-APPLIED.sql');
    // Fixture-only SELECT policies for MV owner. Keep RLS ON and grants/owners
    // exact through restore. pg_restore's default row_security=off cannot refresh
    // these MVs under their nonsuperuser owner even though SELECT is authorized.
    sql(source, `grant usage on schema public to sales_mv_reader;
      grant select on all tables in schema public to sales_mv_reader;
      ${['dim_date', 'dim_brand', 'dim_ownership', 'dim_location', 'dim_channel', 'dim_order_type', 'fact_sales_daily'].map(table =>
        `create policy rehearsal_mv_read on public.${table} for select to sales_mv_reader using (true);`).join('\n')}
      alter materialized view public.bi_sales_flat_mv owner to sales_mv_reader;
      alter materialized view public.agg_sales_monthly owner to sales_mv_reader;
      alter materialized view public.agg_sales_weekly owner to sales_mv_reader;
      insert into public.map_location_source values('Synthetic alias','Synthetic location',true,null);
      insert into public.location_lifecycle_registry(canonical_name,status,lfl_exclude) values('Synthetic location','closed',true);
      insert into sales_attestor_private.reviewers values('sales_reviewer_a','independent-A'),('sales_reviewer_b','independent-B');`);
    const base = exact(source);
    await t.test('default rollback and fixture-only installation preserve all existing objects and privileges', () => {
      sql(source, draft); assert.deepEqual(exact(source), base);
      sql(source, draft.replace(rollback, 'commit;'));
      const after = catalog(source);
      for (const field of ['schemas', 'relations', 'sequences', 'functions', 'constraints', 'indexes', 'triggers', 'policies']) {
        after[field] = after[field]?.filter(row => !JSON.stringify(row).includes('sales_rehearsal_private')) ?? null;
        if (after[field]?.length === 0) after[field] = null;
      }
      assert.deepEqual(after, base.catalog);
      assert.deepEqual(rows(source).filter(row => !row.name.startsWith('sales_rehearsal_private.')), base.rows);
      closed(source);
    });
    // Synthetic ephemeral RSA material, no source credential is created/read.
    const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    const der = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    secret = JSON.stringify({ type: 'service_account', project_id: 'myastoriya-bi', client_email: SERVICE_ACCOUNT,
      token_uri: 'https://oauth2.googleapis.com/token', private_key_id: 'a'.repeat(40),
      private_key: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString('base64')}\n-----END PRIVATE KEY-----\n` });
    let accepted;
    await t.test('two separately captured observations and SCRAM LOGIN receipts authorize one narrow synthetic promotion', async () => {
      const first = await observe(), second = await observe();
      assert.notEqual(first.capture, second.capture); assert.equal(first.sourceSha256, second.sourceSha256);
      const a = await derive(first), b = await derive(second); assert.deepEqual(a, b);
      accepted = await candidate(source, { observation: first });
      denyPromotion(source, accepted, 'SALES_REHEARSAL_TWO_REVIEWS_REQUIRED');
      const receiptA = await reviewObservation(source, accepted, first, reviewers[0]);
      denyPromotion(source, accepted, 'SALES_REHEARSAL_TWO_REVIEWS_REQUIRED');
      const receiptB = await reviewObservation(source, accepted, second, reviewers[1]);
      assert.notEqual(receiptA.reviewer, receiptB.reviewer);
      assert.notEqual(receiptA.independence_group, receiptB.independence_group);
      for (const receipt of [receiptA, receiptB]) {
        assert.deepEqual(receipt.binding, accepted.binding);
        assert.equal(sql(source, `select encode(sha256(convert_to(jsonb_build_array('sales-review-receipt/synthetic-v1',
          run_id,reviewer,independence_group,binding_sha256,observed_at)::text,'UTF8')),'hex')=receipt_sha256
          from sales_attestor_private.receipts where run_id='${accepted.run}' and reviewer=${q(receipt.reviewer)};`), 't');
      }
      assert.equal(sql(source, 'select version from bi_import_private.generation;'), '0');
      const result = JSON.parse(sql(source, promoteSQL(accepted.run), caller));
      assert.equal(result.fixture, 'OFFLINE_SYNTHETIC_ONLY'); assert.equal(result.generation, '1');
      assert.equal(result.source_sha256, a.sourceSha256); assert.equal(result.manifest_sha256, a.manifestSha256);
      assert.equal(result.warehouse_sha256, a.warehouseSha256); assert.equal(result.mapping_sha256, a.mappingSha256);
      assert.deepEqual(JSON.parse(sql(source, 'select sales_rehearsal_private.warehouse_rows();')), JSON.parse(a.canonicalRowsJson));
      // Independent joined SQL, not the draft's canonical helper, for readback.
      const independent = JSON.parse(sql(source, `select json_agg(w order by w::text collate "C") from (
        select array[f.date_id::text,l.canonical_name,b.name,o.name,c.channel_group,c.channel_name,ot.name,
          (f.revenue*100)::numeric(30,0)::text,f.checks::numeric(30,0)::text,(f.markup*100)::numeric(30,0)::text] w
        from public.fact_sales_daily f join public.dim_location l on l.id=f.location_id
          join public.dim_brand b on b.id=f.brand_id join public.dim_ownership o on o.id=f.ownership_id
          join public.dim_channel c on c.id=f.channel_id join public.dim_order_type ot on ot.id=f.order_type_id) independent;`));
      assert.deepEqual(independent, JSON.parse(a.canonicalRowsJson));
      assert.equal(hash(JSON.stringify(['sales-warehouse-cents/v1', independent])), a.warehouseSha256);
      assert.equal(sql(source, `select status||'|'||rows_read||'|'||rows_loaded||'|'||rows_rejected||'|'||source_cutoff_date
        from public.import_runs where id='${accepted.run}';`), 'success|3|2|0|2026-10-26');
      assert.deepEqual(JSON.parse(sql(source, `select details->'binding' from public.import_runs where id='${accepted.run}';`)), accepted.binding);
      for (const table of ['fact_sales_daily', 'bi_sales_flat', 'bi_sales_flat_mv', 'agg_sales_monthly', 'agg_sales_weekly']) {
        assert.equal(sql(source, `select sum(revenue)::text||'|'||sum(checks)::text||'|'||sum(markup)::text from public.${table};`),
          '90071992547410.11|4.00|-0.02');
      }
      closed(source);
    });
    await t.test('valid DML reaches ACL/RLS; actual bypass negative control is detected and rolls back exactly', () => {
      const before = exact(source);
      const dml = 'update public.fact_sales_daily set revenue=revenue+0.01 returning revenue;';
      denied(source, dml, caller); assert.deepEqual(exact(source), before);
      for (const role of [...reviewers, caller]) {
        denied(source, `set role rehearsal_fixture;`, role);
        denied(source, `set session authorization rehearsal_fixture;`, role);
        denied(source, `insert into sales_rehearsal_private.authorities select * from sales_rehearsal_private.authorities;`, role);
      }
      // Structurally identical update actually succeeds under fixture-only
      // temporary grants+RLS policy. No structural/identity error can mask it.
      const control = invoke('psql', args(source), `begin;
        grant select,update(revenue) on public.fact_sales_daily to ${caller};
        create policy rehearsal_negative_control on public.fact_sales_daily for all to ${caller} using(true) with check(true);
        set local role ${caller}; ${dml} rollback;`);
      assert.equal(control.status, 0, control.stderr); assert.equal(control.stdout.trim().split('\n').length, 2);
      assert.throws(() => parseError(control, '42501'), assert.AssertionError);
      assert.deepEqual(exact(source), before); denied(source, dml, caller); assert.deepEqual(exact(source), before);
    });
    await t.test('auth 401, partial and oversized source responses, changed capture and forged review leave all state exact', async () => {
      for (const response of [() => new Response('offline', { status: 401 }), () => new Response('{}', { status: 206 }),
        () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': String(32 * 1024 * 1024 + 1) } })]) {
        const before = exact(source);
        await assert.rejects(observe(payload(), response), { message: 'SALES_CAPTURE_FAILED' });
        assert.deepEqual(exact(source), before);
      }
      const authBaseline = exact(source);
      let authCalls = 0;
      await assert.rejects(capturePreparedPrivateSalesSheet(secret, { fetchImpl: async () => {
        ++authCalls; return new Response('offline', { status: 401 });
      } }), { message: 'SALES_CAPTURE_FAILED' });
      assert.equal(authCalls, 1); assert.deepEqual(exact(source), authBaseline);
      const changed = payload(); changed.values[2][11] = '0.11';
      const a = await observe(), b = await observe(changed);
      const next = await candidate(source, { observation: a });
      await reviewObservation(source, next, a, reviewers[0]);
      const before = exact(source);
      await assert.rejects(reviewObservation(source, next, b, reviewers[1]), { message: 'OFFLINE_REHEARSAL_OBSERVATION_CHANGED' });
      assert.deepEqual(exact(source), before);
      const staged = exact(source);
      for (const key of Object.keys(next.binding)) {
        denied(source, `select sales_attestor_private.review('${next.run}',${j({ ...next.binding, [key]: null })});`, reviewers[0],
          '42501', 'SALES_ATTESTOR_UNTRUSTED_BINDING');
        assert.deepEqual(exact(source), staged);
      }
      denyPromotion(source, next, 'SALES_REHEARSAL_TWO_REVIEWS_REQUIRED');
    });
    await t.test('missing authority, synthetic prior/root, identity, alias, manifest, staging and historical mismatches fail closed', async () => {
      const missing = await candidate(source, { authority: false }); both(source, missing);
      denyPromotion(source, missing, 'SALES_REHEARSAL_AUTHORITY_REQUIRED');
      for (const [options, message] of [
        [{ mutateBinding: binding => { binding.prior.receipt_sha256 = hash('unreviewed root'); },
          alterAuthority: auth => { auth.prior = { ...auth.prior, receipt_sha256: hash('OFFLINE SYNTHETIC PRIOR ONLY') }; } }, 'SALES_REHEARSAL_BINDING_MISMATCH'],
        [{ mutateBinding: binding => { binding.canonical_rows[0][2] = 'Other identity'; } }, 'SALES_REHEARSAL_CANONICAL_MISMATCH'],
        [{ mutateBinding: binding => { binding.aliases = [['Synthetic alias', 'Other location']]; } }, 'SALES_REHEARSAL_CANONICAL_MISMATCH'],
        [{ mutateBinding: binding => { binding.manifest_sha256 = hash('other manifest'); } }, 'SALES_REHEARSAL_MANIFEST_MISMATCH'],
        [{ alterAuthority: auth => { auth.payloadJson = auth.payloadJson.replace('Historical fixture', 'Other staged identity'); } }, 'SALES_REHEARSAL_STAGE_MISMATCH']
      ]) {
        const next = await candidate(source, options); both(source, next); denyPromotion(source, next, message);
      }
      const changed = payload(); changed.values[1][7] = 'Lost historical identity';
      const next = await candidate(source, { observation: await observe(changed) }); both(source, next);
      denyPromotion(source, next, 'SALES_REHEARSAL_HISTORICAL_IDENTITY');
      const aliasCandidate = await candidate(source); both(source, aliasCandidate);
      // Administrative fixture change is in the SAME rollback-only transaction.
      const before = exact(source);
      denied(source, `begin; update public.map_location_source set canonical_name='Changed alias';
        set session authorization ${caller}; ${promoteSQL(aliasCandidate.run)}`, undefined, '55000', 'SALES_REHEARSAL_CANONICAL_MISMATCH');
      assert.deepEqual(exact(source), before);
    });
    await t.test('stale replay and competing run IDs serialize to exactly ONE successful new generation', async () => {
      denyPromotion(source, accepted, 'SALES_REHEARSAL_STALE_GENERATION');
      const a = await candidate(source), b = await candidate(source); both(source, a); both(source, b);
      const gen = BigInt(sql(source, 'select version from bi_import_private.generation;'));
      const beforeFacts = JSON.parse(sql(source, 'select sales_rehearsal_private.warehouse_rows();'));
      const beforeReceipts = rows(source).filter(row => row.name.startsWith('sales_attestor_private.'));
      // Hold the generation row until BOTH actual caller backends report a
      // PostgreSQL Lock wait; this is contention evidence, not a timing guess.
      const results = await lockedRace(source, [promoteSQL(a.run), promoteSQL(b.run)]);
      assert.deepEqual(results.map(result => result.status).sort(), [0, 3], results.map(result => result.stderr).join('\n'));
      parseError(results.find(result => result.status === 3), '55000', 'SALES_REHEARSAL_STALE_GENERATION');
      assert.equal(sql(source, 'select version from bi_import_private.generation;'), String(gen + 1n));
      assert.equal(sql(source, `select count(*) from public.import_runs where id in ('${a.run}','${b.run}') and status='success';`), '1');
      assert.equal(sql(source, `select count(*) from bi_import_private.sales_runs where id in ('${a.run}','${b.run}') and state='committed';`), '1');
      assert.deepEqual(JSON.parse(sql(source, 'select sales_rehearsal_private.warehouse_rows();')), beforeFacts);
      assert.equal(sql(source, 'select count(*) from public.fact_sales_daily;'), '2');
      assert.deepEqual(rows(source).filter(row => row.name.startsWith('sales_attestor_private.')), beforeReceipts);
      for (const next of [a, b]) denyPromotion(source, next, 'SALES_REHEARSAL_STALE_GENERATION');
      const same = await candidate(source); both(source, same);
      const sameResults = await lockedRace(source, [promoteSQL(same.run), promoteSQL(same.run)]);
      assert.deepEqual(sameResults.map(result => result.status).sort(), [0, 3]);
      parseError(sameResults.find(result => result.status === 3), '55000', 'SALES_REHEARSAL_STALE_GENERATION');
      assert.equal(sql(source, 'select version from bi_import_private.generation;'), String(gen + 2n));
      denyPromotion(source, same, 'SALES_REHEARSAL_STALE_GENERATION');
    });
    await t.test('failure and cancellation after changed facts, MVs, runs and dimension mutation roll back without deleting history', async () => {
      const changed = payload(); changed.values[2][11] = '0.11';
      const next = await candidate(source, { observation: await observe(changed) }); both(source, next);
      // All existing IDs retained: these probes do not allocate a sequence value.
      // Trigger fires AFTER facts/MVs/import_runs/sales_runs, before generation.
      for (const [body, state, message] of [
        ["raise exception using errcode='P0001',message='SYNTHETIC_MID_TRANSACTION';", 'P0001', 'SYNTHETIC_MID_TRANSACTION'],
        ['perform pg_sleep(20);', '57014', 'canceling statement due to statement timeout']
      ]) {
        sql(source, `create function sales_rehearsal_private.fail_generation() returns trigger language plpgsql as $$begin
          if (select sum(revenue) from public.fact_sales_daily)<>90071992547410.12
            or (select sum(revenue) from public.agg_sales_monthly)<>90071992547410.12
            or (select status from public.import_runs where id='${next.run}')<>'success'
            or (select state from bi_import_private.sales_runs where id='${next.run}')<>'committed' then
            raise exception using errcode='55000',message='MID_TRANSACTION_PROBE_TOO_EARLY';end if;
          insert into public.dim_brand(name) values('Rolled back dimension');
          update public.dim_location set city='Rolled back city'; ${body} return new;end$$;
          revoke all on function sales_rehearsal_private.fail_generation() from PUBLIC;
          create trigger rehearsal_failure before update on bi_import_private.generation for each row
            execute function sales_rehearsal_private.fail_generation();`);
        const before = exact(source);
        denied(source, `set statement_timeout='1000ms'; ${promoteSQL(next.run)}`, caller, state, message);
        assert.deepEqual(exact(source), before, 'Mid-transaction rollback was incomplete');
        sql(source, 'drop trigger rehearsal_failure on bi_import_private.generation; drop function sales_rehearsal_private.fail_generation();');
      }
      const before = exact(source);
      // Negative bypass/control: an actual successful uncommitted promotion is
      // rejected by the SAME error parser; explicit ROLLBACK restores all state.
      const control = invoke('psql', args(source, caller), `begin; ${promoteSQL(next.run)} rollback;`, caller);
      assert.equal(control.status, 0, control.stderr);
      assert.throws(() => parseError(control, '55000'), assert.AssertionError);
      assert.deepEqual(exact(source), before);
    });
    await t.test('native source-stop restore preserves exact rows hashes owners effective privileges sequences and closed guards', () => {
      closed(source);
      const baseline = exact(source);
      assert.equal(baseline.rows.filter(row => row.kind === 'm').length, 3);
      assert.ok(baseline.rows.some(row => row.kind === 'S' && row.name.includes('fact_sales_daily')));
      const archive = path.join(dir, 'synthetic.dump');
      const connection = c => ['-h', c.socket, '-p', '5432', '-U', 'rehearsal_fixture', '-d', db];
      ok('pg_dump', [...connection(source), '--format=custom', '--file', archive]);
      assert.ok(fs.statSync(archive).size > 0);
      ok('pg_ctl', ['-D', source.data, '-m', 'fast', '-w', 'stop']); source.started = false;
      start(restored);
      assert.notEqual(fs.realpathSync(source.data), fs.realpathSync(restored.data));
      const empty = exact(restored);
      const failed = invoke('pg_restore', [...connection(restored), '--exit-on-error', '--single-transaction', archive]);
      assert.notEqual(failed.status, 0, 'Default restore must reproduce RLS failure; cannot silently bypass');
      assert.match(failed.stderr, /query would be affected by row-level security policy/);
      assert.match(failed.stderr, /REFRESH MATERIALIZED VIEW public\.(?:agg_sales_monthly|agg_sales_weekly|bi_sales_flat_mv)/);
      assert.deepEqual(exact(restored), empty, 'Failed single-transaction restore left partial data/ACLs');
      // NARROW native option: retain RLS, SELECT policies, original owners and
      // ACLs. Do not --no-owner, disable triggers, drop policies or BYPASSRLS.
      ok('pg_restore', [...connection(restored), '--exit-on-error', '--single-transaction', '--enable-row-security', archive]);
      assert.deepEqual(exact(restored), baseline, 'Native complete restore parity');
      closed(restored);
      denyPromotion(restored, accepted, 'SALES_REHEARSAL_STALE_GENERATION');
      for (const role of reviewers) {
        assert.deepEqual(JSON.parse(sql(restored, `select sales_attestor_private.read_receipt('${accepted.run}');`, role)),
          JSON.parse(sql(restored, `select to_jsonb(r) from sales_attestor_private.receipts r where run_id='${accepted.run}' and reviewer=${q(role)};`)));
      }
      const before = exact(restored);
      denied(restored, 'truncate sales_attestor_private.receipts cascade;', undefined, '42501', 'SALES_ATTESTOR_IMMUTABLE');
      denied(restored, 'truncate sales_rehearsal_private.authorities;', undefined, '42501', 'SALES_ATTESTOR_IMMUTABLE');
      assert.deepEqual(exact(restored), before);
      console.log(`OFFLINE SYNTHETIC rehearsal; native PostgreSQL ${sql(restored, 'show server_version;')}; ${baseline.rows.length} relations/sequences restored exactly. Production NOT READY FOR GATE.`);
    });
  } finally {
    const errors = [];
    for (const c of clusters) if (c.started) {
      try { ok('pg_ctl', ['-D', c.data, '-m', 'immediate', '-w', 'stop']); c.started = false; }
      catch (error) { errors.push(error); }
    }
    if (!errors.length) fs.rmSync(dir, { recursive: true, force: true });
    else throw new AggregateError(errors, 'Disposable PostgreSQL cleanup failed');
  }
});
