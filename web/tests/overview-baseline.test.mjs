import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader, rpcFixture, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const metrics = {revenue:100, checks:10, averageCheck:10, markup:20, markupRate:20};
const zero = Object.fromEntries(Object.keys(metrics).map(key => [key, 0]));
const noBaseline = 'Немає зіставної бази для обороту';

function harness(current, previous, {fallbackRows} = {}) {
  const calls = [];
  const payloads = [];
  const load = moduleLoader({
    'next/cache': {unstable_cache: fn => fn},
    'next/link': {default: ({prefetch, children, ...props}) => React.createElement('a', props, children)},
    '@/components/DashboardSidebar': {DashboardSidebar: () => null},
    '@/components/MultiYearMetricChart': {MultiYearMetricChart: () => null},
    '@/components/ChannelMixChart': {ChannelMixChart: () => null},
    '@/lib/data/source': {
      callBiRpc: async (name, args) => {
        calls.push({name, args});
        if (fallbackRows) throw Error('SYNTHETIC SQL failure');
        const payload = rpcFixture(name, args);
        Object.assign(payload.meta, {locations:['Черкаси'], years:[2024,2025],
          selectedYear:args.p_focus_year ?? 2025, currentYear:args.p_focus_year ?? 2025,
          previousYear:2024, comparisonLabel:'2024', latestSourceDate:'2025-10-22',
          cutoffDate:args.p_focus_month === 9 ? '2025-09-22' : '2025-10-22', sourceRowCount:139, filteredRowCount:139});
        payload.current = current;
        payload.previous = previous;
        payloads.push({payload, before:structuredClone(payload)});
        return payload;
      },
      loadSalesData: async () => {
        assert.ok(fallbackRows, 'Unexpected legacy fallback');
        return fallbackRows;
      }
    }
  });
  return {load, calls, payloads, signal:load('lib/data/overview.ts').buildOverviewSignal,
    async render(params = {year:'2025', location:'Черкаси'}) {
      return renderToStaticMarkup(await load('app/page.tsx').default({searchParams:Promise.resolve(params)}));
    }};
}

const scenarios = [
  {name:'0/0', current:zero, previous:zero, title:noBaseline},
  {name:'positive/0 (reported Cherkasy shape)',
    current:{...metrics, revenue:1446111.70, checks:3724, averageCheck:1446111.70/3724}, previous:zero, title:noBaseline},
  {name:'missing previous object', current:metrics, previous:undefined, title:noBaseline},
  {name:'missing previous fields', current:metrics, previous:{}, title:noBaseline},
  {name:'null previous fields', current:metrics, previous:{revenue:null, checks:null, averageCheck:null}, title:noBaseline},
  {name:'valid positive', current:{...metrics,revenue:120,checks:12,averageCheck:12}, previous:metrics,
    title:'Позитивна динаміка', changes:['+20.0%','+20.0%','+20.0%']},
  {name:'valid negative', current:{...metrics,revenue:80,checks:8,averageCheck:8}, previous:metrics,
    title:'Період нижче бази порівняння', changes:['-20.0%','-20.0%','-20.0%']},
  {name:'unchanged measured values', current:metrics, previous:metrics,
    title:'Без змін обороту', changes:['+0.0%','+0.0%','+0.0%']},
  {name:'measured current zero with positive row evidence', current:zero, previous:metrics,
    title:'Період нижче бази порівняння', changes:['-100.0%','-100.0%','-100.0%']},
  {name:'field-level zero/missing baselines', current:{...metrics,revenue:120}, previous:{...metrics,checks:0,averageCheck:null},
    title:'Позитивна динаміка', changes:['+20.0%','немає зіставної бази','немає зіставної бази']},
  {name:'missing current object', current:undefined, previous:metrics,
    title:'Недостатньо даних для порівняння обороту', changes:['дані відсутні','дані відсутні','дані відсутні']},
  {name:'numeric string comparisons', current:{...metrics,revenue:'120',checks:'12',averageCheck:'12'}, previous:metrics,
    title:'Позитивна динаміка', changes:['+20.0%','+20.0%','+20.0%']}
];

function assertSignal(signal, scenario) {
  assert.equal(signal.severity, 'info');
  assert.equal(signal.title, scenario.title);
  const changes = scenario.changes ?? Array(3).fill('немає зіставної бази');
  assert.equal(signal.body, `Оборот: ${changes[0]}. Чеки: ${changes[1]}. Середній чек: ${changes[2]} vs 2024.`);
  assert.doesNotMatch(signal.body, /NaN|Infinity|undefined/);
  if (!scenario.changes) assert.doesNotMatch(signal.body, /[+-]?\d+(?:\.\d+)?%/);
}

for (const scenario of scenarios) {
  test(`Overview signal unit: ${scenario.name}`, () => {
    const h = harness();
    const before = structuredClone([scenario.current, scenario.previous]);
    assertSignal(h.signal(scenario.current, scenario.previous, '2024'), scenario);
    assert.deepEqual([scenario.current, scenario.previous], before);
  });

  test(`synthetic actual Overview adapter + SSR: ${scenario.name}`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Synthetic test cannot reach network'));
    const h = harness(scenario.current, scenario.previous);
    const html = await h.render();
    assert.deepEqual(h.calls, [{name:'bi_overview_payload',args:{
      p_channel:null, p_order_type:null, p_location:'Черкаси', p_brand:null, p_ownership:null,
      p_focus_year:2025, p_focus_month:null, p_period:'ytd', p_comparison:'ly',
      p_metric:'revenue', p_grain:'month', p_lfl:false
    }}]);
    assert.match(html, /value="2025" selected=""/);
    assert.match(html, /value="Черкаси" selected=""/);
    const signal = html.match(/<div class="signal">[\s\S]*?<\/div>/)?.[0];
    assert.ok(signal, 'actual signal block must render');
    const changes = scenario.changes ?? Array(3).fill('немає зіставної бази');
    assert.ok(signal.includes(`<b>${scenario.title}</b>`), signal);
    assert.ok(signal.includes(`<p>Оборот: ${changes[0]}. Чеки: ${changes[1]}. Середній чек: ${changes[2]} vs 2024.</p>`), signal);
    assert.doesNotMatch(html, /NaN|Infinity|undefined/);
    for (const {payload,before} of h.payloads) assert.deepEqual(payload, before);
  });
}

test('signal rejects invalid baseline fields and does not invent a markup warning', () => {
  const {signal} = harness();
  for (const invalid of [null,undefined,'',' ',false,'bad',NaN,Infinity]) {
    assertSignal(signal(metrics,{revenue:invalid,checks:invalid,averageCheck:invalid},'2024'),{title:noBaseline});
    const result = signal({...metrics,revenue:120,markupRate:10}, {...metrics,markupRate:invalid}, '2024');
    assert.equal(result.severity,'info');
    assert.equal(result.title,'Позитивна динаміка');
  }
  const warning = signal({...metrics,revenue:120,markupRate:19}, metrics, '2024');
  assert.equal(warning.severity,'warning');
  assert.equal(warning.title,'Оборот росте швидше за націнку %');
  assert.match(warning.body,/\+20.0% vs 2024.*-1.0 п.п./);
});

test('selected year/location and month/comparison reach RPC without altering the baseline contract', async () => {
  const h = harness(metrics,zero);
  const html = await h.render({year:'2025',location:'Черкаси',month:'9',compare:'previous',period:'week',grain:'week'});
  assert.equal(h.calls[0].args.p_focus_year,2025);
  assert.equal(h.calls[0].args.p_location,'Черкаси');
  assert.equal(h.calls[0].args.p_focus_month,9);
  assert.equal(h.calls[0].args.p_period,'month');
  assert.equal(h.calls[0].args.p_grain,'month');
  assert.equal(h.calls[0].args.p_comparison,'previous');
  assert.ok(html.includes(`<b>${noBaseline}</b>`));
  assert.match(html, /BUSINESS PERFORMANCE · LIVE/);
  assert.match(html, />LIVE SIGNAL</);
  assert.doesNotMatch(html, /FALLBACK \/ UNVERIFIED/);
});

test('legacy Overview fallback uses the same signal; measured zero rows keep valid -100% comparisons', async t => {
  t.mock.method(globalThis,'fetch',()=>assert.fail('Synthetic fallback cannot reach network'));
  t.mock.method(console,'error',()=>{});
  const row = {date:'2025-01-01',location:'Черкаси',brand:'fixture',ownership:'fixture',
    channelGroup:'Заклад',orderType:'fixture',revenue:100,checks:10,markup:20};
  for (const [rows,title,body] of [
    [[row],noBaseline,/Оборот: немає зіставної бази/],
    [[{...row,revenue:0,checks:0,markup:0},{...row,date:'2024-01-01'}],
      'Період нижче бази порівняння',/Оборот: -100.0%/]
  ]) {
    const h = harness(undefined,undefined,{fallbackRows:rows});
    const html = await h.render();
    assert.ok(html.includes(`<b>${title}</b>`));
    assert.match(html,body);
    assert.match(html, /BUSINESS PERFORMANCE · FALLBACK \/ UNVERIFIED/);
    assert.match(html, /SQL RPC недоступний або повернув помилку/);
    assert.match(html, /FALLBACK SIGNAL · UNVERIFIED/);
    assert.doesNotMatch(html, /BUSINESS PERFORMANCE · LIVE|>LIVE SIGNAL</);
  }
});

test('Overview weekly ISO-year P1 fails closed at SSR/RPC boundary', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Synthetic weekly guard cannot reach network'));
  const h = harness(metrics, zero);
  const html = await h.render({year:'2025', location:'Черкаси', grain:'week'});
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].name, 'bi_overview_payload');
  assert.equal(h.calls[0].args.p_grain, 'month', 'Never request incorrect installed SQL weekly grouping');
  assert.match(html, /Тижні \(тимчасово недоступні\)/);
  assert.match(html, /aria-disabled="true"/);
  assert.doesNotMatch(html, /href="[^"]*grain=week/);
  assert.match(html, /MULTI-YEAR DYNAMICS · МІСЯЦІ/);
  assert.match(html, /class="kpi-grid"/, 'Other verified KPIs remain visible');
});

test('Overview markup percentage does not invent +pp growth without prior-year revenue', async t => {
  t.mock.method(globalThis,'fetch',()=>assert.fail('Synthetic ratio QA cannot reach network'));
  // Warehouse-proven 2025 Cherkasy: revenue 1,446,111.70, markup 812,241.42;
  // no 2024 location revenue. The 2024 ratio is undefined, not measured 0%.
  const h = harness({
    revenue:1446111.70, checks:3724, averageCheck:1446111.70/3724,
    markup:812241.42, markupRate:812241.42/1446111.70*100
  },zero);
  const html = await h.render();
  assert.match(html, /<span class="kpi-label">Націнка %<\/span><strong>56\\.2%<\/strong><span class="delta[^"]*">—<\/span>/);
  assert.doesNotMatch(html, /\+56\\.2 п\\.п\\./);
  assert.match(html, /<span class="kpi-label">Середній чек<\/span><strong>₴ /);
  assert.match(html, /<span class="kpi-label">Середній чек<\/span><strong>[^<]+<\/strong><span class="delta[^"]*">—<\/span>/);
});

test('Overview ratios without current denominators render unknown, not measured zero', async t => {
  t.mock.method(globalThis,'fetch',()=>assert.fail('Synthetic zero-denominator QA cannot reach network'));
  const html = await harness(zero,metrics).render();
  for (const label of ['Середній чек','Націнка %']) {
    assert.ok(html.includes(`<span class="kpi-label">${label}</span><strong>—</strong>`), label);
  }
  assert.doesNotMatch(html, /NaN|Infinity/);
});
