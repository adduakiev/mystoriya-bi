import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const query = {metric:'revenue', grain:'month', location:'Теремки', brand:'МитБАР', lfl:false};

function harness(payload, {rpcError=false, legacyRows}={}) {
  let fallbackCalls = 0;
  const chartCalls = [];
  const load = moduleLoader({
    'next/cache': {unstable_cache: fn => fn},
    'next/link': {default: ({prefetch, children, ...props}) => React.createElement('a',props,children)},
    'lucide-react': {Filter: () => null},
    '@/components/DashboardSidebar': {
      DashboardSidebar: ({statusTitle,statusDetail}) => React.createElement('aside',null,statusTitle,' ',statusDetail)
    },
    '@/components/MultiYearMetricChart': {MultiYearMetricChart: props => {chartCalls.push(props); return null;}},
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
  return {load, chartCalls, getFallbackCalls:()=>fallbackCalls};
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

test('Dynamics monthly SQL zeros after source cutoff render UNKNOWN, while real zero and prior year stay measured', async () => {
  const labels=['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
  const series=labels.map((label,i)=>({label, '2025':i===10?110:i===11?120:22,
    '2026':i<10?(i===0?0:50):0}));
  series[6]['2025']=null;
  series[7]['2025']='not-a-number';
  series[8]['2025']='';
  const payload={meta:{rowCount:851,years:[2025,2026],latestYear:2026,previousYear:2025,
    latestSourceDate:'2026-10-26',channels:[],orderTypes:[],locations:[],brands:[],ownerships:[]},
    series,summary:{latestYearTotal:500,previousYearTotal:250,growth:100}};
  const h=harness(payload);
  const data=await h.load('lib/data/dynamics.ts').loadDynamicsData(query);
  assert.equal(data.source,'supabase-sql');
  assert.equal(data.series[0]['2026'],0, 'observed zero survives');
  assert.equal(data.series[9]['2026'],50, 'latest partial month stays observed, not zeroed');
  assert.equal(data.series[10]['2026'],null, 'November beyond 26 October is unknown');
  assert.equal(data.series[11]['2026'],null, 'December beyond 26 October is unknown');
  assert.equal(data.series[10]['2025'],110, 'prior November is observed');
  for(const i of [6,7,8]) assert.equal(data.series[i]['2025'],null, 'missing/invalid is not zero');
  const html=renderToStaticMarkup(await h.load('app/dynamics/page.tsx').default({
    searchParams:Promise.resolve({location:'Теремки',brand:'МитБАР'})}));
  const november=html.slice(html.indexOf('Лис</a>'),html.indexOf('Гру</a>'));
  assert.ok(november.startsWith('Лис</a>'), 'expected actual November row in SSR');
  assert.match(november, /₴110/);
  assert.match(november, /<span>—<\/span>/, 'unknown current month shown as dash');
  assert.doesNotMatch(november, /₴0|-100\.0%/, 'no false zero or false -100% YoY');
  assert.equal(h.chartCalls[0].data[10]['2026'],null, 'chart receives a gap, not fabricated zero');
  assert.equal(h.getFallbackCalls(),0);
});


test('Dynamics observation counts distinguish interior UNKNOWN from measured zero through SSR and chart',async()=>{
  const labels=['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
  const series=labels.map((label,i)=>({label,'2025':i===2?34790.8:i===7?0:25,
    '2026':i===2?0:i===7?30:50}));
  const counts=labels.map((_,i)=>({month:i+1,counts:{'2025':i===5?0:i===7?2:1,
    '2026':i===2||i>=10?0:1}}));
  const payload={meta:{rowCount:337,years:[2025,2026],latestYear:2026,previousYear:2025,
    latestSourceDate:'2026-10-26',channels:[],orderTypes:[],locations:[],brands:[],ownerships:[]},
    series,seriesObservationCounts:counts,
    summary:{latestYearTotal:500,previousYearTotal:250,growth:100}};
  const h=harness(payload);
  const data=await h.load('lib/data/dynamics.ts').loadDynamicsData(query);
  assert.equal(data.source,'supabase-sql');
  assert.equal(data.series[2]['2026'],null,'interior March SQL 0 has no observations');
  assert.equal(data.series[5]['2025'],null,'historical June missing is not measured zero');
  assert.equal(data.series[7]['2025'],0,'August measured zero with two observations survives');
  assert.equal(data.series[2]['2025'],34790.8);
  assert.equal(data.series[7]['2026'],30);
  const html=renderToStaticMarkup(await h.load('app/dynamics/page.tsx').default({
    searchParams:Promise.resolve({location:'Теремки',brand:'МитБАР'})}));
  const march=html.slice(html.indexOf('Бер</a>'),html.indexOf('Кві</a>'));
  assert.ok(march.startsWith('Бер</a>'),'expected real March SSR row');
  assert.ok(march.includes('₴34'),'prior-year positive sale preserved');
  assert.match(march,/<span>—<\/span>/,'unobserved month rendered UNKNOWN');
  assert.doesNotMatch(march,/₴0|-100\.0%/,'no fabricated zero or false -100% YoY');
  assert.equal(h.chartCalls[0].data[2]['2026'],null,'chart receives an actual gap');
  assert.equal(h.getFallbackCalls(),0);
});

for (const [name,mutate] of [
  ['missing month',c=>{delete c[0].month;}],
  ['duplicate month',c=>{c[1].month=1;}],
  ['missing year',c=>{delete c[2].counts['2026'];}],
  ['extra year',c=>{c[2].counts['2024']=1;}],
  ['negative count',c=>{c[2].counts['2026']=-1;}],
  ['fractional count',c=>{c[2].counts['2026']=1.5;}],
  ['nonnumeric count',c=>{c[2].counts['2026']='unknown';}]
]) {
  test('Dynamics malformed observation metadata ('+name+') fails closed without fallback',async()=>{
    const labels=['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
    const counts=labels.map((_,i)=>({month:i+1,counts:{'2025':1,'2026':1}}));
    mutate(counts);
    const payload={meta:{rowCount:1,years:[2025,2026],latestYear:2026,latestSourceDate:'2026-10-26'},
      series:labels.map(label=>({label,'2025':10,'2026':20})),seriesObservationCounts:counts,
      summary:{latestYearTotal:200,previousYearTotal:100,growth:100}};
    const h=harness(payload);
    assert.equal((await h.load('lib/data/dynamics.ts').loadDynamicsData(query)).source,'unavailable');
    assert.equal(h.getFallbackCalls(),0);
  });
}
