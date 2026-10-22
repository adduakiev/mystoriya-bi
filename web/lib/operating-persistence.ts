import { validateInput, SPECIALISTS, domainPacket } from './operating-core.ts';
import { validateSpecialist } from './operating-runtime.ts';
import { fingerprintHash, type RunResult } from './operating-orchestrator.ts';

/** Defense in depth for aggregate-only artifacts. Never accept arbitrary RPC/provider JSON. */
export function assertAggregateOnly(value: unknown) {
  const serialized=JSON.stringify(value);
  if (serialized.length>256000 || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:Bearer\s+|-----BEGIN|sk-[a-z0-9]{20})|\+\d[\d ()-]{9,}/i.test(serialized))
    throw Error('Sensitive or oversized artifact rejected');
}
export function persistenceSnapshot(result: RunResult) {
  if(result.input)validateInput(result.input);
  const outputs=result.outputs.map(output=>{
    if(!SPECIALISTS.includes(output.agent as typeof SPECIALISTS[number]))throw Error('Unknown specialist');
    const ids=new Set(result.input?domainPacket(result.input,output.agent).evidence.map(e=>e.id):[]);
    const validated=validateSpecialist(output,output.agent,ids);
    if(validated.findings.some(f=>f.impact_uah!==null))throw Error('Measured impact contract unavailable');
    return validated;
  });
  const run=result.run;
  // Explicit projection: no prompts, cookies, credentials, raw exceptions or provider metadata.
  const snapshot={run:{run_id:run.run_id,mode:run.mode,status:run.status,started_at:run.started_at,finished_at:run.finished_at,
    source_as_of:run.source_as_of,evidence_fingerprint:result.input?fingerprintHash(result.input):null,
    collector_version:run.collector_version,runtime_version:run.runtime_version,agent_version:run.agent_version,collector_at:run.collector_at,council_at:run.council_at,error_code:run.error_code},
    evidence:result.input?structuredClone(result.input.evidence):[],outputs};
  assertAggregateOnly(snapshot);
  return snapshot;
}
