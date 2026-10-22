import { createHash, randomUUID } from 'node:crypto';
import { qualityGate, domainPacket, buildCouncil, astraExecutive, evidenceFingerprint, validateInput, SPECIALISTS,
  type InputPacket, type Quality, type Specialist, type Council } from './operating-core.ts';
import { validateSpecialist, type AgentRuntime } from './operating-runtime.ts';

export type RunStatus = 'QUEUED' | 'COLLECTING' | 'QUALITY' | 'SPECIALISTS' | 'COUNCIL' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
export type RunRecord = {
  run_id: string; mode: 'live' | 'replay'; status: RunStatus; started_at: string; finished_at: string | null;
  source_as_of: string | null; evidence_fingerprint: string | null; collector_version: string; runtime_version: string; agent_version: string;
  collector_at: string | null; council_at: string | null; error_code: string | null;
};
export type RunResult = { run: RunRecord; input: InputPacket | null; quality: Quality[]; outputs: Specialist[]; council: Council | null;
  astra: ReturnType<typeof astraExecutive> | null };
const next: Record<RunStatus, RunStatus[]> = {
  QUEUED:['COLLECTING','BLOCKED','FAILED'], COLLECTING:['QUALITY','FAILED','BLOCKED'], QUALITY:['SPECIALISTS','BLOCKED','FAILED'],
  SPECIALISTS:['COUNCIL','FAILED','BLOCKED'], COUNCIL:['COMPLETED','BLOCKED','FAILED'], COMPLETED:[], FAILED:[], BLOCKED:[]
};
export function transition(run: RunRecord, status: RunStatus, at: string): RunRecord {
  if (!next[run.status].includes(status)) throw Error('Invalid run transition');
  return {...run,status,finished_at:['COMPLETED','FAILED','BLOCKED'].includes(status)?at:null};
}
export const fingerprintHash = (packet: InputPacket) => createHash('sha256').update(evidenceFingerprint(packet)).digest('hex');

/** Dependency-injected server core: no CLI, filesystem, env, credentials or external provider imports. */
export async function orchestrate(options: {
  runtime: AgentRuntime; collect: () => Promise<InputPacket>; now?: () => string;
  checkpoint?: (run: RunRecord) => Promise<void>; currentFingerprint?: () => Promise<string>;
  timeoutMs?: number;
}): Promise<RunResult> {
  const now = options.now ?? (()=>new Date().toISOString());
  const result: RunResult = {run:{run_id:randomUUID(),mode:options.runtime.mode,status:'QUEUED',started_at:now(),finished_at:null,
    source_as_of:null,evidence_fingerprint:null,collector_version:'aggregate-v2',runtime_version:options.runtime.version,agent_version:'specialist-contract-v2',
    collector_at:null,council_at:null,error_code:null},input:null,quality:[],outputs:[],council:null,astra:null};
  const save = async () => { await options.checkpoint?.(structuredClone(result.run)); };
  const move = async (status: RunStatus) => {
    const previous=result.run;
    result.run=transition(result.run,status,now());
    try {await save();} catch(error) {result.run=previous;throw error;}
  };
  try {
    await save();
    if ((options.runtime.kind==='replay') !== (options.runtime.mode==='replay')) {
      result.run.error_code='MODE_MISMATCH'; await move('BLOCKED'); return result;
    }
    if (!options.runtime.available) { result.run.error_code='PROVIDER_DISABLED'; await move('BLOCKED'); return result; }
    if (options.runtime.mode==='live' && !options.currentFingerprint) {
      result.run.error_code='FINGERPRINT_REQUIRED'; await move('BLOCKED'); return result;
    }
    await move('COLLECTING');
    const input=structuredClone(await options.collect()); validateInput(input);
    const age=Date.parse(now())-Date.parse(input.as_of);
    if (age<0 || age>86400000) { result.run.error_code='STALE_INPUT'; await move('BLOCKED'); return result; }
    result.input=input;
    // Conservative freshness marker: oldest known source date, not fetch/collector time.
    const sourceDates=input.evidence.map(e=>e.source_date).filter((d): d is string=>d!==null).sort();
    result.run.source_as_of=sourceDates.length?`${sourceDates[0]}T00:00:00Z`:null;
    result.run.collector_at=now(); result.run.evidence_fingerprint=fingerprintHash(input);
    await move('QUALITY'); result.quality=qualityGate(input);
    if(result.quality.every(q=>q.status==='BLOCK')) { result.run.error_code='QUALITY_BLOCK'; await move('BLOCKED'); return result; }
    await move('SPECIALISTS');
    for(const agent of SPECIALISTS) {
      const domain=domainPacket(input,agent);
      const allowed={...domain,evidence:domain.evidence.filter(e=>result.quality.find(q=>q.evidence_id===e.id)!.status!=='BLOCK')
        .map(e=>({...e,confidence:result.quality.find(q=>q.evidence_id===e.id)!.confidence}))};
      let output: Specialist;
      if(!allowed.evidence.length) output={agent,summary:'Domain blocked by data quality',findings:[{key:`${agent}.quality`,kind:'blocked',
        insight:'No admissible domain evidence',action:'Restore source quality',evidence_ids:domain.evidence.map(e=>e.id),impact_uah:null,impact_basis:'Unknown'}]};
      else {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const response=await Promise.race([options.runtime.invoke(agent,structuredClone(allowed)),
            new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Runtime timeout')),options.timeoutMs??180000);})]);
          output=validateSpecialist(response,agent,new Set(allowed.evidence.map(e=>e.id)));
        } finally {clearTimeout(timer);}
      }
      result.outputs.push(output); await save();
    }
    if(options.currentFingerprint) {
      let fresh: string;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Read after every specialist; never substitute the original packet's fingerprint.
        fresh=await Promise.race([options.currentFingerprint(),new Promise<never>((_,reject)=>{
          timer=setTimeout(()=>reject(Error('Fingerprint read timeout')),options.timeoutMs??180000);
        })]);
        if(typeof fresh!=='string' || !/^[a-f0-9]{64}$/.test(fresh)) throw Error('Invalid fingerprint');
      } catch {
        result.run.error_code='FINGERPRINT_READ_FAILED'; await move('BLOCKED'); return result;
      } finally {clearTimeout(timer);}
      if(fresh!==result.run.evidence_fingerprint) {
        result.run.error_code='EVIDENCE_CHANGED'; await move('BLOCKED'); return result;
      }
    }
    await move('COUNCIL');
    // Recheck quality at synthesis time, not only when the input was collected.
    result.council=buildCouncil({...input,as_of:now()},result.outputs); result.run.council_at=now();
    result.astra=astraExecutive(result.council);
    await move(result.outputs.length===SPECIALISTS.length?'COMPLETED':'BLOCKED');
  } catch {
    // Persist a bounded code, never provider exception text, prompts, credentials or raw response.
    result.run.error_code='RUN_FAILED';
    if(!['COMPLETED','FAILED','BLOCKED'].includes(result.run.status)) result.run=transition(result.run,'FAILED',now());
    try {await save();} catch { /* durable write failure remains observable as FAILED to caller */ }
  }
  return result;
}
