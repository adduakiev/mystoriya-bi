import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createPreparedSalesCutover } from '../../supabase/functions/sync-google-sheet/prepared-sales-cutover.mjs';
import { SERVICE_ACCOUNT, SPREADSHEET_ID } from '../../supabase/functions/sync-google-sheet/google-sheet-reader.mjs';
import { verifyPreparedSalesReadback } from '../../supabase/functions/sync-google-sheet/prepared-sales-provenance.mjs';

// Ephemeral synthetic OAuth key: not an existing Google credential; never saved.
const rsa = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const keyBytes = await crypto.subtle.exportKey('pkcs8', rsa.privateKey);
const secret = JSON.stringify({ type: 'service_account', project_id: 'myastoriya-bi', client_email: SERVICE_ACCOUNT,
  token_uri: 'https://oauth2.googleapis.com/token', private_key_id: 'a'.repeat(40),
  private_key: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(keyBytes).toString('base64')}\n-----END PRIVATE KEY-----\n` });
const origin = 'https://rxewpevxqtfmksybykvo.supabase.co';
const priorId = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-11-01T12:00:00Z');
const jwt = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role: 'service_role', ref: 'rxewpevxqtfmksybykvo', exp: 4102444800 })).toString('base64url'), 'synthetic'].join('.');
const header = ['', '', '', '', '', 'Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка', 'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
const row = amount => [null, '', 2026, 'e\u0301', '', '2026-10-31', 'Synthetic', 'Fixture', 'Owned', 'Заклад', 'Sale', amount, 1, '-0.03'];
const payload = () => ({ range: "'Данние короткі'!A1:N1000", majorDimension: 'ROWS', values: [header, row('90071992547409.91'), row(0.1)] });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = (value, range) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json', ...(range ? { 'content-range': range } : {}) } });
const run = () => ({ id: priorId, source_name: 'google_sheets:Данние короткі', status: 'success',
  started_at: '2026-11-01T00:00:00Z', finished_at: '2026-11-01T00:01:00Z', source_cutoff_date: '2026-10-31',
  rows_read: 2, rows_loaded: 1, rows_rejected: 0,
  details: { atomic: true, snapshot: { warehouse_rows: 1, min_date: '2026-10-31', max_date: '2026-10-31' },
    // Deliberately forged. These values must NEVER authorize reservation/promotion.
    accepted_source_v1: { run_id: priorId, spreadsheet_id: SPREADSHEET_ID, range: "'Данние короткі'!A:N", raw_rows: 2,
      min_date: '2026-10-31', max_date: '2026-10-31', observed_at: '2026-11-01T00:00:30Z', sha256: 'a'.repeat(64) } } });
function fixture({ google, warehouse, ...changes } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const u = new URL(url);
    assert.equal(init.redirect, 'error');
    if (u.origin === origin) {
      assert.equal(init.method, 'GET'); assert.equal(init.body, undefined);
      assert.equal(init.headers.Authorization, `Bearer ${jwt}`);
      if (warehouse) return warehouse(url, init);
      if (u.pathname.endsWith('/import_runs')) return json([run()], '0-0/1');
      assert.ok(u.pathname.endsWith('/fact_sales_daily'));
      return json([{ id: 1, date_id: '2026-10-31', import_run_id: priorId }], '0-0/1');
    }
    assert.doesNotMatch(JSON.stringify(init.headers), /synthetic\./, 'DB token must not go to Google');
    if (u.origin === 'https://oauth2.googleapis.com') {
      assert.equal(url, 'https://oauth2.googleapis.com/token'); assert.equal(init.method, 'POST');
      const [h, p, s] = init.body.get('assertion').split('.');
      const claims = JSON.parse(Buffer.from(p, 'base64url'));
      assert.equal(claims.scope, 'https://www.googleapis.com/auth/spreadsheets.readonly');
      assert.equal(claims.iss, SERVICE_ACCOUNT); assert.equal(claims.aud, url);
      assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', rsa.publicKey, Buffer.from(s, 'base64url'),
        new TextEncoder().encode(`${h}.${p}`)), true);
      return json({ access_token: 'synthetic-google-token', token_type: 'Bearer', expires_in: 3600 });
    }
    assert.equal(u.origin, 'https://sheets.googleapis.com'); assert.equal(init.method, 'GET');
    assert.equal(decodeURIComponent(u.pathname), `/v4/spreadsheets/${SPREADSHEET_ID}/values/'Данние короткі'!A:N`);
    assert.equal(init.headers.Authorization, 'Bearer synthetic-google-token');
    assert.equal(u.searchParams.get('valueRenderOption'), 'UNFORMATTED_VALUE');
    return google ? google() : json(payload());
  };
  const config = { enabled: true, baseUrl: origin, serviceRoleKey: jwt, sheetSecret: secret,
    fetchImpl, aliases: [['Synthetic', 'Canonical']], ...changes };
  return { candidate: createPreparedSalesCutover(config), calls, config };
}

test('composed private OAuth capture→exact-cent bodies→provenance is a BLOCKED review with no DB POST', async () => {
  const f = fixture();
  const result = await f.candidate.review({ now });
  assert.equal(result.status, 'BLOCKED'); assert.equal(result.priorAuthenticated, false);
  assert.equal(result.code, 'SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE');
  assert.match(result.prepared.manifestJson, /"rows":1,"raw_rows":2,"batches":1,"revenue":90071992547410\.01/);
  assert.match(result.prepared.batches[0].json, /"revenue":90071992547410\.01/);
  assert.equal(result.observation.capture.values[2][11], 0.1);
  assert.equal(result.observation.sourceSha256, result.provenance.sourceSha256);
  assert.equal(hash(result.observation.copyResponseBodyBytes()), result.observation.responseBodySha256);
  assert.equal(hash(result.prepared.manifestJson), result.provenance.manifestSha256);
  assert.equal(JSON.parse(result.provenance.canonicalRowsJson)[0][7], '9007199254741001');
  assert.equal(f.calls.filter(c => new URL(c.url).origin === origin && c.init.method !== 'GET').length, 0);
  assert.equal(f.calls.filter(c => new URL(c.url).origin === 'https://sheets.googleapis.com').length, 1);
  assert.ok(Object.isFrozen(result));
  await assert.rejects(verifyPreparedSalesReadback(result.provenance, {}), /UNVERIFIED_BINDING/);
});

test('no caller-selected policy, root, accepted receipt, URL or attestation can be accepted by review', async () => {
  for (const extra of [{ trustedContext: {} }, { evidence: {} }, { accepted_source_v1: run().details.accepted_source_v1 },
    { verified: true }, { url: 'https://attacker.invalid' }, { previous: {} }, { aliases: [] }, { serviceRoleKey: jwt }, { enabled: true }]) {
    const f = fixture();
    await assert.rejects(f.candidate.review({ now, ...extra }), /SALES_CUTOVER_OPTIONS/);
    assert.equal(f.calls.length, 0);
    if (!['aliases', 'serviceRoleKey', 'enabled'].some(key => key in extra)) {
      assert.throws(() => createPreparedSalesCutover({ ...f.config, ...extra }), /SALES_CUTOVER_OPTIONS/);
    }
  }
});

test('refresh remains closed even for two genuine signatures under caller-selected keys', async () => {
  const observations = [];
  for (let i = 0; i < 2; i++) {
    const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
    const bytes = new TextEncoder().encode(JSON.stringify(run().details.accepted_source_v1));
    const signature = await crypto.subtle.sign('Ed25519', pair.privateKey, bytes);
    assert.equal(await crypto.subtle.verify('Ed25519', pair.publicKey, signature, bytes), true);
    observations.push({ publicKey: pair.publicKey, signatureHex: Buffer.from(signature).toString('hex') });
  }
  const f = fixture();
  for (const input of [undefined, { enabled: true, serviceRoleKey: jwt }, { verified: true, observations, accepted_source_v1: run().details.accepted_source_v1 }]) {
    await assert.rejects(f.candidate.refresh(input), { message: 'SALES_CUTOVER_ATTESTOR_UNAVAILABLE' });
  }
  assert.equal(f.calls.length, 0);
});

test('missing warehouse evidence prevents OAuth; malformed/stale source and missing mappings never write or leak', async () => {
  for (const change of [{ warehouse: () => json([], '*/0') }, { google: () => new Response('private-canary', { status: 403 }) },
    { google: () => { const p = payload(); p.values[1][11] = ''; return json(p); } },
    { google: () => { const p = payload(); p.values[1][5] = p.values[2][5] = '2026-10-30'; return json(p); } },
    { aliases: [['Other', 'Canonical']] }, { aliases: [['Synthetic', 'Canonical'], ['Extra', 'Extra']] }]) {
    const f = fixture(change);
    await assert.rejects(f.candidate.review({ now }), error => {
      assert.equal(error.message, 'SALES_CUTOVER_REVIEW_FAILED'); assert.equal(error.cause, undefined);
      assert.doesNotMatch(error.stack, /private-canary|synthetic-google-token|BEGIN PRIVATE KEY|900719925474/);
      return true;
    });
    assert.equal(f.calls.filter(c => new URL(c.url).origin === origin && c.init.method !== 'GET').length, 0);
    if (change.warehouse) assert.equal(f.calls.length, 1);
  }
});

test('factory snapshots mapping; parallel reviews own separate observations and immutable clocks', async () => {
  let read = 0;
  const f = fixture({ google: () => { const p = payload(); p.values[2][11] = ++read === 1 ? '0.10' : '0.20'; return json(p); } });
  const clock = new Date(now);
  const pending = f.candidate.review({ now: clock });
  f.config.aliases[0][1] = 'Tampered'; clock.setUTCFullYear(2030);
  const [a, b] = await Promise.all([pending, f.candidate.review({ now })]);
  assert.notEqual(a.observation.sourceSha256, b.observation.sourceSha256);
  for (const r of [a, b]) {
    assert.equal(r.observation.sourceSha256, r.provenance.sourceSha256);
    assert.equal(r.prepared.manifestJson, r.provenance.manifestJson);
    assert.equal(JSON.parse(r.provenance.canonicalRowsJson)[0][1], 'Canonical');
  }
});

test('abort and deadline include non-cooperating OAuth/warehouse dependencies', async () => {
  const controller = new AbortController(); controller.abort();
  const f = fixture();
  await assert.rejects(f.candidate.review({ now, signal: controller.signal }), /ABORTED/);
  assert.equal(f.calls.length, 0);
  const g = fixture({ timeoutMs: 10, fetchImpl: () => new Promise(() => {}) });
  await assert.rejects(g.candidate.review({ now }), { message: 'SALES_CUTOVER_REVIEW_FAILED' });
});

test('composed module has no import-time I/O and rejects browser execution before configuration', () => {
  const url = new URL('../../supabase/functions/sync-google-sheet/prepared-sales-cutover.mjs', import.meta.url).href;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    globalThis.fetch=()=>assert.fail('unexpected I/O');
    globalThis.Deno={env:{get(){assert.fail('secret lookup');}}};
    const {createPreparedSalesCutover}=await import(${JSON.stringify(url)});
    assert.throws(()=>createPreparedSalesCutover(),/DISABLED/);
    globalThis.window={};
    assert.throws(()=>createPreparedSalesCutover({enabled:true}),/DISABLED/);
  `], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('no runtime can import the candidate; refresh UI and unconditional 503 guards are unchanged', () => {
  const root = new URL('../../', import.meta.url);
  function walk(dir) { return readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() && !['node_modules', '.next'].includes(e.name) ? walk(`${dir}/${e.name}`) : e.isFile() ? [`${dir}/${e.name}`] : []); }
  for (const file of [...walk('web/app'), ...walk('web/lib'), ...walk('web/components'), ...walk('supabase/functions')]
    .filter(f => /\.[cm]?[jt]sx?$/.test(f) && !f.endsWith('/prepared-sales-cutover.mjs'))) {
    assert.doesNotMatch(readFileSync(new URL(file, root), 'utf8'), /prepared-sales-cutover|createPreparedSalesCutover/);
  }
  for (const [file, expected] of [
    ['web/app/api/data-sync/route.ts', '11b86897dc12bee12c904f799ed42dc9ee7bb8cfeee97e1a588c73ed3ca008d1'],
    ['supabase/functions/sync-google-sheet/index.ts', '04eb5d69d07bb7b8175be04b158a33d8315d867c8d80f97c6ecf8967103fb9b3']]) {
    assert.equal(hash(readFileSync(new URL(file, root))), expected);
  }
});
