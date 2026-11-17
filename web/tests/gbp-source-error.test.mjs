import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLocal} from '../lib/data/digital-source-contract.ts';
import {previewHarness} from './support/bi-preview-harness.mjs';

const error='Uh-oh! These are not your real numbers: reads are paused because you have 10 accounts connected and your Free plan includes 1 account. https://private.example/account';
const valid=()=>({
  meta:{from:'2026-10-19',to:'2026-11-17',rows:101,observedDates:29,days:30,locationCount:4,coverage:'PARTIAL'},
  summary:{impressions:100,clicks:0,calls:0,websiteClicks:0,directions:0,menuClicks:0},
  locations:Array.from({length:4},(_,i)=>({location_id:`locations/${100+i}`,location_title:'Synthetic profile',impressions:25,calls:0})),
  pageSpeed:{captured_on:'2026-11-17',mobile_score:80},
});
function blocked(data){
  assert.equal(data.meta.sourceIssue.code,'UPSTREAM_ERROR');
  assert.ok(Object.values(data.summary).every(value=>value===null));
  assert.deepEqual(data.locations,[]);
  assert.equal(data.meta.from,'');
  assert.equal(data.meta.to,'');
  assert.equal(data.meta.days,null);
  assert.equal(data.meta.locationCount,null);
  assert.equal(data.meta.coverage,'UNKNOWN');
  assert.ok(!JSON.stringify(data).includes('private.example'));
}

test('billing pseudo-profile cannot become a fifth location, zero metric, or fresh date',()=>{
  const raw=valid();
  raw.locations.push({location_id:error,location_title:error,impressions:0,calls:0});
  raw.meta.locationCount=5;
  const before=structuredClone(raw);
  const data=normalizeLocal(raw);
  blocked(data);
  assert.equal(data.meta.sourceIssue.rejectedLocations,1);
  assert.equal(data.pageSpeed.mobileScore,80,'independent PageSpeed is retained');
  assert.deepEqual(raw,before,'input is not modified');
});

test('provider errors in title or envelope fail closed, including a normal-looking ID',()=>{
  const inTitle=valid();inTitle.locations[0].location_title=error;
  for(const raw of [inTitle,{...valid(),error:{message:'private.example'}},{...valid(),success:false},{...valid(),meta:{...valid().meta,status:'error'}},error]) blocked(normalizeLocal(raw));
});

test('malformed location collection is unavailable rather than a render exception',()=>{
  for(const locations of [error,{},[null],[false],[[]]]){
    const data=normalizeLocal({...valid(),locations});
    assert.equal(data.meta.sourceIssue.code,'INVALID_PAYLOAD');
    assert.deepEqual(data.locations,[]);
    assert.ok(Object.values(data.summary).every(value=>value===null));
  }
});

test('valid historical values and measured zeros keep the existing contract',()=>{
  const data=normalizeLocal(valid());
  assert.equal(data.meta.sourceIssue,null);
  assert.equal(data.summary.impressions,100);
  assert.equal(data.summary.calls,0);
  assert.equal(data.locations.length,4);
  assert.equal(data.locations[0].calls,0);
  assert.equal(data.meta.to,'2026-11-17');
  const empty=normalizeLocal({meta:{rows:0},summary:{calls:0}});
  assert.equal(empty.summary.calls,null);
  assert.equal(empty.meta.sourceIssue,null);
});

test('actual GBP page renders one source warning without raw billing text or false metrics',async t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('No network in synthetic SSR'));
  const raw=valid();raw.locations.push({location_id:error,location_title:error,impressions:0,calls:0});
  const data=normalizeLocal(raw);
  const h=previewHarness();
  t.mock.method(h.load('lib/data/digital-sources.ts'),'loadDigitalLocalData',async()=>data);
  const html=await h.render('/digital/local');
  assert.equal((html.match(/role="alert"/g)||[]).length,1);
  assert.ok(html.includes('Показники та свіжість цього звіту не підтверджені'));
  assert.ok(!html.includes('private.example'));
  assert.ok(!html.includes('reads are paused'));
  assert.ok(!html.includes('2026-11-17'));
  assert.ok(!html.includes('Локальний попит по профілях'));
  assert.ok(html.includes('Google / Maps'));
});

function validatedHistory(){
  const raw=valid();
  raw.meta={...raw.meta,from:'2026-10-14',to:'2026-11-12',validThrough:'2026-11-12',rows:120,observedDates:30,
    gbpObservationContract:'gbp-valid-observations-v1',status:'error',rejectedStagingRows:4,rejectedCuratedRows:4,latestRejectedBusinessDate:'2026-11-17'};
  return raw;
}
test('explicit guarded RPC preserves valid historical metrics while source error remains',()=>{
  const raw=validatedHistory(),data=normalizeLocal(raw);
  assert.equal(data.meta.historicalDataValidated,true);
  assert.equal(data.meta.sourceIssue.code,'UPSTREAM_ERROR');
  assert.match(data.meta.sourceIssue.message,/2026-11-12/);
  assert.equal(data.meta.to,'2026-11-12');
  assert.equal(data.meta.locationCount,4);
  assert.equal(data.locations.length,4);
  assert.equal(data.summary.calls,0);
  assert.equal(data.summary.impressions,100);
  assert.equal(data.pageSpeed.mobileScore,80);
});
test('unvalidated or inconsistent purported historical data still fails closed',()=>{
  const bad=[];
  for(const change of [{gbpObservationContract:undefined},{gbpObservationContract:'other-contract'},{validThrough:'2026-11-17'},
    {to:'2026-02-30',validThrough:'2026-02-30'},{rows:0},{observedDates:undefined},{locationCount:5},{days:31}]){
    const raw=validatedHistory();raw.meta={...raw.meta,...change};bad.push(raw);
  }
  const rowError=validatedHistory();rowError.locations[0].location_title=error;bad.push(rowError);
  const invalidId=validatedHistory();invalidId.locations[0].location_id='unknown';bad.push(invalidId);
  const repeated=validatedHistory();repeated.locations[1].location_id=repeated.locations[0].location_id;bad.push(repeated);
  const envelope=validatedHistory();envelope.error='upstream';bad.push(envelope);
  for(const raw of bad){
    const data=normalizeLocal(raw);
    assert.equal(data.meta.historicalDataValidated,false);
    assert.ok(data.meta.sourceIssue);
    assert.equal(data.meta.to,'');
    assert.deepEqual(data.locations,[]);
    assert.ok(Object.values(data.summary).every(value=>value===null));
  }
});
test('actual page shows mapped historical profiles and a single stale-source warning',async t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('No network in synthetic SSR'));
  const raw=validatedHistory();
  const ids=['14041797018953207147','11452898684627681419','14390582861278894493','15689179339837801980'];
  raw.locations.forEach((row,i)=>row.location_id=`locations/${ids[i]}`);
  const h=previewHarness();
  t.mock.method(h.load('lib/data/digital-sources.ts'),'loadDigitalLocalData',async()=>normalizeLocal(raw));
  const html=await h.render('/digital/local');
  assert.equal((html.match(/role="alert"/g)||[]).length,1);
  assert.match(html,/Локальний попит по профілях/);
  assert.match(html,/Google Business Profile · 4 GBP-профілів/);
  assert.match(html,/Академіка Вільямса, 3\/7/);
  assert.match(html,/Анни Ахматової, 22/);
  assert.match(html,/Голосіївський проспект, 58А/);
  assert.match(html,/Героїв Сталінграду, 8К5/);
  assert.match(html,/історичні вимірювання до 2026-11-12/);
  assert.match(html,/актуальність після цієї дати не підтверджена/);
  assert.doesNotMatch(html,/2026-11-17|reads are paused|private.example/);
});
