import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as crypto from 'node:crypto';
import {moduleLoader, previewHarness, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const load = (overrides = {}) => moduleLoader({
  'server-only': {},
  'node:crypto': crypto,
  './report.module.css': {default:Object.fromEntries(['report','navigation','kpis','value','scroll'].map(name => [name, name]))},
  'next/link': {default: ({prefetch, children, ...props}) => React.createElement('a', props, children)},
  '@/components/SidebarBrand': {SidebarBrand: () => React.createElement('span', null, 'TEST ONLY · no session/sync')},
  ...overrides
});

const {GLOVO_HEADERS, GLOVO_DEFAULT_MONTHS, normalizeGlovoSheet, buildGlovoReport} = load()('lib/data/glovo-contract.ts');
// Offline synthetic cells only. All presenter inputs go through the real contract.
const syntheticRow = (changes = {}) => Object.assign(['2026-01', 'SYNTHETIC new brand', 'SYNTHETIC location',
  'SYNTHETIC source name', 'SYNTHETIC address', 2, 10, 42, 1], changes);
const reportFrom = (rows, verified = [], months = GLOVO_DEFAULT_MONTHS) =>
  buildGlovoReport(normalizeGlovoSheet([GLOVO_HEADERS, ...rows]), verified, months);
const renderReport = report => {
  assert.ok(report, 'invalid contracts must not reach the presenter');
  const {GlovoReportPresenter} = load()('app/aggregators/glovo/GlovoReportPresenter.tsx');
  return renderToStaticMarkup(React.createElement(GlovoReportPresenter, {report}));
};
const bodies = html => [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].map(match => match[1]);
const kpiValues = html => [...html.matchAll(/<strong class="value">(.*?)<\/strong>/g)].map(match => match[1]);

test('actual SSR presenter renders builder totals, ratio of sums, every month and dynamic raw brand/location lineage', () => {
  const rows = GLOVO_DEFAULT_MONTHS.flatMap(month => [
    syntheticRow({0:month, 1:'Мʼясторія Meat Bar'}),
    syntheticRow({0:month, 5:8, 6:30, 7:43})
  ]);
  const report = reportFrom([...rows, syntheticRow({0:'2026-11', 1:'SYNTHETIC NOVEMBER EXCLUDED', 5:987654, 6:987654})], GLOVO_DEFAULT_MONTHS);
  const html = renderReport(report);
  assert.deepEqual(kpiValues(html), ['400', '100', '4', '— · недоступно']);
  assert.match(html, /KPI · COMPLETE/);
  const [trend, , , , detail] = bodies(html);
  assert.equal((trend.match(/<tr>/g) ?? []).length, 10);
  for (const month of GLOVO_DEFAULT_MONTHS) {
    assert.ok(trend.includes(`<th scope="row">${month}</th><td>10</td><td>40</td><td>4</td><td>COMPLETE</td>`));
  }
  assert.equal((detail.match(/<tr>/g) ?? []).length, 20);
  assert.match(detail, /Мʼясторія Meat Bar<\/a><\/td><td>МітБар/);
  assert.match(detail, /SYNTHETIC new brand<\/a><\/td><td>UNKNOWN \/ needs mapping/);
  assert.match(detail, /SYNTHETIC location<\/td><td>SYNTHETIC source name<\/td><td>SYNTHETIC address/);
  assert.match(detail, /<td>42<\/td>/);
  assert.match(detail, /<td>43<\/td>/);
  assert.equal((detail.match(/<td>UNKNOWN<\/td><td>UNKNOWN<\/td>/g) ?? []).length, 20);
  assert.doesNotMatch(html, /2026-11|NOVEMBER EXCLUDED|987654|₴|NaN|Infinity|undefined|\bLIVE\b/);
  assert.match(html, /Валюта UAH: підтвердження власника/);
  assert.match(html, /Order Created Local Month/);
  assert.equal((html.match(/role="region"[^>]*tabindex="0"/g) ?? []).length, 5);
  assert.equal((html.match(/<caption>/g) ?? []).length, 5);
  assert.match(html, /scope="col"/);
  assert.match(html, /scope="row"/);
});

test('actual presenter keeps every approved alias and raw label, including escaped unknown source names', () => {
  const aliases = ['Meatbar Івано-Франківська', 'Мʼясторія Meat Bar', "Meatbar М'ясторія", "Мітбар М'ясторія", "Meatbar М'ясторія / Мітбар М'ясторія"];
  const report = reportFrom([...aliases.map(brand => syntheticRow({1:brand})),
    syntheticRow({1:'SYNTHETIC <unknown>', 3:'<script>synthetic only</script>'})], ['2026-01'], ['2026-01']);
  const detail = bodies(renderReport(report)).at(-1);
  assert.equal((detail.match(/<td>МітБар<\/td>/g) ?? []).length, aliases.length);
  for (const brand of aliases) assert.ok(detail.includes(brand.replaceAll("'", '&#x27;')));
  assert.match(detail, /SYNTHETIC &lt;unknown&gt;<\/a><\/td><td>UNKNOWN \/ needs mapping/);
  assert.match(detail, /&lt;script&gt;synthetic only&lt;\/script&gt;/);
  assert.doesNotMatch(detail, /<script>/);
});

test('actual presenter preserves missing measures, measured zero and undefined average ticket under PARTIAL coverage', () => {
  const report = reportFrom([
    syntheticRow({5:0, 6:0, 8:0}),
    syntheticRow({1:'SYNTHETIC missing', 5:null, 6:null, 8:1})
  ], ['2026-01'], ['2026-01']);
  const html = renderReport(report);
  assert.deepEqual(kpiValues(html), Array(4).fill('— · недоступно'));
  assert.match(html, /KPI · PARTIAL/);
  assert.doesNotMatch(html, /KPI · COMPLETE/);
  const [trend, , , , detail] = bodies(html);
  assert.match(trend, /<td>— · недоступно<\/td><td>— · недоступно<\/td><td>— · недоступно<\/td><td>PARTIAL/);
  assert.match(detail, /<td>0<\/td><td>0<\/td>/);
  assert.match(detail, /<td>— · недоступно<\/td><td>— · недоступно<\/td>/);
  const zero = renderReport(reportFrom([syntheticRow({5:0, 6:0, 8:0})], ['2026-01'], ['2026-01']));
  assert.deepEqual(kpiValues(zero), ['0', '0', '— · недоступно', '— · недоступно']);
  assert.match(zero, /KPI · COMPLETE/);
  for (const changes of [{5:null}, {6:null}, {5:'2'}, {6:'10'}]) {
    const incomplete = renderReport(reportFrom([syntheticRow(changes)], ['2026-01'], ['2026-01']));
    assert.match(incomplete, /KPI · PARTIAL/);
    assert.doesNotMatch(incomplete, /KPI · COMPLETE/);
    assert.equal(kpiValues(incomplete)[2], '— · недоступно');
  }
});

test('coverage controls remain visible: unchecked, missing months and empty data cannot become complete or zero filled', () => {
  const rows = GLOVO_DEFAULT_MONTHS.map(month => syntheticRow({0:month}));
  const unchecked = renderReport(reportFrom(rows));
  assert.match(unchecked, /KPI · PARTIAL/);
  assert.match(unchecked, /Це не повний підсумок/);
  assert.equal((bodies(unchecked)[0].match(/<td>PARTIAL<\/td>/g) ?? []).length, 10);
  assert.doesNotMatch(unchecked, /KPI · COMPLETE/);
  const gap = renderReport(reportFrom([syntheticRow()], GLOVO_DEFAULT_MONTHS));
  assert.match(gap, /KPI · PARTIAL/);
  assert.match(bodies(gap)[0], /2026-02<\/th><td>— · недоступно<\/td><td>— · недоступно<\/td><td>— · недоступно<\/td><td>PARTIAL/);
  const empty = renderReport(reportFrom([], GLOVO_DEFAULT_MONTHS));
  assert.deepEqual(kpiValues(empty), Array(4).fill('— · недоступно'));
  assert.doesNotMatch(empty, /KPI · COMPLETE|<td>0<\/td>/);
  assert.match(empty, /немає рядків у вибраному періоді/);
});

test('actual page conditionally presents only a non-null builder report supplied at its test-only adapter boundary', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('offline SSR must make zero transport calls'));
  const report = reportFrom([syntheticRow()], ['2026-01'], ['2026-01']);
  const page = load({'@/lib/data/glovo-source': {loadGlovoSource: async () => ({
    status:'OFFLINE SYNTHETIC PREVIEW', reason:'TEST ONLY · no source connection', report
  })}})('app/aggregators/glovo/page.tsx').default;
  const html = renderToStaticMarkup(await page());
  assert.deepEqual(kpiValues(html), ['10', '2', '5', '— · недоступно']);
  assert.match(html, /SYNTHETIC new brand/);
  assert.doesNotMatch(html, /Структура звіту · без даних джерела/);
  for (const contract of [normalizeGlovoSheet([['bad header']]), normalizeGlovoSheet([GLOVO_HEADERS, syntheticRow(), syntheticRow()])]) {
    assert.equal(buildGlovoReport(contract), null);
  }
});

test('actual Glovo server boundary and SSR fail closed without credentials, network, fixtures or zero KPIs', async t => {
  const previous = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON;
  t.after(() => previous === undefined ? delete process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON : process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON = previous);
  delete process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON;
  t.mock.method(globalThis, 'fetch', () => assert.fail('Glovo unavailable must make no remote call'));
  const modules = load();
  const state = await modules('lib/data/glovo-source.ts').loadGlovoSource();
  assert.deepEqual(state, {status:'SOURCE UNAVAILABLE', reason:state.reason, latestEventMonth:null, lastReadAt:null, report:null, confirmations:[], parity:null});
  const page = modules('app/aggregators/glovo/page.tsx').default;
  const html = renderToStaticMarkup(await page());
  assert.match(html, /<h1>Glovo · Аналітика брендів<\/h1>/);
  assert.match(html, /role="status"/);
  assert.match(html, /SOURCE UNAVAILABLE/);
  assert.match(html, /січень–жовтень 2026/);
  assert.match(html, /Листопад поза типовим періодом/);
  assert.match(html, /UNKNOWN \/ needs mapping/);
  assert.match(html, /Order Created Local Month/);
  assert.equal((html.match(/<strong class="value">—<\/strong>/g) ?? []).length, 4);
  assert.equal((html.match(/role="region"[^>]*tabindex="0"/g) ?? []).length, 2);
  assert.equal((html.match(/<caption>/g) ?? []).length, 2);
  assert.match(html, /href="\/aggregators"/);
  assert.match(html, /href="\/aggregators\/glovo"[^>]*aria-current="page"/);
  assert.doesNotMatch(html, /NaN|Infinity|undefined|₴|<strong[^>]*>0|<form|<button|<iframe|gviz|LIVE/);
  assert.doesNotMatch(html, /SYNTHETIC|Покриття:|KPI · COMPLETE|KPI · PARTIAL|<td>\d/);
  const boundary = fs.readFileSync(new URL('../lib/data/glovo-source.ts', import.meta.url), 'utf8');
  assert.match(boundary, /^import "server-only";/);
  assert.match(boundary, /process\.env\.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON/);
  assert.match(boundary, /glovo-private-runtime/);
  assert.doesNotMatch(boundary, /callBiRpc\(|loadSalesData\(|https:\/\//);
});

test('child navigation is discoverable, accessible when collapsed and does not propagate unsupported LFL', async () => {
  const Sidebar = load()('components/DashboardSidebar.tsx').DashboardSidebar;
  for (const activeHref of ['/aggregators', '/aggregators/glovo', '/']) {
    const html = renderToStaticMarkup(Sidebar({activeHref, lfl:true, statusTitle:'TEST', statusDetail:'TEST'}));
    const links = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g);
    const child = links.find(link => link.includes('href="/aggregators/glovo"'));
    assert.ok(child);
    assert.match(child, /aria-label="Агрегатори → Glovo · Аналітика брендів"/);
    assert.equal(child.includes('aria-current="page"'), activeHref === '/aggregators/glovo');
    assert.match(html, /href="\/aggregators\?lfl=1"/);
  }
  const h = previewHarness();
  const html = await h.render('/aggregators', {period:'week', compare:'previous', lfl:'1'});
  assert.match(html, /<nav aria-label="Звіти агрегаторів"[^>]*><a[^>]*href="\/aggregators\/glovo"/);
  assert.deepEqual(h.calls.map(c => c.name), ['bi_aggregators_payload_v2']);
  assert.deepEqual(h.calls[0].args, {p_period:'week',p_comparison:'previous',p_lfl:true});
  assert.match(html, /Aggregator Control Center/);
});

test('new route uses existing authentication boundary; no new public exception', async t => {
  const previous = process.env.BI_ACCESS_PASSWORD;
  t.after(() => previous === undefined ? delete process.env.BI_ACCESS_PASSWORD : process.env.BI_ACCESS_PASSWORD = previous);
  const {middleware, config} = moduleLoader()('middleware.ts');
  const {NextRequest} = await import('next/server.js');
  for (const password of [undefined, 'synthetic-test-password']) {
    if (password === undefined) delete process.env.BI_ACCESS_PASSWORD;
    else process.env.BI_ACCESS_PASSWORD = password;
    const response = await middleware(new NextRequest('https://preview.invalid/aggregators/glovo'));
    assert.equal(response.status, 307);
    const redirect = new URL(response.headers.get('location'));
    assert.equal(redirect.pathname, '/login');
    if (password) assert.equal(redirect.searchParams.get('next'), '/aggregators/glovo');
  }
  assert.ok(config.matcher.length > 0);
});

test('report tables retain local horizontal scrolling, keyboard focus and mobile navigation (static contracts)', () => {
  const css = fs.readFileSync(new URL('../app/aggregators/glovo/report.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.scroll\s*\{[^}]*max-width: 100%;[^}]*overflow-x: auto;/);
  assert.match(css, /\.scroll table\s*\{[^}]*min-width: 720px;/);
  assert.match(css, /\.scroll:focus-visible/);
  assert.match(css, /@media \(max-width: 720px\)[^\n]*grid-template-columns: minmax\(0, 1fr\)/);
});


test('actual GET filters update KPI/trend/detail together and expose exact drilldown lineage', async () => {
  const report = reportFrom([
    syntheticRow({1:'Meatbar Івано-Франківська', 5:3, 6:30}),
    syntheticRow({1:'SYNTHETIC other', 5:8, 6:80}),
    syntheticRow({0:'2026-02', 1:'Meatbar Івано-Франківська', 5:9, 6:90})
  ]);
  const page = load({'@/lib/data/glovo-source': {loadGlovoSource: async () => ({
    status:'OFFLINE SYNTHETIC PREVIEW', reason:'TEST ONLY', report
  })}})('app/aggregators/glovo/page.tsx').default;
  const html = renderToStaticMarkup(await page({searchParams:Promise.resolve({
    month:'2026-01', group:'МітБар', location:'SYNTHETIC location', sort:'amount-desc'
  })}));
  assert.deepEqual(kpiValues(html), ['30','3','10','— · недоступно']);
  assert.match(html, /<form[^>]*action="\/aggregators\/glovo"[^>]*method="get"/);
  for (const name of ['month','brand','group','location','mapping','sort']) assert.ok(html.includes(`name="${name}"`));
  const [trend, , , , detail] = bodies(html);
  assert.equal((trend.match(/<tr>/g) ?? []).length, 1);
  assert.equal((detail.match(/<tr>/g) ?? []).length, 1);
  assert.match(detail, /brand=Meatbar/);
  assert.match(detail, /<details><summary>Походження та мапінг<\/summary>/);
  assert.match(detail, /Ключ агрегату/);
  assert.match(detail, /UNKNOWN/);
  assert.match(html, /KPI · PARTIAL/);
  const noMatch = renderToStaticMarkup(await page({searchParams:Promise.resolve({brand:'not-present'})}));
  assert.deepEqual(kpiValues(noMatch), Array(4).fill('— · недоступно'));
  assert.match(noMatch, /немає рядків у вибраному періоді/);
});


test('page defaults to Jan–Oct while November and all months require explicit selection', async () => {
  const report = reportFrom([syntheticRow({6:10}), syntheticRow({0:'2026-11', 5:4, 6:40})], [], [...GLOVO_DEFAULT_MONTHS, '2026-11']);
  const page = load({'@/lib/data/glovo-source': {loadGlovoSource: async () => ({
    status:'CONNECTED', reason:'TEST ONLY', latestEventMonth:'2026-11', lastReadAt:'2026-11-12T00:00:00Z', report
  })}})('app/aggregators/glovo/page.tsx').default;
  const render = async params => renderToStaticMarkup(await page({searchParams:Promise.resolve(params)}));
  const historical = await render({});
  assert.deepEqual(kpiValues(historical), ['10','2','5','— · недоступно']);
  assert.equal((bodies(historical)[0].match(/<tr>/g) ?? []).length, 10);
  assert.doesNotMatch(bodies(historical).at(-1), /2026-11/);
  assert.match(historical, /Січень–жовтень 2026/);
  const november = await render({month:'2026-11'});
  assert.deepEqual(kpiValues(november), ['40','4','10','— · недоступно']);
  assert.equal((bodies(november)[0].match(/<tr>/g) ?? []).length, 1);
  const all = await render({month:'all'});
  assert.deepEqual(kpiValues(all), ['50','6','8,33','— · недоступно']);
  assert.equal((bodies(all)[0].match(/<tr>/g) ?? []).length, 11);
  assert.match(all, /KPI · PARTIAL/);
});
