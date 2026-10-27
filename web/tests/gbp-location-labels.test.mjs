import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {labelGbpLocations} from '../lib/gbp-location-labels.ts';
import {normalizeLocal} from '../lib/data/digital-source-contract.ts';
import {formatMetric, metricSum} from '../lib/digital-quality.ts';
import {previewHarness} from './support/bi-preview-harness.mjs';

const four = ["М’ясторія", "М'ясторія", '  МʼЯСТОРІЯ  ', 'М‘ясторія'].map((locationTitle, i) => ({
  locationId: `accounts/synthetic/locations/100000${i}`, locationTitle,
}));
const cases = [
  {name:'four duplicate profiles with mixed apostrophes, whitespace and case', rows:four, distinct:4,
    labels:four.map((row, i) => `${row.locationTitle.trim()} · ID …00000${i}`)},
  {name:'genuine unique names', rows:[
    {locationId:'locations/1000001', locationTitle:'М’ясторія Поділ'},
    {locationId:'locations/1000002', locationTitle:'М’ясторія Центр'},
  ], distinct:2, labels:['М’ясторія Поділ', 'М’ясторія Центр']},
  {name:'colliding six-character suffixes', rows:[
    {locationId:'locations/111123456', locationTitle:'М’ясторія'},
    {locationId:'locations/222123456', locationTitle:'М’ясторія'},
  ], distinct:2, labels:['М’ясторія · ID locations/111123456', 'М’ясторія · ID locations/222123456']},
  {name:'same terminal ID under different account paths', rows:[
    {locationId:'accounts/a/locations/123456', locationTitle:'М’ясторія'},
    {locationId:'accounts/b/locations/123456', locationTitle:'М’ясторія'},
  ], distinct:2, labels:['М’ясторія · ID accounts/a/locations/123456', 'М’ясторія · ID accounts/b/locations/123456']},
  {name:'empty, null, absent and placeholder titles', rows:[
    {locationId:'locations/1000001', locationTitle:''},
    {locationId:'locations/1000002', locationTitle:null},
    {locationId:'locations/1000003'},
    {locationId:'locations/1000004', locationTitle:'—'},
  ], distinct:4, labels:[1,2,3,4].map(i => `Профіль GBP · ID …00000${i}`)},
  {name:'missing IDs never receive invented uniqueness', rows:[
    {locationTitle:'М’ясторія'}, {locationId:null, locationTitle:'М’ясторія'},
    {locationId:'', locationTitle:''}, {locationId:'   ', locationTitle:null},
  ], distinct:2, labels:['М’ясторія · ID відсутній', 'М’ясторія · ID відсутній',
    'Профіль GBP · ID відсутній', 'Профіль GBP · ID відсутній'], missing:true},
  {name:'repeated raw IDs remain explicitly ambiguous', rows:[
    {locationId:'locations/1000001', locationTitle:'М’ясторія'},
    {locationId:'locations/1000001', locationTitle:'М’ясторія'},
  ], distinct:1, labels:['М’ясторія · ID locations/1000001', 'М’ясторія · ID locations/1000001'], repeated:true},
  {name:'unique name collides with a generated short label', rows:[
    {locationId:'locations/1000001', locationTitle:'М’ясторія'},
    {locationId:'locations/1000002', locationTitle:'М’ясторія'},
    {locationId:'locations/1000003', locationTitle:'М’ясторія · ID …000001'},
  ], distinct:3, labels:['М’ясторія · ID locations/1000001', 'М’ясторія · ID …000002', 'М’ясторія · ID …000001']},
  {name:'irreducible generated label collision is disclosed', rows:[
    {locationId:'abc', locationTitle:'М’ясторія'},
    {locationId:'def', locationTitle:'М’ясторія'},
    {locationId:'ghi', locationTitle:'М’ясторія · ID abc'},
  ], distinct:2, labels:['М’ясторія · ID abc', 'М’ясторія · ID def', 'М’ясторія · ID abc'], ambiguous:true},
];

for (const item of cases) {
  test(`GBP deterministic labels: ${item.name}`, () => {
    const before = structuredClone(item.rows);
    const labeled = labelGbpLocations(item.rows);
    assert.deepEqual(labeled.map(row => row.locationLabel), item.labels);
    assert.equal(new Set(labeled.map(row => row.locationLabel)).size, item.distinct);
    assert.deepEqual(labelGbpLocations([...item.rows].reverse()), [...labeled].reverse(), 'Independent of input/ranking order');
    assert.deepEqual(item.rows, before);
    labeled.forEach((row, i) => {
      assert.equal(row.locationId, item.rows[i].locationId, 'Raw key must remain unchanged');
      assert.equal(row.locationTitle, item.rows[i].locationTitle);
      if (item.missing) assert.match(row.locationIdentityNote, /ID відсутній; ідентичність не підтверджена/);
      else assert.ok(row.locationIdentityNote.includes(item.rows[i].locationId));
      if (item.repeated) assert.match(row.locationIdentityNote, /ID повторюється; ідентичність неоднозначна/);
    });
    if (item.ambiguous) {
      assert.match(labeled[0].locationIdentityNote, /підпис неоднозначний/);
      assert.match(labeled[2].locationIdentityNote, /підпис неоднозначний/);
    }
  });

  test(`GBP actual page SSR, synthetic RPC: ${item.name}`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('No network permitted in synthetic SSR'));
    const data = normalizeLocal({
      meta:{from:'2026-09-24', to:'2026-10-23', rows:120, days:30, locationCount:item.rows.length, coverage:'PARTIAL'},
      summary:{impressions:1000, clicks:0, calls:0, websiteClicks:null, directions:8, menuClicks:2},
      locations:item.rows.map((row, i) => ({location_id:row.locationId, location_title:row.locationTitle,
        impressions:100, clicks:0, calls:i === 0 ? null : 0, directions:10 + i, website_clicks:0, menu_clicks:0})),
    });
    const before = structuredClone(data);
    const h = previewHarness();
    t.mock.method(h.load('lib/data/digital-sources.ts'), 'loadDigitalLocalData', async () => data);
    const html = await h.render('/digital/local');
    const labels = labelGbpLocations(data.locations);
    const table = html.slice(html.indexOf('Локальний попит по профілях'));
    const ranked = labels.map(row => ({...row, intentActions:metricSum(row.calls,row.directions,row.websiteClicks,row.menuClicks)}))
      .sort((a,b)=>(b.intentActions??-Infinity)-(a.intentActions??-Infinity));
    // Labels and complete identity notes are text nodes, available to assistive tech.
    const escaped = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
    let previous = -1;
    for (const row of ranked) {
      const label = `<b>${escaped(row.locationLabel)}</b><small class="table-note">${escaped(row.locationIdentityNote)}</small>`;
      const index = table.indexOf(label, previous + 1);
      assert.ok(index > previous, `Rendered label and full identity in original KPI ranking: ${label}`);
      previous = index;
    }
    const top = ranked[0];
    assert.ok(html.includes(`aria-label="${escaped(`${formatMetric(top.intentActions)} · ${top.locationLabel} · ${top.locationIdentityNote}`)}"`));
    assert.ok(html.includes(`>${formatMetric(top.intentActions)} · ${escaped(top.locationLabel)}</span>`));
    assert.match(table, /<span>—<\/span>/, 'Unknown calls/actions remain unknown');
    assert.match(table, /<span>0<\/span>/, 'Measured zero survives');
    assert.match(html, /2026-09-24 — 2026-10-23/);
    assert.match(html, /Фактична кількість рядків та пропуски по точках невідомі/);
    assert.doesNotMatch(html, /NaN|undefined|вул\./);
    assert.deepEqual(data, before, 'Every raw ID, KPI, null, zero and freshness field is unchanged');
  });
}

test('empty profile list is safe and renders no invented top location', async () => {
  assert.deepEqual(labelGbpLocations([]), []);
  const h = previewHarness();
  h.load('lib/data/digital-sources.ts').loadDigitalLocalData = async () => normalizeLocal({});
  const html = await h.render('/digital/local');
  assert.doesNotMatch(html, /Найбільше локальних дій|Локальний попит по профілях|NaN|undefined/);
});

test('profile keys remain the upstream raw ID', () => {
  const page = readFileSync(new URL('../app/digital/local/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /key=\{row\.locationId\}/);
});

test('GBP ownership and brand exclusions remain UNKNOWN; profile count is data-driven', async () => {
  for (const count of [2, 4]) {
    const h = previewHarness();
    const rows = Array.from({length:count}, (_, i) => ({
      location_id:`locations/synthetic-${i}`, location_title:'М’ясторія',
      impressions:100, calls:0, directions:0, website_clicks:null, menu_clicks:null,
    }));
    h.load('lib/data/digital-sources.ts').loadDigitalLocalData = async () => normalizeLocal({
      meta:{from:'2026-10-12',to:'2026-10-26',rows:15*count,days:15,locationCount:count,coverage:'UNKNOWN'},
      summary:{impressions:100*count,clicks:null,calls:0,directions:0,websiteClicks:null,menuClicks:null},
      locations:rows,
    });
    const html = await h.render('/digital/local');
    assert.ok(html.includes(`Google Business Profile · ${count} GBP-профілів`));
    assert.match(html, /Прив’язка GBP ID до фізичних адрес/);
    assert.match(html, /виключення франшиз та інших брендів не доведене/);
    assert.doesNotMatch(html, /4 власні точки|власні точки|Франшизи, MARMOO та Meat Bar сюди не змішуємо/);
  }
});

test('GBP empty state does not invent ownership', async () => {
  const h = previewHarness();
  h.load('lib/data/digital-sources.ts').loadDigitalLocalData = async () => normalizeLocal({
    meta:{from:'',to:'',rows:0,days:0,locationCount:0,coverage:'UNKNOWN'},
    summary:{impressions:null,clicks:null,calls:null,directions:null,websiteClicks:null,menuClicks:null},
    locations:[],
  });
  const html = await h.render('/digital/local');
  assert.match(html, /Належність профілів до власних закладів не підтверджена/);
  assert.doesNotMatch(html, /4 власні точки|Франшизи, MARMOO та Meat Bar сюди не змішуємо/);
});
