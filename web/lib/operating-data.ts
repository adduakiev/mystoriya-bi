import "server-only";
import { manualRunAvailability } from "./operating-manual";
import fs from "node:fs/promises";
import path from "node:path";
import { callBiRpc } from "@/lib/data/source";
import { collectInput } from "./operating-collector";
import { qualityGate, buildCouncil, astraExecutive, validateInput, runWarnings, type Council } from "./operating-core";

export async function loadOperatingData() {
  const packet = await collectInput(name => callBiRpc(name));
  const quality = qualityGate(packet);
  let council: Council | null = null;
  let astra: ReturnType<typeof astraExecutive> | null = null;
  let runId: string | null = null, runMode: string | null = null, runStatus: string | null = null;
  let runAsOf: string | null = null;
  const runIssues: string[] = [];
  let lastSuccessful: {run_id:string;mode:string;finished_at:string|null} | null = null;
  let collectorAt: string | null = null, councilAt: string | null = null;
  const file = process.env.OPERATING_BUS_PATH || path.resolve(process.cwd(), "../.agents/data_bus.json");
  try {
    const stat = await fs.stat(file);
    if (stat.size > 1024 * 1024) throw Error("Oversize run");
    const bus = JSON.parse(await fs.readFile(file, "utf8"));
    runId = typeof bus.run_id === "string" ? bus.run_id : null;
    runMode = typeof bus.mode === "string" ? bus.mode : null;
    runStatus = typeof bus.status === "string" ? bus.status : null;
    runAsOf = typeof bus.as_of === "string" ? bus.as_of : null;
    if (!bus.input || bus.status !== "completed") {
      runIssues.push("Немає завершеного Council-циклу. Окремий executive-тест не замінює результати спеціалістів.");
    } else {
      validateInput(bus.input);
      if(!Array.isArray(bus.messages) || bus.messages.length!==4)throw Error('Partial specialist set');
      buildCouncil(bus.input,bus.messages.map((m:{payload:unknown})=>m.payload));
      lastSuccessful={run_id:runId??"unknown",mode:runMode??"unknown",finished_at:typeof bus.finished_at==="string"?bus.finished_at:null};
      collectorAt=typeof bus.run?.collector_at==="string"?bus.run.collector_at:null;
      councilAt=typeof bus.run?.council_at==="string"?bus.run.council_at:null;
      runIssues.push(...runWarnings(runMode, bus.input, packet));
      const age = (Date.parse(packet.as_of) - Date.parse(bus.input.as_of)) / 3600000;
      if (age >= 0 && age <= 24) {
        // Recompute gate and Council; stored summaries cannot bypass validation.
        council = buildCouncil({ ...bus.input, as_of: packet.as_of }, bus.messages.map((m: { payload: unknown }) => m.payload));
        astra = astraExecutive(council);

      }
    }
  } catch (error) {
    runIssues.push((error as NodeJS.ErrnoException).code === "ENOENT"
      ? "Council ще не запускався в цьому середовищі."
      : "Результат Council недоступний або не пройшов перевірку контракту.");
  }
  if(!lastSuccessful) {
    try {
      const previousFile=path.join(path.dirname(file),'runtime','last-successful.json');
      if((await fs.stat(previousFile)).size>1024*1024)throw Error('Oversize');
      const previous=JSON.parse(await fs.readFile(previousFile,'utf8'));
      validateInput(previous.input);
      if(previous.status==='completed' && ['live','replay'].includes(previous.mode) && typeof previous.run_id==='string' && previous.messages?.length===4) {
        buildCouncil(previous.input,previous.messages.map((m:{payload:unknown})=>m.payload));
        lastSuccessful={run_id:previous.run_id,mode:previous.mode,finished_at:typeof previous.finished_at==='string'?previous.finished_at:null};
      }
    } catch { /* unavailable historical state must remain unknown */ }
  }
  const taskReasons=[...runIssues];
  if(runMode!=='live')taskReasons.push('A verified LIVE run is required; REPLAY cannot create tasks.');
  if(runStatus!=='completed' || !council)taskReasons.push('A completed verified Council is required.');
  if(process.env.VERCEL)taskReasons.push('Task persistence unavailable on Vercel.');
  return { packet, quality, council, astra, runId, runMode, runStatus, runAsOf, runIssues,
    analysis:{lastSuccessful,collectorAt,councilAt,taskReasons,canCreate:taskReasons.length===0,
      manual:manualRunAvailability(process.env.OPERATING_MANUAL_RUN_ENABLED==='1'),
      counts:{PASS:quality.filter(q=>q.status==='PASS').length,WARN:quality.filter(q=>q.status==='WARN').length,BLOCK:quality.filter(q=>q.status==='BLOCK').length}} };

}
