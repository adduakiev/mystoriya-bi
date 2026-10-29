import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader} from './support/bi-preview-harness.mjs';

const baseline = {revenue: 100, checks: 10, markup: 20, averageCheck: 10, markupRate: 20};
const zeros = {revenue: 0, checks: 0, markup: 0, averageCheck: 0, markupRate: 0};

async function locationsSnapshot(current, previous) {
  const calls = [];
  const payload = {
    meta: {selectedYear: 2024, previousYear: 2023, selectedMonth: 1,
      years: [2024], months: [1], brands: [], ownerships: [],
      cutoffDate: '2024-01-31', periodLabel: 'Січ 2024'},
    current, previous, locationRows: [], lfl: {}
  };
  const before = structuredClone(payload);
  const load = moduleLoader({
    'next/cache': {unstable_cache: fn => fn},
    '@/lib/data/source': {
      callBiRpc: async (name, args) => { calls.push({name, args}); return payload; },
      loadSalesData: async () => { throw Error('Unexpected legacy fallback'); }
    }
  });
  const data = await load('lib/data/locations.ts').loadLocationsData({year: 2024, month: 1, lfl: false});
  assert.equal(data.source, 'supabase-sql');
  assert.deepEqual(calls, [{name: 'bi_locations_payload', args: {
    p_brand: null, p_ownership: null, p_focus_year: 2024, p_focus_month: 1, p_lfl: false
  }}]);
  assert.deepEqual(payload, before, 'adapter must not mutate the RPC payload');
  return data.snapshot;
}

test('Locations: real 2024 sales with no 2023 baseline are UNKNOWN, never +0.0%', async () => {
  const s = await locationsSnapshot({...baseline, revenue: 10214065.30, checks: 15378}, zeros);
  assert.equal(s.signal.severity, 'info');
  assert.equal(s.signal.title, 'Немає зіставної бази для обороту');
  assert.equal(s.signal.body, 'Оборот: немає зіставної бази. Чеки: немає зіставної бази. Середній чек: немає зіставної бази vs 2023.');
  for (const k of s.kpis) assert.equal(k.delta, null, k.label);
  assert.doesNotMatch(s.signal.body, /[+-]?0\.0%|NaN|Infinity|undefined/);
});

test('Locations: missing previous object also cannot become measured zero', async () => {
  const s = await locationsSnapshot(baseline, undefined);
  assert.equal(s.signal.title, 'Немає зіставної бази для обороту');
  assert.equal(s.kpis.find(k => k.label === 'Націнка %').delta, null);
});

test('Locations: measured unchanged values stay +0.0%, not unknown', async () => {
  const s = await locationsSnapshot(baseline, baseline);
  assert.equal(s.signal.title, 'Без змін обороту');
  assert.match(s.signal.body, /Оборот: \+0\.0%\. Чеки: \+0\.0%\. Середній чек: \+0\.0%/);
  assert.equal(s.kpis.find(k => k.label === 'Націнка %').delta, 0);
});

test('Locations: valid growth and falling markup produce a real warning', async () => {
  const s = await locationsSnapshot({...baseline, revenue: 120, checks: 12, averageCheck: 10, markupRate: 19}, baseline);
  assert.equal(s.signal.title, 'Позитивна динаміка');
  assert.equal(s.signal.severity, 'warning');
  assert.match(s.signal.body, /Оборот: \+20\.0%\. Чеки: \+20\.0%\. Середній чек: \+0\.0%/);
  assert.equal(s.kpis.find(k => k.label === 'Націнка %').delta, -1);
});

test('Locations: zero current checks/revenue do not invent AOV or markup percentages', async () => {
  const s = await locationsSnapshot(zeros, baseline);
  assert.equal(s.signal.title, 'Період нижче бази порівняння');
  assert.match(s.signal.body, /Оборот: -100\.0%\. Чеки: -100\.0%\. Середній чек: немає зіставної бази/);
  assert.equal(s.kpis.find(k => k.label === 'Середній чек').value, '—');
  assert.equal(s.kpis.find(k => k.label === 'Націнка %').value, '—');
  assert.equal(s.kpis.find(k => k.label === 'Націнка %').delta, null);
});

test('Locations: genuine prior 0% markup with positive revenue permits a pp delta', async () => {
  const s = await locationsSnapshot({...baseline, markupRate: 10}, {...baseline, markupRate: 0, markup: 0});
  assert.equal(s.kpis.find(k => k.label === 'Націнка %').delta, 10);
});
