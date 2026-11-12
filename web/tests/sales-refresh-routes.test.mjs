import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  }});
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    return require(name);
  }, module, module.exports);
  return module.exports;
}
const auth = load('../lib/auth.ts', {});
const helper = load('../lib/sales-refresh.ts', { 'server-only': {}, '@/lib/auth': auth });
const receipt = { requestId:'456', done:true, status:'success', atomic:true,
  runId:'11111111-1111-4111-8111-111111111111', cutoffDate:'2026-11-10', rowsLoaded:46702 };
function request(body = {}, { id='456', authenticated=true, origin='https://fixture.invalid' } = {}) {
  return { nextUrl:new URL(`https://fixture.invalid/api/sales-refresh?requestId=${encodeURIComponent(id)}`),
    headers:new Headers({origin}), cookies:{get:() => ({value: authenticated ? 'session' : ''})},
    json:async () => body };
}
function routes(rpc, invalidate = () => assert.fail('unexpected invalidation')) {
  const dependencies = { 'next/server':{NextResponse:Response},
    '@/lib/data/source':{callBiRpc:rpc},
    '@/lib/sales-refresh':{...helper,authorizedSalesRefresh:async r=>r.cookies.get().value==='session'},
    'next/cache':{revalidateTag:invalidate,revalidatePath:invalidate} };
  return { post:load('../app/api/sales-refresh/route.ts',dependencies).POST,
    get:load('../app/api/sales-refresh/status/route.ts',dependencies).GET };
}

test('atomic refresh requires valid session and same-origin mutation before any RPC', async () => {
  const r=routes(()=>assert.fail('must not reach database'));
  assert.equal((await r.post(request({}, {authenticated:false}))).status,401);
  assert.equal((await r.get(request({}, {authenticated:false}))).status,401);
  assert.equal((await r.post(request({}, {origin:'https://attacker.invalid'}))).status,403);
  assert.equal((await r.get(request({}, {id:'0'}))).status,400);
  assert.equal((await r.get(request({}, {id:'456&after=2020'}))).status,400);
});

test('request identifiers preserve bigint decimal text and reject imprecise numbers', () => {
  assert.equal(helper.salesRequestId('123456789012345678'),'123456789012345678');
  for(const value of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'01','1e3','-1',null]) assert.equal(helper.salesRequestId(value),null);
});

test('trigger sends no caller-controlled DB parameters and returns exact server request id', async () => {
  const calls=[];
  const r=routes(async(name,args)=>{calls.push([name,args]);return {requestId:'456',alreadyRunning:true};});
  const response=await r.post(request());
  assert.equal(response.status,202);
  assert.deepEqual(await response.json(),{ok:true,requestId:'456',alreadyRunning:true});
  assert.deepEqual(calls,[['bi_trigger_atomic_sync',{}]]);
});

test('GET cannot confirm another request, historical success or non-atomic completion', async () => {
  for(const value of [{...receipt,requestId:'455'},{...receipt,atomic:false},{...receipt,runId:null},{...receipt,rowsLoaded:0}]) {
    const r=routes(async()=>value);
    const response=await r.get(request());
    assert.equal(response.status,503);
    assert.equal((await response.json()).ok,false);
  }
});

test('verified progress GET remains read-only and only explicit verified POST invalidates', async () => {
  const invalidated=[];
  const calls=[];
  const r=routes(async(name,args)=>{calls.push([name,args]);return receipt;},(...args)=>invalidated.push(args));
  assert.equal((await r.get(request())).status,200);
  assert.equal(invalidated.length,0);
  const response=await r.post(request({completedRequestId:'456'}));
  assert.equal(response.status,200);
  assert.deepEqual(invalidated,[['sales-data'],['sales-data-status'],['/','layout']]);
  assert.deepEqual(calls,[['bi_atomic_sync_progress',{p_request_id:'456'}],['bi_atomic_sync_progress',{p_request_id:'456'}]]);
});

test('pending and failed receipts never invalidate cached reports', async () => {
  for(const value of [{requestId:'456',done:false,status:'unknown'},{requestId:'456',done:true,status:'failed'}]) {
    const r=routes(async()=>value);
    assert.equal((await r.get(request())).status,200);
    assert.equal((await r.post(request({completedRequestId:'456'}))).status,409);
  }
});

test('actual session check compares cookie to existing server password token', async t => {
  const prior=process.env.BI_ACCESS_PASSWORD;
  t.after(()=>{if(prior===undefined)delete process.env.BI_ACCESS_PASSWORD;else process.env.BI_ACCESS_PASSWORD=prior;});
  process.env.BI_ACCESS_PASSWORD='fixture-only-not-real';
  const token=await auth.createAccessToken(process.env.BI_ACCESS_PASSWORD);
  assert.equal(await helper.authorizedSalesRefresh({cookies:{get:()=>({value:token})}}),true);
  assert.equal(await helper.authorizedSalesRefresh({cookies:{get:()=>({value:'bad'})}}),false);
  delete process.env.BI_ACCESS_PASSWORD;
  assert.equal(await helper.authorizedSalesRefresh({cookies:{get:()=>({value:token})}}),false);
});
