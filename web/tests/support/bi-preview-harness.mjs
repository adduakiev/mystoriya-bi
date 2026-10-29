// Test-only loader: real pages/adapters, synthetic RPC boundary, no application secrets or IO.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');
export const React = require('react');
export const {renderToStaticMarkup} = require('react-dom/server');
const web = fileURLToPath(new URL('../../', import.meta.url));

export function moduleLoader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(web, file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = {exports: {}};
    cache.set(file, module);
    const {outputText} = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}
    });
    function resolve(name) {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.endsWith('.css')) return new Proxy({}, {get: (_, key) => String(key)});
      if (name.startsWith('@/') || name.startsWith('.')) {
        let target = name.startsWith('@/') ? path.resolve(web, name.slice(2)) : path.resolve(path.dirname(file), name);
        if (!path.extname(target)) target += fs.existsSync(`${target}.tsx`) ? '.tsx' : '.ts';
        return load(target);
      }
      if (['react', 'react/jsx-runtime', 'lucide-react', 'next/server'].includes(name)) return require(name);
      throw Error(`Unmocked dependency denied: ${name}`);
    }
    new Function('require', 'module', 'exports', 'Date', outputText)(resolve, module, module.exports, overrides.Date ?? Date);
    return module.exports;
  }
  return load;
}

export function rpcFixture(name, args = {}, state = 'partial') {
  const from = args.p_from || '2026-09-24', to = args.p_to || '2026-10-23';
  const value = state === 'zero' ? 0 : state === 'missing' ? null : 123;
  const rows = state === 'empty' ? 0 : 1;
  const meta = {from, to, currentGa4Rows: rows, currentSearchRows: rows, available: true, rows, observedDates: rows,
    ga4Latest: to, searchLatest: to, commonLatest: to, currentYear: 2026, cutoffMonth: 10, cutoffDay: 23,
    selectedYear: args.p_focus_year || 2026, selectedMonth: args.p_focus_month ?? null,
    years: [2025, 2026], months: [9, 10], availableMonths: [9, 10], latestYear: 2026, previousYear: 2025,
    latestSourceDate: to, cutoffDate: to, sourceRowCount: rows, filteredRowCount: rows, rowCount: rows,
    period: args.p_period || 'ytd', comparison: args.p_comparison || 'ly', periodLabel: 'SYNTHETIC FIXTURE',
    brands: ['Fixture brand'], ownerships: ['Fixture ownership'], locations: ['Fixture location'],
    orderTypes: ['Fixture order'], channels: ['Fixture channel']};
  const metrics = {sessions: value, purchases: value, revenue: value, checks: value, markup: value,
    averageCheck: value, markupRate: value, addToCarts: value, checkouts: value, clicks: value, impressions: value};
  if (name === 'bi_dynamics_payload') return {
    meta,
    series: rows ? [{label:'Січ', '2025': value ?? 0, '2026': value ?? 0}] : [],
    summary: {latestYearTotal:value, previousYearTotal:value, growth:null}
  };
  if (name === 'bi_digital_history_payload') return {meta,
    quality: {ga4: {from: '2025-01-01', to}, searchConsole: {from: '2025-07-01', to}}, monthly: []};
  if (name === 'bi_digital_app_payload') return {sources: {store: {rows}, firebase: {rows}, orders: {rows}},
    overview: {downloads: value, firstOpens: value, orders: value},
    googleAdsApp: [{campaign_name: 'SYNTHETIC CAMPAIGN', currency: 'USD', spend: value, conversions: value}]};
  if (name === 'bi_digital_merchant_payload') return {meta: {performanceRows: rows, catalogRows: 0, healthRows: 0},
    performance: {impressions: value, clicks: value, conversions: value, products: value}};
  if (name === 'bi_digital_meta_ads_payload') return {meta: {...meta, contractVersion: 3, currency: 'USD', attributionVerified: false},
    summary: {spend: value, purchases: null, purchaseValue: null}};
  if (name === 'bi_digital_social_payload') return {facebook: {...meta, followers: value}, instagram: {rows: 0}};
  if (name === 'bi_digital_ads_payload') return {meta, summary: {cost: value, clicks: value, conversions: value, conversionValue: value}};
  return {meta, current: metrics, previous: metrics, seo: metrics, summary: metrics, totals: {current: value, previous: value}};
}

export function previewHarness({state = 'partial', reject = []} = {}) {
  const calls = [];
  const callBiRpc = async (name, args = {}) => {
    calls.push({name, args});
    if (reject.includes(name)) throw Error('SYNTHETIC RPC unavailable');
    return rpcFixture(name, args, state);
  };
  const stubs = {
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : ['2026-10-24T00:00:00Z'])); }
      static now() { return Date.parse('2026-10-24T00:00:00Z'); }
    },
    'next/cache': {unstable_cache: fn => fn},
    'next/link': {default: ({prefetch, children, ...props}) => React.createElement('a', props, children)},
    '@/lib/data/source': {callBiRpc, loadSalesData: () => {throw Error('Unexpected sales fallback');}},
    '@/components/SidebarBrand': {SidebarBrand: () => React.createElement('span', null, 'SYNTHETIC · no sync/session')},
    '@/components/OperatingTasks': {OperatingTasks: () => React.createElement('div', {'data-mock': 'tasks'}, 'Tasks interaction excluded')},
    '@/lib/operating-data': {loadOperatingData: async () => ({
      packet: {as_of: '2026-10-24T00:00:00Z', evidence: []}, quality: [], council: null, astra: null,
      runId: null, runMode: null, runStatus: null, runAsOf: null, runIssues: ['SYNTHETIC · no verified run'],
      analysis: {canCreate: false, counts: {PASS: 0, WARN: 0, BLOCK: 0}, manual: {reasons: ['Disabled fixture']}, taskReasons: ['No verified LIVE run']}
    })}
  };
  for (const name of ['MultiYearMetricChart', 'ChannelMixChart', 'RevenueChart', 'DeliveryVsAggregatorChart',
    'LocationsComparisonChart', 'ExplorerComparisonChart', 'PnlTrendChart', 'DigitalTrendChart', 'DigitalHistoryChart', 'DigitalAdsTrendChart']) {
    stubs[`@/components/${name}`] = {[name]: () => React.createElement('div', {'data-mock-chart': name}, 'Chart interaction excluded')};
  }
  const load = moduleLoader(stubs);
  return {calls, load, async render(route, params = {}) {
    const file = route === '/' ? 'app/page.tsx' : `app${route}/page.tsx`;
    const page = load(file).default;
    return renderToStaticMarkup(await page({searchParams: Promise.resolve(params)}));
  }};
}
