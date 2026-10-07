import type { ComparisonMode, PeriodMode, SalesRow } from "@/lib/data/types";

export type MetricMode = "revenue" | "checks" | "averageCheck" | "markupRate";
export type GrainMode = "month" | "week";

export const CLOSED_LOCATION_NAMES = [
  "Кудряшова",
  "Європарк",
  "Поділ",
  "Піраміда",
  "Черкаси",
  "Сверстюка",
  "ЖК Галактика"
] as const;

function normalizeLocationName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("uk-UA")
    .replace(/ё/g, "е")
    .replace(/ї/g, "і")
    .replace(/\s+/g, " ");
}

const CLOSED_LOCATION_KEYS = new Set([
  "кудряшова",
  "кудряшова new",
  "мокра",
  "європарк",
  "европарк",
  "європарк new",
  "европарк new",
  "поділ",
  "піраміда",
  "пирамида",
  "черкаси",
  "сверстюка",
  "жк галактика",
  "галактика"
].map(normalizeLocationName));

export function isClosedLocation(location: string): boolean {
  const normalized = normalizeLocationName(location);
  return CLOSED_LOCATION_KEYS.has(normalized);
}

export type DashboardFilters = {
  channel?: string;
  orderType?: string;
  location?: string;
  brand?: string;
  ownership?: string;
  year?: number;
  month?: number;
  period?: PeriodMode;
  compare?: ComparisonMode;
  metric?: MetricMode;
  grain?: GrainMode;
  lfl?: boolean;
};

export function filterSalesRows(rows: SalesRow[], filters: DashboardFilters): SalesRow[] {
  return rows.filter((row) => {
    if (filters.lfl && isClosedLocation(row.location)) return false;
    if (filters.channel && row.channelGroup !== filters.channel) return false;
    if (filters.orderType && row.orderType !== filters.orderType) return false;
    if (filters.location && row.location !== filters.location) return false;
    if (filters.brand && row.brand !== filters.brand) return false;
    if (filters.ownership && row.ownership !== filters.ownership) return false;
    return true;
  });
}

export function queryHref(
  current: DashboardFilters,
  patch: Partial<DashboardFilters>
): string {
  const next: DashboardFilters = { ...current, ...patch };
  const params = new URLSearchParams();

  if (next.channel) params.set("channel", next.channel);
  if (next.orderType) params.set("orderType", next.orderType);
  if (next.location) params.set("location", next.location);
  if (next.brand) params.set("brand", next.brand);
  if (next.ownership) params.set("ownership", next.ownership);
  if (next.year) params.set("year", String(next.year));
  if (next.month) params.set("month", String(next.month));
  if (next.period && next.period !== "ytd") params.set("period", next.period);
  if (next.compare && next.compare !== "ly") params.set("compare", next.compare);
  if (next.metric && next.metric !== "revenue") params.set("metric", next.metric);
  if (next.grain && next.grain !== "month") params.set("grain", next.grain);
  if (next.lfl) params.set("lfl", "1");

  const query = params.toString();
  return query ? `/?${query}` : "/";
}
