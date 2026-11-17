import type { ComparisonMode, PeriodMode } from "@/lib/data/types";

export type AggregatorFilters = {
  year?: number;
  month?: number;
  brand?: string;
  ownership?: string;
  location?: string;
  orderType?: string;
};

export type AggregatorFilterOptions = {
  years: number[];
  brands: string[];
  ownerships: string[];
  locations: string[];
  orderTypes: string[];
};

export function aggregatorHref(
  state: AggregatorFilters & { period: PeriodMode; compare: ComparisonMode; lfl: boolean },
  patch: Partial<AggregatorFilters & { period: PeriodMode; compare: ComparisonMode; lfl: boolean }>
): string {
  const next = { ...state, ...patch };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined && value !== "" && value !== false) query.set(key, value === true ? "1" : String(value));
  }
  return `/aggregators?${query.toString()}`;
}

// A v2 response must never be presented as a successfully filtered v3 report.
export function aggregatorContractMatches(
  meta: Record<string, unknown> | undefined,
  filters: AggregatorFilters,
  period: PeriodMode,
  comparison: ComparisonMode,
  lfl: boolean
): boolean {
  if (meta?.contractVersion !== "aggregators-filters-v3" || meta.period !== period || meta.comparison !== comparison) return false;
  const echoed = meta.requestedFilters as Record<string, unknown> | undefined;
  if (!echoed || echoed.lfl !== lfl) return false;
  for (const key of ["year", "month", "brand", "ownership", "location", "orderType"] as const) {
    if ((echoed[key] ?? undefined) !== filters[key]) return false;
  }
  const cutoff = meta.cutoffDate;
  if (typeof cutoff !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) return false;
  const date = new Date(`${cutoff}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== cutoff) return false;
  return (filters.year === undefined || date.getUTCFullYear() === filters.year)
    && (filters.month === undefined || date.getUTCMonth() + 1 === filters.month);
}
