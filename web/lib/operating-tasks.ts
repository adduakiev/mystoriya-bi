export type TaskStatus = "NEW" | "IN PROGRESS" | "DONE" | "CHECK RESULT";
export type Priority = "P1" | "P2" | "P3" | "UNASSESSED";
export interface OperatingTask {
  id: string; problem: string; evidence: string[]; recommendation: string;
  owner: string | null; priority: Priority; expected_impact: string | null;
  deadline: string | null; status: TaskStatus; created_at: string;
  check_date: string | null; result: string | null; revision: number; source_run_id: string;
  recommendation_id: string;
}
export class TaskError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TaskError("Expected object");
  return value as Record<string, unknown>;
}
export function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new TaskError("Unknown field");
}
export function text(value: unknown, max = 4000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new TaskError("Invalid text");
  return value.trim();
}
function nullableText(value: unknown, max = 4000): string | null { return value === null ? null : text(value, max); }
function date(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new TaskError("Invalid calendar date");
  return value;
}
export function createTask(recommendation: unknown, runId: string, id: string, now: string): OperatingTask {
  const r = object(recommendation);
  if (!Array.isArray(r.evidence) || !r.evidence.length || r.evidence.length > 100) throw new TaskError("Evidence required");
  if (!["P1", "P2", "P3", "UNASSESSED"].includes(String(r.priority))) throw new TaskError("Invalid priority");
  return {id, source_run_id: text(runId, 200), recommendation_id: text(r.id, 200), problem: text(r.problem),
    evidence: [...new Set(r.evidence.map(e => text(e, 200)))], recommendation: text(r.recommendation),
    priority: r.priority as Priority, expected_impact: nullableText(r.expected_impact), owner: null,
    deadline: null, status: "NEW", created_at: now, check_date: null, result: null, revision: 1};
}
export function patchTask(current: OperatingTask, input: unknown): OperatingTask {
  const p = object(input);
  exactKeys(p, ["id", "revision", "owner", "deadline", "status", "check_date", "result"]);
  if (p.id !== current.id || !Number.isSafeInteger(p.revision)) throw new TaskError("Invalid task identity or revision");
  if (p.revision !== current.revision) throw new TaskError("Task changed; reload before editing", 409);
  if (Object.keys(p).length <= 2) throw new TaskError("No changes supplied");
  const next = {...current, revision: current.revision + 1};
  if ("owner" in p) next.owner = nullableText(p.owner, 200);
  if ("result" in p) next.result = nullableText(p.result);
  if ("deadline" in p) next.deadline = date(p.deadline);
  if ("check_date" in p) next.check_date = date(p.check_date);
  const statuses: TaskStatus[] = ["NEW", "IN PROGRESS", "DONE", "CHECK RESULT"];
  if ("status" in p) {
    const from = statuses.indexOf(current.status), to = statuses.indexOf(p.status as TaskStatus);
    if (to < 0 || (to !== from && to !== from + 1)) throw new TaskError("Invalid status transition");
    next.status = p.status as TaskStatus;
  }
  if (next.status !== "NEW" && !next.owner) throw new TaskError("Owner required before starting");
  if (next.status === "CHECK RESULT" && (!next.result || !next.check_date)) throw new TaskError("Result and check date required");
  return next;
}
