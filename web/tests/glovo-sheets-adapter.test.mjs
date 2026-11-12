import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as crypto from 'node:crypto';
import {moduleLoader, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const modules = () => moduleLoader({'server-only': {}});
const {GLOVO_SHEETS_REQUEST: request, prepareGlovoSheetReport: prepare} = modules()('lib/data/glovo-sheets-adapter.ts');
const {GLOVO_HEADERS, GLOVO_DEFAULT_MONTHS} = modules()('lib/data/glovo-contract.ts');
// Synthetic types/labels/figures only; no customer/order/financial source records.
const row = (changes = {}) => Object.assign(['2026-01', 'SYNTHETIC shared brand', 'SYNTHETIC location A',
  'SYNTHETIC name', 'SYNTHETIC address', 2, 10, 42, 1], changes);
const matrix = (...rows) => [GLOVO_HEADERS, ...rows];
const authorization = {spreadsheetId:request.spreadsheetId, scope:request.scope};
const evidence = (expectedMatrixRows = 2, verifiedMonths = []) => ({matrixComplete:true, expectedMatrixRows, verifiedMonths});
const envelope = values => ({status:200, url:request.url, redirected:false, contentType:'application/json; charset=utf-8',
  body:{range:"'Дані'!A5:I1000", majorDimension:'ROWS', values}});
const transport = response => ({authorization, getValues:async descriptor => {
  assert.equal(descriptor, request);
  return response;
}});
const rejected = (result, reason) => {
  assert.deepEqual(result, {status:'SOURCE UNAVAILABLE', report:null, reason});
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC|private-canary/);
};

test('inert server-only descriptor pins the approved official readonly values.get request without IO', t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('no real request allowed'));
  const isolated = modules()('lib/data/glovo-sheets-adapter.ts');
  assert.deepEqual(isolated.GLOVO_SHEETS_REQUEST, request);
  assert.ok(Object.isFrozen(request));
  assert.throws(() => {request.range = 'arbitrary';}, TypeError);
  const url = new URL(request.url);
  assert.equal(url.origin, 'https://sheets.googleapis.com');
  assert.equal(decodeURIComponent(url.pathname),
    '/v4/spreadsheets/1HyYPtd1A369n7FYs0Oty_Z2oCZaq5hBxe4E-g2B0k98/values/\'Дані\'!A5:I');
  assert.deepEqual([...url.searchParams], [['majorDimension','ROWS'], ['valueRenderOption','UNFORMATTED_VALUE']]);
  assert.equal(request.range, "'Дані'!A5:I");
  assert.equal(request.method, 'GET');
  assert.equal(request.redirect, 'error');
  assert.equal(request.scope, 'https://www.googleapis.com/auth/spreadsheets.readonly');
  const source = fs.readFileSync(new URL('../lib/data/glovo-sheets-adapter.ts', import.meta.url), 'utf8');
  assert.match(source, /^import "server-only";/);
  assert.doesNotMatch(source, /process\.env|\bfetch\s*\(|console\.|google-sheet-reader|Sales|gviz|oauth2|access_token|Authorization:/);
});

test('injected descriptor → validated matrix → existing normalizer/builder retains brands, location lineage and historical scope', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('injected test only'));
  const values = matrix(...GLOVO_DEFAULT_MONTHS.flatMap(month => [row({0:month}),
    row({0:month, 2:'SYNTHETIC location B', 5:8, 6:30, 7:43, 8:0})]),
  row({1:'SYNTHETIC newly discovered', 5:1, 6:5}), row({0:'2026-11', 5:999999, 6:999999}));
  let calls = 0;
  const result = await prepare({authorization, getValues:async descriptor => {
    calls++;
    assert.equal(descriptor, request);
    return envelope(values);
  }}, evidence(23, GLOVO_DEFAULT_MONTHS));
  assert.equal(calls, 1);
  assert.equal(result.status, 'OFFLINE PREPARED');
  const {report} = result;
  assert.equal(report.coverage, 'COMPLETE');
  assert.deepEqual(report.metrics, {deliveredOrders:101, purchaseSum:405, averageTicket:405/101});
  assert.deepEqual(report.brands, ['SYNTHETIC newly discovered', 'SYNTHETIC shared brand']);
  assert.equal(report.rows.length, 21);
  assert.equal(report.trend.length, 10);
  assert.ok(report.rows.every(r => r.month !== '2026-11'));
  const shared = report.rows.filter(r => r.month === '2026-01' && r.rawBrand === 'SYNTHETIC shared brand');
  assert.equal(new Set(shared.map(r => r.key)).size, 2);
  assert.deepEqual(shared.map(r => r.sourceLocation), ['SYNTHETIC location A', 'SYNTHETIC location B']);
  assert.deepEqual(shared.map(r => r.sourceRow), [42,43]);
  assert.deepEqual(shared.map(r => r.sourceHasNumeric), [true,false]);
  for (const r of report.rows) {
    assert.equal(r.physicalLocation, null);
    assert.equal(r.ownership, 'UNKNOWN');
    assert.equal(r.identity, 'UNKNOWN');
    assert.equal(r.normalizedGroup, null);
    assert.equal(Object.hasOwn(r, 'currency'), false);
    assert.equal(Object.hasOwn(r, 'fulfilled'), false);
  }
});

test('native I=0/1 preserves measured zero versus blank/null and independently incomplete monthly coverage', async () => {
  for (const flag of [0,1]) {
    for (const [measure, expected] of [[0,0], ['',null]]) {
      const result = await prepare(transport(envelope(matrix(row({5:measure, 6:measure, 8:flag})))), evidence(2, ['2026-01']));
      assert.equal(result.status, 'OFFLINE PREPARED');
      assert.deepEqual(result.report.metrics, {deliveredOrders:expected, purchaseSum:expected, averageTicket:null});
      assert.equal(result.report.rows[0].deliveredOrders, expected);
      assert.equal(result.report.rows[0].sourceHasNumeric, flag === 1);
      assert.equal(result.report.coverage, 'PARTIAL');
      assert.equal(result.report.trend[0].coverage, measure === 0 ? 'COMPLETE' : 'PARTIAL');
    }
  }
  const values = matrix(...GLOVO_DEFAULT_MONTHS.map(month => row({0:month})));
  const result = await prepare(transport(envelope(values)), evidence(11, ['2026-01']));
  assert.equal(result.report.coverage, 'PARTIAL');
  assert.equal(result.report.trend.filter(point => point.coverage === 'COMPLETE').length, 1);
});

test('missing/wrong authorization and absent independent full-matrix evidence fail before invoking transport', async () => {
  const getValues = () => assert.fail('invalid caller must not invoke transport');
  for (const auth of [undefined, null, {}, {...authorization, spreadsheetId:'other'}, {...authorization, scope:'write'},
    {...authorization, token:'private-canary'}]) {
    rejected(await prepare({authorization:auth, getValues}, evidence()), 'AUTHORIZATION_REQUIRED');
  }
  for (const invalid of [null, undefined, {}, {authorization}, {authorization, getValues:'not a function'}]) {
    rejected(await prepare(invalid, evidence()), 'AUTHORIZATION_REQUIRED');
  }
  for (const invalid of [undefined, null, {}, {...evidence(), matrixComplete:false},
    ...[0,1,-1,2.5,NaN,Infinity,'2'].map(expectedMatrixRows => ({...evidence(), expectedMatrixRows})),
    {...evidence(), verifiedMonths:undefined}, evidence(2, ['2026-13']), evidence(2, ['2026-01','2026-01']),
    {...evidence(), nextPageToken:'private-canary'}]) {
    rejected(await prepare({authorization, getValues}, invalid), 'COVERAGE_REQUIRED');
  }
});

test('redirects, arbitrary hosts/IDs, denial, HTML and unknown response envelopes fail closed with no fallback or logging', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('no fallback'));
  t.mock.method(console, 'log', () => assert.fail('no raw logging'));
  t.mock.method(console, 'error', () => assert.fail('no raw logging'));
  const ok = envelope(matrix(row()));
  for (const invalid of [null, 'private-canary', {},
    ...[301,302,401,403,404,429,500].map(status => ({...ok, status})),
    {...ok, redirected:true}, {...ok, url:'https://attacker.invalid/private-canary'},
    {...ok, url:request.url.replace(request.spreadsheetId, 'other')},
    {...ok, contentType:'text/html'}, {...ok, contentType:'application/jsonp'},
    {...ok, contentType:'text/plain; application/json'}, {...ok, nextPageToken:'private-canary'}]) {
    let calls = 0;
    rejected(await prepare({authorization, getValues:async () => {calls++; return invalid;}}, evidence()), 'INVALID_RESPONSE');
    assert.equal(calls, 1);
  }
  rejected(await prepare({authorization, getValues:async () => {throw Error('private-canary');}}, evidence()), 'TRANSPORT_FAILED');
});

test('unknown/partial provider bodies, wrong ranges, headers, extra columns and hostile typed cells expose no report', async () => {
  const ok = envelope(matrix(row()));
  const body = ok.body;
  const bodies = [null, '<html>private-canary</html>', JSON.stringify(body), {}, {data:body},
    {...body, nextPageToken:'private-canary'}, {...body, majorDimension:'COLUMNS'},
    ...["'Other'!A5:I1000", "'Дані'!A1:I1000", "'Дані'!A5:J1000", "'Дані'!A5:I5", "'Дані'!A5:I", "'Дані'!A5:I99999999999999999999"].map(range => ({...body, range})),
    ...[undefined, 'private-canary', {}, [], [GLOVO_HEADERS], [row()],
      [['<html>private-canary</html>'], row()], [[...GLOVO_HEADERS].reverse(), row()],
      [[...GLOVO_HEADERS, 'extra'], row()], matrix([...row(), 'extra']), matrix(Array(10).fill('')),
      [GLOVO_HEADERS, null], matrix(row({5:'0'})), matrix(row({6:'10'})), matrix(row({5:false})),
      matrix(row({5:null})), matrix(row({6:NaN})), matrix(row({6:-1})), matrix(row({5:1.5})),
      matrix(row({7:'42'})), matrix(row({8:true})), matrix(row({8:'1'})), matrix(row({8:2})),
      matrix(row({1:{html:'private-canary'}})), matrix(row().slice(0,8)), matrix(Array(9))].map(values => ({...body, values}))];
  for (const invalid of bodies) rejected(await prepare(transport({...ok, body:invalid}), evidence()), 'INVALID_MATRIX');
  // A plausible header+row cannot masquerade as a complete larger matrix.
  rejected(await prepare(transport(ok), evidence(3)), 'INVALID_MATRIX');
  rejected(await prepare(transport(envelope(matrix(row(), row()))), evidence(3)), 'INVALID_MATRIX');
  rejected(await prepare(transport(ok), evidence(2, ['2026-02'])), 'COVERAGE_REQUIRED');
});

test('coverage evidence is snapshotted before the injected asynchronous dependency runs', async () => {
  const coverage = evidence();
  const result = await prepare({authorization, getValues:async () => {
    coverage.expectedMatrixRows = 999;
    coverage.verifiedMonths.push('2026-01');
    return envelope(matrix(row()));
  }}, coverage);
  assert.equal(result.status, 'OFFLINE PREPARED');
  assert.equal(result.report.trend[0].coverage, 'PARTIAL');
});

test('without configured credential loader/page fail closed and legacy adapter remains disconnected', async t => {
  const previous = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON;
  t.after(() => previous === undefined ? delete process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON : process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON = previous);
  t.mock.method(globalThis, 'fetch', () => assert.fail('zero network calls'));
  let adapterCalls = 0;
  const forbidden = {prepareGlovoSheetReport:() => {adapterCalls++; assert.fail('live adapter call');}};
  const load = moduleLoader({
    'server-only': {}, 'node:crypto':crypto,
    './glovo-sheets-adapter':forbidden,
    '@/lib/data/glovo-sheets-adapter':forbidden,
    'next/link':{default:({prefetch, children, ...props}) => React.createElement('a', props, children)},
    '@/components/SidebarBrand':{SidebarBrand:() => React.createElement('span', null, 'TEST ONLY · no session/sync')}
  });
  const state = await load('lib/data/glovo-source.ts').loadGlovoSource();
  assert.equal(state.status, 'SOURCE UNAVAILABLE');
  assert.equal(state.report, null);
  const html = renderToStaticMarkup(await load('app/aggregators/glovo/page.tsx').default());
  assert.match(html, /SOURCE UNAVAILABLE/);
  assert.doesNotMatch(html, /SYNTHETIC|OFFLINE PREPARED|KPI · COMPLETE|KPI · PARTIAL/);
  assert.equal(adapterCalls, 0);
  for (const file of ['lib/data/glovo-source.ts', 'app/aggregators/glovo/page.tsx']) {
    const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /glovo-sheets-adapter|\bfetch\s*\(|getValues\s*\(/);
  }
});
