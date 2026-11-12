import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import {moduleLoader} from './support/bi-preview-harness.mjs';
const modules = moduleLoader({'server-only':{}, 'node:crypto':crypto});
const {readGlovoPrivateSheet:read} = modules('lib/data/glovo-private-runtime.ts');
const {glovoGoogleBearer:auth} = modules('lib/data/glovo-google-auth.ts');
const {glovoPrivateJson:json} = modules('lib/data/glovo-private-http.ts');
const {GLOVO_HEADERS} = modules('lib/data/glovo-contract.ts');
const key = crypto.generateKeyPairSync('rsa', {modulusLength:2048});
const credential = JSON.stringify({type:'service_account',client_email:'synthetic@synthetic.iam.gserviceaccount.com',
  private_key:key.privateKey.export({type:'pkcs8',format:'pem'})});
const id = '1HyYPtd1A369n7FYs0Oty_Z2oCZaq5hBxe4E-g2B0k98';
const meta = rows => ({spreadsheetId:id,sheets:[{properties:{sheetId:1135188423,title:'Дані',gridProperties:{rowCount:rows,columnCount:26}}}]});
const row = (month='2026-01', brand='SYNTHETIC brand', orders=2, sum=10) =>
  [month,brand,'SYNTHETIC group','SYNTHETIC name','SYNTHETIC address',orders,sum,42,1];
const matrix = () => ({range:"'Дані'!A5:I1000",majorDimension:'ROWS',values:[GLOVO_HEADERS,row(),row('2026-11','SYNTHETIC new brand',null,0)]});
const response = (url,body,status=200) => Object.defineProperties(new Response(JSON.stringify(body),
  {status,headers:{'content-type':'application/json'}}),{url:{value:url},redirected:{value:false}});
function fixture(change = () => {}) {
  const calls = [];
  const fetchImpl = async (url,init) => {
    calls.push({url,init});
    let body = url.includes('oauth2') ? {access_token:'synthetic-private-token',token_type:'Bearer',expires_in:3600}
      : url.includes('/values/') ? matrix() : meta(1000);
    body = change(body,calls.length) ?? body;
    return response(url,body);
  };
  return {calls,fetchImpl};
}

test('private runtime performs fixed readonly OAuth and metadata-bound full grid read; missing stays missing and coverage partial', async () => {
  const f = fixture();
  const result = await read(credential,f.fetchImpl);
  assert.equal(f.calls.length,4);
  const tokenCall = f.calls[0];
  assert.equal(tokenCall.url,'https://oauth2.googleapis.com/token');
  assert.equal(tokenCall.init.method,'POST');
  const assertion = new URLSearchParams(tokenCall.init.body).get('assertion');
  const [header,payload,signature] = assertion.split('.');
  const claims = JSON.parse(Buffer.from(payload,'base64url'));
  assert.equal(claims.scope,'https://www.googleapis.com/auth/spreadsheets.readonly');
  assert.equal(claims.aud,tokenCall.url); assert.equal(claims.exp-claims.iat,300);
  assert.equal(claims.sub,undefined);
  assert.ok(crypto.verify('RSA-SHA256',Buffer.from(`${header}.${payload}`),key.publicKey,Buffer.from(signature,'base64url')));
  for (const {url,init} of f.calls) {
    assert.equal(init.cache,'no-store'); assert.equal(init.redirect,'error'); assert.equal(init.credentials,'omit');
    assert.ok(init.signal instanceof AbortSignal);
    if (!url.includes('oauth2')) { assert.equal(init.method,'GET'); assert.equal(init.headers.Authorization,'Bearer synthetic-private-token'); }
  }
  assert.match(decodeURIComponent(f.calls[2].url), /'Дані'!A5:I1000\?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE$/);
  assert.deepEqual(result.report.months,['2026-01','2026-11']);
  assert.equal(result.latestEventMonth,'2026-11');
  assert.equal(result.report.rows[1].deliveredOrders,null); assert.equal(result.report.rows[1].purchaseSum,0);
  assert.ok(result.report.trend.every(point => point.coverage === 'PARTIAL'));
  assert.equal(result.report.rows[0].identity,'UNKNOWN');
  assert.doesNotMatch(JSON.stringify(result),/private-token|private_key|access_token/);
});

test('new brands and grid growth work without old hardcoded matrix size', async () => {
  const f = fixture(body => {
    if (body.sheets) return meta(2000);
    if (body.values) return {...body,range:"'Дані'!A5:I2000",values:[...body.values,row('2026-12','SYNTHETIC future')]};
  });
  const result = await read(credential,f.fetchImpl);
  assert.equal(result.report.rows.length,3); assert.equal(result.latestEventMonth,'2026-12');
});

test('fails closed for changed grid, mismatched sheet identity/range, oversized matrix, malformed measures and partial envelopes', async () => {
  for (const change of [
    (b,n) => n===4 ? meta(1001) : b,
    b => b.sheets ? {...b,spreadsheetId:'other'} : b,
    b => b.sheets ? {...b,sheets:[{properties:{sheetId:1,title:'Дані',gridProperties:{rowCount:1000,columnCount:26}}}]} : b,
    b => b.sheets ? meta(50001) : b,
    b => b.values ? {...b,range:"'Дані'!A5:I400"} : b,
    b => b.values ? {...b,values:[GLOVO_HEADERS,row('2026-01','SYNTHETIC',-1)]} : b,
    b => b.values ? {...b,values:[GLOVO_HEADERS,row('2026-01','SYNTHETIC','2')]} : b,
    b => b.values ? {...b,values:[GLOVO_HEADERS,...Array.from({length:997},(_,i)=>row('2026-01',`SYNTHETIC ${i}`))]} : b,
    b => b.values ? {...b,values:undefined} : b,
    b => b.values ? {...b,values:[GLOVO_HEADERS,row(),row()]} : b
  ]) await assert.rejects(read(credential,fixture(change).fetchImpl),{message:'GLOVO_SOURCE_UNAVAILABLE'});
});

test('credential absence/malformed/custom token endpoint fail before network and sanitize errors', async () => {
  for (const account of [undefined,'secret-canary','{}',JSON.stringify({type:'service_account',client_email:'bad',private_key:'secret-canary'}),
    JSON.stringify({...JSON.parse(credential),token_uri:'https://attacker.invalid'})]) {
    let calls = 0;
    await assert.rejects(auth(account,async()=>{calls++;throw Error('secret-canary');}),{message:'GLOVO_AUTH_UNAVAILABLE'});
    assert.equal(calls,0);
  }
  await assert.rejects(read(credential,async()=>{throw Error('secret-canary');}),error=> {
    assert.equal(error.message,'GLOVO_SOURCE_UNAVAILABLE'); assert.equal(error.cause,undefined);
    assert.doesNotMatch(error.stack,/secret-canary/); return true;
  });
});

test('private HTTP rejects incomplete, oversized, redirected, non-JSON and wrong destination responses', async () => {
  const url='https://sheets.googleapis.com/test';
  for (const res of [response(url,{error:'secret-canary'},403),response('https://attacker.invalid',{}),
    new Response('secret-canary',{headers:{'content-type':'text/html'}}),
    Object.defineProperties(new Response('{"incomplete":',{headers:{'content-type':'application/json'}}),{url:{value:url}}),
    response(url,{data:'x'.repeat(1024*1024)})]) {
    await assert.rejects(json(async()=>res,url,{method:'GET'}),{message:'GLOVO_PRIVATE_READ_REJECTED'});
  }
});

test('private HTTP deadline bounds hung fetch and hung body even when dependencies ignore abort', async t => {
  const realTimeout = globalThis.setTimeout;
  t.mock.method(globalThis,'setTimeout',(callback,_delay)=>realTimeout(callback,10));
  const url='https://sheets.googleapis.com/test';
  let signal;
  const pending=json(async (_url,init)=>{signal=init.signal;return new Promise(()=>{});},url,{method:'GET'});
  const rejected=assert.rejects(pending,{message:'GLOVO_PRIVATE_READ_REJECTED'});
  await rejected; assert.equal(signal.aborted,true);
  const stream=new ReadableStream({pull(){return new Promise(()=>{});}});
  const res=Object.defineProperties(new Response(stream,{headers:{'content-type':'application/json'}}),{url:{value:url},redirected:{value:false}});
  const body=json(async()=>res,url,{method:'GET'});
  const bodyRejected=assert.rejects(body,{message:'GLOVO_PRIVATE_READ_REJECTED'});
  await Promise.resolve(); await Promise.resolve();
  await bodyRejected;
});
