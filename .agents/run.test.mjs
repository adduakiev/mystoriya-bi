import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, validatePacket, validateResult, inboxFor } from './run.mjs';
const packet = { version: 2, as_of: '2026-10-20T00:00:00Z',
  evidence: ['sales','ads','seo','ux'].map((domain,i)=>({id:`e${i+1}`,domain,source:'test',label:'Test metric',unit:'count',
  source_date:'2026-10-19',observed_at:null,fetched_at:'2026-10-20T00:00:00Z',period_from:'2026-10-19',period_to:'2026-10-19',
  value:10,previous:null,target:null,forecast:null,direction:'neutral',source_status:'AVAILABLE',coverage:'FULL',confidence:1,
  freshness_sla_days:2,expected_dates:1,observed_dates:1,duplicate_rows:0,attribution:'none'})) };
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
test('independent sequential domains, Council and Astra, lock and failure handling', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'runtime');
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, 'test-'));
  try {
    const visited = [];
    const bus = run({ packet, stateDir: dir, mode: 'test', invoke(agent, _, inbox) {
      visited.push(agent);
      assert.deepEqual(inbox, []);
      assert.equal(_.evidence.length,1);
      assert.throws(() => run({ packet, stateDir: dir, invoke: result }), /EEXIST/);
      const r=result(agent);r.findings[0].key=agent;r.findings[0].evidence_ids=[_.evidence[0].id];return r;
    } });
    assert.equal(visited.length, 4);
    assert.equal(bus.council.status, "completed");
    assert.ok(bus.astra.decisions.length <= 5);
    assert.equal(bus.status, 'completed');
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'runtime','runs',`${bus.run_id}.json`))).status,'completed');
    assert.equal(inboxFor(bus.messages, 'agent-bi-uxui').length, 0);
    assert.equal(inboxFor(bus.messages, 'ai-council').length,4);
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
