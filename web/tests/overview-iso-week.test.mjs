import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader} from './support/bi-preview-harness.mjs';

// Pure in-process analytics fixtures. No database, browser session or external network.
const {buildMultiYearWeeklyMetricSeries: weekly} = moduleLoader()('lib/analytics.ts');
const row = (date, revenue, checks) => ({
  date, revenue, checks, markup:0, location:'fixture', brand:'fixture',
  ownership:'fixture', channelGroup:'Заклад', orderType:'fixture'
});

test('ISO W01 assigns Dec 30-31 2024 to ISO 2025, not calendar 2024', () => {
  const rows = [
    row('2024-01-01', 1995997.10, 3098),
    row('2024-12-30', 2000000.00, 1800),
    row('2024-12-31', 1734756.40, 1595),
    row('2025-01-01', 1952076.90, 3061),
    row('2025-01-05', 0, 0),
    row('2026-10-26', 1, 1) // ISO W44: keep W01 in multi-year output.
  ];
  const before = structuredClone(rows);
  const revenue = weekly(rows, [2024,2025,2026], 'revenue');
  const checks = weekly(rows, [2024,2025,2026], 'checks');
  assert.equal(revenue.length, 44);
  assert.equal(revenue[0].label, 'W01');
  assert.equal(Math.round(revenue[0]['2024'] * 100), 199599710);
  assert.equal(Math.round(revenue[0]['2025'] * 100), 568683330);
  assert.equal(checks[0]['2024'], 3098);
  assert.equal(checks[0]['2025'], 6456);
  assert.deepEqual(rows, before, 'Grouping must not mutate source rows');
});

test('ISO 53-week year includes January dates in previous ISO year', () => {
  const rows = [
    row('2020-12-28', 100, 1), // ISO 2020 W53
    row('2021-01-01', 200, 2), // ISO 2020 W53, not 2021 W53
    row('2021-01-04', 300, 3), // ISO 2021 W01
    row('2026-12-31', 10, 1)  // ISO 2026 W53, makes W53 visible
  ];
  const result = weekly(rows, [2020,2021,2026], 'revenue');
  assert.equal(result.length, 53);
  assert.equal(result[0].label, 'W01');
  assert.equal(result[0]['2021'], 300);
  assert.equal(result[52].label, 'W53');
  assert.equal(result[52]['2020'], 300);
  assert.equal(result[52]['2021'], 0);
  assert.equal(result[52]['2026'], 10);
});

test('Jan 1 in next calendar year does not reset ISO cutoff week', () => {
  const rows = [
    row('2026-12-31', 10, 1),
    row('2027-01-01', 20, 2) // ISO 2026 W53
  ];
  const result = weekly(rows, [2026,2027], 'revenue');
  assert.equal(result.length, 53);
  assert.equal(result[52]['2026'], 30);
  assert.equal(result[52]['2027'], 0);
});

test('two consecutive year crossings preserve full ISO W01 revenue and checks (2024→25→26)', () => {
  // Aggregated daily fixtures independently reconciled against warehouse on 2026-10-28.
  // 2025-12-29..31 belong to ISO 2026 W01, not ISO 2025 W01.
  const rows = [
    row('2024-01-01', 1995997.10, 3098),
    row('2024-12-30', 1327824.20, 1317),
    row('2024-12-31', 2406932.20, 2078),
    row('2025-01-01', 1952076.90, 3061),
    row('2025-12-29', 779921.60, 904),
    row('2025-12-30', 1253767.60, 1245),
    row('2025-12-31', 2723043.70, 1745),
    row('2026-01-01', 1528939.60, 2234),
    row('2026-10-26', 1, 1) // Keep W01 visible in a 44-week current-year chart.
  ];
  const before = structuredClone(rows);
  const revenue = weekly(rows, [2024, 2025, 2026], 'revenue');
  const checks = weekly(rows, [2024, 2025, 2026], 'checks');
  assert.equal(revenue[0].label, 'W01');
  assert.equal(Math.round(revenue[0]['2024'] * 100), 199599710);
  assert.equal(Math.round(revenue[0]['2025'] * 100), 568683330);
  assert.equal(Math.round(revenue[0]['2026'] * 100), 628567250);
  assert.equal(checks[0]['2024'], 3098);
  assert.equal(checks[0]['2025'], 6456);
  assert.equal(checks[0]['2026'], 6128);
  assert.deepEqual(rows, before, 'Weekly grouping must not mutate input');
});
