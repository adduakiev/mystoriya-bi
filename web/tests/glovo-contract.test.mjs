import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader} from './support/bi-preview-harness.mjs';

const {GLOVO_HEADERS, GLOVO_DEFAULT_MONTHS, normalizeGlovoSheet, buildGlovoReport, glovoMetrics, glovoPeriodChange} =
  moduleLoader()('lib/data/glovo-contract.ts');
// Synthetic labels and amounts only; never a snapshot of business records.
const row = (changes = {}) => Object.assign(['2026-01', 'SYNTHETIC novel brand', 'Fixture group',
  'Fixture source name', 'Fixture address', 2, 10, 12, true], changes);
const normalize = (...rows) => normalizeGlovoSheet([GLOVO_HEADERS, ...rows]);

test('unformatted native 1/0 flags normalize to booleans without changing row identity or lineage', () => {
  // Copies of the observed cell types only; labels and figures are synthetic.
  for (const [flag, expected] of [[true, true], [false, false], [1, true], [0, false]]) {
    const result = normalize(row({8:flag}));
    assert.equal(result.status, 'valid');
    assert.equal(result.rows[0].sourceHasNumeric, expected);
    assert.deepEqual(result.rows, normalize(row({8:expected})).rows);
    assert.equal(result.rows[0].sourceRow, 12);
  }
});

test('numeric flags never supply missing measures or coerce formatted numeric text', () => {
  for (const flag of [1, 0]) {
    for (const blank of ['', null, undefined]) {
      const result = normalize(row({5:blank, 6:blank, 8:flag}));
      assert.equal(result.status, 'valid');
      assert.equal(result.rows[0].sourceHasNumeric, flag === 1);
      assert.deepEqual(glovoMetrics(result.rows), {deliveredOrders:null, purchaseSum:null, averageTicket:null});
      assert.equal(buildGlovoReport(result, ['2026-01'], ['2026-01']).coverage, 'PARTIAL');
    }
    const zero = normalize(row({5:0, 6:0, 8:flag}));
    assert.deepEqual(glovoMetrics(zero.rows), {deliveredOrders:0, purchaseSum:0, averageTicket:null});
    assert.equal(buildGlovoReport(zero, ['2026-01'], ['2026-01']).coverage, 'COMPLETE');
    const formatted = normalize(row({5:'2', 6:'1 234,50', 8:flag}));
    assert.deepEqual(glovoMetrics(formatted.rows), {deliveredOrders:null, purchaseSum:null, averageTicket:null});
  }
});

test('unsupported flags and structural drift reject the whole dataset even beside a valid numeric flag', () => {
  for (const flag of ['1', '0', 'true', 'false', '', null, undefined, 2, -1, 0.5, NaN, Infinity, {}, []]) {
    const result = normalize(row({8:1}), row({1:'Other synthetic brand', 8:flag}));
    assert.deepEqual(result, {status:'invalid', rows:[], brands:[], issues:[{row:7, code:'ROW_CONTRACT_INVALID'}]});
  }
  const extra = normalize(row({8:1}), [...row({1:'Other synthetic brand', 8:0}), 'extra']);
  assert.deepEqual(extra, {status:'invalid', rows:[], brands:[], issues:[{row:7, code:'ROW_CONTRACT_INVALID'}]});
  for (const headers of [[...GLOVO_HEADERS, 'extra'], GLOVO_HEADERS.map((h, i) => i === 8 ? 'wrong flag header' : h)]) {
    assert.deepEqual(normalizeGlovoSheet([headers, row({8:1})]),
      {status:'invalid', rows:[], brands:[], issues:[{row:5, code:'HEADER_MISMATCH'}]});
  }
  assert.equal(normalize(row({8:1}), row({8:0})).issues[0].code, 'DUPLICATE_COMPOSITE_KEY');
  assert.equal(normalize(row({0:'2026-13', 8:1})).status, 'invalid');
});

test('strict header/local month/typed cell contract rejects drift without leaking rejected records', () => {
  for (const values of [[], [['wrong']], [[...GLOVO_HEADERS].reverse(), row()]]) {
    const result = normalizeGlovoSheet(values);
    assert.equal(result.status, 'invalid');
    assert.deepEqual(result.rows, []);
    assert.equal(result.issues[0].code, 'HEADER_MISMATCH');
  }
  for (const changes of [{0:'2026-13'}, {0:'01/02/2026'}, {1:''}, {2:null}, {3:' '}, {4:123}, {7:0}, {7:'12'}, {8:'TRUE'}]) {
    const result = normalize(row(changes));
    assert.equal(result.status, 'invalid');
    assert.deepEqual(result.rows, []);
    assert.equal(result.issues[0].code, 'ROW_CONTRACT_INVALID');
  }
  assert.equal(normalizeGlovoSheet([GLOVO_HEADERS, [], Array(9).fill(null)]).rows.length, 0);
});

test('brands are discovered dynamically; only approved aliases normalize and raw labels remain inspectable', () => {
  const aliases = ['Мʼясторія Meat Bar', "Meatbar М'ясторія", "Мітбар М'ясторія", "Meatbar М'ясторія / Мітбар М'ясторія"];
  const brands = [...aliases, 'SYNTHETIC new brand', 'Мʼясторія Meat Bar NEW'];
  const result = normalize(...brands.map(brand => row({1:brand})));
  assert.equal(result.status, 'valid');
  assert.equal(result.brands.length, brands.length);
  assert.deepEqual(result.rows.map(r => r.rawBrand), brands);
  assert.deepEqual(result.rows.map(r => r.normalizedGroup), [...aliases.map(() => 'МітБар'), null, null]);
  assert.equal(new Set(result.rows.map(r => r.key)).size, brands.length);
  for (const r of result.rows) {
    assert.equal(r.physicalLocation, null);
    assert.equal(r.ownership, 'UNKNOWN');
    assert.equal(r.identity, 'UNKNOWN');
    assert.match(r.mappingReason, /needs mapping/);
  }
  assert.equal(normalize(row({1:"  М’ясторія   Meat Bar "})).rows[0].normalizedGroup, 'МітБар');
});

test('composite duplicates reject whole dataset; Excel lineage can repeat across months/brands/locations', () => {
  const duplicate = normalize(row(), row({7:99}));
  assert.equal(duplicate.status, 'invalid');
  assert.deepEqual(duplicate.rows, []);
  assert.deepEqual(duplicate.issues, [{row:7, code:'DUPLICATE_COMPOSITE_KEY'}]);
  const distinct = normalize(row(), row({0:'2026-02'}), row({1:'SYNTHETIC second brand'}),
    row({2:'Other sheet group'}), row({3:'Other source name'}), row({4:'Other source address'}));
  assert.equal(distinct.status, 'valid');
  assert.equal(distinct.rows.length, 6);
  assert.equal(new Set(distinct.rows.map(r => r.key)).size, 6);
});

test('missing measures never become zero or partial totals; real zero remains a measured value', () => {
  for (const missing of [null, undefined, '', '0', false, NaN, Infinity, -1]) {
    const r = normalize(row({5:missing, 8:false}));
    assert.equal(r.status, 'valid');
    assert.deepEqual(glovoMetrics(r.rows), {deliveredOrders:null, purchaseSum:10, averageTicket:null});
    const sumMissing = normalize(row({6:missing, 8:false}));
    assert.equal(glovoMetrics(sumMissing.rows).purchaseSum, null);
  }
  const zero = normalize(row({5:0, 6:0}));
  assert.deepEqual(glovoMetrics(zero.rows), {deliveredOrders:0, purchaseSum:0, averageTicket:null});
  assert.deepEqual(glovoMetrics([]), {deliveredOrders:null, purchaseSum:null, averageTicket:null});
  const incomplete = normalize(row(), row({1:'Other synthetic brand', 6:null, 8:false}));
  assert.deepEqual(glovoMetrics(incomplete.rows), {deliveredOrders:4, purchaseSum:null, averageTicket:null});
  assert.equal(normalize(row({5:1.5, 8:false})).rows[0].deliveredOrders, null);
  const flaggedMissing = normalize(row({6:null}));
  assert.equal(flaggedMissing.status, 'valid');
  assert.equal(flaggedMissing.rows[0].sourceHasNumeric, true);
  assert.equal(glovoMetrics(flaggedMissing.rows).purchaseSum, null, 'numeric flag cannot conceal missingness');
  assert.equal(normalize(row({8:false})).rows[0].sourceHasNumeric, false, 'source flag is preserved without inventing its formula');
});

test('average ticket uses ratio of sums and safe positive denominator', () => {
  const rows = normalize(row(), row({1:'Other synthetic brand', 5:8, 6:10})).rows;
  assert.deepEqual(glovoMetrics(rows), {deliveredOrders:10, purchaseSum:20, averageTicket:2});
  assert.equal(glovoMetrics(normalize(row({5:1, 6:0})).rows).averageTicket, 0);
});

test('default Jan–Oct excludes partial November; new months require explicit selection and coverage evidence', () => {
  const data = normalize(...Array.from({length:11}, (_, i) => row({0:`2026-${String(i + 1).padStart(2, '0')}`})));
  const report = buildGlovoReport(data, GLOVO_DEFAULT_MONTHS);
  assert.equal(report.coverage, 'COMPLETE');
  assert.equal(report.rows.length, 10);
  assert.equal(report.metrics.deliveredOrders, 20);
  assert.equal(report.metrics.purchaseSum, 100);
  assert.equal(report.trend.length, 10);
  const extended = buildGlovoReport(data, GLOVO_DEFAULT_MONTHS, [...GLOVO_DEFAULT_MONTHS, '2026-11']);
  assert.equal(extended.coverage, 'PARTIAL');
  assert.equal(extended.trend.at(-1).coverage, 'PARTIAL');
  assert.equal(extended.metrics.purchaseSum, 110);
  assert.equal(buildGlovoReport(data).coverage, 'PARTIAL', 'row presence is not coverage evidence');
  const gaps = buildGlovoReport(normalize(row()), GLOVO_DEFAULT_MONTHS);
  assert.equal(gaps.coverage, 'PARTIAL');
  assert.equal(gaps.trend[1].deliveredOrders, null);
  const missing = buildGlovoReport(normalize(row({6:null, 8:false})), ['2026-01'], ['2026-01']);
  assert.equal(missing.coverage, 'PARTIAL');
  assert.equal(buildGlovoReport(normalize(row(), row())), null);
  for (const months of [[], ['2026-01', '2026-01'], ['2026-99']]) assert.equal(buildGlovoReport(data, [], months), null);
});

test('comparison is unavailable unless both periods are complete with a valid prior denominator', () => {
  const period = (sum, coverage = 'COMPLETE') => ({coverage, metrics:{deliveredOrders:2, purchaseSum:sum, averageTicket:sum / 2}});
  assert.equal(glovoPeriodChange(period(15), period(10)), 50);
  assert.equal(glovoPeriodChange(period(0), period(10)), -100);
  for (const [a,b] of [[period(15,'PARTIAL'),period(10)], [period(15),period(10,'PARTIAL')],
    [period(null),period(10)], [period(15),period(null)], [period(15),period(0)]]) assert.equal(glovoPeriodChange(a,b), null);
});
