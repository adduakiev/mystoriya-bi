import { readFile, mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { TaskError, object, text, createTask, patchTask, type OperatingTask } from "./operating-tasks.ts";
import { buildCouncil, validateInput, evidenceFingerprint, SPECIALISTS, type InputPacket, type Specialist } from "./operating-core.ts";

export function operatingRoot() { return path.basename(process.cwd()) === "web" ? path.dirname(process.cwd()) : process.cwd(); }
export function taskStorePath() {
  if (process.env.VERCEL) throw new TaskError("Task storage is unavailable on Vercel; configure a durable database adapter", 503);
  const configured = process.env.OPERATING_TASKS_PATH;
  if (process.env.NODE_ENV === "production" && !configured) throw new TaskError("Production requires an explicit persistent OPERATING_TASKS_PATH", 503);
  if (configured && !path.isAbsolute(configured)) throw new TaskError("OPERATING_TASKS_PATH must be absolute", 503);
  return configured || path.join(operatingRoot(), ".agents", "runtime", "tasks.json");
}
export function operatingBusPath() { return process.env.OPERATING_BUS_PATH || path.join(operatingRoot(), ".agents", "data_bus.json"); }
export async function readTasks(file = taskStorePath()): Promise<OperatingTask[]> {
  try {
    const parsed = object(JSON.parse(await readFile(file, "utf8")));
    if (parsed.version !== 1 || !Array.isArray(parsed.tasks)) throw new Error("Invalid store");
    const ids = new Set();
    for (const value of parsed.tasks) {
      const t = object(value);
      if (typeof t.id !== "string" || ids.has(t.id) || !Number.isSafeInteger(t.revision) || Number(t.revision) < 1 || !["NEW", "IN PROGRESS", "DONE", "CHECK RESULT"].includes(String(t.status))) throw new Error("Invalid task");
      createTask({id:t.recommendation_id,problem:t.problem,evidence:t.evidence,recommendation:t.recommendation,priority:t.priority,expected_impact:t.expected_impact}, text(t.source_run_id,200), t.id, text(t.created_at,100));
      if (!Number.isFinite(Date.parse(String(t.created_at)))) throw new Error("Invalid timestamp");
      patchTask(t as unknown as OperatingTask, {id:t.id,revision:t.revision,owner:t.owner,deadline:t.deadline,check_date:t.check_date,result:t.result,status:t.status});
      ids.add(t.id);
    }
    return parsed.tasks as OperatingTask[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new TaskError("Task store is unreadable or invalid; refusing to overwrite", 503);
  }
}
export async function mutateTasks(update: (tasks: OperatingTask[]) => OperatingTask[], file = taskStorePath()) {
  await mkdir(path.dirname(file), {recursive: true});
  let lock;
  try { lock = await open(`${file}.lock`, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new TaskError("Task store busy; retry. A stale lock requires operator review", 409);
    throw error;
  }
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const tasks = update(await readTasks(file));
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(JSON.stringify({version: 1, tasks}, null, 2)); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, file);
    return tasks;
  } finally {
    await unlink(temporary).catch(() => {});
    await lock.close();
    await unlink(`${file}.lock`);
  }
}
export async function addCouncilTask(runId: unknown, recommendationId: unknown, currentPacket: InputPacket): Promise<OperatingTask> {
  const source = text(runId, 200), id = text(recommendationId, 200);
  let bus;
  try { bus = object(JSON.parse(await readFile(operatingBusPath(), "utf8"))); }
  catch { throw new TaskError("Completed live council run unavailable", 409); }
  if (bus.mode !== "live" || bus.status !== "completed" || bus.run_id !== source) throw new TaskError("Only the current completed live run can create tasks", 409);
  let council;
  try {
    const input = bus.input as InputPacket;
    validateInput(input);
    validateInput(currentPacket);
    if (evidenceFingerprint(input) !== evidenceFingerprint(currentPacket)) throw Error("Sources changed");
    const age = Date.now() - Date.parse(input.as_of);
    if (age < 0 || age > 86400000 || bus.as_of !== input.as_of || !Array.isArray(bus.messages) ||
        bus.messages.length !== SPECIALISTS.length) throw Error("Stale or partial run");
    council = buildCouncil({...input,as_of:new Date().toISOString()},
      bus.messages.map(m => object(m).payload as Specialist));
  } catch { throw new TaskError("Council evidence is stale, incomplete or invalid; rerun analysis", 409); }
  const recommendations = council.recommendations.filter(r => r.id === id);
  if (recommendations.length !== 1) throw new TaskError("Recommendation unavailable or ambiguous", 409);
  const task = createTask(recommendations[0], source, randomUUID(), new Date().toISOString());
  await mutateTasks(tasks => {
    if (tasks.some(t => t.source_run_id === source && t.recommendation_id === id)) throw new TaskError("Recommendation already has a task", 409);
    return [...tasks, task];
  });
  return task;
}
export async function updateTask(input: unknown): Promise<OperatingTask> {
  const p = object(input);
  let updated: OperatingTask | undefined;
  await mutateTasks(tasks => {
    const index = tasks.findIndex(t => t.id === p.id);
    if (index < 0) throw new TaskError("Task not found", 404);
    updated = patchTask(tasks[index], p);
    return tasks.map((t, i) => i === index ? updated! : t);
  });
  return updated!;
}
