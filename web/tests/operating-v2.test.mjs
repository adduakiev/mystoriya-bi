import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {orchestrate,transition,fingerprintHash} from '../lib/operating-orchestrator.ts';
import {ReplayRuntime,ProductionRuntime,validateSpecialist} from '../lib/operating-runtime.ts';
import {SPECIALISTS,buildCouncil} from '../lib/operating-core.ts';
import {persistenceSnapshot} from '../lib/operating-persistence.ts';
import {manualRunAvailability,requestManualRun} from '../lib/operating-manual.ts';
import {LocalFileTaskRepository} from '../lib/operating-task-store.ts';
import {SupabaseTaskRepository} from '../lib/operating-task-repository.ts';
import {createTask} from '../lib/operating-tasks.ts';
import {CodexCliRuntime} from '../../.agents/adapters/codex-cli.mjs';

const at='2026-10-21T00:00:00Z';
const packet=()=>({version:2,as_of:at,evidence:['sales','ads','seo','ux'].map((domain,i)=>({
  id:`e${i}`,domain,source:'aggregate',label:'Metric',unit:'count',source_date:'2026-10-20',observed_at:null,fetched_at:at,
  period_from:'2026-10-20',period_to:'2026-10-20',value:10,previous:null,target:null,forecast:null,direction:'neutral',
  source_status:'AVAILABLE',coverage:'FULL',confidence:1,freshness_sla_days:2,expected_dates:1,observed_dates:1,duplicate_rows:0,attribution:'none'
}))});
const output=(agent,id)=>({agent,summary:'Aggregate analysis',findings:[{key:agent,kind:'fact',insight:'Observed aggregate',action:'Review',
  evidence_ids:[id],impact_uah:null,impact_basis:'Unknown'}]});
const replay=()=>new ReplayRuntime(Object.fromEntries(SPECIALISTS.map((a,i)=>[a,output(a,`e${i}`)])));
const run=(runtime=replay(),extra={})=>orchestrate({runtime,collect:async()=>packet(),now:()=>at,...extra});

test('v2 sequential isolated runtime cannot mutate peer inputs or see BLOCK evidence',async()=>{
  const p=packet();p.evidence[1].value=null;
  const called=[];
  const runtime={kind:'replay',mode:'replay',version:'test',available:true,async invoke(agent,input){
    called.push(agent);assert.equal(input.evidence.length,1);assert.deepEqual(Object.keys(input).sort(),['as_of','evidence','version']);
    const id=input.evidence[0].id;input.evidence[0].value=999;return output(agent,id);
  }};
  const r=await run(runtime,{collect:async()=>p});
  assert.equal(called.length,3);assert.ok(!called.includes('agent-digital-ads'));
  assert.equal(r.input.evidence[0].value,10);assert.equal(r.outputs.length,4);
  assert.equal(r.run.status,'COMPLETED');assert.ok(r.council.items.some(i=>i.classification==='BLOCKED'));
});

test('v2 lifecycle checkpoints ordered; terminal transitions cannot restart',async()=>{
  const states=[];const r=await run(replay(),{checkpoint:async record=>states.push(record.status)});
  assert.deepEqual([...new Set(states)],['QUEUED','COLLECTING','QUALITY','SPECIALISTS','COUNCIL','COMPLETED']);
  assert.throws(()=>transition(r.run,'QUEUED',at));
  assert.throws(()=>transition({...r.run,status:'QUEUED'},'COMPLETED',at));
  assert.ok(r.run.finished_at);assert.equal(r.run.mode,'replay');assert.equal(r.astra.decisions.length<=5,true);
});

test('v2 failed agent and timeout fail the run without exposing upstream exceptions',async()=>{
  const provider={...replay(),kind:'production',mode:'live',available:true,version:'test',async invoke(){throw Error('Bearer secret-value');}};
  const currentFingerprint=async()=>fingerprintHash(packet());
  const r=await run(provider,{currentFingerprint});assert.equal(r.run.status,'FAILED');assert.equal(r.council,null);
  assert.ok(!JSON.stringify(r).includes('secret-value'));
  const timeout=await run({...provider,invoke:()=>new Promise(()=>{})},{timeoutMs:5,currentFingerprint});assert.equal(timeout.run.status,'FAILED');
});

test('v2 partial specialist set gives blocked Council coverage, never invented peers',()=>{
  const c=buildCouncil(packet(),[output(SPECIALISTS[0],'e0')]);
  assert.equal(c.items.filter(i=>i.id.startsWith('missing:')&&i.classification==='BLOCKED').length,3);
});

test('v2 stale input and changed fingerprint block completion',async()=>{
  const stale=await run(replay(),{now:()=> '2026-10-23T00:00:00Z'});
  assert.equal(stale.run.status,'BLOCKED');assert.equal(stale.run.error_code,'STALE_INPUT');assert.equal(stale.outputs.length,0);
  const changed=await run(replay(),{currentFingerprint:async()=>fingerprintHash({...packet(),evidence:[]})});
  assert.equal(changed.run.status,'BLOCKED');assert.equal(changed.run.error_code,'EVIDENCE_CHANGED');assert.equal(changed.council,null);
});

test('v2 runtime adapter validates domain and references; replay never becomes live',async()=>{
  await assert.rejects(replay().invoke(SPECIALISTS[0],packet()),/domain/);
  assert.throws(()=>validateSpecialist(output(SPECIALISTS[0],'foreign'),SPECIALISTS[0],new Set(['e0'])));
  const r=await run();assert.equal(r.run.mode,'replay');
  const mislabeled=await run({...replay(),kind:'replay',mode:'live',available:true});
  assert.equal(mislabeled.run.status,'BLOCKED');assert.equal(mislabeled.run.error_code,'MODE_MISMATCH');
});

test('v2 disabled production provider and manual flag cannot cause collection or invocation',async()=>{
  const r=await run(new ProductionRuntime(),{collect:async()=>{throw Error('must not collect');}});
  assert.equal(r.run.status,'BLOCKED');assert.equal(r.run.error_code,'PROVIDER_DISABLED');
  await assert.rejects(new ProductionRuntime().invoke(SPECIALISTS[0],packet()));
  for(const flag of [false,true]){assert.equal(manualRunAvailability(flag).enabled,false);assert.equal((await requestManualRun(flag)).status,'BLOCKED');}
});

test('v2 Codex CLI adapter is prohibited on Vercel; server core has no CLI imports',async()=>{
  const old=process.env.VERCEL;process.env.VERCEL='1';
  try{assert.throws(()=>new CodexCliRuntime('unused',{}),/local only/);}finally{if(old===undefined)delete process.env.VERCEL;else process.env.VERCEL=old;}
  const core=await fs.readFile(new URL('../lib/operating-orchestrator.ts',import.meta.url),'utf8');
  assert.ok(!/child_process|spawnSync|codex exec|node:fs/.test(core));
});

test('v2 persistence projects allowlisted aggregates; raw records and sensitive output rejected',async()=>{
  const r=await run();const snapshot=persistenceSnapshot({...r,cookies:'ignored',raw_payload:'ignored'});
  assert.ok(!JSON.stringify(snapshot).includes('ignored'));assert.equal(snapshot.evidence.length,4);
  assert.throws(()=>persistenceSnapshot({...r,input:{...r.input,customers:[{email:'a@example.invalid'}]}}));
  assert.throws(()=>persistenceSnapshot({...r,outputs:[{...r.outputs[0],raw_payload:{}}]}));
  assert.throws(()=>persistenceSnapshot({...r,outputs:[{...r.outputs[0],summary:'customer@example.invalid'}]}));
});

test('v2 repository adapter preserves conflict handling; Supabase and Vercel paths stay disabled',async()=>{
  const root=fileURLToPath(new URL('../../.agents/runtime/',import.meta.url));await fs.mkdir(root,{recursive:true});
  const dir=await fs.mkdtemp(path.join(root,'repo-v2-'));const old=process.env.VERCEL;delete process.env.VERCEL;
  try{
    const repo=new LocalFileTaskRepository(path.join(dir,'tasks.json'));
    const task=createTask({id:'rec',problem:'Test',evidence:['e0'],recommendation:'Review',priority:'UNASSESSED',expected_impact:null},'run','task',at);
    await repo.create(task);assert.equal((await repo.list()).length,1);
    await repo.update({id:'task',revision:1,owner:'QA'});
    await assert.rejects(repo.update({id:'task',revision:1,owner:'stale'}),/reload/);
    for(const method of ['list','create','update'])await assert.rejects(new SupabaseTaskRepository()[method](task),/not activated/);
    process.env.VERCEL='1';await assert.rejects(repo.create(task),/Vercel/);
  }finally{if(old===undefined)delete process.env.VERCEL;else process.env.VERCEL=old;await fs.rm(dir,{recursive:true,force:true});}
});

test('v2 migration design has all six private RLS tables and no public execution grants',async()=>{
  const sql=await fs.readFile(new URL('../../supabase/migrations/20261021123211_digital_operating_v2_design.sql',import.meta.url),'utf8');
  for(const table of ['operating_runs','operating_run_evidence','operating_agent_outputs','operating_council_items','operating_tasks','operating_task_events']){
    assert.ok(sql.includes(`create table operating_private.${table}`));assert.ok(sql.includes(`alter table operating_private.${table} enable row level security`));
  }
  assert.ok(sql.includes('from public, anon, authenticated'));assert.ok(!/security definer/i.test(sql));
  assert.ok(!/grant .* to (anon|authenticated|public)/i.test(sql));
});

// Synthetic live provider: no credentials, CLI or network access.
const live=(visits=[])=>({kind:'production',mode:'live',available:true,version:'test-only',async invoke(agent,input){
  visits.push(agent);return output(agent,input.evidence[0].id);
}});
const assertPreCouncilBlocked=(r,code)=>{
  assert.equal(r.run.status,'BLOCKED');assert.equal(r.run.error_code,code);
  assert.equal(r.council,null);assert.equal(r.astra,null);assert.equal(r.run.council_at,null);
};

test('audit LIVE without fingerprint callback blocks before spending or collecting',async()=>{
  const visits=[];
  const r=await run(live(visits),{collect:async()=>{assert.fail('must not collect');}});
  assertPreCouncilBlocked(r,'FINGERPRINT_REQUIRED');assert.deepEqual(visits,[]);
});

test('audit LIVE fingerprint read error blocks with sanitized bounded code',async()=>{
  const r=await run(live(),{currentFingerprint:async()=>{throw Error('private upstream response');}});
  assertPreCouncilBlocked(r,'FINGERPRINT_READ_FAILED');assert.equal(r.outputs.length,4);
  assert.ok(!JSON.stringify(r).includes('private upstream response'));
});

test('audit LIVE fingerprint timeout blocks instead of hanging',async()=>{
  const r=await run(live(),{currentFingerprint:()=>new Promise(()=>{}),timeoutMs:5});
  assertPreCouncilBlocked(r,'FINGERPRINT_READ_FAILED');assert.equal(r.outputs.length,4);
});

test('audit LIVE malformed fingerprint fails closed',async()=>{
  for(const value of [null,undefined,'',123,'not-a-sha256']){
    assertPreCouncilBlocked(await run(live(),{currentFingerprint:async()=>value}),'FINGERPRINT_READ_FAILED');
  }
});

test('audit LIVE same fingerprint completes only after fresh post-specialist read',async()=>{
  const visits=[];let reads=0;const states=[];
  const r=await run(live(visits),{checkpoint:async r=>states.push(r.status),currentFingerprint:async()=>{
    reads++;assert.deepEqual(visits,SPECIALISTS);assert.ok(!states.includes('COUNCIL'));
    return fingerprintHash(packet());
  }});
  assert.equal(reads,1);assert.equal(r.run.status,'COMPLETED');assert.equal(r.run.mode,'live');assert.ok(r.council);
});

test('audit LIVE changed fingerprint cannot reach Council or completed checkpoint',async()=>{
  const states=[];const p=packet();p.evidence[0].value=11;
  const r=await run(live(),{checkpoint:async r=>states.push(r.status),currentFingerprint:async()=>fingerprintHash(p)});
  assertPreCouncilBlocked(r,'EVIDENCE_CHANGED');assert.equal(r.outputs.length,4);
  assert.ok(!states.includes('COUNCIL'));assert.ok(!states.includes('COMPLETED'));
});

test('audit REPLAY needs no external fresh read and retains replay label',async()=>{
  const r=await run();assert.equal(r.run.status,'COMPLETED');assert.equal(r.run.mode,'replay');
});

test('audit persistence rejects sales finding with valid Ads evidence ID',async()=>{
  const r=await run();assert.equal(persistenceSnapshot(r).outputs.length,4);
  r.outputs[0].findings[0].evidence_ids=['e1'];
  assert.throws(()=>persistenceSnapshot(r),/Invalid specialist finding/);
});

test('audit persistence rejects non-null financial impact even for a fact',async()=>{
  for(const value of [0,100]){
    const r=await run();r.outputs[0].findings[0].impact_uah=value;
    assert.throws(()=>persistenceSnapshot(r),/Measured impact contract unavailable/);
  }
});

test('audit findings enforce application string and evidence-list bounds',()=>{
  for(const field of ['key','insight','action','impact_basis']){
    const r=output(SPECIALISTS[0],'e0');r.findings[0][field]='x'.repeat(field==='key'?201:4001);
    assert.throws(()=>validateSpecialist(r,SPECIALISTS[0],new Set(['e0'])));
  }
  for(const ids of [Array(65).fill('e0'),['x'.repeat(201)],[''],[null],[12],[{}]]){
    const r=output(SPECIALISTS[0],'e0');r.findings[0].evidence_ids=ids;
    assert.throws(()=>validateSpecialist(r,SPECIALISTS[0],new Set(ids)));
  }
});

const migrationSql=()=>fs.readFile(new URL('../../supabase/migrations/20261021123211_digital_operating_v2_design.sql',import.meta.url),'utf8');
test('audit SQL task INSERT matches Council payload and UPDATE cannot mutate it',async()=>{
  const sql=await migrationSql();const guard=sql.split('create function operating_private.guard_task()')[1].split('end $$;')[0];
  const [insert,update]=guard.split('\n  else');
  for(const field of ['problem','recommendation','evidence_ids','expected_impact']){
    assert.ok(insert.includes(`and new.${field} is not distinct from c.${field}`),field);
  }
  for(const field of ['id','source_run_id','recommendation_id','created_at','problem','recommendation','evidence_ids','expected_impact']){
    assert.ok(update.includes(`new.${field} is distinct from old.${field}`),field);
  }
  assert.ok(insert.includes("c.classification='RECOMMENDATION'"));assert.ok(insert.includes("r.mode='live'"));
  assert.ok(update.includes('new.revision<>old.revision+1'));
});

test('audit SQL findings constrain list elements, string lengths and null impact',async()=>{
  const sql=await migrationSql();const validator=sql.split('create function operating_private.valid_findings')[1].split('end $$;')[0];
  for(const fragment of ["jsonb_typeof(value) is distinct from 'array'",'jsonb_array_length(value)>40',
    "length(f->>'key') not between 1 and 200","jsonb_array_length(f->'evidence_ids')>64",
    "jsonb_typeof(evidence_id) is distinct from 'string'","length(evidence_id #>> '{}') not between 1 and 200",
    "f->'impact_uah' <> 'null'::jsonb",'octet_length(value::text)>64000'])assert.ok(validator.includes(fragment),fragment);
  for(const field of ['insight','action','impact_basis']){
    assert.ok(validator.includes(`length(f->>'${field}') not between 1 and 4000`));
    assert.ok(validator.includes(`length(btrim(f->>'${field}'))=0`));
  }
  for(const code of ['FINGERPRINT_REQUIRED','FINGERPRINT_READ_FAILED'])assert.ok(sql.includes(`'${code}'`));
});

test('audit SQL hardens private objects without creator-wide defaults, browser policies or grants',async()=>{
  const sql=(await migrationSql()).replace(/--[^\n]*/g,'');
  assert.ok(!/alter\s+default\s+privileges/i.test(sql));
  for(const [,table] of sql.matchAll(/create table operating_private\.(\w+)/g)){
    assert.ok(sql.includes(`revoke all on table operating_private.${table} from public, anon, authenticated;`));
    assert.ok(sql.includes(`alter table operating_private.${table} enable row level security;`));
  }
  const functions=[...sql.matchAll(/create function operating_private\.(\w+)\(([^)]*)\)/g)];
  assert.equal(functions.length,4);
  for(const [,name,args] of functions){
    const signature=name+'('+(args==='value jsonb'?'jsonb':args)+')';
    assert.ok(sql.includes(`revoke all on function operating_private.${signature} from public, anon, authenticated;`));
  }
  assert.ok(sql.includes('event_id bigint generated always as identity'));
  assert.ok(sql.includes('revoke all on sequence operating_private.operating_task_events_event_id_seq from public, anon, authenticated;'));
  assert.ok(!/on all (tables|sequences|functions) in schema/i.test(sql));
  assert.ok(!/create\s+policy/i.test(sql));
  assert.ok(!/grant[^;]*to\s+(public|anon|authenticated)\b/i.test(sql));
});

// Static SQL contract checks only; not a substitute for PostgreSQL integration execution.
const taskInsertSql=async()=> (await migrationSql()).replace(/--[^\n]*/g,'')
  .split('create function operating_private.guard_task()')[1].split('\n  else')[0];
test('review SQL rejects older LIVE run within 24h when a newer eligible run exists',async()=>{
  const sql=await taskInsertSql();
  // A(10:00) cannot satisfy the equality if B(11:00) is the descending LIMIT 1 winner.
  assert.match(sql,/where r\.run_id=new\.source_run_id/);
  assert.match(sql,/and r\.run_id=\(select latest\.run_id from operating_private\.operating_runs latest/);
  assert.match(sql,/order by latest\.finished_at desc, latest\.started_at desc, latest\.run_id desc\s+limit 1\)/);
  assert.match(sql,/if not exists\([\s\S]*then raise exception/);
});

test('review SQL latest eligible LIVE run can match without recommendation-based fallback',async()=>{
  const sql=await taskInsertSql();const latest=sql.match(/select latest\.run_id[\s\S]*?limit 1/)[0];
  assert.match(latest,/latest\.finished_at>=now\(\)-interval '24 hours' and latest\.finished_at<=now\(\)/);
  assert.match(latest,/latest\.status='COMPLETED'/);
  // Choose current run first, regardless of its Council items. Missing recommendation blocks;
  // never fall back to an older run that happens to contain the requested recommendation.
  assert.ok(!/council|recommendation|new\./.test(latest));
  assert.match(sql,/c\.recommendation_id=new\.recommendation_id and c\.classification='RECOMMENDATION'/);
  for(const field of ['problem','recommendation','evidence_ids','expected_impact'])
    assert.ok(sql.includes(`and new.${field} is not distinct from c.${field}`));
});

test('review SQL replay is ineligible both as task source and as current-run candidate',async()=>{
  const sql=await taskInsertSql();
  assert.match(sql,/r\.run_id=new\.source_run_id and r\.mode='live' and r\.status='COMPLETED'/);
  assert.match(sql,/where latest\.mode='live' and latest\.status='COMPLETED'/);
  assert.ok(!/\bor\b/i.test(sql.split('if not exists(')[1]));
});
