/** Shared pure contract: Node collector/runtime and server-rendered cockpit. No credentials or IO. */
export type Domain = "sales" | "ads" | "seo" | "ux";
export type Evidence = {
  id: string; source: string; domain: Domain; label: string; unit: string;
  source_date: string | null; observed_at: string | null; fetched_at: string;
  period_from: string | null; period_to: string | null;
  value: number | null; previous: number | null; target: number | null; forecast: number | null;
  direction: "higher" | "lower" | "neutral";
  source_status: "AVAILABLE" | "BROKEN" | "UNKNOWN";
  coverage: "FULL" | "PARTIAL" | "UNKNOWN"; confidence: number;
  freshness_sla_days: number; expected_dates: number | null; observed_dates: number | null;
  duplicate_rows: number | null; attribution: "analytics" | "platform" | "backend" | "none";
};
export type InputPacket = { version: 2; as_of: string; evidence: Evidence[] };
export type Quality = { evidence_id: string; status: "PASS" | "WARN" | "BLOCK";
  confidence: number; reasons: string[] };
export type Finding = { key: string; kind: "fact" | "hypothesis" | "blocked";
  insight: string; action: string; evidence_ids: string[]; impact_uah: number | null; impact_basis: string };
export type Specialist = { agent: string; summary: string; findings: Finding[] };
export type CouncilItem = { id: string; classification: "FACT" | "INFERENCE" | "RECOMMENDATION" | "BLOCKED";
  problem: string; evidence: string[]; recommendation: string; priority: "P1" | "P2" | "P3" | "UNASSESSED";
  confidence: number; expected_impact: string | null; reasons: string[]; agents: string[] };
export type Council = { status: "completed"; items: CouncilItem[]; recommendations: CouncilItem[];
  contradictions: string[]; related: Array<{ ids: string[]; reason: string }> };
export const SPECIALISTS = ["agent-sales-retail", "agent-digital-ads", "agent-seo-content", "agent-bi-uxui"] as const;
export const DOMAINS: Record<string, Domain> = {
  "agent-sales-retail": "sales", "agent-digital-ads": "ads",
  "agent-seo-content": "seo", "agent-bi-uxui": "ux"
};
const finiteOrNull = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));
const isoDate = (v: unknown): v is string => typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const timestamp = (v: unknown): v is string => typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const evidenceKeys = ["id","source","domain","label","unit","source_date","observed_at","fetched_at",
  "period_from","period_to","value","previous","target","forecast","direction","source_status","coverage",
  "confidence","freshness_sla_days","expected_dates","observed_dates","duplicate_rows","attribution"];
export function validateInput(packet: InputPacket): void {
  if (!packet || Object.keys(packet).some(k => !["version","as_of","evidence"].includes(k)) ||
      packet.version !== 2 || !timestamp(packet.as_of) || !Array.isArray(packet.evidence) ||
      packet.evidence.length > 100) throw Error("Invalid input packet");
  const ids = new Set<string>();
  for (const e of packet.evidence) {
    if (!e || Object.keys(e).length !== evidenceKeys.length || Object.keys(e).some(k => !evidenceKeys.includes(k)) ||
      typeof e.id !== "string" || !/^[a-z0-9_.-]{1,100}$/.test(e.id) || ids.has(e.id) ||
      !["source","label","unit"].every(k => typeof e[k as keyof Evidence] === "string" &&
        String(e[k as keyof Evidence]).length > 0 && String(e[k as keyof Evidence]).length < 200) ||
      !["sales","ads","seo","ux"].includes(e.domain) ||
      !["value","previous","target","forecast"].every(k => finiteOrNull(e[k as keyof Evidence])) ||
      !["higher","lower","neutral"].includes(e.direction) ||
      !["AVAILABLE","BROKEN","UNKNOWN"].includes(e.source_status) ||
      !["FULL","PARTIAL","UNKNOWN"].includes(e.coverage) ||
      !["analytics","platform","backend","none"].includes(e.attribution) ||
      !Number.isFinite(e.confidence) || e.confidence < 0 || e.confidence > 1 ||
      !Number.isInteger(e.freshness_sla_days) || e.freshness_sla_days < 0 || e.freshness_sla_days > 365 ||
      !["expected_dates","observed_dates","duplicate_rows"].every(k => {
        const v = e[k as keyof Evidence]; return v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0);
      }) ||
      !["source_date","period_from","period_to"].every(k => e[k as keyof Evidence] === null || isoDate(e[k as keyof Evidence])) ||
      !timestamp(e.fetched_at) || Date.parse(e.fetched_at) > Date.parse(packet.as_of) ||
      (e.observed_at !== null && (!timestamp(e.observed_at) || Date.parse(e.observed_at) > Date.parse(packet.as_of))) ||
      (e.source_date !== null && e.source_date > packet.as_of.slice(0,10)) ||
      (e.period_from !== null && e.period_to !== null && e.period_from > e.period_to))
      throw Error("Invalid evidence contract"); // Do not echo potentially sensitive invalid input.
    ids.add(e.id);
  }
}

export function qualityGate(packet: InputPacket): Quality[] {
  validateInput(packet);
  return packet.evidence.map(e => {
    const reasons: string[] = [];
    let block = false;
    const fail = (reason: string) => { reasons.push(reason); block = true; };
    if (e.source_status !== "AVAILABLE") fail("Джерело не підтверджене або недоступне");
    if (e.value === null) fail("Значення невідоме");
    if (!e.source_date) fail("Дата джерела невідома");
    else if ((Date.parse(packet.as_of.slice(0,10)) - Date.parse(e.source_date)) / 86400000 > e.freshness_sla_days)
      fail("Перевищено допустиму давність джерела");
    if ((e.duplicate_rows ?? 0) > 0) fail("Виявлені дублікати");
    if (e.expected_dates !== null && e.observed_dates !== null && e.observed_dates !== e.expected_dates)
      fail("Неповний або суперечливий набір дат");
    if (e.coverage !== "FULL") reasons.push("Покриття неповне або невідоме");
    if (e.duplicate_rows === null) reasons.push("Перевірка дублів відсутня");
    if (e.expected_dates === null || e.observed_dates === null) reasons.push("Суцільність дат не підтверджена");
    if (e.attribution === "analytics" || e.attribution === "platform")
      reasons.push("Аналітична/платформна атрибуція, не фінансова правда");
    return { evidence_id: e.id, status: block ? "BLOCK" : reasons.length ? "WARN" : "PASS",
      confidence: Math.min(e.confidence, block ? 0 : reasons.length ? 0.6 : 1), reasons };
  });
}

export function domainPacket(packet: InputPacket, agent: string): InputPacket {
  return { ...packet, evidence: packet.evidence.filter(e => e.domain === DOMAINS[agent]) };
}

export function evidenceFingerprint(packet: InputPacket): string {
  return JSON.stringify([...packet.evidence].sort((a,b)=>a.id.localeCompare(b.id))
    .map(({ fetched_at: _fetched, ...e })=>e));
}

export function buildCouncil(packet: InputPacket, outputs: Specialist[]): Council {
  const quality = new Map(qualityGate(packet).map(q => [q.evidence_id, q]));
  const groups = new Map<string, Array<{ agent: string; finding: Finding }>>();
  const seenAgents = new Set<string>();
  for (const output of outputs) {
    if (!SPECIALISTS.includes(output.agent as typeof SPECIALISTS[number]) || seenAgents.has(output.agent))
      throw Error("Unexpected or duplicate specialist");
    seenAgents.add(output.agent);
    const domainIds = new Set(domainPacket(packet, output.agent).evidence.map(e => e.id));
    for (const f of output.findings) {
      if (!f.key || !["fact","hypothesis","blocked"].includes(f.kind) ||
          !Array.isArray(f.evidence_ids) || f.evidence_ids.some(id => !domainIds.has(id)) ||
          (f.kind === "fact" && f.evidence_ids.length === 0)) throw Error("Unverified specialist evidence");
      const group = groups.get(f.key) ?? [];
      group.push({ agent: output.agent, finding: f });
      groups.set(f.key, group);
    }
  }
  const items: CouncilItem[] = [];
  const contradictions: string[] = [];
  for (const [key, group] of groups) {
    const f = group[0].finding;
    const evidence = [...new Set(group.flatMap(g => g.finding.evidence_ids))];
    // Conservative conflict rule: differing assertions under the same semantic key need human review.
    const conflict = new Set(group.map(g => JSON.stringify([g.finding.kind, g.finding.insight, g.finding.action]))).size > 1;
    if (conflict) contradictions.push(key);
    const reasons = [...new Set(evidence.flatMap(id => quality.get(id)?.reasons ?? ["Невідомий доказ"]))];
    const hasBlocked = evidence.length === 0 || evidence.some(id => quality.get(id)?.status === "BLOCK");
    const blocked = conflict || hasBlocked || group.some(g => g.finding.kind === "blocked" || g.finding.impact_uah !== null);
    if (conflict) reasons.push("Суперечливі формулювання одного сигналу; потрібна звірка");
    if (group.some(g => g.finding.impact_uah !== null)) reasons.push("Грошовий ефект не має окремого виміряного контракту");
    const confidence = blocked ? 0 : Math.min(...evidence.map(id => quality.get(id)!.confidence));
    const base = { problem: f.insight, evidence, recommendation: f.action,
      priority: "UNASSESSED" as const,
      confidence, expected_impact: null, reasons, agents: [...new Set(group.map(g => g.agent))] };
    items.push({ ...base, id: key, classification: blocked ? "BLOCKED" : f.kind === "fact" ? "FACT" : "INFERENCE" });
    if (!blocked && confidence >= 0.5) items.push({ ...base, id: `${key}:action`, classification: "RECOMMENDATION" });
  }
  for (const agent of SPECIALISTS.filter(a => !seenAgents.has(a))) {
    items.push({ id: `missing:${agent}`, classification: "BLOCKED", problem: `Відсутній результат ${agent}`,
      evidence: [], recommendation: "Повторити аналіз після усунення причини", priority: "UNASSESSED", confidence: 0,
      expected_impact: null, reasons: ["Неповне покриття спеціалістів"], agents: [agent] });
  }
  for (const e of packet.evidence) {
    const q = quality.get(e.id)!;
    if (q.status === "BLOCK" && !items.some(i => i.classification === "BLOCKED" && i.evidence.includes(e.id)))
      items.push({ id: `quality:${e.id}`, classification: "BLOCKED",
        problem: `Недостатня якість даних: ${e.label}`, evidence: [e.id],
        recommendation: "Відновити джерело або підтвердити повноту перед бізнес-висновком",
        priority: "UNASSESSED", confidence: 0, expected_impact: null, reasons: q.reasons, agents: ["agent-data-quality"] });
  }
  const related: Council["related"] = [];
  const signals = items.filter(i => i.classification !== "RECOMMENDATION");
  for (let a = 0; a < signals.length; a++) for (let b = a + 1; b < signals.length; b++) {
    if (signals[a].evidence.some(id => signals[b].evidence.includes(id)))
      related.push({ ids: [signals[a].id, signals[b].id], reason: "Спільний доказ; спільна причина не доведена" });
  }
  return { status: "completed", items, recommendations: items.filter(i => i.classification === "RECOMMENDATION"),
    contradictions, related };
}

/** Astra is a separate executive projection, never the Council itself. */
export function astraExecutive(council: Council) {
  const priority = { P1: 0, P2: 1, P3: 2, UNASSESSED: 3 };
  const decisions = council.items.filter(i => i.classification === "BLOCKED" || i.classification === "RECOMMENDATION")
    .sort((a,b) => priority[a.priority] - priority[b.priority]).slice(0,5);
  return { status: decisions.some(d => d.classification === "BLOCKED") ? "DATA ISSUE" : "REVIEW",
    decisions, summary: decisions.length
      ? decisions.map(d => `[${d.classification}] ${d.problem}\nРішення: ${d.recommendation}\nВплив: не визначено; confidence ${Math.round(d.confidence*100)}%`).join("\n\n")
      : "Немає підтверджених рішень, які потребують уваги. Це не доказ відсутності проблем." };
}

export function kpiStatus(e: Evidence, q: Quality): "ON TRACK" | "IMPROVING" | "AT RISK" | "CRITICAL" | "DATA ISSUE" | "NO TARGET" {
  if (q.status === "BLOCK") return "DATA ISSUE";
  if (e.value === null) return "NO TARGET";
  if (e.target !== null && e.direction !== "neutral") {
    const met = e.direction === "higher" ? e.value >= e.target : e.value <= e.target;
    if (met) return "ON TRACK";
    if (e.previous !== null && (e.direction === "higher" ? e.value > e.previous : e.value < e.previous)) return "IMPROVING";
    return "AT RISK"; // CRITICAL requires an explicit business threshold, which is not yet supplied.
  }
  if (e.previous !== null && e.direction !== "neutral" &&
      (e.direction === "higher" ? e.value > e.previous : e.value < e.previous)) return "IMPROVING";
  return "NO TARGET";
}

/** Technical completeness counters are source diagnostics, not business outcomes. */
export function isBusinessEvidence(e: Evidence): boolean {
  return e.id !== "ux.device_rows" && e.unit !== "rows";
}

/** Independent warnings accumulate; none masks replay, age or source changes. */
export function runWarnings(mode: string | null, input: InputPacket, current: InputPacket): string[] {
  const reasons: string[] = [];
  if (mode !== "live") reasons.push("Це replay/test, а не незалежний live-аналіз. Створення задач вимкнено.");
  const age = Date.parse(current.as_of) - Date.parse(input.as_of);
  if (!Number.isFinite(age) || age < 0 || age > 86400000)
    reasons.push("Результат старший за 24 години або має некоректну дату. Потрібен новий цикл.");
  if (evidenceFingerprint(input) !== evidenceFingerprint(current))
    reasons.push("Дані змінилися після аналізу. Рішення попереднього циклу потребують повторної перевірки.");
  return reasons;
}
