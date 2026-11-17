import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {moduleLoader, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const load=moduleLoader({});
const {PNL_SOURCE,PNL_SOURCE_META}=load('lib/data/pnl-source.ts');
const {loadPnlData}=load('lib/data/pnl.ts');
const cents=value=>Math.round(value*100);

test('September append preserves every January–August source value and keeps missing LY null',()=>{
  const old=Object.fromEntries(Object.entries(PNL_SOURCE).map(([key,row])=>[key,{
    ...row,...Object.fromEntries(['fact2025','plan2026','fact2026'].map(series=>[series,row[series].slice(0,8)]))
  }]));
  assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),
    '14036762ea18c91b99b3b989d2fa2bbf8c73fb65bf1333627e621c9ba1c0271b');
  assert.equal(PNL_SOURCE_META.latestFactMonth,9);
  assert.equal(PNL_SOURCE_META.latestComparisonMonth,8);
  assert.deepEqual(PNL_SOURCE_META.septemberColumns,{plan:'AW',fact:'AX'});
  for(const row of Object.values(PNL_SOURCE)){
    for(const key of ['fact2025','plan2026','fact2026']) assert.equal(row[key].length,9);
    assert.equal(row.fact2025[8],null);
  }
  assert.equal(PNL_SOURCE.admitad.fact2026[8],null);
  assert.equal(PNL_SOURCE.taxi.plan2026[8],null);
});

test('September control totals reconcile and commission enters calculated costs exactly once',()=>{
  const data=loadPnlData({startMonth:8,endMonth:8});
  for(const [series,actual,expected]of [
    ['fact2026',data.fact,{revenue:7673452.32,cogs:2684914.14,commission:1027081.25,sourceCogs:3711995.39,sourceExpenses:1648437.81,opex:2675519.06,profit:2313019.12}],
    ['plan2026',data.plan,{revenue:7291197.34,cogs:2558036.09,commission:730730.15,sourceCogs:3288766.24,sourceExpenses:1587600,opex:2318330.15,profit:2414831.10}]
  ]){
    assert.equal(cents(actual.revenue),cents(expected.revenue));
    assert.equal(cents(actual.delivery.revenue+actual.aggregators.revenue),cents(expected.revenue));
    assert.equal(cents(actual.cogs),cents(expected.cogs));
    assert.equal(cents(PNL_SOURCE.cogs_total[series][8]),cents(expected.sourceCogs));
    assert.equal(cents(actual.cogs+actual.aggregators.commission),cents(expected.sourceCogs));
    assert.equal(cents(PNL_SOURCE.reported_expenses[series][8]),cents(expected.sourceExpenses));
    assert.equal(cents(actual.operatingExpenses),cents(expected.opex));
    assert.equal(cents(actual.operatingExpenses),cents(expected.sourceExpenses+expected.commission));
    assert.equal(cents(actual.profit),cents(expected.profit));
    assert.ok(Math.abs(actual.reportedGap)<0.005);
  }
  assert.equal(cents(PNL_SOURCE.commission_glovo.fact2026[8]+PNL_SOURCE.commission_bolt.fact2026[8]+PNL_SOURCE.commission_loco.fact2026[8]),102708125);
  assert.deepEqual(PNL_SOURCE_META.reportedExpenseSemantics,{
    januaryThroughAugust:'includes-aggregator-commission',september:'excludes-aggregator-commission'
  });
});

test('September and Jan–Sep have no fabricated prior-year comparison; covered months remain comparable',()=>{
  for(const args of [{startMonth:8,endMonth:8},{startMonth:0,endMonth:8}]){
    const data=loadPnlData(args);
    assert.equal(data.meta.comparisonAvailable,false);
    assert.equal(data.ly,null);
    assert.ok(data.details.every(row=>row.ly===null));
    const september=data.trend.at(-1);
    assert.equal(september.label,'Вер');
    for(const [key,value]of Object.entries(september)) if(key.endsWith('Ly')) assert.equal(value,null);
  }
  const covered=loadPnlData({startMonth:0,endMonth:7});
  assert.equal(covered.meta.comparisonAvailable,true);
  assert.equal(covered.ly.revenue,52062625);
  assert.equal(covered.ly.revenue,covered.ly.delivery.revenue+covered.ly.aggregators.revenue);
  assert.equal(loadPnlData().trend.length,9);
  assert.equal(loadPnlData().trend[7].revenueLy,6986978);
});

test('September page exposes the month, honest availability note and null chart baseline',async()=>{
  const charts=[];
  const render=moduleLoader({
    '@/components/DashboardSidebar':{DashboardSidebar:props=>React.createElement('aside',null,props.statusDetail)},
    '@/components/PnlTrendChart':{PnlTrendChart:props=>{charts.push(props.data);return React.createElement('div',{'data-chart':'pnl'});}}
  });
  const html=renderToStaticMarkup(await render('app/pnl/page.tsx').default({searchParams:Promise.resolve({from:'9',to:'9'})}));
  assert.match(html,/Вересень 2026/);
  assert.match(html,/по вересень 2026/);
  assert.match(html,/немає вересня 2025/);
  assert.match(html,/Історичні перерахунки джерела ще не застосовані/);
  assert.match(html,/Комісія агрегаторів у цьому звіті врахована один раз/);
  assert.doesNotMatch(html,/FIN-BI/);
  assert.match(html,/<option value="9" selected="">Вересень<\/option>/);
  assert.doesNotMatch(html,/NaN|Infinity|undefined|по серпень 2026/);
  assert.equal(charts[0][0].profitLy,null);
  const detailRows=[...html.matchAll(/class="pnl-detail-row pnl-row-[^"]+"[\s\S]*?<\/div>/g)];
  assert.ok(detailRows.length>20);
  assert.ok(detailRows.every(([row])=>/<span>—<\/span><span class="">—<\/span>/.test(row)));
});
