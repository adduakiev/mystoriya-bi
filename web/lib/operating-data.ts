import "server-only";
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
  return { packet, quality, council, astra, runId, runMode, runStatus, runAsOf, runIssues };
}
