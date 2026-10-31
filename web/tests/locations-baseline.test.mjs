import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

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


test('Locations source badge and visible warning distinguish SQL from unverified Google Sheets fallback', async () => {
  for (const source of ['legacy', 'supabase-sql']) {
    const data = {
      source, years:[2025], selectedYear:2025, months:[1], brands:[], ownerships:[],
      snapshot:{periodLabel:'2025 YTD', cutoffDate:'2025-01-31', kpis:[]},
      locationRows:[], lflCount:0, lflCurrentRevenue:0, lflPreviousRevenue:0, lflGrowth:null
    };
    const load = moduleLoader({
      'next/link': {default: ({prefetch,children,...props}) => React.createElement('a',props,children)},
      'lucide-react': {Filter: () => null},
      '@/components/DashboardSidebar': {
        DashboardSidebar: ({statusTitle,statusDetail}) => React.createElement('aside',null,statusTitle,' ',statusDetail)
      },
      '@/components/KpiCard': {KpiCard: () => null},
      '@/components/LocationsComparisonChart': {LocationsComparisonChart: () => null},
      '@/lib/data/locations': {loadLocationsData: async () => data}
    });
    const html = renderToStaticMarkup(await load('app/locations/page.tsx').default({searchParams:Promise.resolve({})}));
    if (source === 'legacy') {
      assert.match(html,/LOCATIONS PERFORMANCE · FALLBACK \/ UNVERIFIED/);
      assert.match(html,/SQL RPC недоступний · резервний шлях, джерело UNKNOWN/);
      assert.match(html,/фактичне джерело \(Supabase snapshot або Google Sheets\)/);
      assert.doesNotMatch(html,/Live data connected|LOCATIONS PERFORMANCE · LIVE/);
    } else {
      assert.match(html,/LOCATIONS PERFORMANCE · SQL CONNECTED · FRESHNESS UNVERIFIED/);
      assert.match(html,/SQL CONNECTED · FRESHNESS UNVERIFIED/);
      assert.doesNotMatch(html,/FALLBACK \/ UNVERIFIED|SQL-джерело недоступне/);
    }
  }
});

function locationsPeriodHarness(metaPatch = {}, source = 'supabase-sql') {
  const calls = [];
  const data = {
    source, years:[2024,2025,2026], selectedYear:2025, selectedMonth:10,
    months:[10], brands:['Marmoo'], ownerships:[],
    ...metaPatch,
    snapshot:{periodLabel:'LEAKED PERIOD', cutoffDate:'2026-10-26', kpis:[], ...metaPatch.snapshot},
    locationRows:[], lflCount:0, lflCurrentRevenue:987654321,
    lflPreviousRevenue:0, lflGrowth:null
  };
  const load = moduleLoader({
    'next/link': {default: ({prefetch,children,...props}) => React.createElement('a',props,children)},
    'lucide-react': {Filter: () => null},
    '@/components/DashboardSidebar': {DashboardSidebar: ({statusTitle,statusDetail}) =>
      React.createElement('aside',null,statusTitle,' ',statusDetail)},
    '@/components/KpiCard': {KpiCard: () => React.createElement('div',null,'LEAKED KPI')},
    '@/components/LocationsComparisonChart': {LocationsComparisonChart: () =>
      React.createElement('div',null,'LEAKED CHART')},
    '@/lib/data/locations': {loadLocationsData: async options => {calls.push(options);return data;}}
  });
  return {calls, async render(params = {}) {
    return renderToStaticMarkup(await load('app/locations/page.tsx').default({
      searchParams:Promise.resolve({year:'2025',month:'10',brand:'Marmoo',...params})
    }));
  }};
}

for (const scenario of [
  {name:'Marmoo has no 2025 sales but RPC uses October 2026', patch:{}},
  {name:'requested month is not the SQL cutoff month', patch:{selectedYear:2026, snapshot:{cutoffDate:'2026-10-26'}}, params:{year:'2026',month:'5'}},
  {name:'RPC echoes a different selected year', patch:{selectedYear:2026}, params:{year:'2025'}},
  {name:'RPC echoes a different selected month', patch:{selectedMonth:9}},
  {name:'invalid calendar cutoff', patch:{snapshot:{cutoffDate:'2025-02-30'}}},
  {name:'missing cutoff', patch:{snapshot:{cutoffDate:''}}}
]) {
  test(`Locations SSR fails closed: ${scenario.name}`, async t => {
    t.mock.method(globalThis,'fetch', () => assert.fail('No network allowed'));
    const h = locationsPeriodHarness(scenario.patch);
    const html = await h.render(scenario.params);
    assert.equal(h.calls.length,1);
    assert.match(html,/NO DATA \/ UNKNOWN/);
    assert.match(html,/Немає підтверджених даних за обраний період/);
    assert.match(html,/Відсутність даних не означає нуль/);
    assert.doesNotMatch(html,/987654321|LEAKED|kpi-grid|locations-matrix|LOCATIONS PERFORMANCE · SQL CONNECTED|₴/);
  });
}

test('Locations SSR renders a confirmed selected year and month', async t => {
  t.mock.method(globalThis,'fetch', () => assert.fail('No network allowed'));
  const h = locationsPeriodHarness({selectedYear:2026, snapshot:{cutoffDate:'2026-10-26'}});
  const html = await h.render({year:'2026',month:'10'});
  assert.equal(h.calls.length,1);
  assert.match(html,/LOCATIONS PERFORMANCE · SQL CONNECTED · FRESHNESS UNVERIFIED/);
  assert.match(html,/LEAKED PERIOD|locations-matrix/);
  assert.doesNotMatch(html,/NO DATA \/ UNKNOWN/);
});
