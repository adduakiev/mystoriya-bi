import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ga4Money, GA4_MONEY_NOTICE} from '../lib/ga4-presentation.ts';
import {normalizeDigital, normalizeDigitalHistory} from '../lib/data/digital-contract.ts';
import {normalizeAds, normalizeLocal} from '../lib/data/digital-source-contract.ts';
import {moduleLoader, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const meta = {from:'2026-09-24', to:'2026-10-23', currentGa4Rows:1, previousGa4Rows:1, currentSearchRows:1};
function fixture(value, labels = {}) {
  const dimension = {sessions:100, purchases:2, purchase_revenue:value, ...labels};
  return normalizeDigital({meta:{...meta, ...labels},
    current:{sessions:100, purchases:2, purchaseRevenue:value, engagedSessions:50},
    previous:{sessions:50, purchases:1, purchaseRevenue:100},
    channels:[{channel:'Synthetic channel', ...dimension}],
    devices:[{device:'Synthetic device', ...dimension}],
    landingPages:[{landing_page:'/synthetic-landing', ...dimension}]});
}
const history = value => normalizeDigitalHistory({
  meta:{commonLatest:meta.to, currentYear:2026, cutoffMonth:10, cutoffDay:23},
  quality:{ga4:{from:'2025-01-01',to:meta.to}, searchConsole:{from:'2025-07-01',to:meta.to}},
  monthly:[{year:2026,month:1,sessions:100,purchases:2,revenue:value,seoClicks:10,seoImpressions:100},
    {year:2026,month:2,sessions:0,purchases:0,revenue:0,seoClicks:0,seoImpressions:0},
    {year:2026,month:3,sessions:null,purchases:null,revenue:null,seoClicks:null,seoImpressions:null}]
});

// This interface intentionally accepts no alleged currency/property evidence.
// Reopening money requires a separately reviewed, verified source contract.
test('GA4 monetary formatting fails closed for measured zero, positive/negative values and null', () => {
  for (const value of [0, 9876543, -25, '42'])
    assert.equal(ga4Money(value), '— · currency UNKNOWN');
  for (const value of [null, undefined, '', NaN, Infinity]) assert.equal(ga4Money(value), '—');
});

for (const route of ['/digital','/digital/channels','/digital/audience','/digital/site']) {
  test(`GA4 actual SSR ${route}: money withheld; counts/rates and numeric source values preserved`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('No network in synthetic SSR regression'));
    for (const value of [9876543, 0, null]) {
      // Arbitrary payload labels are not verified provenance and must not enable money.
      const data = fixture(value, {currency:'UAH', property_id:'unverified', account_id:'unverified'});
      const h = history(value);
      const before = structuredClone({data,h});
      const load = moduleLoader({
        'next/link':{default:({children,prefetch,...props})=>React.createElement('a',props,children)},
        '@/components/DashboardSidebar':{DashboardSidebar:()=>null},
        '@/components/DigitalReportShell':{DigitalTabs:()=>null},
        '@/components/DigitalHistoryChart':{DigitalHistoryChart:()=>null},
        '@/components/DigitalTrendChart':{DigitalTrendChart:()=>null},
        '@/lib/digital-reports':{DIGITAL_REPORTS:[]},
        '@/lib/data/digital':{
          loadDigitalData:async range => range?.to < meta.from
            ? normalizeDigital({meta, current:{sessions:50,purchases:1,purchaseRevenue:100}}) : data,
          loadDigitalHistory:async()=>h,
          loadSeoSnapshots:async()=>({landings:data.landingPages,landingPeriod:meta})
        },
        '@/lib/data/digital-sources':{
          loadDigitalLocalData:async()=>normalizeLocal({}),
          loadDigitalAdsData:async()=>normalizeAds({meta:{available:true,rows:1},summary:{cost:10,conversionValue:40}})
        }
      });
      const Page = load(`app${route}/page.tsx`).default;
      const html = renderToStaticMarkup(await Page({searchParams:Promise.resolve({compare:'previous'})}));
      assert.ok(html.includes(GA4_MONEY_NOTICE));
      assert.doesNotMatch(html, /₴|UAH|USD|9876543|9[\s,]876[\s,]543|NaN|Infinity/);
      const money = value === null ? '—' : '— · currency UNKNOWN';
      if (route === '/digital') {
        for (const label of ['Revenue GA4', 'Середній чек GA4']) {
          const card = html.match(new RegExp(`<article class="digital-kpi-card"><span>${label}</span>[\\s\\S]*?</article>`))?.[0];
          assert.ok(card?.includes(`<strong>${money}</strong>`), `${label}: ${card}`);
          assert.match(card, /немає зіставних даних/);
          assert.doesNotMatch(card, /positive|negative|\d+(?:\.\d+)?%/);
        }
        assert.match(html, /Сесії<\/span><strong>100<\/strong>/);
        assert.match(html, /Purchase GA4<\/span><strong>2<\/strong>/);
        assert.match(html, /Конверсія<\/span><strong>2.00%<\/strong>/);
        assert.match(html, /ROAS Ads<\/span><strong>—<\/strong>/);
        assert.match(html, /\+100.0%/, 'nonmonetary period comparisons remain available');
      } else {
        assert.ok(html.includes(`<span>${money}</span>`));
        assert.match(html, /100/);
        assert.match(html, /2.00%/);
        if (route === '/digital/site') {
          assert.ok(html.includes(`2 purchase · ${money}`), 'device block money');
          assert.ok(html.includes(`<b>/synthetic-landing</b><span>100</span><span>2</span><span>2.00%</span><span>${money}</span>`), 'landing revenue cell');
        }
      }
      assert.deepEqual({data,h}, before, 'presentation must never erase or alter source numbers');
      assert.equal(data.current.purchaseRevenue,value);
      assert.equal(data.current.averageOrderValue,value===null?null:value/2);
      for (const rows of [data.channels,data.devices,data.landingPages]) assert.equal(rows[0].purchaseRevenue,value);
      assert.equal(h.monthly[0].revenue,value);
      assert.equal(h.monthly[1].revenue,0);
      assert.equal(h.monthly[2].revenue,null);
    }
  });
}

test('GA4 nonmonetary measured zero/null remain distinct in actual SSR', async () => {
  for (const value of [0,null]) {
    const data=normalizeDigital({meta,current:{sessions:value,purchases:value,purchaseRevenue:value}});
    const load=moduleLoader({
      '@/components/DashboardSidebar':{DashboardSidebar:()=>null},
      '@/components/DigitalReportShell':{DigitalTabs:()=>null},
      '@/lib/data/digital':{loadDigitalData:async()=>data,loadDigitalHistory:async()=>history(value)}
    });
    const html=renderToStaticMarkup(await load('app/digital/audience/page.tsx').default());
    assert.ok(html.includes(`<span>Сесії</span><strong>${value===null?'—':'0'}</strong>`));
  }
});

test('actual GA4 history switches: monthly/YTD money never plots; all count/rate series retain formatters and null gaps', () => {
  const rows=history(9876543).monthly;
  const before=structuredClone(rows);
  for (const metric of ['sessions','purchases','revenue','conversionRate','seoClicks','seoCtr']) {
    for (const mode of ['monthly','ytd']) {
      const captured={};
      const chart=Object.fromEntries(['CartesianGrid','Line','LineChart','ResponsiveContainer','Tooltip','XAxis','YAxis'].map(name=>[name,props=>{
        captured[name]=props;
        return React.createElement('div',null,props.children);
      }]));
      let hook=0,selectedMetric,selectedMode;
      const load=moduleLoader({react:{...React,useMemo:calculate=>calculate(),useState:()=>hook++===0
        ? [metric,key=>{selectedMetric=key;}] : [mode,key=>{selectedMode=key;}]},recharts:chart});
      const {DigitalHistoryChart}=load('components/DigitalHistoryChart.tsx');
      const element=DigitalHistoryChart({rows,currentYear:2026,cutoffMonth:10,cutoffDay:23});
      const html=renderToStaticMarkup(element);
      for (const button of element.props.children[0].props.children[0].props.children) {
        button.props.onClick();
        assert.equal(selectedMetric,button.key);
      }
      for (const [index,button] of element.props.children[0].props.children[1].props.children.entries()) {
        button.props.onClick();
        assert.equal(selectedMode,index===0?'monthly':'ytd');
      }
      if (metric==='revenue') {
        assert.ok(html.includes(GA4_MONEY_NOTICE));
        for (const name of ['ResponsiveContainer','LineChart','Line','YAxis','Tooltip'])
          assert.equal(captured[name],undefined,`${name} must not mount for unverified monetary data (${mode})`);
      } else {
        assert.equal(captured.Line.connectNulls,false);
        const rate=['conversionRate','seoCtr'].includes(metric);
        const first={sessions:100,purchases:2,conversionRate:0.02,seoClicks:10,seoCtr:0.1}[metric];
        assert.equal(captured.LineChart.data[0]['2026'],first);
        assert.equal(captured.LineChart.data[1]['2026'], mode==='ytd'?first:rate?null:0);
        assert.equal(captured.LineChart.data[2]['2026'],null);
        for (const value of [0,null,0.25]) {
          const expected=value===null?'—':rate?`${(value*100).toFixed(2)}%`:Math.round(value).toLocaleString('uk-UA');
          assert.equal(captured.YAxis.tickFormatter(value),expected);
          assert.deepEqual(captured.Tooltip.formatter(value,'2026'),[expected,'2026']);
        }
      }
      assert.doesNotMatch(html,/₴|UAH|USD|9876543/);
      assert.deepEqual(rows,before);
    }
  }
});

test('GA4 routes/history contain no currency guess or monetary delta bypass', () => {
  for (const path of ['app/digital/page.tsx','app/digital/channels/page.tsx','app/digital/audience/page.tsx','app/digital/site/page.tsx','components/DigitalHistoryChart.tsx']) {
    const source=readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
    assert.doesNotMatch(source,/₴|\bUAH\b|currencyEvidence\(/);
    assert.match(source,/GA4_MONEY_NOTICE/);
    assert.doesNotMatch(source,/change=\{delta\(c\.(purchaseRevenue|averageOrderValue)/);
  }
});
