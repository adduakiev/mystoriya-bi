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
