import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as crypto from 'node:crypto';
import {moduleLoader, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const load = () => moduleLoader({'server-only': {}});
const {createGlovoSheetsHttpTransport: create} = load()('lib/data/glovo-sheets-http-transport.ts');
const {GLOVO_SHEETS_REQUEST: request, prepareGlovoSheetReport: prepare} = load()('lib/data/glovo-sheets-adapter.ts');
const {GLOVO_HEADERS} = load()('lib/data/glovo-contract.ts');
const canary = 'synthetic-private-canary';
const data = () => ({range:"'Дані'!A5:I1000", majorDimension:'ROWS', values:[GLOVO_HEADERS,
  ['2026-01', 'SYNTHETIC new brand', 'SYNTHETIC location', 'SYNTHETIC name', 'SYNTHETIC address', '', 0, 42, 0],
  ['2026-11', 'SYNTHETIC new brand', 'SYNTHETIC location', 'SYNTHETIC name', 'SYNTHETIC address', 2, 10, 43, 1]]});
const response = (text = JSON.stringify(data()), init = {}, metadata = {}) => Object.defineProperties(
  new Response(text, {headers:{'content-type':'application/json; charset=utf-8'}, ...init}),
  {url:{value:request.url, configurable:true}, redirected:{value:false, configurable:true},
    ...Object.fromEntries(Object.entries(metadata).map(([key,value]) => [key,{value, configurable:true}]))});
const bearer = () => ({token:canary, expiresAt:Date.now() + 60000});
function fixture(options = {}) {
  const calls = [], tokens = [];
  const transport = create({enabled:true,
    fetchImpl:async (...args) => {calls.push(args); return response();},
    provideBearer:async signal => {tokens.push(signal); return bearer();}, ...options});
  return {transport, calls, tokens};
}
const fails = async operation => assert.rejects(operation, error => {
  assert.equal(error.message, 'GLOVO_SHEETS_HTTP_REJECTED');
  assert.equal(error.cause, undefined);
  assert.doesNotMatch(String(error.stack), /synthetic-private-canary|SYNTHETIC new brand|Bearer /);
  assert.equal(JSON.stringify(error), '{}');
  return true;
});
beforeEach(t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('real fetch forbidden'));
  t.mock.method(console, 'log', () => assert.fail('logging forbidden'));
  t.mock.method(console, 'error', () => assert.fail('logging forbidden'));
});

test('server-only import/factory are inert; explicit opt-in and both dependencies required', () => {
  load()('lib/data/glovo-sheets-http-transport.ts');
  const f = fixture();
  assert.deepEqual(f.calls, []); assert.deepEqual(f.tokens, []);
  assert.ok(Object.isFrozen(f.transport)); assert.ok(Object.isFrozen(f.transport.authorization));
  for (const invalid of [undefined, null, {}, {enabled:false}, {enabled:true},
    {enabled:true, fetchImpl:fetch}, {enabled:true, provideBearer:async () => bearer()},
    ...[0,-1,0.5,5001,Infinity,NaN,'20'].map(timeoutMs => ({enabled:true, fetchImpl:fetch, provideBearer:async () => bearer(), timeoutMs})),
    {enabled:true, fetchImpl:fetch, provideBearer:async () => bearer(), url:'https://attacker.invalid'},
    {enabled:true, fetchImpl:fetch, provideBearer:async () => bearer(), signal:{aborted:false}}]) {
    assert.throws(() => create(invalid), {message:'GLOVO_SHEETS_HTTP_REJECTED'});
  }
});

test('one official fixed readonly GET returns the strict D291 envelope; no token or body in metadata', async () => {
  const f = fixture();
  const result = await f.transport.getValues(request);
  assert.deepEqual(result, {status:200, url:request.url, redirected:false,
    contentType:'application/json; charset=utf-8', body:data()});
  assert.deepEqual(f.transport.authorization, {spreadsheetId:request.spreadsheetId, scope:request.scope});
  assert.equal(f.calls.length, 1); assert.equal(f.tokens.length, 1);
  const [url, init] = f.calls[0];
  assert.equal(url, request.url);
  assert.deepEqual(Object.keys(init).sort(), ['cache','credentials','headers','method','redirect','signal']);
  assert.equal(new URL(url).origin, 'https://sheets.googleapis.com');
  assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
  assert.equal(init.credentials, 'omit'); assert.equal(init.cache, 'no-store');
  assert.deepEqual(init.headers, {Authorization:`Bearer ${canary}`, Accept:'application/json'});
  assert.equal(init.signal, f.tokens[0]); assert.ok(init.signal instanceof AbortSignal);
  assert.doesNotMatch(url + JSON.stringify(f.transport.authorization), /synthetic-private-canary/);
});

test('HTTP → D291 validator preserves missing versus zero, unverified coverage and Jan–Oct default', async () => {
  const f = fixture();
  const result = await prepare(f.transport, {matrixComplete:true, expectedMatrixRows:3, verifiedMonths:[]});
  assert.equal(f.calls.length, 1); assert.equal(result.status, 'OFFLINE PREPARED');
  assert.equal(result.report.coverage, 'PARTIAL');
  assert.deepEqual(result.report.metrics, {deliveredOrders:null, purchaseSum:0, averageTicket:null});
  assert.equal(result.report.rows.length, 1); assert.equal(result.report.trend.length, 10);
  assert.equal(result.report.rows[0].rawBrand, 'SYNTHETIC new brand');
  assert.equal(result.report.rows[0].ownership, 'UNKNOWN');
  assert.equal(result.report.rows[0].identity, 'UNKNOWN');
  assert.equal(result.report.rows[0].sourceHasNumeric, false);
  assert.equal(result.report.rows[0].month, '2026-01');
  assert.ok(result.report.trend.every(point => point.coverage === 'PARTIAL'));
  const truncated = fixture();
  assert.deepEqual(await prepare(truncated.transport, {matrixComplete:true, expectedMatrixRows:4, verifiedMonths:[]}),
    {status:'SOURCE UNAVAILABLE', report:null, reason:'INVALID_MATRIX'});
});

test('hostile request host/method/source/scope/options reject before token or fetch', async () => {
  for (const invalid of [null, undefined, {},
    ...['https://attacker.invalid', request.url + '&key=' + canary, request.url.replace('https:', 'http:'),
      request.url.replace('sheets.googleapis.com', 'sheets.googleapis.com.attacker.invalid'),
      request.url.replace(request.spreadsheetId, 'wrong')].map(url => ({...request,url})),
    ...[{method:'POST'}, {scope:'write'}, {redirect:'follow'}, {range:'other'}, {spreadsheetId:'other'},
      {majorDimension:'COLUMNS'}, {valueRenderOption:'FORMATTED_VALUE'}, {headers:{Authorization:canary}}]
      .map(change => ({...request,...change}))]) {
    const f = fixture(); await fails(() => f.transport.getValues(invalid));
    assert.equal(f.calls.length, 0); assert.equal(f.tokens.length, 0);
  }
});

test('opaque short-lived bearer validation rejects expired/long-lived/malformed tokens before HTTP', async () => {
  for (const value of [undefined, null, {}, {...bearer(), extra:canary},
    ...['', 'a\r\nInjected: '+canary, 'Bearer '+canary, 'a'.repeat(4097), 'a b', '🔑'].map(token => ({...bearer(),token})),
    ...[0,Date.now()-1,Date.now()+1000,Date.now()+600000,NaN,Infinity,'later'].map(expiresAt => ({...bearer(),expiresAt}))]) {
    const f = fixture({provideBearer:async () => value});
    await fails(() => f.transport.getValues(request)); assert.equal(f.calls.length, 0);
  }
  const f = fixture({provideBearer:async () => {throw Error(canary);}});
  await fails(() => f.transport.getValues(request)); assert.equal(f.calls.length, 0);
});

test('redirect/off-origin/401/403/non-200 and wrong content type reject once and cancel without reading bodies', async () => {
  for (const make of [
    ...[201,204,301,302,307,401,403,404,429,500].map(status => () => response(status === 204 ? null : canary, {status})),
    () => response(canary, {}, {redirected:true}),
    ...['https://attacker.invalid/'+canary, '', request.url.replace(request.spreadsheetId,'other')]
      .map(url => () => response(canary, {}, {url})),
    ...['text/html','text/plain','application/jsonp','text/plain; application/json',null]
      .map(contentType => () => response(canary, {headers:contentType === null ? {} : {'content-type':contentType}}))]) {
    let calls = 0; const upstream = make();
    const f = fixture({fetchImpl:async () => {calls++; return upstream;}});
    await fails(() => f.transport.getValues(request)); assert.equal(calls, 1);
    if (upstream.body) assert.equal(upstream.bodyUsed, true);
  }
});

test('malformed/truncated JSON, invalid UTF-8/envelope and unknown keys are sanitized', async () => {
  for (const text of [canary, '', '{"range":', JSON.stringify(canary), 'null', '[]', '{}',
    ...[{...data(), nextPageToken:canary}, {...data(),values:{}}, {...data(),range:"'Other'!A5:I1000"},
      {...data(),majorDimension:'COLUMNS'}, {data:data()}].map(JSON.stringify),
    new Uint8Array([0xff,0xfe])]) {
    let calls = 0; const f = fixture({fetchImpl:async () => {calls++; return response(text);}});
    await fails(() => f.transport.getValues(request)); assert.equal(calls, 1);
  }
});

test('byte/chunk/length bounds reject oversized, lying, empty and unbounded streams', async () => {
  for (const make of [
    ...['1048577','0','-1','NaN','2.5','99999999999999999999','900'].map(length =>
      () => response('{}', {headers:{'content-type':'application/json','content-length':length}})),
    () => response('x'.repeat(1024*1024+1)),
    () => response('{}', {headers:{'content-type':'application/json','content-encoding':'gzip'}}),
    () => response(new ReadableStream({pull(c) {c.enqueue(new Uint8Array(65536));}})),
    () => response(new ReadableStream({pull(c) {c.enqueue(new Uint8Array([32]));}})),
    () => response(new ReadableStream({start(c) {c.enqueue(new Uint8Array(0)); c.close();}})),
    () => response(new ReadableStream({start(c) {c.enqueue(canary); c.close();}})),
    () => response(new ReadableStream({start(c) {c.error(Error(canary));}}))]) {
    let calls = 0; const f = fixture({fetchImpl:async () => {calls++; return make();}});
    await fails(() => f.transport.getValues(request)); assert.equal(calls, 1);
  }
});

test('bounded UTF-8 stream without content-length accepts multibyte splits; exact length also accepted', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(data()));
  for (const knownLength of [false,true]) {
    let offset = 0;
    const f = fixture({fetchImpl:async () => response(new ReadableStream({pull(c) {
      if (offset === bytes.length) c.close(); else c.enqueue(bytes.slice(offset, ++offset));
    }}), {headers:{'content-type':'application/json', ...(knownLength ? {'content-length':String(bytes.length)} : {})}})});
    assert.deepEqual((await f.transport.getValues(request)).body, data());
  }
});

test('secret-leaking dependency exceptions expose only a fixed error; adapter yields report:null', async () => {
  for (const fetchImpl of [async () => {throw Error('Bearer '+canary+' '+JSON.stringify(data()));},
    async () => null, async () => ({get headers() {throw Error(canary);}}),
    async () => ({headers:new Headers(), status:403, get body() {throw Error(canary);}})]) {
    const f = fixture({fetchImpl}); await fails(() => f.transport.getValues(request));
    assert.deepEqual(await prepare(f.transport, {matrixComplete:true,expectedMatrixRows:3,verifiedMonths:[]}),
      {status:'SOURCE UNAVAILABLE',report:null,reason:'TRANSPORT_FAILED'});
  }
});

test('pre-abort has zero IO; cancellation during token, fetch or stream is bounded even if ignored', async () => {
  const before = new AbortController(); before.abort(Error(canary));
  const f = fixture({signal:before.signal});
  await fails(() => f.transport.getValues(request));
  assert.equal(f.tokens.length, 0); assert.equal(f.calls.length, 0);
  for (const phase of ['token','fetch','body']) {
    const c = new AbortController(); let calls = 0, receivedSignal, cancelCalls = 0;
    const hang = () => {setTimeout(() => c.abort(Error(canary)), 5); return new Promise(() => {});};
    const g = fixture({signal:c.signal,
      provideBearer:async signal => {receivedSignal = signal; return phase === 'token' ? hang() : bearer();},
      fetchImpl:async () => {calls++; return phase === 'fetch' ? hang() : response(new ReadableStream({
        start() {setTimeout(() => c.abort(Error(canary)), 5);}, cancel() {cancelCalls++;}
      }));}});
    await fails(() => g.transport.getValues(request));
    assert.equal(receivedSignal.aborted, true); assert.equal(calls, phase === 'token' ? 0 : 1);
    if (phase === 'body') assert.equal(cancelCalls, 1);
  }
});

test('deadline covers hung token, fetch and body without retries, including non-settling cancellation', async () => {
  for (const phase of ['token','fetch','body']) {
    let calls = 0, receivedSignal;
    const f = fixture({timeoutMs:10,
      provideBearer:async signal => {receivedSignal = signal; return phase === 'token' ? new Promise(() => {}) : bearer();},
      fetchImpl:async () => {calls++; return phase === 'fetch' ? new Promise(() => {}) :
        response(new ReadableStream({cancel() {return new Promise(() => {});}}));}});
    await fails(() => f.transport.getValues(request));
    assert.equal(receivedSignal.aborted, true); assert.equal(calls, phase === 'token' ? 0 : 1);
  }
});

test('late ignored-abort fetch response is cancelled; no second request or fallback', async () => {
  let release, cancelled = 0, calls = 0;
  const f = fixture({timeoutMs:10, fetchImpl:async () => {calls++; return new Promise(resolve => {release = resolve;});}});
  await fails(() => f.transport.getValues(request));
  release(response(new ReadableStream({cancel() {cancelled++;}})));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1); assert.equal(cancelled, 1);
});

test('without configured credential runtime stays unavailable and legacy transport remains inert', async t => {
  const previous = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON;
  t.after(() => previous === undefined ? delete process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON : process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON = previous);
  const forbidden = new Proxy({}, {get() {assert.fail('runtime transport import forbidden');}});
  const runtime = moduleLoader({'server-only':{}, 'node:crypto':crypto, './glovo-sheets-http-transport':forbidden,
    '@/lib/data/glovo-sheets-http-transport':forbidden,
    'next/link':{default:({prefetch,children,...props}) => React.createElement('a', props, children)},
    '@/components/SidebarBrand':{SidebarBrand:() => React.createElement('span', null, 'TEST ONLY · no session/sync')}});
  const state = await runtime('lib/data/glovo-source.ts').loadGlovoSource();
  assert.equal(state.status, 'SOURCE UNAVAILABLE'); assert.equal(state.report, null);
  const html = renderToStaticMarkup(await runtime('app/aggregators/glovo/page.tsx').default());
  assert.match(html, /SOURCE UNAVAILABLE/); assert.doesNotMatch(html, /SYNTHETIC|OFFLINE PREPARED/);
  function scan(dir) {
    for (const entry of fs.readdirSync(new URL('../'+dir+'/', import.meta.url), {withFileTypes:true})) {
      const file = dir+'/'+entry.name;
      if (entry.isDirectory()) scan(file);
      else if (/\.[cm]?[jt]sx?$/.test(file) && file !== 'lib/data/glovo-sheets-http-transport.ts') {
        assert.doesNotMatch(fs.readFileSync(new URL('../'+file, import.meta.url), 'utf8'),
          /glovo-sheets-http-transport|createGlovoSheetsHttpTransport/, file);
      }
    }
  }
  for (const dir of ['app','lib','components']) scan(dir);
  const source = fs.readFileSync(new URL('../lib/data/glovo-sheets-http-transport.ts', import.meta.url), 'utf8');
  assert.match(source, /^import "server-only";/);
  assert.doesNotMatch(source, /process\.env|Deno\.env|console\.|globalThis\.fetch|gviz|oauth2|readFile/);
});
