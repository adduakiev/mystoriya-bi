import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const filters={year:2026,month:11,brand:'Мʼясторія',ownership:'Власний',location:'A & B',orderType:'Glovo'};
function featureFlag(t,value){
  const previous=process.env.BI_AGGREGATORS_FILTERS_V3;
  process.env.BI_AGGREGATORS_FILTERS_V3=value;
  t.after(()=>{if(previous===undefined)delete process.env.BI_AGGREGATORS_FILTERS_V3;else process.env.BI_AGGREGATORS_FILTERS_V3=previous;});
}
const payload=()=>({
  meta:{contractVersion:'aggregators-filters-v3',requestedFilters:{...filters,lfl:true},
    period:'month',comparison:'ly',cutoffDate:'2026-11-15',rowCount:10,currentYear:2026,previousYear:2025,
    filterOptions:{years:[2025,2026],brands:['Мʼясторія'],ownerships:['Власний'],locations:['A & B'],orderTypes:['Glovo']}},
  current:{revenue:200,checks:2,markup:50,averageCheck:100,markupRate:25},
  previous:{revenue:100,checks:1,markup:20,averageCheck:100,markupRate:20},
  aggregators:[],locations:[],trend:[]
});

test('filtered RPC passes every dimension and preserves full period/comparison context',async t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('no network'));
  featureFlag(t,'1');
  let call;
  const load=moduleLoader({
    'next/cache':{unstable_cache:fn=>fn},
    '@/lib/data/source':{callBiRpc:async(name,args)=>{call={name,args};return payload();},loadSalesData:()=>assert.fail('no fallback')}
  });
  const result=await load('lib/data/aggregators.ts').loadAggregatorsData('month','ly',true,filters);
  assert.equal(result.source,'supabase-sql');
  assert.equal(result.snapshot.current.revenue,200);
  assert.deepEqual(call,{name:'bi_aggregators_payload_v3',args:{p_period:'month',p_comparison:'ly',p_lfl:true,p_year:2026,p_month:11,p_brand:'Мʼясторія',p_ownership:'Власний',p_location:'A & B',p_order_type:'Glovo'}});
  const href=load('lib/aggregator-filters.ts').aggregatorHref({...filters,period:'month',compare:'ly',lfl:true},{compare:'previous'});
  const query=new URL(href,'https://fixture.invalid').searchParams;
  assert.equal(query.get('location'),'A & B');
  assert.equal(query.get('brand'),'Мʼясторія');
  assert.equal(query.get('month'),'11');
  assert.equal(query.get('compare'),'previous');
});

for(const failure of ['not-installed','old-contract','wrong-dimension','wrong-period','invalid-date','missing-metrics','missing-catalog','disabled']){
  test(`filtered request fails closed on ${failure}`,async t=>{
    featureFlag(t,failure==='disabled'?'0':'1');
    let called=false;
    const load=moduleLoader({
      'next/cache':{unstable_cache:fn=>fn},
      '@/lib/data/source':{loadSalesData:()=>assert.fail('filtered data must never use legacy/CSV'),callBiRpc:async()=>{
        called=true;if(failure==='not-installed')throw new Error('not installed');
        const p=payload();
        if(failure==='old-contract')delete p.meta.contractVersion;
        if(failure==='wrong-dimension')p.meta.requestedFilters.location='Other';
        if(failure==='wrong-period')p.meta.cutoffDate='2026-10-15';
        if(failure==='invalid-date')p.meta.cutoffDate='2026-11-31';
        if(failure==='missing-metrics')delete p.current;
        if(failure==='missing-catalog')delete p.meta.filterOptions;
        return p;
      }}
    });
    const result=await load('lib/data/aggregators.ts').loadAggregatorsData('month','ly',true,filters);
    assert.equal(result.source,'unavailable');assert.equal(result.snapshot,null);
    assert.equal(called,failure!=='disabled');
  });
}

test('unavailable filtered report hides KPIs and offers reset',async()=>{
  const load=moduleLoader({
    'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
    '@/components/DashboardSidebar':{DashboardSidebar:()=>null},
    '@/components/KpiCard':{KpiCard:()=>assert.fail('must not render stale KPIs')},
    '@/components/RevenueChart':{RevenueChart:()=>assert.fail('must not render stale chart')},
    '@/lib/data/aggregators':{loadAggregatorsData:async()=>({source:'unavailable',snapshot:null,aggregators:[],rowCount:0})}
  });
  const html=renderToStaticMarkup(await load('app/aggregators/page.tsx').default({searchParams:Promise.resolve({year:'2026',month:'11'})}));
  assert.match(html,/Обраний зріз поки недоступний/);
  assert.match(html,/href="\/aggregators"/);
  assert.doesNotMatch(html,/Позитивна динаміка|0 SQL rows/);
});
