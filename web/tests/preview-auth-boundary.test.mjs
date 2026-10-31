import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {moduleLoader} from './support/bi-preview-harness.mjs';
const require = createRequire(import.meta.url);
const {NextRequest} = require('next/server');
const audit = JSON.parse(fs.readFileSync(new URL('../../docs/audit/2026-10-24/inventory.json', import.meta.url)));

function fixturePassword(t, configured = true) {
  const previous = process.env.BI_ACCESS_PASSWORD;
  if (configured) process.env.BI_ACCESS_PASSWORD = 'SYNTHETIC-local-auth-test-only';
  else delete process.env.BI_ACCESS_PASSWORD;
  t.after(() => previous === undefined ? delete process.env.BI_ACCESS_PASSWORD : process.env.BI_ACCESS_PASSWORD = previous);
  t.mock.method(globalThis, 'fetch', () => assert.fail('Auth boundary must not fetch data'));
}

for (const configured of [false, true]) {
  test(`middleware denies all protected pages/API methods without credentials; password configured=${configured}`, async t => {
    fixturePassword(t, configured);
    const {middleware, config} = moduleLoader()('middleware.ts');
    for (const route of [...audit.routes, ...audit.api]) {
      const pathname = route.path;
      if (['/login', '/api/auth/login'].includes(pathname)) continue;
      assert.ok(config.matcher.some(pattern => new RegExp(`^${pattern}$`).test(pathname)), `middleware matcher protects ${pathname}`);
      for (const method of pathname.startsWith('/api/') ? ['GET', 'POST', 'PATCH', 'DELETE'] : ['GET']) {
        const response = await middleware(new NextRequest(`https://preview.invalid${pathname}?audit=1`, {method}));
        assert.equal(response.status, 307, `${method} ${pathname}`);
        const target = new URL(response.headers.get('location'));
        assert.equal(target.origin, 'https://preview.invalid');
        assert.equal(target.pathname, '/login');
        assert.equal(target.searchParams.get('next'), configured ? `${pathname}?audit=1` : null);
        assert.equal(response.headers.get('set-cookie'), null);
      }
    }
    for (const pathname of ['/login', '/api/auth/login']) {
      const response = await middleware(new NextRequest(`https://preview.invalid${pathname}`));
      assert.equal(response.headers.get('x-middleware-next'), '1');
    }
  });
}

test('forged local cookie is rejected; query redirect remains same-origin without a session cookie', async t => {
  fixturePassword(t);
  const {middleware} = moduleLoader()('middleware.ts');
  const response = await middleware(new NextRequest('https://preview.invalid/digital?from=2026-09-24&to=2026-10-23', {
    headers: {cookie: 'myastoriya_bi_access=synthetic-invalid-token'}
  }));
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location')).searchParams.get('next'), '/digital?from=2026-09-24&to=2026-10-23');
});

test('Operating API handlers independently reject missing credentials before collectors/task IO', async t => {
  fixturePassword(t);
  const denied = () => assert.fail('Unauthorized handler reached IO');
  const load = moduleLoader({
    '@/lib/data/source': {callBiRpc: denied},
    '@/lib/operating-collector': {collectInput: denied},
    '@/lib/operating-task-store': {readTasks: denied, addCouncilTask: denied, updateTask: denied},
    '@/lib/operating-manual': {manualRunAvailability: denied, requestManualRun: denied}
  });
  for (const [route, methods] of [['input', ['GET']], ['runs', ['GET', 'POST']], ['tasks', ['GET', 'POST', 'PATCH']]]) {
    const handler = load(`app/api/operating/${route}/route.ts`);
    for (const method of methods) {
      const response = await handler[method](new NextRequest(`https://preview.invalid/api/operating/${route}`, {method}));
      assert.equal(response.status, 401, `${method} ${route}`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), {error: 'Unauthorized'});
    }
  }
});
