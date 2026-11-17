import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader} from './support/bi-preview-harness.mjs';

const {glovoMonthAxis,aggregateMonthly,aggregateMonthlyRange,compareMonthly,filterMonthlyRows,
  monthlyAverageTicket,monthlyShare,monthlyVirtualShare}=moduleLoader()('lib/data/glovo-monthly.ts');
// Invented rows only. These are not business exports or snapshots.
function row(month='2026-01',changes={}){
  return {key:JSON.stringify([month,changes.rawBrand??'Brand A',changes.sourceLocation??'Site A']),
    month,rawBrand:'Brand A',normalizedGroup:null,sourceLocation:'Site A',sourceName:'Fixture name',
    sourceAddress:'Fixture address',physicalLocation:null,physicalId:null,ownership:'Own',identity:'Реальний',
    openingMonth:null,mappingReason:'Fixture',deliveredOrders:2,purchaseSum:20,sourceHasNumeric:true,sourceRow:6,...changes};
}

test('month axis starts January and stops at latest represented month of exact selected year',()=>{
  const rows=[row('2025-12'),row('2026-03'),row('2026-01'),row('2026-13'),row('2027-10')];
  assert.deepEqual(glovoMonthAxis(rows,2026),['2026-01','2026-02','2026-03']);
  assert.deepEqual(glovoMonthAxis(rows,2024),[]);
  assert.deepEqual(glovoMonthAxis(rows,'2026'),[]);
});

test('partial sum retains known values while null cells and entirely absent storefront-months remain missing',()=>{
  const rows=[row('2026-01',{purchaseSum:0}),row('2026-01',{sourceLocation:'Site B',purchaseSum:null}),
    row('2026-02',{sourceLocation:'Site C',purchaseSum:70})];
  assert.deepEqual(aggregateMonthly(rows,'2026-01','purchaseSum'),{value:0,known:1,expected:3,missing:2,partial:true});
  assert.deepEqual(aggregateMonthly(rows,'2026-02','purchaseSum'),{value:70,known:1,expected:3,missing:2,partial:true});
  assert.deepEqual(aggregateMonthly(rows,'2026-03','purchaseSum'),{value:null,known:0,expected:3,missing:3,partial:true});
});

test('annual range includes globally missing months and explicit global axis includes trailing brand gaps',()=>{
  const rows=[row('2026-01'),row('2026-03')];
  assert.deepEqual(aggregateMonthly(rows,null,'purchaseSum'),{value:40,known:2,expected:3,missing:1,partial:true});
  assert.deepEqual(aggregateMonthlyRange([row()],['2026-01','2026-02'],'purchaseSum'),
    {value:20,known:1,expected:2,missing:1,partial:true});
  assert.equal(aggregateMonthlyRange(rows,['2026-01','2026-01'],'purchaseSum').value,null);
});

test('confirmed not-open is structural zero, distinct from measured zero and unknown first sale',()=>{
  const opened=[row('2026-03',{openingMonth:'2026-03'})];
  assert.deepEqual(aggregateMonthly(opened,'2026-01','purchaseSum'),{value:0,known:0,expected:0,missing:0,partial:false});
  assert.deepEqual(aggregateMonthly([row('2026-01',{purchaseSum:0})],'2026-01','purchaseSum'),
    {value:0,known:1,expected:1,missing:0,partial:false});
  assert.deepEqual(aggregateMonthly([row('2026-03')],'2026-01','purchaseSum'),
    {value:null,known:0,expected:1,missing:1,partial:true});
  assert.deepEqual(aggregateMonthly([],null,'purchaseSum'),{value:null,known:0,expected:0,missing:0,partial:true});
  assert.equal(aggregateMonthly(opened,null,'purchaseSum').expected,1);
});

test('conflicting opening evidence cannot hide known positive pre-opening activity as structural zero',()=>{
  const conflict=[row('2026-01',{openingMonth:'2026-03'}),row('2026-03',{openingMonth:'2026-03'})];
  assert.equal(aggregateMonthly(conflict,'2026-01','purchaseSum').partial,true);
  assert.equal(aggregateMonthly(conflict,'2026-01','purchaseSum').expected,1);
  assert.equal(aggregateMonthly(conflict,'2026-01','purchaseSum').value,null);
  const placeholders=[row('2026-01',{openingMonth:'2026-03',purchaseSum:0,deliveredOrders:0}),row('2026-03',{openingMonth:'2026-03'})];
  assert.equal(aggregateMonthly(placeholders,'2026-01','purchaseSum').expected,0);
  const invalid=[row('2026-03',{openingMonth:'2026-13'})];
  assert.equal(aggregateMonthly(invalid,'2026-01','purchaseSum').missing,1);
});

test('brand/source storefront identity never collapses brands sharing one physical site or source label',()=>{
  const rows=[row('2026-01',{physicalId:'same'}),row('2026-01',{rawBrand:'Brand B',physicalId:'same'})];
  assert.deepEqual(aggregateMonthly(rows,'2026-01','purchaseSum'),{value:40,known:2,expected:2,missing:0,partial:false});
  const duplicate=[row(),row('2026-01',{key:'another source row',sourceAddress:'Other address'})];
  assert.deepEqual(aggregateMonthly(duplicate,'2026-01','purchaseSum'),{value:null,known:0,expected:1,missing:1,partial:true});
});

test('typed numeric and sum guards never coerce text/boolean/blank or expose unsafe totals',()=>{
  for(const value of [null,undefined,'20','',true,false,NaN,Infinity,-1,Number.MAX_SAFE_INTEGER+1]){
    assert.equal(aggregateMonthly([row('2026-01',{purchaseSum:value})],'2026-01','purchaseSum').value,null,String(value));
  }
  assert.equal(aggregateMonthly([row('2026-01',{deliveredOrders:1.5})],'2026-01','deliveredOrders').value,null);
  const overflow=[row('2026-01',{purchaseSum:Number.MAX_SAFE_INTEGER}),row('2026-01',{sourceLocation:'B',purchaseSum:1})];
  const result=aggregateMonthly(overflow,'2026-01','purchaseSum');
  assert.equal(result.value,null);assert.equal(result.partial,true);assert.equal(result.known,2);
  assert.equal(aggregateMonthly([row()],'2026-00','purchaseSum').value,null);
});

test('MoM uses immediately previous month across year boundary, without VERIFIED historical-coverage gate',()=>{
  const rows=[row('2025-12',{purchaseSum:10}),row('2026-01',{purchaseSum:15})];
  assert.deepEqual(compareMonthly(rows,'2026-01','purchaseSum',[]),{percent:50,absolute:5,reason:null});
  assert.equal(compareMonthly(rows,'2026-01','purchaseSum',['2026-01']).reason,'INCOMPLETE_MONTH');
  assert.equal(compareMonthly(rows,'2026-01','purchaseSum',['2025-12']).reason,'INCOMPLETE_MONTH');
  assert.equal(compareMonthly(rows,'2026-01','purchaseSum',['2026-02']).percent,50);
});

test('MoM refuses skipped months, changed opening cohort and absent storefront observations',()=>{
  assert.equal(compareMonthly([row('2026-01'),row('2026-03')],'2026-03','purchaseSum',[]).reason,'MISSING_OBSERVATIONS');
  const rows=[row('2026-01'),row('2026-02'),row('2026-02',{sourceLocation:'Opened',openingMonth:'2026-02'})];
  assert.equal(compareMonthly(rows,'2026-02','purchaseSum',[]).reason,'COHORT_MISMATCH');
  assert.equal(compareMonthly(rows.map(r=>({...r,openingMonth:null})),'2026-02','purchaseSum',[]).reason,'MISSING_OBSERVATIONS');
  assert.equal(compareMonthly([row('2026-03',{openingMonth:'2026-03'})],'2026-02','purchaseSum',[]).reason,'NO_COMPARABLE_STOREFRONTS');
});

test('MoM zero baseline has no invented percentage, both measured zeros have absolute zero',()=>{
  const rows=[row('2026-01',{purchaseSum:0}),row('2026-02',{purchaseSum:0})];
  assert.deepEqual(compareMonthly(rows,'2026-02','purchaseSum',[]),{percent:null,absolute:0,reason:'ZERO_BASELINE'});
  rows[1].purchaseSum=5;
  assert.deepEqual(compareMonthly(rows,'2026-02','purchaseSum',[]),{percent:null,absolute:5,reason:'ZERO_BASELINE'});
  rows[0].purchaseSum=10;rows[1].purchaseSum=0;
  assert.deepEqual(compareMonthly(rows,'2026-02','purchaseSum',[]),{percent:-100,absolute:-10,reason:null});
});

test('filters are exact, AND-combined, immutable and use confirmed physical ID otherwise sourceLocation',()=>{
  const a=row('2026-01',{physicalId:'id-a',physicalLocation:'Same display'});
  const b=row('2026-01',{rawBrand:'Brand AB',sourceLocation:'Site AB',ownership:'Franchise',identity:'Віртуальний',physicalLocation:'Same display'});
  const rows=[a,b];
  assert.deepEqual(filterMonthlyRows(rows,{brand:'Brand A',location:'id-a',ownership:'Own',identity:'Реальний'}),[a]);
  assert.deepEqual(filterMonthlyRows(rows,{location:'Site AB'}),[b]);
  for(const filters of [{brand:'Brand'},{brand:'brand a'},{location:'Same display'},{location:'Site A'},{identity:'real'}])assert.deepEqual(filterMonthlyRows(rows,filters),[]);
  assert.deepEqual(rows,[a,b]);assert.notEqual(filterMonthlyRows(rows,{}),rows);
});

test('AOV is weighted, not mean of site averages, and blocks incomplete numerator/denominator cohorts',()=>{
  const rows=[row('2026-01',{purchaseSum:100,deliveredOrders:1}),row('2026-01',{sourceLocation:'B',purchaseSum:90,deliveredOrders:9})];
  assert.equal(monthlyAverageTicket(rows,'2026-01'),19);
  rows[1].purchaseSum=null;assert.equal(monthlyAverageTicket(rows,'2026-01'),null);
  assert.equal(monthlyAverageTicket([row()],null,['2026-01','2026-02']),null);
  assert.equal(monthlyAverageTicket([row('2026-01',{deliveredOrders:0})],'2026-01'),null);
});

test('shares require complete common month axis and known applicable virtual classification',()=>{
  const rows=[row('2026-01',{purchaseSum:75}),row('2026-01',{rawBrand:'Virtual B',sourceLocation:'B',identity:'Віртуальний',purchaseSum:25})];
  assert.equal(monthlyShare([rows[1]],rows,'2026-01','purchaseSum'),25);
  assert.equal(monthlyVirtualShare(rows,'2026-01','purchaseSum'),25);
  assert.equal(monthlyVirtualShare([rows[0]],'2026-01','purchaseSum'),0);
  assert.equal(monthlyVirtualShare(rows.map(r=>({...r,identity:'UNKNOWN'})),'2026-01','purchaseSum'),null);
  assert.equal(monthlyVirtualShare([row('2026-01',{purchaseSum:0})],'2026-01','purchaseSum'),null);
  assert.equal(monthlyVirtualShare([row('2026-01',{purchaseSum:null})],'2026-01','purchaseSum'),null);
  const all=[row(),row('2026-02')];
  assert.equal(monthlyShare([all[0]],all,null,'purchaseSum'),null,'trailing numerator month may not disappear');
  assert.equal(monthlyShare([row('2026-01',{rawBrand:'Unrelated'})],[row()],'2026-01','purchaseSum'),null);
});

test('average ticket metric weights months/sites, compares ratios and never invents shares or zero-denominator values',()=>{
  const rows=[row('2026-01',{purchaseSum:100,deliveredOrders:1}),row('2026-01',{sourceLocation:'B',purchaseSum:90,deliveredOrders:9}),row('2026-02',{purchaseSum:200,deliveredOrders:2}),row('2026-02',{sourceLocation:'B',purchaseSum:180,deliveredOrders:18})];
  assert.equal(aggregateMonthly(rows,'2026-01','averageTicket').value,19);
  assert.equal(aggregateMonthlyRange(rows,['2026-01','2026-02'],'averageTicket').value,19);
  assert.deepEqual(compareMonthly(rows,'2026-02','averageTicket',[]),{percent:0,absolute:0,reason:null});
  assert.equal(monthlyShare([rows[0]],rows,'2026-01','averageTicket'),null);
  assert.equal(monthlyVirtualShare(rows,'2026-01','averageTicket'),null);
  assert.equal(aggregateMonthly([row('2026-01',{purchaseSum:0,deliveredOrders:0})],'2026-01','averageTicket').value,null);
  assert.equal(aggregateMonthly([row('2026-01',{purchaseSum:0,deliveredOrders:2})],'2026-01','averageTicket').value,0);
  rows[0].purchaseSum=null; assert.equal(aggregateMonthly(rows,'2026-01','averageTicket').value,null);
  assert.equal(compareMonthly(rows,'2026-02','averageTicket',[]).reason,'MISSING_OBSERVATIONS');
});
