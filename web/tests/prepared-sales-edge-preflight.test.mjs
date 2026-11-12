import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { SALES_EDGE_GATES, SALES_EDGE_OFFLINE_CONTRACT, verifyOfflineSalesEdgePreflight }
  from '../../supabase/functions/sync-google-sheet/prepared-sales-edge-preflight.mjs';

const fixture = (state = 'MISSING') => ({ contract: structuredClone(SALES_EDGE_OFFLINE_CONTRACT),
  evidence: Object.fromEntries(SALES_EDGE_GATES.map(id => [id, state])) });
const closed = result => {
  assert.equal(result.status, 'BLOCKED');
  for (const key of ['productionVerified', 'readyForGate', 'manualRefreshEnabled', 'releaseEnabled']) {
    assert.equal(result[key], false);
  }
  assert.equal(result.requiredHttpStatus, 503);
  assert.deepEqual(result.gates.map(g => g.id), SALES_EDGE_GATES);
  assert.ok(result.gates.every(g => g.state === 'HARD_CLOSED'));
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.gates) && Object.isFrozen(result.gates[0]));
};
const rejected = value => {
  const result = verifyOfflineSalesEdgePreflight(value);
  closed(result);
  assert.equal(result.contractValid, false);
  assert.equal(result.code, 'INVALID_OFFLINE_CONTRACT');
  return result;
};

test('v9 production discrepancy is distinct from sealed repository; offline validity never grants authority', () => {
  assert.equal(SALES_EDGE_OFFLINE_CONTRACT.installed.version, 9);
  assert.equal(SALES_EDGE_OFFLINE_CONTRACT.installed.batchSize, 2000);
  assert.equal(SALES_EDGE_OFFLINE_CONTRACT.repository.edgePost, 503);
  for (const state of ['MISSING', 'DECLARED_UNVERIFIED']) {
    const f = fixture(state), result = verifyOfflineSalesEdgePreflight(f);
    closed(result);
    assert.equal(result.contractValid, true);
    assert.equal(result.code, 'REAL_AUTHORITY_NOT_VERIFIED');
    assert.ok(result.gates.every(g => g.evidence === state));
    f.evidence[SALES_EDGE_GATES[0]] = 'tampered';
    assert.equal(result.gates[0].evidence, state);
  }
  assert.throws(() => { SALES_EDGE_OFFLINE_CONTRACT.replacement.releaseEnabled = true; }, TypeError);
});

test('every authority/rollback gate is closed when missing, omitted, claimed or synthetically approved', () => {
  for (const id of SALES_EDGE_GATES) {
    const missing = fixture('DECLARED_UNVERIFIED'); missing.evidence[id] = 'MISSING';
    const result = verifyOfflineSalesEdgePreflight(missing);
    closed(result);
    assert.equal(result.gates.find(g => g.id === id).evidence, 'MISSING');
    const omitted = fixture(); delete omitted.evidence[id]; rejected(omitted);
    for (const claim of [true, 'VERIFIED', 'APPROVED', 'SYNTHETIC_PASS', { signature: 'private-canary' }]) {
      const forged = fixture(); forged.evidence[id] = claim; rejected(forged);
    }
  }
});

test('no success, error, timeout, retry, unknown source, abort or partial read can select a legacy or success path', () => {
  const unsafe = ['https://docs.google.com/spreadsheets/x/gviz/tq', 'sync_sales_batch',
    'finalize_sales_snapshot', 'delete-stale', 'partial-batch-write', 'view-refresh', 'v9', 200, 202, true, null];
  for (const outcome of Object.keys(SALES_EDGE_OFFLINE_CONTRACT.replacement.outcomes)) {
    for (const fallback of unsafe) {
      const f = fixture(); f.contract.replacement.outcomes[outcome] = fallback; rejected(f);
    }
    const f = fixture(); delete f.contract.replacement.outcomes[outcome]; rejected(f);
  }
  for (const source of [...unsafe, 'unknown', 'public-sheet', 'oauth-with-gviz-fallback']) {
    const f = fixture(); f.contract.replacement.source = source; rejected(f);
  }
});

test('version drift, flags, hidden fallbacks, rollback to v9 and confidentiality opt-outs fail closed', () => {
  // Mutate every leaf, not just known unsafe spellings; unknown routing is denied.
  function mutateLeaves(value, path = []) {
    for (const [key, leaf] of Object.entries(value)) {
      if (leaf && typeof leaf === 'object') mutateLeaves(leaf, [...path, key]);
      else {
        const f = fixture(); let parent = f.contract;
        for (const part of path) parent = parent[part];
        parent[key] = typeof leaf === 'boolean' ? !leaf : typeof leaf === 'number' ? leaf + 1 : 'unknown';
        rejected(f);
      }
    }
  }
  mutateLeaves(SALES_EDGE_OFFLINE_CONTRACT);
  for (const extra of [{ enabled: true }, { fallback: 'v9' }, { fetchImpl() {} }, { token: 'private-canary' }]) {
    rejected({ ...fixture(), ...extra });
    const f = fixture(); Object.assign(f.contract.replacement, extra); rejected(f);
  }
});

test('malformed or private input produces only redacted fixed vocabulary; no getters or serialization callbacks', () => {
  const canary = 'PRIVATE_TOKEN_CELL_KEY_SIGNED_PACKET_CANARY';
  for (const input of [undefined, null, true, [], canary, { token: canary },
    { ...fixture(), evidence: { packet: canary } },
    { ...fixture(), toJSON() { assert.fail('serialization callback'); } }]) {
    assert.doesNotMatch(JSON.stringify(rejected(input)), new RegExp(canary));
  }
  for (const location of ['contract', 'evidence']) {
    const f = fixture();
    Object.defineProperty(f, location, { get() { assert.fail('getter executed'); } });
    rejected(f);
  }
  for (const key of [Symbol('hidden'), 'hidden']) {
    const f = fixture(); Object.defineProperty(f.contract, key, { value: canary }); rejected(f);
  }
  const proxy = new Proxy({}, { getPrototypeOf() { throw new Error(canary); } });
  assert.doesNotMatch(JSON.stringify(rejected(proxy)), new RegExp(canary));
});

test('standalone module has no dependencies or I/O even when all evidence is declared; browser remains closed', () => {
  const url = new URL('../../supabase/functions/sync-google-sheet/prepared-sales-edge-preflight.mjs', import.meta.url);
  const source = readFileSync(url, 'utf8');
  assert.doesNotMatch(source, /\bimport\s|\b(?:fetch|setTimeout|createClient)\s*\(|console\.|process\.|Deno\.|\b(?:refresh|release)\s*\(/);
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    globalThis.fetch = () => assert.fail('network');
    globalThis.Deno = { env: { get() { assert.fail('credentials'); } } };
    for (const name of ['log', 'error', 'warn', 'info', 'debug']) console[name] = () => assert.fail('logging');
    const m = await import(${JSON.stringify(url.href)});
    const input = { contract: structuredClone(m.SALES_EDGE_OFFLINE_CONTRACT),
      evidence: Object.fromEntries(m.SALES_EDGE_GATES.map(id => [id, 'DECLARED_UNVERIFIED'])) };
    assert.equal(m.verifyOfflineSalesEdgePreflight(input).releaseEnabled, false);
    globalThis.window = {};
    assert.equal(m.verifyOfflineSalesEdgePreflight(input).contractValid, false);
  `], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
});

test('no active or prepared source imports the offline verifier; Edge/Next/UI remain unchanged and sealed', () => {
  const root = new URL('../../', import.meta.url);
  const moduleName = 'prepared-sales-edge-preflight.mjs';
  function walk(dir) {
    return readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap(e =>
      e.isDirectory() && !['node_modules', '.next'].includes(e.name) ? walk(`${dir}/${e.name}`) :
        e.isFile() ? [`${dir}/${e.name}`] : []);
  }
  for (const file of ['web/app', 'web/lib', 'web/components', 'supabase/functions', 'scripts'].flatMap(walk)
    .filter(f => /\.[cm]?[jt]sx?$/.test(f) && !f.endsWith(`/${moduleName}`))) {
    assert.doesNotMatch(readFileSync(new URL(file, root), 'utf8'),
      /prepared-sales-edge-preflight|verifyOfflineSalesEdgePreflight|SALES_EDGE_OFFLINE_CONTRACT/);
  }
  for (const [file, expected] of [
    ['supabase/functions/sync-google-sheet/index.ts', '7b88be420e93658307b8959905cee2e56c2a79182a6509c9e489685e64a88301'],
    ['web/app/api/data-sync/route.ts', '11b86897dc12bee12c904f799ed42dc9ee7bb8cfeee97e1a588c73ed3ca008d1']
  ]) {
    const source = readFileSync(new URL(file, root), 'utf8');
    assert.equal(createHash('sha256').update(source).digest('hex'), expected);
    assert.match(source, /status:\s*503/);
    assert.match(source, /SALES_IMPORT_SAFETY_GATE/);
    assert.doesNotMatch(source, /\b(?:fetch|createClient)\s*\(|sync_sales_batch|finalize_sales_snapshot|gviz/);
  }
  const ui = readFileSync(new URL('web/components/DataSyncControl.tsx', root), 'utf8');
  assert.equal(createHash('sha256').update(ui).digest('hex'),
    '7d6bda634f866801c35271cbbebd143810b8756da818e92db8951a22cf2cd308');
  assert.match(ui, /\bdisabled\b/);
  assert.doesNotMatch(ui, /\bfetch\s*\(|router\.refresh|onClick|process\.env/);
});
