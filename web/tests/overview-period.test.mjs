import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader, rpcFixture, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const query = {year:2025, location:'Черкаси', period:'ytd', compare:'ly', metric:'revenue', grain:'month', lfl:false};
const metrics = {revenue:987654321, checks:67891, averageCheck:14547, markup:34567890, markupRate:35};

function harness(overrides = {}, multiYearData) {
  let legacyCalls = 0;
  const calls = [], charts = [];
  let payload, before;
  const load = moduleLoader({
    'next/cache': {unstable_cache: fn => fn},
    'next/link': {default: ({prefetch, children, ...props}) => React.createElement('a', props, children)},
    '@/components/DashboardSidebar': {DashboardSidebar: props => React.createElement('aside', null, props.statusTitle, props.statusDetail)},
    ...Object.fromEntries(['MultiYearMetricChart','ChannelMixChart'].map(name => [
      `@/components/${name}`, {[name]: props => {charts.push({name,...props}); return React.createElement('div', {'data-chart':name});}}
    ])),
    '@/lib/data/source': {
      loadSalesDataStatus: async () => ({source:'unknown',status:'unavailable',cutoffDate:null}),
      callBiRpc: async (name,args) => {
        calls.push({name,args});
        payload = {...rpcFixture(name,args), current:metrics, previous:{...metrics,revenue:100},
          channels:[{name:'LEAKED CHANNEL',revenue:metrics.revenue,share:99}],
          locations:[{name:'LEAKED LOCATION',revenue:metrics.revenue,growth:99}],
          monthlyTable:[{month:7,label:'LEAKED MONTH',revenue:metrics.revenue}],
          multiYearData:multiYearData ?? [{label:'LEAKED CHART',2026:metrics.revenue}],
          channelMixData:[{label:'LEAKED MIX',venue:99}],
          growthDrivers:{totalDelta:metrics.revenue,checksEffect:metrics.revenue,averageCheckEffect:metrics.revenue,
            channelDrivers:[{name:'LEAKED DRIVER',delta:metrics.revenue}],locationDrivers:[{name:'LEAKED DRIVER',delta:metrics.revenue}]}};
        Object.assign(payload.meta, {selectedYear:2025,currentYear:2025,selectedMonth:null,
          cutoffDate:'2025-09-30',latestSourceDate:'2026-07-14',periodLabel:'RETURNED PERIOD',
          comparisonLabel:'RETURNED COMPARISON',years:[2026],availableMonths:[7],locations:[],...overrides});
        before = structuredClone(payload);
        return payload;
      },
      loadSalesData: async () => {legacyCalls++; throw Error('Known mismatch must not use legacy');}
    }
  });
  return {calls, charts, load, get legacyCalls() {return legacyCalls;},
    assertUnchanged() {assert.deepEqual(payload,before);},
    data: q => load('lib/data/overview.ts').loadOverviewData({...query,...q}),
    async render(q = {}) {
      const params = Object.fromEntries(Object.entries({...query,...q}).map(([key,value]) => [key,String(value)]));
      return renderToStaticMarkup(await load('app/page.tsx').default({searchParams:Promise.resolve(params)}));
    }};
}

const mismatches = [
  {name:'Cherkasy selected 2024, fallback July 2026', query:{year:2024}, meta:{selectedYear:2024,currentYear:2026,cutoffDate:'2026-07-14'}},
  {name:'selected October 2026, fallback July',query:{year:2026,month:10,period:'month'},meta:{selectedYear:2026,currentYear:2026,selectedMonth:10,cutoffDate:'2026-07-14'}},
  {name:'selected September 2025, fallback July 2026',query:{month:9,period:'month'},meta:{selectedMonth:9,currentYear:2026,cutoffDate:'2026-07-14'}},
  {name:'currentYear mismatch alone',meta:{currentYear:2026}},
  {name:'cutoff year mismatch alone',meta:{cutoffDate:'2026-09-30'}},
  {name:'returned selectedYear mismatch',meta:{selectedYear:2026}},
  {name:'selected month versus cutoff mismatch alone',query:{month:9},meta:{selectedMonth:9,cutoffDate:'2025-07-14'}},
  {name:'returned selectedMonth mismatch',query:{month:9},meta:{selectedMonth:7}},
  {name:'missing selectedMonth',query:{month:9}},
  {name:'unexpected selectedMonth',meta:{selectedMonth:9}},
  {name:'missing currentYear',meta:{currentYear:undefined}},
  {name:'invalid currentYear',meta:{currentYear:'garbage'}},
  ...[undefined,null,'','invalid','2025-02-30','2025-13-01','2025-00-01','2025-09-00','2025-09-31','2025-9-1','2025-09-30T00:00:00Z'].map(cutoffDate => ({name:`invalid/missing cutoff ${cutoffDate}`,meta:{cutoffDate}}))
];

for (const scenario of mismatches) {
  test(`adapter fails closed: ${scenario.name}`, async t => {
    t.mock.method(globalThis,'fetch',()=>assert.fail('No network allowed'));
    const h = harness(scenario.meta);
    const data = await h.data(scenario.query);
    assert.equal(data.status,'unavailable');
    assert.equal(data.reason,'SELECTED_PERIOD_CONTRACT_MISMATCH');
    assert.equal(data.selectedYear,scenario.query?.year ?? query.year);
    assert.equal(data.selectedMonth,scenario.query?.month);
    for (const field of ['snapshot','multiYearData','channelMixData','growthDrivers']) assert.equal(Object.hasOwn(data,field),false);
    assert.equal(h.legacyCalls,0);
    assert.equal(h.calls.length,1);
    h.assertUnchanged();
  });

  test(`actual Overview SSR contains no leaked metrics: ${scenario.name}`, async t => {
    t.mock.method(globalThis,'fetch',()=>assert.fail('No network allowed'));
    const h = harness(scenario.meta);
    const html = await h.render(scenario.query);
    assert.match(html,/NO DATA \/ UNKNOWN/);
    assert.match(html,/Немає підтверджених даних за обраний період/);
    assert.match(html,/відсутність даних не означає нуль/);
    const year = scenario.query?.year ?? query.year;
    assert.ok(html.includes(`value="${year}" selected=""`));
    assert.match(html,/value="Черкаси" selected=""/);
    if (scenario.query?.month) assert.ok(html.includes(`value="${scenario.query.month}" selected=""`));
    assert.match(html,new RegExp(`href="/\\?[^\"]*year=${year}`));
    assert.match(html,/location=%D0%A7%D0%B5%D1%80%D0%BA%D0%B0%D1%81%D0%B8/);
    assert.doesNotMatch(html,/LEAKED|RETURNED PERIOD|RETURNED COMPARISON|LIVE SIGNAL|Позитивна динаміка|987654321|NaN|Infinity|undefined|₴\s*0|0\.0%/);
    for (const block of ['kpi-grid','share-strip','revenue-panel','channel-mix-panel','growth-grid','management-panel','location-table','insight-panel']) {
      assert.equal(html.includes(block),false,block);
    }
    assert.deepEqual(h.charts,[]);
    assert.equal(h.legacyCalls,0);
    h.assertUnchanged();
  });
}

for (const scenario of [
  {name:'valid year',meta:{}},
  {name:'valid September 2025',query:{month:9,period:'month'},meta:{selectedMonth:9}},
  {name:'valid October 2026',query:{year:2026,month:10,period:'month'},meta:{selectedYear:2026,currentYear:2026,selectedMonth:10,cutoffDate:'2026-10-22'}},
  {name:'valid numeric strings',query:{month:9},meta:{selectedYear:'2025',currentYear:'2025',selectedMonth:'9'}},
  {name:'valid leap day',query:{year:2024,month:2},meta:{selectedYear:2024,currentYear:2024,selectedMonth:2,cutoffDate:'2024-02-29'}}
]) {
  test(`valid period preserves adapter metrics and actual SSR: ${scenario.name}`,async () => {
    const h = harness(scenario.meta);
    const data = await h.data(scenario.query);
    assert.equal(data.status,'ready');
    assert.deepEqual(data.snapshot.current,metrics);
    assert.equal(data.snapshot.signal.title,'Позитивна динаміка');
    const html = await h.render(scenario.query);
    assert.doesNotMatch(html,/NO DATA \/ UNKNOWN/);
    assert.match(html,/class="kpi-grid"/);
    assert.match(html,/RETURNED PERIOD/);
    assert.match(html,/LEAKED CHANNEL/); // Only valid fixtures may render the returned blocks.
    assert.equal(h.charts.length,2);
    assert.equal(h.legacyCalls,0);
    h.assertUnchanged();
  });
}

test('implicit year validates against returned selectedYear, not the clock', async () => {
  const h = harness();
  assert.equal((await h.data({year:undefined})).status,'ready');
  assert.equal((await harness({cutoffDate:'2026-07-14'}).data({year:undefined})).status,'unavailable');
});

test('UNKNOWN SSR retains every selected filter and navigation argument', async () => {
  const h = harness({currentYear:2026,cutoffDate:'2026-07-14'});
  const html = await h.render({month:9,channel:'Доставка',orderType:'Courier fixture',brand:'Brand fixture',
    ownership:'Owner fixture',compare:'previous',metric:'checks',grain:'week',lfl:'1'});
  for (const value of ['2025','9','Доставка','Courier fixture','Brand fixture','Owner fixture','Черкаси','previous']) {
    assert.ok(html.includes(`value="${value}" selected=""`),value);
  }
  assert.match(html,/name="lfl" value="1"/);
  const resetSlice = html.match(/<a class="reset-filter" href="([^"]+)"/)[1].replaceAll('&amp;','&');
  const params = new URL(resetSlice,'https://synthetic.invalid').searchParams;
  for (const [key,value] of Object.entries({year:'2025',month:'9',period:'month',compare:'previous',metric:'checks',lfl:'1'})) {
    assert.equal(params.get(key),value,key);
  }
  assert.equal(params.get('grain'),null,'Canonical month grain omits the default query argument');
  assert.equal(h.calls[0].args.p_grain,'month');
  assert.equal(h.calls[0].args.p_channel,'Доставка');
  assert.equal(h.calls[0].args.p_order_type,'Courier fixture');
  assert.equal(h.calls[0].args.p_brand,'Brand fixture');
  assert.equal(h.calls[0].args.p_ownership,'Owner fixture');
  assert.equal(h.legacyCalls,0);
});


test('Overview SQL connectivity does not certify source freshness', async () => {
  const h = harness({latestSourceDate:'2026-10-26'});
  const html = await h.render();
  assert.match(html, /SQL CONNECTED · FRESHNESS UNVERIFIED/);
  assert.match(html, /остання дата джерела: 2026-10-26/);
  assert.match(html, /SQL SIGNAL · FRESHNESS UNVERIFIED/);
  assert.doesNotMatch(html, /Live data connected|LIVE SIGNAL|BUSINESS PERFORMANCE · LIVE/);
  assert.equal(h.legacyCalls,0);
  h.assertUnchanged();
});


test('Overview URL-driven YTD → MTD → LFL/segment links remount uncontrolled filter form', async () => {
  const h = harness();
  const find = (tree, predicate) => {
    const pending = [tree];
    while (pending.length) {
      const node = pending.shift();
      if (Array.isArray(node)) { pending.push(...node); continue; }
      if (!node || typeof node !== 'object') continue;
      if (predicate(node)) return node;
      if (node.props?.children) pending.push(node.props.children);
    }
    return null;
  };
  const formAt = async params => {
    const tree = await h.load('app/page.tsx').default({searchParams: Promise.resolve(params)});
    const form = find(tree, node => node.type === 'form' && node.props?.className === 'filter-form');
    assert.ok(form, 'actual Overview filter form is present');
    return form;
  };
  const ytd = await formAt({year:'2025'});
  const mtd = await formAt({year:'2025',month:'10'});
  const lfl = await formAt({year:'2025',month:'10',lfl:'1'});
  const brand = await formAt({year:'2025',month:'10',lfl:'1',brand:'Marmoo'});
  const month = form => find(form, node => node.type === 'select' && node.props?.name === 'month');
  assert.equal(month(ytd)?.props.defaultValue, '');
  assert.equal(month(mtd)?.props.defaultValue, '10');
  assert.equal(month(lfl)?.props.defaultValue, '10');
  assert.ok([ytd,mtd,lfl,brand].every(form => typeof form.key === 'string'));
  assert.notEqual(ytd.key, mtd.key, 'MTD link must not reuse the stale YTD select DOM');
  assert.notEqual(mtd.key, lfl.key, 'LFL link must not reuse the previous form DOM');
  assert.notEqual(lfl.key, brand.key, 'brand link must not reuse the previous form DOM');
  assert.equal(find(lfl, node => node.type === 'input' && node.props?.name === 'lfl')?.props.value, '1');
});

for (const scenario of [
  {name:'complete October 2025 vs 26-day comparison', year:2025, month:10, cutoff:'2025-10-31', plotted:26, missingFrom:27, missingTo:31},
  {name:'leap-day February 2024 vs 28-day comparison', year:2024, month:2, cutoff:'2024-02-29', plotted:28, missingFrom:29, missingTo:29}
]) {
  test(`Overview actual SSR discloses historical month/chart horizon: ${scenario.name}`, async t => {
    t.mock.method(globalThis,'fetch',()=>assert.fail('Synthetic period QA must not reach network'));
    const series = Array.from({length:scenario.plotted}, (_, i) => ({label:String(i + 1),2024:100,2025:200,2026:300}));
    const h = harness({selectedYear:scenario.year,currentYear:scenario.year,selectedMonth:scenario.month,
      cutoffDate:scenario.cutoff,latestSourceDate:'2026-10-26'}, series);
    const html = await h.render({year:scenario.year,month:scenario.month,period:'month'});
    assert.match(html, /data-testid="multi-year-horizon-note"/);
    assert.ok(html.includes(`графік показує 1–${scenario.plotted} числа`));
    assert.ok(html.includes(`Дні ${scenario.missingFrom}–${scenario.missingTo} на графіку відсутні`));
    assert.ok(html.includes(`дати до ${scenario.cutoff}`));
    assert.match(html,/Відсутність днів на графіку не означає нульові продажі/);
    const chart = h.charts.find(c=>c.name==='MultiYearMetricChart');
    assert.equal(chart.data.length,scenario.plotted,'Only the original source chart data may be passed through');
    assert.equal(h.calls[0].args.p_focus_month,scenario.month);
    assert.equal(h.legacyCalls,0);
    h.assertUnchanged();
  });
}

test('Overview actual SSR does not claim historical horizon mismatch for matching current cutoff', async t => {
  t.mock.method(globalThis,'fetch',()=>assert.fail('Synthetic period QA must not reach network'));
  const series = Array.from({length:26}, (_, i) => ({label:String(i + 1),2025:200,2026:300}));
  const h = harness({selectedYear:2026,currentYear:2026,selectedMonth:10,
    cutoffDate:'2026-10-26',latestSourceDate:'2026-10-26'},series);
  const html = await h.render({year:2026,month:10,period:'month'});
  assert.doesNotMatch(html,/multi-year-horizon-note|Періоди на графіку й у KPI різняться/);
  assert.equal(h.charts.find(c=>c.name==='MultiYearMetricChart').data.length,26);
  h.assertUnchanged();
});


test('Overview monthly SQL future months remain UNKNOWN all the way to chart props', async t => {
  t.mock.method(globalThis,'fetch',()=>assert.fail('No external network in synthetic RPC/SSR test'));
  const series = Array.from({length:12}, (_,i) => ({
    label: 'M'+(i+1), '2025':i===10?110:20, '2026':i===0?0:i<10?50:0
  }));
  series[5]['2025']=null;
  series[6]['2025']='';
  series[7]['2025']='invalid-number';
  const h = harness({selectedYear:2026,currentYear:2026,selectedMonth:null,
    years:[2025,2026],cutoffDate:'2026-10-26',latestSourceDate:'2026-10-26'},series);
  const data = await h.data({year:2026});
  assert.equal(data.status,'ready');
  assert.equal(data.multiYearData.length,12);
  assert.equal(data.multiYearData[0]['2026'],0,'observed zero is retained');
  assert.equal(data.multiYearData[9]['2026'],50,'observed partial October retained');
  assert.equal(data.multiYearData[10]['2026'],null,'future November is not a measured zero');
  assert.equal(data.multiYearData[11]['2026'],null,'future December is not a measured zero');
  assert.equal(data.multiYearData[10]['2025'],110,'historical November unchanged');
  for(const index of [5,6,7]) assert.equal(data.multiYearData[index]['2025'],null);
  const html = await h.render({year:2026});
  assert.match(html,/MULTI-YEAR DYNAMICS/);
  const charts=h.charts.filter(c=>c.name==='MultiYearMetricChart');
  assert.ok(charts.length>0);
  assert.equal(charts.at(-1).data[10]['2026'],null,'SSR chart receives null gap');
  assert.equal(charts.at(-1).data[0]['2026'],0);
  assert.equal(h.legacyCalls,0);
  h.assertUnchanged();
});

test('Overview month-selected day grid must not be masked as a 12-month grid', async t => {
  t.mock.method(globalThis,'fetch',()=>assert.fail('No external network in synthetic RPC test'));
  const series=Array.from({length:12},(_,i)=>({label:String(i+1),'2025':22,'2026':50}));
  const h=harness({selectedYear:2026,currentYear:2026,selectedMonth:10,years:[2025,2026],
    cutoffDate:'2026-10-26',latestSourceDate:'2026-10-26'},series);
  const data=await h.data({year:2026,month:10,period:'month'});
  assert.equal(data.status,'ready');
  assert.equal(data.multiYearData[10]['2026'],50);
  assert.equal(data.multiYearData[11]['2026'],50);
  assert.equal(h.legacyCalls,0);
  h.assertUnchanged();
});


test('Overview filtered 2026 cutoff preserves UNKNOWN months instead of global-date false zeroes', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('No network in scoped cutoff contract test'));
  const series = Array.from({length:12}, (_,i) => ({
    label:`M${i+1}`, '2025':45, '2026':i===0?0:i<7?12:0
  }));
  const h = harness({
    selectedYear:2026, currentYear:2026, selectedMonth:null,
    years:[2025,2026], cutoffDate:'2026-07-14',
    latestSourceDate:'2026-10-26'
  }, series);
  const data = await h.data({year:2026});
  assert.equal(data.status,'ready');
  assert.equal(data.multiYearData[0]['2026'],0,'genuine observed zero survives');
  assert.equal(data.multiYearData[6]['2026'],12,'observed July remains');
  for (const month of [8,9,10,11,12]) {
    assert.equal(data.multiYearData[month-1]['2026'],null,`2026 month ${month} is missing, not zero`);
    assert.equal(data.multiYearData[month-1]['2025'],45,'historical observed data remains');
  }
  const html = await h.render({year:2026});
  assert.match(html,/SQL CONNECTED · FRESHNESS UNVERIFIED/);
  const chart = h.charts.find(c => c.name==='MultiYearMetricChart');
  assert.ok(chart,'actual SSR passes a chart');
  for (const month of [8,9,10,11,12]) {
    assert.equal(chart.data[month-1]['2026'],null,'SSR chart prop keeps missing month');
  }
  assert.equal(h.legacyCalls,0);
  h.assertUnchanged();
});

test('Overview source-current unfiltered cutoff preserves October and historical observations', async t => {
  t.mock.method(globalThis,'fetch',()=>assert.fail('No external requests'));
  const rows = Array.from({length:12},(_,i)=>({
    label:`M${i+1}`,'2025':10,'2026':i<10?i===0?0:80:0
  }));
  const h=harness({
    selectedYear:2026,currentYear:2026,selectedMonth:null,
    cutoffDate:'2026-10-26',latestSourceDate:'2026-10-26',
    years:[2025,2026]
  },rows);
  const d=await h.data({year:2026});
  assert.equal(d.status,'ready');
  assert.equal(d.multiYearData[0]['2026'],0);
  assert.equal(d.multiYearData[9]['2026'],80);
  assert.equal(d.multiYearData[10]['2026'],null);
  assert.equal(d.multiYearData[11]['2026'],null);
  assert.equal(d.multiYearData[11]['2025'],10);
  h.assertUnchanged();
});
