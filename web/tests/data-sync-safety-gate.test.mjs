import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(path, dependencies = {}, deno) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022
  }});
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'Deno', outputText)(name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    return require(name);
  }, module, module.exports, deno);
  return module.exports;
}

test('direct refresh POST is blocked without RPC or network before any trigger', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('must not reach network'));
  const route = load('../app/api/data-sync/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/data/source': { callBiRpc: () => assert.fail('must not invoke trigger') }
  });
  const response = await route.POST();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).code, 'SALES_IMPORT_SAFETY_GATE');
});

test('status GET always reports the paused gate without historical success, query influence or side effects', async t => {
  const source = readFileSync(new URL('../app/api/data-sync/status/route.ts', import.meta.url), 'utf8');
  const syntax = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true);
  const imports = syntax.statements.filter(ts.isImportDeclaration);
  assert.equal(imports.length, 1, 'only the response helper may be imported');
  assert.equal(imports[0].moduleSpecifier.text, 'next/server');
  assert.deepEqual(imports[0].importClause.namedBindings.elements.map(item => item.getText(syntax)), ['NextResponse']);
  assert.doesNotMatch(source, /callBiRpc|bi_sync_progress|revalidate|\bfetch\b|\bXMLHttpRequest\b|\bWebSocket\b|\b(?:process|Deno|env|console|require)\b|\bimport\s*\(|\b(?:setTimeout|setInterval|retry|eval|Function)\b|sync_sales_batch|finalize_sales_snapshot|runId|rowsRead|rowsLoaded|cutoff|nextUrl|searchParams/);

  const historicalSuccess = {status:'success', runId:'historical-only', rowsLoaded:46159, cutoffDate:'2026-10-22'};
  const rpc = t.mock.fn(async () => historicalSuccess);
  const revalidate = t.mock.fn(() => assert.fail('must not refresh cached views'));
  t.mock.method(globalThis, 'fetch', () => assert.fail('must not reach network'));
  const {outputText} = ts.transpileModule(source, {compilerOptions: {
    module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022
  }});
  const module = {exports:{}};
  const forbidden = new Proxy({}, {get: () => assert.fail('must not access credentials, environment or logs')});
  new Function('require', 'module', 'exports', 'process', 'Deno', 'console', outputText)(name => {
    if (name === 'next/server') return {NextResponse:Response};
    if (name === '@/lib/data/source') return {callBiRpc:rpc};
    if (name === 'next/cache') return {revalidateTag:revalidate, revalidatePath:revalidate};
    assert.fail(`unexpected status route dependency: ${name}`);
  }, module, module.exports, forbidden, forbidden, forbidden);

  for (const request of [
    undefined,
    new Request('https://fixture.invalid/api/data-sync/status'),
    new Request('https://fixture.invalid/api/data-sync/status?after=2020-01-01&status=success&enabled=true&runId=historical-only'),
    new Request('https://fixture.invalid/api/data-sync/status?after=invalid&after=9999-12-31&gate=false'),
    new Proxy({}, {get: () => assert.fail('must not inspect client input')})
  ]) {
    const response = await module.exports.GET(request);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await response.json(), {
      ok:false, done:false, code:'SALES_IMPORT_SAFETY_GATE',
      error:'Оновлення призупинено: імпорт тимчасово недоступний. Наявні дані збережено.'
    });
  }
  assert.equal(rpc.mock.callCount(), 0);
  assert.equal(revalidate.mock.callCount(), 0);
});

test('actual Edge entrypoint blocks before credentials, import run or source access', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('must not read Google'));
  let handler;
  load('../../supabase/functions/sync-google-sheet/index.ts', {
    'jsr:@supabase/functions-js/edge-runtime.d.ts': {},
    'jsr:@supabase/supabase-js@2': { createClient: () => assert.fail('must not create DB client') },
    './source-safety.mjs': { assertSalesCsvPreflight: () => assert.fail('must not reach parsing') }
  }, { serve: fn => {handler = fn;}, env: {get: () => assert.fail('must not read credentials')} });
  for (const headers of [{}, {'x-bi-sync-key': 'synthetic'}]) {
    const response = await handler(new Request('https://fixture.invalid', {method:'POST', headers}));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {ok:false, code:'SALES_IMPORT_SAFETY_GATE'});
  }
  assert.equal((await handler(new Request('https://fixture.invalid'))).status, 405);
});

test('actual refresh control is disabled and explains the gate without asserting source freshness', () => {
  const {DataSyncControl} = load('../components/DataSyncControl.tsx');
  for (const initialCutoff of [null, '2026-10-26']) {
    const html = renderToStaticMarkup(React.createElement(DataSyncControl, {initialCutoff}));
    assert.match(html, /disabled=""/);
    assert.match(html, /Оновлення призупинено/);
    assert.match(html, /role="status"/);
    assert.doesNotMatch(html, /Sync OK|Готово|401/);
  }
});

test('Edge entrypoint has no dormant public CSV, mutation RPC, secret or bypass path', () => {
  const entry = readFileSync(new URL('../../supabase/functions/sync-google-sheet/index.ts', import.meta.url), 'utf8');
  assert.equal((entry.match(/\bDeno\.serve\s*\(/g) ?? []).length, 1);
  assert.equal((entry.match(/^\s*import\b/gm) ?? []).length, 1);
  assert.match(entry, /SALES_IMPORT_SAFETY_GATE/);
  assert.match(entry, /status:\s*503/);
  assert.match(entry, /status:\s*405/);
  assert.doesNotMatch(entry, /gviz\/tq|sync_sales_batch|finalize_sales_snapshot|\bimport_runs\b|\b(?:fetch|createClient)\s*\(|\b(?:Deno\.env|process\.env)\b/);
});
