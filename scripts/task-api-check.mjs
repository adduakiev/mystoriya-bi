// Isolated loopback HTTP tests; secrets and server output never persisted.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {parseEnv} from 'node:util';
import assert from 'node:assert/strict';
import {createTask} from '../web/lib/operating-tasks.ts';
const env=parseEnv(fs.readFileSync('web/.env.local','utf8').replace(/^\uFEFF/,''));
const dir=fs.mkdtempSync(path.resolve('.agents/runtime/api-qa-'));
const file=path.join(dir,'tasks.json'), bus=path.join(dir,'bus.json');
const base='http://localhost:3101', results={checked_at:new Date().toISOString()};
let server;
async function start(vercel=false){
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3101'],{cwd:path.resolve('web'),windowsHide:true,stdio:'ignore',env:{...process.env,...env,VERCEL:vercel?'1':'',OPERATING_MANUAL_RUN_ENABLED:'1',OPERATING_TASKS_PATH:file,OPERATING_BUS_PATH:bus}});
  for(let i=0;i<60;i++){try {if((await fetch(base+'/login')).ok)return;}catch{} await new Promise(r=>setTimeout(r,500));}
  throw Error('Isolated server unavailable');
}
async function stop(){if(!server)return;const p=server;server=null;await new Promise(r=>{p.once('exit',r);p.kill();});}
try{
  await start();
  let r=await fetch(base+'/api/auth/login',{method:'POST',body:new URLSearchParams({password:env.BI_ACCESS_PASSWORD,next:'/operating'}),redirect:'manual'});
  assert.equal(r.status,303);const cookie=r.headers.get('set-cookie').split(';')[0];
  const headers={cookie,origin:base,'content-type':'application/json'};
  const availability=await fetch(base+'/api/operating/runs',{headers});
  assert.equal(availability.status,200);assert.equal((await availability.json()).enabled,false);
  const blockedRun=await fetch(base+'/api/operating/runs',{method:'POST',headers});
  assert.equal(blockedRun.status,503);assert.equal((await blockedRun.json()).status,'BLOCKED');
  results.manual_flag_cannot_enable_provider=blockedRun.status;
  const foreignRun=await fetch(base+'/api/operating/runs',{method:'POST',headers:{...headers,origin:'https://foreign.invalid'}});
  assert.equal(foreignRun.status,403);results.manual_foreign_origin=foreignRun.status;
  const unauthRun=await fetch(base+'/api/operating/runs',{method:'POST',redirect:'manual'});
  assert.equal(unauthRun.status,307);results.manual_unauthorized=unauthRun.status;
  const cockpit=await fetch(base+'/operating',{headers:{cookie}});
  const html=await cockpit.text();assert.equal(cockpit.status,200);
  assert.ok(html.includes('manual-reasons')&&html.includes('disabled')&&html.includes('Data Quality / Sources'));
  results.operations_ssr=200;
  const call=(method,data,extra={})=>fetch(base+'/api/operating/tasks',{method,headers:{...headers,...extra},...(data?{body:JSON.stringify(data)}:{}),redirect:'manual'});
  r=await call('GET');assert.equal(r.status,200);results.authorized_read=r.status;
  for(const method of ['GET','POST','PATCH']){r=await fetch(base+'/api/operating/tasks',{method,redirect:'manual'});assert.equal(r.status,307);assert.ok(r.headers.get('location').includes('/login'));results['unauthorized_'+method]=r.status;}
  r=await call('POST',{}, {origin:'https://foreign.invalid'});assert.equal(r.status,403);results.foreign_origin=r.status;
  const task=createTask({id:'qa-rec',problem:'Synthetic QA only',evidence:['qa'],recommendation:'Test revision guard',priority:'P3',expected_impact:null},'qa-run','qa-task',new Date().toISOString());
  fs.writeFileSync(file,JSON.stringify({version:1,tasks:[task]}));
  r=await call('PATCH',{id:task.id,revision:1,owner:'QA'});assert.equal(r.status,200);
  r=await call('PATCH',{id:task.id,revision:1,owner:'Stale'});assert.equal(r.status,409);results.version_conflict=r.status;
  const input=await (await fetch(base+'/api/operating/input',{headers:{cookie}})).json();
  const packet=input.packet||input;
  packet.as_of=new Date(Date.now()-48*3600000).toISOString();
  fs.writeFileSync(bus,JSON.stringify({mode:'live',status:'completed',run_id:'qa-stale',as_of:packet.as_of,input:packet,messages:[]}));
  r=await call('POST',{source_run_id:'qa-stale',recommendation_id:'qa-rec'});assert.equal(r.status,409);assert.match((await r.json()).error,/stale/);results.stale_evidence=r.status;
  const before=fs.readFileSync(file,'utf8');
  await stop();await start(true);
  r=await call('PATCH',{id:task.id,revision:2,owner:'Vercel'});assert.equal(r.status,503);results.vercel_write_disabled=r.status;
  assert.equal(fs.readFileSync(file,'utf8'),before);results.vercel_no_write=true;
  console.log(JSON.stringify(results,null,2));
  fs.writeFileSync('.agents/runtime/task-api-check.json',JSON.stringify(results,null,2));
}catch{console.error('Task API QA failed; request details suppressed');process.exitCode=1;}
finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}
