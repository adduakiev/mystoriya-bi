import type { OverviewData, OverviewQuery } from "./data/overview";
import type { SalesDataStatus } from "./data/source";

export type WarehouseObservation = { cutoff: string | null; version: string };
export type ReportObservation = {
  sql: boolean;
  latest: string;
  cutoff: string;
  year: number;
  month?: number;
  segmented: boolean;
  payloadValid: boolean;
};

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function warehouseObservation(status: SalesDataStatus): WarehouseObservation {
  if (status.source !== "supabase" || status.status !== "success" || !validDate(status.cutoffDate)) {
    return { cutoff: null, version: "unknown" };
  }
  return { cutoff: status.cutoffDate, version: JSON.stringify([status.cutoffDate, status.lastSuccessfulSync]) };
}

export function reportObservation(data: OverviewData, query: OverviewQuery): ReportObservation {
  return {
    sql: data.source === "supabase-sql" && data.status === "ready",
    latest: data.latestSourceDate,
    cutoff: data.status === "ready" ? data.snapshot.cutoffDate : "",
    year: data.selectedYear,
    month: data.selectedMonth,
    segmented: Boolean(query.channel || query.orderType || query.location || query.brand || query.ownership || query.lfl),
    payloadValid: data.status === "ready" && [data.snapshot.current.revenue, data.snapshot.current.checks,
      data.snapshot.current.markup].every(value => Number.isFinite(value))
  };
}

export function reportFreshness(report: ReportObservation, warehouse: WarehouseObservation): "stale" | "unknown" | "aligned" | "scoped" {
  if (!warehouse.cutoff) return "unknown";
  if (validDate(report.latest) && report.latest < warehouse.cutoff) return "stale";
  if (!report.sql || !report.payloadValid || !validDate(report.latest) || !validDate(report.cutoff)) return "unknown";
  // Global latest metadata must agree even for LFL/dimension and historical views.
  if (report.latest !== warehouse.cutoff) return "unknown";
  // A historical month or filtered location can legitimately stop earlier.
  // Never compare that scoped cutoff directly with the warehouse-wide maximum.
  if (report.segmented || report.year !== Number(warehouse.cutoff.slice(0, 4))
    || (report.month && report.month !== Number(warehouse.cutoff.slice(5, 7)))) return "scoped";
  return report.cutoff === warehouse.cutoff ? "aligned" : "stale";
}

export const FRESHNESS_MESSAGES = {
  stale: "STALE · Звіт відстає від Warehouse. Показники нижче не підтверджені як актуальні; повторіть перевірку.",
  unknown: "UNKNOWN · Свіжість звіту не підтверджена. Повторіть перевірку; наявні показники не означають актуальний LIVE-звіт.",
  aligned: "Дати звіту й Warehouse узгоджені. Повнота та суми незалежно не звірені; LIVE не підтверджено.",
  scoped: "Окремий період / зріз · cutoff може відрізнятися від Warehouse. Повнота та суми не звірені; LIVE не підтверджено."
};
