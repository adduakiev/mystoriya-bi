import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceWindow, SOURCE_WINDOW_LIMITATIONS} from '../lib/source-evidence.ts';
import {normalizeDigital, normalizeDigitalHistory} from '../lib/data/digital-contract.ts';
import {normalizeAds, normalizeLocal} from '../lib/data/digital-source-contract.ts';
import {moduleLoader, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const selected = {from:'2025-06-01',to:'2025-06-30'};
const adsPeriod = {from:'2026-10-12',to:'2026-10-23'};
const localPeriod = {from:'2026-10-10',to:'2026-10-21'};

test('source window match requires both valid boundaries; overlap, shared end and missing dates prove no match', () => {
  assert.equal(sourceWindow(selected,selected).matchesSelected,true);
  for (const period of [adsPeriod,{...selected,from:'2025-06-02'},{...selected,to:'2025-06-29'}])
    assert.equal(sourceWindow(period,selected).matchesSelected,false);
  for (const period of [{},{from:selected.from},{to:selected.to},{...selected,from:null},
    {...selected,from:'2025-02-30'},{...selected,to:'2025-06-31'},
    {...selected,to:'invalid'},{from:selected.to,to:selected.from}]) {
    const result=sourceWindow(period,selected);
    assert.equal(result.matchesSelected,null);
    assert.match(result.relationship,/UNKNOWN/);
    assert.doesNotMatch(result.relationship,/Обидві межі збігаються/);
  }
  assert.equal(sourceWindow({},selected).period,'UNKNOWN → UNKNOWN');
  assert.equal(sourceWindow({from:selected.from},selected).period,'2025-06-01 → UNKNOWN');
  assert.match(sourceWindow(selected,selected).relationship,/upstream покриття не підтверджено/);
});

async function render(params, adsMeta=adsPeriod, localMeta=localPeriod, campaigns=[{cost:10,conversions:0}]) {
  const calls=[];
  const chartRows=[];
  const ads=normalizeAds({meta:{available:true,rows:1,...adsMeta},summary:{cost:100,conversions:0,conversionValue:0},campaigns});
  const local=normalizeLocal({meta:{rows:1,...localMeta},summary:{calls:0,directions:1,websiteClicks:2,menuClicks:3,impressions:25}});
  const before=structuredClone({ads,local});
  const h=normalizeDigitalHistory({meta:{commonLatest:'2026-10-23',currentYear:2026,cutoffMonth:10,cutoffDay:23},
    quality:{ga4:{from:'2025-01-01',to:'2026-10-23'},searchConsole:{from:'2025-01-01',to:'2026-10-23'}}});
  const load=moduleLoader({
    'next/link':{default:({children,prefetch,...props})=>React.createElement('a',props,children)},
    '@/components/DashboardSidebar':{DashboardSidebar:()=>null},
    '@/components/DigitalReportShell':{DigitalTabs:()=>null},
    '@/components/DigitalHistoryChart':{DigitalHistoryChart:()=>null},
    '@/components/DigitalTrendChart':{DigitalTrendChart:({data})=>{chartRows.push(data);return null;}},
    '@/lib/digital-reports':{DIGITAL_REPORTS:[]},
    '@/lib/data/digital':{
      loadDigitalHistory:async()=>h,
      loadDigitalData:async range=>{
        calls.push({name:'ga4/gsc',range});
        const current=calls.filter(c=>c.name==='ga4/gsc').length===1;
        return normalizeDigital({meta:{...range,currentGa4Rows:1,currentSearchRows:1},
          current:{sessions:current?100:50,purchases:current?2:1,purchaseRevenue:100},
          seo:{clicks:current?20:10,impressions:100},trend:[{date:range.to,sessions:current?100:50}]});
      }
    },
    '@/lib/data/digital-sources':{
      loadDigitalAdsData:async(...args)=>{calls.push({name:'ads',args});return ads;},
      loadDigitalLocalData:async(...args)=>{calls.push({name:'local',args});return local;}
    }
  });
  const html=renderToStaticMarkup(await load('app/digital/page.tsx').default({searchParams:Promise.resolve(params)}));
  assert.deepEqual({ads,local},before,'source numbers and independent metadata must survive presentation');
  return {html,calls,chartRows};
}
function card(html,label) {
  const result=html.match(new RegExp(`<article class="digital-kpi-card"><span>${label}</span>[\\s\\S]*?</article>`))?.[0];
  assert.ok(result,`missing ${label}`);
  return result;
}
function assertIndependent(html,ads=adsPeriod,local=localPeriod) {
  assert.ok(html.includes(SOURCE_WINDOW_LIMITATIONS));
  assert.match(html,/Незалежний від вибраного періоду GA4\/GSC/);
  for (const label of ['Google Ads Spend','CPA Ads','ROAS Ads','Local actions','Google / Maps покази']) {
    const c=card(html,label);
    const period=label==='Local actions'||label==='Google / Maps покази'?local:ads;
    assert.ok(c.includes(sourceWindow(period,selected).period),c);
    assert.doesNotMatch(c,/до попереднього періоду|до минулого року|positive|negative|[+-]\d+(?:\.\d+)?%/);
  }
  assert.match(card(html,'ROAS Ads'),/<strong>—<\/strong>/);
  assert.match(card(html,'Google Ads Spend'),/<strong>— · currency UNKNOWN<\/strong>/);
  assert.match(card(html,'Revenue GA4'),/<strong>— · currency UNKNOWN<\/strong>/);
}

for (const scenario of [
  {name:'custom June 2025 / previous',params:{...selected,compare:'previous'},range:selected,prior:{from:'2025-05-02',to:'2025-05-31'}},
  {name:'custom June 2026 / YoY',params:{from:'2026-06-01',to:'2026-06-30',compare:'yoy'},range:{from:'2026-06-01',to:'2026-06-30'},prior:selected},
  {name:'7d / previous',params:{preset:'7d',compare:'previous'},range:{from:'2026-10-17',to:'2026-10-23'},prior:{from:'2026-10-10',to:'2026-10-16'}},
  {name:'YTD / YoY',params:{preset:'ytd',compare:'yoy'},range:{from:'2026-01-01',to:'2026-10-23'},prior:{from:'2025-01-01',to:'2025-10-23'}}
]) {
  test(`actual synthetic overview SSR ${scenario.name}: selected/comparison GA4/GSC intact, Ads/Local windows separate`,async t=>{
    t.mock.method(globalThis,'fetch',()=>assert.fail('Synthetic regression must not reach network'));
    const {html,calls,chartRows}=await render(scenario.params);
    assert.deepEqual(calls.filter(c=>c.name==='ga4/gsc').map(c=>c.range),[scenario.range,scenario.prior]);
    for (const name of ['ads','local']) assert.deepEqual(calls.find(c=>c.name===name).args,[]);
    for (const key of ['from','to']) assert.ok(html.includes(`name="${key}"`) && html.includes(`value="${scenario.range[key]}"`));
    assert.match(card(html,'Сесії'),/<strong>100<\/strong>[\s\S]*\+100.0%/);
    assert.match(card(html,'SEO кліки'),/<strong>20<\/strong>[\s\S]*\+100.0%/);
    assert.equal(chartRows[0][0].date,scenario.range.to);
    assertIndependent(html);
    assert.doesNotMatch(html,/Обидві межі збігаються/);
    assert.match(html,/Google Ads · 0 conversions за період джерела/);
    assert.ok(html.includes(`Період джерела Google Ads: ${sourceWindow(adsPeriod,selected).period}`));
    assert.doesNotMatch(html,/NaN|Infinity/);
  });
}

test('actual SSR equal, one-boundary, absent and invalid source windows stay explicit without coverage claims',async()=>{
  for (const period of [selected,{...selected,from:'2025-06-02'},{...selected,to:'2025-06-29'},
    {},{from:selected.from},{to:selected.to},{from:'2025-02-30',to:selected.to}]) {
    const {html}=await render({...selected,compare:'previous'},period,period);
    assertIndependent(html,period,period);
    const evidence=sourceWindow(period,selected);
    assert.ok(html.includes(evidence.relationship));
    assert.equal(html.includes('Обидві межі збігаються'),evidence.matchesSelected===true);
    assert.doesNotMatch(html,/Повнота (?:LIVE|COMPLETE)|свіжість джерела (?:FRESH|LIVE)/);
  }
});

test('actual SSR Ads zero-conversion signal requires positive spend and measured numeric zero; null/unknown excluded',async()=>{
  for (const conversions of [null,undefined,'',NaN]) {
    const {html}=await render(selected,adsPeriod,localPeriod,[{cost:10,conversions}]);
    assert.doesNotMatch(html,/0 conversions за період джерела|кампаній з витратами і 0 Google Ads conversions/);
  }
  for (const cost of [null,0]) {
    const {html}=await render(selected,adsPeriod,localPeriod,[{cost,conversions:0}]);
    assert.doesNotMatch(html,/0 conversions за період джерела/);
  }
  const {html}=await render(selected,adsPeriod,localPeriod,[{cost:10,conversions:0},{cost:10,conversions:null},{cost:10}]);
  assert.match(html,/1 кампаній з витратами і 0 Google Ads conversions/);
  assert.match(html,/Період джерела Google Ads: 2026-10-12 → 2026-10-23/);
  assert.match(html,/свіжість джерела UNKNOWN/);
});
