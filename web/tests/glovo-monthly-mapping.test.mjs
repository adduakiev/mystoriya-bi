import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleLoader} from './support/bi-preview-harness.mjs';
const load=moduleLoader();
const {normalizeGlovoSheet,GLOVO_HEADERS}=load('lib/data/glovo-contract.ts');
const {mapGlovoMonthlyRows:map,GLOVO_LOCATION_HEADERS:L,GLOVO_BRAND_HEADERS:B}=load('lib/data/glovo-monthly-mapping.ts');
const fact=(brand='Synthetic',site='Site source',line=3)=>['2026-10',brand,site,'Name','Address',2,100,line,1];
const rows=(...r)=>normalizeGlovoSheet([GLOVO_HEADERS,...r]).rows;
const loc=()=>[L,['Site source','Address','Physical site','Погоджено']];
const brands=()=>[B,[3,'Synthetic','Site source','Віртуальний','Франчазі','Погоджено']];
test('exact mapping enriches approved labels, normalizes ownership, preserves numbers and keeps opening unknown',()=>{
 const input=rows(fact());const out=map(input,loc(),brands())[0];
 assert.equal(out.physicalLocation,'Physical site');assert.equal(out.ownership,'Франчайзі');
 assert.equal(out.identity,'Віртуальний');assert.equal(out.openingMonth,null);assert.equal(out.physicalId,null);
 assert.equal(out.purchaseSum,100);assert.equal(input[0].ownership,'UNKNOWN');
});
test('same brand can be real and virtual at different physical locations',()=>{
 const out=map(rows(fact(),fact('Synthetic','Other',4)),[...loc(),['Other','','Other display','Погоджено']],
 [...brands(),[4,'Synthetic','Other','Реальний','Власні','Погоджено']]);
 assert.deepEqual(out.map(r=>r.identity),['Віртуальний','Реальний']);
});
test('lineage alone never maps a different brand/site; unapproved and changed lineage stay unknown',()=>{
 for(const r of [fact('Different'),fact('Synthetic','Other'),fact('Synthetic','Site source',4)]) {
  assert.equal(map(rows(r),loc(),brands())[0].ownership,'UNKNOWN');
 }
 const unapproved=brands();unapproved[1][5]='Очікує';
 assert.equal(map(rows(fact()),loc(),unapproved)[0].identity,'UNKNOWN');
});
test('contradictory, duplicate, malformed and billing-error mappings fail closed',()=>{
 for(const [l,b] of [
  [[['billing error']],brands()], [loc(),[['billing error']]],
  [[...loc(),loc()[1]],brands()], [loc(),[...brands(),brands()[1]]],
  [loc(),[...brands(),[4,'Other brand','Site source','Реальний','Власні','Погоджено']]],
  [loc(),[B,[3,'Synthetic','Site source','Вигаданий тип','Власні','Погоджено']]]
 ]) assert.throws(()=>map(rows(fact()),l,b),{message:'GLOVO_MAPPING_INVALID'});
});
