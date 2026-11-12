import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSalesCsv, prepareSalesSnapshot, SALES_SOURCE_URL, sha256Hex } from '../../supabase/functions/sync-google-sheet/sales-snapshot.mjs';
import { handleAtomicSalesRequest } from '../../supabase/functions/sync-google-sheet/atomic-sales-handler.mjs';
import { assertSalesCsvPreflight } from '../../supabase/functions/sync-google-sheet/source-safety.mjs';
const header = ['', '', '', '', '', 'Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка', 'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
const row = (name = 'Alias', revenue = '1 234,50', markup = '-12,45') => ['', '', '', '', '', '2026-11-10', name, 'Brand', 'Owned', 'Заклад', 'Заклад', revenue, '1', markup];
const csv = rows => [header, ...rows].map(r => r.map(x => `"${String(x).replaceAll('"', '""')}"`).join(',')).join('\r\n');
const context = { enabled: true, raw_rows: 1, baseline_hash: 'a'.repeat(32), mapping_hash: 'b'.repeat(32), min_date: '2026-11-10', max_date: '2026-11-10', mapping: [{ source_name: 'Alias', canonical_name: 'Canonical' }], channels: ['Заклад'] };
const now = new Date('2026-11-12T12:00:00Z');
const prep = rows => prepareSalesSnapshot(csv(rows), context, now);

test('streamed CSV parser preserves quoted records, Unicode and trailing fields at EOF', () => {
  const values = ['', 'plain', 'comma,value', 'quote"value', 'line\r\nbreak', 'Київ', ' two spaces '];
  const rows = values.map((value, i) => [value, values[(i + 1) % values.length], '']);
  const encoded = rows.map(r => r.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
  for (const suffix of ['', '\n', '\r\n']) {
    assert.deepEqual(parseSalesCsv(`\ufeff${encoded}${suffix}`), rows);
  }
  assert.deepEqual(parseSalesCsv('a,b,\n\nlast,, '), [['a', 'b', ''], ['last', '', ' ']]);
  for (const invalid of ['"closed" trailing', 'a,"later truncated', 'a,b"quote', '"quoted""']) {
    assert.throws(() => parseSalesCsv(invalid), /CSV_/);
  }
});

test('display-source contract preserves locale, signed cents, aliases and known stale cutoff', () => {
  const prepared = prep([row('Alias'), row('Canonical', '₴0,20', '-0.05')]);
  const manifest = JSON.parse(prepared.manifestJson);
  assert.equal(manifest.rows, 1); assert.equal(manifest.raw_rows, 2);
  assert.equal(manifest.revenue, 1234.7); assert.equal(manifest.markup, -12.5);
  assert.equal(manifest.max_date, '2026-11-10');
  assert.deepEqual(prepared.dailyTotals, [{ date: '2026-11-10', rows: 1, revenue: '1234.70', checks: '2', markup: '-12.50' }]);
  assert.equal(JSON.parse(prepared.batches[0].json)[0].location_raw, 'Canonical');
});
test('explicit gviz raw-precision contract reproduces signed JS ties after key aggregation', () => {
  for (const [amount, expected] of [['0.004', 0], ['1.005', 1], ['-1.005', -1], ['₴1,005', 1], ['1.335', 1.33], ['-1.335', -1.33]]) {
    const result = prep([row('Alias', '1.00', amount)]);
    assert.equal(JSON.parse(result.manifestJson).markup, expected);
    assert.equal(JSON.parse(result.manifestJson).raw_subcent_cells, 1);
  }
  const combined = prep([row('Alias', '1.00', '0.004'), row('Alias', '1.00', '0.004')]);
  assert.equal(JSON.parse(combined.manifestJson).markup, 0.01);
  // Other prepared paths retain their stricter cent-only boundary unchanged.
  assert.throws(() => assertSalesCsvPreflight([header, row('Alias', '1.00', '1.005')]), /SUB_CENT/);
  for (const amount of ['#REF!', 'oops 10', '', '1USD', '9007199254740993']) assert.throws(() => prep([row('Alias', amount)]));
});
test('canonical duplicates across input batches merge before batching and preserve raw count', () => {
  const rows = Array.from({ length: 2001 }, (_, i) => row(`Store-${i}`, '0.10', '-0.03'));
  rows.push(row('Store-0', '0.20', '0.01'));
  const prepared = prep(rows), manifest = JSON.parse(prepared.manifestJson);
  assert.equal(manifest.rows, 2001); assert.equal(manifest.raw_rows, 2002);
  assert.equal(prepared.batches.length, 2);
  const duplicate = JSON.parse(prepared.batches[0].json)[0];
  assert.equal(duplicate.revenue, 0.3); assert.equal(duplicate.markup, -0.02); assert.equal(duplicate.checks, 2);
});
test('malformed CSV, corrupt channels and source regression fail before staging', () => {
  assert.throws(() => parseSalesCsv('"unterminated'), /TRUNCATED/);
  assert.throws(() => parseSalesCsv('a"b'), /QUOTING/);
  assert.throws(() => parseSalesCsv('"a"b'), /QUOTING/);
  assert.deepEqual(parseSalesCsv('"a,b","a""b"\r\n'), [['a,b', 'a"b']]);
  for (const channel of ['ё', 'Є', 'unknown']) { const r = row(); r[9] = channel; assert.throws(() => prep([r]), /CHANNEL|DIMENSION/); }
  assert.throws(() => prepareSalesSnapshot(csv([row()]), { ...context, raw_rows: 2 }, now), /REGRESSION/);
  assert.throws(() => prepareSalesSnapshot(csv([row()]), { ...context, enabled: false }, now), /CONTEXT/);
  const r = row(); r[5] = '2026-11-12'; assert.throws(() => prep([r]), /INCOMPLETE_DATE/);
});

const id = '00000000-0000-4000-8000-000000000001';
async function fixture({ sourceChanged = false, stageFails = false, lostCommit = false, uncertain = false, disabled = false } = {}) {
  const calls = [], source = csv([row()]), digest = await sha256Hex(source);
  const receipt = { ok: true, import_run_id: id, atomic: true, source_sha256: digest, rows_loaded: 1 };
  let reads = 0;
  const result = await handleAtomicSalesRequest(new Request('https://fixture.invalid', { method: 'POST', headers: { 'x-bi-sync-key': 'synthetic' } }), {
    now: () => now, envGet: name => name === 'SUPABASE_URL' ? 'https://rxewpevxqtfmksybykvo.supabase.co' : 'synthetic-role-key',
    fetchImpl: async (url, init) => {
      calls.push({ url, body: init.body });
      const json = x => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });
      if (url.includes('bi_runtime_config')) return json([{ value_hash: await sha256Hex('synthetic') }]);
      if (url === SALES_SOURCE_URL) { reads++; return new Response(sourceChanged && reads === 2 ? source + '\n' : source, { headers: { 'content-type': 'text/csv' } }); }
      if (url.endsWith('sales_snapshot_context_v3')) return disabled ? new Response('private error', { status: 400 }) : json(context);
      if (url.endsWith('begin_sales_snapshot_v3')) return json(id);
      if (url.endsWith('stage_sales_batch_v3')) return stageFails ? new Response('private row', { status: 400 }) : json(1);
      if (url.endsWith('commit_sales_snapshot_v3')) { if (lostCommit) throw Error('secret private network error'); return json(receipt); }
      if (url.endsWith('fail_sales_snapshot_v3')) { if (uncertain) throw Error('unavailable'); return json(lostCommit ? receipt : { status: 'failed' }); }
      assert.fail(url);
    }
  });
  return { result, calls, reads };
}
test('handler authenticates and double-reads before staged atomic publish', async () => {
  const { result, calls, reads } = await fixture(); assert.equal(result.status, 200); assert.equal(reads, 2);
  assert.deepEqual(calls.filter(x => x.url.includes('/rpc/')).map(x => x.url.split('/').at(-1)), ['sales_snapshot_context_v3', 'begin_sales_snapshot_v3', 'stage_sales_batch_v3', 'commit_sales_snapshot_v3']);
  assert.ok(calls.every(x => !x.url.endsWith('sync_sales_batch') && !x.url.endsWith('finalize_sales_snapshot')));
});
test('disabled or changing source never begins an import', async () => {
  for (const config of [{ disabled: true }, { sourceChanged: true }]) {
    const { result, calls } = await fixture(config); assert.equal(result.status, 503);
    assert.equal(calls.some(x => x.url.endsWith('begin_sales_snapshot_v3')), false);
  }
});
test('staging failure does not commit; lost commit reply cannot be relabelled failed', async () => {
  const staged = await fixture({ stageFails: true }); assert.equal(staged.result.status, 500);
  assert.equal(staged.calls.some(x => x.url.endsWith('commit_sales_snapshot_v3')), false);
  assert.equal((await staged.result.json()).published, false);
  const committed = await fixture({ lostCommit: true }); assert.equal(committed.result.status, 200);
  assert.equal((await committed.result.json()).ok, true);
  const unknown = await fixture({ lostCommit: true, uncertain: true }); assert.equal(unknown.result.status, 202);
  assert.equal((await unknown.result.json()).code, 'SALES_IMPORT_STATUS_PENDING');
});
test('missing authentication fails without source or environment access', async () => {
  const result = await handleAtomicSalesRequest(new Request('https://fixture.invalid', { method: 'POST' }), {
    envGet: () => assert.fail('no environment'), fetchImpl: () => assert.fail('no network')
  });
  assert.equal(result.status, 401);
});
