import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader,React,renderToStaticMarkup} from './support/bi-preview-harness.mjs';
const lib=moduleLoader()('lib/dynamics-comparison.ts');
const filters={channel:null,orderType:null,location:null,brand:null,ownership:null,lfl:false};
const expected={latestYear:2026,cutoff:'2026-11-15',grain:'month',metric:'revenue',filters};
function fixture(e=expected){return {contractVersion:lib.COMPARISON_CONTRACT,status:'ready',reason:null,...e,periods:lib.comparisonWindows(e.latestYear,e.grain,e.cutoff).map(w=>({...w,status:'ready',reason:null,current:120,previous:100,delta:lib.periodDelta(120,100,e.metric),unit:e.metric==='markupRate'?'pp':'percent',observedCurrent:120,observedPrevious:100,cohort:{candidateCount:1,includedCount:1,excludedCount:0,registryExcludedCount:0,incompleteCount:0,mode:e.filters.lfl?'pairwise-complete':'all-locations',currentObservedDays:w.currentDays,previousObservedDays:w.previousDays,currentExpectedDays:w.currentDays,previousExpectedDays:w.previousDays,currentCoverage:1,previousCoverage:1}}))};}
function flag(t){const old=process.env.BI_DYNAMICS_PERIOD_COMPARISON_V1;process.env.BI_DYNAMICS_PERIOD_COMPARISON_V1='1';t.after(()=>{if(old===undefined)delete process.env.BI_DYNAMICS_PERIOD_COMPARISON_V1;else process.env.BI_DYNAMICS_PERIOD_COMPARISON_V1=old;});}
test('January compares actual previous December; complete February keeps both full months',()=>{
 const [jan,feb]=lib.comparisonWindows(2026,'month','2026-03-31');
 assert.equal(jan.previousStart,'2025-12-01');assert.equal(jan.previousEnd,'2025-12-31');
 assert.deepEqual([feb.currentDays,feb.previousDays,feb.partial],[28,31,false]);
 const march=lib.comparisonWindows(2026,'month','2026-03-31')[2];
 assert.deepEqual([march.currentEnd,march.previousEnd,march.currentDays,march.previousDays],['2026-03-31','2026-02-28',31,28]);
});
test('partial November uses first15 days; partial March30 clamps both to February28 with disclosure',()=>{
 const nov=lib.comparisonWindows(2026,'month','2026-11-15')[10];
 assert.deepEqual([nov.currentEnd,nov.previousStart,nov.previousEnd,nov.partial],['2026-11-15','2026-10-01','2026-10-15',true]);
 const march=lib.comparisonWindows(2026,'month','2026-03-30')[2];
 assert.deepEqual([march.currentEnd,march.previousEnd,march.clampedDays,march.currentDays,march.previousDays],['2026-03-28','2026-02-28',2,28,28]);
 const leap=lib.comparisonWindows(2024,'month','2024-03-30')[2];assert.equal(leap.clampedDays,1);assert.equal(leap.previousDays,29);
});
test('ISO W01 uses preceding52/53 and correct elapsed weekdays across calendar year',()=>{
 const first=lib.comparisonWindows(2026,'week','2026-01-04')[0];
 assert.deepEqual([first.currentStart,first.currentEnd,first.previousStart,first.previousEnd],['2025-12-29','2026-01-04','2025-12-22','2025-12-28']);
 const next=lib.comparisonWindows(2027,'week','2027-01-10')[0];
 assert.deepEqual([next.previousStart,next.previousEnd],['2026-12-28','2027-01-03']);
 const part=lib.comparisonWindows(2026,'week','2026-01-01')[0];
 assert.deepEqual([part.currentDays,part.previousEnd,part.partial],[4,'2025-12-25',true]);
 assert.equal(lib.comparisonWindows(2026,'week','2027-01-03').length,53);
 assert.throws(()=>lib.comparisonWindows(2026,'month','2026-02-30'));
});
test('zero and markup percentage-point semantics stay distinct',()=>{
 assert.equal(lib.periodDelta(0,100,'revenue'),-100);assert.equal(lib.periodDelta(100,0,'revenue'),null);
 assert.equal(lib.periodDelta(null,100,'checks'),null);assert.equal(lib.periodDelta(60,50,'markupRate'),10);
 assert.equal(lib.periodDelta(10,0,'markupRate'),10);
});
test('valid calendar contract retained; every gap stays explicit without skipping period',()=>{
 const p=fixture();p.periods[1]={...p.periods[1],status:'unavailable',reason:'INCOMPLETE_COVERAGE',current:null,previous:null,delta:null};
 const parsed=lib.validatePeriodComparison(p,expected);assert.ok(parsed);assert.equal(parsed.periods[1].delta,null);assert.equal(parsed.periods[2].previousStart,'2026-02-01');
});
for(const [name,mutate] of [
 ['stale cutoff',p=>p.cutoff='2026-11-14'],['wrong filter',p=>p.filters={...filters,lfl:true}],['skipped calendar month',p=>p.periods.splice(1,1)],
 ['wrong predecessor',p=>p.periods[0].previousStart='2024-12-01'],['fabricated delta',p=>p.periods[1].delta=100],['wrong unit',p=>p.periods[1].unit='pp'],
 ['untrusted cohort',p=>p.periods[1].cohort.includedCount=0],['partial coverage',p=>p.periods[1].cohort.currentCoverage=.8],
 ['contradictory day counts',p=>{p.periods[1].cohort.currentObservedDays=0;p.periods[1].cohort.currentExpectedDays=0;}],['unreconciled exclusions',p=>p.periods[1].cohort.registryExcludedCount=1],
 ['numeric string',p=>p.periods[1].current='120'],['false zero for unavailable',p=>{p.periods[1].status='unavailable';p.periods[1].reason='INCOMPLETE_COVERAGE';p.periods[1].current=0;}]
]) test(`reject comparison contract: ${name}`,()=>{const p=fixture();mutate(p);assert.equal(lib.validatePeriodComparison(p,expected),null);});
test('LFL allows explicitly counted common subset; nonLFL rejects subset',()=>{
 const e={...expected,filters:{...filters,lfl:true}},p=fixture(e);
 for(const row of p.periods){row.cohort.candidateCount=2;row.cohort.excludedCount=1;row.cohort.incompleteCount=1;}
 assert.ok(lib.validatePeriodComparison(p,e));
 p.filters.lfl=false;for(const row of p.periods)row.cohort.mode='all-locations';assert.equal(lib.validatePeriodComparison(p,expected),null);
});
test('adapter sends identical normalized dimensions and rejects failed RPC without legacy data',async t=>{
 flag(t);let args,call=0;
 const q={metric:'revenue',grain:'month',channel:'',location:'Оболонь',lfl:true};const e={...expected,filters:{...filters,location:'Оболонь',lfl:true}};
 const run=moduleLoader({'next/cache':{unstable_cache:fn=>fn},'@/lib/data/source':{callBiRpc:async(name,a)=>{assert.equal(name,'bi_dynamics_period_comparison');args=a;call++;return fixture(e);}}})('lib/data/dynamics-comparison.ts');
 assert.ok(await run.loadDynamicsComparison(q,{latestYear:2026,cutoff:e.cutoff}));assert.equal(args.p_channel,null);assert.equal(args.p_location,'Оболонь');assert.equal(args.p_lfl,true);assert.equal(call,1);
 assert.equal(await run.loadDynamicsComparison(q,{latestYear:2026,cutoff:'2026-11-14'}),null);
 const unavailable=moduleLoader({'next/cache':{unstable_cache:fn=>fn},'@/lib/data/source':{callBiRpc:async()=>{throw Error('fixture missing RPC');}}})('lib/data/dynamics-comparison.ts');
 assert.equal(await unavailable.loadDynamicsComparison(q,{latestYear:2026,cutoff:e.cutoff}),null);
});
function pageHarness(comparison,e=expected){
 const months=['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
 const series=months.map(label=>({label,'2025':100,'2026':120}));
 return moduleLoader({'next/link':{default:({children,...props})=>React.createElement('a',props,children)},'lucide-react':{Filter:()=>null},'@/components/DashboardSidebar':{DashboardSidebar:()=>null},'@/components/MultiYearMetricChart':{MultiYearMetricChart:()=>null},'@/lib/data/dynamics':{loadDynamicsData:async()=>({source:'supabase-sql',rowCount:99,years:[2025,2026],series,channels:[],orderTypes:[],locations:[],brands:[],ownerships:[],latestYear:2026,previousYear:2025,latestSourceDate:e.cutoff,latestYearTotal:120,previousYearTotal:100,totalGrowth:e.metric==='markupRate'?20:20})},'@/lib/data/dynamics-comparison':{loadDynamicsComparison:async()=>comparison}});
}
test('actual pivot keeps YoY, one2026 MoM column and accessible comparison basis',async t=>{
 flag(t);const p=fixture();const html=renderToStaticMarkup(await pageHarness(p)('app/dynamics/page.tsx').default({searchParams:Promise.resolve({})}));
 assert.match(html,/MoM 2026/);assert.doesNotMatch(html,/MoM 2025/);assert.match(html,/YoY/);assert.match(html,/2025-12-01 → 2025-12-31/);assert.match(html,/Показати базу порівняння/);assert.match(html,/dynamics-table-wrap/);
 const unavailable=renderToStaticMarkup(await pageHarness(null)('app/dynamics/page.tsx').default({searchParams:Promise.resolve({})}));
 assert.match(unavailable,/MoM\/WoW недоступне/);assert.match(unavailable,/₴120/);
});
test('markup YoY and MoM both use percentage points rather than relative percentage',async t=>{
 flag(t);const e={...expected,metric:'markupRate'};const html=renderToStaticMarkup(await pageHarness(fixture(e),e)('app/dynamics/page.tsx').default({searchParams:Promise.resolve({metric:'markupRate'})}));
 assert.match(html,/\+20\.0 п\.п\./);assert.doesNotMatch(html,/\+20\.0%/);
});

test('confirmed zero-day disclosure is validated and does not change numeric totals',()=>{
 const p=fixture();p.periods[9].cohort.previousConfirmedZeroDays=2;p.periods[9].cohort.currentConfirmedZeroDays=0;
 assert.ok(lib.validatePeriodComparison(p,expected));
 const Cell=moduleLoader()('components/DynamicsComparisonCell.tsx').DynamicsComparisonCell;
 const html=renderToStaticMarkup(React.createElement(Cell,{period:p.periods[9],metric:'revenue',label:'MoM'}));
 assert.match(html,/Підтверджений простій із нульовими продажами/);assert.match(html,/0 \/ 2 точко-днів/);
 for(const bad of [-1,1.5,1000,'2']){p.periods[9].cohort.previousConfirmedZeroDays=bad;assert.equal(lib.validatePeriodComparison(p,expected),null);}
});
