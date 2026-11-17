import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function load() {
  const source = readFileSync(new URL('../lib/sales-refresh-client.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  }});
  const module = { exports: {} };
  new Function('module', 'exports', outputText)(module, module.exports);
  return module.exports;
}
const response = (value, status = 200) => Response.json(value, { status });
const success = { ok: true, requestId: '456', done: true, status: 'success', atomic: true, cutoffDate: '2026-11-15' };
function storage() {
  const entries = new Map();
  return { entries, getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
}
function run(helper, store, fetchImpl, step = 2000, signal = new AbortController().signal) {
  let time = 0;
  return helper.checkSalesRefresh({ store, signal, fetchImpl, now: () => time,
    wait: async () => { signal.throwIfAborted(); time += step; } });
}

test('timeout survives a page reload and resumes the same GET without another trigger POST', async () => {
  const persisted = storage(), first = load(), store = first.createSalesRefreshStore(persisted), calls = [];
  const result = await run(first, store, async (url, init) => {
    calls.push([url, init.body]);
    return response(init.body === '{}' ? { ok: true, requestId: '456' } :
      { ok: true, requestId: '456', done: false, status: 'unknown' });
  }, 180000);
  assert.equal(result.status, 'pending');
  assert.deepEqual(store.read(), { requestId: '456' });
  const reloaded = load(), resumed = reloaded.createSalesRefreshStore(persisted);
  assert.deepEqual(await run(reloaded, resumed, async (url, init) => {
    calls.push([url, init.body]); return response(success);
  }), { status: 'success', cutoffDate: '2026-11-15' });
  assert.equal(calls.filter(([, body]) => body === '{}').length, 1);
  assert.deepEqual(calls.slice(2), [
    ['/api/sales-refresh/status?requestId=456', undefined],
    ['/api/sales-refresh', '{"completedRequestId":"456"}']
  ]);
  assert.equal(resumed.read(), null);
  assert.equal(persisted.entries.size, 0);
});

test('three transient status failures keep the request and retry uses GET only until confirmation', async () => {
  const h = load(), store = h.createSalesRefreshStore(); store.write({ requestId: '456' });
  let failures = 0;
  const result = await run(h, store, async (url, init) => {
    assert.equal(init.method, undefined); assert.match(url, /requestId=456$/);
    failures++; throw new Error('offline');
  });
  assert.equal(failures, 3); assert.equal(result.status, 'pending');
  assert.deepEqual(h.createSalesRefreshStore().read(), { requestId: '456' });
  assert.equal((await run(h, store, async (url, init) => {
    assert.notEqual(init.body, '{}'); return response(success);
  })).status, 'success');
});

test('lost confirmation reply preserves the receipt and never starts another import', async () => {
  const h = load(), store = h.createSalesRefreshStore(); store.write({ requestId: '456' });
  assert.equal((await run(h, store, async (url, init) => {
    if (init.method === 'POST') throw new Error('lost reply');
    return response(success);
  })).status, 'pending');
  assert.deepEqual(store.read(), { requestId: '456' });
  assert.equal((await run(h, store, async (url, init) => {
    assert.notEqual(init.body, '{}'); return response(success);
  })).status, 'success');
});

test('uncertain initial trigger persists before dispatch and blocks blind retries, including after reload', async () => {
  for (const fail of [async () => { throw new Error('lost reply'); },
    async () => response({ ok: false }, 503), async () => response({ ok: true, requestId: 'invalid' })]) {
    const h = load(), persisted = storage(), store = h.createSalesRefreshStore(persisted);
    const result = await run(h, store, async (...args) => {
      assert.deepEqual(store.read(), { uncertain: true }); return fail(...args);
    });
    assert.equal(result.status, 'pending'); assert.equal(result.message, h.uncertainRefreshMessage);
    const reloaded = load();
    const resumed = await run(reloaded, reloaded.createSalesRefreshStore(persisted),
      () => assert.fail('uncertain trigger must not be repeated'));
    assert.equal(resumed.status, 'pending');
  }
});

test('unmount abort preserves a known request, and an aborted trigger remains uncertain', async () => {
  for (const known of [true, false]) {
    const h = load(), store = h.createSalesRefreshStore(), controller = new AbortController();
    if (known) store.write({ requestId: '456' });
    const result = await run(h, store, async () => {
      controller.abort(); throw new Error('aborted');
    }, 2000, controller.signal);
    assert.equal(result.status, 'pending');
    assert.deepEqual(store.read(), known ? { requestId: '456' } : { uncertain: true });
  }
});

test('wrong or non-atomic completion stays pending; only matching terminal failure clears the receipt', async () => {
  for (const value of [{ ...success, requestId: '455' }, { ...success, atomic: false },
    { ...success, status: 'unverified' }]) {
    const h = load(), store = h.createSalesRefreshStore(); store.write({ requestId: '456' });
    assert.equal((await run(h, store, async (url, init) => {
      assert.notEqual(init.method, 'POST'); return response(value);
    })).status, 'pending');
    assert.deepEqual(store.read(), { requestId: '456' });
  }
  const h = load(), store = h.createSalesRefreshStore(); store.write({ requestId: '456' });
  assert.equal((await run(h, store, async () => response({
    ok: true, requestId: '456', done: true, status: 'failed'
  }))).status, 'failed');
  assert.equal(store.read(), null);
});

test('definite pre-dispatch authorization rejection allows retry; storage denial retains in-memory protection', async () => {
  const h = load(), denied = { getItem() { throw new Error('disabled'); },
    setItem() { throw new Error('disabled'); }, removeItem() { throw new Error('disabled'); } };
  const store = h.createSalesRefreshStore();
  assert.equal((await run(h, store, async () => response({ error: 'Unauthorized' }, 401))).status, 'failed');
  assert.equal(store.read(), null);
  store.write({ requestId: '456' });
  const remounted = h.createSalesRefreshStore(denied);
  assert.deepEqual(remounted.read(), { requestId: '456' });
});

test('failed storage removal cannot resurrect a completed request after success or remount', async () => {
  const h = load(), persisted = storage();
  persisted.removeItem = () => { throw new Error('removal denied'); };
  const store = h.createSalesRefreshStore(persisted);
  store.write({ requestId: '456' });
  assert.equal((await run(h, store, async () => response(success))).status, 'success');
  assert.equal(persisted.entries.size, 1, 'old bytes really remain in storage');
  assert.equal(store.read(), null);
  const remounted = h.createSalesRefreshStore(persisted);
  assert.equal(remounted.read(), null);
  let triggers = 0;
  assert.equal((await run(h, remounted, async (url, init) => {
    if (init.body === '{}') { triggers++; return response({ ok: true, requestId: '789' }); }
    assert.ok(url.endsWith('requestId=789') || init.body === '{"completedRequestId":"789"}');
    return response({ ...success, requestId: '789' });
  })).status, 'success');
  assert.equal(triggers, 1, 'a later explicit refresh starts one new request');
  assert.equal(remounted.read(), null);
});

test('failed storage set cannot replace a newer uncertainty marker with an older request', () => {
  const h = load(), persisted = storage(), store = h.createSalesRefreshStore(persisted);
  store.write({ requestId: '456' });
  persisted.setItem = () => { throw new Error('quota'); };
  store.write({ uncertain: true });
  assert.deepEqual(store.read(), { uncertain: true });
  assert.deepEqual(h.createSalesRefreshStore(persisted).read(), { uncertain: true });
});
