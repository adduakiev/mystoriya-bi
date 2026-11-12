import test from 'node:test';
import assert from 'node:assert/strict';
import { previewHarness, moduleLoader, rpcFixture, React, renderToStaticMarkup } from './support/bi-preview-harness.mjs';

const dimensions = { channel: '', orderType: '', location: '', brand: '', ownership: '' };
const rpcDimensions = ['p_channel', 'p_order_type', 'p_location', 'p_brand', 'p_ownership'];
const query = { ...dimensions, year: 2026, month: 10, period: 'month', compare: 'ly',
  metric: 'revenue', grain: 'month', lfl: false, dimension: 'location', sort: 'current' };

for (const [file, method] of [
  ['overview', 'loadOverviewData'], ['delivery', 'loadDeliveryData'],
  ['locations', 'loadLocationsData'], ['dynamics', 'loadDynamicsData'],
  ['explorer', 'loadExplorerData'], ['insights', 'loadInsightsData']
]) {
  test(`${file}: submitting all-dimension selects preserves SQL's unfiltered request`, async () => {
    for (const empty of ['', '  ']) {
      const h = previewHarness();
      const result = await h.load(`lib/data/${file}.ts`)[method]({
        ...query, ...Object.fromEntries(Object.keys(dimensions).map(key => [key, empty]))
      });
      assert.equal(result.source, 'supabase-sql');
      assert.equal(h.calls.length, 1);
      for (const key of rpcDimensions) {
        if (Object.hasOwn(h.calls[0].args, key)) assert.equal(h.calls[0].args[key], null, key);
      }
      assert.equal(h.calls[0].args.p_lfl, false);
    }
    const h = previewHarness();
    await h.load(`lib/data/${file}.ts`)[method]({ ...query, channel: 'Заклад',
      orderType: 'Заклад', location: 'Ахматова', brand: 'Мясторія', ownership: 'Власні' });
    const expected = { p_channel: 'Заклад', p_order_type: 'Заклад', p_location: 'Ахматова',
      p_brand: 'Мясторія', p_ownership: 'Власні' };
    for (const [key, value] of Object.entries(expected)) {
      if (Object.hasOwn(h.calls[0].args, key)) assert.equal(h.calls[0].args[key], value, key);
    }
  });
}

test('actual Overview month form with empty selects renders the SQL report, without legacy fallback', async () => {
  let legacyCalls = 0;
  const calls = [];
  const load = moduleLoader({
    'next/cache': { unstable_cache: fn => fn },
    'next/link': { default: ({ prefetch, children, ...props }) => React.createElement('a', props, children) },
    '@/components/DashboardSidebar': { DashboardSidebar: props => React.createElement('aside', null, props.statusTitle) },
    '@/components/MultiYearMetricChart': { MultiYearMetricChart: () => null },
    '@/components/ChannelMixChart': { ChannelMixChart: () => null },
    '@/lib/data/source': {
      loadSalesDataStatus: async () => ({ source: 'unknown', status: 'unavailable', cutoffDate: null }),
      loadSalesData: async () => { legacyCalls++; throw Error('Unexpected legacy fallback'); },
      callBiRpc: async (name, args) => {
        calls.push({ name, args });
        // Match the deployed SQL's NULL-only optional filters. A blank string
        // selects no rows and raises no_data, as reproduced in Preview logs.
        if (rpcDimensions.some(key => args[key] !== null)) throw Error('no_data');
        const payload = rpcFixture(name, args);
        payload.meta.cutoffDate = '2026-10-31';
        payload.meta.latestSourceDate = '2026-11-10';
        return payload;
      }
    }
  });
  const html = renderToStaticMarkup(await load('app/page.tsx').default({ searchParams: Promise.resolve({
    ...dimensions, year: '2026', month: '10', period: 'month', compare: 'ly', metric: 'revenue'
  }) }));
  assert.equal(legacyCalls, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.p_focus_year, 2026);
  assert.equal(calls[0].args.p_focus_month, 10);
  assert.match(html, /SQL CONNECTED/);
  assert.doesNotMatch(html, /FALLBACK \/ UNVERIFIED/);
  assert.match(html, /value="10" selected=""/);
});
