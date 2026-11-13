import { glovoMetrics, glovoMonth, selectGlovoReport, type GlovoFilters, type GlovoReport, type GlovoRow } from "./glovo-contract";

export function glovoKnownCoverage(rows: readonly GlovoRow[]) {
  return {rows: rows.length, amount: rows.filter(r => r.purchaseSum !== null).length,
    orders: rows.filter(r => r.deliveredOrders !== null).length,
    paired: rows.filter(r => r.purchaseSum !== null && r.deliveredOrders !== null).length,
    classified: rows.filter(r => r.identity !== "UNKNOWN").length};
}
export function glovoPairedTicket(rows: readonly GlovoRow[]): number | null {
  const paired = rows.filter(r => r.purchaseSum !== null && r.deliveredOrders !== null);
  return glovoMetrics(paired).averageTicket;
}
export function glovoDelta(a: number | null, b: number | null, complete: boolean) {
  const absolute = complete && a !== null && b !== null ? a - b : null;
  return {absolute, percent: absolute !== null && b !== null && b > 0 ? absolute / b * 100 : null};
}
const cohort = (row: GlovoRow) => JSON.stringify([row.normalizedGroup ?? row.rawBrand, row.physicalLocation ?? row.sourceLocation]);
const previousMonth = (month: string, offset = 1) => glovoMonth(Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1 - offset);
const monthComplete = (report: GlovoReport, month: string) => report.trend.find(p => p.month === month)?.coverage === "COMPLETE";

/** All calculations consume attributed rows, never workbook title/reference KPI constants. */
export function analyzeGlovo(source: GlovoReport, filters: GlovoFilters) {
  const selected = selectGlovoReport(source, filters);
  const months = [...selected.months].sort();
  const coverage = glovoKnownCoverage(selected.rows);
  const sum = selected.metrics.purchaseSum;
  const virtual = glovoMetrics(selected.rows.filter(r => r.identity === "VIRTUAL")).purchaseSum;
  const virtualShare = sum !== null && sum > 0 && coverage.classified === coverage.rows
    ? (virtual ?? (selected.rows.every(r => r.identity === "PHYSICAL") ? 0 : null)) : null;
  const all = selectGlovoReport(source, {...filters, year: "", from: "", to: "", month: "all"});
  const trend = selected.trend.map(point => {
    const prev = all.trend.find(p => p.month === previousMonth(point.month));
    return {...point, ticket: glovoPairedTicket(selected.rows.filter(r => r.month === point.month)),
      ...glovoDelta(point.purchaseSum, prev?.purchaseSum ?? null, point.coverage === "COMPLETE" && prev?.coverage === "COMPLETE")};
  });
  const latest = [...trend].reverse().find(p => p.coverage === "COMPLETE");
  const previousMonths = months.length ? Array.from({length: months.length}, (_, i) => previousMonth(months[0], months.length - i)) : [];
  const prior = selectGlovoReport(source, {...filters, year: "", month: "", from: previousMonths[0] ?? "invalid", to: previousMonths.at(-1) ?? "invalid"});
  const currentKeys = new Set(selected.rows.map(cohort)), priorKeys = new Set(prior.rows.map(cohort));
  const common = new Set([...currentKeys].filter(key => priorKeys.has(key)));
  const comparable = filters.compare === "cohort";
  const currentRows = comparable ? selected.rows.filter(r => common.has(cohort(r))) : selected.rows;
  const priorRows = comparable ? prior.rows.filter(r => common.has(cohort(r))) : prior.rows;
  const comparison = {...glovoDelta(glovoMetrics(currentRows).purchaseSum, glovoMetrics(priorRows).purchaseSum,
    selected.coverage === "COMPLETE" && prior.coverage === "COMPLETE"), previousMonths,
    current: glovoMetrics(currentRows).purchaseSum, previous: glovoMetrics(priorRows).purchaseSum,
    common: common.size, currentCohorts: currentKeys.size, priorCohorts: priorKeys.size, mode: comparable ? "cohort" : "portfolio"};
  const rank = (kind: "brand" | "physical") => {
    const key = (r: GlovoRow) => kind === "brand" ? r.normalizedGroup ?? `UNKNOWN · ${r.rawBrand}`
      : r.physicalLocation ?? `UNKNOWN · ${r.sourceLocation}`;
    return [...new Set(selected.rows.map(key))].map(label => {
      const rows = selected.rows.filter(r => key(r) === label);
      const metrics = glovoMetrics(rows);
      const current = latest ? all.rows.filter(r => r.month === latest.month && key(r) === label) : [];
      const previous = latest ? all.rows.filter(r => r.month === previousMonth(latest.month) && key(r) === label) : [];
      const change = glovoDelta(glovoMetrics(current).purchaseSum, glovoMetrics(previous).purchaseSum,
        !!latest && monthComplete(all, latest.month) && monthComplete(all, previousMonth(latest.month)));
      return {label, ...metrics, ticket: glovoPairedTicket(rows), rows: rows.length,
        share: sum !== null && sum > 0 && metrics.purchaseSum !== null ? metrics.purchaseSum / sum * 100 : null,
        ...change, contribution: change.absolute !== null && latest?.absolute !== null && latest?.absolute !== undefined && latest.absolute !== 0
          ? change.absolute / latest.absolute * 100 : null};
    }).sort((a, b) => a.purchaseSum === null ? b.purchaseSum === null ? a.label.localeCompare(b.label) : 1 : b.purchaseSum === null ? -1 : b.purchaseSum - a.purchaseSum);
  };
  const matrixGroups = new Map<string, GlovoRow[]>();
  for (const row of selected.rows) {
    const key = JSON.stringify([row.normalizedGroup ?? row.rawBrand, row.physicalLocation ?? row.sourceLocation, row.month]);
    const group = matrixGroups.get(key) ?? [];
    group.push(row); matrixGroups.set(key, group);
  }
  const matrix = [...matrixGroups].map(([key, rows]) => {
    const [brand, location, month] = JSON.parse(key) as string[];
    const pairs = [...new Set(rows.map(r => JSON.stringify([r.rawBrand, r.sourceLocation])))].map(pair => JSON.parse(pair) as [string, string]);
    return {key, brand, location, month, ...glovoMetrics(rows), ticket: glovoPairedTicket(rows), pairs};
  }).sort((a, b) => a.key.localeCompare(b.key, "uk"));
  return {selected, coverage, averageTicket: glovoPairedTicket(selected.rows),
    virtualShare: virtualShare === null ? null : virtualShare / sum! * 100,
    trend, latest, comparison, brands: rank("brand"), locations: rank("physical"), matrix};
}
