import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moduleLoader, previewHarness, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const load = () => moduleLoader({
  'server-only': {},
  './report.module.css': {default:Object.fromEntries(['report','navigation','kpis','value','scroll'].map(name => [name, name]))},
  'next/link': {default: ({prefetch, children, ...props}) => React.createElement('a', props, children)},
  '@/components/SidebarBrand': {SidebarBrand: () => React.createElement('span', null, 'TEST ONLY · no session/sync')}
});

test('actual Glovo server boundary and SSR fail closed without network, fixtures or zero KPIs', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Glovo unavailable must make no remote call'));
  const modules = load();
  const state = await modules('lib/data/glovo-source.ts').loadGlovoSource();
  assert.deepEqual(state, {status:'SOURCE UNAVAILABLE', reason:state.reason, latestEventMonth:null, lastReadAt:null, report:null});
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
  const boundary = fs.readFileSync(new URL('../lib/data/glovo-source.ts', import.meta.url), 'utf8');
  assert.match(boundary, /^import "server-only";/);
  assert.doesNotMatch(boundary, /process\.env|fetch\(|callBiRpc\(|loadSalesData\(|https:\/\//);
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
