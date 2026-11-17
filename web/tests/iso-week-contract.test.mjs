import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader,rpcFixture} from './support/bi-preview-harness.mjs';

function flag(t,value='1'){
  const old=process.env.BI_ISO_WEEKS_V1;process.env.BI_ISO_WEEKS_V1=value;
  t.after(()=>{if(old===undefined)delete process.env.BI_ISO_WEEKS_V1;else process.env.BI_ISO_WEEKS_V1=old;});
}
const meta=()=>({weeklyContract:'iso-year-week-elapsed-days-v1',weeklyYears:[2025,2026],weeklyCutoff:'2026-01-01',weeklyCalendarPartial:true});
const series=()=>[{label:'W01',2025:null,2026:0}];

test('weekly contract preserves missing vs measured zero and separates ISO years from calendar navigation',t=>{
  flag(t);const {readIsoWeeklyReport,isoWeekParts}=moduleLoader()('lib/iso-week-contract.ts');
  const report=readIsoWeeklyReport({...meta(),years:[2024,2025,2026]},series());
  assert.deepEqual(report.years,[2025,2026]);
  assert.equal(report.series[0]['2025'],null);assert.equal(report.series[0]['2026'],0);
  assert.deepEqual(isoWeekParts(new Date('2021-01-01T00:00:00Z')),{year:2020,week:53});
  assert.equal(report.partial,true);
});

for(const failure of ['gate-off','old-server','wrong-years','invalid-date','partial-mismatch','wrong-label','missing-key','invalid-value']){
  test(`weekly contract rejects ${failure}`,t=>{
    flag(t,failure==='gate-off'?'0':'1');const m=meta(),s=series();
    if(failure==='old-server')delete m.weeklyContract;
    if(failure==='wrong-years')m.weeklyYears=[2024,2025];
    if(failure==='invalid-date')m.weeklyCutoff='2026-02-30';
    if(failure==='partial-mismatch')m.weeklyCalendarPartial=false;
    if(failure==='wrong-label')s[0].label='W02';
    if(failure==='missing-key')delete s[0]['2025'];
    if(failure==='invalid-value')s[0]['2025']='';
    assert.throws(()=>moduleLoader()('lib/iso-week-contract.ts').readIsoWeeklyReport(m,s),/ISO_WEEK_CONTRACT_UNAVAILABLE/);
  });
}
test('W53 cannot manufacture a zero for an ISO year with only 52 weeks',t=>{
  flag(t);const m={...meta(),weeklyYears:[2019,2020],weeklyCutoff:'2021-01-01'};
  const s=Array.from({length:53},(_,i)=>({label:`W${String(i+1).padStart(2,'0')}`,2019:null,2020:null}));
  s[52]['2020']=300;
  const {readIsoWeeklyReport}=moduleLoader()('lib/iso-week-contract.ts');
  assert.equal(readIsoWeeklyReport(m,s).series[52]['2019'],null);
  s[52]['2019']=0;
  assert.throws(()=>readIsoWeeklyReport(m,s),/ISO_WEEK_CONTRACT_UNAVAILABLE/);
});

for(const name of ['overview','delivery','dynamics']){
  for(const valid of [true,false]){
    test(`${name} weekly adapter ${valid?'keeps nulls and ISO years':'rejects legacy SQL without fallback'}`,async t=>{
      flag(t);t.mock.method(globalThis,'fetch',()=>assert.fail('synthetic test must not reach network'));
      const load=moduleLoader({
        'next/cache':{unstable_cache:fn=>fn},
        '@/lib/data/source':{loadSalesData:()=>assert.fail('weekly fallback forbidden'),callBiRpc:async(rpc,args)=>{
          const p=rpcFixture(rpc,args);
          p.meta={...p.meta,...meta(),cutoffDate:'2026-01-01',latestSourceDate:'2026-01-01'};
          if(!valid)delete p.meta.weeklyContract;
          p.multiYearData=series();p.series=series();
          p.summary={latestYearTotal:0,previousYearTotal:null,growth:null};
          return p;
        }}
      });
      const fn=load(`lib/data/${name}.ts`)[`load${name[0].toUpperCase()+name.slice(1)}Data`];
      const pending=fn({year:2026,period:'ytd',compare:'ly',metric:'revenue',grain:'week',lfl:false});
      if(!valid){await assert.rejects(pending,/ISO_WEEK_CONTRACT_UNAVAILABLE/);return;}
      const result=await pending;
      assert.deepEqual(result.weekly.years,[2025,2026]);
      assert.equal(result.weekly.series[0]['2025'],null);
      const points=name==='dynamics'?result.series:result.multiYearData;
      assert.equal(points[0]['2025'],null);assert.equal(points[0]['2026'],0);
      if(name==='dynamics')assert.equal(result.previousYearTotal,null);
    });
  }
}
