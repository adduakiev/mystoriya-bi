import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createPreparedSalesTransport } from '../../supabase/functions/sync-google-sheet/prepared-sales-transport.mjs';
import { prepareSalesRecovery } from '../../supabase/functions/sync-google-sheet/prepared-sales-recovery.mjs';
import { SPREADSHEET_ID } from '../../supabase/functions/sync-google-sheet/google-sheet-reader.mjs';

const origin = 'https://rxewpevxqtfmksybykvo.supabase.co';
const priorId = '11111111-1111-4111-8111-111111111111';
const nextId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-11-01T12:00:00Z');
const jwt = (changes = {}) => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role: 'service_role', ref: 'rxewpevxqtfmksybykvo', exp: 4102444800, ...changes })).toString('base64url'), 'synthetic'].join('.');
const header = ['', '', '', '', '', 'Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка', 'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
const row = (name = 'Synthetic', money = '90071992547409.91') => ['', '', '', '', '', '2026-10-31', name, 'Fixture', 'Owned', 'Заклад', 'Sale', money, '1', '-0.03'];
const matrix = () => [header, row()];
const run = () => ({ id: priorId, source_name: 'google_sheets:Данние короткі', status: 'success',
  started_at: '2026-11-01T00:00:00Z', finished_at: '2026-11-01T00:01:00Z', source_cutoff_date: '2026-10-31',
  rows_read: 1, rows_loaded: 1, rows_rejected: 0,
  details: { atomic: true, snapshot: { warehouse_rows: 1, min_date: '2026-10-31', max_date: '2026-10-31' },
    accepted_source_v1: { run_id: priorId, spreadsheet_id: SPREADSHEET_ID, range: "'Данние короткі'!A:N",
      raw_rows: 1, min_date: '2026-10-31', max_date: '2026-10-31', observed_at: '2026-11-01T00:00:30Z', sha256: 'a'.repeat(64) } } });
const fact = (id = 1) => ({ id, date_id: '2026-10-31', import_run_id: priorId });
const json = (value, range) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json', ...(range ? { 'content-range': range } : {}) } });
function fixture({ readRun = run, readFacts = () => json([fact()], '0-0/1'), source = matrix, ...options } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, ...init });
    const parsed = new URL(url);
    assert.equal(parsed.origin, origin);
    if (parsed.pathname.endsWith('/import_runs')) return json([readRun()], '0-0/1');
    if (parsed.pathname.endsWith('/fact_sales_daily')) return readFacts(parsed);
    assert.fail('unexpected endpoint');
  };
  const transport = createPreparedSalesTransport({ enabled: true, baseUrl: origin, serviceRoleKey: jwt(), fetchImpl,
    readSourceImpl: async (_, opts) => { assert.ok(opts.signal instanceof AbortSignal); return source(); }, ...options });
  return { transport, calls, writes: () => calls.filter(c => c.method === 'POST') };
}

test('disabled by default; exact origin and explicit service-role auth boundary', () => {
  assert.throws(() => createPreparedSalesTransport(), /DISABLED/);
  for (const baseUrl of [undefined, origin + '/', origin + '@evil.invalid', origin.replace('https:', 'http:'), origin + '?x']) {
    assert.throws(() => fixture({ baseUrl }), /INVALID_CONFIG/);
  }
  for (const serviceRoleKey of [undefined, '', 'secret-canary\r\nx: leak', jwt({ role: 'anon' }), jwt({ role: 'authenticated' }), jwt({ ref: 'other' }), jwt({ exp: 1 })]) {
    assert.throws(() => fixture({ serviceRoleKey }), /INVALID_AUTH/);
  }
});

test('private preparation preserves exact decimal bodies without issuing RPCs', async () => {
  const f = fixture();
  const result = await f.transport.prepare({ now });
  const expected = prepareSalesRecovery(matrix(), { previous: { rawRows: 1, minDate: '2026-10-31', maxDate: '2026-10-31' }, now });
  assert.deepEqual(result.prepared, expected);
  assert.deepEqual(result.baseline, { runId: priorId, rawRows: 1, minDate: '2026-10-31', maxDate: '2026-10-31' });
  assert.match(result.prepared.batches[0].json, /"revenue":90071992547409\.91/);
  assert.match(result.prepared.batches[0].json, /"markup":-0\.03/);
  assert.ok(Object.isFrozen(result));
  assert.equal(f.writes().length, 0);
  for (const call of f.calls) {
    assert.equal(call.method, 'GET'); assert.equal(call.body, undefined);
    assert.equal(call.redirect, 'error'); assert.equal(call.credentials, 'omit'); assert.equal(call.cache, 'no-store');
    assert.equal(call.headers.apikey, jwt()); assert.equal(call.headers.Authorization, `Bearer ${jwt()}`);
    assert.equal(call.headers['Accept-Profile'], 'public');
    assert.ok(call.signal instanceof AbortSignal);
    assert.equal(new URL(call.url).searchParams.has('apikey'), false);
  }
});

test('missing source provenance in current import_runs fails closed even when warehouse snapshot exists', async () => {
  for (const change of [r => { delete r.details.accepted_source_v1; }, r => { r.details = {}; },
    r => { r.details.accepted_source_v1.min_date = null; }, r => { r.details.accepted_source_v1.spreadsheet_id = 'other'; },
    r => { r.details.accepted_source_v1.run_id = nextId; }, r => { r.details.accepted_source_v1.raw_rows = 2; },
    r => { r.details.accepted_source_v1.observed_at = '2026-11-02T00:00:00Z'; }, r => { r.rows_rejected = 1; },
    r => { r.started_at = '2026-02-30T00:00:00Z'; }, r => { r.finished_at = '2026-11-01T00:01:00'; },
    r => { r.status = 'running'; }, r => { r.source_name = 'other'; }, r => { r.details.snapshot.min_date = '2024-01-01'; }]) {
    let sourceReads = 0;
    const f = fixture({ readRun: () => { const r = run(); change(r); return r; }, source: () => { sourceReads++; return matrix(); } });
    await assert.rejects(f.transport.prepare({ now, previous: { rawRows: 1, minDate: '2026-10-31', maxDate: '2026-10-31' } }), /SALES_TRANSPORT_/);
    assert.equal(sourceReads, 0); assert.equal(f.writes().length, 0);
  }
});

test('missing, wrong content type, redirect, oversized, malformed and partial baseline responses are sanitized', async () => {
  for (const response of [() => json([], '*/0'), () => json([run()]), () => json([run(), run()], '0-1/2'),
    () => new Response('upstream-canary', { status: 401 }), () => new Response('upstream-canary', { status: 302 }),
    () => new Response('upstream-canary'), () => json({ x: 'upstream-canary'.repeat(10000) }),
    () => new Response('{broken', { headers: { 'content-type': 'application/json' } }),
    () => { throw Error('upstream-canary'); }]) {
    const f = fixture({ fetchImpl: response });
    await assert.rejects(f.transport.prepare({ now }), e => /^SALES_TRANSPORT_[A-Z_]+$/.test(e.message));
    assert.equal(f.writes().length, 0);
  }
});

test('full warehouse pagination requires exact counts, ordered unique IDs, accepted run and date bounds', async () => {
  const r = run(); r.rows_read = 1001; r.rows_loaded = 1001;
  r.details.accepted_source_v1.raw_rows = 1001; r.details.snapshot.warehouse_rows = 1001;
  const f = fixture({ readRun: () => r, readFacts: parsed => {
    const offset = Number(parsed.searchParams.get('offset'));
    assert.equal(parsed.searchParams.get('order'), 'id.asc');
    return offset === 0 ? json(Array.from({ length: 1000 }, (_, i) => fact(i + 1)), '0-999/1001') : json([fact(1001)], '1000-1000/1001');
  } });
  assert.deepEqual(await f.transport.readBaseline({ now }), { runId: priorId, rawRows: 1001, minDate: '2026-10-31', maxDate: '2026-10-31' });
  for (const response of [() => json([null], '0-0/1'), () => json([], '0-0/1'), () => json([fact()], '0-0/*'), () => json([fact()], '0-0/2'),
    () => json([{ ...fact(), import_run_id: nextId }], '0-0/1'), () => json([{ ...fact(), date_id: '2026-10-30' }], '0-0/1'),
    () => json([{ ...fact(), id: 9007199254740992 }], '0-0/1')]) {
    const bad = fixture({ readFacts: response });
    await assert.rejects(bad.transport.prepare({ now }), /SALES_TRANSPORT_/); assert.equal(bad.writes().length, 0);
  }
  const duplicate = fixture({ readRun: () => r, readFacts: () => json(Array.from({ length: 1000 }, () => fact()), '0-999/1001') });
  await assert.rejects(duplicate.transport.readBaseline({ now }), /WAREHOUSE_IDENTITY/);
});

test('baseline changes during read or source preparation prevent all staged writes', async () => {
  for (const changeAt of [2, 3]) {
    let reads = 0;
    const f = fixture({ readRun: () => { const r = run(); if (++reads >= changeAt) r.finished_at = '2026-11-01T00:02:00Z'; return r; } });
    await assert.rejects(f.transport.prepare({ now }), /BASELINE_CHANGED/); assert.equal(f.writes().length, 0);
  }
});

test('source errors, partial source and aborted requests never begin staging', async () => {
  for (const source of [() => { throw Error('source-canary'); }, () => [header], () => { const r = row(); r[11] = ''; return [header, r]; }]) {
    const f = fixture({ source }); await assert.rejects(f.transport.prepare({ now })); assert.equal(f.writes().length, 0);
  }
  const controller = new AbortController(); controller.abort();
  const f = fixture(); await assert.rejects(f.transport.prepare({ now, signal: controller.signal }), /ABORTED/); assert.equal(f.calls.length, 0);
  const during = new AbortController();
  const g = fixture({ source: () => { during.abort(); return matrix(); } });
  await assert.rejects(g.transport.prepare({ now, signal: during.signal }), /ABORTED/); assert.equal(g.writes().length, 0);
});

test('deadline covers ignored fetch/body/source abort and external abort stops an in-flight read', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), () => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'application/json' } })]) {
    const f = fixture({ fetchImpl, timeoutMs: 10 });
    await assert.rejects(f.transport.prepare({ now }), /REQUEST_FAILED|RESPONSE_REJECTED/);
  }
  const f = fixture({ readSourceImpl: () => new Promise(() => {}), timeoutMs: 10 });
  await assert.rejects(f.transport.prepare({ now }), /SOURCE_READ_FAILED/); assert.equal(f.writes().length, 0);
  const controller = new AbortController();
  const g = fixture({ fetchImpl: () => { setTimeout(() => controller.abort(), 5); return new Promise(() => {}); } });
  await assert.rejects(g.transport.readBaseline({ now, signal: controller.signal }), /ABORTED/);
});

test('unreferenced from all active runtime code; API gate pinned and Edge gate stripped of all legacy writers', () => {
  const root = new URL('../../', import.meta.url);
  function walk(dir) { return fs.readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap(e => e.isDirectory() && !['node_modules', '.next'].includes(e.name) ? walk(`${dir}/${e.name}`) : e.isFile() ? [`${dir}/${e.name}`] : []); }
  for (const file of [...walk('web/app'), ...walk('web/lib'), ...walk('web/components'), ...walk('supabase/functions')].filter(f => /\.[cm]?[jt]sx?$/.test(f) && !['prepared-sales-transport.mjs', 'prepared-sales-cutover.mjs'].some(name => f.endsWith('/' + name)))) {
    assert.doesNotMatch(fs.readFileSync(new URL(file, root), 'utf8'), /prepared-sales-transport|createPreparedSalesTransport/);
  }
  const api = fs.readFileSync(new URL('web/app/api/data-sync/route.ts', root), 'utf8');
  assert.match(api, /SALES_IMPORT_SAFETY_GATE/); assert.match(api, /status: 503/);
  assert.equal(createHash('sha256').update(api).digest('hex'), '11b86897dc12bee12c904f799ed42dc9ee7bb8cfeee97e1a588c73ed3ca008d1');
  const edge = fs.readFileSync(new URL('supabase/functions/sync-google-sheet/index.ts', root), 'utf8');
  assert.match(edge, /SALES_IMPORT_SAFETY_GATE/); assert.match(edge, /status: 503/);
  assert.doesNotMatch(edge, /gviz\/tq|sync_sales_batch|finalize_sales_snapshot|\bimport_runs\b|\b(?:fetch|createClient)\s*\(|\bDeno\.env\b/);
  const content = fs.readFileSync(new URL('supabase/functions/sync-google-sheet/prepared-sales-transport.mjs', root), 'utf8');
  assert.doesNotMatch(content, /process\.env|Deno\.env|console\.|sync_sales_batch|finalize_sales_snapshot|rpc\//);
});


test('recovery rejects service-role-forged metadata, caller attestations and concurrent attempts before any I/O', async () => {
  const f = fixture({ source: () => assert.fail('source must not be read') });
  for (const input of [undefined, { now }, { enabled: true, verified: true, accepted_source_v1: run().details.accepted_source_v1 },
    { serviceRoleKey: jwt(), trustedContext: {}, evidence: { observations: [{ signatureHex: 'a'.repeat(128) }] } }]) {
    await assert.rejects(f.transport.recover(input), { message: 'SALES_TRANSPORT_ATTESTOR_UNAVAILABLE' });
  }
  const results = await Promise.allSettled([f.transport.recover(), f.transport.recover()]);
  assert.ok(results.every(r => r.status === 'rejected' && r.reason.message === 'SALES_TRANSPORT_ATTESTOR_UNAVAILABLE'));
  assert.equal(f.calls.length, 0);
});

test('accepted record recheck detects decimal metadata drift below JavaScript number precision', async () => {
  let reads = 0;
  const f = fixture({ fetchImpl: url => {
    if (new URL(url).pathname.endsWith('/import_runs')) {
      const raw = JSON.stringify([run()]).replace('"warehouse_rows":1', `"warehouse_rows":1,"revenue":90071992547409.${++reads === 1 ? '91' : '92'}`);
      return new Response(raw, { headers: { 'content-type': 'application/json', 'content-range': '0-0/1' } });
    }
    return json([fact()], '0-0/1');
  } });
  await assert.rejects(f.transport.readBaseline({ now }), /BASELINE_CHANGED/);
});
