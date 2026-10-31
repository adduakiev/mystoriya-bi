import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

for (const source of ['supabase-sql', 'legacy']) {
  test(`Aggregators SSR distinguishes ${source} connectivity from verified freshness`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Synthetic SSR must not reach network'));
    const data = {
      source,
      rowCount: 12,
      aggregators: [],
      snapshot: {
        periodLabel: 'SYNTHETIC PERIOD', cutoffDate: '2026-10-26',
        comparisonLabel: 'LY', kpis: [], trend: [], locations: [],
        signal: {title: 'SYNTHETIC SIGNAL', body: 'SYNTHETIC BODY'}
      }
    };
    const load = moduleLoader({
      'next/link': {default: ({prefetch, children, ...props}) => React.createElement('a', props, children)},
      '@/components/DashboardSidebar': {DashboardSidebar: ({statusTitle, statusDetail}) =>
        React.createElement('aside', null, statusTitle, ' ', statusDetail)},
      '@/components/KpiCard': {KpiCard: () => null},
      '@/components/RevenueChart': {RevenueChart: () => null},
      '@/lib/analytics': {formatUah: value => String(value)},
      '@/lib/data/aggregators': {loadAggregatorsData: async () => data}
    });
    const html = renderToStaticMarkup(await load('app/aggregators/page.tsx').default({
      searchParams: Promise.resolve({})
    }));
    assert.match(html, /SYNTHETIC PERIOD/);
    assert.doesNotMatch(html, /AGGREGATORS · LIVE|Live data connected/);
    if (source === 'supabase-sql') {
      assert.match(html, /AGGREGATORS · SQL CONNECTED · FRESHNESS UNVERIFIED/);
      assert.match(html, /12 SQL rows · freshness UNKNOWN/);
      assert.doesNotMatch(html, /FALLBACK \/ UNVERIFIED|SQL RPC недоступний/);
    } else {
      assert.match(html, /AGGREGATORS · FALLBACK \/ UNVERIFIED/);
      assert.match(html, /12 fallback rows · source and completeness UNKNOWN/);
      assert.match(html, /SQL RPC недоступний/);
      assert.match(html, /Supabase snapshot або Google Sheets/);
      assert.match(html, /Свіжість і повнота даних не перевірені/);
      assert.doesNotMatch(html, /SQL CONNECTED/);
    }
  });
}
