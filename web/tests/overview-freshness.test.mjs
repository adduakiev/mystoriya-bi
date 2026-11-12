import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader, rpcFixture, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const load = moduleLoader();
const {warehouseObservation, reportObservation, reportFreshness} = load('lib/overview-freshness.ts');
const {pollOverviewStatus, STATUS_DELAYS} = load('lib/overview-poll.ts');
const status = date => ({source:'supabase', status:'success', cutoffDate:date, lastSuccessfulSync:`${date}T12:00:00Z`});
const nov1 = warehouseObservation(status('2026-11-01'));
const nov10 = warehouseObservation(status('2026-11-10'));
const query = {year:2026, month:11, period:'month', compare:'ly', metric:'revenue', grain:'month', lfl:false};
const totals = {revenue:4917182.81, checks:6332, markup:3115226.29,
  averageCheck:4917182.81/6332, markupRate:3115226.29/4917182.81*100};

// Supplied owner SELECT totals as a synthetic RPC boundary, not a new SQL read.
function overviewHarness() {
  let warehouse = nov1;
  let rpcFails = false;
  const keys = [], calls = [], cache = new Map();
  const stale = {...totals, revenue:524806.88, checks:680, markup:324575.82};
  const loader = moduleLoader({
    'next/cache': {unstable_cache: (fn, key, options) => async () => {
      assert.equal(options.revalidate,180);
      keys.push(key);
      const id = JSON.stringify(key);
      // Retained cached payload models failed background revalidation.
      if (!cache.has(id)) cache.set(id, await fn());
      return cache.get(id);
    }},
    'next/link': {default:({prefetch,children,...props})=>React.createElement('a',props,children)},
    '@/components/DashboardSidebar': {DashboardSidebar:()=>null},
    '@/components/MultiYearMetricChart': {MultiYearMetricChart:()=>null},
    '@/components/ChannelMixChart': {ChannelMixChart:()=>null},
    '@/lib/data/source': {
      loadSalesDataStatus: async () => status(warehouse.cutoff),
      callBiRpc: async (name,args) => {
        calls.push({name,args});
        if (rpcFails) throw Error('SYNTHETIC RPC timeout');
        const payload = rpcFixture(name,args);
        Object.assign(payload.meta, {latestSourceDate:warehouse.cutoff, cutoffDate:warehouse.cutoff,
          sourceRowCount:271, filteredRowCount:271, availableMonths:[11]});
        payload.current = warehouse.cutoff === nov1.cutoff ? stale : totals;
        return payload;
      },
      loadSalesData: async () => [{date:'2026-11-01', location:'Synthetic',brand:'Synthetic',ownership:'Synthetic',
        channelGroup:'Заклад',orderType:'Synthetic',...stale}]
    }
  });
  return {loader, calls, keys, setWarehouse: value => {warehouse = value;}, failRpc: () => {rpcFails = true;},
    data: version => loader('lib/data/overview.ts').loadOverviewData(query,version),
    html: async () => renderToStaticMarkup(await loader('app/page.tsx').default({searchParams:Promise.resolve({year:'2026',month:'11'})}))};
}

test('Nov1 cached report is stale against Nov10; server watermark fetches exact unfiltered Nov1–10 totals',async t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('No network authorized'));
  const h = overviewHarness();
  const old = await h.data(nov1.version);
  h.setWarehouse(nov10);
  assert.equal(reportFreshness(reportObservation(old,query),nov10),'stale');
  assert.equal((await h.data(nov1.version)).snapshot.current.revenue,524806.88,'reproduces old cache hit');
  const updated = await h.data(nov10.version);
  assert.deepEqual(updated.snapshot.current,totals);
  assert.equal(updated.snapshot.cutoffDate,'2026-11-10');
  assert.equal(reportFreshness(reportObservation(updated,query),nov10),'aligned');
  assert.equal(h.calls.length,2);
  assert.equal(h.calls[1].args.p_focus_year,2026);
  assert.equal(h.calls[1].args.p_focus_month,11);
  for (const key of ['p_channel','p_location','p_brand','p_ownership','p_order_type']) assert.equal(h.calls[1].args[key],null);
  assert.equal(h.calls[1].args.p_lfl,false);
  assert.notDeepEqual(h.keys[0],h.keys.at(-1));
  const html = await h.html();
  assert.match(html,/data-report-freshness="aligned"/);
  assert.match(html,/cutoff звіту: 2026-11-10/);
  assert.match(html,/6.?332/);
  assert.match(html,/4\.9M/);
  assert.match(html,/3\.1M/);
  assert.doesNotMatch(html,/524\.8K|324\.6K|Sync OK|BUSINESS PERFORMANCE · LIVE/);
});

test('failed new-version RPC exposes legacy fallback with stale dates, never a current release claim',async()=>{
  const h = overviewHarness();
  await h.data(nov1.version);
  h.setWarehouse(nov10);
  h.failRpc();
  const html = await h.html();
  assert.match(html,/FALLBACK \/ UNVERIFIED/);
  assert.match(html,/data-report-freshness="stale"/);
  assert.match(html,/Warehouse: 2026-11-10/);
  assert.match(html,/cutoff звіту: 2026-11-01/);
  assert.doesNotMatch(html,/Sync OK|BUSINESS PERFORMANCE · LIVE/);
});

test('matching global dates permit legitimate historical month, dimension and LFL cutoffs without comparing totals',()=>{
  const base = {sql:true,latest:'2026-11-10',cutoff:'2026-11-01',year:2026,month:11,segmented:false,payloadValid:true};
  assert.equal(reportFreshness(base,nov10),'stale');
  assert.equal(reportFreshness({...base,segmented:true},nov10),'scoped');
  assert.equal(reportFreshness({...base,month:10,cutoff:'2026-10-31'},nov10),'scoped');
  assert.equal(reportFreshness({...base,year:2025,cutoff:'2025-11-30'},nov10),'scoped');
  assert.equal(reportFreshness({...base,segmented:true,latest:'2026-11-01'},nov10),'stale');
  for (const value of [null,'','2026-02-30']) assert.equal(warehouseObservation({...status(value)}).cutoff,null);
  assert.equal(reportFreshness({...base,cutoff:'2026-11-10',payloadValid:false},nov10),'unknown');
  assert.equal(reportFreshness({...base,cutoff:'2026-11-10',sql:false},nov10),'unknown');
});

function clock() {
  let now=0, serial=0;
  const pending=new Map();
  return {get now(){return now;}, pending,
    schedule(fn,delay){const id=++serial;pending.set(id,{fn,at:now+delay});return id;},
    cancel(id){pending.delete(id);},
    async next(){const [id,item]=[...pending].sort((a,b)=>a[1].at-b[1].at)[0]??[];
      assert.ok(item,'Expected pending timer');pending.delete(id);now=item.at;await item.fn();}
  };
}

test('first failed GET does not abort polling; later warehouse success recovers with finite serial GET-only reads',async()=>{
  const time=clock(), calls=[], received=[], errors=[], exhausted=[];
  const stop=pollOverviewStatus({schedule:time.schedule,cancel:time.cancel,
    fetcher:async(url,options)=>{calls.push({url,...options});return calls.length===1
      ? new Response('{}',{status:500}) : Response.json(nov10);},
    receive:v=>received.push(v),failed:()=>errors.push(true),exhausted:()=>exhausted.push(true)});
  for(let i=0;i<STATUS_DELAYS.length;i++) await time.next();
  assert.equal(calls.length,7);
  assert.equal(errors.length,1);
  assert.deepEqual(received[0],nov10);
  assert.equal(exhausted.length,1);
  assert.equal(time.pending.size,0);
  assert.equal(time.now,230000);
  for(const call of calls){assert.equal(call.method,'GET');assert.equal(call.url,'/api/overview/status');
    assert.equal(call.cache,'no-store');assert.equal(call.redirect,'error');}
  stop();
});

test('poll cleanup aborts pending request; timeout and malformed/login responses cannot become success',async()=>{
  const time=clock();let errors=0,success=0,signal;
  const stop=pollOverviewStatus({schedule:time.schedule,cancel:time.cancel,
    fetcher:(_url,options)=>new Promise((resolve,reject)=>{
      signal=options.signal;signal.addEventListener('abort',()=>reject(Error('aborted')));
    }),receive:()=>success++,failed:()=>errors++,exhausted:()=>{}});
  // Start the pending fetch without awaiting it, then expire its deadline.
  const request=time.next();await time.next();await request;
  assert.equal(signal.aborted,true);assert.equal(errors,1);assert.equal(success,0);
  stop();assert.equal(time.pending.size,0);
  for(const response of [Response.json({cutoff:'2026-02-30',version:'x'}), new Response('<html>login</html>')]){
    const time=clock();const stop=pollOverviewStatus({schedule:time.schedule,cancel:time.cancel,fetcher:async()=>response,
      receive:()=>assert.fail('Invalid response'),failed:()=>errors++,exhausted:()=>{}});
    await time.next();stop();assert.equal(time.pending.size,0);
  }
  assert.equal(errors,3);
});

// Exercise actual client component state/effects, without a browser or network.
function clientHarness(report,warehouse,{failFirst=false}={}) {
  const time=clock(), hooks=[], effects=[];let cursor=0, refreshes=0, reads=0;
  const hookReact={...React,
    useState(initial){const slot=cursor++;if(!(slot in hooks))hooks[slot]=initial;
      return [hooks[slot],value=>{hooks[slot]=typeof value==='function'?value(hooks[slot]):value;}];},
    useRef(initial){const slot=cursor++;return hooks[slot]??(hooks[slot]={current:initial});},
    useEffect(fn,deps){const slot=cursor++;if(!hooks[slot]||deps.some((v,i)=>v!==hooks[slot][i])){
      hooks[slot]=deps;effects.push(fn);}}
  };
  const loader=moduleLoader({react:hookReact,
    Date:class extends Date{static now(){return time.now;}},
    'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},
    '@/lib/overview-poll':{pollOverviewStatus:callbacks=>pollOverviewStatus({...callbacks,
      schedule:time.schedule,cancel:time.cancel,fetcher:async()=>{
        reads++;return failFirst&&reads===1?new Response('{}',{status:500}):Response.json(nov10);
      }})}
  });
  const Component=loader('components/OverviewFreshness.tsx').OverviewFreshness;
  return {time,get refreshes(){return refreshes;},get reads(){return reads;},effects,
    retry(){cursor=0;const tree=Component({report,warehouse});
      const button=React.Children.toArray(tree.props.children).find(child=>child?.type==='button');
      assert.equal(button.props.disabled,false);button.props.onClick();},
    render(nextReport=report,nextWarehouse=warehouse){cursor=0;
      return renderToStaticMarkup(Component({report:nextReport,warehouse:nextWarehouse}));},
    mount(){return effects.shift()();}
  };
}

test('actual client keeps stale warning through background revalidate timeout; refreshed coherent payload clears it',async()=>{
  const old={sql:true,latest:'2026-11-01',cutoff:'2026-11-01',year:2026,month:11,segmented:false,payloadValid:true};
  const h=clientHarness(old,nov1,{failFirst:true});
  h.render();const stop=h.mount();
  await h.time.next();
  assert.match(h.render(),/data-report-freshness="unknown"/);
  assert.equal(h.refreshes,0);
  await h.time.next();
  assert.match(h.render(),/data-report-freshness="stale"/);
  assert.equal(h.refreshes,1);
  // Failed revalidation retains old payload, even with new server metadata.
  assert.match(h.render(old,nov10),/data-report-freshness="stale"/);
  for(let i=2;i<STATUS_DELAYS.length;i++) {await h.time.next();h.render(old,nov10);}
  assert.equal(h.reads,7);
  assert.ok(h.refreshes<=4,'Refresh throttle');
  assert.equal(h.effects.length,0,'Router refresh must not reset read budget');
  assert.match(h.render(old,nov10),/Автоматичну перевірку завершено/);
  const html=h.render({...old,latest:'2026-11-10',cutoff:'2026-11-10'},nov10);
  assert.match(html,/data-report-freshness="aligned"/);
  assert.doesNotMatch(html,/data-report-freshness="stale"|Sync OK|READY FOR RELEASE/);
  stop();
});

test('explicit retry after transient error starts another finite GET budget without import POST',async()=>{
  const report={sql:true,latest:'2026-11-01',cutoff:'2026-11-01',year:2026,month:11,segmented:false,payloadValid:true};
  const h=clientHarness(report,nov1,{failFirst:true});
  h.render();const stop=h.mount();await h.time.next();h.render();
  h.retry();stop();h.render();const stopRetry=h.mount();
  await h.time.next();
  assert.match(h.render(),/data-report-freshness="stale"/);
  assert.equal(h.reads,2);assert.equal(h.refreshes,1,'Manual retry does not double-refresh on immediate GET');
  stopRetry();assert.equal(h.time.pending.size,0);
});

test('new metadata GET authenticates before reads, ignores client cache keys, and never invalidates or imports',async t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('No network in fixture'));
  const original = process.env.BI_ACCESS_PASSWORD;
  process.env.BI_ACCESS_PASSWORD = 'synthetic-test-only';
  t.after(() => {if (original === undefined) delete process.env.BI_ACCESS_PASSWORD;
    else process.env.BI_ACCESS_PASSWORD = original;});
  let reads=0;
  const loader=moduleLoader({
    '@/lib/auth':{AUTH_COOKIE_NAME:'fixture',createAccessToken:async()=> 'synthetic-token',safeEqual:(a,b)=>a===b},
    '@/lib/data/source':{loadSalesDataStatus:async()=>{reads++;return status('2026-11-10');}}
  });
  const route=loader('app/api/overview/status/route.ts');
  const request=token=>({cookies:{get:()=>({value:token})},nextUrl:{searchParams:new URLSearchParams('invalidate=true&version=evil')}});
  assert.equal((await route.GET(request('wrong'))).status,401);assert.equal(reads,0);
  const response=await route.GET(request('synthetic-token'));
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),nov10);assert.equal(reads,1);
  assert.deepEqual(Object.keys(route).sort(),['GET','dynamic']);
  delete process.env.BI_ACCESS_PASSWORD;
  assert.equal((await route.GET(request('synthetic-token'))).status,503);
  assert.equal(reads,1);
});
