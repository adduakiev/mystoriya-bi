import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {previewOrigin, probePreview} from '../../scripts/bi-audit-auth-probe.mjs';
const inventory = JSON.parse(readFileSync(new URL('../../docs/audit/2026-10-24/inventory.json', import.meta.url), 'utf8'));
const expectedPaths = [...inventory.routes.map(row => row.path), ...inventory.api.map(row => row.path).filter(path => path !== '/api/auth/login')];
const login = () => new Response('<form action="/api/auth/login"><input name="password" type="password"></form>',{headers:{'content-type':'text/html'}});

test('read-only probe manually follows only same-origin login, never sends authentication or mutation requests', async () => {
  const requests = [];
  const result = await probePreview('https://preview.invalid', async (url, options) => {
    requests.push({url,options});
    const target = new URL(url);
    if (target.pathname === '/login') return login();
    return new Response(null,{status:307,headers:{location:`/login?next=${encodeURIComponent(target.pathname)}`}});
  });
  assert.deepEqual(result.results.map(row => row.path), expectedPaths);
  assert.equal(result.results.find(row=>row.path === '/aggregators/glovo')?.result,'DENIED_TO_LOGIN');
  assert.equal(result.results.find(row=>row.path === '/api/overview/status')?.result,'DENIED_TO_LOGIN');
  for (const path of ['/api/sales-refresh', '/api/sales-refresh/status']) {
    assert.equal(result.results.find(row=>row.path === path)?.result,'DENIED_TO_LOGIN');
  }
  assert.ok(result.results.every(r=>r.result === 'LOGIN_SHELL' || r.result === 'DENIED_TO_LOGIN'));
  for (const {url,options} of requests) {
    assert.equal(new URL(url).origin,'https://preview.invalid');
    assert.equal(options.method,'GET');
    assert.equal(options.credentials,'omit');
    assert.equal(options.redirect,'manual');
    assert.equal(options.body,undefined);
    assert.equal(options.headers,undefined);
  }
});

test('off-origin redirects, Vercel 403, 200 BI payloads and network errors cannot become boundary PASS', async () => {
  for (const response of [()=>new Response(null,{status:307,headers:{location:'https://outside.invalid/login'}}),
    ()=>new Response('forbidden',{status:403}),()=>Response.json({revenue:123}),
    ()=>{throw Object.assign(new Error('Do not persist raw error'),{code:'ENOTFOUND'});}]) {
    let calls=0;
    const result = await probePreview('https://preview.invalid',async ()=>{calls++;return response();});
    assert.equal(calls,expectedPaths.length,'no redirect followed');
    assert.ok(result.results.every(r=>['UNEXPECTED_RESPONSE','BLOCKED_403_LAYER_UNVERIFIED','BLOCKED_NETWORK'].includes(r.result)));
    assert.doesNotMatch(JSON.stringify(result),/Do not persist raw error|revenue/);
  }
});

test('probe refuses credentials, tokens and non-HTTPS origins before any request',()=>{
  for (const url of ['https://user:secret@preview.invalid','https://preview.invalid?token=x','https://preview.invalid/path','http://preview.invalid'])
    assert.throws(()=>previewOrigin(url));
});
