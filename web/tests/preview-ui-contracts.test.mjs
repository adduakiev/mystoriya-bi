import test from 'node:test';
import assert from 'node:assert/strict';
import {previewHarness, moduleLoader, renderToStaticMarkup} from './support/bi-preview-harness.mjs';
import {routeAssertions} from '../../scripts/bi-audit-qa-contracts.mjs';
import {executionMatrix} from '../../scripts/bi-audit-browser-qa.mjs';
import {spawnSync} from 'node:child_process';

for (const [route, [heading, rpc]] of Object.entries(routeAssertions)) {
  test(`mock SSR ${route}: actual page and adapter render fixture states`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Synthetic UI suite cannot reach a network'));
    for (const state of rpc.length ? ['partial', 'empty', 'missing', 'zero'] : ['static']) {
      const h = previewHarness({state});
      const html = await h.render(route);
      assert.ok(html.includes(`<h1${route === '/login' ? ' style=' : ''}`), route);
      assert.ok(html.includes(heading), `${route} ${state} heading`);
      assert.doesNotMatch(html, /NaN|Infinity|\[object Object\]|undefined/);
      assert.deepEqual([...new Set(h.calls.map(call=>call.name))].sort(), [...rpc].sort(), route);
      if (route.startsWith('/digital')) assert.ok(html.includes('—') || html.includes('UNKNOWN'));
      if (route === '/operating') {
        assert.match(html, /Створення задач недоступне/);
        assert.match(html, /<button[^>]*disabled/);
        assert.match(html, /Підтверджений пакет KPI відсутній/);
      }
      if (route === '/login') {
        assert.match(html, /<input(?=[^>]*name="password")(?=[^>]*required="")[^>]*>/);
        assert.match(html, /<label for="password"/);
        assert.doesNotMatch(html, /data-mock-chart|SYNTHETIC CAMPAIGN/);
      }
    }
  });
}

const selected = {year: '2026', month: '9', brand: 'Fixture brand', ownership: 'Fixture ownership',
  channel: 'Fixture channel', location: 'Fixture location', orderType: 'Fixture order', lfl: '1',
  metric: 'checks', grain: 'week', compare: 'previous', period: 'week', dimension: 'channel', sort: 'name'};
for (const route of ['/', '/delivery', '/locations', '/dynamics', '/explorer', '/insights', '/aggregators']) {
  test(`mock selectors ${route}: query → actual loader RPC args; month, LFL and segments stay explicit`, async () => {
    const h = previewHarness();
    const html = await h.render(route, selected);
    const {args} = h.calls[0];
    assert.equal(args.p_lfl, true);
    if (route === '/aggregators') {
      assert.deepEqual(args, {p_period: 'week', p_comparison: 'previous', p_lfl: true});
      assert.match(html, /period=month&amp;compare=previous&amp;lfl=1/);
      return;
    }
    assert.equal(args.p_brand, selected.brand);
    assert.equal(args.p_ownership, selected.ownership);
    if (route !== '/dynamics') {
      assert.equal(args.p_focus_year, 2026);
      assert.equal(args.p_focus_month, 9);
      assert.match(html, /value="9" selected=""/);
    }
    if (!['/locations'].includes(route)) {
      assert.equal(args.p_order_type, selected.orderType);
      assert.equal(args.p_location, selected.location);
    }
    if (['/', '/delivery', '/dynamics', '/explorer'].includes(route)) assert.equal(args.p_metric, 'checks');
    if (['/', '/delivery'].includes(route)) assert.equal(args.p_grain, 'month', 'month overrides week');
    if (route === '/') assert.equal(args.p_period, 'month');
    if (route === '/dynamics') {
      assert.equal(args.p_grain, 'month', 'unsafe ISO-week RPC is fail-closed');
      assert.match(html, /Тижні \(тимчасово недоступні\)/);
      assert.match(html, /<option value="week" disabled="">/);
      assert.match(html, /aria-disabled="true"/);
      assert.doesNotMatch(html, /href="\/dynamics\?grain=week/);
      assert.equal(Object.hasOwn(args, 'p_focus_year'), false, 'Dynamics does not implement a focus-year filter');
    }
    if (route === '/explorer') {
      assert.equal(args.p_dimension, 'channel');
      assert.equal(args.p_sort, 'name');
    }
  });
}

test('Digital selected/current/prior windows reach GA4/GSC RPC; Ads and GBP stay independently labelled (D05 preview)', async () => {
  const h = previewHarness();
  const html = await h.render('/digital', {from: '2026-09-24', to: '2026-10-23', compare: 'previous'});
  assert.deepEqual(h.calls.filter(c=>c.name === 'bi_digital_payload').map(c=>c.args), [
    {p_from:'2026-09-24',p_to:'2026-10-23'}, {p_from:'2026-08-25',p_to:'2026-09-23'}]);
  for (const name of ['bi_digital_ads_payload','bi_digital_local_payload'])
    assert.deepEqual(h.calls.find(c=>c.name === name).args, {});
  assert.match(html, /name="from"[^>]*value="2026-09-24"/);
  assert.match(html, /name="to"[^>]*value="2026-10-23"/);
  for (const name of ["Google Ads", "Local / GBP"])
    assert.ok(html.includes(`${name} · період джерела: 2026-09-24 → 2026-10-23`));
  assert.match(html, /Обидві межі збігаються/);
  assert.match(html, /Повнота UNKNOWN · свіжість джерела UNKNOWN/);
});

test('App and Merchant rendered cards distinguish measured zero from field-level null with positive rows', async () => {
  for (const [route, label] of [['/digital/app','Downloads'], ['/digital/commerce','Impressions']]) {
    const zero = await previewHarness({state:'zero'}).render(route);
    const missing = await previewHarness({state:'missing'}).render(route);
    const empty = await previewHarness({state:'empty'}).render(route);
    assert.ok(zero.includes(`<span>${label}</span><strong>0</strong>`));
    for (const html of [missing,empty]) assert.ok(html.includes(`<span>${label}</span><strong>—</strong>`));
  }
  const ads = await previewHarness().render('/digital/ads');
  assert.match(ads, /Meta spend<\/span><strong>123<\/strong><small>USD<\/small>/);
  assert.match(ads, /Meta purchases<\/span><strong>—<\/strong>/);
  assert.match(ads, /Meta ROAS<\/span><strong>—<\/strong>/);
  assert.match(ads, /ROAS Ads<\/span><strong>—<\/strong>/);
  assert.match(ads, /currency UNKNOWN/);
});

test('isolated paid-source failure remains visible without erasing the surviving source', async () => {
  const html = await previewHarness({reject:['bi_digital_meta_ads_payload']}).render('/digital/ads');
  assert.match(html, /Meta Ads · джерело недоступне/);
  assert.match(html, /Кліки<\/span><strong>123<\/strong>/);
  assert.doesNotMatch(html, /Meta Ads · WAITING|Meta Ads · LIVE/);
});

test('fixed-time source freshness renders source dates, null counts and STALE separately from collection time', () => {
  const load = moduleLoader();
  const {normalizeSocial} = load('lib/data/meta-social-contract.ts');
  const {DigitalSourceEvidence} = load('components/DigitalSourceEvidence.tsx');
  const data = normalizeSocial({facebook: {from:'2026-09-19',to:'2026-10-18',rows:30,followers:0},instagram:{rows:0}}, '2026-10-24');
  const html = renderToStaticMarkup(DigitalSourceEvidence({name:'Facebook',evidence:data.facebook.evidence}));
  assert.match(html, /Facebook · STALE/);
  assert.match(html, /2026-10-18/);
  assert.match(html, /UNKNOWN/);
  assert.equal(data.instagram.evidence.status, 'WAITING');
  assert.equal(data.instagram.followers, null);
});

test('66-case plan is reproducible, covers 360/768/1440 and never upgrades SSR to viewport/authenticated PASS', () => {
  const matrix = executionMatrix();
  assert.equal(matrix.length, 66);
  assert.equal(new Set(matrix.map(c=>c.case_id)).size, 66);
  const site = matrix.find(c=>c.path === '/digital/site');
  assert.ok(site.authenticated.source_to_rpc_to_ui.rpc.includes('bi_digital_local_payload'));
  assert.ok(site.authenticated.source_to_rpc_to_ui.source_candidates.includes('digital_pagespeed_snapshot'));
  const operating = matrix.find(c=>c.path === '/operating');
  assert.deepEqual(operating.mock.rpc_calls_executed, []);
  assert.ok(operating.authenticated.source_to_rpc_to_ui.rpc.includes('bi_digital_payload'));
  assert.match(matrix.find(c=>c.path === '/pnl').authenticated.filters, /month numbers 1..8/);
  for (const route of Object.keys(routeAssertions))
    assert.deepEqual(matrix.filter(c=>c.path === route).map(c=>c.viewport.width).sort((a,b)=>a-b), [360,768,1440]);
  for (const row of matrix) {
    assert.equal(row.status, 'NOT_EXECUTED');
    assert.equal(row.authenticated.status, 'NOT_EXECUTED');
    assert.equal(row.mock.viewport_execution, 'NOT_EXECUTED');
    assert.ok(row.authenticated.source_to_rpc_to_ui.assertion);
  }
  for (const url of ['https://name:secret@preview.invalid','https://preview.invalid/?token=x','https://preview.invalid/path'])
    assert.throws(()=>executionMatrix(url));
  const result = spawnSync(process.execPath,['scripts/bi-audit-browser-qa.mjs','--check'], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
});

test('Delivery unscoped week URL is fail-closed before unsafe SQL RPC (P1 ISO-week)', async () => {
  const h = previewHarness();
  const html = await h.render('/delivery', {year:'2026', grain:'week'});
  const rpc = h.calls.find(c => c.name === 'bi_delivery_payload');
  assert.ok(rpc, 'delivery RPC must execute');
  assert.equal(rpc.args.p_grain, 'month', 'never request unsafe ISO-week aggregation');
  assert.match(html, /<option value="week" disabled="">/);
  assert.ok(html.includes('Тижні (тимчасово недоступні)'));
  assert.match(html, /aria-disabled="true"/);
  assert.doesNotMatch(html, /grain=week/);
});
