import test from 'node:test';
import assert from 'node:assert/strict';
import {coreWebVitalsLabel} from '../lib/digital-quality.ts';
import {normalizeLocal} from '../lib/data/digital-source-contract.ts';
import {previewHarness} from './support/bi-preview-harness.mjs';

test('CWV labels map only the three known categories; unknown and missing stay explicit', () => {
  for (const [category, label] of [
    ['GOOD', 'Добре'], ['NEEDS_IMPROVEMENT', 'Потребує покращення'], ['POOR', 'Погано'],
    ['UNKNOWN', 'Невідомо'], [null, 'Невідомо'], [undefined, 'Невідомо'], ['', 'Невідомо']
  ]) assert.equal(coreWebVitalsLabel(category), label);
});

const snapshot = {captured_on:'2026-10-23', mobile_score:85, mobile_lcp:2000, mobile_inp:150, mobile_cls:0.05};
const cases = [
  {name:'null snapshot', raw:null, category:null, score:'—', label:'Невідомо'},
  {name:'missing snapshot', raw:undefined, category:null, score:'—', label:'Невідомо'},
  ...['mobile_lcp', 'mobile_inp', 'mobile_cls'].map(field => ({
    name:`score with null ${field}`, raw:{...snapshot, [field]:null},
    category:'UNKNOWN', score:'85', label:'Невідомо'
  })),
  {name:'GOOD', raw:snapshot, category:'GOOD', score:'85', label:'Добре'},
  {name:'NEEDS_IMPROVEMENT', raw:{...snapshot, mobile_lcp:3000},
    category:'NEEDS_IMPROVEMENT', score:'85', label:'Потребує покращення'},
  {name:'POOR', raw:{...snapshot, mobile_lcp:4500}, category:'POOR', score:'85', label:'Погано'},
  {name:'measured zero', raw:{...snapshot, mobile_score:0, mobile_lcp:0, mobile_inp:0, mobile_cls:0},
    category:'GOOD', score:'0', label:'Добре'},
  {name:'null score with measured CWV', raw:{...snapshot, mobile_score:null},
    category:'GOOD', score:'—', label:'Добре'},
  {name:'zero score with unknown CWV', raw:{...snapshot, mobile_score:0, mobile_inp:null},
    category:'UNKNOWN', score:'0', label:'Невідомо'}
];

for (const item of cases) {
  test(`synthetic PageSpeed adapter + actual SSR: ${item.name}`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('No network in synthetic SSR regression'));
    const local = normalizeLocal({pageSpeed:item.raw});
    assert.equal(local.pageSpeed?.mobileCategory ?? null, item.category);
    if (item.raw) {
      assert.equal(local.pageSpeed.mobileScore, item.raw.mobile_score);
      assert.equal(local.pageSpeed.mobileInp, item.raw.mobile_inp);
    } else assert.equal(local.pageSpeed, null);
    const before = structuredClone(local);
    for (const route of ['/digital', '/digital/site']) {
      const h = previewHarness();
      t.mock.method(h.load('lib/data/digital-sources.ts'), 'loadDigitalLocalData', async () => local);
      const html = await h.render(route);
      if (route === '/digital/site' && !local.pageSpeed) {
        assert.doesNotMatch(html, /PageSpeed · Mobile|Mobile Core Web Vitals потребують уваги/);
        continue;
      }
      const title = route === '/digital' ? 'PageSpeed Mobile' : 'PageSpeed · Mobile';
      const card = html.match(new RegExp(`<article[^>]*><span>${title}</span>[\\s\\S]*?</article>`))?.[0];
      assert.ok(card, `${route}: missing card`);
      assert.ok(card.includes(`<strong>${item.score}</strong>`), card);
      assert.ok(card.includes(`<em>${item.label}</em>`), card);
      const needsAttention = ['NEEDS_IMPROVEMENT', 'POOR'].includes(item.category);
      if (route === '/digital') {
        assert.equal(html.includes('Mobile Core Web Vitals'), needsAttention);
        if (needsAttention) assert.match(html, /HIGH[\s\S]*Mobile Core Web Vitals/);
      } else assert.equal(html.includes('Mobile Core Web Vitals потребують уваги'), needsAttention);
      if (item.label === 'Невідомо') assert.doesNotMatch(card, /Потребує покращення/);
    }
    assert.deepEqual(local, before, 'Rendering must preserve nulls and measured zeroes');
  });
}
