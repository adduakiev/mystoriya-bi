import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTask, patchTask} from '../lib/operating-tasks.ts';
import {mutateTasks, readTasks, taskStorePath, addCouncilTask} from '../lib/operating-task-store.ts';
const root=fileURLToPath(new URL('../../.agents/runtime/',import.meta.url));
await mkdir(root,{recursive:true});
const directory=await mkdtemp(path.join(root,'tasks-test-'));
const recommendation = {id:'rec-1', problem:'Checkout failures', evidence:['ev-1'], recommendation:'Investigate errors', priority:'P1', expected_impact:null};
const task = () => createTask(recommendation, 'run-1', 'task-1', '2026-10-20T00:00:00Z');
test.after(async () => {assert.ok(path.resolve(directory).startsWith(path.resolve(root)+path.sep));await rm(directory, {recursive:true, force:true});});
test('state machine rejects skips, missing owner, stale revision and invalid date', () => {
  for (const patch of [{status:'DONE'}, {status:'IN PROGRESS'}, {deadline:'2026-02-30'}, {priority:'P3'}]) assert.throws(() => patchTask(task(), {id:'task-1',revision:1,...patch}));
  assert.throws(() => patchTask(task(), {id:'task-1',revision:0,owner:'BI'}), /reload/);
  const progress = patchTask(task(), {id:'task-1',revision:1,owner:'BI',status:'IN PROGRESS'});
  const done = patchTask(progress, {id:'task-1',revision:2,status:'DONE'});
  assert.throws(() => patchTask(done, {id:'task-1',revision:3,status:'CHECK RESULT'}), /Result/);
  assert.equal(patchTask(done, {id:'task-1',revision:3,status:'CHECK RESULT',check_date:'2026-10-21',result:'Verified'}).status, 'CHECK RESULT');
});
test('atomic store enforces exclusive lock and preserves content on conflict/corruption', async () => {
  // This test exercises the local-file adapter against an isolated temporary path.
  // Vercel runtime protection is tested separately and must remain enabled in production.
  const previousVercel = process.env.VERCEL;
  delete process.env.VERCEL;
  try {
  const file = path.join(directory,'tasks.json');
  await mutateTasks(() => [task()],file);
  await writeFile(`${file}.lock`, '');
  await assert.rejects(mutateTasks(() => [],file), /busy/);
  assert.equal((await readTasks(file)).length,1);
  await rm(`${file}.lock`);
  await assert.rejects(mutateTasks(() => {throw new Error('conflict');},file), /conflict/);
  assert.equal((await readTasks(file)).length,1);
  await writeFile(file,'broken');
  await assert.rejects(mutateTasks(() => [],file), /refusing/);
  assert.equal(await readFile(file,'utf8'),'broken');
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
  }
});
test('task draft is taken only from server completed live council; duplicate denied', async () => {
  const old = {bus:process.env.OPERATING_BUS_PATH, tasks:process.env.OPERATING_TASKS_PATH, vercel:process.env.VERCEL};
  process.env.OPERATING_BUS_PATH=path.join(directory,'bus.json');
  process.env.OPERATING_TASKS_PATH=path.join(directory,'verified-tasks.json');
  delete process.env.VERCEL;
  try {
    for (const mode of ['replay','live']) {
      await writeFile(process.env.OPERATING_BUS_PATH,JSON.stringify({mode,status:mode==='live'?'partial':'completed',run_id:'run-1',council:{status:'completed',recommendations:[recommendation]}}));
      await assert.rejects(addCouncilTask('run-1','rec-1'),/completed live/);
    }
    const now=new Date().toISOString();
    const input={version:2,as_of:now,evidence:[{id:'ev-1',source:'synthetic',domain:'sales',label:'test',unit:'count',source_date:now.slice(0,10),
      observed_at:null,fetched_at:now,period_from:now.slice(0,10),period_to:now.slice(0,10),value:1,previous:null,target:null,forecast:null,
      direction:'neutral',source_status:'AVAILABLE',coverage:'FULL',confidence:1,freshness_sla_days:1,expected_dates:1,observed_dates:1,duplicate_rows:0,attribution:'backend'}]};
    const messages=['agent-sales-retail','agent-digital-ads','agent-seo-content','agent-bi-uxui'].map((agent,i)=>({payload:{agent,summary:'test',findings:i?[]:[{key:'rec-1',kind:'fact',insight:recommendation.problem,action:recommendation.recommendation,evidence_ids:['ev-1'],impact_uah:null,impact_basis:'unknown'}]}}));
    await writeFile(process.env.OPERATING_BUS_PATH,JSON.stringify({mode:'live',status:'completed',run_id:'run-1',as_of:now,input,messages}));
    await assert.rejects(addCouncilTask('run-1','rec-1:action',{...input,evidence:[{...input.evidence[0],value:99}]}),/stale, incomplete or invalid/);
    const created=await addCouncilTask('run-1','rec-1:action',input);
    assert.equal(created.problem,recommendation.problem);
    assert.equal(created.priority,'UNASSESSED');
    assert.equal((await readTasks())[0].priority,'UNASSESSED');
    await assert.rejects(addCouncilTask('run-1','rec-1:action',input),/already/);
    process.env.VERCEL='1'; assert.throws(taskStorePath,/Vercel/);
  } finally {
    for (const [key,value] of Object.entries({OPERATING_BUS_PATH:old.bus,OPERATING_TASKS_PATH:old.tasks,VERCEL:old.vercel})) {if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});
