import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { capturePreparedPrivateSalesSheet as observe } from '../../supabase/functions/sync-google-sheet/prepared-sales-sheet-capture.mjs';
import { SPREADSHEET_ID, SERVICE_ACCOUNT } from '../../supabase/functions/sync-google-sheet/google-sheet-reader.mjs';
import { canonicalSalesSourceBytes, deriveSalesProvenance } from '../../supabase/functions/sync-google-sheet/prepared-sales-provenance.mjs';
import { prepareSalesRecovery } from '../../supabase/functions/sync-google-sheet/prepared-sales-recovery.mjs';

// Synthetic ephemeral RSA material, never a Google-issued credential or persisted.
const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const der = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
const account = { type: 'service_account', project_id: 'myastoriya-bi', client_email: SERVICE_ACCOUNT,
  token_uri: 'https://oauth2.googleapis.com/token', private_key_id: 'a'.repeat(40),
  private_key: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString('base64')}\n-----END PRIVATE KEY-----\n` };
const secret = JSON.stringify(account);
const header = ['', '', '', '', '', 'Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка', 'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
const row = () => [null, '', 2026, 'é', 'е\u0301', '2026-10-26', 'Synthetic', 'Fixture', 'Owned', 'Заклад', 'Sale', 0.1, 1, '-0.03'];
const payload = () => ({ range: "'Данние короткі'!A1:N1000", majorDimension: 'ROWS', values: [[...header], row(), row()] });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const token = () => json({ access_token: 'synthetic-token', token_type: 'Bearer', expires_in: 3600 });
function mock(second = () => json(payload()), first = token) {
  const calls = [];
  return { calls, fetchImpl: async (url, init) => {
    calls.push({ url, init });
    assert.ok(calls.length <= 2, 'no retry or public fallback');
    return calls.length === 1 ? first(url, init) : second(url, init);
  } };
}
const options = m => ({ fetchImpl: m.fetchImpl });
const rejected = async promise => {
  await assert.rejects(promise, error => {
    assert.match(error.message, /^SALES_CAPTURE_(?:FAILED|ABORTED|TIMEOUT|OPTIONS|SERVER_ONLY)$/);
    assert.equal(error.cause, undefined);
    assert.doesNotMatch(error.stack, /private-canary|synthetic-token|BEGIN PRIVATE KEY|Synthetic/);
    assert.deepEqual(Object.keys(error), []);
    return true;
  });
};

test('capture module import performs no network or secret lookup', () => {
  const url = new URL('../../supabase/functions/sync-google-sheet/prepared-sales-sheet-capture.mjs', import.meta.url).href;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', `
    globalThis.fetch = () => { throw Error('unexpected network'); };
    globalThis.Deno = {env: {get() { throw Error('unexpected secret lookup'); }}};
    await import(${JSON.stringify(url)});
  `], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('fixed typed capture preserves original bytes, immutable cells and whitelisted response metadata', async () => {
  const body = ` \n${JSON.stringify(payload(), null, 2)}\n`;
  const bytes = new TextEncoder().encode(body);
  const m = mock(() => new Response(bytes, { headers: { 'content-type': 'application/json; charset=UTF-8',
    'content-length': String(bytes.length), date: 'Tue, 03 Nov 2026 00:00:00 GMT',
    'x-private': 'private-canary', 'set-cookie': 'private-canary' } }));
  const result = await observe(secret, options(m));
  assert.equal(m.calls.length, 2);
  const request = m.calls[1], url = new URL(request.url);
  assert.equal(decodeURIComponent(url.pathname), `/v4/spreadsheets/${SPREADSHEET_ID}/values/'Данние короткі'!A:N`);
  assert.deepEqual([...url.searchParams], [['majorDimension', 'ROWS'], ['valueRenderOption', 'UNFORMATTED_VALUE'], ['dateTimeRenderOption', 'SERIAL_NUMBER']]);
  assert.equal(url.origin, 'https://sheets.googleapis.com');
  assert.equal(request.init.method, 'GET');
  assert.equal(request.init.redirect, 'error');
  assert.equal(request.init.credentials, 'omit');
  assert.equal(request.init.cache, 'no-store');
  assert.deepEqual(request.init.headers, { Authorization: 'Bearer synthetic-token', Accept: 'application/json' });
  assert.deepEqual(result.copyResponseBodyBytes(), bytes);
  assert.equal(result.responseBodySha256, hash(bytes));
  assert.equal(result.sourceSha256, hash(canonicalSalesSourceBytes(result.capture)));
  assert.equal(result.capture.values[1][11], 0.1);
  assert.equal(result.capture.values[1][0], null);
  assert.equal(result.capture.values[1][3], 'é');
  assert.equal(result.capture.values[1][4], 'е\u0301');
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.capture) && Object.isFrozen(result.capture.values));
  assert.ok(Object.isFrozen(result.capture.values[1]) && Object.isFrozen(result.responseMetadata));
  assert.throws(() => { result.capture.values[1][11] = '99'; }, TypeError);
  assert.throws(() => { result.capture.requestedRange = 'A1'; }, TypeError);
  const copy = result.copyResponseBodyBytes(); copy.fill(0);
  assert.deepEqual(result.copyResponseBodyBytes(), bytes);
  assert.equal(result.responseMetadata.bodyByteLength, bytes.length);
  assert.equal(result.responseMetadata.date, 'Tue, 03 Nov 2026 00:00:00 GMT');
  assert.doesNotMatch(JSON.stringify(result.responseMetadata), /private-canary|synthetic-token/);
});

test('reuses pinned service-account auth and cryptographically verified readonly OAuth assertion', async () => {
  const m = mock(undefined, async (url, init) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    const [h, p, s] = init.body.get('assertion').split('.');
    const claims = JSON.parse(Buffer.from(p, 'base64url'));
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/spreadsheets.readonly');
    assert.equal(claims.iss, SERVICE_ACCOUNT);
    assert.equal(claims.aud, url);
    assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey,
      Buffer.from(s, 'base64url'), new TextEncoder().encode(`${h}.${p}`)), true);
    return token();
  });
  await observe(secret, options(m));
});

test('caller URLs/ranges/headers/tokens and missing explicit fetch are rejected before auth', async () => {
  for (const extra of [{ url: 'https://attacker.invalid' }, { requestedRange: 'A1' }, { spreadsheetId: 'public' },
    { headers: { Authorization: 'private-canary' } }, { token: 'private-canary' }, { probe: true },
    { timeoutMs: 0 }, { timeoutMs: 30001 }, { signal: {} }]) {
    const m = mock(); await rejected(observe(secret, { ...options(m), ...extra })); assert.equal(m.calls.length, 0);
  }
  await rejected(observe(secret));
  await rejected(observe(secret, {}));
});

test('browser execution rejects before any authentication or fetch', () => {
  const url = new URL('../../supabase/functions/sync-google-sheet/prepared-sales-sheet-capture.mjs', import.meta.url).href;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    const { capturePreparedPrivateSalesSheet } = await import(${JSON.stringify(url)});
    globalThis.window = {};
    await assert.rejects(capturePreparedPrivateSalesSheet('private-canary', {
      fetchImpl: () => assert.fail('unexpected network')
    }), {message: 'SALES_CAPTURE_SERVER_ONLY'});
  `], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('wrong account/endpoint/project, missing secret and malformed key fail with redacted errors', async () => {
  for (const input of [undefined, 'private-canary', 'null', '{}',
    JSON.stringify({ ...account, client_email: 'private-canary' }),
    JSON.stringify({ ...account, token_uri: 'https://attacker.invalid' }),
    JSON.stringify({ ...account, project_id: 'other' }),
    JSON.stringify({ ...account, private_key: '-----BEGIN PRIVATE KEY-----\nYWJj\n-----END PRIVATE KEY-----\n' })]) {
    const m = mock(); await rejected(observe(input, options(m))); assert.equal(m.calls.length, 0);
  }
});

test('token errors never trigger Sheets or leak upstream response/secret', async () => {
  for (const first of [() => new Response('private-canary', { status: 403 }),
    () => json({ access_token: 'private-canary\r\n', token_type: 'Bearer', expires_in: 3600 }),
    () => { throw Error('private-canary'); }]) {
    const m = mock(undefined, first); await rejected(observe(secret, options(m))); assert.equal(m.calls.length, 1);
  }
});

test('HTTP denial/redirect/partial/5xx fail once, no fallback or retry', async () => {
  for (const status of [204, 206, 301, 302, 307, 401, 403, 404, 429, 500, 502, 503, 504]) {
    const m = mock(() => new Response(status === 204 ? null : 'private-canary', { status }));
    await rejected(observe(secret, options(m))); assert.equal(m.calls.length, 2);
  }
  for (const change of [r => Object.defineProperty(r, 'redirected', { value: true }),
    r => Object.defineProperty(r, 'url', { value: 'https://attacker.invalid/private-canary' })]) {
    const m = mock(() => { const r = json(payload()); change(r); return r; });
    await rejected(observe(secret, options(m)));
  }
});

test('HTML, malformed JSON, invalid UTF-8, BOM and stream/network errors fail sanitized', async () => {
  for (const second of [() => new Response('<html>private-canary</html>'),
    () => new Response('private-canary', { headers: { 'content-type': 'application/json' } }),
    () => new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } }),
    () => new Response('\ufeff' + JSON.stringify(payload()), { headers: { 'content-type': 'application/json' } }),
    () => new Response(new ReadableStream({ start(c) { c.error(Error('private-canary')); } }), { headers: { 'content-type': 'application/json' } }),
    () => { throw Error('private-canary'); }]) {
    await rejected(observe(secret, options(mock(second))));
  }
});

test('response byte ceiling applies to content length and streamed/chunked bodies', async () => {
  const m = mock(() => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': String(32 * 1024 * 1024 + 1) } }));
  await rejected(observe(secret, options(m)));
  let cancelled = false, chunks = 0;
  const large = mock(() => new Response(new ReadableStream({ pull(c) {
    ++chunks; c.enqueue(new Uint8Array(1024 * 1024));
  }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } }));
  await rejected(observe(secret, options(large))); assert.equal(cancelled, true);
});

test('malformed response metadata cannot be retained as evidence', async () => {
  for (const headers of [{ 'content-type': 'text/html' }, { 'content-length': '2' }, { 'content-length': '-1' },
    { 'content-length': 'unknown' }, { date: 'private-canary' }, { 'content-encoding': 'private-canary' }]) {
    const m = mock(() => new Response(JSON.stringify(payload()), { headers: { 'content-type': 'application/json', ...headers } }));
    await rejected(observe(secret, options(m)));
  }
});

test('range/dimension/schema/row truncation and missing required cells fail closed', async () => {
  for (const change of [p => { p.range = "'Данние короткі'!A2:N1000"; }, p => { p.range = "'Данние короткі'!A1:M1000"; },
    p => { p.range = "'Данние короткі'!A1:N2"; }, p => { p.range = 'Other!A1:N1000'; },
    p => { delete p.range; }, p => { p.majorDimension = 'COLUMNS'; }, p => { p.values = []; },
    p => { p.values = [header]; }, p => { p.values = Array(200002).fill(row()); }, p => { p.values[1].pop(); },
    p => { p.values[1].push('extra'); }, p => { p.values[1] = {}; }, p => { p.values[1][11] = null; },
    p => { p.values[1][6] = ''; }, p => { p.values[0][5] = 'wrong header'; }, p => { p.extra = 'private-canary'; }]) {
    const p = payload(); change(p);
    await rejected(observe(secret, options(mock(() => json(p)))));
  }
});

test('objects/booleans, lone surrogates and unsafe monetary/check numeric cells fail closed', async () => {
  for (const [column, value] of [[0, true], [0, {}], [0, []], [0, '\ud800'], [0, '\udfff'],
    [11, 2 ** 45], [13, -(2 ** 45)], [12, 9007199254740992], [12, 1.5]]) {
    const p = payload(); p.values[1][column] = value;
    await rejected(observe(secret, options(mock(() => json(p)))));
  }
});

test('numeric lexical precision loss is rejected before JSON.parse can collapse values', async () => {
  for (const number of ['9007199254740993', '0.10000000000000001', '1e999', '1e-999', '-0', '-0.0', '1.0000000000000001', '1e1025']) {
    const p = payload(); p.values[1][0] = 'replace-number';
    const raw = JSON.stringify(p).replace('"replace-number"', number);
    await rejected(observe(secret, options(mock(() => new Response(raw, { headers: { 'content-type': 'application/json' } })))));
  }
  const p = payload(); p.values[1][0] = 'replace-number';
  const raw = JSON.stringify(p).replace('"replace-number"', '1e2');
  assert.equal((await observe(secret, options(mock(() => new Response(raw, { headers: { 'content-type': 'application/json' } }))))).capture.values[1][0], 100);
});

test('string numeric values and typed numeric values produce distinct source digests', async () => {
  const a = await observe(secret, options(mock()));
  const p = payload(); p.values[1][11] = '0.1';
  const b = await observe(secret, options(mock(() => json(p))));
  assert.notEqual(a.sourceSha256, b.sourceSha256);
  assert.equal(b.capture.values[1][11], '0.1');
  assert.equal(a.capture.values[1][11], 0.1);
});

test('each observation requires fresh auth/read; raw HTTP whitespace differs while canonical content agrees', async () => {
  const a = mock(), b = mock(() => new Response(JSON.stringify(payload(), null, 2), { headers: { 'content-type': 'application/json' } }));
  const first = await observe(secret, options(a)), second = await observe(secret, options(b));
  assert.equal(a.calls.length, 2); assert.equal(b.calls.length, 2);
  assert.notEqual(first.responseBodySha256, second.responseBodySha256);
  assert.equal(first.sourceSha256, second.sourceSha256);
  assert.notEqual(first.capture, second.capture);
});

test('capture digest feeds existing exact-cent provenance/preparation with all date formats and repeated raw identities', async () => {
  for (const date of [46321, '46321', '2026-10-26', '10/26/2026', '26.10.2026']) {
    const p = payload(); p.values[1][5] = p.values[2][5] = date;
    p.values[1][11] = '90071992547409.91'; p.values[2][11] = '0.10';
    const result = await observe(secret, options(mock(() => json(p))));
    const previous = { rawRows: 2, minDate: '2026-10-26', maxDate: '2026-10-26' };
    const now = new Date('2026-10-27T12:00:00Z');
    const derived = await deriveSalesProvenance({ capture: result.capture, aliases: [['Synthetic', 'Canonical']], previous, now });
    assert.equal(derived.sourceSha256, result.sourceSha256);
    assert.equal(JSON.parse(derived.canonicalRowsJson)[0][7], '9007199254741001');
    assert.match(derived.manifestJson, /"rows":1,"raw_rows":2.*"revenue":90071992547410\.01,"checks":2,"markup":-0\.06/);
    const matrix = result.capture.values.map(row => row.map(v => v === null ? '' : String(v)));
    const prepared = prepareSalesRecovery(matrix, { previous, now });
    assert.equal(prepared.manifestJson, derived.manifestJson);
    assert.match(prepared.batches[0].json, /"revenue":90071992547410\.01/);
  }
});

test('signed sale amounts and measured zero reconcile in exact cents without inventing missing metrics', async () => {
  const p = payload();
  p.values[1][11] = '-0.10'; p.values[2][11] = '0.20';
  p.values[1][12] = 0; p.values[1][13] = 0;
  const result = await observe(secret, options(mock(() => json(p))));
  assert.equal(result.capture.values[1][12], 0);
  assert.equal(result.capture.values[1][13], 0);
  const derived = await deriveSalesProvenance({ capture: result.capture, aliases: [['Synthetic', 'Canonical']],
    previous: { rawRows: 2, minDate: '2026-10-26', maxDate: '2026-10-26' }, now: new Date('2026-10-27T12:00:00Z') });
  assert.match(derived.manifestJson, /"revenue":0\.10,"checks":1,"markup":-0\.03/);
  assert.deepEqual(JSON.parse(derived.canonicalRowsJson)[0].slice(7), ['10', '1', '-3']);
  p.values[1][13] = null;
  await rejected(observe(secret, options(mock(() => json(p)))));
});

test('pre-abort makes zero calls and active abort stops OAuth, Sheets or body read', async () => {
  const c = new AbortController(); c.abort(); const m = mock();
  await rejected(observe(secret, { ...options(m), signal: c.signal })); assert.equal(m.calls.length, 0);
  for (const phase of ['token', 'values', 'body']) {
    const controller = new AbortController();
    const hang = () => { setTimeout(() => controller.abort(), 1); return new Promise(() => {}); };
    const m = mock(phase === 'values' ? hang : phase === 'body' ? () => new Response(new ReadableStream({ start() { setTimeout(() => controller.abort(), 1); } }), { headers: { 'content-type': 'application/json' } }) : undefined,
      phase === 'token' ? hang : token);
    await assert.rejects(observe(secret, { ...options(m), signal: controller.signal }), { message: 'SALES_CAPTURE_ABORTED' });
    assert.equal(m.calls.length, phase === 'token' ? 1 : 2);
    assert.ok(m.calls.at(-1).init.signal.aborted);
  }
});

test('deadline bounds non-cooperating OAuth, Sheets and body dependencies without retry', async () => {
  for (const phase of ['token', 'values', 'body']) {
    const hang = () => new Promise(() => {});
    const m = mock(phase === 'values' ? hang : phase === 'body' ? () => new Response(new ReadableStream(), { headers: { 'content-type': 'application/json' } }) : undefined,
      phase === 'token' ? hang : token);
    await assert.rejects(observe(secret, { ...options(m), timeoutMs: 25 }), { message: 'SALES_CAPTURE_TIMEOUT' });
    assert.ok(m.calls.length <= 2);
  }
});

test('late OAuth success after timeout cannot start a Sheets request', async () => {
  let finishToken;
  const m = mock(undefined, () => new Promise(resolve => { finishToken = resolve; }));
  await assert.rejects(observe(secret, { ...options(m), timeoutMs: 25 }), { message: 'SALES_CAPTURE_TIMEOUT' });
  assert.equal(m.calls.length, 1);
  finishToken(token());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(m.calls.length, 1);
});

test('prepared capture stays disconnected from runtime, recovery transport, SQL and both 503 guards', () => {
  const root = new URL('../../', import.meta.url);
  const walk = dir => readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
  for (const file of [...walk('web/app'), ...walk('web/lib'), ...walk('web/components'), ...walk('supabase/functions')]
    .filter(f => /\.[cm]?[jt]sx?$/.test(f) && !f.endsWith('/prepared-sales-sheet-capture.mjs'))) {
    assert.doesNotMatch(readFileSync(new URL(file, root), 'utf8'), /prepared-sales-sheet-capture|capturePreparedPrivateSalesSheet/);
  }
  for (const file of ['supabase/functions/sync-google-sheet/index.ts', 'web/app/api/data-sync/route.ts']) {
    const source = readFileSync(new URL(file, root), 'utf8');
    assert.match(source, /SALES_IMPORT_SAFETY_GATE/); assert.match(source, /status: 503/);
  }
  const sql = readFileSync(new URL('docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql', root), 'utf8');
  assert.match(sql, /NOT APPLIED/); assert.match(sql.trim(), /rollback; -- Review-safe default\.[^\n]*$/i);
});
