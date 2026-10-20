import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, validatePacket, validateResult, inboxFor } from './run.mjs';
const packet = { as_of: '2026-10-20T00:00:00Z',
  evidence: [{ id: 'e1', observed_at: '2026-10-19T00:00:00Z', summary: 'Test evidence' }] };
const result = agent => ({ agent, summary: 'Test summary', findings: [{
  key: 'coverage', kind: 'fact', insight: 'Coverage exists', action: 'Check completeness',
  evidence_ids: ['e1'], impact_uah: null, impact_basis: 'Not measured'
}] });
test('rejects invented evidence and duplicate evidence', () => {
  assert.throws(() => validatePacket({ ...packet, evidence: [...packet.evidence, ...packet.evidence] }));
  const r = result('a'); r.findings[0].evidence_ids = ['invented'];
  assert.throws(() => validateResult(r, 'a', new Set(['e1'])));
});
test('hypotheses cannot claim measured financial impact', () => {
  const r = result('a'); r.findings[0].kind = 'hypothesis'; r.findings[0].impact_uah = 500;
  assert.throws(() => validateResult(r, 'a', new Set(['e1'])));
});
test('sequential routes, all four inputs to executive, lock and failure handling', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'runtime');
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, 'test-'));
  try {
    const visited = [];
    const bus = run({ packet, stateDir: dir, mode: 'test', invoke(agent, _, inbox) {
      visited.push(agent);
      if (agent === 'agent-executive-lead') assert.equal(inbox.length, 4);
      if (agent === 'agent-seo-content') assert.deepEqual(inbox.map(m => m.from), ['agent-digital-ads']);
      assert.throws(() => run({ packet, stateDir: dir, invoke: result }), /EEXIST/);
      return result(agent);
    } });
    assert.equal(visited.length, 5);
    assert.equal(bus.status, 'completed');
    assert.equal(inboxFor(bus.messages, 'agent-bi-uxui').length, 1);
    assert.throws(() => run({ packet, stateDir: dir, invoke() { throw Error('upstream'); } }));
    const failed = JSON.parse(fs.readFileSync(path.join(dir, 'data_bus.json')));
    assert.equal(failed.status, 'failed');
    assert.equal(failed.messages.length, 0);
    assert.equal(fs.existsSync(path.join(dir, 'runtime', 'run.lock')), false);
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(root) + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
