import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareSalesRecovery, readAndPrepareSalesRecovery } from '../../supabase/functions/sync-google-sheet/prepared-sales-recovery.mjs';

export const header = ['', '', '', '', '', 'Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка', 'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
const row = (name = 'Synthetic', revenue = '0.10', markup = '-0.03') => ['', '', '', '', '', '2026-10-30', name, 'Fixture', 'Owned', 'Заклад', 'Sale', revenue, '1', markup];
const previous = { rawRows: 1, minDate: '2026-10-30', maxDate: '2026-10-30' };
const now = new Date('2026-10-31T00:00:00Z');
const prepare = (matrix, prior = previous) => prepareSalesRecovery(matrix, { previous: prior, now });

test('prepared bodies preserve exact signed cents, trailing zeros, locale decimals and large amounts', () => {
  const result = prepare([header, row('A', '90 071 992 547 409,91'), row('B', '0.1000'), row('C', '-0.01', '-12,4500')]);
  assert.ok(result.manifestJson.includes('"revenue":90071992547410.00'));
  assert.ok(result.manifestJson.includes('"markup":-12.51'));
  assert.ok(result.batches[0].json.includes('"revenue":90071992547409.91'));
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.batches) && Object.isFrozen(result.batches[0]));
});

test('47000 prepared rows have 24 complete immutable batches and exact decimal totals', () => {
  const result = prepare([header, ...Array.from({ length: 47000 }, (_, i) => row(`Synthetic-${i}`))]);
  assert.equal(result.batches.length, 24);
  assert.equal(JSON.parse(result.batches[23].json).length, 1000);
  assert.equal(JSON.parse(result.manifestJson).revenue, 4700);
  assert.equal(JSON.parse(result.manifestJson).markup, -1410);
  assert.deepEqual(result.batches.map(b => b.batchNo), Array.from({ length: 24 }, (_, i) => i));
});

test('empty, partial, missing/unknown, duplicate and unsafe precision inputs fail closed', () => {
  for (const matrix of [[], [header], [header, row().slice(0, 13)]]) assert.throws(() => prepare(matrix));
  for (const [column, value] of [[6, 'unknown'], [7, 'null'], [11, ''], [11, '0.004'], [11, '100000000000000'], [12, '-1'], [12, '1.5'], [13, '#N/A']]) {
    const changed = row(); changed[column] = value;
    assert.throws(() => prepare([header, changed]));
  }
  // Structured identities avoid the legacy delimiter-key collision.
  const a = row('A|B'); a[7] = 'C'; const b = row('A'); b[7] = 'B|C';
  assert.equal(JSON.parse(prepare([header, a, b]).manifestJson).rows, 2);
});

test('same normalized raw Sales keys aggregate exact cents without losing raw-row provenance', () => {
  const second = row(' Synthetic  ', '0.20', '0.01');
  second[12] = '2';
  const prepared = prepare([header, row('Synthetic', '0.10', '-0.03'), second]);
  const manifest = JSON.parse(prepared.manifestJson);
  assert.equal(manifest.rows, 1);
  assert.equal(manifest.raw_rows, 2);
  assert.equal(manifest.batches, 1);
  assert.equal(manifest.revenue, 0.3);
  assert.equal(manifest.checks, 3);
  assert.equal(manifest.markup, -0.02);
  const staged = JSON.parse(prepared.batches[0].json);
  assert.equal(staged.length, 1);
  assert.deepEqual(staged.map(x => [x.location_raw, x.revenue, x.checks, x.markup]), [['Synthetic', 0.3, 3, -0.02]]);
  assert.match(prepared.batches[0].json, /"revenue":0\.30,"checks":3,"markup":-0\.02/);
});

test('aggregate totals cannot overflow the SQL numeric row limit', () => {
  assert.throws(() => prepare([header, row('Overflow', '90000000000000.00'), row('Overflow', '20000000000000.00')]), /INVALID_AGGREGATE_PRECISION/);
});

test('unknown baseline, even small truncation and date-coverage regression fail closed', async () => {
  for (const prior of [undefined, {}, { ...previous, rawRows: '1' }, { ...previous, minDate: '2026-02-30' }]) {
    await assert.rejects(readAndPrepareSalesRecovery('never-a-credential', { previous: prior, now,
      fetchImpl: () => assert.fail('must reject before network') }), /UNKNOWN_BASELINE/);
  }
  assert.throws(() => prepare([header, row()], { ...previous, rawRows: 2 }), /REGRESSION/);
  assert.throws(() => prepare([header, row()], { ...previous, minDate: '2026-10-29' }), /DATE_REGRESSION/);
  assert.throws(() => prepareSalesRecovery([header, row()], { previous: { ...previous, maxDate: '2026-10-31' }, now: new Date('2026-11-01T00:00:00Z') }), /DATE_REGRESSION/);
});

test('only completed Kyiv accounting dates are accepted, without suffix/fraction truncation', () => {
  for (const date of ['2026-10-31', '2026-11-02', '2026-10-30junk', '2026-10-30T12:00:00Z', '46325.5']) {
    const changed = row(); changed[5] = date; assert.throws(() => prepare([header, changed]));
  }
  const changed = row(); changed[5] = '2026-10-31';
  assert.throws(() => prepareSalesRecovery([header, changed], { previous, now: new Date('2026-10-31T20:30:00Z') }), /INCOMPLETE_OR_FUTURE_DATE/);
  // 22:30 UTC is already Nov 1 in Kyiv: Oct 31 is completed, Nov 1 is not.
  const valid = prepareSalesRecovery([header, row(), changed], { previous, now: new Date('2026-10-31T22:30:00Z') });
  assert.equal(JSON.parse(valid.manifestJson).max_date, '2026-10-31');
});

test('a source stopping before the latest completed Kyiv day is partial, never silently accepted', () => {
  assert.throws(() => prepareSalesRecovery([header, row()], { previous, now: new Date('2026-11-01T12:00:00Z') }), /STALE_OR_PARTIAL_CUTOFF/);
});

test('prepared module has no production wiring or database execution', () => {
  for (const file of ['../../supabase/functions/sync-google-sheet/index.ts', '../app/api/data-sync/route.ts']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /prepared-sales-recovery|readAndPrepareSalesRecovery/);
  }
});
