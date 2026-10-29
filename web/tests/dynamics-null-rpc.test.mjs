import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const query = {metric:'revenue', grain:'month', location:'Теремки', brand:'МитБАР', lfl:false};

function harness(payload, {rpcError=false, legacyRows}={}) {
  let fallbackCalls = 0;
  const load = moduleLoader({
    'next/cache': {unstable_cache: fn => fn},
    'next/link': {default: ({prefetch, children, ...props}) => React.createElement('a',props,children)},
    'lucide-react': {Filter: () => null},
    '@/components/DashboardSidebar': {
      DashboardSidebar: ({statusTitle,statusDetail}) => React.createElement('aside',null,statusTitle,' ',statusDetail)
    },
    '@/components/MultiYearMetricChart': {MultiYearMetricChart: () => null},
    '@/lib/data/source': {
      callBiRpc: async (name,args) => {
        assert.equal(name,'bi_dynamics_payload');
        assert.equal(args.p_location,'Теремки');
        assert.equal(args.p_brand,'МитБАР');
        if (rpcError) throw Error('Synthetic transport failure');
        return payload;
      },
      loadSalesData: async () => {
        fallbackCalls++;
        if (!legacyRows) assert.fail('Null/malformed RPC must not fall back to Google Sheets');
        return legacyRows;
      }
    }
  });
  return {load, getFallbackCalls:()=>fallbackCalls};
}

for (const [name,payload] of [
  ['null',null],
  ['malformed object',{meta:{years:[]},series:[]}],
  ['undefined',undefined]
]) {
  test('Dynamics '+name+' RPC fails closed, not zero/LIVE/legacy', async t => {
    t.mock.method(console,'error',()=>{});
    const h=harness(payload);
    const data=await h.load('lib/data/dynamics.ts').loadDynamicsData(query);
    assert.equal(data.source,'unavailable');
    assert.equal(data.totalGrowth,null);
    assert.equal(h.getFallbackCalls(),0);
    const html=renderToStaticMarkup(await h.load('app/dynamics/page.tsx').default({
      searchParams:Promise.resolve({location:'Теремки',brand:'МитБАР'})
    }));
    assert.match(html,/Немає підтверджених даних для вибраних фільтрів/);
    assert.match(html,/SQL RPC не повернув перевіреного набору/);
    assert.match(html,/href="\/dynamics"/);
    assert.doesNotMatch(html,/Live data connected|₴0|Резервне джерело · не звірено/);
    assert.equal(h.getFallbackCalls(),0);
  });
}

test('Dynamics valid structured RPC response remains SQL-first',async()=>{
  const payload={meta:{rowCount:2,years:[2025],latestYear:2025,latestSourceDate:'2025-01-01',
    channels:[],orderTypes:[],locations:[],brands:[],ownerships:[]},
    series:[{label:'Січ','2025':100}],summary:{latestYearTotal:100,previousYearTotal:0,growth:null}};
  const h=harness(payload);
  const data=await h.load('lib/data/dynamics.ts').loadDynamicsData(query);
  assert.equal(data.source,'supabase-sql');
  assert.equal(data.latestYearTotal,100);
  assert.equal(h.getFallbackCalls(),0);
});

test('Dynamics genuine transport error remains explicitly unverified legacy',async t=>{
  t.mock.method(console,'error',()=>{});
  const row={date:'2025-01-01',location:'Теремки',brand:'МитБАР',ownership:'fixture',
    channelGroup:'Заклад',orderType:'fixture',revenue:100,checks:1,markup:20};
  const h=harness(null,{rpcError:true,legacyRows:[row]});
  const html=renderToStaticMarkup(await h.load('app/dynamics/page.tsx').default({
    searchParams:Promise.resolve({location:'Теремки',brand:'МитБАР'})
  }));
  assert.match(html,/Резервне джерело · не звірено/);
  assert.doesNotMatch(html,/Live data connected/);
  assert.equal(h.getFallbackCalls(),1);
});
