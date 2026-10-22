import { persistenceSnapshot } from '../web/lib/operating-persistence.ts';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { orchestrate } from '../web/lib/operating-orchestrator.ts';
import { ReplayRuntime, validateSpecialist } from '../web/lib/operating-runtime.ts';
import { CodexCliRuntime } from './adapters/codex-cli.mjs';
import { validateInput } from '../web/lib/operating-core.ts';

const home = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(home, 'orchestrator.json'), 'utf8'));
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const atomic = (p, v) => {
  fs.writeFileSync(p + '.tmp', JSON.stringify(v, null, 2));
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(p + '.tmp', p); break; }
    catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt === 5) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * (attempt + 1));
    }
  }
};
export function validatePacket(packet) {
  if (packet?.version === 2) {
    validateInput(packet);
    return new Set(packet.evidence.map(e => e.id));
  }
  if (!packet || !Number.isFinite(Date.parse(packet.as_of)) || !Array.isArray(packet.evidence))
    throw Error('Expected as_of and evidence[]');
  const ids = new Set();
  for (const e of packet.evidence) {
    if (!e.id || ids.has(e.id) || typeof e.summary !== 'string' ||
        !Number.isFinite(Date.parse(e.observed_at)) || Date.parse(e.observed_at) > Date.parse(packet.as_of))
      throw Error('Invalid, duplicate or future evidence');
    ids.add(e.id);
  }
  return ids;
}
export const validateResult = validateSpecialist;
export function inboxFor(messages, agent) {
  return messages.filter(m => m.to.includes(agent));
}
export async function run({ packet, invoke, runtime, stateDir = home, mode = 'replay', onlyExecutive = false, now, currentFingerprint }) {
  validatePacket(packet);
  if (onlyExecutive || packet.version !== 2) throw Error('v2 requires a full collector packet; executive-only is retired');
  fs.mkdirSync(path.join(stateDir, 'runtime', 'runs'), { recursive: true });
  const lock = path.join(stateDir, 'runtime', 'run.lock');
  const fd = fs.openSync(lock, 'wx');
  const busPath = path.join(stateDir, 'data_bus.json');
  try {
    // Callback compatibility is local/test only. Production uses a typed AgentRuntime.
    const provider=runtime ?? {kind:mode==='live'?'codex-cli':'replay',mode:mode==='live'?'live':'replay',version:'local-callback-v2',available:true,
      invoke:async(agent,p)=>invoke(agent,p,[])};
    const result=await orchestrate({runtime:provider,collect:async()=>packet,now,currentFingerprint,
      checkpoint:async run=>atomic(path.join(stateDir,'runtime','active-run.json'),run)});
    persistenceSnapshot(result);
    const bus={version:2,run_id:result.run.run_id,mode:result.run.mode,as_of:packet.as_of,
      started_at:result.run.started_at,finished_at:result.run.finished_at,status:result.run.status.toLowerCase(),
      run:result.run,input:result.input,quality:result.quality,council:result.council,astra:result.astra,error:result.run.error_code,
      messages:result.outputs.map(payload=>({from:payload.agent,to:config.routes[payload.agent],payload}))};
    atomic(busPath,bus);
    atomic(path.join(stateDir,'runtime','runs',`${bus.run_id}.json`),bus);
    atomic(path.join(stateDir,'runtime','latest.json'),bus);
    if(bus.status==='completed')atomic(path.join(stateDir,'runtime','last-successful.json'),bus);
    fs.writeFileSync(path.join(stateDir,'runtime','executive-summary.md'),result.astra?.summary??`Run ${bus.status}: ${bus.error}`);
    if(bus.status==='failed')throw Error('Run failed; see sanitized run state');
    return bus;
  } finally { fs.closeSync(fd);fs.unlinkSync(lock); }
}

async function main() {
  const args = process.argv.slice(2);
  const arg = name => args[args.indexOf(name) + 1];
  if (!args.includes('--input')) throw Error('Usage: node .agents/run.mjs --input PRIVATE_PACKET.json [--replay PRIVATE_RESULTS.json] [--executive-only]');
  const inputPath = path.resolve(arg('--input'));
  if (fs.statSync(inputPath).size > config.maxInputBytes) throw Error('Input exceeds byte budget');
  const packet = read(inputPath);
  const replay = args.includes('--replay') ? read(path.resolve(arg('--replay'))) : null;
  const runtime=replay?new ReplayRuntime(replay):new CodexCliRuntime(home,config);
  const bus = await run({packet,runtime,onlyExecutive:args.includes('--executive-only')});
  console.log(JSON.stringify({ status: bus.status, mode: bus.mode, agents: bus.messages.length }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
