import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader, rpcFixture, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

// Exact Delivery page and adapter with synthetic SQL responses only.
// No browser authentication, database, credentials or external network.
const metrics = {revenue:987654321, checks:67891, markup:34567890, averageCheck:14547, markupRate:35};

function harness(metaPatch = {}, options = {}) {
  const calls = [];
  const load = moduleLoader({
    'next/cache': {unstable_cache: fn => fn},
    'next/link': {default: ({prefetch, children, ...props}) => React.createElement('a', props, children)},
    '@/components/DashboardSidebar': {DashboardSidebar: props =>
      React.createElement('aside', null, props.statusTitle, props.statusDetail)},
    '@/components/MultiYearMetricChart': {MultiYearMetricChart: () =>
      React.createElement('div', {'data-chart':'multi'})},
    '@/components/DeliveryVsAggregatorChart': {DeliveryVsAggregatorChart: () =>
      React.createElement('div', {'data-chart':'delivery'})},
    '@/lib/data/source': {
      callBiRpc: async (name, args) => {
        assert.equal(name, 'bi_delivery_payload');
        calls.push(args);
        const fixture = rpcFixture(name, args);
        return {
          ...fixture,
          meta: {...fixture.meta, selectedYear:2026, currentYear:2026,
            cutoffDate:'2026-10-22', periodLabel:'LEAKED PERIOD', ...metaPatch},
          current:options.current ?? metrics,
          previous:options.previous ?? {...metrics, revenue:100},
          deliveryMetrics:metrics, aggregatorMetrics:{...metrics, revenue:options.aggregatorRevenue ?? metrics.revenue},
          multiYearData:[{label:'LEAKED CHART', 2026:metrics.revenue}],
          typeSummary:[{name:'LEAKED TYPE', ...metrics, share:100}],
          compareSeries:[{label:'LEAKED SERIES',delivery:metrics.revenue,aggregator:100}],
          locationRows:[{name:'LEAKED LOCATION', ...metrics, growth:100,
            deliveryShare:100, aggregatorRevenue:options.aggregatorRevenue ?? 100, versusAggregator:100}]
        };
      },
      loadSalesData: async () => assert.fail('A known period mismatch must not use legacy')
    }
  });
  return {
    calls,
    async data() {
      return load('lib/data/delivery.ts').loadDeliveryData({
        year:2026, month:10, location:'Черкаси',
        metric:'revenue', grain:'month', lfl:false
      });
    },
    async render(params = {}) {
      return renderToStaticMarkup(await load('app/delivery/page.tsx').default({
        searchParams:Promise.resolve({year:'2026', month:'10', location:'Черкаси', ...params})
      }));
    }
  };
}

const mismatches = [
  {name:'October 2026 filter falls back to July 2026', meta:{cutoffDate:'2026-07-14'}},
  {name:'2026 YTD falls back to December 2025', params:{month:undefined,location:'Європарк'},
    meta:{cutoffDate:'2025-12-31',currentYear:2025,selectedMonth:null}},
  {name:'RPC echoes a different year', meta:{selectedYear:2025}},
  {name:'RPC echoes a different month', meta:{selectedMonth:7}},
  {name:'RPC currentYear differs', meta:{currentYear:2025}},
  {name:'invalid calendar cutoff', meta:{cutoffDate:'2026-02-30'}},
  {name:'missing cutoff', meta:{cutoffDate:undefined}}
];

for (const scenario of mismatches) {
  test(`Delivery SSR fails closed: ${scenario.name}`, async t => {
    t.mock.method(globalThis,'fetch', () => assert.fail('No network allowed'));
    const h = harness(scenario.meta);
    const html = await h.render(scenario.params);
    assert.equal(h.calls.length,1);
    assert.equal(h.calls[0].p_grain,'month');
    assert.match(html,/NO DATA \/ UNKNOWN/);
    assert.match(html,/Немає підтверджених даних за обраний період/);
    assert.match(html,/Відсутність даних не означає нуль/);
    assert.doesNotMatch(html,/987654321|LEAKED|kpi-grid|delivery-table|data-chart|OWN DELIVERY · LIVE|Live data connected|₴/);
  });
}

test('Delivery SSR renders valid requested October period without suppressing confirmed data', async t => {
  t.mock.method(globalThis,'fetch', () => assert.fail('No network allowed'));
  const h = harness();
  const html = await h.render();
  assert.equal(h.calls.length,1);
  assert.match(html,/OWN DELIVERY · LIVE/);
  assert.match(html,/kpi-grid/);
  assert.match(html,/LEAKED PERIOD/);
  assert.doesNotMatch(html,/NO DATA \/ UNKNOWN/);
});


test('Delivery SSR shows undefined ratio, not measured zero, when aggregator denominator is absent', async t => {
  t.mock.method(globalThis,'fetch', () => assert.fail('No network allowed'));
  const h = harness({}, {aggregatorRevenue:0});
  const html = await h.render();
  assert.equal(h.calls.length,1);
  assert.match(html,/OWN DELIVERY · LIVE/);
  assert.match(html,/<strong>—<\/strong>/);
  assert.match(html,/<span>—<\/span>/);
  assert.doesNotMatch(html,/<span>Доставка \/ Агрегатори<\/span><strong>0\.0%<\/strong>/);
});

test('Delivery SSR retains a defined ratio when aggregator denominator is nonzero', async t => {
  t.mock.method(globalThis,'fetch', () => assert.fail('No network allowed'));
  const h = harness();
  const html = await h.render();
  assert.match(html,/<strong>100\.0%<\/strong>/);
});

test('Delivery adapter does not invent positive +0.0% growth without prior-year baseline', async t => {
  t.mock.method(globalThis,'fetch', () => assert.fail('No network allowed'));
  // Warehouse has 2024 Delivery revenue but no 2023 Delivery rows.
  const zero = {revenue:0, checks:0, markup:0, averageCheck:0, markupRate:0};
  const {snapshot} = await harness({}, {previous:zero}).data();
  assert.equal(snapshot.signal.title,'Немає зіставної бази для обороту');
  assert.match(snapshot.signal.body,/Оборот: немає зіставної бази\. Чеки: немає зіставної бази\. Середній чек: немає зіставної бази vs/);
  assert.doesNotMatch(snapshot.signal.body,/Оборот: \+0\.0%/);
});

test('Delivery adapter distinguishes genuinely unchanged comparison from missing baseline', async t => {
  t.mock.method(globalThis,'fetch', () => assert.fail('No network allowed'));
  const {snapshot} = await harness({}, {previous:metrics}).data();
  assert.equal(snapshot.signal.title,'Без змін обороту');
  assert.match(snapshot.signal.body,/Оборот: \+0\.0%\. Чеки: \+0\.0%\. Середній чек: \+0\.0% vs/);
});

test('Delivery adapter retains negative growth with positive previous denominator', async t => {
  t.mock.method(globalThis,'fetch', () => assert.fail('No network allowed'));
  const {snapshot} = await harness({}, {current:{...metrics,revenue:metrics.revenue/2},previous:metrics}).data();
  assert.equal(snapshot.signal.title,'Період нижче бази порівняння');
  assert.match(snapshot.signal.body,/Оборот: -50\.0%/);
});

test('Delivery markup percentage-point KPI is UNKNOWN without a prior-year revenue baseline', async t => {
  t.mock.method(globalThis,'fetch', () => assert.fail('No network allowed'));
  const zero = {revenue:0, checks:0, markup:0, averageCheck:0, markupRate:0};
  const {snapshot} = await harness({}, {previous:zero}).data();
  const item = snapshot.kpis.find(kpi => kpi.label === 'Націнка %');
  assert.ok(item);
  assert.equal(item.value, '35.0%');
  assert.equal(item.delta, null);
  assert.equal(item.direction, 'flat');
});

test('Delivery markup percentage-point KPI retains a measured delta with comparable revenue', async t => {
  t.mock.method(globalThis,'fetch', () => assert.fail('No network allowed'));
  const {snapshot} = await harness({}, {previous:{...metrics, markupRate:30}}).data();
  const item = snapshot.kpis.find(kpi => kpi.label === 'Націнка %');
  assert.ok(item);
  assert.equal(item.delta, 5);
  assert.equal(item.direction, 'up');
});
