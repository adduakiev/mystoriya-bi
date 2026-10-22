import test from "node:test";
import assert from "node:assert/strict";
import { qualityGate, validateInput, domainPacket, buildCouncil, astraExecutive, kpiStatus, SPECIALISTS, runWarnings, isBusinessEvidence } from "../lib/operating-core.ts";
import { collectInput } from "../lib/operating-collector.ts";
export const evidence = (id = "test", domain = "sales") => ({
  id, source: "test", domain, label: "Synthetic metric", unit: "orders", source_date: "2026-10-19",
  observed_at: null, fetched_at: "2026-10-20T00:00:00Z", period_from: "2026-10-19", period_to: "2026-10-19",
  value: 10, previous: 8, target: null, forecast: null, direction: "higher", source_status: "AVAILABLE",
  coverage: "FULL", confidence: 0.9, freshness_sla_days: 2, expected_dates: 1, observed_dates: 1,
  duplicate_rows: 0, attribution: "backend"
});
const packet = (...e) => ({ version: 2, as_of: "2026-10-20T00:00:00Z", evidence: e });
const finding = (key="test", id="test") => ({ key, kind:"fact", insight:"Observed change", action:"Investigate",
  evidence_ids:[id], impact_uah:null, impact_basis:"Not measured" });
test("quality gate blocks stale, missing, gaps, duplicates; confidence cannot exceed quality", () => {
  for (const change of [{source_date:"2026-10-10"}, {value:null}, {observed_dates:0}, {duplicate_rows:1}, {source_status:"BROKEN"}]) {
    const q=qualityGate(packet({...evidence(),...change}))[0];
    assert.equal(q.status,"BLOCK"); assert.equal(q.confidence,0);
  }
  assert.equal(qualityGate(packet({...evidence(),coverage:"PARTIAL"}))[0].confidence,0.6);
  assert.equal(qualityGate(packet({...evidence(),value:0}))[0].status,"PASS");
});
test("strict packet rejects PII fields, duplicate IDs and future source times", () => {
  assert.throws(()=>validateInput(packet({...evidence(),email:"synthetic@example.invalid"})));
  assert.throws(()=>validateInput(packet(evidence(),evidence())));
  assert.throws(()=>validateInput(packet({...evidence(),source_date:"2026-10-21"})));
});
test("specialists receive separate domains and cannot cite each other's evidence", () => {
  const p=packet(evidence(),evidence("ads","ads"));
  assert.equal(domainPacket(p,"agent-sales-retail").evidence.length,1);
  assert.throws(()=>buildCouncil(p,[{agent:"agent-sales-retail",findings:[finding("key","ads")]}]));
});
test("Council deduplicates, flags disagreement, blocks unsupported financial impact and caps Astra at five", () => {
  const f=finding();
  const c=buildCouncil(packet(evidence()),[{agent:"agent-sales-retail",findings:[f,{...f}]}]);
  assert.equal(c.items.filter(i=>i.id==="test").length,1);
  assert.equal(c.recommendations.length,1);
  const conflict=buildCouncil(packet(evidence()),[{agent:"agent-sales-retail",findings:[f,{...f,insight:"Opposite claim"}]}]);
  assert.deepEqual(conflict.contradictions,["test"]); assert.equal(conflict.recommendations.length,0);
  const impact=buildCouncil(packet(evidence()),[{agent:"agent-sales-retail",findings:[{...f,impact_uah:500}]}]);
  assert.equal(impact.recommendations.length,0);
  assert.ok(astraExecutive(c).decisions.length<=5);
});
test("targets and forecast remain absent; blocked quality dominates target attainment", () => {
  const e=evidence();
  assert.equal(e.forecast,null); assert.equal(kpiStatus({...e,previous:null},qualityGate(packet(e))[0]),"NO TARGET");
  assert.equal(kpiStatus({...e,target:1},{...qualityGate(packet(e))[0],status:"BLOCK"}),"DATA ISSUE");
});

test("WARN quality remains independent of target and trend business status", () => {
  for (const [changes, expected] of [[{target:9},"ON TRACK"],[{target:12},"IMPROVING"],[{target:12,previous:11},"AT RISK"],[{previous:null},"NO TARGET"]]) {
    const e={...evidence(),coverage:"PARTIAL",...changes};
    const q=qualityGate(packet(e))[0];
    assert.equal(q.status,"WARN");assert.equal(q.confidence,0.6);
    assert.equal(kpiStatus(e,q),expected);
  }
});

test("Council priorities remain UNASSESSED regardless of confidence or blockers", () => {
  for (const change of [{confidence:1},{confidence:0.55},{source_status:"BROKEN"}]) {
    const c=buildCouncil(packet({...evidence(),...change}),[{agent:"agent-sales-retail",findings:[finding()]}]);
    assert.ok(c.items.every(i=>i.priority==="UNASSESSED"));
  }
  const c=buildCouncil(packet(evidence()),[{agent:"agent-sales-retail",findings:[finding('first'),finding('second')]}]);
  const initial=astraExecutive(c).decisions.map(d=>d.id);
  c.items.forEach((i,n)=>i.confidence=n%2?0:1);
  assert.deepEqual(astraExecutive(c).decisions.map(d=>d.id),initial);
});

test("replay, stale and changed-data warnings accumulate independently", () => {
  const original=packet(evidence());
  const current={...packet({...evidence(),value:11}),as_of:"2026-10-22T00:00:00Z"};
  const issues=runWarnings('replay',original,current);
  assert.equal(issues.length,3);
  assert.ok(issues.some(s=>s.includes('replay')));
  assert.ok(issues.some(s=>s.includes('24')));
  assert.ok(issues.some(s=>s.includes('змінилися')));
  assert.deepEqual(runWarnings('live',original,original),[]);
});

test("technical row coverage stays out of business KPI, direction and changes", () => {
  assert.equal(isBusinessEvidence({...evidence('ux.device_rows','ux'),unit:'rows'}),false);
  assert.equal(isBusinessEvidence({...evidence('other.coverage'),unit:'rows'}),false);
  assert.equal(isBusinessEvidence({...evidence('ux.conversion','ux'),unit:'percent'}),true);
  assert.equal(isBusinessEvidence(evidence()),true);
});
test("collector fetches only three allowed aggregate RPCs, strips raw fields and preserves failure", async () => {
  const calls=[];
  const p=await collectInput(async name=>{calls.push(name);return {email:"should never leave",meta:{currentGa4Rows:1},current:{sessions:0}};},
    "2026-10-20T00:00:00Z");
  assert.equal(calls.length,3); assert.equal(JSON.stringify(p).includes("email"),false);
  assert.equal(p.evidence.find(e=>e.id==="ga4.sessions").value,0);
  assert.equal(p.evidence.find(e=>e.id==="backend.net_revenue").value,null);
  const failed=await collectInput(async()=>{throw Error("synthetic");},"2026-10-20T00:00:00Z");
  assert.ok(qualityGate(failed).every(q=>q.status==="BLOCK"));
});
