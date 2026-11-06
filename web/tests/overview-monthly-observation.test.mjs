import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader, rpcFixture, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

// Real adapter + SSR, synthetic RPC boundary: never contacts external sources.
const labels=['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const months=()=>labels.map((label,i)=>({
  month:i+1,label,revenue:100,checks:4,averageCheck:25,markupRate:20,
  revenueGrowth:10,checksGrowth:5,venueShare:40,aggregatorShare:30,deliveryShare:30,
  currentObservationCount:4,previousObservationCount:4
}));
function harness(rows) {
  let legacy=0;
  const load=moduleLoader({
    'next/cache':{unstable_cache:fn=>fn},
    'next/link':{default:({prefetch,children,...props})=>React.createElement('a',props,children)},
    '@/components/DashboardSidebar':{DashboardSidebar:()=>null},
    '@/components/MultiYearMetricChart':{MultiYearMetricChart:()=>null},
    '@/components/ChannelMixChart':{ChannelMixChart:()=>null},
    '@/lib/data/source':{
      callBiRpc:async(name,args)=>{
        assert.equal(name,'bi_overview_payload');
        const payload=rpcFixture(name,args);
        Object.assign(payload.meta,{selectedYear:2026,currentYear:2026,previousYear:2025,
          selectedMonth:null,cutoffDate:'2026-10-26',latestSourceDate:'2026-10-26',
          years:[2025,2026],availableMonths:[1,2,3,4,5,6,7,8,9,10]});
        payload.monthlyTable=rows;
        return payload;
      },
      loadSalesData:async()=>{legacy++;throw Error('Unexpected fallback');}
    }
  });
  return {get legacy(){return legacy;},
    data:()=>load('lib/data/overview.ts').loadOverviewData({
      period:'ytd',compare:'ly',metric:'revenue',grain:'month',lfl:false,year:2026}),
    async html(){return renderToStaticMarkup(await load('app/page.tsx').default({
      searchParams:Promise.resolve({year:'2026'})}));}
  };
}
function rowHtml(html,name) {
  const rows=html.match(/<a[^>]*class="management-row"[^>]*>[\s\S]*?<\/a>/g)??[];
  const row=rows.find(value=>value.includes(`<b>${name}`));
  assert.ok(row,'Missing SSR management row '+name);return row;
}

test('Overview monthly counts: interior hole, missing previous and measured zero survive RPC→adapter→SSR',async()=>{
  const rows=months();
  Object.assign(rows[2],{revenue:0,checks:0,revenueGrowth:-100,checksGrowth:-100,
    currentObservationCount:0,previousObservationCount:24});
  Object.assign(rows[3],{revenue:250,checks:5,revenueGrowth:100,checksGrowth:100,
    currentObservationCount:5,previousObservationCount:0});
  Object.assign(rows[7],{revenue:0,checks:2,averageCheck:0,markupRate:0,
    venueShare:0,aggregatorShare:0,deliveryShare:0,currentObservationCount:2,previousObservationCount:3});
  const before=structuredClone(rows),h=harness(rows),data=await h.data();
  assert.equal(data.status,'ready');
  assert.equal(data.snapshot.monthlyTable[2].revenue,null);
  assert.equal(data.snapshot.monthlyTable[2].checks,null);
  assert.equal(data.snapshot.monthlyTable[2].revenueGrowth,null);
  assert.equal(data.snapshot.monthlyTable[3].revenue,250);
  assert.equal(data.snapshot.monthlyTable[3].revenueGrowth,null);
  assert.equal(data.snapshot.monthlyTable[7].revenue,0);
  assert.equal(data.snapshot.monthlyTable[7].checks,2);
  assert.equal(data.snapshot.monthlyTable[7].averageCheck,0);
  assert.equal(data.snapshot.monthlyTable[7].markupRate,null);
  assert.equal(data.snapshot.monthlyTable[7].venueShare,null);
  const html=await h.html(),march=rowHtml(html,'Березень'),april=rowHtml(html,'Квітень'),august=rowHtml(html,'Серпень');
  assert.doesNotMatch(march,/₴0|-100\.0%/);
  assert.match(march,/<span>—<\/span>/);
  assert.match(april,/₴250/);
  assert.doesNotMatch(april,/100\.0%/);
  assert.match(august,/₴0/);
  assert.match(august,/\b2<\/span>/);
  assert.match(august,/<span>—<\/span>/);
  assert.doesNotMatch(html,/NaN|Infinity|undefined/);
  assert.deepEqual(rows,before);
  assert.equal(h.legacy,0);
});
test('Overview no-count legacy payload retains measured zero, but never turns explicit null into zero',async()=>{
  const rows=months();
  for(const row of rows){delete row.currentObservationCount;delete row.previousObservationCount;}
  rows[2].revenue=null;rows[2].checks=null;rows[2].averageCheck=null;
  rows[7].revenue=0;rows[7].checks=2;rows[7].averageCheck=0;
  const h=harness(rows),data=await h.data();
  assert.equal(data.status,'ready');
  assert.equal(data.snapshot.monthlyTable[2].revenue,null);
  assert.equal(data.snapshot.monthlyTable[2].checks,null);
  assert.equal(data.snapshot.monthlyTable[7].revenue,0);
  const html=await h.html();
  assert.match(rowHtml(html,'Березень'),/<span>—<\/span>/);
  assert.match(rowHtml(html,'Серпень'),/₴0/);
  assert.equal(h.legacy,0);
});
for(const [name,mutate] of [
  ['missing count',r=>{delete r[1].currentObservationCount;}],
  ['null count',r=>{r[1].previousObservationCount=null;}],
  ['negative count',r=>{r[2].currentObservationCount=-1;}],
  ['fractional count',r=>{r[2].currentObservationCount=0.5;}],
  ['string count',r=>{r[2].currentObservationCount='0';}],
  ['duplicate month',r=>{r[3].month=3;}],
  ['short grid',r=>{r.pop();}]
]){
  test('Overview malformed monthly provenance fails closed: '+name,async()=>{
    const rows=months();mutate(rows);const h=harness(rows);
    const data=await h.data();
    assert.equal(data.status,'unavailable');
    assert.equal(data.reason,'MONTHLY_OBSERVATION_CONTRACT_MISMATCH');
    assert.equal(h.legacy,0);
    const html=await h.html();
    assert.match(html,/NO DATA \/ UNKNOWN/);
    assert.match(html,/Немає підтверджених даних за обраний період/);
    assert.doesNotMatch(html,/management-row|MONTHLY MANAGEMENT VIEW/);
    assert.equal(h.legacy,0);
  });
}
