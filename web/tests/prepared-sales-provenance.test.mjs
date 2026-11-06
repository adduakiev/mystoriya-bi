import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonicalSalesSourceBytes, deriveSalesProvenance, verifyPreparedSalesProvenance, verifyPreparedSalesReadback } from '../../supabase/functions/sync-google-sheet/prepared-sales-provenance.mjs';
import { SPREADSHEET_ID } from '../../supabase/functions/sync-google-sheet/google-sheet-reader.mjs';

// Entirely synthetic. Ephemeral signing keys never leave this test process.
const hash = s => createHash('sha256').update(s).digest('hex');
const encode = v => new TextEncoder().encode(JSON.stringify(v));
const header = ['', '', '', '', '', 'Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка', 'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
const row = (amount = '0.10') => ['', '', '', '', '', '2026-10-31', 'Synthetic', 'Fixture', 'Owned', 'Заклад', 'Sale', amount, '1', '-0.03'];
const now = new Date('2026-11-01T12:00:00.000Z');
const priorId = '11111111-1111-4111-8111-111111111111';
const runId = '22222222-2222-4222-8222-222222222222';
const keyA = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const keyB = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const keyForged = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const capture = () => ({ spreadsheetId: SPREADSHEET_ID, requestedRange: "'Данние короткі'!A:N",
  returnedRange: "'Данние короткі'!A1:N1000", majorDimension: 'ROWS', valueRenderOption: 'UNFORMATTED_VALUE',
  dateTimeRenderOption: 'SERIAL_NUMBER', values: [[...header], row(), row('0.20')] });
const aliases = [['Synthetic', 'Canonical']];
const historical = () => [['2026-10-31', 'Canonical', 'Fixture', 'Owned', 'Заклад', 'Заклад', 'Sale', '30', '2', '-6']];
const clone = x => structuredClone(x);
const whash = rows => hash(JSON.stringify(['sales-warehouse-cents/v1', rows]));
async function sign(core, observerId, observedAt, key) {
  const bytes = await crypto.subtle.sign('Ed25519', key, encode(['sales-source-observation/v1', observerId, observedAt, core]));
  return { observerId, observedAt, signatureHex: Buffer.from(bytes).toString('hex') };
}
async function fixture() {
  const prior = { kind: 'atomic-accepted/v1', runId: priorId, generation: '7', sourceSha256: 'a'.repeat(64),
    rawRows: 2, minDate: '2026-10-31', maxDate: '2026-10-31', canonicalRowsJson: JSON.stringify(historical()), warehouseSha256: whash(historical()) };
  const priorReceiptSha256 = hash(JSON.stringify(['sales-prior-receipt/v1', prior.runId, prior.generation,
    prior.sourceSha256, prior.rawRows, prior.minDate, prior.maxDate, prior.warehouseSha256]));
  const trustedContext = { prior, priorReceiptSha256, target: { runId, baseGeneration: '7', generation: '8' },
    observers: new Map([['capture-a', { publicKey: keyA.publicKey, independenceGroup: 'custodian-a' }],
      ['capture-b', { publicKey: keyB.publicKey, independenceGroup: 'custodian-b' }]]) };
  const first = capture(), second = capture();
  const derived = await deriveSalesProvenance({ capture: first, aliases, previous: { rawRows: 2, minDate: prior.minDate, maxDate: prior.maxDate }, now });
  const core = ['sales-provenance-binding/v1', runId, priorId, priorReceiptSha256, '7', '8', derived.sourceSha256,
    derived.rawRows, derived.minDate, derived.maxDate, derived.manifestSha256, derived.warehouseSha256, derived.mappingSha256];
  const evidence = { core, observations: [await sign(core, 'capture-a', '2026-11-01T11:58:00.000Z', keyA.privateKey),
    await sign(core, 'capture-b', '2026-11-01T11:59:00.000Z', keyB.privateKey)] };
  return { evidence, first, second, aliases: clone(aliases), trustedContext, now };
}

test('canonical source bytes have a fixed independent golden serialization and SHA-256', () => {
  const c = capture(); c.values = [Array(14).fill(''), Array(14).fill('')];
  c.values[1][0] = 'е\u0301\n"\\'; c.values[1][1] = 42; c.values[1][2] = null;
  const blankHeader = Array(14).fill('["string",""]').join(',');
  const data = ['["string","е́\\n\\"\\\\"]', '["number","42"]', '["blank"]', ...Array(11).fill('["string",""]')].join(',');
  const expected = `["sales-source-bytes/v1","${SPREADSHEET_ID}","'Данние короткі'!A:N","'Данние короткі'!A1:N1000","ROWS","UNFORMATTED_VALUE","SERIAL_NUMBER",14,[[${blankHeader}],[${data}]]]`;
  const actual = canonicalSalesSourceBytes(c);
  assert.deepEqual(actual, new TextEncoder().encode(expected));
  assert.equal(hash(actual), hash(expected));
  assert.equal(hash(actual), 'f8816ba8773412c01e4935048e41f6793e75ab089bf98045b1585d6d7238bfe5');
});

test('canonicalization preserves raw Unicode, whitespace, order, headers, types and range', () => {
  const base = capture(); base.values[1][0] = 'é';
  const initial = hash(canonicalSalesSourceBytes(base));
  for (const change of [c => { c.values[1][0] = 'e\u0301'; }, c => { c.values[1][0] += ' '; },
    c => { c.values.reverse(); }, c => { c.values[0][0] = 'header'; }, c => { c.values[1][11] = 0.1; },
    c => { c.returnedRange = "'Данние короткі'!A1:N1001"; }]) {
    const c = clone(base); change(c); assert.notEqual(hash(canonicalSalesSourceBytes(c)), initial);
  }
  const missing = capture(), empty = capture(); missing.values[1][0] = null; empty.values[1][0] = '';
  assert.notEqual(hash(canonicalSalesSourceBytes(missing)), hash(canonicalSalesSourceBytes(empty)));
  delete missing.values[1][0]; const nullCell = clone(missing); nullCell.values[1][0] = null;
  assert.deepEqual(canonicalSalesSourceBytes(missing), canonicalSalesSourceBytes(nullCell));
});

test('noncanonical/partial range, bad types, unsafe numbers and malformed Unicode fail closed', () => {
  for (const change of [c => { c.requestedRange = 'A:N'; }, c => { c.returnedRange = "'Данние короткі'!A2:N1000"; },
    c => { c.returnedRange = "'Данние короткі'!A1:N2"; }, c => { c.spreadsheetId = 'public'; },
    c => { c.values[1][0] = true; }, c => { c.values[1][0] = {}; }, c => { c.values[1][0] = '\ud800'; },
    c => { c.values[1][11] = 2 ** 45; }, c => { c.values[1][11] = NaN; }, c => { c.values[1][11] = -0; },
    c => { c.values[1].push('extra'); }, c => { c.majorDimension = 'COLUMNS'; }, c => { c.extra = 'ignored?'; }]) {
    const c = capture(); change(c); assert.throws(() => canonicalSalesSourceBytes(c), /SALES_PROVENANCE/);
  }
});

test('two independent signed observations verify full source→manifest→canonical warehouse reconciliation', async () => {
  const f = await fixture();
  const result = await verifyPreparedSalesProvenance(f);
  assert.equal(result.runId, runId); assert.equal(result.generation, '8');
  assert.ok(Object.isFrozen(result));
  const derived = await deriveSalesProvenance({ capture: f.first, aliases, previous: { rawRows: 2, minDate: '2026-10-31', maxDate: '2026-10-31' }, now });
  assert.equal(derived.canonicalRowsJson, JSON.stringify(historical()));
  assert.match(derived.manifestJson, /"rows":1,"raw_rows":2/);
  assert.match(derived.manifestJson, /"revenue":0\.30,"checks":2,"markup":-0\.06/);
});

test('absent, legacy or invented prior receipts cannot bootstrap an atomic trust root', async () => {
  for (const change of [f => { delete f.evidence; }, f => { delete f.trustedContext; },
    f => { f.trustedContext.prior.kind = 'legacy'; }, f => { delete f.trustedContext.prior.sourceSha256; },
    f => { f.trustedContext.priorReceiptSha256 = 'b'.repeat(64); },
    f => { f.trustedContext.prior.canonicalRowsJson = JSON.stringify([historical()[0].map((x, i) => i === 7 ? '31' : x)]); }]) {
    const f = await fixture(); change(f); await assert.rejects(verifyPreparedSalesProvenance(f), /SALES_PROVENANCE/);
  }
});

test('plausible metadata, tampered digest/manifest/run/generation and valid-looking forged signatures reject', async () => {
  for (const change of [f => { f.evidence.observations = []; }, f => { f.evidence.observations.pop(); },
    f => { f.evidence.observations[0].signatureHex = 'a'.repeat(128); },
    f => { f.evidence.core[6] = 'b'.repeat(64); }, f => { f.evidence.core[10] = 'b'.repeat(64); },
    f => { f.evidence.core[1] = priorId; }, f => { f.evidence.core[5] = '9'; },
    f => { f.trustedContext.target.baseGeneration = '6'; }, f => { f.trustedContext.target.generation = '9'; },
    f => { f.evidence.extra = 'ignored?'; }]) {
    const f = await fixture(); change(f); await assert.rejects(verifyPreparedSalesProvenance(f), /SALES_PROVENANCE/);
  }
  const forged = await fixture();
  forged.evidence.observations[0] = await sign(forged.evidence.core, 'capture-a', '2026-11-01T11:58:00.000Z', keyForged.privateKey);
  await assert.rejects(verifyPreparedSalesProvenance(forged), /SIGNATURE/);
});

test('even two genuine signatures cannot authenticate a fabricated digest or a different manifest', async () => {
  for (const index of [6, 10, 11, 12]) {
    const f = await fixture(); f.evidence.core[index] = 'b'.repeat(64);
    f.evidence.observations = [await sign(f.evidence.core, 'capture-a', '2026-11-01T11:58:00.000Z', keyA.privateKey),
      await sign(f.evidence.core, 'capture-b', '2026-11-01T11:59:00.000Z', keyB.privateKey)];
    await assert.rejects(verifyPreparedSalesProvenance(f), /BINDING/);
  }
});

test('same identity, key or administrative domain cannot masquerade as independent observations', async () => {
  for (const change of [f => { f.evidence.observations[1] = f.evidence.observations[0]; },
    f => { f.trustedContext.observers.get('capture-b').independenceGroup = 'custodian-a'; },
    f => { f.trustedContext.observers.get('capture-b').publicKey = keyA.publicKey; },
    f => { f.trustedContext.observers.delete('capture-a'); }]) {
    const f = await fixture(); change(f); await assert.rejects(verifyPreparedSalesProvenance(f), /OBSERVER|STALE_OBSERVATION/);
  }
});

test('stale, future, reordered and noncanonical observation timestamps reject even with genuine signatures', async () => {
  for (const times of [['2026-11-01T11:44:59.999Z', '2026-11-01T11:59:00.000Z'],
    ['2026-11-01T11:58:00.000Z', '2026-11-01T12:00:00.001Z'],
    ['2026-11-01T11:59:00.000Z', '2026-11-01T11:58:00.000Z'],
    ['2026-11-01T11:59:00Z', '2026-11-01T11:59:00.000Z']]) {
    const f = await fixture(); f.evidence.observations = [await sign(f.evidence.core, 'capture-a', times[0], keyA.privateKey),
      await sign(f.evidence.core, 'capture-b', times[1], keyB.privateKey)];
    await assert.rejects(verifyPreparedSalesProvenance(f), /OBSERVATION|TIMESTAMP/);
  }
});

test('re-observation detects raw content/type/header/range/amount tampering and partial snapshots', async () => {
  for (const change of [f => { f.second.values[1][0] = 'changed ignored column'; },
    f => { f.second.values[1][11] = 0.1; }, f => { f.second.values[1][11] = '0.11'; },
    f => { f.second.values[0][0] = 'changed header'; }, f => { f.second.values.pop(); },
    f => { f.second.returnedRange = "'Данние короткі'!A1:N1001"; }]) {
    const f = await fixture(); change(f); await assert.rejects(verifyPreparedSalesProvenance(f), /CHANGED|REGRESSION/);
  }
});

test('historical channel-name and identity substitutions reject despite identical counts and totals', async () => {
  const f = await fixture();
  // Change the trusted historical receipt and its pin consistently: key regression
  // must still reject independently of cryptographic metadata equality.
  const rows = historical(); rows[0][5] = 'Historical channel name';
  const p = f.trustedContext.prior; p.canonicalRowsJson = JSON.stringify(rows); p.warehouseSha256 = whash(rows);
  f.trustedContext.priorReceiptSha256 = hash(JSON.stringify(['sales-prior-receipt/v1', p.runId, p.generation,
    p.sourceSha256, p.rawRows, p.minDate, p.maxDate, p.warehouseSha256]));
  await assert.rejects(verifyPreparedSalesProvenance(f), /HISTORICAL_KEY_REGRESSION/);
});

test('aliases resolve explicitly; raw duplicates aggregate cents; canonical alias collisions reject', async () => {
  const f = await fixture(); f.aliases = [];
  await assert.rejects(verifyPreparedSalesProvenance(f), /MAPPING/);
  f.aliases = [['Other', 'Canonical']];
  await assert.rejects(verifyPreparedSalesProvenance(f), /UNRESOLVED_ALIAS/);
  f.aliases = [['Synthetic', 'Changed']];
  await assert.rejects(verifyPreparedSalesProvenance(f), /HISTORICAL_KEY_REGRESSION/);
  const c = capture(); c.values[2][6] = 'Alias';
  await assert.rejects(deriveSalesProvenance({ capture: c, aliases: [...aliases, ['Alias', 'Canonical']],
    previous: { rawRows: 2, minDate: '2026-10-31', maxDate: '2026-10-31' }, now }), /WAREHOUSE_DUPLICATE/);
});

test('both observations stopping at a stale day, losing a date or changing a required header reject', async () => {
  for (const change of [f => { f.now = new Date('2026-11-02T12:00:00.000Z'); },
    f => { f.first.values[0][5] = f.second.values[0][5] = 'wrong header'; },
    f => { f.first.values[1][5] = f.second.values[1][5] = '2026-11-01'; }]) {
    const f = await fixture(); change(f); await assert.rejects(verifyPreparedSalesProvenance(f));
  }
  const f = await fixture();
  const p = f.trustedContext.prior; p.minDate = '2026-10-30';
  await assert.rejects(verifyPreparedSalesProvenance(f), /PRIOR_RECEIPT/);
});

test('large exact decimals never round through JSON numeric parsing; subcent/fractional checks reject', async () => {
  const c = capture(); c.values[1][11] = '90071992547409.91'; c.values[2][11] = '0.10';
  const options = { capture: c, aliases, previous: { rawRows: 2, minDate: '2026-10-31', maxDate: '2026-10-31' }, now };
  const result = await deriveSalesProvenance(options);
  assert.match(result.manifestJson, /"revenue":90071992547410\.01/);
  assert.equal(JSON.parse(result.canonicalRowsJson)[0][7], '9007199254741001');
  for (const [column, value] of [[11, '0.001'], [12, '1.5'], [13, '']]) {
    const c = capture(); c.values[1][column] = value;
    await assert.rejects(deriveSalesProvenance({ ...options, capture: c }));
  }
});

test('mutable caller input cannot change captured bytes, mappings or signed evidence across awaits', async () => {
  const c = capture(); const mapping = clone(aliases);
  const resultPromise = deriveSalesProvenance({ capture: c, aliases: mapping,
    previous: { rawRows: 2, minDate: '2026-10-31', maxDate: '2026-10-31' }, now });
  c.values[1][11] = '99.00'; mapping[0][1] = 'Changed';
  assert.equal((await resultPromise).canonicalRowsJson, JSON.stringify(historical()));
  const f = await fixture(); const original = JSON.stringify(f.evidence);
  f.now = new Date(now);
  const verifyPromise = verifyPreparedSalesProvenance(f);
  f.second.values[1][11] = '99.00'; f.evidence.core[6] = 'b'.repeat(64);
  f.trustedContext.target.generation = '99'; f.now.setUTCFullYear(2030);
  assert.equal((await verifyPromise).evidenceJson, original);
});

const readback = binding => ({ generationBefore: '8', generationAfter: '8', runId, status: 'success', atomic: true,
  rowsRead: 2, rowsRejected: 0, acceptedSourceJson: binding.evidenceJson, rows: historical() });
test('read-after-write checks retained signed evidence, generation and every identity+cent', async () => {
  const binding = await verifyPreparedSalesProvenance(await fixture());
  assert.equal((await verifyPreparedSalesReadback(binding, readback(binding))).verified, true);
  await assert.rejects(verifyPreparedSalesReadback({ ...binding }, readback(binding)), /UNVERIFIED_BINDING/);
  for (const change of [r => { r.generationAfter = '9'; }, r => { r.generationBefore = '7'; },
    r => { r.runId = priorId; }, r => { r.atomic = false; }, r => { r.status = 'running'; },
    r => { r.rowsRead = 1; }, r => { r.rowsRejected = 1; }, r => { r.acceptedSourceJson = '{}'; },
    r => { r.rows = []; }, r => { r.rows.push([...r.rows[0]]); },
    r => { r.rows[0][7] = '31'; }, r => { r.rows[0][5] = 'wrong-channel'; }]) {
    const r = readback(binding); change(r); await assert.rejects(verifyPreparedSalesReadback(binding, r), /SALES_PROVENANCE/);
  }
});

test('review verifier is disconnected from runtime, transport and SQL; both manual 503 gates stay closed', () => {
  for (const file of ['../../supabase/functions/sync-google-sheet/index.ts', '../app/api/data-sync/route.ts',
    '../../supabase/functions/sync-google-sheet/prepared-sales-transport.mjs', '../../docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql']) {
    const text = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /prepared-sales-provenance|verifyPreparedSalesProvenance/);
    if (file.endsWith('index.ts') || file.endsWith('route.ts')) assert.match(text, /SALES_IMPORT_SAFETY_GATE/);
  }
});
